// ─────────────────────────────────────────────────────────────────────
// Composer — computeTransitions (P4)
//
// ⚠️ INTERNAL ONLY — transitionHint NEVER becomes visible copy.
//
// Used by renderer (future) for:
//   - pacing continuity awareness
//   - spacing logic between sections
//   - emotional flow tracking
//   - render decisions (e.g., extra breathing space if "pause" transition)
//
// LOCKED: never render transitionHint text in user-visible output.
// No "bây giờ chúng ta chuyển sang..." copy. Hint is metadata.
// ─────────────────────────────────────────────────────────────────────

import type { SectionRole } from '../types'

/** Map (current role → next role) to emotional transition hint.
 *  INTERNAL renderer guidance only. */
const TRANSITION_HINTS: Record<string, string> = {
  // Hero → Lived experience: from impact moment to embodied evidence
  'hero-recognition→lived-experience':
    'reader recognized self in 3 seconds → now needs lived evidence to confirm',

  // Lived → Shared struggle: from "this is me" to "I'm not alone"
  'lived-experience→shared-struggle':
    'reader felt seen → now needs narrator validation + shared frustration',

  // Shared → Reframe: from frustration to insight pause
  'shared-struggle→reframe-moment':
    'frustration loop established → quiet pause for belief reframe (needs breathing space)',

  // Reframe → Solution: from insight to natural product opening
  'reframe-moment→solution-opening':
    'belief shifted → product emerges through felt-difference (dissolved entry)',

  // Solution → Transformation: from understanding to future-self projection
  'solution-opening→transformation':
    'mechanism understood → reader projects forward via narrator transformation',

  // Transformation → Close: from future imagination to invitation
  'transformation→close-invitation':
    'reader imagined future-self → soft invitation lands as earned next step',
}

/** Generic fallback for unmapped transitions. */
const FALLBACK_HINT = 'emotional continuation — maintain narrative momentum'

/** Get transition hint from current section to next section.
 *  INTERNAL ONLY — never render this as visible text. */
export function computeTransitionHint(
  currentRole: SectionRole,
  nextRole: SectionRole | null,
): string {
  if (!nextRole) {
    return 'final section — close page, no further transition'
  }
  const key = `${currentRole}→${nextRole}`
  return TRANSITION_HINTS[key] ?? FALLBACK_HINT
}
