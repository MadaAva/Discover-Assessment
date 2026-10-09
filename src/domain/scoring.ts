import type { Assessment, Recommendation, RiskLevel } from './assessment'

const qualificationSignals = [
  ['strategicCustomer', 'Strategic customer'],
  ['enterpriseScale', 'Enterprise scale'],
  ['multipleInitiatives', 'Multiple initiatives'],
  ['longTermPartnership', 'Long-term partnership potential'],
  ['microsoftAlignment', 'Microsoft alignment'],
  ['budgetConfirmed', 'Budget confirmed'],
  ['businessNeedConfirmed', 'Business need confirmed'],
  ['executiveSupportConfirmed', 'Executive support'],
  ['executiveSponsorIdentified', 'Executive sponsor identified'],
  ['decisionMakerIdentified', 'Decision maker identified'],
] as const satisfies ReadonlyArray<readonly [keyof Assessment, string]>

const riskPenalty: Record<RiskLevel, number> = {
  Low: 0,
  Medium: 5,
  High: 10,
  Unassessed: 0,
}

export interface AssessmentScore {
  score: number
  recommendation: Recommendation
  positives: number
  riskDeduction: number
  winProbabilityBonus: number
}

export interface AssessmentInsights {
  strengths: string[]
  risks: string[]
  gaps: string[]
  nextActions: string[]
}

export function calculateScore(assessment: Assessment): AssessmentScore {
  const positives = qualificationSignals.reduce(
    (total, [key]) => total + (assessment[key] === true ? 10 : 0),
    0,
  )
  const riskDeduction = [assessment.deliveryRisk, assessment.commercialRisk, assessment.relationshipRisk]
    .reduce((total, level) => total + riskPenalty[level], 0)
  const winProbabilityBonus = assessment.winProbability > 75 ? 10 : 0
  const score = Math.max(0, Math.min(100, positives - riskDeduction + winProbabilityBonus))
  const recommendation: Recommendation = score >= 80
    ? 'Pursue'
    : score >= 60
      ? 'Pursue With Risks'
      : 'Do Not Pursue'

  return { score, recommendation, positives, riskDeduction, winProbabilityBonus }
}

export function generateInsights(assessment: Assessment): AssessmentInsights {
  const score = calculateScore(assessment)
  const strengths = qualificationSignals
    .filter(([key]) => assessment[key] === true)
    .map(([, label]) => label)
  const risks = ([
    ['deliveryRisk', 'Delivery'],
    ['commercialRisk', 'Commercial'],
    ['relationshipRisk', 'Relationship'],
  ] as const)
    .filter(([key]) => assessment[key] === 'High' || assessment[key] === 'Medium')
    .map(([key, label]) => `${label} risk is ${assessment[key].toLowerCase()}.`)
  if (assessment.competitiveThreatIdentified && assessment.competitors.trim()) {
    risks.push(`Competitive pressure from ${assessment.competitors.trim()}.`)
  }

  const gaps: string[] = []
  if (!assessment.executiveSponsorIdentified) gaps.push('Executive sponsor is not identified.')
  if (!assessment.decisionMakerIdentified) gaps.push('Decision maker is not identified.')
  if (!assessment.stakeholderMapCompleted) gaps.push('Stakeholder map is incomplete.')
  if (!assessment.budgetConfirmed) gaps.push('Funding and budget are not confirmed.')
  if (!assessment.microsoftFundingPotential) gaps.push('Microsoft funding potential has not been explored.')
  if (!assessment.businessNeedConfirmed) gaps.push('Business need needs validation.')
  if (!assessment.businessObjectives.trim()) gaps.push('Business objectives have not been captured.')
  if (!assessment.timeline.trim()) gaps.push('Decision timeline is missing.')
  if (assessment.deliveryRisk === 'Unassessed') gaps.push('Delivery risk has not been assessed.')
  if (assessment.commercialRisk === 'Unassessed') gaps.push('Commercial risk has not been assessed.')
  if (assessment.relationshipRisk === 'Unassessed') gaps.push('Relationship risk has not been assessed.')

  const nextActions: string[] = []
  if (!assessment.executiveSponsorIdentified || !assessment.decisionMakerIdentified) {
    nextActions.push('Map the buying group and secure access to the sponsor and decision maker.')
  }
  if (!assessment.budgetConfirmed) nextActions.push('Validate funding source, budget owner, and approval path.')
  if (risks.length) nextActions.push('Assign an owner and mitigation plan to each medium or high risk.')
  if (!assessment.whyAvanadeWins.trim()) nextActions.push('Document the evidence behind Avanade’s win strategy.')
  if (score.recommendation !== 'Pursue') nextActions.push('Re-score after the qualification gaps have been addressed.')
  if (!nextActions.length) nextActions.push('Confirm the pursuit team, decision milestones, and customer success measures.')

  return { strengths, risks, gaps, nextActions }
}