// ─────────────────────────────────────────────────────────────────────
// Render Contract — deriveRenderContractedPage (P5 top entry)
//
// ComposedPage → RenderContractedPage. Per-section enrichment.
// Pure function. Renderer-agnostic output.
// ─────────────────────────────────────────────────────────────────────

import type { ComposedPage } from '../../composer'
import type { RenderContractedPage, RenderContractedSection } from '../types'
import { deriveRenderContract } from './deriveRenderContract'
import { renderContractConsistencyDetector } from '../validators/renderContractConsistencyDetector'

/** Enrich ComposedPage with per-section render contracts. */
export function deriveRenderContractedPage(composed: ComposedPage): RenderContractedPage {
  const enriched: RenderContractedSection[] = composed.sections.map((section) => ({
    ...section,
    renderContract: deriveRenderContract(section),
  }))

  const consistencyWarnings = renderContractConsistencyDetector(enriched)

  return {
    ...composed,
    sections: enriched,
    consistencyWarnings,
  }
}
