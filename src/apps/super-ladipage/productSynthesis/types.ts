// ═════════════════════════════════════════════════════════════════════
// Product Synthesis — type definitions (P-SYNTHESIS 2026-05-27)
//
// Single Gemini "deep thinking" call combining ALL upstream inputs:
//   - Text product info (name, painPoints, benefits, USP, pricing)
//   - VisionExtractedReality (form factor, ingredients, brand, identity)
//   - NicheDetection (8 niche classification)
//   - ProductRealityModel (7-axis form/mechanism/pacing classifier)
//
// Output: SynthesizedProductBrief — TIGHT 3-5 line product reality that
// becomes PRIMARY context for storytelling Gemini (not generic niche
// template).
//
// LOCKED: synthesis is data normalization, NOT marketing writing.
// Output describes the product accurately. Storytelling generator picks
// up from there.
// ═════════════════════════════════════════════════════════════════════

import type { VisionExtractedReality } from '../productVision'
import type { ProductRealityModel } from '../productClass'
import type { NicheKey } from '../storytelling/types'

export interface SynthesizedProductBrief {
  /** 3-5 line tight description of THIS product's reality.
   *  Replaces thin productBrief in storytelling prompt. */
  productEssence: string

  /** Symptoms reader of THIS product realistically recognizes.
   *  e.g., for nasal spray: ['mũi nghẹt sáng dậy', 'hắt hơi liên tục',
   *  'thở bằng miệng khi ngủ']. Drives recognition phase. */
  readerSpecificSymptoms: string[]

  /** Symptoms reader of THIS product does NOT have — explicitly forbidden
   *  to avoid drift. For nasal spray: ['đầu gối nhói khi xuống cầu thang',
   *  'lưng đau âm ỉ', 'da xỉn màu', etc.]. */
  forbiddenDriftSymptoms: string[]

  /** Realistic daily-life usage scene. */
  usageScene: string

  /** Realistic discovery context for this specific product type. */
  discoveryRealistic: string

  /** What reader has REALISTICALLY tried before (failed attempts). */
  realisticFailedAttempts: string[]

  /** Concrete product identity descriptor for image generation reuse.
   *  Inherits from VisionExtractedReality if available, augmented by
   *  text product info. */
  productIdentityForImage: string

  /** Source — gemini-synthesis (success) or fallback (synthesis failed). */
  source: 'gemini-synthesis' | 'fallback'

  /** Optional 1-line rationale for QA log. */
  rationale?: string
}

export interface SynthesizeProductBriefInput {
  productName: string
  productPainPoints?: string
  productBenefits?: string
  productUsp?: string
  productPricing?: string
  visionReality: VisionExtractedReality
  niche: NicheKey
  productReality: ProductRealityModel
  targetLanguage: 'vi' | 'ms' | 'en'
}

export interface SynthesizeProductBriefKeys {
  geminiApiKey: string
  kieApiKey: string
}

// ═════════════════════════════════════════════════════════════════════
// CP-SYNTHESIS (2026-05-27) — Commercial Psychology synthesis
//
// Hybrid layered synthesis: niche tables (NICHE_DESIRE / CTA / OBJECTIONS
// / PROOF_TEXTURE / MECHANISM_VOCAB) provide CULTURAL REGISTER baseline,
// but per-pack commercial psychology is REFINED via 1 Gemini call from
// product reality. Output OVERRIDES niche defaults when present —
// same pattern as SPEC.1 (synthesis symptoms override niche pool).
//
// Result: pack adapts commercial psychology to ANY product including
// products outside the 22 known niches, while preserving deterministic
// anti-drift guardrails from niche tables when applicable.
// ═════════════════════════════════════════════════════════════════════

export interface CommercialObjection {
  /** Reader's likely skeptical question. */
  objection: string
  /** Counter-posture — narrator's emotional response stance. */
  counterPosture: string
}

export interface CommercialVoiceTexture {
  /** Typical voice (age + demographic + register). */
  typicalVoice: string
  /** Platform feel where this voice lives. */
  platformFeel: string
  /** 3-5 texture cues — niche/product-specific phrases / references. */
  textureCues: string[]
}

export interface SynthesizedCommercialPsychology {
  /** Primary buying desire — what THIS reader actually wants emotionally.
   *  Overrides NICHE_DESIRE_ARCHITECTURE.primaryDesire when more specific. */
  primaryDesire: string
  /** 3-5 product-specific desire tensions driving purchase. */
  desireTensions: string[]
  /** Where Phase 4 ending must land emotionally for THIS product. */
  emotionalGravity: string

  /** Action push energy for CTA — vibe description, NOT prescriptive rule.
   *  Overrides CTA_ENERGY_MODES.vibe. */
  ctaEnergyVibe: string
  /** Anti-default CTA patterns for THIS product type. */
  ctaAvoidPatterns: string[]

  /** Top 3 objections + counter-postures specific to THIS product.
   *  Overrides NICHE_OBJECTIONS sampling when present. */
  topObjections: CommercialObjection[]

  /** Voice texture for proof generation — overrides PROOF_TEXTURE_PROFILES. */
  voiceTextureHint: CommercialVoiceTexture

  /** Concrete mechanism vocabulary specific to THIS product.
   *  AUGMENTS NICHE_MECHANISM_VOCAB (intersection used in prompt). */
  mechanismVocabHints: string[]

  /** Source — gemini synthesis (success) or fallback (call failed). */
  source: 'gemini-synthesis' | 'fallback'

  /** Optional rationale for QA. */
  rationale?: string
}

export interface SynthesizeCommercialPsychologyInput {
  productName: string
  productPainPoints?: string
  productBenefits?: string
  productUsp?: string
  productPricing?: string
  niche: NicheKey
  /** Reuse fields from productBrief — single source of truth. */
  productEssence: string
  readerSpecificSymptoms: string[]
  usageScene: string
  realisticFailedAttempts: string[]
  /** Optional cultural anchor from existing niche tables (for register hint). */
  nicheBaselineCulturalHint?: string
  targetLanguage: 'vi' | 'ms' | 'en'
}

export interface SynthesizeCommercialPsychologyKeys {
  geminiApiKey: string
  kieApiKey: string
}
