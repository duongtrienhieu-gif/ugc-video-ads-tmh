// ─────────────────────────────────────────────────────────────────────
// narratorCentricDetector — SOFT WARNING (Reader-Immersion architecture)
//
// Flags blocks where narrator-self-mention dominates reader-address in
// blocks that should be reader-heavy (Phase 1 + future-reader Phase 4).
//
// Heuristic: count 'tôi/mình/em' (narrator-words) vs 'bạn' (reader-words)
// per block. For blocks with youIBalance === 'reader-heavy':
//   - if narrator-words > reader-words × 1.5 → warn (narrator dominating)
// For blocks with youIBalance === 'future-reader':
//   - if narrator-words > reader-words × 2.0 → warn (narrator still center)
//
// SOFT only — does NOT trigger retry. Surfaces philosophy violations:
// when narrator dominates a block that should be reader-centered, the
// reader-immersion principle is violated.
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../runtime/parsePackResponse'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'
import { BLOCK_POOL } from '../config/blockPool'

/** Narrator self-mention markers (Vietnamese). */
const NARRATOR_WORD_RE = /\b(tôi|mình|em)\b/gi

/** Reader-address markers (Vietnamese). */
const READER_WORD_RE = /\b(bạn)\b/gi

function countMatches(text: string, re: RegExp): number {
  const matches = text.match(re)
  return matches ? matches.length : 0
}

export function narratorCentricDetector(sections: ParsedSection[]): ValidatorResult {
  const violations: ValidatorViolation[] = []

  for (const s of sections) {
    const blueprint = BLOCK_POOL[s.id]
    if (!blueprint) continue

    // Only check blocks that should center the reader.
    if (blueprint.youIBalance !== 'reader-heavy' && blueprint.youIBalance !== 'future-reader') {
      continue
    }

    const text = s.copy
    const narratorCount = countMatches(text, NARRATOR_WORD_RE)
    const readerCount = countMatches(text, READER_WORD_RE)

    // Skip very short text (intro lines, e.g. social-proof intro).
    if (narratorCount + readerCount < 3) continue

    const ratioThreshold = blueprint.youIBalance === 'reader-heavy' ? 1.5 : 2.0

    // If narrator dominates by threshold and reader is barely present
    if (narratorCount > readerCount * ratioThreshold) {
      violations.push({
        sectionId: s.id,
        violation:
          `youIBalance="${blueprint.youIBalance}" but narrator-words (${narratorCount}) ` +
          `dominate reader-words (${readerCount}) by ${(narratorCount / Math.max(readerCount, 1)).toFixed(1)}x ` +
          `— block should center reader, not narrator. ` +
          `Recognition progression broken if narrator monologues here.`,
      })
    }
  }

  return { pass: violations.length === 0, violations }
}
