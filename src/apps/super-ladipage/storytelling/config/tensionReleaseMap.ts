// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — tension/release map
//
// Per-section tension level 0-10. Drives emotional curve.
// Validator detects flat-line (AI essay risk) + over-spiking (drama drift).
// ─────────────────────────────────────────────────────────────────────

import type { SectionId } from '../types'
import { DEFAULT_SECTION_ORDER } from './sectionBlueprints'

/** Per-section tension level (v4.1 — 11 sections).
 *  Curve: hook snap → friction → fear escalation → frustration peak
 *  → BELIEF SHIFT release valve → soft reveal → micro reward → payoff
 *  → reflection settle → trust continuity → soft CTA closure. */
export const TENSION_CURVE: Record<SectionId, number> = {
  'hook-interrupt':    6,   // immediate emotional snap
  'daily-friction':    5,   // relatable struggles
  'internal-fear':     7,   // escalation peak (inward fear)
  'failed-attempts':   7,   // frustration loop
  'belief-shift':      4,   // 🆕 RELEASE VALVE — AHA reframe, permission to seek
  'soft-reveal':       5,   // reluctant hope returns
  'micro-reward':      4,   // subtle uptick (dopamine)
  'emotional-payoff':  3,   // lightening, life feels lighter
  'reflection-trust':  3,   // 🆕 settled maturity
  'trust-continuity':  2,   // 🆕 mini testimonials, calm validation
  'soft-cta':          2,   // soft closure
}

/** Detect flat-line (3+ consecutive sections same tension). Flag warning
 *  — AI essay tone risk. */
export function detectFlatLine(
  sectionIds: SectionId[],
  tolerance = 1,
): { flat: boolean; flagged: SectionId[] } {
  const flagged: SectionId[] = []
  for (let i = 0; i < sectionIds.length - 2; i++) {
    const [a, b, c] = [
      TENSION_CURVE[sectionIds[i]],
      TENSION_CURVE[sectionIds[i + 1]],
      TENSION_CURVE[sectionIds[i + 2]],
    ]
    if (Math.abs(a - b) <= tolerance && Math.abs(b - c) <= tolerance) {
      flagged.push(sectionIds[i + 1])
    }
  }
  return { flat: flagged.length > 0, flagged }
}

/** Detect spike (any section > 8 OR adjacent jump > 4). Flag warning
 *  — drama/trauma drift risk. */
export function detectSpike(sectionIds: SectionId[]): {
  spiked: boolean
  flagged: SectionId[]
} {
  const flagged: SectionId[] = []
  for (let i = 0; i < sectionIds.length; i++) {
    const t = TENSION_CURVE[sectionIds[i]]
    if (t > 8) flagged.push(sectionIds[i])
    if (i > 0) {
      const prev = TENSION_CURVE[sectionIds[i - 1]]
      if (Math.abs(t - prev) > 4) flagged.push(sectionIds[i])
    }
  }
  return { spiked: flagged.length > 0, flagged }
}

/** ASCII visualization helper — for debug strip / dev tools. */
export function renderTensionAscii(
  sectionIds: SectionId[] = [...DEFAULT_SECTION_ORDER],
): string {
  const max = 10
  const rows: string[] = []
  for (let lvl = max; lvl >= 0; lvl--) {
    let row = String(lvl).padStart(2) + ' │'
    for (const sid of sectionIds) {
      row += TENSION_CURVE[sid] === lvl ? ' ● ' : '   '
    }
    rows.push(row)
  }
  rows.push('   └' + '───'.repeat(sectionIds.length))
  rows.push('    ' + sectionIds.map((_, i) => 's' + String(i + 1).padStart(2, ' ').padEnd(3)).join(''))
  return rows.join('\n')
}
