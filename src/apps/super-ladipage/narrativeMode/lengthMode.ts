// ─────────────────────────────────────────────────────────────────────
// Length Mode — adaptive pack length driven by product paradigm
//
// 2026-05-29 — Decoupled from narrative mode. Narrative mode answers
// "what tone" (pain-driven-DR / aspiration-led / recognition-soft);
// Length mode answers "how long" (short / medium / long).
//
// Real conversion data: SEA impulse COD products (RM30-100) convert
// best at 600-1,200 word landing pages with 90s mobile scroll. Considered
// purchase (RM100-300) at 1,200-2,000 words. High-ticket (RM300+) tolerates
// 2,000-3,000+ words of recognition arc. Engine was previously running
// LONG mode for every product → 2,800-word output on a RM59 dental
// product → mobile fatigue + scroll-past → conversion drop.
//
// Mode mapping (from productClass.pacingProfile):
//   fast-cod          → SHORT  (impulse, ~700 words target)
//   medium-narrative  → MEDIUM (considered, ~1,400 words target)
//   slow-burn         → LONG   (high-ticket, ~2,400 words target)
//
// What changes per mode:
//   - Block plan: SHORT trims 2 additional non-critical blocks
//   - Word cap per block: 60-100 / 100-140 / 140-180
//   - Cadence rules: SHORT enforces 1-2 sentence paragraphs + short sentences
//
// What stays the same across modes:
//   - Mode-conditional voice (pain/aspiration/soft)
//   - Brainstorm anchor + agitate beats
//   - Cost rule (Sprint 5 E2)
//   - PI layer
//   - Data tables (niche pools, vocab, archetypes)
//   - All validators
// ─────────────────────────────────────────────────────────────────────

import type { BlockId } from '../storytelling/types'
import type { PacingProfile } from '../productClass/types'

export type LengthMode = 'short' | 'medium' | 'long'

/** Map productClass.pacingProfile → LengthMode. 1:1 today, but kept as a
 *  function so the mapping can be refined (e.g. tweak based on price or
 *  buyer demographic) without touching call sites. */
export function detectLengthMode(pacingProfile: PacingProfile): LengthMode {
  switch (pacingProfile) {
    case 'fast-cod':         return 'short'
    case 'medium-narrative': return 'medium'
    case 'slow-burn':        return 'long'
  }
}

// ─── Block skip rules (additional to narrative-mode skips) ────────────
//
// Critical blocks (NEVER skipped regardless of length):
//   - self-recognition-hook (Block 1 anchor)
//   - daily-micro-friction (concrete symptom)
//   - narrator-validation-entry (empathy "tôi cũng từng")
//   - shared-failed-attempts (cost rule — the touchpoint user values most)
//   - natural-product-discovery (product reveal)
//   - why-this-felt-different (mechanism tease)
//   - micro-transformation (proof of after-state)
//   - future-self-cta (close)
//
// Nice-to-have blocks (skipped in SHORT mode):
//   - hidden-emotional-truth (its content merges into self-recognition-hook)
//   - soft-mechanism-compare (proof block does this implicitly)
//   - skepticism-alignment (optional — already gated by niche)

const LENGTH_BLOCK_SKIP: Record<LengthMode, ReadonlySet<BlockId>> = {
  short: new Set<BlockId>([
    'hidden-emotional-truth',
    'soft-mechanism-compare',
    'skepticism-alignment',
  ]),
  medium: new Set<BlockId>(),
  long: new Set<BlockId>(),
}

export function isBlockSkippedForLength(blockId: BlockId, lengthMode: LengthMode): boolean {
  return LENGTH_BLOCK_SKIP[lengthMode].has(blockId)
}

export function getSkippedBlocksForLength(lengthMode: LengthMode): BlockId[] {
  return Array.from(LENGTH_BLOCK_SKIP[lengthMode])
}

// ─── Per-mode word cap + cadence rules (used by prompt builders) ───────

export interface LengthModeSpec {
  /** Target words per storytelling block. */
  wordCapMin: number
  wordCapMax: number
  /** Target paragraphs per block. SHORT prefers more, shorter paragraphs. */
  paragraphMin: number
  paragraphMax: number
  /** Max sentences per paragraph. Mobile-friendly when low. */
  sentencesPerParagraphMax: number
  /** Soft cap on words per sentence. */
  wordsPerSentenceMax: number
  /** Expected total pack word count (story blocks only, PI layer adds on top). */
  expectedPackWords: number
  /** 1-line label for telemetry / logs. */
  label: string
}

// 2026-05-29 (re-cal) — First production run came back at 358 words for
// an 11-block SHORT pack (target was 700). Gemini severely under-produced
// — when given "60-100 words / block" it read the lower bound as a free
// pass to write 30 words/block. User feedback: 1,200-1,500 is the sweet
// spot for impulse COD on FB/TikTok ads. Re-calibrated:
//   - Word caps raised across all modes (Gemini under-produces ~30-50%)
//   - MIN treated as a HARD FLOOR not a suggestion (enforced in prompt)
//   - SHORT target expectedPackWords: 700 → 1,400 to match user benchmark
export const LENGTH_MODE_SPEC: Record<LengthMode, LengthModeSpec> = {
  short: {
    wordCapMin: 130,
    wordCapMax: 170,
    paragraphMin: 3,
    paragraphMax: 5,
    sentencesPerParagraphMax: 2,
    wordsPerSentenceMax: 16,
    expectedPackWords: 1400,
    label: 'SHORT — impulse COD, 1,200-1,500w mobile-tight cadence',
  },
  medium: {
    wordCapMin: 150,
    wordCapMax: 190,
    paragraphMin: 3,
    paragraphMax: 5,
    sentencesPerParagraphMax: 2,
    wordsPerSentenceMax: 18,
    expectedPackWords: 1900,
    label: 'MEDIUM — considered purchase, 1,700-2,000w balanced flow',
  },
  long: {
    wordCapMin: 170,
    wordCapMax: 210,
    paragraphMin: 3,
    paragraphMax: 5,
    sentencesPerParagraphMax: 3,
    wordsPerSentenceMax: 20,
    expectedPackWords: 2700,
    label: 'LONG — high-ticket / education, 2,500-3,000w full arc',
  },
}

/** Build the cadence hint block injected into the system prompt.
 *  Tells Gemini explicit per-block word cap + paragraph rules + sentence
 *  rules for this length mode. Critical for mobile-friendly output.
 *
 *  2026-05-29 (re-cal) — Strengthened MIN-floor language. Previous version
 *  said "words per block: 60-100" → Gemini wrote 30-word blocks. New
 *  version: "MINIMUM N words. Writing below this is REJECTED." */
export function buildLengthModeHint(mode: LengthMode): string {
  const spec = LENGTH_MODE_SPEC[mode]
  return [
    `═══ LENGTH MODE: ${mode.toUpperCase()} (${spec.label}) ═══`,
    ``,
    `⚠️ PER-BLOCK WORD BUDGET — STRICT FLOOR + CEILING:`,
    `   MINIMUM ${spec.wordCapMin} words per block. This is a HARD FLOOR — do NOT go below.`,
    `   MAXIMUM ${spec.wordCapMax} words per block. Aim for the upper half (${Math.round((spec.wordCapMin + spec.wordCapMax) / 2)}-${spec.wordCapMax}).`,
    `   Writing a block under ${spec.wordCapMin} words is REJECTED — block has not delivered its psychological function.`,
    ``,
    `STRUCTURE per block:`,
    `- Paragraphs per block: ${spec.paragraphMin}-${spec.paragraphMax}.`,
    `- Sentences per paragraph: 1-${spec.sentencesPerParagraphMax} MAX. 1-sentence paragraphs ENCOURAGED for impact moments.`,
    `- Words per sentence: ≤ ${spec.wordsPerSentenceMax} avg. Mobile reader scrolls fast — short sentences breathe.`,
    ``,
    `MOBILE RHYTHM — reader is on phone, ~50 chars/line:`,
    `- Break paragraphs AGGRESSIVELY. White space between paragraphs is OXYGEN, not waste.`,
    `- 1 idea = 1 paragraph. Do not stack 3 ideas into one wall of text.`,
    `- Mix sentence lengths: short impact + medium flow + occasional very short ("3 giờ sáng.").`,
    `- Avoid 3+ consecutive long sentences — reader eyes fatigue, scrolls past.`,
    ``,
    `TOTAL PACK TARGET: ${spec.expectedPackWords} words across all storytelling blocks (PI layer adds on top).`,
    mode === 'short'
      ? `Sweet spot ~1,200-1,500 words readable in 3-4 min mobile scroll.
Each block must EARN its place — but each block must also REACH its word floor.
A 30-word block does not deliver its psychological function. Write the full ${spec.wordCapMin}-${spec.wordCapMax}.`
      : mode === 'medium'
      ? `Sweet spot ~1,700-2,000 words for considered purchase decisions.
More space for narrator validation + failed-attempts than SHORT.
Still enforce mobile rhythm — DR voice with breathing room.`
      : `Sweet spot ~2,500-3,000 words for high-ticket / education products.
Full recognition arc; allow narrative depth; still mobile-tight cadence per paragraph.`,
    `═══════════════════════════════════════════════════════════`,
  ].join('\n')
}
