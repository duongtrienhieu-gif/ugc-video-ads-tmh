// ─────────────────────────────────────────────────────────────────────
// Visual Semantics — visualSemanticsCoherenceDetector (P6, SOFT)
//
// Detects semantic coherence issues:
//   - quote-primary hierarchy but invisible proofWeight (orphan)
//   - cta-primary hierarchy but hidden ctaAggression (contradiction)
//   - compressed-tension adjacent to decompressed (jarring transition)
//   - cramped breathing + zero noise tolerance (over-restrictive)
//   - 3+ adjacent sections with same readingTempo (visual monotony)
//
// Returns warning strings. SOFT only.
// ─────────────────────────────────────────────────────────────────────

import type { VisualSemanticsSection } from '../types'

export function visualSemanticsCoherenceDetector(
  sections: VisualSemanticsSection[],
): string[] {
  const warnings: string[] = []

  // ── Check 1: quote-primary but no proof visibility ───────────────
  for (const s of sections) {
    if (
      s.visualSemantics.visualHierarchy === 'quote-primary' &&
      s.visualSemantics.proofWeight === 'invisible'
    ) {
      warnings.push(
        `Section "${s.id}" has visualHierarchy='quote-primary' but proofWeight='invisible' — ` +
        `proof must lead visually but is hidden. Logic contradiction.`,
      )
    }
  }

  // ── Check 2: cta-primary but no cta visibility ───────────────────
  for (const s of sections) {
    if (
      s.visualSemantics.visualHierarchy === 'cta-primary' &&
      s.visualSemantics.ctaAggression === 'hidden'
    ) {
      warnings.push(
        `Section "${s.id}" has visualHierarchy='cta-primary' but ctaAggression='hidden' — ` +
        `CTA must lead visually but is hidden. Logic contradiction.`,
      )
    }
  }

  // ── Check 3: compressed-tension adjacent to decompressed ─────────
  for (let i = 0; i < sections.length - 1; i++) {
    const cur = sections[i].visualSemantics.emotionalCompression
    const nxt = sections[i + 1].visualSemantics.emotionalCompression
    if (
      (cur === 'compressed-tension' && nxt === 'decompressed') ||
      (cur === 'decompressed' && nxt === 'compressed-tension')
    ) {
      warnings.push(
        `Adjacent sections "${sections[i].id}" + "${sections[i + 1].id}" have abrupt ` +
        `emotional compression transition (${cur} → ${nxt}). Consider intermediate phase.`,
      )
    }
  }

  // ── Check 4: cramped breathing + zero noise tolerance ────────────
  for (const s of sections) {
    if (
      s.visualSemantics.sectionBreathing === 'cramped' &&
      s.visualSemantics.visualNoiseTolerance === 'zero'
    ) {
      warnings.push(
        `Section "${s.id}" has cramped breathing + zero noise tolerance — ` +
        `over-restrictive. Either give breathing room or accept some visual chrome.`,
      )
    }
  }

  // ── Check 5: 3+ adjacent sections same readingTempo ─────────────
  let sameTempoStreak = 1
  for (let i = 1; i < sections.length; i++) {
    if (sections[i].visualSemantics.readingTempo === sections[i - 1].visualSemantics.readingTempo) {
      sameTempoStreak++
      if (sameTempoStreak >= 3) {
        warnings.push(
          `3+ adjacent sections share readingTempo='${sections[i].visualSemantics.readingTempo}' ` +
          `(ending at "${sections[i].id}") — reader rhythm monotony risk.`,
        )
        sameTempoStreak = 1  // reset to avoid duplicate
      }
    } else {
      sameTempoStreak = 1
    }
  }

  return warnings
}
