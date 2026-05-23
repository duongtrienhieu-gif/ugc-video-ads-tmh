// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — ENERGY CURVE PRESETS (v5.1)
//
// 5 different emotional movement styles per pack. Selected per pack
// to vary how the emotional arc moves through 11 sections.
//
// Each curve applies DELTA on top of base TENSION_CURVE (v4.1).
// Goal: same product different curve = different feel.
// ─────────────────────────────────────────────────────────────────────

import type { EnergyCurvePreset } from '../types'

export const ENERGY_CURVE_PRESETS: EnergyCurvePreset[] = [
  {
    id: 'steady-decline-recovery',
    label: 'Slow down then up',
    description: 'Steady downward arc through sections 1-4, valley at belief-shift, gradual recovery — classic narrative',
    tensionDeltas: {
      // Baseline curve OK — slight steady decline + recovery
    },
    pacingFlavor: 'steady tension build-up through friction, valley at section 5, gradual recovery — most natural movement',
  },

  {
    id: 'oscillating-frustration',
    label: 'Try-fail-try-fail-breakthrough',
    description: 'Multiple ups and downs through frustration sections, breakthrough at belief-shift',
    tensionDeltas: {
      'daily-friction':  -1,  // brief moment of "maybe OK"
      'internal-fear':   +1,  // then escalate
      'failed-attempts': -1,  // false hope between attempts
      'belief-shift':    -1,  // bigger valley relief
    },
    pacingFlavor: 'oscillating up-down through frustration — each failed attempt has brief false hope, breakthrough at section 5',
  },

  {
    id: 'sudden-realization',
    label: 'Long plateau, sudden insight',
    description: 'Tension plateau through sections 1-4 then sharp drop at belief-shift — abrupt awakening',
    tensionDeltas: {
      'daily-friction':  +1,  // higher sustained tension
      'internal-fear':   +1,
      'failed-attempts': +1,
      'belief-shift':    -2,  // sharp drop, sudden insight
      'soft-reveal':     -1,
    },
    pacingFlavor: 'sustained plateau of friction through sections 2-4, then sudden drop at section 5 — clarity arrives abruptly',
  },

  {
    id: 'gradual-acceptance',
    label: 'Slow evidence accumulation',
    description: 'Gentle curve, no peaks — accumulating evidence leads to soft realization',
    tensionDeltas: {
      'daily-friction':  -1,  // lower friction sustained
      'internal-fear':   -1,
      'failed-attempts': -1,
      'belief-shift':    +1,  // less dramatic relief
    },
    pacingFlavor: 'gentle accumulation of small evidence — no dramatic peaks, no sharp valleys, slow acceptance',
  },

  {
    id: 'reluctant-trust-building',
    label: 'Many small wins before belief shifts',
    description: 'Skeptical narrator, slow belief shift, micro-rewards more pronounced',
    tensionDeltas: {
      'belief-shift':    +1,  // belief shift LESS pronounced (still doubting)
      'soft-reveal':     +1,  // still skeptical
      'micro-reward':    -1,  // small wins more impactful
      'emotional-payoff': -1,
    },
    pacingFlavor: 'narrator stays skeptical longer — belief shift quieter, micro-rewards carry more weight to convince them',
  },
]

/** Get preset by ID. */
export function getEnergyCurvePreset(id: EnergyCurvePreset['id']): EnergyCurvePreset {
  const found = ENERGY_CURVE_PRESETS.find((p) => p.id === id)
  if (!found) {
    return ENERGY_CURVE_PRESETS[0]  // fallback to steady
  }
  return found
}

/** Compose curve brief for prompt injection. */
export function energyCurveBrief(preset: EnergyCurvePreset): string {
  return `Energy curve: ${preset.label} — ${preset.pacingFlavor}`
}
