// ─────────────────────────────────────────────────────────────────────
// Export Pipeline — deriveExportGuide (P14 single-section)
//
// ValidatedSection → ExportGuide. Pure declarative derivation from
// existing upstream contract fields. No new intent.
// ─────────────────────────────────────────────────────────────────────

import type { ValidatedSection } from '../../validationCalibration'
import type { ExportGuide } from '../types'
import {
  PADDING_BY_SPACING,
  SPACING_BY_SPACING,
  TEXT_WIDTH_BY_CHUNKING,
  PROOF_STYLE_BY_PRESENTATION,
  isStickyCtaRecommended,
} from '../config/exportGuideMap'

export function deriveExportGuide(section: ValidatedSection): ExportGuide {
  const rc = section.renderContract

  return {
    suggestedPadding:     PADDING_BY_SPACING[rc.spacingPreset],
    imageRatio:           rc.imageAspectRatio,
    typographyMode:       rc.typographyDominance,
    textWidthMode:        TEXT_WIDTH_BY_CHUNKING[rc.textChunking],
    recommendedSpacing:   SPACING_BY_SPACING[rc.spacingPreset],
    stickyCtaRecommended: isStickyCtaRecommended(rc.ctaPlacement),
    proofStyle:           PROOF_STYLE_BY_PRESENTATION[rc.proofPresentation],
    sectionIntent:        buildSectionIntent(section),
  }
}

/** Build short human-readable intent line. NOT a prompt. NOT visible body copy. */
function buildSectionIntent(section: ValidatedSection): string {
  const role = section.role.replace(/-/g, ' ')
  const energy = section.renderContract.visualEnergy.replace(/-/g, ' ')
  const pattern = section.renderContract.mobilePattern.replace(/-/g, ' ')
  return `${role} · ${energy} · ${pattern}`
}
