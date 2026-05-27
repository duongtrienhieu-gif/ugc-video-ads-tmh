// ═════════════════════════════════════════════════════════════════════
// Validation + Calibration — type definitions (P13 governance loop)
//
// Sits AFTER generationOrchestration. Validates whether the planned
// pipeline still feels like a REAL winning mobile landingpage, NOT
// AI-generated polish drift.
//
// LOCKED: observation + governance + advisory ONLY. NO mutation of
// prompts. NO mutation of images. NO autonomous redesign. NO AI taste
// engine. NO CV / model fine-tuning logic. Pure heuristics over
// upstream semantic data.
//
// LOCKED: 6 risk categories + advisory knob recommendations. Future
// P14+ may apply recommendations. Human reviews otherwise.
// ═════════════════════════════════════════════════════════════════════

import type {
  OrchestratedSection,
  OrchestratedPage,
} from '../generationOrchestration'

// ─── Risk + severity scales (LOCKED) ────────────────────────────────

export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'high'

export type WarningSeverity = 'info' | 'warn' | 'critical'

export type RiskCategory =
  | 'realismRisk'
  | 'polishDrift'
  | 'proofAuthenticity'
  | 'scrollFatigue'
  | 'consistencyRisk'
  | 'repetitionRisk'
  | 'ctaOverexposure'
  | 'sectionAlignment'

// ─── Validation warning (per finding) ──────────────────────────────

export interface ValidationWarning {
  category: RiskCategory
  severity: WarningSeverity
  message: string
  affectedSectionIds: string[]
}

// ─── Tuning knobs that P13 may recommend (LOCKED user list) ────────

export type CalibrationKnob =
  | 'realismLevel'
  | 'polishLevel'
  | 'visualNoise'
  | 'imageFrequency'
  | 'breathing'
  | 'proofVisibility'

export type KnobDirection = -2 | -1 | 1 | 2

export interface RecommendedKnobAdjustment {
  knob: CalibrationKnob
  direction: KnobDirection
  reason: string
  /** Which risk category triggered this recommendation. */
  triggeredBy: RiskCategory
}

// ─── Per-page validation report (user-specified shape) ─────────────

export interface ValidationReport {
  realismRisk: RiskLevel
  polishDrift: RiskLevel
  proofAuthenticity: RiskLevel
  scrollFatigue: RiskLevel
  consistencyRisk: RiskLevel
  repetitionRisk: RiskLevel
  ctaOverexposure: RiskLevel
  sectionAlignment: RiskLevel
  warnings: ValidationWarning[]
  recommendedKnobAdjustments: RecommendedKnobAdjustment[]
}

// ─── Per-section calibration (user-specified shape) ────────────────

export interface SectionCalibration {
  sectionId: string
  /** Distance of section's realismLevel from page mode. 0 = aligned, 1 = max drift. */
  realismDelta: number
  /** Mismatch between emotional state and sectionRole expectation. 0 = aligned, 1 = max drift. */
  emotionalDrift: number
  /** Proof believability (proof sections only). 1 = highly believable, 0 = fake-ad feel. */
  proofBelievability: number
  /** Framing variance from adjacent sections. 1 = unique, 0 = identical to neighbors. */
  framingVariance: number
  /** Composite contribution to good pacing. 0-1. */
  pacingContribution: number
  /** Per-section explanatory notes (advisory). */
  notes: string[]
}

// ─── ValidatedSection / ValidatedPage (subtype chain) ──────────────

export interface ValidatedSection extends OrchestratedSection {
  /** Present for every section. Notes may be empty for sections with no image. */
  sectionCalibration: SectionCalibration
}

export interface ValidatedPage extends OrchestratedPage {
  sections: ValidatedSection[]
  /** Aggregate page-level validation report. */
  validationReport: ValidationReport
}
