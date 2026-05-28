// ─────────────────────────────────────────────────────────────────────
// Export Pipeline — jsonSerializer (P14)
//
// ExportablePage → portable JSON. Strips the full upstream contract
// chain down to marketer-relevant fields. Round-trip safe (no functions,
// no class instances).
//
// LOCKED: NO HTML, NO CSS, NO model-specific syntax in output. Just
// data: copy, proof, image asset URLs, export guide, intent.
// ─────────────────────────────────────────────────────────────────────

import type { ExportablePage } from '../types'

export interface JsonExportSection {
  id: string
  role: string
  intent: string
  paragraphs: string[]
  proof?: {
    quote: string
    author?: string
    meta?: string
  }
  exportGuide: {
    suggestedPadding: string
    imageRatio?: string
    typographyMode: string
    textWidthMode: string
    recommendedSpacing: string
    stickyCtaRecommended: boolean
    proofStyle: string
  }
  image?: {
    /** Renderer planned for this image (gptImage / flux / sdxl). */
    renderer: string
    /** Generation status — 'planned' for unexecuted, 'completed' for ready. */
    status: string
    /** URLs of generated images (empty if status='planned'). */
    urls: string[]
  }
}

export interface JsonExportPayload {
  pageMetrics: {
    totalSections: number
    totalWordCount: number
    estimatedScrollTimeSec: number
  }
  validationSummary: {
    realismRisk: string
    polishDrift: string
    proofAuthenticity: string
    scrollFatigue: string
    consistencyRisk: string
    repetitionRisk: string
    ctaOverexposure: string
    sectionAlignment: string
    warningCount: number
  }
  sections: JsonExportSection[]
}

export function serializeToJson(page: ExportablePage): JsonExportPayload {
  return {
    pageMetrics: {
      totalSections: page.totalSections,
      totalWordCount: page.totalWordCount,
      estimatedScrollTimeSec: page.estimatedScrollTimeSec,
    },
    validationSummary: {
      realismRisk: page.validationReport.realismRisk,
      polishDrift: page.validationReport.polishDrift,
      proofAuthenticity: page.validationReport.proofAuthenticity,
      scrollFatigue: page.validationReport.scrollFatigue,
      consistencyRisk: page.validationReport.consistencyRisk,
      repetitionRisk: page.validationReport.repetitionRisk,
      ctaOverexposure: page.validationReport.ctaOverexposure,
      sectionAlignment: page.validationReport.sectionAlignment,
      warningCount: page.validationReport.warnings.length,
    },
    sections: page.sections.map((s) => ({
      id: s.id,
      role: s.role,
      intent: s.exportGuide.sectionIntent,
      paragraphs: s.paragraphs,
      proof: s.inlineProof
        ? {
            quote: s.inlineProof.quote,
            author: s.inlineProof.author,
            meta: s.inlineProof.meta,
          }
        : undefined,
      exportGuide: {
        suggestedPadding: s.exportGuide.suggestedPadding,
        imageRatio: s.exportGuide.imageRatio,
        typographyMode: s.exportGuide.typographyMode,
        textWidthMode: s.exportGuide.textWidthMode,
        recommendedSpacing: s.exportGuide.recommendedSpacing,
        stickyCtaRecommended: s.exportGuide.stickyCtaRecommended,
        proofStyle: s.exportGuide.proofStyle,
      },
      image: s.generatedAsset
        ? {
            renderer: s.generatedAsset.renderer,
            status: s.generatedAsset.generationStatus,
            urls: s.generatedAsset.outputImages.map((i) => i.url),
          }
        : undefined,
    })),
  }
}

/** Convenience — string output for download / clipboard. */
export function serializeToJsonString(page: ExportablePage, pretty = true): string {
  const payload = serializeToJson(page)
  return pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload)
}
