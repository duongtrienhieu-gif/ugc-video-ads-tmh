// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — Tuning types (P8 + P14)
//
// P8: 5 global knobs (density / breathing / proofVisibility /
//     ctaAggression / imageFrequency)
// P14: + 2 knobs (realismLevel / polishLevel) — productization layer
//
// Each integer in [-2, +2]. 0 = no change (identity). applyTuning is
// pure + deterministic + immutable.
//
// LOCKED: knobs only shift EXISTING enum values along their own axes.
// No new semantic concepts. No prompt mutation. No paragraph rewriting.
// ─────────────────────────────────────────────────────────────────────

export type TuningKnobValue = -2 | -1 | 0 | 1 | 2

export interface TuningKnobs {
  /** Density: shifts SectionDensity + TextChunking. */
  density: TuningKnobValue
  /** Breathing: shifts SectionBreathing + SpacingPreset. */
  breathing: TuningKnobValue
  /** Proof visibility: shifts ProofWeight + ProofPresentation. */
  proofVisibility: TuningKnobValue
  /** CTA aggression: shifts CtaAggression + CtaPlacement. */
  ctaAggression: TuningKnobValue
  /** Image frequency: mutes non-hero ImageRoles at negative values. */
  imageFrequency: TuningKnobValue
  /** P14 — Realism level: shifts RealismLevel on imageIntent. */
  realismLevel: TuningKnobValue
  /** P14 — Polish level: shifts PolishLevel on imageIntent. */
  polishLevel: TuningKnobValue
}

export const IDENTITY_KNOBS: TuningKnobs = {
  density: 0,
  breathing: 0,
  proofVisibility: 0,
  ctaAggression: 0,
  imageFrequency: 0,
  realismLevel: 0,
  polishLevel: 0,
}

export function isIdentityKnobs(k: TuningKnobs): boolean {
  return (
    k.density === 0 &&
    k.breathing === 0 &&
    k.proofVisibility === 0 &&
    k.ctaAggression === 0 &&
    k.imageFrequency === 0 &&
    k.realismLevel === 0 &&
    k.polishLevel === 0
  )
}
