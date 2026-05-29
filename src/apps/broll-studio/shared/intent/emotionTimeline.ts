// ── Emotion Timeline (P4) ──────────────────────────────────────────────────
//
// Default emotional arc for a storytelling pack. The orchestrator threads
// this through NarrativeContext so each section knows its emotional stage.
// Modules embed it into a [EMOTION] prompt block.

import type { EmotionalState, SectionRole } from '../../types/narrative'

/**
 * Mapping section role → recommended emotional state. Used when the form
 * doesn't override emotionalState explicitly.
 */
export const DEFAULT_EMOTION_BY_ROLE: Record<SectionRole, EmotionalState> = {
  pain:                'frustration',
  storytelling_intro:  'fatigue',
  lifestyle:           'curiosity',
  social_proof:        'hope',
  product_showcase:    'improvement',
  before_after:        'improvement',
  offer:               'confidence',
  cta:                 'happiness',
}

/** Free-form prompt fragment per emotional state. */
export const EMOTION_PROMPTS: Record<EmotionalState, string> = {
  frustration: 'Subtle frustration — furrowed brow, tired posture, no smile.',
  fatigue:     'Genuine fatigue — slumped shoulders, dull skin, tired eyes.',
  hope:        'Quiet hope — slight upward gaze, faint smile beginning to form.',
  curiosity:   'Curiosity — attentive look, slight head tilt, neutral mouth.',
  improvement: 'Visible improvement — brighter skin, more confident posture, soft genuine smile.',
  confidence:  'Confidence — direct gaze to camera, relaxed shoulders, calm pride.',
  happiness:   'Genuine happiness — real smile reaching the eyes, relaxed energy.',
  neutral:     'Neutral expression — calm, no strong emotion in either direction.',
}

export function buildEmotionBlock(state: EmotionalState): string {
  return `[EMOTION]\n${EMOTION_PROMPTS[state]}`
}

/**
 * Suggest emotional state given role + position in pack. Position lets us
 * vary within a role (early lifestyle = curiosity, late lifestyle = hope).
 */
export function suggestEmotion(
  role: SectionRole,
  sectionIndex?: number,
  totalSections?: number,
): EmotionalState {
  const base = DEFAULT_EMOTION_BY_ROLE[role]
  if (sectionIndex == null || totalSections == null || totalSections < 2) return base
  const progress = sectionIndex / Math.max(1, totalSections - 1)
  // Late-pack lifestyle leans hopeful; late-pack pain stays frustrated.
  if (role === 'lifestyle' && progress > 0.5) return 'hope'
  if (role === 'social_proof' && progress > 0.5) return 'improvement'
  return base
}
