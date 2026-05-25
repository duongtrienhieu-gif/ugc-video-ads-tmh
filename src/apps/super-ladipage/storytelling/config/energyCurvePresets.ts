// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — ENERGY CURVE PRESETS
//
// 5 different emotional movement styles. Sampled per pack to vary how
// the emotional arc moves across phases.
//
// Post-rebuild: tensionDeltas (per-SectionId numeric overlay) dropped —
// the new architecture's emotional movement comes from phase + block
// psychologicalFunction + narrator psychology, not per-section tension
// numbers. pacingFlavor remains as 1-line prompt directive.
// ─────────────────────────────────────────────────────────────────────

import type { EnergyCurvePreset } from '../types'

export const ENERGY_CURVE_PRESETS: EnergyCurvePreset[] = [
  {
    id: 'steady-decline-recovery',
    label: 'Slow down then up',
    description: 'Steady downward arc through Phase 1-2, valley at belief-shift, gradual recovery — classic narrative',
    pacingFlavor: 'steady tension build-up through friction blocks, valley at belief-shift, gradual recovery — most natural movement',
  },

  {
    id: 'oscillating-frustration',
    label: 'Try-fail-try-fail-breakthrough',
    description: 'Multiple ups and downs through frustration blocks, breakthrough at belief-shift',
    pacingFlavor: 'oscillating up-down through frustration — each failed attempt has brief false hope, breakthrough at belief-shift',
  },

  {
    id: 'sudden-realization',
    label: 'Long plateau, sudden insight',
    description: 'Tension plateau through Phase 1-2 then sharp drop at belief-shift — abrupt awakening',
    pacingFlavor: 'sustained plateau of friction through recognition + early trust-alignment, then sudden drop at belief-shift — clarity arrives abruptly',
  },

  {
    id: 'gradual-acceptance',
    label: 'Slow evidence accumulation',
    description: 'Gentle curve, no peaks — accumulating evidence leads to soft realization',
    pacingFlavor: 'gentle accumulation of small evidence — no dramatic peaks, no sharp valleys, slow acceptance',
  },

  {
    id: 'reluctant-trust-building',
    label: 'Many small wins before belief shifts',
    description: 'Skeptical narrator, slow belief shift, micro-transformation more pronounced',
    pacingFlavor: 'narrator stays skeptical longer — belief shift quieter, Phase 4 micro-transformation carries more weight to convince them',
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
