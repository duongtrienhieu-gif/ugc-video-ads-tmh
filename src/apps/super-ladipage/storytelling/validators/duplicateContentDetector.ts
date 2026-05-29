// ─────────────────────────────────────────────────────────────────────
// duplicateContentDetector — HARD VALIDATOR (SPEC-FIX 2026-05-27)
//
// Detects sections that have near-identical content despite different
// block IDs. Real example from production: belief-shift and
// soft-mechanism-compare both produced "Tôi đọc được một bài báo..."
// with virtually identical text — reader sees the same paragraph twice.
//
// Generic: pure text-similarity check (Dice coefficient on bigrams).
// No product/niche-specific logic — works across all packs.
//
// Triggers retry feedback that asks Gemini to differentiate these blocks.
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../runtime/parsePackResponse'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'

/** Threshold: ≥ this ratio means functionally-duplicate content. */
const SIMILARITY_THRESHOLD = 0.75

/** Bigram set from a string (character bigrams — language-agnostic). */
function bigrams(text: string): Set<string> {
  const normalized = text
    .toLowerCase()
    .replace(/[\s\n\r]+/g, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .trim()
  const set = new Set<string>()
  for (let i = 0; i < normalized.length - 1; i++) {
    set.add(normalized.slice(i, i + 2))
  }
  return set
}

/** Dice coefficient — 2 * |A ∩ B| / (|A| + |B|). 1.0 = identical. */
function dice(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const item of a) {
    if (b.has(item)) intersection++
  }
  return (2 * intersection) / (a.size + b.size)
}

export function duplicateContentDetector(sections: ParsedSection[]): ValidatorResult {
  const violations: ValidatorViolation[] = []

  // Skip proof blocks (P2 proof callouts — content from separate gen pass).
  const storySections = sections.filter(
    (s) => !(typeof s.id === 'string' && s.id.startsWith('proof-')),
  )
  if (storySections.length < 2) return { pass: true, violations: [] }

  const bigramSets = storySections.map((s) => ({ id: s.id, bigrams: bigrams(s.copy) }))

  for (let i = 0; i < bigramSets.length - 1; i++) {
    for (let j = i + 1; j < bigramSets.length; j++) {
      const sim = dice(bigramSets[i].bigrams, bigramSets[j].bigrams)
      if (sim >= SIMILARITY_THRESHOLD) {
        violations.push({
          sectionId: bigramSets[j].id,
          violation:
            `Near-duplicate of section "${bigramSets[i].id}" ` +
            `(${(sim * 100).toFixed(0)}% similar bigrams). Same content repeated — reader fatigue. ` +
            `Each block must have a UNIQUE angle/topic per its psychologicalFunction.`,
        })
      }
    }
  }

  return { pass: violations.length === 0, violations }
}
