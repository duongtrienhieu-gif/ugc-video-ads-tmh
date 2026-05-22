// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — section blueprints (P0.5.4 realignment)
//
// REALIGNED for storyselling: each section has sales-functional objective.
// Question per section: "How does this section improve conversion?"
//
// Rhythm changes:
//   - 'fragmented' DROPPED entirely (no usage)
//   - 'short-clipped' restricted to rare emphasis only (no section uses it
//     as default rhythm)
//   - 'conversational' now DEFAULT for most sections (was rare)
//   - 'long-flowing' for reflective sections (was 'fragmented')
//   - 'reflective-pause' for interior monologue sections
//   - 'mixed' for sections needing dialogue + narrative
//
// Adjacent rhythm rule LOOSENED — readability > variance.
// ─────────────────────────────────────────────────────────────────────

import type { SectionBlueprint, SectionId } from '../types'

export const SECTION_BLUEPRINTS: Record<SectionId, SectionBlueprint> = {
  'intro-portrait': {
    id: 'intro-portrait',
    order: 1,
    role: 'self-insertion hook — reader recognizes self + pain',
    emotionalBeat: 'calm-curious',
    textDensity: 'medium',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 1, isOptional: false },
    continuityRequirement: 'anchor',
    productVisibility: 'forbidden',
    overlayAllowance: 'chapter-marker',
    pacingPurpose: 'pull reader into recognition via 1st-person confession with named pain',
    curiosityGapAfter: true,
    // v4 dynamics — REALIGNED
    narrativeRole:        'hook',
    emotionalFunction:    'establish-recognition',  // was create-unrest — now recognition primary
    curiosityMechanic:    'observation-anomaly',
    rhythmProfile:        'conversational',         // was short-clipped — TOO clipped for storyselling
    transitionPsychology: 'emotional-pull',
    tensionLevel:         4,
    retentionMechanic:    'micro-question',
    hookPattern:          'subtle-detail',          // self-insertion confession (reuse enum)
  },

  'ordinary-life': {
    id: 'ordinary-life',
    order: 2,
    role: 'shared context — daily moments reader knows',
    emotionalBeat: 'subtle-unease',
    textDensity: 'medium-high',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 1, isOptional: false },
    continuityRequirement: 'required',
    productVisibility: 'forbidden',
    overlayAllowance: 'never',
    pacingPurpose: 'build relatability via concrete daily details narrated in 1st person',
    curiosityGapAfter: true,
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
    role: 'pain articulation — specific symptoms named',
    emotionalBeat: 'recurring-discomfort',
    textDensity: 'high',
    imageRequirement: { countDefault: 1, rangeMin: 0, rangeMax: 1, isOptional: true },
    continuityRequirement: 'required',
    productVisibility: 'forbidden',
    overlayAllowance: 'never',
    pacingPurpose: 'specific concrete pain symptoms — reader recognizes own experience',
    curiosityGapAfter: false,
    narrativeRole:        'friction-loop',
    emotionalFunction:    'deepen-empathy',
    curiosityMechanic:    'small-moment-magnification',
    rhythmProfile:        'conversational',          // was 'fragmented' — DROPPED
    transitionPsychology: 'emotional-pull',
    tensionLevel:         7,
    retentionMechanic:    'micro-question',
  },

  'failed-attempts': {
    id: 'failed-attempts',
    order: 4,
    role: 'validate frustration — tôi đã thử X, Y, Z',
    emotionalBeat: 'frustration',
    textDensity: 'medium',
    imageRequirement: { countDefault: 1, rangeMin: 0, rangeMax: 1, isOptional: true },
    continuityRequirement: 'none',
    productVisibility: 'forbidden',
    overlayAllowance: 'never',
    pacingPurpose: 'validate reader effort — narrated failed attempts in conversational list',
    curiosityGapAfter: false,
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
    role: 'permission to seek solution — quiet realization',
    emotionalBeat: 'quiet-reflection',
    textDensity: 'high',
    imageRequirement: { countDefault: 0, rangeMin: 0, rangeMax: 0, isOptional: false },
    continuityRequirement: 'none',
    productVisibility: 'mentioned-only',
    overlayAllowance: 'never',
    pacingPurpose: 'interior monologue giving permission to seek help — không drama, không enlightenment',
    curiosityGapAfter: true,
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
    role: 'natural bridge to product via trusted source',
    emotionalBeat: 'hesitant-curiosity',
    textDensity: 'medium-high',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 1, isOptional: false },
    continuityRequirement: 'optional',
    productVisibility: 'mentioned-only',
    overlayAllowance: 'never',
    pacingPurpose: 'discovery via family/friend — natural mention, NOT doctor/expert authority',
    curiosityGapAfter: false,
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
    role: 'honest tentative engagement — không kỳ vọng cao',
    emotionalBeat: 'tentative',
    textDensity: 'medium',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 1, isOptional: false },
    continuityRequirement: 'none',
    productVisibility: 'still-life',
    overlayAllowance: 'never',
    pacingPurpose: 'first try with realistic low expectations — relatable hesitation',
    curiosityGapAfter: true,
    narrativeRole:        'tentative-action',
    emotionalFunction:    'open-possibility',
    curiosityMechanic:    'open-loop',
    rhythmProfile:        'conversational',          // was short-clipped — too clipped
    transitionPsychology: 'time-jump',
    tensionLevel:         4,
    retentionMechanic:    'micro-question',
  },

  'subtle-change': {
    id: 'subtle-change',
    order: 8,
    role: 'believable initial change — small specific wins',
    emotionalBeat: 'first-hope',
    textDensity: 'medium',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 1, isOptional: false },
    continuityRequirement: 'required',
    productVisibility: 'subtle-background',
    overlayAllowance: 'diary-timestamp',
    pacingPurpose: 'small specific changes noticed retrospectively — believable, NOT miracle',
    curiosityGapAfter: false,
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
    role: 'sustained result — daily life difference',
    emotionalBeat: 'acceptance-joy',
    textDensity: 'medium',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 2, isOptional: false },
    continuityRequirement: 'required',
    productVisibility: 'subtle-background',
    overlayAllowance: 'never',
    pacingPurpose: 'settled normal — payoff felt through daily detail, NOT announced',
    curiosityGapAfter: false,
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
    role: 'natural recommendation — warm invitation, NOT hard CTA',
    emotionalBeat: 'settled-resolve',
    textDensity: 'medium-high',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 1, isOptional: false },
    continuityRequirement: 'required',
    productVisibility: 'forbidden',
    overlayAllowance: 'never',
    pacingPurpose: 'warm peer invitation — share what helped, không sales push',
    curiosityGapAfter: false,
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
