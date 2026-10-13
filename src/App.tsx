import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button, Checkbox, FluentProvider, Input, ProgressBar, Textarea, webLightTheme } from '@fluentui/react-components'
import {
  Add24Regular,
  ArrowDownload24Regular,
  ArrowLeft24Regular,
  ArrowRight24Regular,
  Building24Regular,
  ChartMultiple24Regular,
  CheckmarkCircle24Regular,
  ChevronLeft24Regular,
  ChevronRight24Regular,
  Clock24Regular,
  DocumentBulletList24Regular,
  Home24Regular,
  People24Regular,
  Print24Regular,
  Search24Regular,
  Shield24Regular,
  Sparkle24Regular,
  Target24Regular,
  Warning24Regular,
} from '@fluentui/react-icons'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Assessment, Recommendation, RiskLevel } from './domain/assessment'
import { createAssessment } from './domain/assessment'
import { calculateScore, generateInsights } from './domain/scoring'
import { AssessmentProvider } from './state/AssessmentProvider'
import { useAssessments } from './state/assessmentContext'
import './App.css'

type View = 'dashboard' | 'assessments' | 'wizard' | 'details'

const steps = ['Customer profile', 'Business context', 'Stakeholders', 'ICP assessment', 'Opportunity review', 'Win strategy', 'Risk assessment', 'Recommendation']
const recommendationColors: Record<Recommendation, string> = { Pursue: '#21835d', 'Pursue With Risks': '#c38a22', 'Do Not Pursue': '#c6504a' }

function App() {
  const theme = { ...webLightTheme, colorBrandBackground: '#247a58', colorBrandBackgroundHover: '#1c6549', colorBrandBackgroundPressed: '#15563e', colorBrandForeground1: '#247a58' }
  return <FluentProvider theme={theme} className="workspace-provider"><AssessmentProvider><AssessmentWorkspace /></AssessmentProvider></FluentProvider>
}

function AssessmentWorkspace() {
  const { assessments, ready, persistenceError, storageMode, saveDraft, completeAssessment } = useAssessments()
  const [view, setView] = useState<View>('dashboard')
  const [draft, setDraft] = useState<Assessment | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [search, setSearch] = useState('')
  const [recommendationFilter, setRecommendationFilter] = useState('All recommendations')
  const [sortBy, setSortBy] = useState('Newest')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [customerProfileCompleted, setCustomerProfileCompleted] = useState(false)
  const existingDraft = draft !== null && assessments.some((assessment) => assessment.id === draft.id)
  const canSaveDraft = draft !== null && (existingDraft || (customerProfileCompleted && draft.customerName.trim().length > 0))

  useEffect(() => {
    if (!draft || view !== 'wizard' || !canSaveDraft) return
    const timeout = window.setTimeout(() => {
      saveDraft(draft)
      setSavedAt(new Date())
    }, 700)
    return () => window.clearTimeout(timeout)
  }, [draft, saveDraft, view, canSaveDraft])

  const selected = assessments.find((assessment) => assessment.id === selectedId) ?? null
  const startNew = () => { setDraft(createAssessment()); setCustomerProfileCompleted(false); setSavedAt(null); setStep(0); setView('wizard') }
  const editAssessment = (assessment: Assessment) => { setSelectedId(assessment.id); setDraft({ ...assessment }); setCustomerProfileCompleted(true); setSavedAt(null); setStep(0); setView('wizard') }
  const openDetails = (assessment: Assessment) => { setSelectedId(assessment.id); setDraft(null); setView('details') }
  const updateField = <K extends keyof Assessment>(key: K, value: Assessment[K]) => setDraft((current) => current ? { ...current, [key]: value } : current)
  const navigateStep = (nextStep: number) => {
    if (!draft) return
    if (nextStep > 0 && !existingDraft && !draft.customerName.trim()) return
    if (step === 0 && nextStep > 0) setCustomerProfileCompleted(true)
    setStep(nextStep)
  }
  const finishAssessment = () => {
    if (!draft || !canSaveDraft) return
    const complete = { ...draft, status: 'Complete' as const }
    completeAssessment(complete)
    setDraft(null)
    setSelectedId(complete.id)
    setView('details')
  }

  const filteredAssessments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return assessments.filter((assessment) => {
      const matchesSearch = !normalizedSearch || [assessment.name, assessment.customerName, assessment.industry, assessment.region].some((value) => value.toLowerCase().includes(normalizedSearch))
      const matchesRecommendation = recommendationFilter === 'All recommendations' || calculateScore(assessment).recommendation === recommendationFilter
      return matchesSearch && matchesRecommendation
    }).sort((left, right) => sortBy === 'Customer A-Z'
      ? left.customerName.localeCompare(right.customerName)
      : sortBy === 'Highest score'
        ? calculateScore(right).score - calculateScore(left).score
        : right.updatedAt.localeCompare(left.updatedAt))
  }, [assessments, recommendationFilter, search, sortBy])

  const exitWizard = () => {
    if (draft && canSaveDraft) saveDraft(draft)
    setDraft(null)
    setView('assessments')
  }

  if (!ready) return <div className="loading-screen"><ProgressBar /><span>Loading assessments</span></div>

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-lockup"><div className="brand-mark">MD</div><div><strong>Discover</strong><span>ASSESSMENT</span></div></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        <button className={view === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => setView('dashboard')}><Home24Regular /><span>Dashboard</span></button>
        <button className={view === 'assessments' ? 'nav-item active' : 'nav-item'} onClick={() => setView('assessments')}><DocumentBulletList24Regular /><span>Assessments</span><span className="nav-count">{assessments.length}</span></button>
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-rule" /><div className="sidebar-status"><span className={persistenceError ? 'status-dot status-dot-error' : 'status-dot'} />{storageMode === 'Local demo' ? 'Local demo data' : persistenceError ? 'Dataverse unavailable' : 'Dataverse connected'}</div><div className="profile-chip"><div className="avatar">MD</div><div><strong>Discovery team</strong><span>Opportunity workspace</span></div></div></div>
    </aside>
    <main className="main-panel">
      <header className="topbar"><div className="breadcrumb"><span>MD Discover Assessment</span><ChevronRight24Regular /><strong>{view === 'wizard' ? 'New assessment' : view === 'details' ? 'Assessment details' : view === 'assessments' ? 'Assessments' : 'Overview'}</strong><span className="version-label">v{__APP_VERSION__}</span></div><div className="topbar-actions"><span className="environment-indicator"><span /> Discovery workspace</span><div className="avatar avatar-small">MD</div></div></header>
      {persistenceError && <div className="persistence-alert" role="alert"><Warning24Regular /><span>Dataverse persistence error: {persistenceError}</span></div>}
      {view === 'dashboard' && <Dashboard assessments={assessments} onCreate={startNew} onList={() => setView('assessments')} onOpen={openDetails} />}
      {view === 'assessments' && <AssessmentList assessments={filteredAssessments} search={search} setSearch={setSearch} recommendationFilter={recommendationFilter} setRecommendationFilter={setRecommendationFilter} sortBy={sortBy} setSortBy={setSortBy} onCreate={startNew} onOpen={openDetails} onEdit={editAssessment} />}
      {view === 'wizard' && draft && <AssessmentWizard assessment={draft} step={step} setStep={navigateStep} onUpdate={updateField} onExit={exitWizard} onComplete={finishAssessment} savedAt={savedAt} />}
      {view === 'details' && selected && <AssessmentDetails assessment={selected} onBack={() => setView('assessments')} onEdit={() => editAssessment(selected)} />}
    </main>
  </div>
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function Dashboard({ assessments, onCreate, onList, onOpen }: { assessments: Assessment[]; onCreate: () => void; onList: () => void; onOpen: (assessment: Assessment) => void }) {
  const counted = assessments.map((assessment) => ({ assessment, score: calculateScore(assessment) }))
  const recommendationCounts = (['Pursue', 'Pursue With Risks', 'Do Not Pursue'] as Recommendation[]).map((name) => ({ name, value: counted.filter((item) => item.score.recommendation === name).length }))
  const byIndustry = Object.entries(assessments.reduce<Record<string, Record<Recommendation, number>>>((totals, assessment) => {
    const industry = assessment.industry || 'Unspecified'
    totals[industry] ??= { Pursue: 0, 'Pursue With Risks': 0, 'Do Not Pursue': 0 }
    totals[industry][calculateScore(assessment).recommendation] += 1
    return totals
  }, {})).map(([industry, outcomes]) => ({ industry, ...outcomes }))
  const scores = counted.slice(0, 6).map(({ assessment, score }) => ({ name: assessment.customerName || 'Untitled', score: score.score }))
  const riskCounts = [
    { label: 'Delivery', value: assessments.filter((item) => item.deliveryRisk === 'High').length, color: '#df7662' },
    { label: 'Commercial', value: assessments.filter((item) => item.commercialRisk === 'High').length, color: '#d5a343' },
    { label: 'Relationship', value: assessments.filter((item) => item.relationshipRisk === 'High').length, color: '#7a8b69' },
  ]
  const latest = [...assessments].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4)
  const colors = [recommendationColors.Pursue, recommendationColors['Pursue With Risks'], recommendationColors['Do Not Pursue']]

  return <div className="page-content">
    <PageHeading eyebrow="DISCOVER PHASE / DEEPR" title="Opportunity discovery" description="Qualify the customer. Align the team. Make the call." action={<Button appearance="primary" icon={<Add24Regular />} onClick={onCreate}>New assessment</Button>} />
    <section className="metric-grid" aria-label="Assessment summary"><Metric icon={<DocumentBulletList24Regular />} label="Assessments created" value={assessments.length} detail="Across the workspace" color="green" /><Metric icon={<CheckmarkCircle24Regular />} label="Pursue" value={recommendationCounts[0].value} detail="Strong fit and win case" color="mint" /><Metric icon={<Warning24Regular />} label="Pursue with risks" value={recommendationCounts[1].value} detail="Mitigations needed" color="amber" /><Metric icon={<Shield24Regular />} label="Do not pursue" value={recommendationCounts[2].value} detail="Below qualification threshold" color="rose" /></section>
    <div className="dashboard-grid">
      <section className="panel chart-panel industry-panel"><div className="panel-heading"><div><h2>Recommendations by industry</h2><p>Qualification outcomes across customer sectors</p></div><span className="chart-icon"><ChartMultiple24Regular /></span></div><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={byIndustry} margin={{ top: 12, right: 14, left: -18, bottom: 0 }}><CartesianGrid stroke="#e9ede8" vertical={false} /><XAxis dataKey="industry" tickLine={false} axisLine={false} tick={{ fill: '#78827a', fontSize: 11 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#78827a', fontSize: 11 }} /><ChartTooltip cursor={{ fill: '#f2f5f0' }} /><Bar dataKey="Pursue" stackId="recommendation" fill={recommendationColors.Pursue} barSize={38} /><Bar dataKey="Pursue With Risks" stackId="recommendation" fill={recommendationColors['Pursue With Risks']} barSize={38} /><Bar dataKey="Do Not Pursue" stackId="recommendation" fill={recommendationColors['Do Not Pursue']} radius={[4, 4, 0, 0]} barSize={38} /></BarChart></ResponsiveContainer></div></section>
      <section className="panel chart-panel recommendation-panel"><div className="panel-heading"><div><h2>Recommendation mix</h2><p>Current qualification outcomes</p></div><span className="chart-icon gold"><Target24Regular /></span></div><div className="recommendation-chart-row"><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={recommendationCounts} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={3} stroke="none">{recommendationCounts.map((entry, index) => <Cell key={entry.name} fill={colors[index]} />)}</Pie><ChartTooltip /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{assessments.length}</strong><span>total</span></div></div><div className="legend-list">{recommendationCounts.map((item, index) => <div className="legend-item" key={item.name}><span className="legend-dot" style={{ background: colors[index] }} /><span>{item.name}</span><strong>{item.value}</strong></div>)}</div></div></section>
      <section className="panel chart-panel scores-panel"><div className="panel-heading"><div><h2>Qualification scores</h2><p>Recent assessments · maximum 100</p></div><span className="chart-icon blue"><ChartMultiple24Regular /></span></div><div className="chart-area score-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={scores} margin={{ top: 12, right: 16, left: -12, bottom: 0 }}><CartesianGrid stroke="#e9ede8" vertical={false} /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#78827a', fontSize: 10 }} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#78827a', fontSize: 10 }} /><ChartTooltip /><Bar dataKey="score" name="Score" fill="#426f82" radius={[4, 4, 0, 0]} barSize={34} /></BarChart></ResponsiveContainer></div></section>
      <section className="panel risk-panel"><div className="panel-heading"><div><h2>High-risk distribution</h2><p>Open exposures by risk area</p></div><span className="chart-icon coral"><Warning24Regular /></span></div><div className="risk-bars">{riskCounts.map((risk) => <div className="risk-row" key={risk.label}><div><span>{risk.label}</span><strong>{risk.value}</strong></div><div className="risk-track"><span style={{ width: `${assessments.length ? Math.max(5, risk.value / assessments.length * 100) : 0}%`, background: risk.color }} /></div></div>)}</div><button className="text-link risk-link" onClick={onList}>Review all assessments <ArrowRight24Regular /></button></section>
    </div>
    <section className="panel recent-panel"><div className="panel-heading"><div><h2>Recently updated</h2><p>Pick up where your team left off</p></div><button className="text-link" onClick={onList}>View all <ArrowRight24Regular /></button></div><div className="recent-table"><div className="recent-header"><span>OPPORTUNITY</span><span>INDUSTRY</span><span>LAST REVIEWED</span><span>QUALIFICATION</span><span>STATUS</span></div>{latest.map((assessment) => <AssessmentRow key={assessment.id} assessment={assessment} onOpen={() => onOpen(assessment)} />)}</div></section>
  </div>
}

function Metric({ icon, label, value, detail, color }: { icon: ReactNode; label: string; value: number; detail: string; color: string }) {
  return <div className={`metric-card metric-${color}`}><div className="metric-top"><span className="metric-icon">{icon}</span><span className="metric-kicker">LIVE</span></div><div className="metric-value">{value}</div><div className="metric-label">{label}</div><div className="metric-detail">{detail}</div></div>
}

function AssessmentRow({ assessment, onOpen }: { assessment: Assessment; onOpen: () => void }) {
  const result = calculateScore(assessment)
  return <button className="recent-row" onClick={onOpen}><span className="recent-opportunity"><span className="company-icon"><Building24Regular /></span><span><strong>{assessment.customerName || 'Untitled customer'}</strong><small>{assessment.name}</small></span></span><span>{assessment.industry || '—'}</span><span>{assessment.lastReviewDate ? new Date(assessment.lastReviewDate).toLocaleDateString() : 'Not reviewed'}</span><span><span className="score-inline"><span className="score-track"><i style={{ width: `${result.score / 100 * 100}%` }} /></span><strong>{result.score}</strong></span></span><span><StatusBadge status={assessment.status} recommendation={result.recommendation} /></span></button>
}

function StatusBadge({ status, recommendation }: { status: string; recommendation?: Recommendation }) {
  const styleName = recommendation ? recommendation === 'Pursue' ? 'pursue' : recommendation === 'Pursue With Risks' ? 'risk' : 'stop' : status.toLowerCase().replaceAll(' ', '-')
  return <span className={`badge badge-${styleName}`}>{recommendation ?? status}</span>
}

function AssessmentList({ assessments, search, setSearch, recommendationFilter, setRecommendationFilter, sortBy, setSortBy, onCreate, onOpen, onEdit }: { assessments: Assessment[]; search: string; setSearch: (value: string) => void; recommendationFilter: string; setRecommendationFilter: (value: string) => void; sortBy: string; setSortBy: (value: string) => void; onCreate: () => void; onOpen: (assessment: Assessment) => void; onEdit: (assessment: Assessment) => void }) {
  return <div className="page-content"><PageHeading eyebrow="OPPORTUNITY PIPELINE" title="Assessments" description="Review fit, qualification strength, and pursuit readiness." action={<Button appearance="primary" icon={<Add24Regular />} onClick={onCreate}>New assessment</Button>} /><section className="panel list-panel"><div className="list-toolbar"><div className="search-wrap"><Search24Regular /><Input aria-label="Search assessments" placeholder="Search customer, opportunity, industry" value={search} onChange={(event) => setSearch(event.currentTarget.value)} /></div><label className="filter-wrap"><span>Recommendation</span><select value={recommendationFilter} onChange={(event) => setRecommendationFilter(event.currentTarget.value)}><option>All recommendations</option><option>Pursue</option><option>Pursue With Risks</option><option>Do Not Pursue</option></select></label><label className="filter-wrap"><span>Sort by</span><select value={sortBy} onChange={(event) => setSortBy(event.currentTarget.value)}><option>Newest</option><option>Highest score</option><option>Customer A-Z</option></select></label><span className="result-count">{assessments.length} results</span></div>{assessments.length ? <div className="list-table"><div className="list-header"><span>OPPORTUNITY</span><span>INDUSTRY / REGION</span><span>FIT SCORE</span><span>RECOMMENDATION</span><span>UPDATED</span><span /></div>{assessments.map((assessment) => { const score = calculateScore(assessment); return <div className="list-row" key={assessment.id}><button className="list-primary" onClick={() => onOpen(assessment)}><span className="company-icon"><Building24Regular /></span><span><strong>{assessment.customerName || 'Untitled customer'}</strong><small>{assessment.name}</small></span></button><span>{assessment.industry || 'Unspecified'}<small className="subline">{assessment.region || 'Region not set'}</small></span><span className="list-score"><strong>{score.score}</strong><small>/ 100</small></span><span><StatusBadge status={assessment.status} recommendation={score.recommendation} /></span><span>{new Date(assessment.updatedAt).toLocaleDateString()}</span><Button appearance="subtle" size="small" onClick={() => onEdit(assessment)}>Edit</Button></div> })}</div> : <div className="empty-state"><DocumentBulletList24Regular /><h3>No matching assessments</h3><p>Try a different search or create an opportunity assessment.</p><Button appearance="primary" icon={<Add24Regular />} onClick={onCreate}>Create assessment</Button></div>}</section></div>
}

function AssessmentWizard({ assessment, step, setStep, onUpdate, onExit, onComplete, savedAt }: { assessment: Assessment; step: number; setStep: (step: number) => void; onUpdate: <K extends keyof Assessment>(key: K, value: Assessment[K]) => void; onExit: () => void; onComplete: () => void; savedAt: Date | null }) {
  const score = calculateScore(assessment)
  const insights = generateInsights(assessment)
  return <div className="wizard-page"><div className="wizard-heading"><div><button className="back-link" onClick={onExit}><ArrowLeft24Regular /> All assessments</button><div className="wizard-title-row"><div><div className="eyebrow">OPPORTUNITY ASSESSMENT</div><h1>{assessment.customerName || 'New opportunity'}</h1></div><span className="autosave-state"><span className="status-dot" />{savedAt ? `Saved ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not saved yet'}</span></div></div><div className="wizard-score"><span>FIT SCORE</span><strong>{score.score}<small> / 100</small></strong></div></div><div className="wizard-layout"><aside className="step-rail"><div className="step-rail-top"><span>ASSESSMENT PROGRESS</span><strong>{step + 1}<small> / {steps.length}</small></strong></div><ProgressBar value={(step + 1) / steps.length} /><nav aria-label="Assessment steps">{steps.map((label, index) => <button key={label} className={`step-item ${index === step ? 'current' : ''} ${index < step ? 'completed' : ''}`} onClick={() => setStep(index)}><span className="step-number">{index < step ? <CheckmarkCircle24Regular /> : index + 1}</span><span>{label}</span><ChevronRight24Regular /></button>)}</nav><div className="rail-score"><span>LIVE RECOMMENDATION</span><StatusBadge status={assessment.status} recommendation={score.recommendation} /><small>Based on current inputs</small></div></aside><section className="wizard-form-panel"><div className="form-step-header"><div><div className="eyebrow">STEP {String(step + 1).padStart(2, '0')} OF 08</div><h2>{steps[step]}</h2><p>{stepDescriptions[step]}</p></div><span className="step-visual">{String(step + 1).padStart(2, '0')}</span></div><div className="form-fields">{renderStep(step, assessment, onUpdate, score, insights)}</div><div className="wizard-footer"><Button appearance="secondary" icon={<ChevronLeft24Regular />} disabled={step === 0} onClick={() => setStep(step - 1)}>Previous</Button><span className="footer-hint">Changes save automatically</span>{step < steps.length - 1 ? <Button appearance="primary" iconPosition="after" icon={<ChevronRight24Regular />} onClick={() => setStep(step + 1)}>Continue</Button> : <Button appearance="primary" icon={<CheckmarkCircle24Regular />} onClick={onComplete}>Complete assessment</Button>}</div></section></div></div>
}

const stepDescriptions = ['Establish the account profile and strategic context.', 'Capture the business drivers that make change matter.', 'Confirm access to the people who shape and fund the decision.', 'Test strategic fit and the potential for a lasting relationship.', 'Validate the commercial fundamentals and Microsoft alignment.', 'Make the reason to win specific and evidence-based.', 'Surface delivery, commercial, and relationship exposure.', 'Review the recommendation, gaps, and actions before the call.']

function renderStep(step: number, assessment: Assessment, update: <K extends keyof Assessment>(key: K, value: Assessment[K]) => void, score: ReturnType<typeof calculateScore>, insights: ReturnType<typeof generateInsights>) {
  switch (step) {
    case 0: return <><div className="fields-grid"><TextField label="Customer name" required value={assessment.customerName} onChange={(value) => update('customerName', value)} placeholder="e.g. Contoso Ltd." /><TextField label="Assessment name" value={assessment.name} onChange={(value) => update('name', value)} placeholder="Opportunity or initiative" /><SelectField label="Industry" value={assessment.industry} onChange={(value) => update('industry', value)} options={['Manufacturing', 'Financial Services', 'Healthcare', 'Retail', 'Technology', 'Public Sector', 'Energy', 'Other']} /><SelectField label="Region" value={assessment.region} onChange={(value) => update('region', value)} options={['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East and Africa']} /><TextField label="Annual revenue (USD)" type="number" value={assessment.annualRevenue?.toString() ?? ''} onChange={(value) => update('annualRevenue', value ? Number(value) : null)} placeholder="Optional" /><TextField label="Employee count" type="number" value={assessment.employeeCount?.toString() ?? ''} onChange={(value) => update('employeeCount', value ? Number(value) : null)} placeholder="Optional" /></div><div className="field-section-title">Existing relationship</div><div className="checkbox-grid"><ToggleField label="Existing Microsoft customer" checked={assessment.existingMicrosoftCustomer} onChange={(value) => update('existingMicrosoftCustomer', value)} /><ToggleField label="Existing Avanade customer" checked={assessment.existingAvanadeCustomer} onChange={(value) => update('existingAvanadeCustomer', value)} /></div></>
    case 1: return <div className="fields-grid"><TextAreaField className="field-wide" label="Business objectives" value={assessment.businessObjectives} onChange={(value) => update('businessObjectives', value)} placeholder="What is the customer trying to achieve?" /><TextAreaField label="Current initiatives" value={assessment.currentInitiatives} onChange={(value) => update('currentInitiatives', value)} placeholder="Programs and investments already underway" /><TextAreaField label="Microsoft priorities" value={assessment.microsoftPriorities} onChange={(value) => update('microsoftPriorities', value)} placeholder="Platforms, programs, or strategic alignment" /><TextAreaField label="Customer pain points" value={assessment.customerPainPoints} onChange={(value) => update('customerPainPoints', value)} placeholder="Where is the current state falling short?" /><TextAreaField label="Desired outcomes" value={assessment.desiredOutcomes} onChange={(value) => update('desiredOutcomes', value)} placeholder="How will the customer measure success?" /><TextAreaField label="Risks of doing nothing" value={assessment.risksOfDoingNothing} onChange={(value) => update('risksOfDoingNothing', value)} placeholder="Cost, risk, or opportunity lost by inaction" /><TextField className="field-wide" label="Decision timeline" value={assessment.timeline} onChange={(value) => update('timeline', value)} placeholder="Milestones, dates, or procurement window" /></div>
    case 2: return <><div className="section-intro"><People24Regular /><div><strong>Buying group coverage</strong><span>Strong discovery includes both access and a shared view of the decision network.</span></div></div><div className="checklist-grid"><ToggleField label="Executive sponsor identified" checked={assessment.executiveSponsorIdentified} onChange={(value) => update('executiveSponsorIdentified', value)} /><ToggleField label="Decision maker identified" checked={assessment.decisionMakerIdentified} onChange={(value) => update('decisionMakerIdentified', value)} /><ToggleField label="Stakeholder map completed" checked={assessment.stakeholderMapCompleted} onChange={(value) => update('stakeholderMapCompleted', value)} /></div><Callout type="info" title="Discovery prompt" text="Can the team name the economic buyer, technical evaluator, and day-to-day champion?" /></>
    case 3: return <><div className="section-intro"><Target24Regular /><div><strong>Ideal customer profile signals</strong><span>Each positive signal contributes 10 points to the qualification score.</span></div></div><div className="checklist-grid">{([['strategicCustomer', 'Strategic customer'], ['enterpriseScale', 'Enterprise scale'], ['multipleInitiatives', 'Multiple initiatives'], ['longTermPartnership', 'Long-term partnership potential'], ['microsoftAlignment', 'Microsoft alignment']] as const).map(([key, label]) => <ToggleField key={key} label={label} checked={assessment[key]} onChange={(value) => update(key, value)} />)}</div></>
    case 4: return <><div className="section-intro"><CheckmarkCircle24Regular /><div><strong>Opportunity fundamentals</strong><span>Confirm the need, sponsorship, and route to funded action.</span></div></div><div className="checklist-grid">{([['budgetConfirmed', 'Budget confirmed'], ['businessNeedConfirmed', 'Business need confirmed'], ['executiveSupportConfirmed', 'Executive support confirmed'], ['competitiveThreatIdentified', 'Competitive threat identified'], ['microsoftFundingPotential', 'Microsoft funding potential']] as const).map(([key, label]) => <ToggleField key={key} label={label} checked={assessment[key]} onChange={(value) => update(key, value)} />)}</div><Callout type="amber" title="Funding confidence" text="Microsoft funding potential is a signal, not a substitute for a confirmed customer budget." /></>
    case 5: return <><div className="fields-grid"><TextField label="Win probability" type="number" value={String(assessment.winProbability)} onChange={(value) => update('winProbability', Math.max(0, Math.min(100, Number(value) || 0)))} suffix="%" /><TextField label="Known competitors" value={assessment.competitors} onChange={(value) => update('competitors', value)} placeholder="Competitors or incumbent" /><TextAreaField className="field-wide" label="Why Avanade wins" value={assessment.whyAvanadeWins} onChange={(value) => update('whyAvanadeWins', value)} placeholder="What evidence makes us the right partner?" /><TextAreaField className="field-wide" label="Key differentiators" value={assessment.keyDifferentiators} onChange={(value) => update('keyDifferentiators', value)} placeholder="Relevant capabilities, relationships, or assets" /></div><div className="probability-control"><div><strong>Win probability</strong><span>Above 75% adds 10 points to the qualification score.</span></div><input aria-label="Win probability slider" type="range" min="0" max="100" step="5" value={assessment.winProbability} onChange={(event) => update('winProbability', Number(event.currentTarget.value))} /><strong className="probability-value">{assessment.winProbability}%</strong></div></>
    case 6: return <><div className="section-intro"><Shield24Regular /><div><strong>Risk exposure</strong><span>Medium risk deducts 5 points; high risk deducts 10 points per category.</span></div></div><div className="risk-select-grid"><RiskField label="Delivery risk" value={assessment.deliveryRisk} onChange={(value) => update('deliveryRisk', value)} /><RiskField label="Commercial risk" value={assessment.commercialRisk} onChange={(value) => update('commercialRisk', value)} /><RiskField label="Relationship risk" value={assessment.relationshipRisk} onChange={(value) => update('relationshipRisk', value)} /></div><Callout type="info" title="Risk discipline" text="Unassessed risks do not change the score. Treat unknowns as gaps to resolve, not as low risk." /></>
    default: return <><div className={`recommendation-banner ${recommendationClass(score.recommendation)}`}><div className="recommendation-symbol">{score.recommendation === 'Pursue' ? <CheckmarkCircle24Regular /> : score.recommendation === 'Pursue With Risks' ? <Warning24Regular /> : <Shield24Regular />}</div><div><span>STRUCTURED RECOMMENDATION</span><h3>{score.recommendation}</h3><p>{recommendationSummary(score.recommendation)}</p></div><div className="banner-score"><strong>{score.score}</strong><span> / 100 points</span></div></div><div className="score-breakdown"><span><strong>+{score.positives}</strong> qualification signals</span><span><strong>−{score.riskDeduction}</strong> risk deductions</span><span><strong>+{score.winProbabilityBonus}</strong> win probability</span></div><div className="insight-grid"><InsightPanel title="Strengths" icon={<CheckmarkCircle24Regular />} items={insights.strengths} empty="No positive signals confirmed yet." tone="green" /><InsightPanel title="Risks" icon={<Warning24Regular />} items={insights.risks} empty="No medium or high risks recorded." tone="amber" /><InsightPanel title="Gaps" icon={<Search24Regular />} items={insights.gaps} empty="Core discovery information is captured." tone="blue" /><InsightPanel title="Next actions" icon={<ArrowRight24Regular />} items={insights.nextActions} empty="No actions suggested." tone="coral" /></div><TextAreaField label="Recommendation reasoning" maxLength={4000} value={assessment.recommendationReasoning} onChange={(value) => update('recommendationReasoning', value)} placeholder="Add context for the leadership review. Generated insights are rules-based and should be validated by the team." /></>
  }
}

function TextField({ label, value, onChange, placeholder, type = 'text', required = false, suffix, className = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: 'text' | 'number'; required?: boolean; suffix?: string; className?: string }) {
  return <label className={`field ${className}`}><span>{label}{required && <i className="required-mark"> *</i>}</span><div className="input-with-suffix"><Input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.currentTarget.value)} />{suffix && <em>{suffix}</em>}</div></label>
}

function TextAreaField({ label, value, onChange, placeholder, maxLength, className = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; maxLength?: number; className?: string }) {
  return <label className={`field ${className}`}><span>{label}</span><Textarea resize="vertical" rows={3} value={value} placeholder={placeholder} maxLength={maxLength} onChange={(event) => onChange(event.currentTarget.value)} /></label>
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.currentTarget.value)}><option value="">Select {label.toLowerCase()}</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className={`toggle-field ${checked ? 'selected' : ''}`}><Checkbox checked={checked} onChange={(_, data) => onChange(data.checked === true)} label={label} /></div>
}

function RiskField({ label, value, onChange }: { label: string; value: RiskLevel; onChange: (value: RiskLevel) => void }) {
  return <label className={`risk-field risk-${value.toLowerCase()}`}><span>{label}</span><select value={value} onChange={(event) => onChange(event.currentTarget.value as RiskLevel)}><option>Unassessed</option><option>Low</option><option>Medium</option><option>High</option></select><small>{value === 'High' ? '−10 points' : value === 'Medium' ? '−5 points' : value === 'Low' ? 'No deduction' : 'No deduction until assessed'}</small></label>
}

function Callout({ type, title, text }: { type: string; title: string; text: string }) {
  return <div className={`callout callout-${type}`}><Sparkle24Regular /><div><strong>{title}</strong><span>{text}</span></div></div>
}

function InsightPanel({ title, icon, items, empty, tone }: { title: string; icon: ReactNode; items: string[]; empty: string; tone: string }) {
  return <section className={`insight-panel insight-${tone}`}><h4>{icon}{title}<span>{items.length}</span></h4>{items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{empty}</p>}</section>
}

function AssessmentDetails({ assessment, onBack, onEdit }: { assessment: Assessment; onBack: () => void; onEdit: () => void }) {
  const score = calculateScore(assessment)
  const insights = generateInsights(assessment)
  return <div className="page-content details-content"><PageHeading eyebrow="ASSESSMENT SUMMARY" title={assessment.customerName || 'Untitled customer'} description={`${assessment.name} · ${assessment.industry || 'Industry unspecified'} · ${assessment.region || 'Region unspecified'}`} action={<div className="heading-actions"><Button appearance="secondary" icon={<Print24Regular />} onClick={() => window.print()}>Export PDF</Button><Button appearance="secondary" icon={<ArrowDownload24Regular />} onClick={() => void exportWord(assessment)}>Export Word</Button><Button appearance="primary" onClick={onEdit}>Edit assessment</Button></div>} /><div className={`detail-recommendation ${recommendationClass(score.recommendation)}`}><div className="detail-rec-icon">{score.recommendation === 'Pursue' ? <CheckmarkCircle24Regular /> : <Warning24Regular />}</div><div><span>RECOMMENDATION</span><h2>{score.recommendation}</h2><p>{assessment.recommendationReasoning || recommendationSummary(score.recommendation)}</p></div><div className="detail-score"><strong>{score.score}</strong><span>Qualification score / 100</span></div></div><div className="details-grid"><section className="detail-section"><div className="detail-section-heading"><h2>Customer and business context</h2><Building24Regular /></div><DetailItem label="Industry" value={assessment.industry} /><DetailItem label="Region" value={assessment.region} /><DetailItem label="Annual revenue" value={assessment.annualRevenue ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(assessment.annualRevenue) : ''} /><DetailItem label="Employee count" value={assessment.employeeCount?.toLocaleString() ?? ''} /><DetailItem label="Business objectives" value={assessment.businessObjectives} /><DetailItem label="Desired outcomes" value={assessment.desiredOutcomes} /></section><section className="detail-section"><div className="detail-section-heading"><h2>Qualification and risk</h2><Target24Regular /></div><DetailItem label="Win probability" value={`${assessment.winProbability}%`} /><DetailItem label="Budget confirmed" value={assessment.budgetConfirmed ? 'Yes' : 'No'} /><DetailItem label="Business need confirmed" value={assessment.businessNeedConfirmed ? 'Yes' : 'No'} /><DetailItem label="Why Avanade wins" value={assessment.whyAvanadeWins} /><DetailItem label="Delivery risk" value={assessment.deliveryRisk} /><DetailItem label="Commercial risk" value={assessment.commercialRisk} /><DetailItem label="Relationship risk" value={assessment.relationshipRisk} /></section></div><div className="detail-lower-grid"><section className="detail-section insight-summary"><div className="detail-section-heading"><h2>Discovery insights</h2><Sparkle24Regular /></div><InsightPanel title="Next actions" icon={<ArrowRight24Regular />} items={insights.nextActions} empty="No actions suggested." tone="blue" /><InsightPanel title="Open gaps" icon={<Search24Regular />} items={insights.gaps} empty="No open gaps." tone="amber" /></section><section className="detail-section history-section"><div className="detail-section-heading"><h2>Assessment history</h2><Clock24Regular /></div>{assessment.history.length ? <ol className="history-list">{[...assessment.history].reverse().map((revision) => <li key={revision.version}><span className="history-dot" /><div><strong>Version {revision.version}</strong><span>{new Date(revision.savedAt).toLocaleString()}</span></div><span className="history-result">{revision.score} · {revision.recommendation}</span></li>)}</ol> : <div className="history-empty">History begins when an assessment is completed.</div>}<div className="detail-meta"><span>Current version</span><strong>{assessment.version || 'Draft'}</strong><span>Last reviewed</span><strong>{assessment.lastReviewDate ? new Date(assessment.lastReviewDate).toLocaleDateString() : 'Not reviewed'}</strong></div></section></div><button className="back-link details-back" onClick={onBack}><ArrowLeft24Regular /> Back to assessments</button></div>
}

function DetailItem({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return <div className="detail-item"><span>{label}</span><strong>{value}</strong></div>
}

function recommendationClass(recommendation: Recommendation) {
  return recommendation === 'Pursue' ? 'recommend-pursue' : recommendation === 'Pursue With Risks' ? 'recommend-risk' : 'recommend-stop'
}

function recommendationSummary(recommendation: Recommendation) {
  if (recommendation === 'Pursue') return 'Qualification signals support investment in a focused pursuit.'
  if (recommendation === 'Pursue With Risks') return 'Proceed only with named owners and clear mitigation for open risks.'
  return 'Current evidence does not support a pursuit investment.'
}

async function exportWord(assessment: Assessment) {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import('docx')
  const score = calculateScore(assessment)
  const insights = generateInsights(assessment)
  const bulletParagraphs = (title: string, items: string[]) => [new Paragraph({ text: title, heading: HeadingLevel.HEADING_2 }), ...(items.length ? items.map((item) => new Paragraph({ text: item, bullet: { level: 0 } })) : [new Paragraph('None recorded')])]
  const wordDocument = new Document({ sections: [{ children: [new Paragraph({ text: 'MD Discover Assessment', heading: HeadingLevel.TITLE }), new Paragraph({ children: [new TextRun({ text: assessment.customerName || 'Untitled customer', bold: true }), new TextRun(`  |  ${assessment.name}`)] }), new Paragraph({ text: `Recommendation: ${score.recommendation}  |  Qualification score: ${score.score} / 100`, spacing: { after: 240 } }), new Paragraph({ text: 'Customer and business context', heading: HeadingLevel.HEADING_2 }), new Paragraph(`Industry: ${assessment.industry || 'Not specified'}  |  Region: ${assessment.region || 'Not specified'}`), new Paragraph(`Business objectives: ${assessment.businessObjectives || 'Not captured'}`), new Paragraph(`Desired outcomes: ${assessment.desiredOutcomes || 'Not captured'}`), new Paragraph(`Why Avanade wins: ${assessment.whyAvanadeWins || 'Not captured'}`), new Paragraph({ text: 'Risk assessment', heading: HeadingLevel.HEADING_2 }), new Paragraph(`Delivery: ${assessment.deliveryRisk}  |  Commercial: ${assessment.commercialRisk}  |  Relationship: ${assessment.relationshipRisk}`), ...bulletParagraphs('Strengths', insights.strengths), ...bulletParagraphs('Risks', insights.risks), ...bulletParagraphs('Gaps', insights.gaps), ...bulletParagraphs('Next actions', insights.nextActions), new Paragraph({ text: `Generated ${new Date().toLocaleString()} · Rules-based assessment; validate with the pursuit team.`, spacing: { before: 300 } })] }] })
  const blob = await Packer.toBlob(wordDocument)
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = `${(assessment.customerName || 'assessment').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-assessment.docx`
  anchor.click()
  URL.revokeObjectURL(url)
}

export default App
