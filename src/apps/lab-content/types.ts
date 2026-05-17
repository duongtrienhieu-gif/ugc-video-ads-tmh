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

// ── Output ────────────────────────────────────────────────────────────────
export interface LabBriefResult {
  /** Product link */
  productId: string
  productName: string

  /** Inputs echoed back */
  goal: Goal
  toneId: ToneId
  customToneNote?: string

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

  generatedAt: number
}

// ── Saved item (persisted in localStorage) ────────────────────────────────
export interface SavedLabBrief extends LabBriefResult {
  id: string
  /** Friendly user-set title; defaults to "${productName} — ${goalLabel}". */
  title: string
  createdAt: number
}
