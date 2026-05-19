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
  | 'expert-kol'          // P4 NEW — Expert + KOL endorsement (thay vị trí lifestyle)
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
  /** P4 — bilingual FAQ. Khi language != 'vi', mỗi FAQ kèm bản dịch VN
   *  parallel index. UI hiển thị toggle "🇻🇳 Xem bản dịch tiếng Việt"
   *  giống pattern copy chính. */
  faqsVi?: Array<{ question: string; answer: string }>
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

// ═════════════════════════════════════════════════════════════════════
// PHASE 3 — TYPES BỔ SUNG CHO ENGINE MỚI
// (kế thừa từ kiến trúc đã chốt — không thay đổi gì ở UI types phía trên)
// ═════════════════════════════════════════════════════════════════════

/** Tier phân loại độ liên quan của pain / transformation tới ngách sản phẩm.
 *  Tier 4 = OFF-NICHE (CẤM HOÀN TOÀN). */
export interface FourTier<T = string> {
  tier1_primary:  T[]
  tier2_axis:     T[]
  tier3_loose:    T[]
  tier4_offniche: T[]
}

/** Identity tổng hợp sản phẩm — extract 1 LẦN / pack, dùng verbatim cho
 *  mọi prompt sau này. Đây là chỗ chống identity drift cốt lõi. */
export interface ProductIdentity {
  // ─── Visual identity ───
  productNameExact:       string
  packagingDescription:   string
  /** P4 NEW — short canonical shape token (e.g. "round flat jar (squat
   *  cylinder, height ≈ half diameter)") to force consistent shape across
   *  all renders. Dùng để fix lỗi AI render packaging dọc cao thay vì
   *  tròn dẹp. Inject vào MỌI prompt có sản phẩm. */
  packagingShape:         string
  primaryColors:          string[]
  productScale:           string
  productPose:            string

  // ─── Brand lock ───
  coBrandBadges:          string[]
  trustBadges:            string[]
  priceTag:               string

  // ─── Subject identity (P4 NEW — fix lỗi sec 4 AI ra đàn ông châu Âu) ───
  /** Lock chủ thể người trong ảnh theo target market. */
  subjectIdentityLock: {
    /** Người chính thường xuất hiện. Vd "Malaysian Muslim woman wearing
     *  hijab, mid-20s to 40s, warm friendly look". */
    primary:   string
    /** Người phụ (optional) — vd nam Malay cho 1-2 ảnh đa dạng demographic. */
    secondary?: string
  }

  // ─── Semantic identity (4-tier) ───
  productCategory:        string
  painPointsByTier:       FourTier<string>
  transformationByTier:   FourTier<string>
  visualAntiPatterns:     string[]
}

/** Recipe ID — 8 visual recipes cho preset ugc-malaysia.
 *  P4 NEW: H = Expert/KOL endorsement card. G split internally:
 *  - G + variant "promo"        (offer banner cũ)
 *  - G + variant "social-proof"  (final-cta-now-position-2 banner) */
export type RecipeId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'

/** Text block muốn render trong ảnh (do gpt-image-1 render). */
export interface TextBlock {
  text:     string
  role:     'headline' | 'subheadline' | 'badge' | 'label' | 'cta' | 'price' | 'metric' | 'question' | 'beforeafter-label'
  position: 'top' | 'middle' | 'bottom' | 'overlay-on-product' | 'corner' | 'center'
  /** Style hint — code template chuyển thành prompt instruction. */
  style?:   'bold-condensed' | 'italic-slanted' | 'ecommerce-banner' | 'glassmorphism-badge' | 'star-rating'
}

/** Decor element (badge, arrow, glow…) cho recipe A. */
export interface DecorElement {
  type:        'glassmorphism-badge' | 'arrow' | 'glow' | 'starburst' | 'checkmark' | 'cross' | 'emoji-prefix'
  /** Text trên element (nếu có), vd "✅ Penghadaman Lancar". */
  text?:       string
  /** Vị trí gợi ý — không bắt buộc precise, chỉ hint. */
  position?:   string
  /** Màu hint cho glow / accent. */
  color?:      string
}

/** 1 imageSlot trong section — đây là OUTPUT của Gemini text gen,
 *  INPUT của prompt assembler. */
export interface ImageSlotConcept {
  recipeId:           RecipeId
  /** P4 NEW — variant cho recipe đa-style:
   *  - F: 'trust-news' | 'warning-news' | 'social-platform' | 'whatsapp'
   *  - G: 'promo' | 'social-proof-banner'
   *  - H: 'expert' | 'kol'
   *  Recipes A/B/C/D/E không dùng variant. */
  recipeVariant?:     string
  /** Cảnh tổng quát 5-30 từ. KHÔNG bao gồm style/composition. */
  conceptScene:       string
  /** Mô tả vai trò để hiển thị ở UI (vd "Hero text overlay A"). */
  roleLabel:          string
  /** Filename gợi ý (vd "hero_01.jpg"). */
  filename:           string
  aspectRatio:        '1:1' | '4:5' | '16:9' | '9:16'
  /** Có hiển thị sản phẩm trong ảnh này không. */
  productInScene:     boolean
  /** P4 NEW — chỉ định subject identity nào dùng cho ảnh này (cho recipe
   *  có người làm chủ thể). 'primary' = default (Malay hijab woman),
   *  'secondary' = Malay male hoặc demographic phụ. */
  subjectLockKey?:    'primary' | 'secondary'
  textOverlayBlocks:  TextBlock[]
  decorElements:      DecorElement[]
  /** Tier mà concept lấy ra (chỉ áp cho pain + before-after sections). */
  sourceTier?:        'tier1_primary' | 'tier2_axis' | 'tier3_loose'
}

/** Spec định nghĩa 1 section trong 1 preset. */
export interface SectionSpec {
  type:           SectionType
  /** Số ảnh sinh ra cho section này. */
  imageCount:     number
  recipeId:       RecipeId
  aspectRatio:    '1:1' | '4:5' | '16:9' | '9:16'
  /** Có require sản phẩm xuất hiện trong các imageSlot của section này? */
  productPolicy:  'required' | 'forbidden' | 'optional'
  /** Field nào của section có. */
  textFields:     {
    headline?:    boolean
    subheadline?: boolean
    cta?:         boolean
    offerStrip?:  boolean
    urgencyText?: boolean
    bullets?:     boolean
    faqs?:        boolean
    reviews?:     boolean
    bodyCopy?:    boolean
    comparisonData?: boolean
  }
  /** Rules đặc biệt cho 4-tier semantic gate. */
  tierRules?: {
    /** Phân bố ảnh theo tier. */
    distribution: {
      tier1_primary:  { min: number; max: number }
      tier2_axis:     { min: number; max: number }
      tier3_loose:    { min: number; max: number }
      tier4_offniche: { min: number; max: number }
    }
  }
}

/** Spec đầy đủ của 1 preset. */
export interface PresetSpec {
  id:           LandingForm
  displayName:  string
  totalSections: number
  totalImages:   number
  /** Hint cho text gen về sales psychology của preset. */
  toneBrief:    string
  sections:     SectionSpec[]
}

