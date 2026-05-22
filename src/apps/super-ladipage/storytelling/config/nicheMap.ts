// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — niche preset map
//
// Mỗi niche → preset cho các axis của StorytellingInput. P0.5 skeleton:
// 4 niche được preset rõ, còn lại fallback về STORYTELLING_DEFAULTS.
// Phase 6 (Niche DNA) sẽ expand đầy đủ + add tone/visual palette per niche.
// ─────────────────────────────────────────────────────────────────────

import type { NicheKey, NichePreset } from '../types'

/** Selective presets — không phải mọi niche đều có preset trong P0.5.
 *  Niche không có preset → caller fallback về STORYTELLING_DEFAULTS. */
export const NICHE_PRESETS: Partial<Record<NicheKey, NichePreset>> = {
  'skincare': {
    niche: 'skincare',
    emotionalIntensity: 'medium',      // insecurity / self-confidence
    productRevealSection: 7,
    pacingType: 'slow-burn',
    continuityPriority: 'high',
    preferredTreatments: ['smartphone-candid', 'domestic-observational', 'family-album'],
    ctaSoftness: 'invitation-only',
    supportingCharacter: 'family',
    sectionCount: 10,
    imageCount: 9,
    recommendedCulturalWorld: ['malay-muslim', 'vietnamese-urban'],
  },

  'haircare': {
    niche: 'haircare',
    emotionalIntensity: 'medium',      // embarrassment / hiding / social discomfort
    productRevealSection: 7,
    pacingType: 'slow-burn',
    continuityPriority: 'high',
    preferredTreatments: ['smartphone-candid', 'domestic-observational', 'memory-snapshot'],
    ctaSoftness: 'invitation-only',
    supportingCharacter: 'friend',
    sectionCount: 10,
    imageCount: 9,
    recommendedCulturalWorld: ['malay-muslim', 'vietnamese-urban'],
  },

  'supplement-wellness': {
    niche: 'supplement-wellness',
    emotionalIntensity: 'low',          // fatigue / low energy — calmer
    productRevealSection: 8,            // reveal trễ — wellness slow-burn
    pacingType: 'slow-burn',
    continuityPriority: 'high',
    preferredTreatments: ['family-album', 'domestic-observational', 'environmental-wide'],
    ctaSoftness: 'invitation-only',
    supportingCharacter: 'family',
    sectionCount: 11,                   // wellness có thêm beat reflection
    imageCount: 10,
    recommendedCulturalWorld: ['malay-muslim', 'vietnamese-urban', 'vietnamese-rural'],
  },

  'mom-baby': {
    niche: 'mom-baby',
    emotionalIntensity: 'medium',       // exhaustion / care burden
    productRevealSection: 6,            // mom audience appreciates practical reveal
    pacingType: 'steady',
    continuityPriority: 'high',
    preferredTreatments: ['family-album', 'smartphone-candid', 'imperfect-real'],
    ctaSoftness: 'quiet-suggestion',
    supportingCharacter: 'family',
    sectionCount: 10,
    imageCount: 9,
    recommendedCulturalWorld: ['malay-muslim', 'vietnamese-urban', 'vietnamese-rural'],
  },
}

/** Convenience getter — returns preset hoặc undefined nếu niche chưa có
 *  preset. Caller phải merge với STORYTELLING_DEFAULTS để có giá trị
 *  đầy đủ. */
export function getNichePreset(niche: NicheKey): NichePreset | undefined {
  return NICHE_PRESETS[niche]
}
