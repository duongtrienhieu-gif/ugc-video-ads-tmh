// ─────────────────────────────────────────────────────────────────────
// Composer — scrollFatigueDetector (P4, SOFT, standalone)
//
// Detects mobile scroll fatigue patterns in ComposedPage. Returns warning
// strings (NOT ValidatorResult shape — composer is standalone from
// storytelling validator pipeline).
//
// Fatigue patterns:
//   - 3+ consecutive 'heavy' scrollWeight sections (overwhelming)
//   - Total estimated scroll time > 4 minutes (page too long)
//   - 'fragmented' density in 2+ adjacent sections (visual chaos)
//   - Hero section is 'heavy' (opener too dense — kills first impression)
//
// SOFT only — surfaces audit visibility, never blocks compose.
// ─────────────────────────────────────────────────────────────────────

import type { ComposedSection } from '../types'
import { estimateScrollTime } from '../runtime/computeDensity'

/** Scan composed sections for fatigue patterns. Returns warning strings. */
export function scrollFatigueDetector(sections: ComposedSection[]): string[] {
  const warnings: string[] = []

  // ── Check 1: 3+ consecutive heavy scrollWeight ────────────────────
  let consecutiveHeavy = 0
  for (const s of sections) {
    if (s.scrollWeight === 'heavy') {
      consecutiveHeavy++
      if (consecutiveHeavy >= 3) {
        warnings.push(
          `3+ consecutive heavy-scrollWeight sections detected (ending at "${s.id}") ` +
          `— reader will fatigue. Consider lighter content or wider spacing.`,
        )
        consecutiveHeavy = 0  // reset to avoid duplicate warnings
      }
    } else {
      consecutiveHeavy = 0
    }
  }

  // ── Check 2: total scroll time > 4 minutes ─────────────────────────
  const totalWords = sections.reduce((sum, s) => sum + s.wordCount, 0)
  const totalSec = estimateScrollTime(totalWords)
  if (totalSec > 240) {
    warnings.push(
      `Estimated mobile scroll time ${totalSec}s (>4 min). Page likely too long — ` +
      `consider tightening dense sections.`,
    )
  }

  // ── Check 3: 2+ adjacent fragmented density ────────────────────────
  for (let i = 0; i < sections.length - 1; i++) {
    if (sections[i].density === 'fragmented' && sections[i + 1].density === 'fragmented') {
      warnings.push(
        `Adjacent fragmented density: "${sections[i].id}" + "${sections[i + 1].id}" — ` +
        `visual chaos risk on mobile. Consider density rebalance.`,
      )
    }
  }

  // ── Check 4: Hero is heavy ─────────────────────────────────────────
  const hero = sections.find((s) => s.role === 'hero-recognition')
  if (hero && hero.scrollWeight === 'heavy') {
    warnings.push(
      `Hero section "${hero.id}" is heavy scrollWeight (${hero.wordCount} words). ` +
      `Opener should be light — kills first-impression impact. Consider trimming.`,
    )
  }

  return warnings
}
