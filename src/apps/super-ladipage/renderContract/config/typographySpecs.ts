// ─────────────────────────────────────────────────────────────────────
// Render Contract — TYPOGRAPHY SPECS per density (P5 baseline)
//
// Density tier → text chunking + typographic dominance. Renderer-agnostic
// — no font sizes, no leading, no Tailwind classes. Pure intent.
// ─────────────────────────────────────────────────────────────────────

import type { SectionDensity, SectionRole } from '../../composer'
import type { TextChunking, TypographyDominance } from '../types'

export interface TypographySpec {
  textChunking: TextChunking
  typographyDominance: TypographyDominance
}

/** Density → default text chunking. Override per role below. */
const DENSITY_CHUNKING: Record<SectionDensity, TextChunking> = {
  'tight':       'fragmented-lines',     // hero / close — snap rhythm
  'medium':      'medium-paragraph',     // body sections
  'airy':        'long-flowing',         // reflective sections
  'fragmented':  'small-paragraph',      // many short paragraphs
}

/** Per-role typography dominance override. Hero = headline-led, etc. */
const ROLE_DOMINANCE: Record<SectionRole, TypographyDominance> = {
  'hero-recognition':  'headline-led',
  'lived-experience':  'body-led',
  'shared-struggle':   'body-led',
  'reframe-moment':    'balanced',       // belief shift moment — both
  'solution-opening':  'body-led',
  'transformation':    'body-led',
  'close-invitation':  'balanced',
}

/** Compose typography spec from density + role. */
export function deriveTypographySpec(
  density: SectionDensity,
  role: SectionRole,
): TypographySpec {
  return {
    textChunking:        DENSITY_CHUNKING[density],
    typographyDominance: ROLE_DOMINANCE[role],
  }
}
