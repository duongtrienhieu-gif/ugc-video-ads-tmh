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
