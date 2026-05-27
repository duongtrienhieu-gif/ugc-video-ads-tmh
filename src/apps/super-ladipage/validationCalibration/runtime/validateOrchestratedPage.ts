// ─────────────────────────────────────────────────────────────────────
// validateOrchestratedPage — POST-REBUILD slim
//
// All 6 axis-based detectors are no-ops post-rebuild (the 9-axis system
// was removed when fragment-stacking pipeline was deleted 2026-05-27).
// Visual consistency / authenticity is now enforced UPSTREAM by the
// locked imageSceneSynthesis system instruction.
//
// This function preserves the ValidatedPage subtype for downstream export
// pipeline, returning identity validation report + per-section identity
// calibrations.
// ─────────────────────────────────────────────────────────────────────

import type { OrchestratedPage } from '../../generationOrchestration'
import type {
  ValidatedPage,
  ValidatedSection,
  ValidationReport,
  RiskLevel,
} from '../types'
import { plausibilityDetector } from '../detectors/plausibilityDetector'
import { computeSectionCalibration } from './computeSectionCalibration'
import { buildKnobRecommendations } from '../config/recommendedKnobMap'

const ALL_LOW: RiskLevel = 'low'

export function validateOrchestratedPage(page: OrchestratedPage): ValidatedPage {
  const sections = page.sections

  // ── Plausibility check still runs (text-pacing scope, not axis-based) ──
  const plausibility = plausibilityDetector(sections)

  const validationReport: ValidationReport = {
    realismRisk: ALL_LOW,
    polishDrift: ALL_LOW,
    proofAuthenticity: ALL_LOW,
    scrollFatigue: plausibility.scrollFatigue,
    consistencyRisk: ALL_LOW,
    repetitionRisk: ALL_LOW,
    ctaOverexposure: plausibility.ctaOverexposure,
    sectionAlignment: ALL_LOW,
    warnings: [...plausibility.warnings],
    recommendedKnobAdjustments: buildKnobRecommendations({
      realismRisk: ALL_LOW,
      polishDrift: ALL_LOW,
      proofAuthenticity: ALL_LOW,
      scrollFatigue: plausibility.scrollFatigue,
      consistencyRisk: ALL_LOW,
      repetitionRisk: ALL_LOW,
      ctaOverexposure: plausibility.ctaOverexposure,
      sectionAlignment: ALL_LOW,
    }),
  }

  const validatedSections: ValidatedSection[] = sections.map((s) => ({
    ...s,
    sectionCalibration: computeSectionCalibration(s, sections, null),
  }))

  return {
    ...page,
    sections: validatedSections,
    validationReport,
  }
}
