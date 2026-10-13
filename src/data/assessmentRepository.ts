import type { Cr1b4_opportunityassessments, Cr1b4_opportunityassessmentsBase } from '../generated/models/Cr1b4_opportunityassessmentsModel'
import { Cr1b4_opportunityassessmentsService } from '../generated/services/Cr1b4_opportunityassessmentsService'
import { createAssessment, demoAssessments, type Assessment, type Recommendation } from '../domain/assessment'
import { calculateScore } from '../domain/scoring'

const selectColumns = [
  'cr1b4_assessmentsnapshotjson',
  'md_assessmentsnapshotfull',
  'cr1b4_capturedon',
  'cr1b4_changesummary',
  'cr1b4_historyevent',
  'cr1b4_opportunityassessmentid',
  'cr1b4_opportunityname',
  'cr1b4_qualificationscore',
  'cr1b4_recommendation',
  'cr1b4_recommendationreasoning',
  'cr1b4_versionnumber',
  'modifiedon',
  'statecode',
]

export interface AssessmentRepository {
  getAll(): Promise<Assessment[]>
  saveAll(assessments: Assessment[]): Promise<void>
}

const localStorageKey = 'md-discover-assessment.local-demo.v1'

export class LocalStorageAssessmentRepository implements AssessmentRepository {
  async getAll(): Promise<Assessment[]> {
    const value = localStorage.getItem(localStorageKey)
    if (!value) return []
    try {
      return JSON.parse(value) as Assessment[]
    } catch {
      localStorage.removeItem(localStorageKey)
      return []
    }
  }

  async saveAll(assessments: Assessment[]): Promise<void> {
    localStorage.setItem(localStorageKey, JSON.stringify(assessments))
  }
}

interface SnapshotPayload {
  assessment: Partial<Assessment>
  score?: number
  recommendation?: Recommendation
}

function parseSnapshot(record: Cr1b4_opportunityassessments): SnapshotPayload {
  let snapshot: SnapshotPayload = { assessment: {} }
  const snapshotJson = record.md_assessmentsnapshotfull || record.cr1b4_assessmentsnapshotjson
  if (snapshotJson) {
    const parsed: unknown = JSON.parse(snapshotJson)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const data = parsed as SnapshotPayload & Partial<Assessment>
      snapshot = {
        assessment: data.assessment ?? data,
        score: data.score,
        recommendation: data.recommendation,
      }
    }
  }
  return snapshot
}

function fallbackAssessmentId(value: string): string {
  return `dataverse-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function toAssessment(records: Cr1b4_opportunityassessments[], groupKey: string): Assessment {
  const ordered = [...records].sort((left, right) =>
    (left.cr1b4_versionnumber ?? 0) - (right.cr1b4_versionnumber ?? 0)
    || (left.cr1b4_capturedon ?? '').localeCompare(right.cr1b4_capturedon ?? ''),
  )
  const latest = ordered.at(-1)!
  const latestSnapshot = parseSnapshot(latest)
  const displayName = latest.cr1b4_opportunityname || latestSnapshot.assessment.name || 'Untitled assessment'
  const demo = demoAssessments.find((item) => item.name === displayName || item.customerName === displayName)
  const fallback = demo ? { ...demo } : createAssessment()
  const stored = latestSnapshot.assessment
  const id = stored.id || groupKey
  const baseScore = calculateScore({ ...fallback, ...stored })
  const rowHistory = ordered.filter((record) => (record.cr1b4_versionnumber ?? parseSnapshot(record).assessment.version ?? 0) > 0).map((record) => {
    const snapshot = parseSnapshot(record)
    const score = Math.max(0, Math.min(100, snapshot.score ?? record.cr1b4_qualificationscore ?? baseScore.score))
    const recommendation = snapshot.recommendation
      ?? (record.cr1b4_recommendation === 0 ? 'Pursue' : record.cr1b4_recommendation === 1 ? 'Do Not Pursue' : baseScore.recommendation)
    return {
      version: record.cr1b4_versionnumber ?? snapshot.assessment.version ?? 1,
      savedAt: record.cr1b4_capturedon ?? snapshot.assessment.lastReviewDate ?? new Date().toISOString(),
      score,
      recommendation,
    }
  })
  const historyByVersion = new Map<number, Assessment['history'][number]>()
  for (const revision of [...(fallback.history ?? []), ...(stored.history ?? []), ...rowHistory]) {
    historyByVersion.set(revision.version, { ...revision, score: Math.max(0, Math.min(100, revision.score)) })
  }

  return {
    ...fallback,
    ...stored,
    id,
    name: stored.name ?? demo?.name ?? displayName,
    customerName: stored.customerName ?? demo?.customerName ?? displayName,
    recommendationReasoning: stored.recommendationReasoning || latest.cr1b4_recommendationreasoning || '',
    status: stored.status || (latest.cr1b4_historyevent === 'Review Completed' ? 'Complete' : 'Draft'),
    lastReviewDate: stored.lastReviewDate !== undefined ? stored.lastReviewDate : latest.cr1b4_historyevent === 'Review Completed' ? latest.cr1b4_capturedon || null : null,
    version: stored.version ?? latest.cr1b4_versionnumber ?? 0,
    history: [...historyByVersion.values()].sort((left, right) => left.version - right.version),
    updatedAt: stored.updatedAt || latest.modifiedon || latest.cr1b4_capturedon || fallback.updatedAt,
  }
}

function getErrorMessage(error: unknown, depth = 0): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && depth < 4) {
    const details = error as Record<string, unknown>
    for (const key of ['message', 'description']) {
      if (typeof details[key] === 'string' && details[key].trim()) return details[key]
    }
    for (const key of ['error', 'innerError', 'innererror']) {
      if (details[key]) {
        const message = getErrorMessage(details[key], depth + 1)
        if (message !== 'Unknown Dataverse data operation error.') return message
      }
    }
    if (typeof details.code === 'string') return `Dataverse error ${details.code}`
  }
  return 'Unknown Dataverse data operation error.'
}

export class DataverseAssessmentRepository implements AssessmentRepository {
  private readonly recordIds = new Map<string, string>()
  private readonly recordVersions = new Map<string, number>()
  private readonly savedSnapshots = new Map<string, string>()
  private writeQueue: Promise<void> = Promise.resolve()

  async getAll(): Promise<Assessment[]> {
    const result = await Cr1b4_opportunityassessmentsService.getAll({
      select: selectColumns,
      filter: 'statecode eq 0',
      orderBy: ['cr1b4_capturedon desc'],
      top: 5000,
    })
    if (result.error) throw new Error(getErrorMessage(result.error))

    const records = result.data ?? []
    const groups = new Map<string, Cr1b4_opportunityassessments[]>()
    for (const record of records) {
      const snapshot = parseSnapshot(record)
      if (!record.md_assessmentsnapshotfull && record.cr1b4_assessmentsnapshotjson) {
        const legacySnapshot = record.cr1b4_assessmentsnapshotjson
        const migration = await Cr1b4_opportunityassessmentsService.update(record.cr1b4_opportunityassessmentid, {
          md_assessmentsnapshotfull: legacySnapshot,
        })
        if (migration.error) throw new Error(`Snapshot migration failed: ${getErrorMessage(migration.error)}`)
        const verification = await Cr1b4_opportunityassessmentsService.get(record.cr1b4_opportunityassessmentid, {
          select: ['md_assessmentsnapshotfull', 'cr1b4_assessmentsnapshotjson'],
        })
        if (verification.error) throw new Error(`Snapshot migration verification failed: ${getErrorMessage(verification.error)}`)
        if (verification.data?.md_assessmentsnapshotfull !== legacySnapshot
          || verification.data?.cr1b4_assessmentsnapshotjson !== legacySnapshot) {
          throw new Error(`Snapshot migration could not be verified for ${record.cr1b4_opportunityassessmentid}.`)
        }
        record.md_assessmentsnapshotfull = legacySnapshot
      }
      const groupKey = snapshot.assessment.id
        || fallbackAssessmentId(record.cr1b4_opportunityname || record.cr1b4_opportunityassessmentid)
      groups.set(groupKey, [...(groups.get(groupKey) ?? []), record])
    }

    const assessments = [...groups.entries()].map(([groupKey, group]) => {
      const ordered = [...group].sort((left, right) => (left.cr1b4_versionnumber ?? 0) - (right.cr1b4_versionnumber ?? 0))
      const latest = ordered.at(-1)!
      const assessment = toAssessment(ordered, groupKey)
      this.recordIds.set(assessment.id, latest.cr1b4_opportunityassessmentid)
      this.recordVersions.set(assessment.id, latest.cr1b4_versionnumber ?? assessment.version)
      this.savedSnapshots.set(assessment.id, JSON.stringify(assessment))
      return assessment
    })
    return assessments
  }

  saveAll(assessments: Assessment[]): Promise<void> {
    const operation = this.writeQueue
      .catch(() => undefined)
      .then(() => this.persistChangedAssessments(assessments))
    this.writeQueue = operation
    return operation
  }

  private async persistChangedAssessments(assessments: Assessment[]) {
    for (const assessment of assessments) {
      const snapshot = JSON.stringify(assessment)
      if (this.savedSnapshots.get(assessment.id) === snapshot) continue
      if (snapshot.length > 1048576) throw new Error('Assessment snapshot exceeds the 1,048,576-character limit.')
      if (assessment.recommendationReasoning.length > 4000) throw new Error('Recommendation reasoning exceeds the 4,000-character limit.')

      const score = calculateScore(assessment)
      const summaryRecommendation = score.recommendation === 'Pursue'
        ? 0
        : score.recommendation === 'Do Not Pursue'
          ? 1
          : null
      const record: Omit<Cr1b4_opportunityassessmentsBase, 'cr1b4_opportunityassessmentid'> = {
        statecode: 0,
        cr1b4_opportunityname: assessment.name || assessment.customerName || 'Untitled assessment',
        md_assessmentsnapshotfull: snapshot,
        cr1b4_capturedon: assessment.lastReviewDate || assessment.updatedAt,
        cr1b4_changesummary: assessment.status === 'Complete'
          ? `Review completed at version ${assessment.version}`
          : 'Draft autosaved',
        cr1b4_historyevent: assessment.status === 'Complete' ? 'Review Completed' : 'Assessment Updated',
        cr1b4_qualificationscore: score.score,
        cr1b4_recommendation: summaryRecommendation as Cr1b4_opportunityassessmentsBase['cr1b4_recommendation'],
        cr1b4_recommendationreasoning: assessment.recommendationReasoning || undefined,
        cr1b4_versionnumber: assessment.version > 0 ? assessment.version : undefined,
      }

      const recordId = this.recordIds.get(assessment.id)
      const isNewCompletedVersion = assessment.status === 'Complete'
        && assessment.version > (this.recordVersions.get(assessment.id) ?? 0)
      if (recordId && !isNewCompletedVersion) {
        const result = await Cr1b4_opportunityassessmentsService.update(recordId, record)
        if (result.error) throw new Error(getErrorMessage(result.error))
      } else {
        const result = await Cr1b4_opportunityassessmentsService.create(record)
        if (result.error) throw new Error(getErrorMessage(result.error))
        const created = result.data
        if (!created) throw new Error('Dataverse created the assessment but returned no record data.')
        this.recordIds.set(assessment.id, created.cr1b4_opportunityassessmentid)
      }
      this.recordVersions.set(assessment.id, assessment.version)
      this.savedSnapshots.set(assessment.id, snapshot)
    }
  }
}

export const localDemoMode = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('dataMode') === 'local'

export const assessmentRepository: AssessmentRepository = localDemoMode
  ? new LocalStorageAssessmentRepository()
  : new DataverseAssessmentRepository()