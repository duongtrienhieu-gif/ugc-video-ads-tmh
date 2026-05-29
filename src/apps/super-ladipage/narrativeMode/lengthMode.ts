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

import type { BlockId, LandingLanguage } from '../storytelling/types'
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

// ─── Fix A (2026-05-29) — Language-aware spec ─────────────────────────
//
// VN is a CC-VC tonal language with 1 syllable = ~1 character grouping;
// 16 VN words reads as a short sentence. MS / EN use multi-syllable words
// (MS especially has long compound terms like "menghalang pergerakan
// anda" = 3 words but reads as 30 characters), so the same 16-word cap
// becomes a wall of text on mobile.
//
// MS pack feedback (knee brace pack, 2026-05-29): paragraphs had 3
// sentences of 18-25 words each → wall-of-text feel. Multiplier:
//   - VN: 1.00 baseline (tested + working in earlier packs)
//   - MS: 0.65 — tighter caps because each word reads longer
//   - EN: 0.80 — middle ground
//
// Apply ONLY to sentence-length + sentences-per-paragraph (the cadence
// dimensions reader perceives as "wall of text"). Word-cap per block
// stays language-neutral because total pack length is a content budget,
// not a cadence concern.

const LANGUAGE_CADENCE_MULTIPLIER: Record<LandingLanguage, number> = {
  vi: 1.0,
  ms: 0.65,
  en: 0.80,
}

/** Per-language sentence-length and sentences-per-paragraph caps,
 *  derived from base spec × multiplier. Floors prevent the cap from
 *  becoming so tight that Gemini can't produce coherent prose. */
function adjustSpecForLanguage(spec: LengthModeSpec, language: LandingLanguage): LengthModeSpec {
  const mult = LANGUAGE_CADENCE_MULTIPLIER[language]
  if (mult === 1.0) return spec
  return {
    ...spec,
    wordsPerSentenceMax: Math.max(8, Math.round(spec.wordsPerSentenceMax * mult)),
    // sentencesPerParagraphMax: keep at 2 even for VN (was 2). For MS/EN we
    // cap at 2 explicitly. Single-sentence paragraphs are heavily
    // encouraged for impact moments regardless of language.
    sentencesPerParagraphMax: Math.min(spec.sentencesPerParagraphMax, 2),
  }
}

/** Public accessor: return the spec adjusted for output language. When
 *  language is omitted, returns the base spec (VN-equivalent). */
export function getLengthModeSpec(mode: LengthMode, language?: LandingLanguage): LengthModeSpec {
  const base = LENGTH_MODE_SPEC[mode]
  return language ? adjustSpecForLanguage(base, language) : base
}

// ─── Per-language example fragments for the hint (Fix B) ──────────────
//
// Concrete examples in the target language teach Gemini the rhythm to
// imitate. Without them, the hint is abstract structural language that
// Gemini can interpret away.

interface LangExamples {
  /** 1-sentence impact paragraph (5-8 words). */
  oneSentImpact: string
  /** 2-sentence breathing paragraph. */
  twoSentBreathing: string
  /** A "wall of text" anti-pattern that gets rejected. */
  wallExample: string
  /** Same idea broken into 3 short paragraphs (the GOOD pattern). */
  brokenExample: string
}

const LANGUAGE_EXAMPLES: Record<LandingLanguage, LangExamples> = {
  vi: {
    oneSentImpact: `"3 giờ sáng. Lại tỉnh."`,
    twoSentBreathing: `"Tôi ngồi dậy. Lưng đau như có ai đè."`,
    wallExample: `"Tôi ngồi dậy sau một đêm dài, lưng đau như có ai đè lên, và tôi biết mình lại phải bắt đầu một ngày nữa với cảm giác mệt mỏi không thể tả được."`,
    brokenExample: `"Tôi ngồi dậy.\n\nLưng đau như có ai đè lên.\n\nLại một ngày nữa bắt đầu mệt."`,
  },
  ms: {
    oneSentImpact: `"3 pagi. Terjaga lagi."`,
    twoSentBreathing: `"Saya bangun perlahan. Lutut keras macam papan."`,
    wallExample: `"Saya bangun perlahan dari katil setelah satu malam yang panjang, lutut saya rasa keras seperti papan dan saya tahu hari ini akan sama seperti semalam, penuh dengan kesakitan yang tak boleh saya elakkan."`,
    brokenExample: `"Saya bangun perlahan.\n\nLutut keras macam papan.\n\nHari ini akan sama seperti semalam."`,
  },
  en: {
    oneSentImpact: `"3am. Awake again."`,
    twoSentBreathing: `"I sit up slowly. My knee feels locked."`,
    wallExample: `"I sit up slowly after a long night, my knee feels locked and stiff and I already know this day is going to be just like yesterday, full of the kind of pain that I cannot avoid no matter how hard I try."`,
    brokenExample: `"I sit up slowly.\n\nMy knee feels locked.\n\nAnother day, same as yesterday."`,
  },
}

/** Build the cadence hint block injected into the system prompt.
 *  Tells Gemini explicit per-block word cap + paragraph rules + sentence
 *  rules for this length mode. Critical for mobile-friendly output.
 *
 *  2026-05-29 (re-cal) — Strengthened MIN-floor language. Previous version
 *  said "words per block: 60-100" → Gemini wrote 30-word blocks. New
 *  version: "MINIMUM N words. Writing below this is REJECTED."
 *
 *  Fix A + B (2026-05-29) — Language parameter + concrete in-language
 *  examples + wall-of-text anti-pattern. MS pack came back with 3-
 *  sentence-20-word paragraphs because the abstract rule didn't survive
 *  language translation. Showing Gemini "this is a wall (reject) vs.
 *  this is good (3 short paras)" in the target language makes the
 *  rule actually stick.
 */
export function buildLengthModeHint(mode: LengthMode, language?: LandingLanguage): string {
  const spec = getLengthModeSpec(mode, language)
  const examples = language ? LANGUAGE_EXAMPLES[language] : LANGUAGE_EXAMPLES.vi
  const langLabel = language === 'ms' ? 'Bahasa Melayu' : language === 'en' ? 'English' : 'Tiếng Việt'

  return [
    `═══ LENGTH MODE: ${mode.toUpperCase()} (${spec.label}) — LANGUAGE: ${langLabel} ═══`,
    ``,
    `⚠️ PER-BLOCK WORD BUDGET — STRICT FLOOR + CEILING:`,
    `   MINIMUM ${spec.wordCapMin} words per block. This is a HARD FLOOR — do NOT go below.`,
    `   MAXIMUM ${spec.wordCapMax} words per block. Aim for the upper half (${Math.round((spec.wordCapMin + spec.wordCapMax) / 2)}-${spec.wordCapMax}).`,
    `   Writing a block under ${spec.wordCapMin} words is REJECTED — block has not delivered its psychological function.`,
    ``,
    `⚠️ SENTENCE + PARAGRAPH CADENCE — MOBILE READER ENFORCEMENT:`,
    `- Paragraphs per block: ${spec.paragraphMin}-${spec.paragraphMax}.`,
    `- Sentences per paragraph: ${spec.sentencesPerParagraphMax} MAXIMUM. NEVER 3.`,
    `   → If you write a 3-sentence paragraph, BREAK IT into 2 paragraphs.`,
    `   → 1-sentence paragraphs are ENCOURAGED for impact moments (≥30% of paras).`,
    `- Words per sentence: ${spec.wordsPerSentenceMax} MAXIMUM avg. NEVER 25.`,
    `   → If a sentence exceeds ${spec.wordsPerSentenceMax} words, split it at the comma or "and"/"dan"/"và".`,
    `   → Short sentences (3-6 words) are GOOD — they breathe on mobile.`,
    ``,
    `🚫 WALL-OF-TEXT ANTI-PATTERN (REJECT THIS — example in ${langLabel}):`,
    examples.wallExample,
    `   ↑ This is ONE paragraph, 3+ sentences, ${language === 'ms' ? '~30 words/sentence' : '~25 words/sentence'}. Reader's eyes glaze. SCROLL PAST.`,
    ``,
    `✅ MOBILE-RHYTHM PATTERN (DO THIS INSTEAD — example in ${langLabel}):`,
    examples.brokenExample,
    `   ↑ Same idea. 3 short paragraphs. White space between each. Eye rests. Reader keeps scrolling.`,
    ``,
    `IMPACT MOMENT examples (1-sentence paragraph) in ${langLabel}:`,
    `   ${examples.oneSentImpact}`,
    `   ${examples.twoSentBreathing}  ← 2 sentences max if you need slightly more weight.`,
    ``,
    `MOBILE RHYTHM rules (apply EVERY paragraph):`,
    `- Break paragraphs AGGRESSIVELY. White space = OXYGEN, not waste.`,
    `- 1 idea = 1 paragraph. NEVER stack 3 ideas into one block.`,
    `- After every long sentence, follow with a short one (≤6 words). Pattern: long → short → short → medium.`,
    `- NEVER 3 consecutive long sentences. Reader eyes fatigue, scrolls past.`,
    ``,
    `TOTAL PACK TARGET: ${spec.expectedPackWords} words across all storytelling blocks (PI layer adds on top).`,
    mode === 'short'
      ? `Sweet spot ~1,200-1,500 words readable in 3-4 min mobile scroll.
Each block EARNS its place + REACHES its word floor + RESPECTS the cadence caps.
A 30-word block = rejected. A 200-word block in 1 paragraph = also rejected.`
      : mode === 'medium'
      ? `Sweet spot ~1,700-2,000 words for considered purchase decisions.
More space for narrator validation + failed-attempts than SHORT.
Still enforce mobile rhythm — DR voice with breathing room.`
      : `Sweet spot ~2,500-3,000 words for high-ticket / education products.
Full recognition arc; allow narrative depth; still mobile-tight cadence per paragraph.`,
    `═══════════════════════════════════════════════════════════`,
  ].join('\n')
}
