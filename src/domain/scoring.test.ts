import { describe, expect, it } from 'vitest'
import { createAssessment, type Assessment } from './assessment'
import { calculateScore, generateInsights } from './scoring'

const positiveSignals: (keyof Assessment)[] = [
  'strategicCustomer',
  'enterpriseScale',
  'multipleInitiatives',
  'longTermPartnership',
  'microsoftAlignment',
  'budgetConfirmed',
  'businessNeedConfirmed',
  'executiveSupportConfirmed',
  'executiveSponsorIdentified',
  'decisionMakerIdentified',
]

function assessmentWithSignals(count: number) {
  const assessment = createAssessment()
  for (const key of positiveSignals.slice(0, count)) Object.assign(assessment, { [key]: true })
  assessment.deliveryRisk = 'Low'
  assessment.commercialRisk = 'Low'
  assessment.relationshipRisk = 'Low'
  assessment.winProbability = 0
  return assessment
}

describe('calculateScore', () => {
  it('recommends Pursue at exactly 80 points', () => {
    const result = calculateScore(assessmentWithSignals(8))
    expect(result.score).toBe(80)
    expect(result.recommendation).toBe('Pursue')
  })

  it('recommends Pursue With Risks at exactly 60 points', () => {
    const result = calculateScore(assessmentWithSignals(6))
    expect(result.score).toBe(60)
    expect(result.recommendation).toBe('Pursue With Risks')
  })

  it('recommends Do Not Pursue below 60 points', () => {
    const assessment = assessmentWithSignals(6)
    assessment.deliveryRisk = 'Medium'
    expect(calculateScore(assessment).score).toBe(55)
    expect(calculateScore(assessment).recommendation).toBe('Do Not Pursue')
  })

  it('applies risk deductions and the strict greater-than-75 win bonus', () => {
    const assessment = assessmentWithSignals(2)
    assessment.deliveryRisk = 'Medium'
    assessment.commercialRisk = 'High'
    assessment.winProbability = 75
    expect(calculateScore(assessment).score).toBe(5)
    assessment.winProbability = 76
    expect(calculateScore(assessment).score).toBe(15)
  })

  it('caps the result at 100 even with the win bonus', () => {
    const assessment = assessmentWithSignals(10)
    assessment.winProbability = 100
    expect(calculateScore(assessment).score).toBe(100)
    assessment.deliveryRisk = 'Medium'
    expect(calculateScore(assessment).score).toBe(100)
  })

  it('does not allow risk deductions to produce a negative score', () => {
    const assessment = assessmentWithSignals(0)
    assessment.deliveryRisk = 'High'
    assessment.commercialRisk = 'High'
    assessment.relationshipRisk = 'High'
    expect(calculateScore(assessment).score).toBe(0)
  })
})

describe('generateInsights', () => {
  it('surfaces missing stakeholders, funding, and unassessed risks', () => {
    const insights = generateInsights(createAssessment())
    expect(insights.gaps).toContain('Executive sponsor is not identified.')
    expect(insights.gaps).toContain('Funding and budget are not confirmed.')
    expect(insights.gaps).toContain('Delivery risk has not been assessed.')
    expect(insights.nextActions.length).toBeGreaterThan(0)
  })
})