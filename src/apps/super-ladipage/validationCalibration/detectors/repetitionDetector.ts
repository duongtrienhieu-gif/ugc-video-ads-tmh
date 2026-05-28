// ─────────────────────────────────────────────────────────────────────
// repetitionDetector — POST-REBUILD no-op
//
// Previously checked framingStyle/compositionTension/subjectDistance/
// emotionalState axis reuse across adjacent sections. Scroll freshness
// is now governed structurally: per-section scenes come from independent
// Gemini calls (each anchored to that section's unique text), so axis-
// level repetition is no longer the right diagnostic frame.
// ─────────────────────────────────────────────────────────────────────

import type { OrchestratedSection } from '../../generationOrchestration'
import type { ValidationWarning } from '../types'

export function repetitionDetector(_sections: OrchestratedSection[]): ValidationWarning[] {
  return []
}
