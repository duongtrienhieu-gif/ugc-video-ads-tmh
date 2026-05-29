// ═════════════════════════════════════════════════════════════════════
// Product Vision — type definitions (P-VISION 2026-05-27)
//
// Gemini Vision reads uploaded product images (packaging, label, product
// shot) and extracts structured reality. Output feeds into:
//   1. Deep product brief synthesis (storytelling content accuracy)
//   2. Image generation prompts (product identity in CTA section images)
//
// LOCKED: pure reading layer. NO interpretation, NO opinion, NO marketing
// language invention — just structured extraction of what's visible.
// ═════════════════════════════════════════════════════════════════════

import type { VisualMemoryItem } from '../types'

export interface VisionExtractedReality {
  /** Visible form factor from images (e.g., "30ml spray bottle", "60-pill bottle", "wearable knee brace with hinges"). */
  formFactor: string
  /** Active ingredients listed on label (if visible). */
  visibleIngredients: string[]
  /** Brand visual tone (e.g., "minimalist medical", "playful TikTok", "premium pharmacy"). */
  brandTone: string
  /** Claims printed on packaging (translated to VN). */
  visibleClaims: string[]
  /** Usage instructions visible on packaging. */
  usageInstructions?: string
  /** Concrete product identity descriptor for image generation reuse.
   *  e.g., "white plastic 30ml spray bottle with green herbal leaf logo,
   *  Bahasa Melayu label, sleek minimalist design". */
  productIdentityForImage: string
  /** Estimated target audience from visual cues (age range, demographic). */
  inferredTargetAudience: string
  /** Form factor mismatches with text claim (e.g., text says "spray" but image shows pill). */
  inconsistencyFlags: string[]
  /** Source — gemini-vision (success) or fallback (no images / vision failed). */
  source: 'gemini-vision' | 'no-images' | 'vision-failed'
  /** How many images were processed. */
  imageCount: number
}

export interface ReadProductImagesInput {
  /** Items from params.visualMemory[]. Each has ref (IDB asset ID) + label. */
  visualMemory: VisualMemoryItem[]
  /** Product context text for vision prompt grounding. */
  productName: string
  productPainPoints?: string
}

export interface ReadProductImagesKeys {
  geminiApiKey: string
}
