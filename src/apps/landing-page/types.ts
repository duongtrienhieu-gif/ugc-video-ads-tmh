// ─────────────────────────────────────────────────────────────────────
// Landing Page AI — advertorial pack types.
// Phase 3 — 17 sections, dual-language (MY + VI translation), asset-first.
// ─────────────────────────────────────────────────────────────────────

export type SectionType =
  | 'hero'
  | 'pain'
  | 'why-happens'
  | 'failed-solutions'
  | 'product-discovery'
  | 'ingredients'
  | 'mechanism'
  | 'benefits'
  | 'comparison'            // NEW — product vs competitor infographic
  | 'lifestyle'
  | 'social-proof'
  | 'whatsapp-testimonials'
  | 'news-proof'            // NEW — authority / media proof screenshots
  | 'before-after'          // NEW — transformation photos collage
  | 'faq'
  | 'offer'
  | 'final-cta'

export type LandingLanguage = 'ms' | 'vi' | 'en'

export type LandingForm =
  | 'ugc-malaysia'    // default — 17-section MY ecommerce advertorial
  | 'advertorial'     // editorial / review storytelling
  | 'premium'         // clean brand, lifestyle, less hard-sell
  | 'hard-sell-cod'   // maximum urgency, scarcity, chốt nhanh COD

export type CompetitorInfluence = 'low' | 'medium' | 'high'

/** A single uploaded product reference image used as visual memory across
 *  image generations. */
export interface VisualMemoryItem {
  ref: string
  label: string
}

export type ImagePromptStatus = 'idle' | 'queued' | 'generating' | 'retrying' | 'done' | 'failed'

export interface ImagePrompt {
  filename: string
  /** Full English image-generation prompt (30-80 words). Includes text overlay
   *  instructions where required (hero, pain). */
  prompt: string
  /** Style / asset-type label shown as a badge in the UI. */
  style: string
  /** "4:5" / "1:1" / "9:16" / "16:9" */
  aspectRatio: string
  // ── Generated image fields ──────────────────────────────────────────
  generatedAssetRef?: string
  status?: ImagePromptStatus
  error?: string
}

export interface FaqItem {
  question: string
  answer: string
}

export interface ReviewItem {
  author: string
  quote: string
  meta?: string
  rating?: number
}

export interface LandingSection {
  type: SectionType
  title: string
  copy: string
  layoutGuide: string
  /** Vietnamese translation of `copy` (for the Vietnamese-speaking marketer).
   *  Always included regardless of output language. */
  viTranslation?: string
  /** Section-level aspect ratio — enforced on ALL images in this section.
   *  '1:1' or '4:5' allowed for most sections (9:16 is banned globally).
   *  '16:9' is allowed ONLY for banner sections (offer / final-cta) where it
   *  better suits landscape promo banners. */
  imageAspectRatio?: '1:1' | '4:5' | '16:9'
  headline?: string
  subheadline?: string
  cta?: string
  offerStrip?: string
  urgencyText?: string
  bullets?: string[]
  faqs?: FaqItem[]
  reviews?: ReviewItem[]
  imagePrompts: ImagePrompt[]
  imageSizeHint?: string
  // ── Z10: per-field Vietnamese translations (rendered inline under each MY value) ──
  // Always generated when output language ≠ 'vi'. UI hides any *Vi value that
  // equals its source so the VN-output case doesn't show duplicates.
  headlineVi?: string
  subheadlineVi?: string
  ctaVi?: string
  offerStripVi?: string
  urgencyTextVi?: string
  /** Parallel array to `bullets` — same length, index-aligned. */
  bulletsVi?: string[]
}

export interface LandingPagePack {
  productId: string
  productName: string
  language: LandingLanguage
  sections: LandingSection[]
  visualMemory: VisualMemoryItem[]
  generatedAt: number
}

export interface LandingGenParams {
  productId: string
  language: LandingLanguage
  form?: LandingForm
  nicheHint?: string
  sourceUrl?: string          // legacy — kept for compat
  competitorUrl?: string      // Step 5: competitor landing page to learn from
  competitorInfluence?: CompetitorInfluence
  visualMemory?: VisualMemoryItem[]
}

export interface SavedLandingPack extends LandingPagePack {
  id: string
  title: string
  createdAt: number
}
