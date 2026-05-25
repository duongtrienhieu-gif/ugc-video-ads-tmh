// ─────────────────────────────────────────────────────────────────────
// adjacentRhythmDetector
//
// Compute rhythm stats per section (avg sentence length, paragraph
// density, fragment ratio). Flag if 2 adjacent sections too similar.
//
// Anti-monotony invariant from v4: adjacent sections KHÔNG được cùng
// rhythm. This is the OUTPUT-side enforcement (config side enforced
// at blueprint level via rhythmVariance.validateAdjacentRhythms).
// ─────────────────────────────────────────────────────────────────────

import type { BlockId } from '../types'
import type { ParsedSection } from '../runtime/parsePackResponse'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'

interface RhythmStats {
  avgSentenceLength: number
  paragraphCount: number
  /** Ratio sentences <5 words. High = fragmented rhythm. */
  fragmentRatio: number
  /** Ratio sentences >18 words. High = long-flowing rhythm. */
  longRatio: number
}

function computeRhythmStats(copy: string): RhythmStats {
  const paragraphs = copy.split(/\n{2,}/).filter((p) => p.trim().length > 0)
  // Split by sentence terminators (handle Vietnamese punctuation)
  const sentences = copy
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  if (sentences.length === 0) {
    return { avgSentenceLength: 0, paragraphCount: paragraphs.length, fragmentRatio: 0, longRatio: 0 }
  }

  const wordCounts = sentences.map((s) => s.split(/\s+/).filter((w) => w.length > 0).length)
  const avg = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length
  const shortCount = wordCounts.filter((w) => w < 5).length
  const longCount = wordCounts.filter((w) => w > 18).length

  return {
    avgSentenceLength: avg,
    paragraphCount: paragraphs.length,
    fragmentRatio: shortCount / wordCounts.length,
    longRatio: longCount / wordCounts.length,
  }
}

/** P0.5.4 STORYSELLING REALIGNMENT — thresholds LOOSENED significantly.
 *
 *  Storyselling needs conversational flow throughout. Adjacent sections
 *  both in flowing rhythm are OK — readability > variance.
 *
 *  Validator now flags only PATHOLOGICAL cases where 2 sections are
 *  nearly identical in cadence (suggesting Gemini repeating structure).
 *  False positives bad here — we don't want validator pressuring writer
 *  into artificial variance. */
const SENTENCE_LENGTH_THRESHOLD = 1.5    // tighter — only flag near-identical
const FRAGMENT_RATIO_THRESHOLD = 0.08    // tighter
const LONG_RATIO_THRESHOLD = 0.08

export function adjacentRhythmDetector(sections: ParsedSection[]): ValidatorResult {
  const violations: ValidatorViolation[] = []

  const stats: Array<{ id: BlockId; stats: RhythmStats }> = sections.map((s) => ({
    id: s.id,
    stats: computeRhythmStats(s.copy),
  }))

  for (let i = 0; i < stats.length - 1; i++) {
    const cur = stats[i]
    const next = stats[i + 1]
    const lenDiff = Math.abs(cur.stats.avgSentenceLength - next.stats.avgSentenceLength)
    const fragDiff = Math.abs(cur.stats.fragmentRatio - next.stats.fragmentRatio)
    const longDiff = Math.abs(cur.stats.longRatio - next.stats.longRatio)

    // Too similar = all 3 metrics close
    if (lenDiff < SENTENCE_LENGTH_THRESHOLD && fragDiff < FRAGMENT_RATIO_THRESHOLD && longDiff < LONG_RATIO_THRESHOLD) {
      violations.push({
        sectionId: next.id,
        violation:
          `Rhythm too similar to previous (${cur.id}): ` +
          `sentence-length diff ${lenDiff.toFixed(1)}w, ` +
          `fragment-ratio diff ${fragDiff.toFixed(2)}, ` +
          `long-ratio diff ${longDiff.toFixed(2)}`,
      })
    }
  }

  return { pass: violations.length === 0, violations }
}
