import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAssessment, demoAssessments } from '../domain/assessment'
import { DataverseAssessmentRepository } from './assessmentRepository'

const service = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), getAll: vi.fn(), get: vi.fn() }))

vi.mock('../generated/services/Cr1b4_opportunityassessmentsService', () => ({
  Cr1b4_opportunityassessmentsService: service,
}))

describe('Dataverse assessment errors', () => {
  beforeEach(() => vi.resetAllMocks())

  it('preserves plain-object error messages when creating an assessment', async () => {
    service.create.mockResolvedValue({ error: { message: 'Snapshot exceeds the column limit.' } })
    await expect(new DataverseAssessmentRepository().saveAll([createAssessment()]))
      .rejects.toThrow('Snapshot exceeds the column limit.')
  })

  it('preserves nested Dataverse errors', async () => {
    service.create.mockResolvedValue({ error: { error: { message: 'Write permission denied.' } } })
    await expect(new DataverseAssessmentRepository().saveAll([createAssessment()]))
      .rejects.toThrow('Write permission denied.')
  })

  it('reports the error code when no message is supplied', async () => {
    service.create.mockResolvedValue({ error: { code: 'InvalidRequest' } })
    await expect(new DataverseAssessmentRepository().saveAll([createAssessment()]))
      .rejects.toThrow('Dataverse error InvalidRequest')
  })
})

describe('Dataverse assessment snapshots', () => {
  beforeEach(() => vi.resetAllMocks())

  it('writes complete assessments only to the multiline column', async () => {
    const assessment = createAssessment()
    assessment.name = 'Test opportunity'
    assessment.customerName = 'Test customer'
    assessment.businessObjectives = 'Detailed objectives. '.repeat(300)
    service.create.mockResolvedValue({ data: { cr1b4_opportunityassessmentid: 'record-1' } })
    const repository = new DataverseAssessmentRepository()
    await repository.saveAll([assessment])
    const record = service.create.mock.calls[0][0]
    expect(record.cr1b4_opportunityname).toBe(assessment.name)
    expect(JSON.parse(record.md_assessmentsnapshotfull)).toEqual(assessment)
    expect(record.md_assessmentsnapshotfull.length).toBeGreaterThan(4000)
    expect(record).not.toHaveProperty('cr1b4_assessmentsnapshotjson')
    service.getAll.mockResolvedValue({ data: [{ ...record, cr1b4_opportunityassessmentid: 'record-1' }] })
    expect(await new DataverseAssessmentRepository().getAll()).toEqual([assessment])
  })

  it('prefers the multiline snapshot and updates the same row', async () => {
    const assessment = createAssessment()
    assessment.name = 'Full snapshot'
    service.getAll.mockResolvedValue({ data: [{
      cr1b4_opportunityassessmentid: 'record-1',
      md_assessmentsnapshotfull: JSON.stringify(assessment),
      cr1b4_assessmentsnapshotjson: JSON.stringify({ name: 'Legacy snapshot' }),
    }] })
    const repository = new DataverseAssessmentRepository()
    const loaded = await repository.getAll()
    expect(loaded[0].name).toBe('Full snapshot')
    expect(service.getAll.mock.calls[0][0].select).toContain('md_assessmentsnapshotfull')
    service.update.mockResolvedValue({ data: {} })
    await repository.saveAll([{ ...loaded[0], customerName: 'Updated customer' }])
    expect(service.update).toHaveBeenCalledWith('record-1', expect.objectContaining({
      md_assessmentsnapshotfull: expect.any(String),
    }))
    expect(service.create).not.toHaveBeenCalled()
  })

  it('reads legacy sample revisions as one assessment when the full column is empty', async () => {
    const records = [1, 2].map((version) => ({
      cr1b4_opportunityassessmentid: `record-${version}`,
      cr1b4_opportunityname: demoAssessments[0].name,
      cr1b4_versionnumber: version,
      cr1b4_assessmentsnapshotjson: JSON.stringify({ version, score: version === 1 ? 100 : 105, recommendation: 'Pursue' }),
      md_assessmentsnapshotfull: '',
    }))
    service.getAll.mockResolvedValue({ data: records })
    service.update.mockResolvedValue({ data: {} })
    service.get.mockImplementation(async (recordId: string) => {
      const record = records.find((item) => item.cr1b4_opportunityassessmentid === recordId)!
      return { data: { md_assessmentsnapshotfull: record.cr1b4_assessmentsnapshotjson, cr1b4_assessmentsnapshotjson: record.cr1b4_assessmentsnapshotjson } }
    })
    const loaded = await new DataverseAssessmentRepository().getAll()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].customerName).toBe('Contoso Ltd.')
    expect(loaded[0].history.map((revision) => revision.score)).toEqual([100, 100])
    for (const record of records) {
      expect(service.update).toHaveBeenCalledWith(record.cr1b4_opportunityassessmentid, {
        md_assessmentsnapshotfull: record.cr1b4_assessmentsnapshotjson,
      })
    }
    expect(service.update).toHaveBeenCalledTimes(2)
    await new DataverseAssessmentRepository().getAll()
    expect(service.update).toHaveBeenCalledTimes(2)
    expect(service.create).not.toHaveBeenCalled()
  })

  it('groups legacy name-only rows with rows carrying their generated assessment ID', async () => {
    const assessmentId = 'dataverse-contoso-cloud-modernization'
    const legacySnapshot = JSON.stringify({ version: 1, score: 100, recommendation: 'Pursue' })
    const records = [
      {
        cr1b4_opportunityassessmentid: 'legacy-record',
        cr1b4_opportunityname: demoAssessments[0].name,
        cr1b4_versionnumber: 1,
        cr1b4_assessmentsnapshotjson: legacySnapshot,
        md_assessmentsnapshotfull: '',
      },
      {
        cr1b4_opportunityassessmentid: 'current-record',
        cr1b4_opportunityname: demoAssessments[0].customerName,
        cr1b4_versionnumber: 2,
        md_assessmentsnapshotfull: JSON.stringify({ ...demoAssessments[0], id: assessmentId, version: 2 }),
      },
    ]
    service.getAll.mockResolvedValue({ data: records })
    service.update.mockResolvedValue({ data: {} })
    service.get.mockResolvedValue({ data: {
      md_assessmentsnapshotfull: legacySnapshot,
      cr1b4_assessmentsnapshotjson: legacySnapshot,
    } })

    const loaded = await new DataverseAssessmentRepository().getAll()

    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe(assessmentId)
    expect(loaded[0].history.map((revision) => revision.version)).toEqual([1, 2])
  })

  it('reports unverified migrations rather than claiming success', async () => {
    service.getAll.mockResolvedValue({ data: [{
      cr1b4_opportunityassessmentid: 'record-1',
      cr1b4_assessmentsnapshotjson: '{"version":1}',
    }] })
    service.update.mockResolvedValue({ data: {} })
    service.get.mockResolvedValue({ data: { cr1b4_assessmentsnapshotjson: '{"version":1}' } })
    await expect(new DataverseAssessmentRepository().getAll())
      .rejects.toThrow('Snapshot migration could not be verified for record-1.')
    expect(service.create).not.toHaveBeenCalled()
  })

  it('rejects oversized reasoning without sending a write', async () => {
    const assessment = createAssessment()
    assessment.recommendationReasoning = 'x'.repeat(4001)
    await expect(new DataverseAssessmentRepository().saveAll([assessment]))
      .rejects.toThrow('Recommendation reasoning exceeds the 4,000-character limit.')
    expect(service.create).not.toHaveBeenCalled()
  })

  it('rejects oversized snapshots without truncating data or sending a write', async () => {
    const assessment = createAssessment()
    assessment.businessObjectives = 'x'.repeat(1048576)
    await expect(new DataverseAssessmentRepository().saveAll([assessment]))
      .rejects.toThrow('Assessment snapshot exceeds the 1,048,576-character limit.')
    expect(service.create).not.toHaveBeenCalled()
  })
})