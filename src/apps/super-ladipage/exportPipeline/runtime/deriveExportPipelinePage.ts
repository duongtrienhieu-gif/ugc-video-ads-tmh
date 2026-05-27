// ─────────────────────────────────────────────────────────────────────
// Export Pipeline — deriveExportPipelinePage (P14 top entry)
//
// ValidatedPage → ExportablePage. Per-section ExportGuide enrichment.
// Pure function. Renderer-agnostic.
// ─────────────────────────────────────────────────────────────────────

import type { ValidatedPage } from '../../validationCalibration'
import type { ExportablePage, ExportableSection } from '../types'
import { deriveExportGuide } from './deriveExportGuide'

export function deriveExportPipelinePage(page: ValidatedPage): ExportablePage {
  const enriched: ExportableSection[] = page.sections.map((section) => ({
    ...section,
    exportGuide: deriveExportGuide(section),
  }))

  return {
    ...page,
    sections: enriched,
  }
}
