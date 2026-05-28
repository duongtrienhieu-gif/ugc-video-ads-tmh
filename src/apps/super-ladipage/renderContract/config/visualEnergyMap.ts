// ─────────────────────────────────────────────────────────────────────
// Render Contract — VISUAL ENERGY MAP per SectionRole (P5)
//
// Per-role visual energy + internal feel note. Renderer uses these to
// inform tonal decisions (color temperature, motion tempo, contrast).
//
// LOCK: feelNote is INTERNAL — renderer reads it but NEVER displays.
// ─────────────────────────────────────────────────────────────────────

import type { SectionRole } from '../../composer'
import type { VisualEnergy } from '../types'

export interface EnergyEntry {
  energy: VisualEnergy
  /** Internal feel note for renderer — never visible copy. */
  feelNote: string
}

export const VISUAL_ENERGY_MAP: Record<SectionRole, EnergyEntry> = {
  'hero-recognition': {
    energy:   'high-tension',
    feelNote: 'reader must feel snap recognition within 3 seconds — visual tension high, no distraction',
  },
  'lived-experience': {
    energy:   'subtle-unease',
    feelNote: 'embodied evidence — mood image supports without overwhelming text',
  },
  'shared-struggle': {
    energy:   'frustration',
    feelNote: 'failed-attempts visualization — flat-lay objects, slightly cluttered acceptable',
  },
  'reframe-moment': {
    energy:   'reflection',
    feelNote: 'belief shift — pure text, centered, breathing space critical (NO image distraction)',
  },
  'solution-opening': {
    energy:   'curiosity',
    feelNote: 'product emerges through felt difference — image subtle, text balanced',
  },
  'transformation': {
    energy:   'uplift',
    feelNote: 'future-self projection — wide lifestyle image, warm tone, reader imagines forward',
  },
  'close-invitation': {
    energy:   'reassurance',
    feelNote: 'soft invitation lands as earned — airy spacing, low clutter, no rush',
  },
}

/** Lookup visual energy + feel note for section role. */
export function getVisualEnergy(role: SectionRole): EnergyEntry {
  return VISUAL_ENERGY_MAP[role]
}
