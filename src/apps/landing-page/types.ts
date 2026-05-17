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

/** Phase 1 — Hybrid render strategy assigned by renderPlanner.
 *
 *  ai_full_render    — costs 1 KIE call. Reserved for emotional / human /
 *                       lifestyle / hero shots where AI is required.
 *  reusable_render   — costs 1 KIE call BUT generates a shared asset reused
 *                       across 8+ sections (the master product packshot).
 *  template_composed — costs 0 KIE calls. Rendered locally via canvas/HTML
 *                       composers (WhatsApp UI, Shopee review card, news
 *                       article layout, promo banner overlay, etc).
 *  derived_asset     — costs 0 KIE calls. Built locally by transforming a
 *                       reusable_render output (collage, crop, overlay swap).
 *
 *  Default behavior: when `renderStrategy` is undefined, the asset is
 *  treated as `ai_full_render` so legacy packs (pre-hybrid) still work.
 */
export type RenderStrategy =
  | 'ai_full_render'
  | 'reusable_render'
  | 'template_composed'
  | 'derived_asset'

/** Phase 1 — Per-asset composition config. Only set on non-AI strategies.
 *  Carried as serializable JSON inside the saved pack so the composer
 *  service can re-render the asset at any time. */
export interface CompositionConfig {
  /** Composer module to invoke — e.g. 'whatsapp' / 'shopee-review' /
   *  'tiktok-review' / 'news-article' / 'promo-banner' / 'before-after-collage'. */
  composer: string
  /** Free-form composer-specific payload (sender name, message text, star
   *  rating, headline, urgency text, …). Each composer defines its own
   *  schema; the planner extracts these from generateLandingPack output. */
  params: Record<string, unknown>
}

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
  // ── Phase 1: Hybrid render fields (ALL optional, backward-compat) ─────
  /** Routing strategy assigned by renderPlanner. Undefined = legacy
   *  ai_full_render path (default behavior, no breakage of old saved packs). */
  renderStrategy?: RenderStrategy
  /** Filename of the upstream reusable asset this one was derived from.
   *  Only set when renderStrategy='derived_asset' or 'reusable_render' is
   *  consumed downstream. */
  derivedFrom?: string
  /** Stable id of the upstream KIE-rendered packshot this asset reuses.
   *  Only set when renderStrategy='derived_asset'. Used as cache key in
   *  productRenderPool to skip duplicate AI renders. */
  sourceRenderId?: string
  /** Composer config — only present for 'template_composed' / 'derived_asset'.
   *  Drives local canvas/HTML rendering instead of a KIE call. */
  compositionConfig?: CompositionConfig
  /** True when this AI render is meant to be reused by other sections.
   *  Sticky flag — once set, generateImages.ts caches the output in
   *  productRenderPool keyed by sourceRenderId/filename. */
  reusable?: boolean
  /** VN human-readable explanation of why this strategy was picked.
   *  Shown in DevTools / debug panel only, never user-facing UI. */
  renderReason?: string
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
  /** Z10b: Vietnamese translation of the section title — shown italic
   *  directly under `title` in the section header bar. Always generated
   *  alongside `title` regardless of output language. */
  titleVi?: string
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
