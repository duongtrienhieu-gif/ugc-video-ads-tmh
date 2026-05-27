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

  // ── Tier S extensions (2026-05-27) — 4 new diary-fit niches ──

  'sleep-insomnia': {
    niche: 'sleep-insomnia',
    emotionalIntensity: 'medium',       // exhausted but hidden — không kể với ai
    productRevealSection: 7,            // slow reveal — trust-build vì sleep aid nhạy cảm
    pacingType: 'slow-burn',
    continuityPriority: 'high',
    // Domestic + nighttime tones — bedroom / lamp / 2am clock
    preferredTreatments: ['domestic-observational', 'family-album', 'memory-snapshot'],
    ctaSoftness: 'invitation-only',
    supportingCharacter: 'family',      // partner notices restlessness
    sectionCount: 10,
    imageCount: 9,
    recommendedCulturalWorld: ['vietnamese-urban', 'malay-muslim'],
  },

  'menopause': {
    niche: 'menopause',
    emotionalIntensity: 'medium',       // hidden shame / identity shift
    productRevealSection: 8,            // very slow — deep trust + identity arc
    pacingType: 'slow-burn',
    continuityPriority: 'high',
    preferredTreatments: ['domestic-observational', 'family-album', 'environmental-wide'],
    ctaSoftness: 'invitation-only',
    supportingCharacter: 'friend',      // friend group conversation moment
    sectionCount: 11,
    imageCount: 10,
    recommendedCulturalWorld: ['vietnamese-urban', 'malay-muslim'],
  },

  'mental-health': {
    niche: 'mental-health',
    emotionalIntensity: 'high',         // anxiety / depression — high emotional pitch
    productRevealSection: 7,
    pacingType: 'slow-burn',
    continuityPriority: 'high',
    preferredTreatments: ['domestic-observational', 'memory-snapshot', 'imperfect-real'],
    ctaSoftness: 'invitation-only',     // mental health products = no pushy CTA
    supportingCharacter: 'friend',
    sectionCount: 11,
    imageCount: 10,
    recommendedCulturalWorld: ['vietnamese-urban', 'malay-muslim'],
  },

  'anti-aging-longevity': {
    niche: 'anti-aging-longevity',
    emotionalIntensity: 'medium',       // existential reflection, not crisis
    productRevealSection: 7,
    pacingType: 'steady',               // reflective but not slow-grind
    continuityPriority: 'high',
    preferredTreatments: ['family-album', 'domestic-observational', 'environmental-wide'],
    ctaSoftness: 'invitation-only',
    supportingCharacter: 'family',      // kids / parents mirror-moments
    sectionCount: 10,
    imageCount: 9,
    recommendedCulturalWorld: ['vietnamese-urban', 'malay-muslim'],
  },
}

/** Convenience getter — returns preset hoặc undefined nếu niche chưa có
 *  preset. Caller phải merge với STORYTELLING_DEFAULTS để có giá trị
 *  đầy đủ. */
export function getNichePreset(niche: NicheKey): NichePreset | undefined {
  return NICHE_PRESETS[niche]
}
