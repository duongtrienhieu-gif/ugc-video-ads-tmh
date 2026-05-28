// ─────────────────────────────────────────────────────────────────────
// Narrative Mode — detectNarrativeMode (REBUILD Sprint 2, 2026-05-28)
//
// Decides how the pack should be paced + structured based on niche +
// emotional intensity + (optionally) the brainstorm-chosen hook angle.
//
// Three modes:
//   - pain-driven-DR     → health, sleep, hair-loss, financial-debt, joint
//                          Dense (10-13 blocks). Cuts filler validation +
//                          quality-of-life-shift blocks. Hook is shock-
//                          pain-scene by default.
//   - aspiration-led     → business, wealth, education, premium-brand
//                          Future-vision-led. Keeps full structure.
//   - recognition-soft   → beauty, lifestyle, anti-aging, luxury-skincare
//                          Current default behavior. Soft diary opening,
//                          full 15-17 block flow.
//
// Mode is consumed by:
//   1. resolveBlockPlan — to skip filler blocks for DR niches
//   2. systemPrompt — to load mode-specific cadence guidance
// ─────────────────────────────────────────────────────────────────────

import type { NicheKey } from '../storytelling/types'
import type { HookAngle } from '../packBrainstorm'

export type NarrativeMode = 'pain-driven-DR' | 'aspiration-led' | 'recognition-soft'

/** Niches that default to pain-driven-DR mode. Sharp acute pain, compounding
 *  condition, time-sensitive buyer. Hook should HIT pain in first 2 sentences. */
const PAIN_DRIVEN_NICHES: ReadonlyArray<NicheKey> = [
  'health-respiratory',
  'health-joint',
  'health-digestive',
  'health-cardiovascular',
  'health-functional',
  'supplement-wellness',
  'hair-loss',
  'sleep-fatigue',
  'weight-loss',
  'financial-debt',
] as unknown as NicheKey[]

/** Niches that default to aspiration-led mode. Reader buys for the future
 *  vision, not to escape immediate pain. Future-pacing dominates. */
const ASPIRATION_LED_NICHES: ReadonlyArray<NicheKey> = [
  'business-growth',
  'wealth-investing',
  'education-courses',
  'career-coaching',
  'premium-lifestyle',
] as unknown as NicheKey[]

/** When the brainstorm picked one of these angles, force DR mode even if
 *  niche defaults to soft. Means "the buyer's PAIN is sharp enough that
 *  DR pacing wins regardless of category". */
const DR_OVERRIDE_ANGLES: ReadonlyArray<HookAngle> = [
  'pain-immediate-scene',
  'wasted-effort',
  'future-fear',
]

/** When the brainstorm picked these, force soft mode even if niche defaults
 *  to DR. Means "the buyer's relationship with this product is identity /
 *  vanity / lifestyle — DR shock pattern would feel wrong". */
const SOFT_OVERRIDE_ANGLES: ReadonlyArray<HookAngle> = [
  'soft-recognition',
]

export interface DetectNarrativeModeInput {
  niche: NicheKey
  /** If brainstorm ran, pass its chosen angle to allow product-specific
   *  override of the niche default. */
  brainstormAngle?: HookAngle
}

export interface NarrativeModeDecision {
  mode: NarrativeMode
  /** 'niche-default' = picked from niche map.
   *  'brainstorm-override' = the brainstorm angle overrode the niche default. */
  source: 'niche-default' | 'brainstorm-override' | 'fallback'
  /** Short rationale — debug only. */
  rationale: string
}

export function detectNarrativeMode(input: DetectNarrativeModeInput): NarrativeModeDecision {
  const nicheBased: NarrativeMode = (PAIN_DRIVEN_NICHES as readonly string[]).includes(input.niche as string)
    ? 'pain-driven-DR'
    : (ASPIRATION_LED_NICHES as readonly string[]).includes(input.niche as string)
    ? 'aspiration-led'
    : 'recognition-soft'

  if (!input.brainstormAngle) {
    return {
      mode: nicheBased,
      source: 'niche-default',
      rationale: `niche=${input.niche} → ${nicheBased}`,
    }
  }

  // Brainstorm-angle override paths
  if (DR_OVERRIDE_ANGLES.includes(input.brainstormAngle) && nicheBased !== 'pain-driven-DR') {
    return {
      mode: 'pain-driven-DR',
      source: 'brainstorm-override',
      rationale: `niche=${input.niche} (default ${nicheBased}) but brainstorm picked angle="${input.brainstormAngle}" → force pain-driven-DR`,
    }
  }
  if (SOFT_OVERRIDE_ANGLES.includes(input.brainstormAngle) && nicheBased === 'pain-driven-DR') {
    return {
      mode: 'recognition-soft',
      source: 'brainstorm-override',
      rationale: `niche=${input.niche} (default pain-driven-DR) but brainstorm picked angle="${input.brainstormAngle}" → soften to recognition-soft`,
    }
  }

  return {
    mode: nicheBased,
    source: 'niche-default',
    rationale: `niche=${input.niche} → ${nicheBased} (brainstorm angle="${input.brainstormAngle}" did not override)`,
  }
}
