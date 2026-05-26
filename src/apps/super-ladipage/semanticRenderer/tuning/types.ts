// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — Tuning types (P8 validation loop)
//
// 5 global knobs, each integer in [-2, +2]. 0 = no change (identity).
// applyTuning(page, knobs) is pure + deterministic + immutable.
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
}

export const IDENTITY_KNOBS: TuningKnobs = {
  density: 0,
  breathing: 0,
  proofVisibility: 0,
  ctaAggression: 0,
  imageFrequency: 0,
}

export function isIdentityKnobs(k: TuningKnobs): boolean {
  return (
    k.density === 0 &&
    k.breathing === 0 &&
    k.proofVisibility === 0 &&
    k.ctaAggression === 0 &&
    k.imageFrequency === 0
  )
}
