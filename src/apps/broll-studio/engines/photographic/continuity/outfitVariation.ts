// ── Outfit Variation (P4) ──────────────────────────────────────────────────
//
// Rule: a pack must NOT repeat the same clothing across all sections.
// Before/After requires visibly different outfits. Lifestyle allows soft
// variation. Storytelling evolves outfits naturally section by section.
//
// outfitVariation picks a deterministic outfit hint per section position
// from the character's outfitPalette so the same input produces the same
// pack — no flicker between regenerations.

import type { CharacterMemory } from '../../../types/continuity'
import type { SectionRole } from '../../../types/narrative'

/**
 * Generic outfit hints by section role. Combined with the character's
 * palette to produce the final [OUTFIT] prompt fragment.
 */
const OUTFIT_HINTS_BY_ROLE: Record<SectionRole, string> = {
  pain:                'casual at-home wear, slightly disheveled, comfortable',
  storytelling_intro:  'simple everyday outfit, neutral, lived-in',
  lifestyle:           'casual day outfit, weekend-appropriate',
  social_proof:        'relaxed UGC outfit, looks like real customer, no styling effort',
  product_showcase:    'clean neutral top so product label dominates the composition',
  before_after:        'CONTRAST OUTFIT — must be visibly different from the before-state clothing',
  offer:               'put-together outfit, confident styling',
  cta:                 'polished but believable outfit, confident',
}

export interface OutfitChoice {
  /** Free-form outfit description for the [OUTFIT] block. */
  description: string
  /** Palette tag picked for this section. */
  paletteTag: string | null
}

/**
 * Pick an outfit hint deterministically. Same memory + same section index
 * → same outfit. The palette rotates through entries so each section
 * lands on a different tone.
 */
export function pickOutfit(
  memory: CharacterMemory,
  role: SectionRole,
  sectionIndex: number = 0,
): OutfitChoice {
  const palette = memory.outfitPalette ?? []
  const paletteTag = palette.length > 0
    ? palette[sectionIndex % palette.length]!
    : null
  const baseHint = OUTFIT_HINTS_BY_ROLE[role]
  const description = paletteTag
    ? `${baseHint}, in ${paletteTag} tones.`
    : `${baseHint}.`
  return { description, paletteTag }
}

export function buildOutfitBlock(choice: OutfitChoice): string {
  return `[OUTFIT]\n${choice.description}`
}
