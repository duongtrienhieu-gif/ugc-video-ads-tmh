// ─────────────────────────────────────────────────────────────────────
// Prompt Translation — translateImageIntentPage (POST-REBUILD no-op)
//
// Fragment-stacking pipeline DELETED 2026-05-27. Per-image prompts now
// come from imageSceneSynthesis at exec time. This function survives
// only as a pass-through to preserve the export subtype chain.
//
// Each section with an imageIntent gets an EMPTY ImagePromptContract
// (placeholder). Downstream uses sceneDescription, not these fragments.
// ─────────────────────────────────────────────────────────────────────

import type { ImageIntentPage } from '../../imageSemantics'
import type { ImagePromptPage, ImagePromptSection, ImagePromptContract } from '../types'

const EMPTY_CONTRACT: ImagePromptContract = {
  positiveFragments: [],
  negativeFragments: [],
  realismFragments: [],
  compositionFragments: [],
  atmosphereFragments: [],
  avoidanceFragments: [],
}

export function translateImageIntentPage(page: ImageIntentPage): ImagePromptPage {
  const enriched: ImagePromptSection[] = page.sections.map((section) => {
    if (!section.imageIntent) {
      return { ...section }
    }
    return { ...section, imagePromptContract: EMPTY_CONTRACT }
  })

  const promptBearingSectionCount = enriched.filter((s) => s.imagePromptContract).length

  return {
    ...page,
    sections: enriched,
    promptContractWarnings: [],
    promptBearingSectionCount,
  }
}
