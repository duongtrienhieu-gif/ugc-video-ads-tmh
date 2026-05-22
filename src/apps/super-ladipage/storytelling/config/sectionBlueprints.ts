// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — section blueprints
//
// 10 section metadata. Source of truth cho narrative structure. KHÔNG
// chứa text — text gen runtime sẽ consume blueprint qua prompt builder.
// ─────────────────────────────────────────────────────────────────────

import type { SectionBlueprint, SectionId } from '../types'

export const SECTION_BLUEPRINTS: Record<SectionId, SectionBlueprint> = {
  'intro-portrait': {
    id: 'intro-portrait',
    order: 1,
    role: 'mở chuyện — giới thiệu nhân vật',
    emotionalBeat: 'calm-curious',
    textDensity: 'medium',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 1, isOptional: false },
    continuityRequirement: 'anchor',
    productVisibility: 'forbidden',
    overlayAllowance: 'chapter-marker',
    pacingPurpose: 'identity lock + world setup',
    curiosityGapAfter: false,
  },
  'ordinary-life': {
    id: 'ordinary-life',
    order: 2,
    role: 'cuộc sống bình thường + manh nha bất ổn',
    emotionalBeat: 'subtle-unease',
    textDensity: 'medium-high',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 1, isOptional: false },
    continuityRequirement: 'required',
    productVisibility: 'forbidden',
    overlayAllowance: 'never',
    pacingPurpose: 'world building + first unease seed',
    curiosityGapAfter: true,
  },
  'daily-friction': {
    id: 'daily-friction',
    order: 3,
    role: 'khó chịu lặp lại — niche-calibrated intensity',
    emotionalBeat: 'recurring-discomfort',
    textDensity: 'high',
    imageRequirement: { countDefault: 1, rangeMin: 0, rangeMax: 1, isOptional: true },
    continuityRequirement: 'required',
    productVisibility: 'forbidden',
    overlayAllowance: 'never',
    pacingPurpose: 'emotional anchor — pain calibrated to niche, never trauma',
    curiosityGapAfter: false,
  },
  'failed-attempts': {
    id: 'failed-attempts',
    order: 4,
    role: 'đã thử nhiều cách — không hiệu quả',
    emotionalBeat: 'frustration',
    textDensity: 'medium',
    imageRequirement: { countDefault: 1, rangeMin: 0, rangeMax: 1, isOptional: true },
    continuityRequirement: 'none',  // generic flat-lay, no face
    productVisibility: 'forbidden',  // chỉ object thất bại, KHÔNG sản phẩm chính
    overlayAllowance: 'never',
    pacingPurpose: 'frustration anchor',
    curiosityGapAfter: false,
  },
  'inner-realization': {
    id: 'inner-realization',
    order: 5,
    role: 'insight nội tâm — hiểu ra vấn đề',
    emotionalBeat: 'quiet-reflection',
    textDensity: 'high',
    imageRequirement: { countDefault: 0, rangeMin: 0, rangeMax: 0, isOptional: false },
    continuityRequirement: 'none',
    productVisibility: 'mentioned-only',  // có thể nhắc tên ở cuối section
    overlayAllowance: 'never',
    pacingPurpose: 'pure text breathing — emotional pause',
    curiosityGapAfter: true,
  },
  'discovery-moment': {
    id: 'discovery-moment',
    order: 6,
    role: 'cơ duyên gặp giải pháp',
    emotionalBeat: 'hesitant-curiosity',
    textDensity: 'medium-high',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 1, isOptional: false },
    continuityRequirement: 'optional',  // có thể over-shoulder / peripheral
    productVisibility: 'mentioned-only',
    overlayAllowance: 'never',
    pacingPurpose: 'pivotal moment — first hope seed',
    curiosityGapAfter: false,
  },
  'first-trial': {
    id: 'first-trial',
    order: 7,
    role: 'lần đầu thử — chưa kỳ vọng',
    emotionalBeat: 'tentative',
    textDensity: 'medium',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 1, isOptional: false },
    continuityRequirement: 'none',  // still-life product, no face
    productVisibility: 'still-life',  // FIRST visible appearance
    overlayAllowance: 'never',
    pacingPurpose: 'product reveal — modest still-life, not hero shot',
    curiosityGapAfter: true,
  },
  'subtle-change': {
    id: 'subtle-change',
    order: 8,
    role: 'dấu hiệu đầu tiên — nhẹ nhàng',
    emotionalBeat: 'first-hope',
    textDensity: 'medium',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 1, isOptional: false },
    continuityRequirement: 'required',
    productVisibility: 'subtle-background',
    overlayAllowance: 'time-marker',
    pacingPurpose: 'first uptick — quiet hope, not euphoria',
    curiosityGapAfter: false,
  },
  'new-normal': {
    id: 'new-normal',
    order: 9,
    role: 'cuộc sống mới — settled',
    emotionalBeat: 'acceptance-joy',
    textDensity: 'medium',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 2, isOptional: false },
    continuityRequirement: 'required',
    productVisibility: 'subtle-background',
    overlayAllowance: 'never',
    pacingPurpose: 'peak — calm acceptance, supporting character OK',
    curiosityGapAfter: false,
  },
  'sharing-invitation': {
    id: 'sharing-invitation',
    order: 10,
    role: 'chia sẻ + lời mời mở (soft CTA)',
    emotionalBeat: 'settled-resolve',
    textDensity: 'medium-high',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 1, isOptional: false },
    continuityRequirement: 'required',
    productVisibility: 'forbidden',  // KHÔNG product in frame
    overlayAllowance: 'never',
    pacingPurpose: 'closing — human invitation, NOT marketing CTA',
    curiosityGapAfter: false,
  },
}

/** Default ordering — Niche DNA có thể tweak (drop section, reorder). */
export const DEFAULT_SECTION_ORDER: SectionId[] = [
  'intro-portrait',
  'ordinary-life',
  'daily-friction',
  'failed-attempts',
  'inner-realization',
  'discovery-moment',
  'first-trial',
  'subtle-change',
  'new-normal',
  'sharing-invitation',
]
