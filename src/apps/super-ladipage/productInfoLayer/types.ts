// ═════════════════════════════════════════════════════════════════════
// Product Info Layer — type definitions (PI-LAYER 2026-05-27)
//
// PARALLEL module to storytelling-core. Produces 5 "knowledge-transmission"
// blocks (mechanism / ingredients-usp / usage-faq / social-proof / pricing)
// in CONTINUED diary voice — narrator who told the storytelling now shares
// what they LEARNED about the product.
//
// LOCKED:
//   - Same first-person narrator voice as storytelling (NOT spec-sheet,
//     NOT marketing brochure, NOT hard-sell)
//   - Information transmitted THROUGH personal lens ("tôi đọc thấy...",
//     "em gái giải thích...", "vợ tôi hỏi...")
//   - Output is prose paragraphs, NO bullet lists, NO callout boxes
//   - Each block 80-180 words (shorter than storytelling blocks)
//   - Interleaved at SPECIFIC emotional-arc anchors via composer
//
// PLANNER is DATA-DRIVEN per niche + input — works for ANY product.
// Skips blocks where input data doesn't support them (eg no ingredients).
// ═════════════════════════════════════════════════════════════════════

import type { NicheKey, LandingLanguage, CharacterProfile } from '../storytelling/types'
import type { SectionType } from '../types'
import type { SynthesizedProductBrief } from '../productSynthesis/types'

export type { NicheKey }

// ─── 5 canonical PI section types ─────────────────────────────────────

export type PISectionType =
  | 'mechanism-personal'      // narrator's research moment — how it works
  | 'ingredients-usp-woven'   // narrator notices what's inside + what's different
  | 'usage-faq-personal'      // narrator's routine + addresses common questions
  | 'social-proof-collective' // multiple diary-voice testimonials (friends/family)
  | 'pricing-narrator'        // very short soft mention of offer

// ─── Anchor positions (where each PI type slots in the storytelling arc) ──

/** Storytelling block ID that this PI block should appear AFTER.
 *  'before:future-self-cta' = insert RIGHT BEFORE the cta block. */
export type PIAnchorPosition =
  | 'after:natural-product-discovery'
  | 'after:why-this-felt-different'
  | 'after:micro-transformation'
  | 'after:emotional-wins'
  | 'before:future-self-cta'

export const PI_ANCHOR_BY_TYPE: Record<PISectionType, PIAnchorPosition> = {
  'mechanism-personal':      'after:natural-product-discovery',
  'ingredients-usp-woven':   'after:why-this-felt-different',
  'usage-faq-personal':      'after:micro-transformation',
  'social-proof-collective': 'after:emotional-wins',
  'pricing-narrator':        'before:future-self-cta',
}

// ─── Input to planner: what data does THIS pack have? ─────────────────

export interface PlannerInput {
  niche: NicheKey
  /** Raw product input fields — planner uses presence to decide sections. */
  productPainPoints: string
  productBenefits: string
  productUsp: string
  productPricing: string
  productIngredients: string
  productName: string
  /** Vision + synthesis brief (passed through to generators). */
  synthesizedBrief: SynthesizedProductBrief
  /** Output language for the pack. */
  targetLanguage: LandingLanguage
  /** Character profile from storytelling pack (narrator continuity). */
  character: CharacterProfile
}

// ─── Plan output — which PI sections to gen ──────────────────────────

export interface PISectionPlan {
  type: PISectionType
  anchor: PIAnchorPosition
  /** Rationale for telemetry. */
  reason: string
}

export interface PIPlan {
  sections: PISectionPlan[]
  /** Sections skipped + why — for telemetry. */
  skipped: { type: PISectionType; reason: string }[]
}

// ─── Generator output per section ────────────────────────────────────

export interface PIBlock {
  /** Synthetic block ID, e.g. 'pi-mechanism-personal'. */
  id: string
  type: PISectionType
  /** Heading in target language — diary tone, NOT marketing. */
  heading: string
  /** Prose paragraphs (split by \n\n if needed). Each ~30-80 words. */
  paragraphs: string[]
  /** Optional whispered emphasis (e.g. softly mentioned offer). */
  subtleCallout?: string
  /** Anchor position (drives composer placement). */
  anchor: PIAnchorPosition
  /** Source: gemini = full synthesis call, fallback = static template. */
  source: 'gemini' | 'fallback'
}

// ─── PI batch output ─────────────────────────────────────────────────

export interface PIBatchResult {
  blocks: PIBlock[]
  succeeded: number
  fallbackCount: number
  skippedCount: number
  durationMs: number
}

// ─── Generator input (per section type) ──────────────────────────────

export interface GeneratorInput {
  type: PISectionType
  niche: NicheKey
  targetLanguage: LandingLanguage
  productName: string
  productPainPoints: string
  productBenefits: string
  productUsp: string
  productPricing: string
  productIngredients: string
  synthesizedBrief: SynthesizedProductBrief
  character: CharacterProfile
}

export interface GeneratorKeys {
  geminiApiKey: string
  kieApiKey: string
}

// ─── SectionType mapping (for LandingSection compat in pack output) ──

export const PI_SECTION_TYPE_MAP: Record<PISectionType, SectionType> = {
  'mechanism-personal':      'mechanism',
  'ingredients-usp-woven':   'ingredients',
  'usage-faq-personal':      'faq',
  'social-proof-collective': 'social-proof',
  'pricing-narrator':        'offer',
}

// ─── Image role per PI type (2026-05-30) ─────────────────────────────
//
// Universal mapping. PI blocks that benefit from a visual anchor (so the
// reader can SEE the product as the narrator describes it) get a role.
// Others stay text-only by design.
//
// - mechanism-personal:  narrator describes the product's physical
//                        structure ("3 springs / exoskeleton / patella
//                        protection") — needs a PROMINENT product shot
//                        so the reader can verify the described structure.
//                        → 'hero-product' = product fills 60-80% of frame,
//                          label readable, clean background (vs the old
//                          'proof-callout' which only showed product at
//                          ~25% of frame — user feedback that "no image
//                          actually shows the product clearly").
// - All others:          stay text-only (usage routine works without
//                        image; testimonial chat screenshots feel fake;
//                        pricing receipt feels too commercial).
//
// Adding image to a PI type here also requires the orchestration pipeline
// to pre-compute a scene prompt and create a generated-asset plan; see
// generateStorytellingPack.ts § PI image plans.

export const PI_IMAGE_ROLE: Record<PISectionType, 'proof-callout' | 'hero-product' | null> = {
  'mechanism-personal':      'hero-product',
  'ingredients-usp-woven':   null,
  'usage-faq-personal':      null,
  'social-proof-collective': null,
  'pricing-narrator':        null,
}

/** Stable id used as map key for PI image scenes / assets — mirrors the
 *  pattern used by PIBlock.id (`pi-<type>`). Single source of truth. */
export function piBlockIdForType(type: PISectionType): string {
  return `pi-${type}`
}
