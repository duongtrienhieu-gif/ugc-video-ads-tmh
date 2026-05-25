// ─────────────────────────────────────────────────────────────────────
// paragraphCountDetector — SOFT WARNING (Reader-Immersion architecture)
//
// Flags blocks where paragraphs[].length falls outside the block's
// paragraphTarget defined in blockPool.ts.
//
// SOFT only — does NOT trigger retry. Surfaces structural rhythm violations
// (e.g. block came back as 1-paragraph wall when target was 3-5).
//
// Per-block target replaces legacy per-pacingClass logic from rhythmEngine.
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../runtime/parsePackResponse'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'
import { BLOCK_POOL } from '../config/blockPool'

export function paragraphCountDetector(sections: ParsedSection[]): ValidatorResult {
  const violations: ValidatorViolation[] = []

  for (const s of sections) {
    // Skip social-proof — intentionally has 1 paragraph (intro only,
    // reviews live in separate field).
    if (s.id === 'social-proof') continue

    const blueprint = BLOCK_POOL[s.id]
    if (!blueprint) continue

    const target = blueprint.paragraphTarget
    const actual = s.paragraphs.length

    if (actual < target.min) {
      violations.push({
        sectionId: s.id,
        violation: `paragraphs=${actual} (target ${target.min}-${target.max} for block "${s.id}") — under-broken, likely wall of text`,
      })
    } else if (actual > target.max) {
      violations.push({
        sectionId: s.id,
        violation: `paragraphs=${actual} (target ${target.min}-${target.max} for block "${s.id}") — over-fragmented`,
      })
    }
  }

  return { pass: violations.length === 0, violations }
}
