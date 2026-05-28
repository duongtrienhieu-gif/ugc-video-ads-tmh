// ═════════════════════════════════════════════════════════════════════
// Export Pipeline — type definitions (P14 productization layer)
//
// Sits AFTER validationCalibration. Derives per-section ExportGuide
// (design-intent metadata for marketer Ladipage assembly) + provides
// serialization into markdown / JSON / Ladipage guidance text.
//
// LOCKED: NO HTML auto-generation, NO publishing, NO autonomous layout.
// Output is COPY-READY ASSETS for human assembly. Marketer remains the
// final layout controller.
//
// LOCKED: ExportGuide is design INTENT only — not pixel values, not CSS.
// ═════════════════════════════════════════════════════════════════════

import type { ValidatedSection, ValidatedPage } from '../validationCalibration'
import type { ImageAspectRatio, TypographyDominance } from '../renderContract'

// ─── ExportGuide — design-intent metadata per section ──────────────

export type SuggestedPadding = 'tight' | 'comfortable' | 'spacious'
export type TextWidthMode = 'narrow' | 'standard' | 'wide'
export type RecommendedSpacing = 'tight' | 'normal' | 'wide'
export type ProofStyle = 'subtle' | 'standard' | 'spotlight' | 'none'

export interface ExportGuide {
  /** Padding intent inside section container. */
  suggestedPadding: SuggestedPadding
  /** Aspect ratio for image slot. Undefined when section has no image. */
  imageRatio?: ImageAspectRatio
  /** Typography dominance hint (re-export from renderContract). */
  typographyMode: TypographyDominance
  /** Reading width hint. */
  textWidthMode: TextWidthMode
  /** Vertical spacing recommendation between elements. */
  recommendedSpacing: RecommendedSpacing
  /** Whether marketer should add a sticky CTA bar for this section. */
  stickyCtaRecommended: boolean
  /** How proof should visually present. */
  proofStyle: ProofStyle
  /** Short human-readable intent line for marketer reference. */
  sectionIntent: string
}

// ─── ExportableSection / ExportablePage (subtype chain) ────────────

export interface ExportableSection extends ValidatedSection {
  /** Present for every section — guide always derivable from upstream. */
  exportGuide: ExportGuide
}

export interface ExportablePage extends ValidatedPage {
  sections: ExportableSection[]
}
