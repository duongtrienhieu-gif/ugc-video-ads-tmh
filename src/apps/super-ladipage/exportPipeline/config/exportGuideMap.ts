// ─────────────────────────────────────────────────────────────────────
// Export Pipeline — declarative mapping tables (P14)
//
// Pure config. Each table maps an existing upstream enum to an
// export-friendly value.
// ─────────────────────────────────────────────────────────────────────

import type {
  SpacingPreset,
  TextChunking,
  ProofPresentation,
  CtaPlacement,
} from '../../renderContract'
import type {
  SuggestedPadding,
  RecommendedSpacing,
  TextWidthMode,
  ProofStyle,
} from '../types'

export const PADDING_BY_SPACING: Record<SpacingPreset, SuggestedPadding> = {
  'snug':        'tight',
  'comfortable': 'comfortable',
  'airy':        'spacious',
  'expansive':   'spacious',
}

export const SPACING_BY_SPACING: Record<SpacingPreset, RecommendedSpacing> = {
  'snug':        'tight',
  'comfortable': 'normal',
  'airy':        'wide',
  'expansive':   'wide',
}

export const TEXT_WIDTH_BY_CHUNKING: Record<TextChunking, TextWidthMode> = {
  'long-flowing':      'wide',
  'medium-paragraph':  'standard',
  'small-paragraph':   'narrow',
  'fragmented-lines':  'narrow',
}

export const PROOF_STYLE_BY_PRESENTATION: Record<ProofPresentation, ProofStyle> = {
  'none':                  'none',
  'subtle-attribution':    'subtle',
  'inline-quote-callout':  'standard',
  'bordered-block':        'spotlight',
}

export function isStickyCtaRecommended(placement: CtaPlacement): boolean {
  return placement === 'sticky-low-friction'
}
