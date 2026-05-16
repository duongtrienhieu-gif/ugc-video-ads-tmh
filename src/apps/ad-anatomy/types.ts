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
