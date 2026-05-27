// ─────────────────────────────────────────────────────────────────────
// Generation Orchestration — planImageGenerationPage (P12 top entry)
//
// RendererAdaptedPage + references → OrchestratedPage. Per-section
// plan derivation. Mirrors adaptRenderContractedPage shape. Pure.
//
// Pack gen calls this with empty references[] at first — consumer can
// re-plan whenever user uploads references (cheap, deterministic).
// ─────────────────────────────────────────────────────────────────────

import type { RendererAdaptedPage } from '../../rendererAdapters'
import type { OrchestratedPage, OrchestratedSection, ReferenceAsset } from '../types'
import { planImageGeneration } from './planImageGeneration'
import { orchestrationValidator } from '../validators/orchestrationValidator'

/** Plan per-section orchestration for the page. Sync, deterministic, pure. */
export function planImageGenerationPage(
  page: RendererAdaptedPage,
  availableReferences: ReferenceAsset[] = [],
): OrchestratedPage {
  const enriched: OrchestratedSection[] = page.sections.map((section) => {
    const generatedAsset = planImageGeneration(section, availableReferences)
    return generatedAsset === undefined ? { ...section } : { ...section, generatedAsset }
  })

  const planned = enriched.filter((s) => s.generatedAsset).length
  const completed = enriched.filter(
    (s) => s.generatedAsset?.generationStatus === 'completed',
  ).length
  const failed = enriched.filter(
    (s) => s.generatedAsset?.generationStatus === 'failed',
  ).length

  const orchestrationWarnings = orchestrationValidator(enriched, availableReferences)

  return {
    ...page,
    sections: enriched,
    generationPlanCount: planned,
    generationCompletedCount: completed,
    generationFailureCount: failed,
    orchestrationWarnings,
  }
}
