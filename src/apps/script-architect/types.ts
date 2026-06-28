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

/** How a shot gets its footage. `ai-render` is reserved for the CTA shot only.
 *   - source-broad     : situation/symptom b-roll (search by short ZH symptom terms).
 *   - source-product   : footage of THE exact product — resolved via 1688 reverse-image
 *                        lock (ShotPlan.productZh), NOT a generic category guess.
 *   - source-ingredient: one beat that names several ingredients — search each ZH
 *                        ingredient term separately and merge (avoids the combined
 *                        query collapsing to the dominant term).
 *   - ai-render        : the CTA shot only (generated, not sourced). */
export type ShotFill = 'source-broad' | 'source-product' | 'source-ingredient' | 'ai-render'
/** Strictness when querying Source Finder (ignored when fill = ai-render). */
export type ShotMatchMode = 'broad' | 'product-exact'

/** A product locked from a 1688 reverse-image search. The REAL Chinese title is the
 *  only query that returns footage of THE exact product (a generic category keyword
 *  drifts to random same-category items). Locked once at the plan level and reused by
 *  every source-product shot. */
export interface ProductLock1688 {
  itemId: string
  /** Real Chinese 1688 title — used verbatim as the product-shot search query. */
  name: string
  /** Vietnamese translation of the title (display only). */
  nameVi?: string
  /** 1688 thumbnail (display only). */
  image?: string
}

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

/** An operator-attached source clip on a shot. Wraps a raw SourceClip with the
 *  per-shot editing metadata the export needs:
 *   - role: which clip leads this beat ('main') vs alternates also shipped ('backup').
 *   - inSec/outSec: the cut window the operator actually wants (the 4-5s out of a
 *     40-50s spy clip). EXPORTED AS A HINT ONLY — the full clip still ships so the
 *     operator fine-trims in CapCut (decision: Hướng A, no server-side cutting).
 *   - needsReplace: operator flagged this as a rough/"pick đại" choice to revisit. */
export interface ShotClip extends SourceClip {
  role: 'main' | 'backup'
  /** Cut-in point, seconds. undefined = from the clip start (0). */
  inSec?: number
  /** Cut-out point, seconds. undefined = inSec + the shot's duration (computed at export). */
  outSec?: number
  /** True = operator picked it only roughly; still needs a better clip. */
  needsReplace?: boolean
}

/** B4 — AI-rendered CTA assets (only the ai-render / CTA shot uses this). */
export interface CtaRender {
  /** Offer / milestone text baked into the frame (e.g. "Beli 2 Percuma 1"). NO price. */
  offer: string
  /** gpt-4o-image result URL (KIE CDN) — the still closing frame. */
  imageUrl?: string
  /** Seedance i2v result URL (KIE CDN) — the animated clip. */
  videoUrl?: string
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
  /** Chinese search keywords for Douyin/RED/Kuaishou (the 3 source platforms are
   *  Chinese — querying in Chinese returns far better clips). Reasoned from the
   *  product's PROBLEM DOMAIN, NOT a literal transliteration of the voice line:
   *   - source-broad     : 2-3 SHORT symptom/situation terms (e.g. 耳朵痒 / 耳朵痛
   *                        / 耳鸣 — never a whole-sentence phrase).
   *   - source-ingredient: one term per ingredient named in the beat (each searched
   *                        separately, then merged).
   *   - source-product   : empty — product shots search by ShotPlan.productZh.name
   *                        (the real 1688 title), resolved via image lock.
   *   - ai-render        : empty (the CTA shot is generated, not sourced).
   *  Each term feeds Source Finder as its own query; the operator can edit the list
   *  (remove chips, or type Vietnamese → translate to a short ZH term). */
  zhTerms: string[]
  /** Estimated spoken duration of this shot, seconds (from primary-lang words). */
  durationSec: number
  fill: ShotFill
  matchMode: ShotMatchMode
  /** Operator-picked source clips for this shot (source-* fills only). Multiple
   *  allowed — one scene can carry 2-3 b-roll options that ALL ship to CapCut so
   *  the operator cuts by hand ("bung cả"). The CTA (ai-render) shot is generated
   *  in B4, not sourced, so it stays empty. */
  clips?: ShotClip[]
  /** AI-rendered CTA assets (ai-render shot only; B4). null for source shots. */
  ctaRender?: CtaRender | null
}

export interface ShotPlan {
  /** Which language was primary (main line) when the plan was built. */
  language: ScriptLanguage
  shots: Shot[]
  /** Sum of all shot durations, seconds. */
  totalDurationSec: number
  /** The product locked from a 1688 reverse-image search. Set once by the operator
   *  (picks the correct match), reused by every source-product shot so they search
   *  THE exact product instead of a generic category guess. null = not locked yet. */
  productZh?: ProductLock1688 | null
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
