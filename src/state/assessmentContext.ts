import { createContext, useContext } from 'react'
import type { Assessment } from '../domain/assessment'

interface AssessmentContextValue {
  assessments: Assessment[]
  ready: boolean
  persistenceError: string | null
  storageMode: 'Dataverse' | 'Local demo'
  saveDraft: (assessment: Assessment) => void
  completeAssessment: (assessment: Assessment) => void
}

export const AssessmentContext = createContext<AssessmentContextValue | null>(null)

export function useAssessments() {
  const value = useContext(AssessmentContext)
  if (!value) throw new Error('useAssessments must be used within AssessmentProvider')
  return value
}