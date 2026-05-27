// ─────────────────────────────────────────────────────────────────────
// Ladipage Adapter — adaptToLadipage (P16A top entry)
//
// ExportablePage → LadipageExportBundle. Pure deterministic translator.
// Section ordering = source order. Per-section template = deterministic
// selectLadipageTemplate(). All layout intent = pass-through from
// ExportGuide (NO mutation).
// ─────────────────────────────────────────────────────────────────────

import type { ExportablePage, ExportableSection } from '../../exportPipeline'
import type {
  LadipageExportBundle,
  LadipageSection,
  LadipageSectionTextPayload,
  LadipageSectionImagePayload,
  LadipageSectionLayout,
} from '../types'
import { selectLadipageTemplate } from '../config/templateMap'

export interface AdaptToLadipageOptions {
  /** Marketer-facing product name for bundle meta. Default empty. */
  productName?: string
  /** Niche for bundle meta. Default empty. */
  niche?: string
  /** CTA text suggestion override per section index. Optional. */
  ctaTextBySection?: Record<string, string>
}

export function adaptToLadipage(
  page: ExportablePage,
  options: AdaptToLadipageOptions = {},
): LadipageExportBundle {
  const sections: LadipageSection[] = page.sections.map((s, idx) =>
    buildLadipageSection(s, idx, options),
  )

  return {
    bundleId: generateBundleId(),
    createdAt: new Date().toISOString(),
    meta: {
      totalSections: page.totalSections,
      totalWordCount: page.totalWordCount,
      estimatedScrollTimeSec: page.estimatedScrollTimeSec,
      productName: options.productName,
      niche: options.niche,
    },
    sections,
    validationSummary: {
      realismRisk:        page.validationReport.realismRisk,
      polishDrift:        page.validationReport.polishDrift,
      proofAuthenticity:  page.validationReport.proofAuthenticity,
      scrollFatigue:      page.validationReport.scrollFatigue,
      repetitionRisk:     page.validationReport.repetitionRisk,
      sectionAlignment:   page.validationReport.sectionAlignment,
      warningCount:       page.validationReport.warnings.length,
      advisoryKnobCount:  page.validationReport.recommendedKnobAdjustments.length,
    },
  }
}

function buildLadipageSection(
  s: ExportableSection,
  order: number,
  options: AdaptToLadipageOptions,
): LadipageSection {
  const template = selectLadipageTemplate(
    s.role,
    s.renderContract.mobilePattern,
    s.renderContract.proofPresentation,
  )

  const text: LadipageSectionTextPayload = {
    // Headline candidate: first paragraph if typography is headline-led
    headline:
      s.renderContract.typographyDominance === 'headline-led' && s.paragraphs.length > 0
        ? s.paragraphs[0]
        : undefined,
    body:
      s.renderContract.typographyDominance === 'headline-led' && s.paragraphs.length > 0
        ? s.paragraphs.slice(1)
        : s.paragraphs,
    proof: s.inlineProof
      ? {
          quote: s.inlineProof.quote,
          author: s.inlineProof.author,
          meta: s.inlineProof.meta,
        }
      : undefined,
    ctaText: options.ctaTextBySection?.[s.id],
  }

  const image: LadipageSectionImagePayload | undefined = s.generatedAsset
    ? {
        urls: s.generatedAsset.outputImages.map((i) => i.url),
        aspectRatio: s.renderContract.imageAspectRatio,
        status: s.generatedAsset.generationStatus,
        renderer: s.generatedAsset.renderer,
      }
    : undefined

  const layout: LadipageSectionLayout = {
    padding:              s.exportGuide.suggestedPadding,
    spacing:              s.exportGuide.recommendedSpacing,
    textWidth:            s.exportGuide.textWidthMode,
    typography:           s.exportGuide.typographyMode,
    proofStyle:           s.exportGuide.proofStyle,
    stickyCtaRecommended: s.exportGuide.stickyCtaRecommended,
  }

  return {
    sourceSectionId: s.id,
    order,
    template,
    intent: s.exportGuide.sectionIntent,
    text,
    image,
    layout,
  }
}

function generateBundleId(): string {
  // Lightweight, no crypto dep — sufficient for client-side identity
  return `bundle-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
