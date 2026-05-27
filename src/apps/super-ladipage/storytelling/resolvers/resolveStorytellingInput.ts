// ─────────────────────────────────────────────────────────────────────
// resolveStorytellingInput — input resolution
//
// FIX (2026-05-27): niche no longer hardcoded 'skincare'. Caller can
// pass detected niche from detectNiche(product). If omitted, falls
// back to 'health-functional' (safe generic) — NOT 'skincare' which
// was causing nasal-spray-as-skincare bug.
//
// Cultural world defaults to MY mapping when targetLanguage='ms', VN
// mapping for 'vi', else SG/global. Honored downstream by Gemini prompt.
// ─────────────────────────────────────────────────────────────────────

import type {
  LandingGenParams, NicheKey, StorytellingInput, PacingType, EmotionalIntensity,
  ProductRevealSection,
} from '../types'
import { STORYTELLING_DEFAULTS } from '../config/defaults'
import { getNichePreset } from '../config/nicheMap'
import { resolveProtagonistProfile } from './resolveProtagonistProfile'

/** Optional pacing override from productClass classifier — overrides
 *  niche-preset defaults when product type demands different rhythm
 *  (e.g., knee brace = quicker, glucosamine pill = slow-burn). */
export interface PacingOverride {
  sectionCount: number
  productRevealSection: ProductRevealSection
  pacingType: PacingType
  emotionalIntensity: EmotionalIntensity
}

export function resolveStorytellingInput(
  params: LandingGenParams,
  /** Detected niche from product. Caller (generateStorytellingPack) runs
   *  detectNiche() and passes the result. Falls back to 'health-functional'
   *  if not provided — generic enough to avoid wrong-niche framing. */
  niche: NicheKey = 'health-functional',
  /** P-PRODUCT-CLASS (2026-05-27) — pacing override from product reality
   *  classifier. When provided, overrides niche-preset defaults. */
  pacingOverride?: PacingOverride,
): StorytellingInput {
  const preset = getNichePreset(niche)

  return {
    productId: params.productId,
    niche,
    targetCountry: params.language === 'ms' ? 'MY' : params.language === 'vi' ? 'VN' : 'SG',
    targetLanguage: params.language,

    protagonistProfile: resolveProtagonistProfile({ niche }),

    // PACING OVERRIDE precedence: productClass > niche preset > defaults
    emotionalIntensity:
      pacingOverride?.emotionalIntensity
      ?? preset?.emotionalIntensity
      ?? STORYTELLING_DEFAULTS.emotionalIntensity,
    pacingType:
      pacingOverride?.pacingType
      ?? preset?.pacingType
      ?? STORYTELLING_DEFAULTS.pacingType,
    productRevealSection:
      pacingOverride?.productRevealSection
      ?? preset?.productRevealSection
      ?? STORYTELLING_DEFAULTS.productRevealSection,
    culturalWorld:           preset?.recommendedCulturalWorld?.find(
                               (c) =>
                                 (params.language === 'ms' && c === 'malay-muslim') ||
                                 (params.language === 'vi' && c === 'vietnamese-urban'),
                             ) ?? preset?.recommendedCulturalWorld?.[0]
                               ?? (params.language === 'ms' ? 'malay-muslim' : 'vietnamese-urban'),
    ctaSoftness:             preset?.ctaSoftness             ?? STORYTELLING_DEFAULTS.ctaSoftness,
    supportingCharacterMode: preset?.supportingCharacter     ?? STORYTELLING_DEFAULTS.supportingCharacterMode,

    visualRealismLevel: STORYTELLING_DEFAULTS.visualRealismLevel,
    overlayMode:        STORYTELLING_DEFAULTS.overlayMode,

    visualMemory: params.visualMemory,
  }
}
