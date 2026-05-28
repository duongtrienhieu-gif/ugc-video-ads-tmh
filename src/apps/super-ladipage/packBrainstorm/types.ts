// ─────────────────────────────────────────────────────────────────────
// Pack Brainstorm — types (REBUILD Sprint 1, 2026-05-28)
//
// Pre-write reasoning layer. Runs ONE Gemini call AFTER productSynthesis
// + commercialPsychology and BEFORE the main storytelling generator.
//
// Purpose: force the engine to READ the input THOROUGHLY first, decide
// the angle (pain-immediate-scene vs social-shame vs future-fear vs
// wasted-effort), and produce a HOOK BASELINE + AGITATE BEATS that the
// downstream storytelling Gemini call must anchor to.
//
// Without this stage the engine kept falling into the "soft diary
// nostalgia recall" pattern for every niche — a respiratory cough pack
// would open with "bạn còn nhớ cảm giác thức dậy không nặng đầu" which
// is fatigue-niche vocab, NOT respiratory.
// ─────────────────────────────────────────────────────────────────────

import type { LandingLanguage, NicheKey } from '../storytelling/types'

/** One pain entry on the ladder — ordered intensity 1 = sharpest. */
export interface PainLadderEntry {
  rank: 1 | 2 | 3 | 4 | 5
  /** Concrete-and-felt description in the target language.
   *  Must reference specifics the buyer would recognize, not category labels. */
  pain: string
  /** What kind of "loss" this pain represents — informs which psychological
   *  lever the hook + agitate beats should pull. */
  lossType: 'sleep' | 'health' | 'time' | 'money' | 'pride' | 'social' | 'future'
}

/** Four hook angle archetypes the brainstormer can choose from. Each one
 *  has a different opening pattern that the storytelling generator must
 *  honor for Block 1 + Block 2. */
export type HookAngle =
  /** A vivid concrete scene at a specific moment (e.g. "3 giờ sáng. Bạn
   *  lại ngồi dậy..."). Best for sharp acute pains the reader experiences
   *  on a predictable schedule. */
  | 'pain-immediate-scene'
  /** Identity / shame hook — names a social-context micro-humiliation the
   *  reader hides. Best when the niche has a "I don't want anyone to see"
   *  layer (bad breath, hair loss, weight). */
  | 'social-shame'
  /** Negative future pacing — "5 năm nữa nếu không xử lý...". Best for
   *  conditions that compound (joint, respiratory, financial debt). */
  | 'future-fear'
  /** Wasted-effort hook — opens with the cost (money / time) the reader
   *  already burned trying to fix this. Best when the failed-attempts
   *  pool is rich (supplements, beauty, fat loss). */
  | 'wasted-effort'
  /** Recognition / nostalgia — the soft current-default opening. Kept as
   *  a fallback for genuinely-soft niches (beauty, lifestyle, premium). */
  | 'soft-recognition'

export interface SocialProofPersonaSeed {
  /** First-name + age + 1-word condition tag. Storytelling generator may
   *  reuse or replace. e.g. "Cô Kiah, 48, dị ứng thời tiết". */
  label: string
  /** One-sentence story angle in target language. */
  angle: string
}

/** Final brainstorm output passed into the storytelling system prompt. */
export interface PackBrainstorm {
  /** Pain ladder sorted by intensity, max 5. Hook + agitate beats draw
   *  from this — order matters. */
  painLadder: PainLadderEntry[]
  /** The chosen angle for THIS pack. Picked from `chosenAngleCandidates`. */
  chosenAngle: HookAngle
  /** Alternative angles considered — kept for telemetry only. */
  chosenAngleCandidates: HookAngle[]
  /** A drafted opening paragraph (2-4 sentences) in the target language.
   *  The storytelling generator is told to use this as a STARTING POINT
   *  for Block 1 (`self-recognition-hook`). It may polish but must not
   *  defang it back into the soft nostalgia pattern. */
  hookDraft: string
  /** Sequence of 3-5 short beats the agitation phase must hit. e.g.
   *  ["stack symptoms", "negative future 5 năm", "money already spent"]. */
  agitateBeats: string[]
  /** 3 candidate personas matched to this niche + product paradigm.
   *  Social-proof block will be seeded from these. */
  socialProofPersonas: SocialProofPersonaSeed[]
  /** Short rationale for why this angle was chosen — debug only. */
  rationale: string
  /** Pipeline source — 'gemini' = real synthesis, 'fallback' = static
   *  niche default when Gemini failed / no API key. */
  source: 'gemini' | 'fallback'
}

export interface SynthesizePackBrainstormInput {
  productName: string
  niche: NicheKey
  /** From productSynthesis — the deep product reality. */
  productEssence: string
  readerSpecificSymptoms: string[]
  realisticFailedAttempts: string[]
  usageScene: string
  /** From commercialPsychology (optional — may be absent if CP-SYNTH failed). */
  primaryDesire?: string
  desireTensions?: string[]
  topObjections?: Array<{ objection: string; counterPosture: string }>
  /** Raw input fields — let Gemini scrape numbers + specifics directly. */
  rawPainPoints: string
  rawBenefits: string
  rawUsp: string
  rawPricing: string
  /** Output language for the drafted hook + persona labels. */
  targetLanguage: LandingLanguage
}

export interface SynthesizePackBrainstormKeys {
  geminiApiKey: string
  kieApiKey: string
}
