// ─────────────────────────────────────────────────────────────────────
// Landing Page AI — advertorial pack types.
//
// Phase 1 output is a structured "copy-paste into Ladipage" pack: 10
// sections, each with copy + image PROMPTS (not images yet) + layout
// guide. Phase 2 will add auto image generation + ZIP export.
// ─────────────────────────────────────────────────────────────────────

// 14-section structure per the Phase 2 spec — direct response advertorial
// flow tuned for Malaysian FB ads + COD ecommerce.
export type SectionType =
  | 'hero'
  | 'pain'
  | 'why-happens'
  | 'failed-solutions'
  | 'product-discovery'
  | 'ingredients'
  | 'mechanism'
  | 'benefits'
  | 'lifestyle'
  | 'social-proof'
  | 'whatsapp-testimonials'
  | 'faq'
  | 'offer'
  | 'final-cta'

export type LandingLanguage = 'ms' | 'vi' | 'en'

/** A single uploaded product reference image used as visual memory across
 *  image generations. Pass top 3 into KIE filesUrl for product-focused
 *  sections so the rendered product stays visually consistent. */
export interface VisualMemoryItem {
  /** asset:xxx ref — stable, survives signed-URL expiry. */
  ref: string
  /** User-facing label like "front packaging", "back label", "logo". */
  label: string
}

export type ImagePromptStatus = 'idle' | 'queued' | 'generating' | 'done' | 'failed'

export interface ImagePrompt {
  /** Suggested filename like "hero_01.jpg" for the user's reference. */
  filename: string
  /** Full English image-generation prompt (30-60 words, Malaysia UGC default). */
  prompt: string
  /** Style label like "Malaysia UGC native" or "WhatsApp screenshot". */
  style: string
  /** "4:5" / "1:1" / "9:16" / "16:9" — guidance for Ladipage placement. */
  aspectRatio: string
  // ── Phase 2 — real generated image fields (optional for backwards compat) ──
  /** asset:xxx ref of the generated image, set once worker completes. */
  generatedAssetRef?: string
  status?: ImagePromptStatus
  error?: string
}

export interface FaqItem {
  question: string
  answer: string
}

export interface ReviewItem {
  /** Author display name (localised). */
  author: string
  /** The review text. */
  quote: string
  /** Optional meta like "Bought 2 weeks ago" / "WhatsApp chat". */
  meta?: string
  /** 1-5 star rating, optional. */
  rating?: number
}

export interface LandingSection {
  type: SectionType
  /** Human-readable Vietnamese title (used as the card heading in the UI). */
  title: string
  /** Main body copy — mobile-first formatted with line breaks + emojis. */
  copy: string
  /** Vietnamese guidance for the user on how to lay out this section in Ladipage. */
  layoutGuide: string
  /** Section-type-specific structured fields below — all optional. */
  headline?: string
  subheadline?: string
  cta?: string
  offerStrip?: string
  urgencyText?: string
  bullets?: string[]
  faqs?: FaqItem[]
  reviews?: ReviewItem[]
  imagePrompts: ImagePrompt[]
  /** Suggestion like "Full-width on mobile, max 720px height". */
  imageSizeHint?: string
}

export interface LandingPagePack {
  productId: string
  productName: string
  language: LandingLanguage
  sections: LandingSection[]
  /** Uploaded product reference images. May be empty — falls back to
   *  selectedProduct.productImage at gen time if so. */
  visualMemory: VisualMemoryItem[]
  generatedAt: number
}

export interface LandingGenParams {
  productId: string
  language: LandingLanguage
  /** Niche label (e.g. "supplement gut health") helps Gemini calibrate tone. */
  nicheHint?: string
  /** Optional source URL — passed as text context to Gemini. NOT crawled in Phase 2. */
  sourceUrl?: string
  /** Pre-collected visual references. Passed into the pack as-is and reused
   *  for image generation in Phase B. */
  visualMemory?: VisualMemoryItem[]
}

export interface SavedLandingPack extends LandingPagePack {
  id: string
  title: string
  createdAt: number
}
