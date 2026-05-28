// ─────────────────────────────────────────────────────────────────────
// Composer — assignImageRole (P4)
//
// Determine image necessity + role per section. Reads density profile
// default + adjusts based on density (heavy text → drop image to reduce
// fatigue; light text → ensure image keeps section anchored).
//
// Renderer (later) decides actual image source / treatment based on
// imageRole + narrator + niche context.
// ─────────────────────────────────────────────────────────────────────

import type { SectionRole, SectionDensity, ImageRole } from '../types'
import { DENSITY_PROFILES } from '../config/densityProfiles'

/** Assign image role for section. Profile default unless density overrides. */
export function assignImageRole(
  role: SectionRole,
  density: SectionDensity,
  hasInlineProof: boolean,
): ImageRole {
  const profileDefault = DENSITY_PROFILES[role].imageRole

  // If section has inline proof, image role may shift to proof-callout
  // (renderer can visualize proof piece instead of separate image).
  if (hasInlineProof && profileDefault !== 'hero-anchor' && profileDefault !== 'none') {
    return 'proof-callout'
  }

  // Fragmented density (many paragraphs, dense text) → drop image to
  // reduce mobile fatigue. Exception: hero must always have image.
  if (density === 'fragmented' && profileDefault !== 'hero-anchor') {
    return 'none'
  }

  return profileDefault
}
