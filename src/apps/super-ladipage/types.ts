// ─────────────────────────────────────────────────────────────────────
// Super Ladipage — clean-room rebuild của Landing Page AI.
// Pha 2: port shape type 1:1 từ Landing Page AI để UI giữ nguyên.
// Services tạo data theo shape này sẽ được rebuild ở pha 3.
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
  | 'comparison'
  | 'lifestyle'
  | 'expert-feedback'
  | 'magazine-feature'
  | 'stat-proof'
  | 'web-authority-proof'
  | 'social-proof'
  | 'whatsapp-testimonials'
  | 'news-proof'
  | 'before-after'
  | 'faq'
  | 'offer'
  | 'final-cta'

export type LandingLanguage = 'ms' | 'vi' | 'en'

export type LandingForm =
  | 'ugc-malaysia'
  | 'advertorial'
  | 'premium'
  | 'hard-sell-cod'
  | 'chuyen-gia'

export type CompetitorInfluence = 'low' | 'medium' | 'high'

export interface VisualMemoryItem {
  ref: string
  label: string
}

export type ImagePromptStatus = 'idle' | 'queued' | 'generating' | 'retrying' | 'done' | 'failed'

export interface ImagePrompt {
  filename: string
  prompt: string
  style: string
  aspectRatio: string
  generatedAssetRef?: string
  status?: ImagePromptStatus
  error?: string
  /** Token seeding diversity directive — buộc prompt hash khác nhau giữa các
   *  ảnh cùng prompt template, tránh image API trả về latent giống nhau. */
  variationSeed?: string
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

/** Schema so sánh có cấu trúc cho section type='comparison'. */
export interface ComparisonSchema {
  us:   { title: string; bullets: string[] }
  them: { title: string; bullets: string[] }
}

export interface LandingSection {
  type: SectionType
  title: string
  /** Bản dịch VN của title — luôn sinh ra cùng `title` bất kể ngôn ngữ. */
  titleVi?: string
  copy: string
  layoutGuide: string
  /** Bản dịch VN của `copy`. */
  viTranslation?: string
  imageAspectRatio?: '1:1' | '4:5' | '16:9' | '9:16'
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
  // Per-field VN translations
  headlineVi?: string
  subheadlineVi?: string
  ctaVi?: string
  offerStripVi?: string
  urgencyTextVi?: string
  bulletsVi?: string[]
  comparisonData?: ComparisonSchema
}

export interface LandingPagePack {
  productId: string
  productName: string
  language: LandingLanguage
  sections: LandingSection[]
  visualMemory: VisualMemoryItem[]
  generatedAt: number
  form?: LandingForm
  characterProfile?: CharacterProfile
  /** Mô tả ENG về packaging — extract từ ảnh tham chiếu để giữ identity. */
  productPackagingDescription?: string
}

/** Character storytelling — 1 nhân vật xuyên suốt cho form advertorial. */
export interface CharacterProfile {
  name: string
  archetype: string
  appearanceLock: string
  environmentLock: string
  emotionalArc: { sectionType: string; mood: string }[]
}

export interface LandingGenParams {
  productId: string
  language: LandingLanguage
  form?: LandingForm
  nicheHint?: string
  sourceUrl?: string
  competitorUrl?: string
  competitorInfluence?: CompetitorInfluence
  visualMemory?: VisualMemoryItem[]
}

export interface SavedLandingPack extends LandingPagePack {
  id: string
  title: string
  createdAt: number
}
