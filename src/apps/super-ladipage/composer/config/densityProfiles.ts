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
    imageRole: 'none',                 // pure text — belief shift moment
    scrollWeight: 'light',
    spacingBefore: 'wide',             // pause before reframe
    spacingAfter: 'wide',              // pause after reframe lands
    flowNote: 'conversion core — quiet reframe, no visual distraction',
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
    imageRole: 'none',                 // pure text closing — anti-distraction
    scrollWeight: 'light',
    spacingBefore: 'wide',
    spacingAfter: 'tight',             // end of page
    flowNote: 'soft action invitation — earned, not pushed',
  },
}

/** Get density profile for section role. */
export function getDensityProfile(role: SectionRole): DensityProfile {
  return DENSITY_PROFILES[role]
}
