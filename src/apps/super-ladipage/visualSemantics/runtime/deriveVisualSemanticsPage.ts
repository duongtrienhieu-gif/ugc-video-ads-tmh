// ─────────────────────────────────────────────────────────────────────
// Visual Semantics — deriveVisualSemanticsPage (P6 top entry)
//
// RenderContractedPage → VisualSemanticsPage. Per-section enrichment.
// Pure function. Renderer-agnostic.
// ─────────────────────────────────────────────────────────────────────

import type { RenderContractedPage } from '../../renderContract'
import type { VisualSemanticsPage, VisualSemanticsSection } from '../types'
import { deriveVisualSemantics } from './deriveVisualSemantics'
import { visualSemanticsCoherenceDetector } from '../validators/visualSemanticsCoherenceDetector'

/** Enrich RenderContractedPage with per-section visual semantics. */
export function deriveVisualSemanticsPage(page: RenderContractedPage): VisualSemanticsPage {
  const enriched: VisualSemanticsSection[] = page.sections.map((section) => ({
    ...section,
    visualSemantics: deriveVisualSemantics(section),
  }))

  const semanticsWarnings = visualSemanticsCoherenceDetector(enriched)

  return {
    ...page,
    sections: enriched,
    semanticsWarnings,
  }
}
