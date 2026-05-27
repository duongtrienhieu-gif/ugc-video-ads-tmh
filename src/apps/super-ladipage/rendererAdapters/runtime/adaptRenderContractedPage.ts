// ─────────────────────────────────────────────────────────────────────
// Renderer Adapters — adaptRenderContractedPage (POST-REBUILD no-op)
//
// 3-renderer adapter pipeline (gptImage/flux/sdxl + fragment translation)
// DELETED 2026-05-27. Per-image prompts now come from imageSceneSynthesis
// at exec time. This function survives only as a pass-through to preserve
// the export subtype chain (RendererAdaptedPage feeds orchestration +
// exportPipeline).
//
// Each section with imagePromptContract gets empty rendererOutputs slots.
// Real prompts flow through the orchestrator's scene synthesis layer.
// ─────────────────────────────────────────────────────────────────────

import type { ImagePromptPage } from '../../promptTranslation'
import type { RendererAdaptedPage, RendererAdaptedSection } from '../types'

export function adaptRenderContractedPage(page: ImagePromptPage): RendererAdaptedPage {
  const enriched: RendererAdaptedSection[] = page.sections.map((section) => {
    if (!section.imagePromptContract) {
      return { ...section }
    }
    return {
      ...section,
      // Empty outputs — orchestrator overrides prompts at exec time from
      // scene synthesis. Field kept for subtype-chain compatibility.
      rendererOutputs: {},
    }
  })

  const adaptedSectionCount = enriched.filter((s) => s.rendererOutputs).length

  return {
    ...page,
    sections: enriched,
    rendererAdapterWarnings: [],
    adaptedSectionCount,
  }
}
