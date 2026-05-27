// ─────────────────────────────────────────────────────────────────────
// Image Semantics — imageIntentCoherenceDetector (P9, SOFT)
//
// Detects intent contradictions between section semantics + image intent:
//   1. proof-callout imageRole + proofFeel='none' (logic contradiction)
//   2. hero-recognition + polishLevel='high-polish' (intentional imperfection violated)
//   3. reframe-spotlight pattern + compositionTension='high-tension-asymmetric'
//      (attention restoration violated)
//   4. shared-struggle role + polishLevel='editorial' (documentary feel lost)
//   5. close-invitation role + lightingMood='harsh-tension' (decompression violated)
//
// Returns warning strings. SOFT only — does not modify intent.
// ─────────────────────────────────────────────────────────────────────

import type { ImageIntentSection } from '../types'

export function imageIntentCoherenceDetector(sections: ImageIntentSection[]): string[] {
  const warnings: string[] = []

  for (const s of sections) {
    if (!s.imageIntent) continue
    const ii = s.imageIntent

    // ── Check 1: proof-callout role + proofFeel='none' ──────────────
    if (ii.imageRole === 'proof-callout' && ii.proofFeel === 'none') {
      warnings.push(
        `Section "${s.id}" has imageRole='proof-callout' but proofFeel='none' — ` +
        `proof image must convey proof artifact. Logic contradiction.`,
      )
    }

    // ── Check 2: hero-recognition + high-polish ─────────────────────
    if (s.role === 'hero-recognition' && ii.polishLevel === 'high-polish') {
      warnings.push(
        `Hero section "${s.id}" has polishLevel='high-polish' — contradicts ` +
        `intentional imperfection of reader-recognition. Drop to low/raw polish.`,
      )
    }

    // ── Check 3: reframe pattern + high-tension composition ─────────
    if (
      s.renderContract.mobilePattern === 'reframe-spotlight' &&
      ii.compositionTension === 'high-tension-asymmetric'
    ) {
      warnings.push(
        `Reframe section "${s.id}" has compositionTension='high-tension-asymmetric' — ` +
        `contradicts attention restoration. Use calm-symmetric or released.`,
      )
    }

    // ── Check 4: shared-struggle + editorial polish ─────────────────
    if (s.role === 'shared-struggle' && ii.polishLevel === 'editorial') {
      warnings.push(
        `Shared-struggle section "${s.id}" has polishLevel='editorial' — ` +
        `loses documentary frustration feel. Use low-polish or raw-handheld.`,
      )
    }

    // ── Check 5: close-invitation + harsh-tension lighting ──────────
    if (s.role === 'close-invitation' && ii.lightingMood === 'harsh-tension') {
      warnings.push(
        `Close section "${s.id}" has lightingMood='harsh-tension' — ` +
        `violates emotional decompression. Use morning-clean or warm-soft.`,
      )
    }
  }

  return warnings
}
