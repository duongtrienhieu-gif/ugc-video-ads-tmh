// ─────────────────────────────────────────────────────────────────────
// resolveStorytellingInput — STUB cho P0.5
//
// P0.5: trả về StorytellingInput dựng từ defaults + niche preset (nếu có).
// KHÔNG đụng product info, KHÔNG inspect competitor URL, KHÔNG derive
// niche từ product category. Đó là việc của P2+.
//
// Phase 2 sẽ:
//   - derive niche từ product.painPoints / product.benefits
//   - merge user override params nếu có
//   - validate input boundaries (productRevealSection trong section count)
// ─────────────────────────────────────────────────────────────────────

import type {
  LandingGenParams, NicheKey, StorytellingInput,
} from '../types'
import { STORYTELLING_DEFAULTS } from '../config/defaults'
import { getNichePreset } from '../config/nicheMap'
import { resolveProtagonistProfile } from './resolveProtagonistProfile'

/** P0.5 stub: tạo StorytellingInput compact với defaults + niche preset.
 *  Real logic sẽ đến ở P2 (Story arc system). */
export function resolveStorytellingInput(
  params: LandingGenParams,
  /** P0.5: niche hardcode 'skincare' nếu caller không truyền. Phase 2
   *  sẽ derive từ product semantic. */
  niche: NicheKey = 'skincare',
): StorytellingInput {
  const preset = getNichePreset(niche)

  return {
    productId: params.productId,
    niche,
    targetCountry: params.language === 'ms' ? 'MY' : params.language === 'vi' ? 'VN' : 'SG',
    targetLanguage: params.language,

    protagonistProfile: resolveProtagonistProfile({ niche }),

    emotionalIntensity:      preset?.emotionalIntensity      ?? STORYTELLING_DEFAULTS.emotionalIntensity,
    pacingType:              preset?.pacingType              ?? STORYTELLING_DEFAULTS.pacingType,
    productRevealSection:    preset?.productRevealSection    ?? STORYTELLING_DEFAULTS.productRevealSection,
    culturalWorld:           preset?.recommendedCulturalWorld?.[0] ?? 'malay-muslim',
    ctaSoftness:             preset?.ctaSoftness             ?? STORYTELLING_DEFAULTS.ctaSoftness,
    supportingCharacterMode: preset?.supportingCharacter     ?? STORYTELLING_DEFAULTS.supportingCharacterMode,

    visualRealismLevel: STORYTELLING_DEFAULTS.visualRealismLevel,
    overlayMode:        STORYTELLING_DEFAULTS.overlayMode,

    visualMemory: params.visualMemory,
  }
}
