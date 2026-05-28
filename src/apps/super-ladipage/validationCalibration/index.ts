// ─────────────────────────────────────────────────────────────────────
// Validation + Calibration — public API barrel (P13)
//
// Single entry: validateOrchestratedPage. Output: ValidatedPage with
// per-section SectionCalibration + page-level ValidationReport.
//
// Pure observation + governance + advisory knob recommendations.
// NO mutation. NO autonomous redesign. NO AI taste engine.
// ─────────────────────────────────────────────────────────────────────

// Entry
export { validateOrchestratedPage } from './runtime/validateOrchestratedPage'
export { computeSectionCalibration } from './runtime/computeSectionCalibration'

// Detectors (exposed for direct testing / future UI surfacing)
export { consistencyDetector } from './detectors/consistencyDetector'
export { plausibilityDetector } from './detectors/plausibilityDetector'
export { fakeAiDetector } from './detectors/fakeAiDetector'
export { proofAuthenticityDetector } from './detectors/proofAuthenticityDetector'
export { repetitionDetector } from './detectors/repetitionDetector'
export { alignmentDetector } from './detectors/alignmentDetector'

// Config
export { buildKnobRecommendations } from './config/recommendedKnobMap'

// Types
export type {
  RiskLevel,
  WarningSeverity,
  RiskCategory,
  ValidationWarning,
  CalibrationKnob,
  KnobDirection,
  RecommendedKnobAdjustment,
  ValidationReport,
  SectionCalibration,
  ValidatedSection,
  ValidatedPage,
} from './types'
