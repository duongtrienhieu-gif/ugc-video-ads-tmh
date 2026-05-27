// ─────────────────────────────────────────────────────────────────────
// Image Semantics — deriveImageIntentPage (P9 top entry)
//
// VisualSemanticsPage → ImageIntentPage. Per-section enrichment.
// Mirrors deriveVisualSemanticsPage shape exactly. Pure function.
// Renderer-agnostic. No prompt generation.
// ─────────────────────────────────────────────────────────────────────

import type { VisualSemanticsPage } from '../../visualSemantics'
import type { ImageIntentPage, ImageIntentSection } from '../types'
import { deriveImageIntent } from './deriveImageIntent'
import { imageIntentCoherenceDetector } from '../validators/imageIntentCoherenceDetector'

/** Enrich VisualSemanticsPage with per-section image intent. */
export function deriveImageIntentPage(page: VisualSemanticsPage): ImageIntentPage {
  const enriched: ImageIntentSection[] = page.sections.map((section) => {
    const imageIntent = deriveImageIntent(section)
    return imageIntent === undefined
      ? { ...section }  // imageRole === 'none' → no imageIntent attached
      : { ...section, imageIntent }
  })

  const imageBearingSectionCount = enriched.filter((s) => s.imageIntent).length
  const imageIntentWarnings = imageIntentCoherenceDetector(enriched)

  return {
    ...page,
    sections: enriched,
    imageIntentWarnings,
    imageBearingSectionCount,
  }
}
