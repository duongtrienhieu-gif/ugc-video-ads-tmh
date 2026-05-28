// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — defaults
//
// Default values cho StorytellingInput khi user/niche không override.
// Pack limits = hard ceiling (image cap 12, never approach).
// ─────────────────────────────────────────────────────────────────────

import type {
  CtaSoftnessKey, EmotionalIntensity, OverlayModeKey, PacingType,
  ProductRevealSection, SupportingCharacterMode, VisualRealismKey,
} from '../types'

/** Defaults applied khi StorytellingInput không có override. Niche preset
 *  có precedence cao hơn defaults — chỉ những axis nào niche không quy
 *  định thì fallback về đây. */
export const STORYTELLING_DEFAULTS = {
  emotionalIntensity:      'medium'           as EmotionalIntensity,
  pacingType:              'steady'           as PacingType,
  productRevealSection:    7                  as ProductRevealSection,
  ctaSoftness:             'invitation-only'  as CtaSoftnessKey,
  supportingCharacterMode: 'none'             as SupportingCharacterMode,
  visualRealismLevel:      'family-album'     as VisualRealismKey,
  overlayMode:             'minimal-1'        as OverlayModeKey,
} as const

/** Hard limits cho pack — engine code KHÔNG ĐƯỢC vượt các giá trị này. */
export const PACK_LIMITS = {
  /** Image hard ceiling. Storytelling KHÔNG bao giờ approach 35 (UGC). */
  imageMax:        12,
  imageDefault:    9,
  imageRangeMin:   8,
  imageRangeMax:   11,

  sectionMin:      9,
  sectionMax:      11,
  sectionDefault:  10,

  /** Overlay budget toàn pack — anti-ads-vibe guardrail. */
  overlayMax:      2,
} as const
