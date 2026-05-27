// ─────────────────────────────────────────────────────────────────────
// Product Class — pacing profile library
//
// Override storytelling defaults based on PacingProfile (derived from
// productClass + impulseType). Each pacing has different section count,
// product reveal timing, and emotional intensity.
//
// Bug v1: knee brace got slow-burn 16-section narrative pacing — way
// too long for RM49 impulse COD. v2 overrides at input resolution layer.
// ─────────────────────────────────────────────────────────────────────

import type { PacingProfile } from '../types'

// Maps to existing PacingType union in storytelling/types.ts:
//   'slow-burn' | 'steady' | 'quicker'

// productRevealSection clamped to existing ProductRevealSection union: 5|6|7|8

export interface PacingOverride {
  sectionCount: number
  productRevealSection: 5 | 6 | 7 | 8
  pacingType: 'slow-burn' | 'steady' | 'quicker'
  emotionalIntensity: 'low' | 'medium' | 'high'
  /** Human-readable rationale for QA logs. */
  rationale: string
}

export const PACING_OVERRIDES: Record<PacingProfile, PacingOverride> = {
  'fast-cod': {
    sectionCount: 7,
    productRevealSection: 5,  // earliest allowed by ProductRevealSection union
    pacingType: 'quicker',
    emotionalIntensity: 'medium',
    rationale: 'Impulse COD (RM30-100). 7 sections, product reveal sớm (sec 5), recognition đánh nhanh.',
  },
  'medium-narrative': {
    sectionCount: 11,
    productRevealSection: 6,
    pacingType: 'steady',
    emotionalIntensity: 'medium',
    rationale: 'Considered purchase (RM100-300). 11 sections, narrative + proof balance.',
  },
  'slow-burn': {
    sectionCount: 15,
    productRevealSection: 8,  // latest allowed by ProductRevealSection union
    pacingType: 'slow-burn',
    emotionalIntensity: 'high',
    rationale: 'Premium / narrative-heavy. 15 sections, reveal trễ (sec 8), deep emotional arc.',
  },
}
