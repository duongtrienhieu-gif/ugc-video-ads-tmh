// ─────────────────────────────────────────────────────────────────────
// Render Contract — computeCtaPlacement (P5)
//
// Decides CTA visibility + placement intent per section:
//   - close-invitation always 'footer-emphasis' (final earned CTA)
//   - sections with ctaInline=true get 'inline-soft' (micro-commitment touch)
//   - transformation may get 'sticky-low-friction' if heavy scroll weight
//   - all other sections 'none'
// ─────────────────────────────────────────────────────────────────────

import type { ComposedSection } from '../../composer'
import type { CtaPlacement } from '../types'

/** Compute CTA placement for section. */
export function computeCtaPlacement(section: ComposedSection): CtaPlacement {
  // Final close — earned emphasis CTA
  if (section.role === 'close-invitation') {
    return 'footer-emphasis'
  }

  // Transformation section with heavy scroll → sticky low-friction CTA
  // (gives reader an exit option without breaking immersion)
  if (section.role === 'transformation' && section.scrollWeight === 'heavy') {
    return 'sticky-low-friction'
  }

  // Other sections with ctaInline touches woven in
  if (section.ctaInline) {
    return 'inline-soft'
  }

  return 'none'
}
