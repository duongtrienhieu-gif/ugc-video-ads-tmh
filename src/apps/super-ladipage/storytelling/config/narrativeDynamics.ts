// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — narrative dynamics instructions
//
// v4 layer: per-section function injection cho runtime prompt builder
// (Phase 5). Each value = 1-line distilled instruction. Tránh prose
// dài — token-safe.
//
// Pattern: prompt builder pick mỗi section's role/function/mechanic/
// transition và inject 4 dòng compact directives.
// ─────────────────────────────────────────────────────────────────────

import type {
  CuriosityMechanic, EmotionalFunction, NarrativeRole, TransitionPsychology,
} from '../types'

/** Per-role 1-line directives. Runtime injects 1 dòng per section. */
export const NARRATIVE_ROLE_INSTRUCTIONS: Record<NarrativeRole, string> = {
  'hook':
    'open with anomaly/observation — NO bio/name/age/routine intro',
  'orientation':
    'establish world + identity AFTER hook, via context not statement',
  'friction-loop':
    'show recurring micro-pain — repetition is the form, not the topic',
  'frustration-anchor':
    'emotional bottom — quiet exhaustion, NEVER trauma/medical despair',
  'reflection-pause':
    'pure text breathing — insight emerges, not announced',
  'curiosity-spark':
    'pivotal moment — discovery via someone else, never via doctor/expert',
  'tentative-action':
    'first try — uncertain, hedged, no commitment language',
  'micro-reward':
    'first sign of change — small, real, retroactively noticed',
  'calm-payoff':
    'sustained — settled tone, callback to early motif',
  'quiet-closure':
    'soft invitation — human peer, NEVER marketing CTA',
}

/** What section DOES to reader. Inject as guidance to text generator. */
export const EMOTIONAL_FUNCTION_INSTRUCTIONS: Record<EmotionalFunction, string> = {
  'create-unrest':
    'leave reader with unanswered question within first 3 lines',
  'establish-recognition':
    'make reader see themselves — daily details, not exposition',
  'deepen-empathy':
    'empathy via repetition + small moments, not via suffering escalation',
  'invite-reflection':
    'slow down, let reader\'s own mind continue the thought',
  'open-possibility':
    'hope without promise — never use "guarantee" / "miracle" / "instant"',
  'reward-attention':
    'small payoff to patient reader — callback earlier detail',
  'settle-trust':
    'bond stabilizes — quiet, settled, payoff felt not announced',
  'invite-co-presence':
    'reader feels invited as peer — NOT addressed as customer',
}

/** Curiosity device — subtle pull. Anti-cliffhanger restraint. */
export const CURIOSITY_MECHANIC_INSTRUCTIONS: Record<CuriosityMechanic, string> = {
  'observation-anomaly':
    'someone noticed something — open with the witness, not the subject',
  'unresolved-pronoun':
    'use "he/she/anh ấy" without immediate antecedent — reader fills in',
  'open-loop':
    'end mid-arc — let the closing line dangle, no resolution',
  'unstated-cause':
    'show effect, withhold cause — reader\'s mind reaches for it',
  'time-jump-tease':
    'reference future state ("sau này...", "ngày đó...") to hint reveal',
  'small-moment-magnification':
    'give weight to tiny detail — make reader wonder why this matters',
}

/** Hand-off psychology. Determines closing line's feel. */
export const TRANSITION_PSYCHOLOGY_INSTRUCTIONS: Record<TransitionPsychology, string> = {
  'open-loop':
    'unresolved phrase ends section — answer comes later',
  'silent-cut':
    'hard stop on a fact — let silence carry to next section',
  'time-jump':
    'closing line implies time passes ("đêm đó", "tuần sau")',
  'thematic-echo':
    'callback to earlier motif — quiet recognition',
  'question-implicit':
    'closing forms reader\'s own question — never ask it directly',
  'emotional-pull':
    'feeling lingers — section ends in mid-feeling not mid-action',
  'resolution-settle':
    'closure section only — no pull, just settled tone',
}

/** Compose 4-line directive block per section. Phase 5 prompt builder
 *  calls this to inject distilled flags into pack-gen prompt. */
export function composeDynamicsDirective(
  role: NarrativeRole,
  fn: EmotionalFunction,
  mech: CuriosityMechanic | null,
  trans: TransitionPsychology,
): string {
  const lines = [
    `ROLE: ${NARRATIVE_ROLE_INSTRUCTIONS[role]}`,
    `FUNCTION: ${EMOTIONAL_FUNCTION_INSTRUCTIONS[fn]}`,
    mech ? `CURIOSITY: ${CURIOSITY_MECHANIC_INSTRUCTIONS[mech]}` : null,
    `TRANSITION: ${TRANSITION_PSYCHOLOGY_INSTRUCTIONS[trans]}`,
  ].filter((x): x is string => x !== null)
  return lines.join('\n')
}
