// ─────────────────────────────────────────────────────────────────────
// fakeAiDetector — POST-REBUILD no-op
//
// Previously checked compositionTension/polishLevel/realismLevel/
// lightingMood for "Pinterest moodboard" drift. Anti-AI-aesthetic is now
// enforced UPSTREAM by imageSceneSynthesis system instruction (explicit
// ban on pinterest / kinfolk / luxury-editorial / catalog / studio gloss).
// ─────────────────────────────────────────────────────────────────────

import type { OrchestratedSection } from '../../generationOrchestration'
import type { ValidationWarning } from '../types'

export function fakeAiDetector(_sections: OrchestratedSection[]): ValidationWarning[] {
  return []
}
