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

  // ── SEA-6 extensions (2026-05-27) — popular SEA market niches ──

  'dental-oral-care': {
    niche: 'dental-oral-care',
    emotionalIntensity: 'medium',       // social embarrassment (hơi thở / màu răng)
    productRevealSection: 6,            // dental is fast-acting trust — earlier reveal
    pacingType: 'steady',
    continuityPriority: 'high',
    preferredTreatments: ['smartphone-candid', 'domestic-observational', 'memory-snapshot'],
    ctaSoftness: 'quiet-suggestion',
    supportingCharacter: 'friend',      // friend hints / kid laughs at breath
    sectionCount: 10,
    imageCount: 9,
    recommendedCulturalWorld: ['vietnamese-urban', 'malay-muslim'],
  },

  'diabetes-blood-sugar': {
    niche: 'diabetes-blood-sugar',
    emotionalIntensity: 'medium',       // chronic anxiety, food anxiety
    productRevealSection: 7,            // slower trust — health serious
    pacingType: 'slow-burn',
    continuityPriority: 'high',
    preferredTreatments: ['domestic-observational', 'family-album', 'environmental-wide'],
    ctaSoftness: 'invitation-only',
    supportingCharacter: 'family',      // family worry, food cooked separately
    sectionCount: 11,
    imageCount: 10,
    recommendedCulturalWorld: ['vietnamese-urban', 'vietnamese-rural', 'malay-muslim'],
  },

  'liver-detox': {
    niche: 'liver-detox',
    emotionalIntensity: 'low',          // hidden / no visible symptom — quiet anxiety
    productRevealSection: 7,
    pacingType: 'slow-burn',
    continuityPriority: 'high',
    preferredTreatments: ['domestic-observational', 'family-album', 'memory-snapshot'],
    ctaSoftness: 'invitation-only',
    supportingCharacter: 'family',      // wife/husband notice yellowness / fatigue
    sectionCount: 10,
    imageCount: 9,
    recommendedCulturalWorld: ['vietnamese-urban', 'vietnamese-rural', 'malay-muslim'],
  },

  'prostate-urology': {
    niche: 'prostate-urology',
    emotionalIntensity: 'medium',       // silent shame male — urinary disruption
    productRevealSection: 7,
    pacingType: 'slow-burn',
    continuityPriority: 'high',
    preferredTreatments: ['domestic-observational', 'memory-snapshot', 'environmental-wide'],
    ctaSoftness: 'invitation-only',
    supportingCharacter: 'partner',     // wife notices nighttime trips
    sectionCount: 10,
    imageCount: 9,
    recommendedCulturalWorld: ['vietnamese-urban', 'vietnamese-rural', 'malay-muslim'],
  },

  'hemorrhoids-digestive-shame': {
    niche: 'hemorrhoids-digestive-shame',
    emotionalIntensity: 'medium',       // very hidden shame, bathroom suffering
    productRevealSection: 7,
    pacingType: 'slow-burn',
    continuityPriority: 'high',
    preferredTreatments: ['domestic-observational', 'memory-snapshot', 'imperfect-real'],
    ctaSoftness: 'invitation-only',
    supportingCharacter: 'none',        // very private — no supporting character
    sectionCount: 10,
    imageCount: 9,
    recommendedCulturalWorld: ['vietnamese-urban', 'vietnamese-rural', 'malay-muslim'],
  },

  'eye-vision-care': {
    niche: 'eye-vision-care',
    emotionalIntensity: 'low',          // screen fatigue — chronic but not crisis
    productRevealSection: 6,            // common pain — faster reveal acceptable
    pacingType: 'steady',
    continuityPriority: 'high',
    preferredTreatments: ['domestic-observational', 'smartphone-candid', 'memory-snapshot'],
    ctaSoftness: 'quiet-suggestion',
    supportingCharacter: 'family',      // kids noticing parent squinting
    sectionCount: 10,
    imageCount: 9,
    recommendedCulturalWorld: ['vietnamese-urban', 'malay-muslim'],
  },

  // ── SPEC-FIX (2026-05-27) — health-functional split ──

  'health-respiratory': {
    niche: 'health-respiratory',
    emotionalIntensity: 'medium',       // chronic discomfort — sleep + breath disruption
    productRevealSection: 7,
    pacingType: 'slow-burn',
    continuityPriority: 'high',
    preferredTreatments: ['domestic-observational', 'memory-snapshot', 'imperfect-real'],
    ctaSoftness: 'invitation-only',
    supportingCharacter: 'family',      // partner/family notice snoring/mouth-breathing
    sectionCount: 10,
    imageCount: 9,
    recommendedCulturalWorld: ['vietnamese-urban', 'malay-muslim'],
  },

  'health-joint': {
    niche: 'health-joint',
    emotionalIntensity: 'medium',       // mobility loss + dignity threat
    productRevealSection: 7,
    pacingType: 'slow-burn',
    continuityPriority: 'high',
    preferredTreatments: ['domestic-observational', 'environmental-wide', 'memory-snapshot'],
    ctaSoftness: 'invitation-only',
    supportingCharacter: 'family',      // children worry about parent
    sectionCount: 10,
    imageCount: 9,
    recommendedCulturalWorld: ['vietnamese-urban', 'vietnamese-rural', 'malay-muslim'],
  },

  'health-digestive': {
    niche: 'health-digestive',
    emotionalIntensity: 'medium',       // food anxiety + work disruption
    productRevealSection: 7,
    pacingType: 'slow-burn',
    continuityPriority: 'high',
    preferredTreatments: ['domestic-observational', 'memory-snapshot', 'imperfect-real'],
    ctaSoftness: 'invitation-only',
    supportingCharacter: 'family',      // family adjust meals
    sectionCount: 10,
    imageCount: 9,
    recommendedCulturalWorld: ['vietnamese-urban', 'malay-muslim'],
  },

  'health-cardiovascular': {
    niche: 'health-cardiovascular',
    emotionalIntensity: 'medium',       // mortality anxiety + lifestyle disruption
    productRevealSection: 8,            // slow trust — serious health
    pacingType: 'slow-burn',
    continuityPriority: 'high',
    preferredTreatments: ['domestic-observational', 'family-album', 'environmental-wide'],
    ctaSoftness: 'invitation-only',
    supportingCharacter: 'family',      // spouse/children worry
    sectionCount: 11,
    imageCount: 10,
    recommendedCulturalWorld: ['vietnamese-urban', 'malay-muslim'],
  },
}

/** Convenience getter — returns preset hoặc undefined nếu niche chưa có
 *  preset. Caller phải merge với STORYTELLING_DEFAULTS để có giá trị
 *  đầy đủ. */
export function getNichePreset(niche: NicheKey): NichePreset | undefined {
  return NICHE_PRESETS[niche]
}
