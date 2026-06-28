// ── Tone modifiers — multi-select toggle chips ───────────────────────────
export type ToneModifier =
  | 'hard-sell'
  | 'soft-sell'
  | 'emotional'
  | 'scientific'
  | 'funny'
  | 'luxury'
  | 'aggressive-hook'
  | 'female-audience'
  | 'male-audience'
  | 'older-audience'
  | 'young-tiktok'

export interface ToneOption {
  id: ToneModifier
  label: string
  /** Sent verbatim into the Gemini prompt. */
  promptHint: string
}

export type HookStrength = 'safe' | 'balanced' | 'aggressive'
export type LengthSeconds = 15 | 30 | 45 | 60

// ── Rich Vietnamese tooltip content for each preset ─────────────────────
export interface PresetDetailVi {
  /** Cơ chế — 1-2 câu mô tả cách công thức này hoạt động. */
  mechanism: string
  /** Mục tiêu — short bullet list of marketing goals. */
  goals: string[]
  /** Phù hợp — short bullet list of when to use this preset. */
  useCase: string[]
  /** Ví dụ — one example hook line (English or Vietnamese, in quotes). */
  example: string
}

// ── Script preset (framework, not random AI style) ──────────────────────
export interface ScriptPreset {
  id: string
  /** Vietnamese label shown in the UI. */
  label: string
  /** Vietnamese one-line hint shown under the label on the card. */
  hint: string
  /** Visual glyph (emoji or symbol). */
  glyph: string
  category: 'classic' | 'educational'
  /** All five fields below are sent verbatim into the Gemini prompt — they
   *  define HOW the script should sound, not just the wording. */
  hookFormula: string
  pacingNote: string
  emotionalAngle: string
  ctaStyle: string
  proofStyle: string
  /** Rich Vietnamese explanation rendered in the hover tooltip / mobile modal. */
  detailVi: PresetDetailVi
}

// ── Structured internal output (future-ready for storyboard mapping) ────
export interface ScriptStructured {
  hook: string
  pain: string
  /** Only populated when educationalMode is ON. */
  whyItHappens?: string
  /** Only populated when educationalMode is ON. */
  ingredientMechanism?: string
  solution: string
  benefits: string
  proof: string
  cta: string
  emotionalTone: string
  pacing: string
  audienceAngle: string
}

export interface ScriptGenerationParams {
  productId: string
  presetId: string
  lengthSec: LengthSeconds
  hookStrength: HookStrength
  toneModifiers: ToneModifier[]
  educationalMode: boolean
}

// ── Phase B — scene/shot planning (kịch bản → bảng "shot ↔ clip") ────────
// A "shot" is a VISUAL BEAT, not a sentence: one coherent on-screen idea long
// enough to be a watchable clip. Several short sentences describing the same
// thing merge into one shot; a long sentence with two ideas can split into two.
export type ScriptLanguage = 'vi' | 'my'

/** COD sell-arc blocks — used as the natural visual-beat boundaries. */
export type ShotBlock =
  | 'van-de' | 'noi-dau' | 'san-pham' | 'loi-ich-sp'
  | 'thanh-phan' | 'co-che' | 'loi-ich-kh' | 'proof' | 'cta'

/** How a shot gets its footage. `ai-render` is reserved for the CTA shot only. */
export type ShotFill = 'source-broad' | 'source-product' | 'ai-render'
/** Strictness when querying Source Finder (ignored when fill = ai-render). */
export type ShotMatchMode = 'broad' | 'product-exact'

/** A source clip returned by /api/tikhub-search (Douyin / RED / Kuaishou). */
export interface SourceClip {
  id: string
  videoUrl: string
  cover: string
  desc: string
  author: string
  likes: number
  durationSec: number
  shareUrl: string
  platform: string
}

export interface Shot {
  id: string
  /** Malay voice line — the MAIN line (MY is the primary market). */
  my: string
  /** Vietnamese gloss — rendered under the MY line as a readable sub. */
  vi: string
  block: ShotBlock
  /** WHAT to show on screen — drives the source query / render brief.
   *  NEVER the literal voice text (querying raw dialogue returns junk clips). */
  visualIdea: string
  /** Chinese search keyword for Douyin/RED/Kuaishou (the 3 source platforms are
   *  Chinese — querying in Chinese returns far better clips). Derived from
   *  visualIdea, NOT the voice line. source-broad = situation/emotion only (no
   *  product/brand); source-product = product category in Chinese. Empty for
   *  ai-render (the CTA shot is generated, not sourced). Feeds Source Finder. */
  zhQuery: string
  /** Estimated spoken duration of this shot, seconds (from primary-lang words). */
  durationSec: number
  fill: ShotFill
  matchMode: ShotMatchMode
  /** Operator-picked source clip for this shot (source-* fills only). The CTA
   *  (ai-render) shot is generated in B4, not sourced, so it stays null. */
  clip?: SourceClip | null
}

export interface ShotPlan {
  /** Which language was primary (main line) when the plan was built. */
  language: ScriptLanguage
  shots: Shot[]
  /** Sum of all shot durations, seconds. */
  totalDurationSec: number
}

export interface ScriptGenerationResult {
  /** Master Vietnamese voice-over script — left box in the UI. */
  vietnamese: string
  /** Translated Malaysian Malay version — right box in the UI. */
  malay: string
  /** Optional — parsed from <<<STRUCTURED>>>; null if Gemini didn't return valid JSON. */
  structured: ScriptStructured | null
  /** Echoed back so the UI can render badges + the save flow can store metadata. */
  presetId: string
  presetLabel: string
  lengthSec: LengthSeconds
  hookStrength: HookStrength
  toneModifiers: ToneModifier[]
  educationalMode: boolean
}
