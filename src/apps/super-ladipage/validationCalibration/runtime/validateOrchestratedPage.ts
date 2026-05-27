// ─────────────────────────────────────────────────────────────────────
// P13 — validateOrchestratedPage (top entry)
//
// OrchestratedPage → ValidatedPage. Runs all 6 detectors + computes
// per-section calibrations + aggregates knob recommendations.
// Pure, sync, no mutation. Mirrors planImageGenerationPage shape.
// ─────────────────────────────────────────────────────────────────────

import type { OrchestratedPage } from '../../generationOrchestration'
import type { RealismLevel } from '../../imageSemantics'
import type {
  ValidatedPage,
  ValidatedSection,
  ValidationReport,
  ValidationWarning,
  RiskLevel,
  RiskCategory,
} from '../types'
import { consistencyDetector } from '../detectors/consistencyDetector'
import { plausibilityDetector } from '../detectors/plausibilityDetector'
import { fakeAiDetector } from '../detectors/fakeAiDetector'
import { proofAuthenticityDetector } from '../detectors/proofAuthenticityDetector'
import { repetitionDetector } from '../detectors/repetitionDetector'
import { alignmentDetector } from '../detectors/alignmentDetector'
import { computeSectionCalibration } from './computeSectionCalibration'
import { buildKnobRecommendations } from '../config/recommendedKnobMap'

export function validateOrchestratedPage(page: OrchestratedPage): ValidatedPage {
  const sections = page.sections

  // ── Run all 6 detectors ─────────────────────────────────────────
  const consistency = consistencyDetector(sections)
  const plausibility = plausibilityDetector(sections)
  const fakeAi = fakeAiDetector(sections)
  const proof = proofAuthenticityDetector(sections)
  const repetition = repetitionDetector(sections)
  const alignment = alignmentDetector(sections)

  // ── Merge realism risk from consistency + fakeAi (highest wins) ─
  const realismRisk = maxRisk(consistency.realismRisk, fakeAi.realismRisk)

  const risks: Record<RiskCategory, RiskLevel> = {
    realismRisk,
    polishDrift: consistency.polishDrift,
    proofAuthenticity: proof.proofAuthenticity,
    scrollFatigue: plausibility.scrollFatigue,
    consistencyRisk: consistency.consistencyRisk,
    repetitionRisk: repetition.repetitionRisk,
    ctaOverexposure: plausibility.ctaOverexposure,
    sectionAlignment: alignment.sectionAlignment,
  }

  // ── Aggregate warnings ──────────────────────────────────────────
  const warnings: ValidationWarning[] = [
    ...consistency.warnings,
    ...plausibility.warnings,
    ...fakeAi.warnings,
    ...proof.warnings,
    ...repetition.warnings,
    ...alignment.warnings,
  ]

  // ── Knob recommendations ────────────────────────────────────────
  const recommendedKnobAdjustments = buildKnobRecommendations(risks)

  const validationReport: ValidationReport = {
    ...risks,
    warnings,
    recommendedKnobAdjustments,
  }

  // ── Per-section calibrations ───────────────────────────────────
  const pageRealismMode = computeRealismMode(sections)
  const validatedSections: ValidatedSection[] = sections.map((s) => ({
    ...s,
    sectionCalibration: computeSectionCalibration(s, sections, pageRealismMode),
  }))

  return {
    ...page,
    sections: validatedSections,
    validationReport,
  }
}

// ─── helpers ──────────────────────────────────────────────────────

const RISK_ORDER: RiskLevel[] = ['low', 'moderate', 'elevated', 'high']

function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_ORDER.indexOf(a) >= RISK_ORDER.indexOf(b) ? a : b
}

function computeRealismMode(
  sections: import('../../generationOrchestration').OrchestratedSection[],
): RealismLevel | null {
  const withImage = sections.filter((s) => s.imageIntent)
  if (withImage.length === 0) return null
  const counts = new Map<RealismLevel, number>()
  for (const s of withImage) {
    const r = s.imageIntent!.realismLevel
    counts.set(r, (counts.get(r) ?? 0) + 1)
  }
  let maxCount = 0
  let mode: RealismLevel = withImage[0].imageIntent!.realismLevel
  for (const [k, c] of counts) {
    if (c > maxCount) {
      maxCount = c
      mode = k
    }
  }
  return mode
}
