// ─────────────────────────────────────────────────────────────────────
// Composer — DENSITY PROFILES (P4)
//
// Per-section-role: pacing role + spacing + image role + scroll weight
// hint. Used by composer to derive mobile-aware metadata per section.
//
// Profiles guide renderer (later) on:
//   - which sections should be "impact" vs "breathing"
//   - which need wide spacing before/after
//   - which need hero image vs text-only
//   - which feel heavy on mobile scroll
// ─────────────────────────────────────────────────────────────────────

import type {
  SectionRole, PacingRole, ImageRole, SpacingHint, ScrollWeight,
} from '../types'

export interface DensityProfile {
  pacingRole: PacingRole
  imageRole: ImageRole
  scrollWeight: ScrollWeight
  spacingBefore: SpacingHint
  spacingAfter: SpacingHint
  /** Internal note about this role's purpose in mobile scroll flow. */
  flowNote: string
}

export const DENSITY_PROFILES: Record<SectionRole, DensityProfile> = {
  'hero-recognition': {
    pacingRole: 'impact',
    imageRole: 'hero-anchor',
    scrollWeight: 'light',
    spacingBefore: 'tight',          // top of page
    spacingAfter: 'normal',
    flowNote: 'opener impact moment — anchor reader emotion in 1-3 seconds',
  },

  'lived-experience': {
    pacingRole: 'breathing',
    imageRole: 'mood-supporting',
    scrollWeight: 'moderate',
    spacingBefore: 'normal',
    spacingAfter: 'wide',             // breathing room before next phase
    flowNote: 'embodied evidence — reader recognizes self via lived behaviors',
  },

  'shared-struggle': {
    pacingRole: 'dense',
    imageRole: 'object-trace',         // flat-lay of failed attempts
    scrollWeight: 'heavy',
    spacingBefore: 'normal',
    spacingAfter: 'normal',
    flowNote: 'frustration loop — narrator joins reader\'s spot',
  },

  'reframe-moment': {
    pacingRole: 'breathing',
    // 2026-05-29 — Was 'none' (anti-distraction at conversion core). User
    // feedback: 1500-word packs with 5 images is too text-heavy — reader
    // fatigues before reaching the reframe. A QUIET mood-supporting image
    // (no product, narrator alone with quiet thought) reinforces the
    // reframe instead of distracting from it.
    imageRole: 'mood-supporting',
    scrollWeight: 'light',
    spacingBefore: 'wide',             // pause before reframe
    spacingAfter: 'wide',              // pause after reframe lands
    flowNote: 'conversion core — quiet reframe + supporting mood image (post-2026-05-29 fix)',
  },

  'solution-opening': {
    pacingRole: 'mixed',
    imageRole: 'lifestyle-context',
    scrollWeight: 'moderate',
    spacingBefore: 'normal',
    spacingAfter: 'normal',
    flowNote: 'product dissolves naturally — mechanism via felt difference',
  },

  'transformation': {
    pacingRole: 'breathing',
    imageRole: 'lifestyle-context',
    scrollWeight: 'moderate',
    spacingBefore: 'normal',
    spacingAfter: 'wide',              // breathing before final CTA
    flowNote: 'future-self imagination — quality of life return',
  },

  'close-invitation': {
    pacingRole: 'close',
    // 2026-05-29 — Was 'none'. User wants ~8 images per pack for visual
    // rhythm. A lifestyle-context image at close (future-self imagery —
    // narrator doing an ordinary thing with renewed ease) reinforces the
    // "you can be here too" message instead of distracting from it.
    imageRole: 'lifestyle-context',
    scrollWeight: 'light',
    spacingBefore: 'wide',
    spacingAfter: 'tight',             // end of page
    flowNote: 'soft action invitation + future-self lifestyle anchor image',
  },
}

/** Get density profile for section role. */
export function getDensityProfile(role: SectionRole): DensityProfile {
  return DENSITY_PROFILES[role]
}
