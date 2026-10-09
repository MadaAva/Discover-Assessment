export type Recommendation = 'Pursue' | 'Pursue With Risks' | 'Do Not Pursue'
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Unassessed'
export type AssessmentStatus = 'Draft' | 'In Review' | 'Complete'

export interface AssessmentRevision {
  version: number
  savedAt: string
  score: number
  recommendation: Recommendation
}

export interface Assessment {
  id: string
  name: string
  customerName: string
  industry: string
  region: string
  annualRevenue: number | null
  employeeCount: number | null
  existingMicrosoftCustomer: boolean
  existingAvanadeCustomer: boolean
  businessObjectives: string
  currentInitiatives: string
  microsoftPriorities: string
  customerPainPoints: string
  desiredOutcomes: string
  risksOfDoingNothing: string
  timeline: string
  executiveSponsorIdentified: boolean
  decisionMakerIdentified: boolean
  stakeholderMapCompleted: boolean
  strategicCustomer: boolean
  enterpriseScale: boolean
  multipleInitiatives: boolean
  longTermPartnership: boolean
  microsoftAlignment: boolean
  budgetConfirmed: boolean
  businessNeedConfirmed: boolean
  executiveSupportConfirmed: boolean
  competitiveThreatIdentified: boolean
  microsoftFundingPotential: boolean
  winProbability: number
  whyAvanadeWins: string
  competitors: string
  keyDifferentiators: string
  deliveryRisk: RiskLevel
  commercialRisk: RiskLevel
  relationshipRisk: RiskLevel
  recommendationReasoning: string
  status: AssessmentStatus
  lastReviewDate: string | null
  version: number
  history: AssessmentRevision[]
  updatedAt: string
}

export type AssessmentInput = Omit<Assessment, 'id' | 'version' | 'history' | 'updatedAt'>

export const createAssessment = (): Assessment => ({
  id: crypto.randomUUID(),
  name: 'New opportunity assessment',
  customerName: '',
  industry: '',
  region: '',
  annualRevenue: null,
  employeeCount: null,
  existingMicrosoftCustomer: false,
  existingAvanadeCustomer: false,
  businessObjectives: '',
  currentInitiatives: '',
  microsoftPriorities: '',
  customerPainPoints: '',
  desiredOutcomes: '',
  risksOfDoingNothing: '',
  timeline: '',
  executiveSponsorIdentified: false,
  decisionMakerIdentified: false,
  stakeholderMapCompleted: false,
  strategicCustomer: false,
  enterpriseScale: false,
  multipleInitiatives: false,
  longTermPartnership: false,
  microsoftAlignment: false,
  budgetConfirmed: false,
  businessNeedConfirmed: false,
  executiveSupportConfirmed: false,
  competitiveThreatIdentified: false,
  microsoftFundingPotential: false,
  winProbability: 50,
  whyAvanadeWins: '',
  competitors: '',
  keyDifferentiators: '',
  deliveryRisk: 'Unassessed',
  commercialRisk: 'Unassessed',
  relationshipRisk: 'Unassessed',
  recommendationReasoning: '',
  status: 'Draft',
  lastReviewDate: null,
  version: 0,
  history: [],
  updatedAt: new Date().toISOString(),
})

export const demoAssessments: Assessment[] = [
  {
    ...createAssessment(),
    id: 'demo-contoso',
    name: 'Contoso cloud modernization',
    customerName: 'Contoso Ltd.',
    industry: 'Manufacturing',
    region: 'North America',
    annualRevenue: 4200000000,
    employeeCount: 12400,
    existingMicrosoftCustomer: true,
    existingAvanadeCustomer: true,
    businessObjectives: 'Modernize the global data platform and improve plant resilience.',
    currentInitiatives: 'Azure landing zone, data estate modernization, frontline experience.',
    microsoftPriorities: 'Azure, Fabric, security and Copilot readiness.',
    customerPainPoints: 'Fragmented operational data and a long release cycle.',
    desiredOutcomes: 'A governed data platform and measurable improvement in plant uptime.',
    risksOfDoingNothing: 'Rising maintenance cost and slower product launches.',
    timeline: 'Target decision in Q3; phased delivery over 18 months.',
    executiveSponsorIdentified: true,
    decisionMakerIdentified: true,
    stakeholderMapCompleted: true,
    strategicCustomer: true,
    enterpriseScale: true,
    multipleInitiatives: true,
    longTermPartnership: true,
    microsoftAlignment: true,
    budgetConfirmed: true,
    businessNeedConfirmed: true,
    executiveSupportConfirmed: true,
    competitiveThreatIdentified: true,
    microsoftFundingPotential: true,
    winProbability: 82,
    whyAvanadeWins: 'Existing delivery relationships and a unified Microsoft platform strategy.',
    competitors: 'Global systems integrator; specialist cloud firm.',
    keyDifferentiators: 'Industry delivery assets, Microsoft alignment, and global scale.',
    deliveryRisk: 'Medium',
    commercialRisk: 'Low',
    relationshipRisk: 'Low',
    status: 'In Review',
    lastReviewDate: new Date().toISOString(),
    version: 2,
    history: [
      { version: 1, savedAt: new Date(Date.now() - 86400000 * 4).toISOString(), score: 100, recommendation: 'Pursue' },
      { version: 2, savedAt: new Date().toISOString(), score: 100, recommendation: 'Pursue' },
    ],
  },
  {
    ...createAssessment(),
    id: 'demo-fabrikam',
    name: 'Fabrikam customer experience',
    customerName: 'Fabrikam Financial',
    industry: 'Financial Services',
    region: 'Europe',
    annualRevenue: 1800000000,
    employeeCount: 6800,
    existingMicrosoftCustomer: true,
    existingAvanadeCustomer: false,
    businessObjectives: 'Simplify digital onboarding and reduce customer effort.',
    currentInitiatives: 'Contact center transformation and CRM consolidation.',
    microsoftPriorities: 'Dynamics 365, Azure and responsible AI.',
    customerPainPoints: 'Disconnected channels and manual compliance checks.',
    desiredOutcomes: 'Higher digital completion and faster customer response.',
    risksOfDoingNothing: 'Continued attrition and increasing service costs.',
    timeline: 'Funding decision expected this year.',
    executiveSponsorIdentified: true,
    decisionMakerIdentified: false,
    stakeholderMapCompleted: false,
    strategicCustomer: true,
    enterpriseScale: true,
    multipleInitiatives: true,
    longTermPartnership: false,
    microsoftAlignment: true,
    budgetConfirmed: false,
    businessNeedConfirmed: true,
    executiveSupportConfirmed: true,
    competitiveThreatIdentified: true,
    microsoftFundingPotential: true,
    winProbability: 68,
    whyAvanadeWins: 'Strong domain capability and an aligned Microsoft roadmap.',
    competitors: 'Incumbent CRM partner.',
    keyDifferentiators: 'Customer experience and compliance expertise.',
    deliveryRisk: 'Medium',
    commercialRisk: 'High',
    relationshipRisk: 'Medium',
    status: 'In Review',
    lastReviewDate: new Date(Date.now() - 86400000 * 2).toISOString(),
    version: 1,
    history: [{ version: 1, savedAt: new Date(Date.now() - 86400000 * 2).toISOString(), score: 50, recommendation: 'Do Not Pursue' }],
  },
  {
    ...createAssessment(),
    id: 'demo-northwind',
    name: 'Northwind supply chain discovery',
    customerName: 'Northwind Traders',
    industry: 'Retail',
    region: 'North America',
    annualRevenue: 760000000,
    employeeCount: 2900,
    existingMicrosoftCustomer: false,
    existingAvanadeCustomer: false,
    businessObjectives: 'Understand options to improve inventory visibility.',
    currentInitiatives: 'Initial discovery conversations only.',
    customerPainPoints: 'Seasonal stockouts and inconsistent supplier data.',
    timeline: 'No confirmed decision date.',
    executiveSponsorIdentified: false,
    decisionMakerIdentified: false,
    strategicCustomer: false,
    enterpriseScale: false,
    multipleInitiatives: false,
    longTermPartnership: false,
    microsoftAlignment: true,
    budgetConfirmed: false,
    businessNeedConfirmed: true,
    executiveSupportConfirmed: false,
    winProbability: 35,
    deliveryRisk: 'Unassessed',
    commercialRisk: 'High',
    relationshipRisk: 'High',
    status: 'Draft',
    lastReviewDate: null,
    version: 0,
    history: [],
  },
]