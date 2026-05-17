// ── Ad Anatomy types — Phase Z1+Z2 (Creative Director upgrade) ──────────────
// Phase Z1: actionable scoring + decision layer + angle + market awareness +
//           funnel position + scaling potential
// Phase Z2: retention heatmap timeline
// Backward-compat: every new field is optional so old cached analyses still
// parse. Cache version bump in AdAnatomy.tsx forces fresh re-analyze for
// users who want the new sections.

/**
 * Per-score detail. Z1: numbers now have fractional precision + WHY + HOW.
 * The plain `score: number` shape is kept; new fields are optional so older
 * cached analyses still hydrate.
 */
export interface ScoreItem {
  label: string
  /** Z1 upgrade: 0.0-10.0 with 1 decimal. Old data was integers — both work. */
  score: number
  /** Z1: short Vietnamese explanation — why this score? */
  reason?: string
  /** Z1: concrete actionable advice — how to improve this dimension. */
  howToImprove?: string
}

export interface Scorecard {
  scores: ScoreItem[]
  analystNote: string
}

export interface TranscriptLine {
  timestamp: string
  text: string
}

export interface HookBreakdown {
  hookText: string
  technique: string
  whyItWorks: string
  adaptableTemplate: string
}

export interface StructureBeat {
  timestamp: string
  beat: string
  description: string
  duration: string
}

export interface StructureMap {
  runtime: string
  pacing: string
  beats: StructureBeat[]
}

export interface PsychologyPersuasion {
  primaryLevers: string[]
  targetingSignals: string[]
}

export interface VisualFrame {
  timestamp: string
  description: string
  prompt: string
}

export interface Improvement {
  weakness: string
  fix: string
}

// ── Z1 — Decision Layer & Ad Intelligence ──────────────────────────────────

/** Ad angle = the dominant persuasion lens the creative uses. */
export type AdAngleType =
  | 'scientific-authority'
  | 'problem-solution'
  | 'natural-healing'
  | 'social-proof'
  | 'transformation'
  | 'comparison'
  | 'testimonial'
  | 'curiosity-loop'
  | 'fear-loss'
  | 'lifestyle-aspiration'

export interface AdAngle {
  primary: AdAngleType
  /** Optional secondary + tertiary supporting angles */
  secondary?: AdAngleType
  supporting?: AdAngleType
  /** VN rationale: 1-2 sentences explaining the call. */
  rationale: string
}

/** Eugene Schwartz awareness ladder. */
export type MarketAwareness =
  | 'unaware'
  | 'problem-aware'
  | 'solution-aware'
  | 'product-aware'
  | 'most-aware'

export interface MarketAwarenessReport {
  level: MarketAwareness
  /** VN explanation of how the ad targets that level. */
  rationale: string
  /** VN recommendation if the targeting is off (e.g. "focus on education + mechanism proof"). */
  recommendation: string
}

/** Where in the funnel this creative best fits. */
export interface FunnelPosition {
  bestFor: 'TOF-cold' | 'MOF-warm' | 'BOF-retarget'
  weakFor: Array<'TOF-cold' | 'MOF-warm' | 'BOF-retarget'>
  /** VN reasoning. */
  reasoning: string
}

/** Scaling potential — used by media buyers to prioritize budget. */
export interface ScalingPotential {
  /** HIGH | MEDIUM | LOW. */
  tier: 'HIGH' | 'MEDIUM' | 'LOW'
  /** 0-10 numeric for sorting / UI bar fill. */
  score: number
  /** VN reasons why it scales well. */
  scalingFactors: string[]
  /** VN blockers / risks against scaling. */
  blockers: string[]
}

/** Decision Layer — Creative Director verdict + concrete test recommendations. */
export interface DecisionLayer {
  /** Top-line verdict for media buyers. */
  verdict: 'SCALE' | 'TEST_MORE' | 'ITERATE' | 'KILL'
  /** VN one-liner — what to do right now. */
  scaleAction: string
  /** VN list of test variants to PRIORITIZE. */
  recommendedTests: string[]
  /** VN list of test variants to NOT run (avoid wasting budget). */
  doNotTest: string[]
  /** Top 3 fixes ranked by impact (overlaps with `improvements` but ordered). */
  fixPriority: Array<{
    rank: number
    /** VN short title of the fix. */
    title: string
    /** VN: estimated impact ("CTR +15%", "Retention +20%", "Trust score boost"). */
    expectedImpact: string
  }>
}

// ── Z2 — Retention Heatmap ─────────────────────────────────────────────────

export type RetentionRisk = 'HIGH' | 'MEDIUM' | 'LOW'

export interface RetentionSegment {
  /** Timestamp range, e.g. "0:00-0:03". */
  timestamp: string
  /** 0-100 estimated retention level. */
  retentionScore: number
  /** Drop risk colour — LOW (green) / MEDIUM (yellow) / HIGH (red). */
  risk: RetentionRisk
  /** VN short note about this segment ("Pattern interrupt strong", "Pacing slow", "CTA fatigue"). */
  note: string
}

export interface RetentionTimeline {
  /** Per-segment heatmap data — 5-10 segments covering the runtime. */
  segments: RetentionSegment[]
  /** VN overall pacing diagnosis ("Hỗn hợp đầu nhanh — giữa chậm — cuối ổn"). */
  overallDiagnosis: string
  /** VN list of the riskiest timestamps to fix first. */
  criticalDrops: string[]
}

// ── Top-level AnalysisResult ───────────────────────────────────────────────

export interface AnalysisResult {
  scorecard: Scorecard
  transcript: TranscriptLine[]
  hookBreakdown: HookBreakdown
  structureMap: StructureMap
  psychology: PsychologyPersuasion
  visualPlaybook: VisualFrame[]
  improvements: Improvement[]
  reconstructionPrompt: string

  // ── Z1 + Z2 (all optional for back-compat with v1 cached analyses) ────────
  decisionLayer?: DecisionLayer
  adAngle?: AdAngle
  marketAwareness?: MarketAwarenessReport
  funnelPosition?: FunnelPosition
  scalingPotential?: ScalingPotential
  retentionTimeline?: RetentionTimeline

  // ── Z4 — Variation Engine (lazy, second Gemini call) ────────────────────
  variations?: Variation[]
}

// ── Z4 — Variation Engine types ────────────────────────────────────────────

/** Tone archetypes for generated variants. */
export type VariationType =
  | 'softer'         // gentler, less aggressive — broader audience
  | 'aggressive'     // urgent, direct, high-pressure CTA
  | 'luxury'         // premium tone, aspirational, exclusivity
  | 'scientific'     // clinical, data-driven, authority-heavy
  | 'emotional'      // story-driven, vulnerability-led, empathy
  | 'testimonial'    // first-person customer-voice angle
  | 'feminine'       // warm, supportive, community-leaning
  | 'masculine'      // results-focused, performance-leaning

export interface Variation {
  /** Unique id — used for per-card actions */
  id: string
  /** One of 8 enum archetypes */
  type: VariationType
  /** VN display name */
  nameVi: string
  /** New hook line for this variant (1 sentence) */
  hookText: string
  /** Full ~30s script for this variant (paste-ready transcript) */
  scriptText: string
  /** Primary CTA line for this variant */
  ctaText: string
  /** VN: 1-2 sentences explaining the tone choice */
  toneBreakdown: string
  /** VN: who / where to run this variant (audience + funnel hint) */
  recommendedFor: string
}

export const VARIATION_LABEL_VI: Record<VariationType, string> = {
  'softer':      '🌸 Nhẹ nhàng hơn',
  'aggressive':  '🔥 Mạnh + urgent',
  'luxury':      '💎 Premium / Luxury',
  'scientific':  '🔬 Khoa học / Lâm sàng',
  'emotional':   '💗 Cảm xúc / Câu chuyện',
  'testimonial': '🗣 Lời chứng thực',
  'feminine':    '🌷 Tone nữ tính',
  'masculine':   '💪 Tone mạnh mẽ',
}

export const VARIATION_ACCENT: Record<VariationType, string> = {
  'softer':      'border-pink-200 bg-pink-50/40',
  'aggressive':  'border-red-200 bg-red-50/40',
  'luxury':      'border-amber-200 bg-amber-50/40',
  'scientific':  'border-cyan-200 bg-cyan-50/40',
  'emotional':   'border-rose-200 bg-rose-50/40',
  'testimonial': 'border-emerald-200 bg-emerald-50/40',
  'feminine':    'border-fuchsia-200 bg-fuchsia-50/40',
  'masculine':   'border-slate-200 bg-slate-50/40',
}

// ── Vietnamese label maps for UI ───────────────────────────────────────────

export const AD_ANGLE_LABEL_VI: Record<AdAngleType, string> = {
  'scientific-authority':  'Khoa học / Chuyên gia',
  'problem-solution':      'Vấn đề → Giải pháp',
  'natural-healing':       'Chữa lành tự nhiên',
  'social-proof':          'Bằng chứng xã hội',
  'transformation':        'Before / After',
  'comparison':            'So sánh đối thủ',
  'testimonial':           'Lời chứng thực',
  'curiosity-loop':        'Vòng lặp tò mò',
  'fear-loss':             'Sợ mất mát',
  'lifestyle-aspiration':  'Khát vọng lifestyle',
}

export const MARKET_AWARENESS_LABEL_VI: Record<MarketAwareness, string> = {
  'unaware':         'Chưa nhận thức',
  'problem-aware':   'Biết vấn đề',
  'solution-aware':  'Biết giải pháp',
  'product-aware':   'Biết sản phẩm',
  'most-aware':      'Sẵn sàng mua',
}

export const FUNNEL_LABEL_VI: Record<'TOF-cold' | 'MOF-warm' | 'BOF-retarget', string> = {
  'TOF-cold':     'TOF · Cold traffic',
  'MOF-warm':     'MOF · Warm audience',
  'BOF-retarget': 'BOF · Retargeting',
}

export const VERDICT_LABEL_VI: Record<DecisionLayer['verdict'], string> = {
  'SCALE':     '🚀 SCALE — Đẩy budget ngay',
  'TEST_MORE': '🧪 TEST — Cần test thêm trước scale',
  'ITERATE':   '🔧 ITERATE — Cần sửa rồi mới scale',
  'KILL':      '⛔ KILL — Bỏ creative này',
}

export const RETENTION_RISK_COLOR: Record<RetentionRisk, string> = {
  'LOW':    'bg-emerald-500',
  'MEDIUM': 'bg-amber-500',
  'HIGH':   'bg-red-500',
}

export const RETENTION_RISK_LABEL_VI: Record<RetentionRisk, string> = {
  'LOW':    'Giữ chân tốt',
  'MEDIUM': 'Nguy cơ drop trung bình',
  'HIGH':   'Drop cao — cần sửa',
}

// ── Z7 — Inline Creative Pipeline (script generation from ad analysis) ─────
// Every "Tạo …" button now opens an inline modal and renders output below
// the calling module. No more cross-app redirects for the generation step.
// Sending the FINAL script to Avatar/Voice/UGC apps is still a redirect since
// that is the user's explicit intent.

export type ScriptGenLanguage = 'ms' | 'vi' | 'en'

export type ScriptGenTone =
  | 'original'      // giống ads gốc
  | 'emotional'
  | 'hard-sell'
  | 'testimonial'
  | 'soft-sell'
  | 'scientific'

export const SCRIPT_TONE_LABEL_VI: Record<ScriptGenTone, string> = {
  'original':    'Giống ads gốc',
  'emotional':   'Emotional',
  'hard-sell':   'Hard sell',
  'testimonial': 'Testimonial',
  'soft-sell':   'Soft sell',
  'scientific':  'Scientific',
}

export const SCRIPT_LANG_LABEL: Record<ScriptGenLanguage, { label: string; flag: string }> = {
  'ms': { label: 'MY · Bahasa Melayu', flag: '🇲🇾' },
  'vi': { label: 'VN · Tiếng Việt',    flag: '🇻🇳' },
  'en': { label: 'GB · English',       flag: '🇬🇧' },
}

/** What kind of asset the modal is generating — controls the prompt + output shape. */
export type PipelineMode =
  | 'script-similar'     // 1-Click: tạo script tương tự
  | 'hook-variants'      // 1-Click: tạo hook variants
  | 'cta-variants'       // 1-Click: tạo CTA variants
  | 'storyboard'         // 1-Click: tạo storyboard text
  | 'landing-page'       // 1-Click: tạo landing page outline
  | 'product-scenes'     // 1-Click: tạo product AI scene briefs
  | 'variation-script'   // Variation card: dùng cho sản phẩm
  | 'transcript-similar' // Transcript section: tạo kịch bản tương tự

export const PIPELINE_MODE_LABEL_VI: Record<PipelineMode, string> = {
  'script-similar':     'Script tương tự',
  'hook-variants':      'Hook variants',
  'cta-variants':       'CTA variants',
  'storyboard':         'Storyboard',
  'landing-page':       'Landing page outline',
  'product-scenes':     'Product AI scenes',
  'variation-script':   'Script từ variation',
  'transcript-similar': 'Script từ lời thoại',
}

export interface ScriptGenParams {
  mode: PipelineMode
  productId: string
  language: ScriptGenLanguage
  tone: ScriptGenTone
  /** Text dump fed to Gemini — transcript, hook, reconstruction, etc. */
  sourceContext: string
  /** Original ad filename — saved in metadata header. */
  sourceFileName?: string
}

export interface GeneratedScript {
  id: string
  mode: PipelineMode
  language: ScriptGenLanguage
  tone: ScriptGenTone
  productId: string
  productName: string
  sourceFileName?: string
  /** Hook line (always present for script modes; may be the variant for hook-variants mode) */
  hook?: string
  /** Body / main script content. For non-script modes (storyboard/landing/scenes) this holds the main asset text. */
  body?: string
  cta?: string
  sceneSuggestion?: string
  brollSuggestion?: string
  emotionNote?: string
  voiceTone?: string
  /** Vietnamese translation — collapse-hidden by default in UI. */
  viTranslation?: string
  /** Fallback raw text if structured JSON parse failed. */
  rawText?: string
  generatedAt: number
}

