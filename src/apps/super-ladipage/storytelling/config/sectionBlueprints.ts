// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — section blueprints (v4)
//
// 10 section metadata. Source of truth cho narrative structure +
// narrative dynamics (role / function / curiosity / rhythm / transition
// / tension / retention).
//
// Anti-monotony invariant: adjacent sections KHÔNG được cùng rhythmProfile.
// Validator: rhythmVariance.validateAdjacentRhythms()
//
// Text gen runtime consume blueprint qua prompt builder — KHÔNG hardcode
// text. KHÔNG hardcode philosophy.
// ─────────────────────────────────────────────────────────────────────

import type { SectionBlueprint, SectionId } from '../types'

export const SECTION_BLUEPRINTS: Record<SectionId, SectionBlueprint> = {
  'intro-portrait': {
    id: 'intro-portrait',
    order: 1,
    role: 'mở chuyện — observation hook',
    emotionalBeat: 'calm-curious',
    textDensity: 'medium',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 1, isOptional: false },
    continuityRequirement: 'anchor',
    productVisibility: 'forbidden',
    overlayAllowance: 'chapter-marker',
    pacingPurpose: 'hook + identity-by-context (no bio intro)',
    curiosityGapAfter: true,
    // ── v4 dynamics ──
    narrativeRole:        'hook',
    emotionalFunction:    'create-unrest',
    curiosityMechanic:    'observation-anomaly',
    rhythmProfile:        'short-clipped',
    transitionPsychology: 'open-loop',
    tensionLevel:         4,
    retentionMechanic:    'micro-question',
    hookPattern:          'observation-first',
  },

  'ordinary-life': {
    id: 'ordinary-life',
    order: 2,
    role: 'cuộc sống bình thường + subtle wrongness',
    emotionalBeat: 'subtle-unease',
    textDensity: 'medium-high',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 1, isOptional: false },
    continuityRequirement: 'required',
    productVisibility: 'forbidden',
    overlayAllowance: 'never',
    pacingPurpose: 'world + identity reveal via context, wrongness embedded',
    curiosityGapAfter: true,
    // ── v4 dynamics ──
    narrativeRole:        'orientation',
    emotionalFunction:    'establish-recognition',
    curiosityMechanic:    'unstated-cause',
    rhythmProfile:        'long-flowing',
    transitionPsychology: 'thematic-echo',
    tensionLevel:         5,
    retentionMechanic:    'curiosity-debt',
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
    pacingPurpose: 'friction loop — repetition IS the form, NOT trauma',
    curiosityGapAfter: false,
    // ── v4 dynamics ──
    narrativeRole:        'friction-loop',
    emotionalFunction:    'deepen-empathy',
    curiosityMechanic:    'small-moment-magnification',
    rhythmProfile:        'fragmented',
    transitionPsychology: 'silent-cut',
    tensionLevel:         7,
    retentionMechanic:    'micro-question',
  },

  'failed-attempts': {
    id: 'failed-attempts',
    order: 4,
    role: 'đã thử nhiều cách — frustration anchor',
    emotionalBeat: 'frustration',
    textDensity: 'medium',
    imageRequirement: { countDefault: 1, rangeMin: 0, rangeMax: 1, isOptional: true },
    continuityRequirement: 'none',
    productVisibility: 'forbidden',
    overlayAllowance: 'never',
    pacingPurpose: 'frustration anchor — quiet exhaustion, NOT dramatic',
    curiosityGapAfter: false,
    // ── v4 dynamics ──
    narrativeRole:        'frustration-anchor',
    emotionalFunction:    'deepen-empathy',
    curiosityMechanic:    'unresolved-pronoun',
    rhythmProfile:        'conversational',
    transitionPsychology: 'emotional-pull',
    tensionLevel:         8,
    retentionMechanic:    'emotional-contrast',
  },

  'inner-realization': {
    id: 'inner-realization',
    order: 5,
    role: 'insight nội tâm — reflection pause',
    emotionalBeat: 'quiet-reflection',
    textDensity: 'high',
    imageRequirement: { countDefault: 0, rangeMin: 0, rangeMax: 0, isOptional: false },
    continuityRequirement: 'none',
    productVisibility: 'mentioned-only',
    overlayAllowance: 'never',
    pacingPurpose: 'pure text breathing — release valve in tension curve',
    curiosityGapAfter: true,
    // ── v4 dynamics ──
    narrativeRole:        'reflection-pause',
    emotionalFunction:    'invite-reflection',
    curiosityMechanic:    'open-loop',
    rhythmProfile:        'reflective-pause',
    transitionPsychology: 'question-implicit',
    tensionLevel:         3,
    retentionMechanic:    'reveal-delay',
  },

  'discovery-moment': {
    id: 'discovery-moment',
    order: 6,
    role: 'cơ duyên gặp giải pháp — curiosity spark',
    emotionalBeat: 'hesitant-curiosity',
    textDensity: 'medium-high',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 1, isOptional: false },
    continuityRequirement: 'optional',
    productVisibility: 'mentioned-only',
    overlayAllowance: 'never',
    pacingPurpose: 'pivotal moment via someone close, NOT doctor/expert',
    curiosityGapAfter: false,
    // ── v4 dynamics ──
    narrativeRole:        'curiosity-spark',
    emotionalFunction:    'open-possibility',
    curiosityMechanic:    'unstated-cause',
    rhythmProfile:        'mixed',
    transitionPsychology: 'time-jump',
    tensionLevel:         5,
    retentionMechanic:    'section-end-pull',
  },

  'first-trial': {
    id: 'first-trial',
    order: 7,
    role: 'lần đầu thử — tentative action',
    emotionalBeat: 'tentative',
    textDensity: 'medium',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 1, isOptional: false },
    continuityRequirement: 'none',
    productVisibility: 'still-life',
    overlayAllowance: 'never',
    pacingPurpose: 'product reveal — modest still-life, NOT hero shot',
    curiosityGapAfter: true,
    // ── v4 dynamics ──
    narrativeRole:        'tentative-action',
    emotionalFunction:    'open-possibility',
    curiosityMechanic:    'open-loop',
    rhythmProfile:        'short-clipped',
    transitionPsychology: 'time-jump',
    tensionLevel:         4,
    retentionMechanic:    'micro-question',
  },

  'subtle-change': {
    id: 'subtle-change',
    order: 8,
    role: 'dấu hiệu đầu tiên — micro reward',
    emotionalBeat: 'first-hope',
    textDensity: 'medium',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 1, isOptional: false },
    continuityRequirement: 'required',
    productVisibility: 'subtle-background',
    overlayAllowance: 'diary-timestamp',
    pacingPurpose: 'first uptick — small, real, retroactively noticed',
    curiosityGapAfter: false,
    // ── v4 dynamics ──
    narrativeRole:        'micro-reward',
    emotionalFunction:    'reward-attention',
    curiosityMechanic:    'small-moment-magnification',
    rhythmProfile:        'long-flowing',
    transitionPsychology: 'resolution-settle',
    tensionLevel:         3,
    retentionMechanic:    'emotional-contrast',
  },

  'new-normal': {
    id: 'new-normal',
    order: 9,
    role: 'cuộc sống mới — calm payoff',
    emotionalBeat: 'acceptance-joy',
    textDensity: 'medium',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 2, isOptional: false },
    continuityRequirement: 'required',
    productVisibility: 'subtle-background',
    overlayAllowance: 'never',
    pacingPurpose: 'sustained — callback to early motif, payoff felt not announced',
    curiosityGapAfter: false,
    // ── v4 dynamics ──
    // Note: thematic callback (section 1 husband dialogue → section 9 settled
    // dialogue) is handled at TransitionPsychology level. CuriosityMechanic
    // here is small-moment-magnification — "Em ngủ ngon" carries weight
    // disproportionate to its 3 words.
    narrativeRole:        'calm-payoff',
    emotionalFunction:    'settle-trust',
    curiosityMechanic:    'small-moment-magnification',
    rhythmProfile:        'mixed',
    transitionPsychology: 'thematic-echo',
    tensionLevel:         2,
    retentionMechanic:    'reveal-delay',
  },

  'sharing-invitation': {
    id: 'sharing-invitation',
    order: 10,
    role: 'lời mời mở — quiet closure',
    emotionalBeat: 'settled-resolve',
    textDensity: 'medium-high',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 1, isOptional: false },
    continuityRequirement: 'required',
    productVisibility: 'forbidden',
    overlayAllowance: 'never',
    pacingPurpose: 'soft invitation — human peer, NEVER marketing CTA',
    curiosityGapAfter: false,
    // ── v4 dynamics ──
    narrativeRole:        'quiet-closure',
    emotionalFunction:    'invite-co-presence',
    curiosityMechanic:    null,
    rhythmProfile:        'conversational',
    transitionPsychology: 'resolution-settle',
    tensionLevel:         2,
    retentionMechanic:    null,
  },
}

/** Default ordering — Niche DNA có thể tweak. */
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
