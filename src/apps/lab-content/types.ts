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

  generatedAt: number
}

// ── Saved item (persisted in localStorage) ────────────────────────────────
export interface SavedLabBrief extends LabBriefResult {
  id: string
  /** Friendly user-set title; defaults to "${productName} — ${goalLabel}". */
  title: string
  createdAt: number
}

// ── Inter-app handoff payload (sent to Ads Content / Script Architect) ────
export interface LabBriefHandoff {
  productId: string
  goal: Goal
  toneId: ToneId
  /** The picked angle the user wants to write from. */
  angle: ContentAngle
  /** Optional: a specific hook the user pre-selected. */
  hook?: HookCandidate
}
