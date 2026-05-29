// ── Narrative Context types (P4) ────────────────────────────────────────────
//
// Every section render now carries a NarrativeContext that tells the
// photographic module its role in the larger story: which section it is,
// what emotion it should convey, how visible the product should be, and
// which persona is the hero. The module's buildPrompt() consumes this to
// shape tone — pain sections suppress product showcase, lifestyle sections
// soften it, cta sections push it hard.

import type { CharacterMemory, ContinuityLevel } from './continuity'
import type { PersonaId } from './persona'

/** Section role within the storytelling pack. */
export type SectionRole =
  | 'pain'                // problem state, no product
  | 'storytelling_intro'  // narrative setup, no product
  | 'lifestyle'           // soft product presence
  | 'social_proof'        // medium product, testimonial vibe
  | 'product_showcase'    // hero product shot
  | 'before_after'        // transformation, product hint
  | 'offer'               // high product visibility
  | 'cta'                 // very high product visibility

/** Emotional stage along the pack timeline. */
export type EmotionalState =
  | 'frustration'
  | 'fatigue'
  | 'hope'
  | 'curiosity'
  | 'improvement'
  | 'confidence'
  | 'happiness'
  | 'neutral'

/** How much the product can show. QC enforces this. */
export type ProductVisibility =
  | 'none'        // product MUST NOT appear
  | 'soft'        // product peripheral / soft-focus
  | 'medium'      // product visible but not centered
  | 'high'        // product clearly featured
  | 'very_high'   // product hero / centered

/**
 * Narrative context — passed via GenerateAssetParams.options.narrative.
 * Optional: if missing, modules fall back to legacy single-shot behavior
 * (Phase 3 compatibility).
 */
export interface NarrativeContext {
  sectionRole: SectionRole
  emotionalState: EmotionalState
  productVisibility: ProductVisibility
  continuityLevel: ContinuityLevel
  personaId?: PersonaId
  /** When LOCKED, this carries the hero identity to inject. */
  characterMemory?: CharacterMemory
  /** Section index in pack (0-based) — helps outfit evolution. */
  sectionIndex?: number
  /** Total sections in pack — helps timing the emotional arc. */
  totalSections?: number
}
