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

/** REBUILD Sprint 4 (2026-05-28) — One hook candidate produced by the
 *  brainstormer. The brainstormer now returns N candidates (default 3)
 *  and a seed-based picker chooses 1 of them so the same product
 *  regenerated multiple times yields different openings.
 *  Each candidate uses a DIFFERENT sub-variant of the chosen angle. */
export interface HookCandidate {
  /** Sub-variant id (from hookSubVariants.ts) — e.g. "timed-scene",
   *  "sensory-stack", "mirror-scene". Used for anti-repeat memory + UI
   *  telemetry. */
  subVariant: string
  /** The drafted 2-4 sentence opening. */
  hookDraft: string
  /** Optional one-line description what makes this candidate distinct. */
  flavor?: string
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
  /** REBUILD Sprint 4 (2026-05-28) — All candidate hooks the brainstormer
   *  generated. Default 3. Each candidate uses a DIFFERENT sub-variant.
   *  The picker (pickHookCandidate.ts) selects 1 based on seed + avoid
   *  list. Kept on the brainstorm object so UI/telemetry can show "we
   *  considered N candidates, picked sub-variant X" rather than hiding
   *  the selection. */
  hookCandidates: HookCandidate[]
  /** The chosen hook candidate's sub-variant id (after picker runs).
   *  Sprint 4. Filled by synthesizePackBrainstorm before returning. */
  chosenSubVariant: string
  /** A drafted opening paragraph (2-4 sentences) in the target language.
   *  The storytelling generator is told to use this as a STARTING POINT
   *  for Block 1 (`self-recognition-hook`). It may polish but must not
   *  defang it back into the soft nostalgia pattern.
   *  Sprint 4: this is now the PICKED candidate's hookDraft (not the
   *  first/only one). */
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
  /** REBUILD Sprint 4 (2026-05-28) — Fingerprint hash of the chosen
   *  hookDraft + sub-variant. The caller persists this in localStorage
   *  per product so subsequent regenerations can request a DIFFERENT
   *  candidate (anti-repeat memory). */
  hookFingerprint: string
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
  /** REBUILD Sprint 4 (2026-05-28) — Anti-repeat memory.
   *  Hook fingerprints used by THIS PRODUCT in recent past packs (most
   *  recent first, max 5). Brainstorm tells Gemini to AVOID matching any
   *  of these patterns. Picker also skips candidates whose fingerprint
   *  appears in this list when possible. */
  avoidedHookFingerprints?: string[]
  /** REBUILD Sprint 4 (2026-05-28) — Deterministic seed for candidate
   *  selection. When same product is regenerated 3-5x, this changes per
   *  call (typically wired to LandingGenParams.randomSeed) so the picker
   *  yields a different candidate each time. */
  seed?: number
}

export interface SynthesizePackBrainstormKeys {
  geminiApiKey: string
  kieApiKey: string
}
