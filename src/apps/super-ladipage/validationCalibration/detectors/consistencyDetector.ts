// ─────────────────────────────────────────────────────────────────────
// consistencyDetector — POST-REBUILD no-op
//
// Previously checked realismLevel/polishLevel/lightingMood consistency
// across sections. Visual consistency is now ensured by the locked
// imageSceneSynthesis system instruction (single visual genre for all
// sections of a pack) + sequential anchor reference for face continuity.
// ─────────────────────────────────────────────────────────────────────

import type { OrchestratedSection } from '../../generationOrchestration'
import type { ValidationWarning } from '../types'

export function consistencyDetector(_sections: OrchestratedSection[]): ValidationWarning[] {
  return []
}
