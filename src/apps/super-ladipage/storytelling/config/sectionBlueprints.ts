// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — section blueprints (v4.1)
//
// 11 sections — sales-functional conversion flow:
//   Hook → Friction → Fear → Failed → BeliefShift → SoftReveal →
//   MicroReward → Payoff → Reflection → TrustContinuity → SoftCTA
//
// Belief-shift = CONVERSION CORE (not product reveal). Trust-continuity
// uses reviews field for 3 mini quotes (no schema pollution).
//
// Image total target: 14 ảnh default (range 12-16). Section 1 = 2 ảnh
// (anchor + emotion-detail). Section 10 = 3 ảnh (mini testimonials).
// Section 3 + 5 prefer text-only or 1 image (breathing/pivot).
//
// Visual rhythm DIFFERENT per section — no uniform density.
// ─────────────────────────────────────────────────────────────────────

import type { SectionBlueprint, SectionId } from '../types'

export const SECTION_BLUEPRINTS: Record<SectionId, SectionBlueprint> = {
  'hook-interrupt': {
    id: 'hook-interrupt',
    order: 1,
    role: 'pattern-interrupt hook + identity anchor — reader recognizes self + fear',
    emotionalBeat: 'calm-curious',  // entry beat; intensity comes from snap line
    textDensity: 'medium',
    imageRequirement: { countDefault: 2, rangeMin: 1, rangeMax: 2, isOptional: false },
    continuityRequirement: 'anchor',
    productVisibility: 'forbidden',
    overlayAllowance: 'chapter-marker',
    pacingPurpose: 'emotional snap + immediate recognition — NO smooth descriptive opener',
    curiosityGapAfter: true,
    narrativeRole:        'hook',
    emotionalFunction:    'create-unrest',
    curiosityMechanic:    'small-moment-magnification',
    rhythmProfile:        'conversational',
    transitionPsychology: 'emotional-pull',
    tensionLevel:         6,
    retentionMechanic:    'micro-question',
    hookPattern:          'emotional-rejection',
    // v4.3 visual
    imagePurposeRoles:    ['anchor-face', 'emotion-detail'],
    cameraLanguage:       ['partial-face-observational', 'domestic-realism'],
  },

  'daily-friction': {
    id: 'daily-friction',
    order: 2,
    role: 'relatable daily struggles — micro-realism details (vịn cầu thang, xoa đầu gối...)',
    emotionalBeat: 'subtle-unease',
    textDensity: 'medium-high',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 2, isOptional: false },
    continuityRequirement: 'required',
    productVisibility: 'forbidden',
    overlayAllowance: 'never',
    pacingPurpose: 'daily friction with embodied micro-moments — relatable, not dramatic',
    curiosityGapAfter: true,
    narrativeRole:        'orientation',
    emotionalFunction:    'establish-recognition',
    curiosityMechanic:    'unstated-cause',
    rhythmProfile:        'conversational',
    transitionPsychology: 'thematic-echo',
    tensionLevel:         5,
    retentionMechanic:    'curiosity-debt',
    // v4.3 visual
    imagePurposeRoles:    ['emotion-detail'],
    cameraLanguage:       ['domestic-realism', 'partial-face-observational'],
  },

  'internal-fear': {
    id: 'internal-fear',
    order: 3,
    role: 'escalation + internal fear of decline',
    emotionalBeat: 'recurring-discomfort',
    textDensity: 'high',
    // Visual rhythm: prefer 0 (text breathing) or 1 silence-frame
    imageRequirement: { countDefault: 1, rangeMin: 0, rangeMax: 1, isOptional: true },
    continuityRequirement: 'optional',
    productVisibility: 'forbidden',
    overlayAllowance: 'never',
    pacingPurpose: 'internal fear monologue — quiet, observational, NOT trauma-level',
    curiosityGapAfter: false,
    narrativeRole:        'friction-loop',
    emotionalFunction:    'deepen-empathy',
    curiosityMechanic:    'small-moment-magnification',
    rhythmProfile:        'reflective-pause',
    transitionPsychology: 'emotional-pull',
    tensionLevel:         7,
    retentionMechanic:    'micro-question',
    // v4.3 visual
    imagePurposeRoles:    ['silence-frame'],
    cameraLanguage:       ['static-quiet-frame', 'environmental-distance'],
  },

  'failed-attempts': {
    id: 'failed-attempts',
    order: 4,
    role: 'frustration loop — tried many things, none worked',
    emotionalBeat: 'frustration',
    textDensity: 'medium',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 2, isOptional: false },
    continuityRequirement: 'optional',
    productVisibility: 'forbidden',
    overlayAllowance: 'never',
    pacingPurpose: 'object-storytelling flat-lay + frustration narrative',
    curiosityGapAfter: false,
    narrativeRole:        'frustration-anchor',
    emotionalFunction:    'deepen-empathy',
    curiosityMechanic:    'unresolved-pronoun',
    rhythmProfile:        'conversational',
    transitionPsychology: 'emotional-pull',
    tensionLevel:         7,
    retentionMechanic:    'emotional-contrast',
    // v4.3 visual — flat-lay of failed attempts
    imagePurposeRoles:    ['object-symbol'],
    cameraLanguage:       ['domestic-realism'],
  },

  // 🆕 v4 — CONVERSION CORE
  'belief-shift': {
    id: 'belief-shift',
    order: 5,
    role: 'AHA reinterpretation moment — CONVERSION CORE (not product reveal)',
    emotionalBeat: 'quiet-reflection',
    textDensity: 'high',
    // Visual rhythm: 1 memory-snapshot (cafe scene) — emotional pivot deserves visual weight
    imageRequirement: { countDefault: 1, rangeMin: 0, rangeMax: 1, isOptional: false },
    continuityRequirement: 'optional',
    productVisibility: 'mentioned-only',
    overlayAllowance: 'never',
    pacingPurpose: 'external catalyst (friend/family says) → reframe ("Có thể vấn đề không phải X, mà là Y") → permission to seek',
    curiosityGapAfter: true,
    narrativeRole:        'reflection-pause',
    emotionalFunction:    'invite-reflection',
    curiosityMechanic:    'open-loop',
    rhythmProfile:        'mixed',  // dialogue + reflection
    transitionPsychology: 'question-implicit',
    tensionLevel:         4,
    retentionMechanic:    'reveal-delay',
    // v4.3 visual — cafe scene memory-snapshot
    imagePurposeRoles:    ['memory-snapshot'],
    cameraLanguage:       ['over-shoulder-peripheral', 'static-quiet-frame'],
  },

  'soft-reveal': {
    id: 'soft-reveal',
    order: 6,
    role: 'reluctant product mention — low expectation, accidental discovery',
    emotionalBeat: 'tentative',
    textDensity: 'medium',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 1, isOptional: false },
    continuityRequirement: 'none',
    productVisibility: 'still-life',  // product ~15% of frame, domestic context
    overlayAllowance: 'never',
    pacingPurpose: 'reluctant tone ("tôi vốn cũng không kỳ vọng nhiều") — product brief, then return to inner monologue',
    curiosityGapAfter: true,
    narrativeRole:        'tentative-action',
    emotionalFunction:    'open-possibility',
    curiosityMechanic:    'open-loop',
    rhythmProfile:        'conversational',
    transitionPsychology: 'time-jump',
    tensionLevel:         5,
    retentionMechanic:    'micro-question',
    // v4.3 visual — product 15% frame in kitchen
    imagePurposeRoles:    ['product-presence'],
    cameraLanguage:       ['domestic-realism'],
  },

  'micro-reward': {
    id: 'micro-reward',
    order: 7,
    role: 'subtle initial improvement — dopamine cadence, NOT miracle',
    emotionalBeat: 'first-hope',
    textDensity: 'medium',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 2, isOptional: false },
    continuityRequirement: 'required',
    productVisibility: 'subtle-background',
    overlayAllowance: 'diary-timestamp',
    pacingPurpose: 'small specific wins noticed retrospectively ("một sáng tôi nhận ra không còn nghĩ tới đầu gối liên tục")',
    curiosityGapAfter: false,
    narrativeRole:        'micro-reward',
    emotionalFunction:    'reward-attention',
    curiosityMechanic:    'small-moment-magnification',
    rhythmProfile:        'long-flowing',
    transitionPsychology: 'resolution-settle',
    tensionLevel:         4,
    retentionMechanic:    'emotional-contrast',
    // v4.3 visual — morning rèm + walking outdoor
    imagePurposeRoles:    ['relief-lifestyle', 'environment'],
    cameraLanguage:       ['softer-wider-composition', 'breathing-warm-space'],
  },

  'emotional-payoff': {
    id: 'emotional-payoff',
    order: 8,
    role: 'life feels lighter — quality-of-life details',
    emotionalBeat: 'acceptance-joy',
    textDensity: 'medium',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 2, isOptional: false },
    continuityRequirement: 'required',
    productVisibility: 'subtle-background',
    overlayAllowance: 'never',
    pacingPurpose: 'quality of life felt through daily acts (đi siêu thị, nấu ăn) — not announced',
    curiosityGapAfter: false,
    narrativeRole:        'calm-payoff',
    emotionalFunction:    'settle-trust',
    curiosityMechanic:    'small-moment-magnification',
    rhythmProfile:        'mixed',
    transitionPsychology: 'thematic-echo',
    tensionLevel:         3,
    retentionMechanic:    'reveal-delay',
    // v4.3 visual — siêu thị with kids + cooking
    imagePurposeRoles:    ['relief-lifestyle', 'environment'],
    cameraLanguage:       ['breathing-warm-space', 'domestic-realism'],
  },

  // 🆕 v4 — Reflection + maturity
  'reflection-trust': {
    id: 'reflection-trust',
    order: 9,
    role: 'looking back + maturity — "có lẽ tôi nên nghe cơ thể sớm hơn"',
    emotionalBeat: 'quiet-reflection',
    textDensity: 'medium-high',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 1, isOptional: false },
    continuityRequirement: 'required',
    productVisibility: 'forbidden',  // section is about reader self-reflection, not product
    overlayAllowance: 'never',
    pacingPurpose: 'narrator looking back — quiet, not promotional. Product mention as anchor only',
    curiosityGapAfter: false,
    narrativeRole:        'calm-payoff',
    emotionalFunction:    'settle-trust',
    curiosityMechanic:    null,
    rhythmProfile:        'reflective-pause',
    transitionPsychology: 'emotional-pull',
    tensionLevel:         3,
    retentionMechanic:    'emotional-contrast',
    // v4.3 visual — quiet ban công / cửa sổ
    imagePurposeRoles:    ['silence-frame'],
    cameraLanguage:       ['static-quiet-frame', 'breathing-warm-space'],
  },

  // 🆕 v4 — Mini testimonials block
  'trust-continuity': {
    id: 'trust-continuity',
    order: 10,
    role: 'mini testimonials — 3 short quotes (uses reviews field). Casual FB-comment vibe, NOT testimonial block',
    emotionalBeat: 'settled-resolve',
    textDensity: 'low',  // 3 short blocks, not paragraphs
    imageRequirement: { countDefault: 3, rangeMin: 2, rangeMax: 3, isOptional: false },
    continuityRequirement: 'none',  // mini testimonials are different voices
    productVisibility: 'still-life',  // 1 of 3 images = product clean shot
    overlayAllowance: 'never',
    pacingPurpose: '3 scattered FB-like comments — different voices, imperfect writing, emotional validation',
    curiosityGapAfter: false,
    narrativeRole:        'calm-payoff',
    emotionalFunction:    'settle-trust',
    curiosityMechanic:    null,
    rhythmProfile:        'short-clipped',  // testimonial fragments
    transitionPsychology: 'resolution-settle',
    tensionLevel:         2,
    retentionMechanic:    null,
    // v4.3 visual — 3 mini images: emotion-detail (lifestyle candid) + relief-lifestyle (action) + product-presence (clean shot)
    imagePurposeRoles:    ['emotion-detail', 'relief-lifestyle', 'product-presence'],
    cameraLanguage:       ['domestic-realism', 'breathing-warm-space'],
  },

  'soft-cta': {
    id: 'soft-cta',
    order: 11,
    role: 'human emotional closure — reflective invitation, NOT marketing CTA',
    emotionalBeat: 'settled-resolve',
    textDensity: 'medium-high',
    imageRequirement: { countDefault: 1, rangeMin: 1, rangeMax: 1, isOptional: false },
    continuityRequirement: 'required',
    productVisibility: 'forbidden',
    overlayAllowance: 'never',
    pacingPurpose: 'soft human invitation — "bạn không phải người duy nhất trải qua cảm giác đó"',
    curiosityGapAfter: false,
    narrativeRole:        'quiet-closure',
    emotionalFunction:    'invite-co-presence',
    curiosityMechanic:    null,
    rhythmProfile:        'conversational',
    transitionPsychology: 'resolution-settle',
    tensionLevel:         2,
    retentionMechanic:    null,
    // v4.3 visual — landscape closure OR window-out
    imagePurposeRoles:    ['silence-frame'],
    cameraLanguage:       ['breathing-warm-space', 'static-quiet-frame'],
  },
}

/** Default ordering — 11 sections. */
export const DEFAULT_SECTION_ORDER: SectionId[] = [
  'hook-interrupt',
  'daily-friction',
  'internal-fear',
  'failed-attempts',
  'belief-shift',
  'soft-reveal',
  'micro-reward',
  'emotional-payoff',
  'reflection-trust',
  'trust-continuity',
  'soft-cta',
]
