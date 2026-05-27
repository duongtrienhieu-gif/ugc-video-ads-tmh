// ─────────────────────────────────────────────────────────────────────
// alignmentDetector — POST-REBUILD no-op
//
// Previously checked per-section emotionalState/compositionTension/
// lightingMood axes against role-expected signatures. The 9-axis system
// was deleted 2026-05-27 (replaced by imageSceneSynthesis with locked
// visual genre). Alignment is now guaranteed STRUCTURALLY by the locked
// system instruction in scene synthesis.
// ─────────────────────────────────────────────────────────────────────

import type { OrchestratedSection } from '../../generationOrchestration'
import type { ValidationWarning } from '../types'

export function alignmentDetector(_sections: OrchestratedSection[]): ValidationWarning[] {
  return []
}
