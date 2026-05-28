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

export const LENGTH_MODE_SPEC: Record<LengthMode, LengthModeSpec> = {
  short: {
    wordCapMin: 60,
    wordCapMax: 100,
    paragraphMin: 3,
    paragraphMax: 5,
    sentencesPerParagraphMax: 2,
    wordsPerSentenceMax: 15,
    expectedPackWords: 700,
    label: 'SHORT — impulse COD, mobile scroll < 2 min, punchy cadence',
  },
  medium: {
    wordCapMin: 100,
    wordCapMax: 140,
    paragraphMin: 3,
    paragraphMax: 5,
    sentencesPerParagraphMax: 2,
    wordsPerSentenceMax: 18,
    expectedPackWords: 1400,
    label: 'MEDIUM — considered purchase, tighter than legacy long-form',
  },
  long: {
    wordCapMin: 120,
    wordCapMax: 180,
    paragraphMin: 2,
    paragraphMax: 4,
    sentencesPerParagraphMax: 3,
    wordsPerSentenceMax: 20,
    expectedPackWords: 2400,
    label: 'LONG — high-ticket / education, full recognition arc',
  },
}

/** Build the cadence hint block injected into the system prompt.
 *  Tells Gemini explicit per-block word cap + paragraph rules + sentence
 *  rules for this length mode. Critical for mobile-friendly output. */
export function buildLengthModeHint(mode: LengthMode): string {
  const spec = LENGTH_MODE_SPEC[mode]
  return [
    `═══ LENGTH MODE: ${mode.toUpperCase()} (${spec.label}) ═══`,
    ``,
    `PER-BLOCK BUDGET — apply to every storytelling block:`,
    `- Words per block: ${spec.wordCapMin}-${spec.wordCapMax} (HARD CAP at ${spec.wordCapMax + 20}).`,
    `- Paragraphs per block: ${spec.paragraphMin}-${spec.paragraphMax}.`,
    `- Sentences per paragraph: 1-${spec.sentencesPerParagraphMax} MAX. 1-sentence paragraphs ALLOWED + ENCOURAGED for impact.`,
    `- Words per sentence: ≤ ${spec.wordsPerSentenceMax} avg. Mobile reader scrolls fast — short sentences breathe.`,
    ``,
    `MOBILE RHYTHM — reader is on phone, ~50 chars/line:`,
    `- Break paragraphs AGGRESSIVELY. White space between paragraphs is OXYGEN, not waste.`,
    `- 1 idea = 1 paragraph. Do not stack 3 ideas into one wall of text.`,
    `- Mix sentence lengths: short impact + medium flow + occasional very short ("3 giờ sáng.").`,
    `- Avoid 3+ consecutive long sentences — reader eyes fatigue, scrolls past.`,
    ``,
    mode === 'short'
      ? `IMPULSE COD CONSTRAINT — buyer scrolls fast on FB/TikTok ads:
- Total pack target ~${spec.expectedPackWords} words story + PI layer = readable in 90-120s mobile.
- Each block must EARN its place. No filler validation, no philosophical asides.
- Get to product reveal by Phase 3, get to close by Phase 4. No detours.`
      : mode === 'medium'
      ? `CONSIDERED PURCHASE CONSTRAINT — buyer wants enough to decide:
- Total pack target ~${spec.expectedPackWords} words story + PI layer = 3-4 min mobile read.
- More space for narrator validation + failed-attempts than SHORT, less than LONG.`
      : `HIGH-TICKET CONSTRAINT — buyer needs full education + emotional arc:
- Total pack target ~${spec.expectedPackWords} words story + PI layer = full recognition journey.
- Allow narrative depth, but still enforce per-paragraph mobile rhythm.`,
    `═══════════════════════════════════════════════════════════`,
  ].join('\n')
}
