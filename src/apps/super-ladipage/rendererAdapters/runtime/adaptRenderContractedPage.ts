// ─────────────────────────────────────────────────────────────────────
// Renderer Adapters — adaptRenderContractedPage (P11 top entry)
//
// ImagePromptPage → RendererAdaptedPage. Per-section adapter assembly.
// Mirrors translateImageIntentPage shape. Pure function.
// ─────────────────────────────────────────────────────────────────────

import type { ImagePromptPage } from '../../promptTranslation'
import type { RendererAdaptedPage, RendererAdaptedSection } from '../types'
import { adaptToRenderers } from './adaptToRenderers'
import { rendererOutputValidator } from '../validators/rendererOutputValidator'

export function adaptRenderContractedPage(page: ImagePromptPage): RendererAdaptedPage {
  const enriched: RendererAdaptedSection[] = page.sections.map((section) => {
    if (!section.imagePromptContract) {
      return { ...section }  // no contract → no rendererOutputs
    }
    return {
      ...section,
      rendererOutputs: adaptToRenderers(section.imagePromptContract),
    }
  })

  const adaptedSectionCount = enriched.filter((s) => s.rendererOutputs).length
  const rendererAdapterWarnings = rendererOutputValidator(enriched)

  return {
    ...page,
    sections: enriched,
    rendererAdapterWarnings,
    adaptedSectionCount,
  }
}
