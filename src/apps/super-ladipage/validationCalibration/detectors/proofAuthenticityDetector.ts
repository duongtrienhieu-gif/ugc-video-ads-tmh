// ─────────────────────────────────────────────────────────────────────
// proofAuthenticityDetector — POST-REBUILD no-op
//
// Previously checked polishLevel/proofFeel/framingStyle/lightingMood
// axes for "fake review / luxury catalog" drift. Proof authenticity is
// now enforced UPSTREAM by imageSceneSynthesis system instruction +
// proof-callout role micro-rule (NO testimonial card overlay, NO star
// rating, just a quiet real moment).
// ─────────────────────────────────────────────────────────────────────

import type { OrchestratedSection } from '../../generationOrchestration'
import type { ValidationWarning } from '../types'

export function proofAuthenticityDetector(_sections: OrchestratedSection[]): ValidationWarning[] {
  return []
}
