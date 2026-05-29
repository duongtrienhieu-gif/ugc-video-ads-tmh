// ─────────────────────────────────────────────────────────────────────
// Composer — assignImageRole (P4)
//
// Determine image necessity + role per section. Reads density profile
// default + adjusts based on inline-proof presence.
//
// Renderer (later) decides actual image source / treatment based on
// imageRole + narrator + niche context.
//
// 2026-05-29 — Removed the `density === 'fragmented' → none` rule.
// Originally that rule was anti-fatigue: monolithic 5-6 sentence
// paragraphs were already heavy on mobile, so an extra image would
// pile on visual load. Post mobile-rhythm fix (length-mode), EVERY
// storytelling block is intentionally 3-5 short paragraphs for
// breathability — composer merges 2-3 blocks per composed section,
// so almost every composed section now has 6+ short paragraphs →
// density='fragmented' → image stripped → user saw 2 ảnh out of
// 6 expected. Images on short-paragraph sections actually REDUCE
// scroll fatigue (visual break), so the rule is now harmful.
// ─────────────────────────────────────────────────────────────────────

import type { SectionRole, SectionDensity, ImageRole } from '../types'
import { DENSITY_PROFILES } from '../config/densityProfiles'

/** Assign image role for section. Profile default unless density overrides. */
export function assignImageRole(
  role: SectionRole,
  _density: SectionDensity,
  hasInlineProof: boolean,
): ImageRole {
  const profileDefault = DENSITY_PROFILES[role].imageRole

  // If section has inline proof, image role may shift to proof-callout
  // (renderer can visualize proof piece instead of separate image).
  if (hasInlineProof && profileDefault !== 'hero-anchor' && profileDefault !== 'none') {
    return 'proof-callout'
  }

  // Profile default handles role-appropriate image needs:
  //   - hero-recognition       → hero-anchor
  //   - lived-experience       → mood-supporting
  //   - shared-struggle        → object-trace (flat-lay of failed attempts)
  //   - reframe-moment         → none (pure text — belief shift)
  //   - solution-opening       → lifestyle-context
  //   - transformation         → lifestyle-context
  //   - close-invitation       → none (pure text closing)
  //
  // So a typical pack gets ~5 image slots (hero + mood + object + 2 lifestyle)
  // plus 2 text-only sections (reframe + close), giving the marketer enough
  // visual variety without forcing every scroll moment to compete with an image.
  return profileDefault
}
