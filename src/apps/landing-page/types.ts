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

/** A single uploaded product reference image used as visual memory across
 *  image generations. */
export interface VisualMemoryItem {
  ref: string
  label: string
}

export type ImagePromptStatus = 'idle' | 'queued' | 'generating' | 'done' | 'failed'

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
   *  Only '1:1' or '4:5' allowed (9:16 is banned globally). */
  imageAspectRatio?: '1:1' | '4:5'
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
  nicheHint?: string
  sourceUrl?: string
  visualMemory?: VisualMemoryItem[]
}

export interface SavedLandingPack extends LandingPagePack {
  id: string
  title: string
  createdAt: number
}
