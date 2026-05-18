// ─────────────────────────────────────────────────────────────────────────
// Lab Content — Tầng 1: Cố Vấn (Strategic Brief generator).
// Input: sản phẩm + mục tiêu + tone. Output: 5 nỗi đau + 3 góc tiếp cận
// + 7 hook ứng viên + chiến lược + lý do chọn tone — bilingual VI/MY.
// ─────────────────────────────────────────────────────────────────────────

export type Goal = 'awareness' | 'engagement' | 'conversion' | 'retargeting'

export interface GoalOption {
  id: Goal
  label: string         // Vietnamese
  glyph: string         // emoji
  hint: string          // VN one-liner
  /** Sent into the Gemini prompt to shape the brief direction. */
  promptHint: string
}

export type ToneId = 'direct-sharp' | 'expert' | 'friendly' | 'storyteller' | 'hype' | 'custom'

export interface ToneOption {
  id: ToneId
  label: string         // Vietnamese
  glyph: string
  hint: string          // VN one-liner
  /** Sent into Gemini to control voice. */
  promptHint: string
}

// ── Pricing Layer ─────────────────────────────────────────────────────────
// 7 chiến lược giá / neo tâm lý từ skill. AI tự chọn nếu user chọn 'auto',
// hoặc dùng đúng các chiến lược user ưu tiên.

export type PricingStrategy =
  | 'anchoring'        // Price Anchoring — giá gốc → giá sale
  | 'value-stacking'   // Value Stacking — tổng giá trị > giá trả
  | 'cost-inaction'    // Cost of Inaction — không mua = mất X
  | 'daily-cost'       // Daily Cost Breakdown — "16K/ngày"
  | 'decoy'            // Decoy Pricing — 3 gói
  | 'pain-paying'      // Pain of Paying Reduction — trả góp, dùng thử
  | 'perceived-value'  // Perceived Value Inflation — bonus 990K

export interface PricingStrategyOption {
  id: PricingStrategy
  label: string
  glyph: string
  hint: string         // VN one-liner
  promptHint: string   // sent into Gemini
}

export interface PricingInfo {
  /** Có bật pricing layer không. Nếu false → không inject pricing vào prompt. */
  enabled: boolean
  /** Giá bán hiện tại (VNĐ). 0 = chưa nhập. */
  currentPrice: number
  /** Giá gốc / giá so sánh (VNĐ). 0 = không có anchor price. */
  anchorPrice: number
  /** Mô tả ưu đãi cụ thể (text-free). Ví dụ "Mua 2 tặng 1, freeship". */
  offerDescription: string
  /** Bonus tặng kèm (text-free). Ví dụ "Tặng ebook trị giá 990K". */
  bonusDescription: string
  /** Chiến lược ưu tiên — nếu rỗng, AI tự chọn. */
  preferredStrategies: PricingStrategy[]
}

export const DEFAULT_PRICING_INFO: PricingInfo = {
  enabled: false,
  currentPrice: 0,
  anchorPrice: 0,
  offerDescription: '',
  bonusDescription: '',
  preferredStrategies: [],
}

// ── Pain point ────────────────────────────────────────────────────────────
export type PainType = 'money' | 'time' | 'health' | 'relationship' | 'status'

export interface PainPoint {
  id: string
  /** Vietnamese text */
  textVi: string
  /** Malaysian Malay text */
  textMy: string
  /** 1 = nhẹ, 5 = đau nhất */
  intensity: 1 | 2 | 3 | 4 | 5
  type: PainType
}

// ── Content angle ─────────────────────────────────────────────────────────
export type AngleType = 'pain' | 'aspiration' | 'counter-intuitive'

export interface ContentAngle {
  id: string
  type: AngleType
  /** Vietnamese title */
  titleVi: string
  /** Malaysian title */
  titleMy: string
  /** Vietnamese explanation (2-3 sentences) */
  descriptionVi: string
  /** Malaysian explanation */
  descriptionMy: string
  /** Công thức khuyến nghị: PAS, AIDA, BAB, ... (1 trong 14) */
  recommendedFormula: string
  /** 2-3 hiệu ứng tâm lý chính */
  psychology: string[]
  /** 1-2 kỹ thuật NLP copywriting */
  nlpTechniques: string[]
}

// ── Hook candidate ────────────────────────────────────────────────────────
export interface HookCandidate {
  id: string
  /** 1-2 dòng câu hook — Vietnamese */
  textVi: string
  /** Hook — Malaysian Malay */
  textMy: string
  /** Index 1-3 of which angle this hook belongs to. */
  angleIndex: 1 | 2 | 3
  /** Tag of formula used for this hook */
  formulaTag: string
}

// ── Generation params ─────────────────────────────────────────────────────
export interface LabBriefParams {
  productId: string
  goal: Goal
  toneId: ToneId
  /** Free-text tone description when toneId === 'custom'. */
  customToneNote?: string
  /** Optional pricing strategy layer. */
  pricing?: PricingInfo
}

// ── Inline content generation per angle ───────────────────────────────────
// Phase 1.5 — Lab Content now generates caption + script INTERNALLY (no
// hand-off to Ads Content / Script Architect). Results are cached per angle
// so closing+reopening the modal shows the previous output; only the
// "Tạo lại" button forces a fresh generation.

export interface CaptionVariation {
  id: string
  /** 3-6 word English label for this variation's hook angle (badge text). */
  hookLabel: string
  vietnamese: string
  malay: string
}

export interface ScriptVariation {
  id: string
  /** Vietnamese full UGC video script (voice-over, 25-35s). */
  vietnamese: string
  /** Malaysian Malay version. */
  malay: string
  /** Optional short label for the variation's angle/pacing. */
  variantLabel: string
}

export interface CaptionOutput {
  variations: CaptionVariation[]
  generatedAt: number
}

export interface ScriptOutput {
  variations: ScriptVariation[]
  generatedAt: number
}

/** Per-angle cache of generated outputs. Keyed by `ContentAngle.id`. */
export type AngleOutputs = Record<string, {
  caption?: CaptionOutput
  script?: ScriptOutput
}>

// ── Hook Lab ──────────────────────────────────────────────────────────────
// Phase 2 — generates 30 hooks distributed across the 14 copywriting
// formulas. Each hook is tagged with formula + which angle it belongs to
// + 1-2 psychology biases + 1 NLP technique. UI groups by formula.

export interface LabHook {
  id: string
  /** One of the 14 formula tags (PAS, AIDA, BAB, ...). */
  formula: string
  /** Which angle (1/2/3) from the brief this hook belongs to. */
  angleIndex: 1 | 2 | 3
  /** 1-2 psychology biases the hook fires. */
  psychology: string[]
  /** 1 NLP technique used in the hook (optional). */
  nlpTechnique?: string
  /** Vietnamese hook — 1-2 lines. */
  vietnamese: string
  /** Malaysian Malay hook. */
  malay: string
}

export interface HookLabOutput {
  hooks: LabHook[]
  generatedAt: number
}

// ── Funnel Content ─────────────────────────────────────────────────────────
// Phase 3 — full content funnel for one product. Three tiers, three pieces
// each, totaling 9 ready-to-post bilingual captions.
//
//   TOFU = Awareness   — pull strangers in. Storytelling / ACC / AIDA.
//   MOFU = Consideration — convince warm leads. FAB / 4Cs / PPPP / 5W1H.
//   BOFU = Conversion  — close. PAS / SLAP / Hook-Value-CTA / AIDA.

export type FunnelTier = 'tofu' | 'mofu' | 'bofu'

export interface FunnelPiece {
  id: string
  tier: FunnelTier
  /** Formula from the 14: PAS, AIDA, Storytelling, FAB, etc. */
  formula: string
  /** Suggested CTA strength for this piece. */
  ctaStrength: 'soft' | 'balanced' | 'hard'
  /** Vietnamese caption — 100-150 words, ready to post. */
  vietnamese: string
  /** Malaysian Malay caption — same length. */
  malay: string
}

export interface FunnelOutput {
  pieces: FunnelPiece[]   // 9 pieces total (3 per tier)
  generatedAt: number
}

// ── COC Multiplier ────────────────────────────────────────────────────────
// 1 pillar content → N platform-specific micro-content. Implements the
// "COC" (Content Once, Cut-many) formula from the skill: take one pillar
// idea, repurpose into platform-native variants without losing the core
// message.

export type CocFormatId =
  | 'facebook-feed'   // ~120-180 words, mobile-first paragraphs
  | 'instagram'       // ~80-150 words + 5-8 hashtags
  | 'tiktok'          // ~50-80 words, very casual / slang OK
  | 'threads'         // 3-line max, ~200 chars
  | 'zalo-sms'        // 1-2 short sentences, broadcast tone
  | 'email'           // subject + preview line
  | 'instagram-story' // 3 frames text (escalating to CTA)

export interface CocFormatOption {
  id: CocFormatId
  label: string       // Vietnamese
  glyph: string
  hint: string        // VN one-liner
  /** English instruction sent into Gemini to shape this format. */
  formatBrief: string
}

export interface CocMicroContent {
  id: string
  format: CocFormatId
  vietnamese: string
  malay: string
}

export interface CocOutput {
  /** The pillar text used to generate this batch (echoed back for context). */
  pillarText: string
  /** 7 micro-content pieces, one per format. */
  micros: CocMicroContent[]
  generatedAt: number
}

// ── Long-Form Sales Letter ────────────────────────────────────────────────
// 1500-2500 word advertorial / sales letter using AIDA + PPPP + Storytelling
// chain. 14-section blueprint. Output is full-length copy ready for landing
// page / paid native traffic.

export type SalesLetterLength = 1000 | 1500 | 2000 | 2500

export interface SalesLetterSection {
  id: string
  /** Section type identifier — e.g. "hero", "pain", "story", "proof", "offer". */
  sectionType: string
  /** VN section label shown in UI. */
  labelVi: string
  /** Vietnamese section text. */
  vietnamese: string
  /** Malay section text. */
  malay: string
}

export interface SalesLetterOutput {
  /** Target length the user picked. */
  targetLength: SalesLetterLength
  /** 14 sections of the letter, in narrative order. */
  sections: SalesLetterSection[]
  /** Auto-calculated total word count (VI). */
  wordCountVi: number
  /** Auto-calculated total word count (MY). */
  wordCountMy: number
  generatedAt: number
}

// ── Multi-Angle Ad Pack ───────────────────────────────────────────────────
// 5 ready-to-run paid ads, each engineered around a DIFFERENT psychological
// door: Logical, Emotional, Social Proof, Fear/Loss, Aspirational.
// This is the "test pack" that real media buyers run — 5 angles at once,
// let the algo pick the winner.

export type AdAngleType =
  | 'logical'      // data, mechanism, ingredient stats
  | 'emotional'    // storytelling, vulnerability, struggle
  | 'social-proof' // testimonials, "X people use this"
  | 'fear-loss'    // loss aversion, cost of inaction
  | 'aspirational' // future pacing, lifestyle, who you'll become

export interface MultiAngleAd {
  id: string
  angleType: AdAngleType
  /** VN label for the angle (shown on the card). */
  angleLabelVi: string
  /** Vietnamese hook (1-2 lines, opens the ad). */
  hookVi: string
  /** Malay hook. */
  hookMy: string
  /** Vietnamese body (60-100 words). */
  bodyVi: string
  /** Malay body. */
  bodyMy: string
  /** Vietnamese CTA line. */
  ctaVi: string
  /** Malay CTA line. */
  ctaMy: string
  /** Visual direction (Vietnamese) — 1-2 lines describing creative. */
  visualDirectionVi: string
}

export interface MultiAngleOutput {
  ads: MultiAngleAd[]    // 5 ads, one per angle type
  generatedAt: number
}

// ── Carousel Ad Generator ─────────────────────────────────────────────────
// Multi-slide IG / FB carousel ad. User picks structure → AI generates the
// 6-10 slide sequence with per-slide text + visual direction + background.
// Output format mirrors how Canva carousel templates expect content.

export type CarouselStructure =
  | 'problem-solution'  // 6 slides: Hook → Pain 1 → Pain 2 → Reveal → Benefit → CTA
  | 'before-after'      // 8 slides: Scene → Struggle 1 → Struggle 2 → Turning → Result → Proof → Offer → CTA
  | 'mechanism'         // 8 slides: Hook → Why problem → How → Ingredient 1 → Ingredient 2 → Result → Proof → CTA
  | 'listicle-five'     // 7 slides: Hook → 5 numbered ways → Summary CTA

export interface CarouselStructureOption {
  id: CarouselStructure
  label: string
  glyph: string
  slideCount: number
  hint: string
  /** English instruction sent into Gemini to shape the slide sequence. */
  briefEn: string
}

export interface CarouselSlide {
  id: string
  /** 1-based slide number in the carousel sequence. */
  position: number
  /** Vietnamese caption text on this slide (5-15 words). */
  captionVi: string
  /** Malay caption text. */
  captionMy: string
  /** Visual direction (Vietnamese) — 1 line describing image. */
  visualDirectionVi: string
  /** Suggested background color label (vd: "Cream + accent đỏ", "Đen + neon"). */
  backgroundSuggest: string
}

export interface CarouselOutput {
  structure: CarouselStructure
  slides: CarouselSlide[]
  generatedAt: number
}

// ── Output ────────────────────────────────────────────────────────────────
export interface LabBriefResult {
  /** Product link */
  productId: string
  productName: string

  /** Inputs echoed back */
  goal: Goal
  toneId: ToneId
  customToneNote?: string
  /** Pricing layer used at generation time (if enabled). Read by all
   *  downstream generators (caption, script, hook lab, funnel). */
  pricing?: PricingInfo

  /** 5 nỗi đau, đã rank theo intensity desc */
  painPoints: PainPoint[]
  /** Đúng 3 góc tiếp cận: pain / aspiration / counter-intuitive */
  angles: ContentAngle[]
  /** 7 hook ứng viên trải đều 3 góc */
  hooks: HookCandidate[]

  /** Vietnamese 2-3 sentence strategy summary */
  strategySummaryVi: string
  /** Malaysian version */
  strategySummaryMy: string

  /** Why this tone fits this product+goal — Vietnamese */
  toneRationaleVi: string

  /** Cached per-angle caption + script outputs. Empty by default. */
  angleOutputs: AngleOutputs

  /** Cached Hook Lab output (30 hooks across 14 formulas). Optional. */
  hookLabOutput?: HookLabOutput

  /** Cached Funnel Content output (9 pieces across TOFU/MOFU/BOFU). Optional. */
  funnelOutput?: FunnelOutput

  /** Cached COC Multiplier output (1 pillar → 7 micros). Optional. */
  cocOutput?: CocOutput

  /** Cached Long-Form Sales Letter output. Optional. */
  salesLetterOutput?: SalesLetterOutput

  /** Cached Multi-Angle Ad Pack output (5 ads, 5 angles). Optional. */
  multiAngleOutput?: MultiAngleOutput

  /** Cached Carousel Ad output. Optional. */
  carouselOutput?: CarouselOutput

  generatedAt: number
}

// ── Saved item (persisted in localStorage) ────────────────────────────────
export interface SavedLabBrief extends LabBriefResult {
  id: string
  /** Friendly user-set title; defaults to "${productName} — ${goalLabel}". */
  title: string
  createdAt: number
}
