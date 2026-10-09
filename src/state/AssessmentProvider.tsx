import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { assessmentRepository, localDemoMode } from '../data/assessmentRepository'
import { calculateScore } from '../domain/scoring'
import { demoAssessments, type Assessment } from '../domain/assessment'
import { AssessmentContext } from './assessmentContext'

export function AssessmentProvider({ children }: { children: ReactNode }) {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [ready, setReady] = useState(false)
  const [persistenceError, setPersistenceError] = useState<string | null>(null)
  const assessmentsRef = useRef<Assessment[]>([])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const stored = await assessmentRepository.getAll()
        const initial = stored.length ? stored : demoAssessments
        if (!stored.length) await assessmentRepository.saveAll(initial)
        if (!active) return
        assessmentsRef.current = initial
        setAssessments(initial)
        setPersistenceError(null)
      } catch (error) {
        if (!active) return
        assessmentsRef.current = demoAssessments
        setAssessments(demoAssessments)
        setPersistenceError(error instanceof Error ? error.message : String(error))
      } finally {
        if (active) setReady(true)
      }
    })()
    return () => { active = false }
  }, [])

  const publish = useCallback((next: Assessment[]) => {
    assessmentsRef.current = next
    setAssessments(next)
    void assessmentRepository.saveAll(next)
      .then(() => setPersistenceError(null))
      .catch((error: unknown) => setPersistenceError(error instanceof Error ? error.message : String(error)))
  }, [])

  const saveDraft = useCallback((assessment: Assessment) => {
    const updated = { ...assessment, updatedAt: new Date().toISOString() }
    const current = assessmentsRef.current
    const next = current.some((item) => item.id === assessment.id)
      ? current.map((item) => item.id === assessment.id ? updated : item)
      : [updated, ...current]
    publish(next)
  }, [publish])

  const completeAssessment = useCallback((assessment: Assessment) => {
    const now = new Date().toISOString()
    const result = calculateScore(assessment)
    const current = assessmentsRef.current
    const previous = current.find((item) => item.id === assessment.id)
    const version = (previous?.version ?? assessment.version) + 1
    const completed = {
      ...assessment,
      status: 'Complete' as const,
      version,
      lastReviewDate: now,
      updatedAt: now,
      history: [...assessment.history, { version, savedAt: now, score: result.score, recommendation: result.recommendation }],
    }
    const next = previous
      ? current.map((item) => item.id === assessment.id ? completed : item)
      : [completed, ...current]
    publish(next)
  }, [publish])

  return (
    <AssessmentContext.Provider value={{ assessments, ready, persistenceError, storageMode: localDemoMode ? 'Local demo' : 'Dataverse', saveDraft, completeAssessment }}>
      {children}
    </AssessmentContext.Provider>
  )
}