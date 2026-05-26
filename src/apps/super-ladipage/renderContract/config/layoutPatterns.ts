// ─────────────────────────────────────────────────────────────────────
// Render Contract — LAYOUT PATTERNS per SectionRole (P5 baseline)
//
// Per-role DEFAULT layoutType + mobilePattern. Override logic in
// deriveRenderContract.ts adjusts based on density / proof / cta state.
// ─────────────────────────────────────────────────────────────────────

import type { SectionRole } from '../../composer'
import type { LayoutType, MobilePattern } from '../types'

export interface LayoutPattern {
  layoutType: LayoutType
  mobilePattern: MobilePattern
}

export const LAYOUT_PATTERN_DEFAULTS: Record<SectionRole, LayoutPattern> = {
  'hero-recognition': {
    layoutType:    'image-top',
    mobilePattern: 'impact-anchor',
  },
  'lived-experience': {
    layoutType:    'image-side',
    mobilePattern: 'breathing-narrative',
  },
  'shared-struggle': {
    layoutType:    'image-top',
    mobilePattern: 'frustration-flat-lay',
  },
  'reframe-moment': {
    layoutType:    'text-only',
    mobilePattern: 'reframe-spotlight',
  },
  'solution-opening': {
    layoutType:    'mixed-flow',
    mobilePattern: 'solution-mixed',
  },
  'transformation': {
    layoutType:    'image-side',
    mobilePattern: 'lifestyle-uplift',
  },
  'close-invitation': {
    layoutType:    'text-only',
    mobilePattern: 'closing-quiet',
  },
}

/** Lookup default layout pattern for section role. */
export function getLayoutPattern(role: SectionRole): LayoutPattern {
  return LAYOUT_PATTERN_DEFAULTS[role]
}
