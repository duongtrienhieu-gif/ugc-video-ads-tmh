// ─────────────────────────────────────────────────────────────────────
// Prompt Translation — translateImageIntentPage (P10 top entry)
//
// ImageIntentPage → ImagePromptPage. Per-section enrichment. Mirrors
// deriveImageIntentPage shape. Pure function. Renderer-agnostic.
// ─────────────────────────────────────────────────────────────────────

import type { ImageIntentPage } from '../../imageSemantics'
import type { ImagePromptPage, ImagePromptSection } from '../types'
import { translateImageIntent } from './translateImageIntent'
import { promptContractValidator } from '../validators/promptContractValidator'

/** Enrich ImageIntentPage with per-section ImagePromptContract. */
export function translateImageIntentPage(page: ImageIntentPage): ImagePromptPage {
  const enriched: ImagePromptSection[] = page.sections.map((section) => {
    if (!section.imageIntent) {
      return { ...section }  // no imageIntent → no promptContract
    }
    return {
      ...section,
      imagePromptContract: translateImageIntent(section.imageIntent),
    }
  })

  const promptBearingSectionCount = enriched.filter((s) => s.imagePromptContract).length
  const promptContractWarnings = promptContractValidator(enriched)

  return {
    ...page,
    sections: enriched,
    promptContractWarnings,
    promptBearingSectionCount,
  }
}
