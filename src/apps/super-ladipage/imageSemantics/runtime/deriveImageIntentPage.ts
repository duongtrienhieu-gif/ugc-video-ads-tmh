// ─────────────────────────────────────────────────────────────────────
// Image Semantics — deriveImageIntentPage (POST-REBUILD slim version)
//
// VisualSemanticsPage → ImageIntentPage. Slimmed to just carry imageRole
// through. Per-image prompts are now produced by imageSceneSynthesis,
// NOT by axis-driven fragment lookup tables.
// ─────────────────────────────────────────────────────────────────────

import type { VisualSemanticsPage } from '../../visualSemantics'
import type { ImageIntentPage, ImageIntentSection, ImageIntent } from '../types'

export function deriveImageIntentPage(page: VisualSemanticsPage): ImageIntentPage {
  const enriched: ImageIntentSection[] = page.sections.map((section) => {
    if (section.imageRole === 'none') {
      return { ...section }
    }
    const imageIntent: ImageIntent = {
      imageRole: section.imageRole,
      intentNote: `Image planned for section ${section.id} (role=${section.imageRole}). Prompt produced at exec-time by scene synthesis.`,
    }
    return { ...section, imageIntent }
  })

  const imageBearingSectionCount = enriched.filter((s) => s.imageIntent).length

  return {
    ...page,
    sections: enriched,
    imageIntentWarnings: [],
    imageBearingSectionCount,
  }
}
