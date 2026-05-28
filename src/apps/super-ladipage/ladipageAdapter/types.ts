// ═════════════════════════════════════════════════════════════════════
// Ladipage Adapter — type definitions (P16A delivery infrastructure)
//
// Consumes ExportablePage → produces LadipageExportBundle: deterministic
// section→template routing + ordered payloads marketer can paste into
// Ladipage block-by-block, or import as JSON.
//
// LOCKED: pure translation layer. NO AI layout decisions. NO autonomous
// redesign. NO hidden template mutation. NO "better UX" reinterpretation.
// NO semantic rewriting post-validation.
// ═════════════════════════════════════════════════════════════════════

import type { ExportableSection, ExportablePage } from '../exportPipeline'

// ─── Template names (LOCKED — extending requires user approval) ────

export type LadipageTemplateName =
  | 'HeroBlockTemplate'
  | 'BreathingNarrativeTemplate'
  | 'FrustrationFlatLayTemplate'
  | 'ProblemAgitationTemplate'
  | 'ProductFeatureTemplate'
  | 'LifestyleUpliftTemplate'
  | 'FinalCTASection'
  | 'TestimonialBlockTemplate'

// ─── LadipageSection — per-block marketer payload ──────────────────

export interface LadipageSectionTextPayload {
  /** Headline candidate (first paragraph, used when typography=headline-led). */
  headline?: string
  /** Body paragraphs. */
  body: string[]
  /** Proof block (when present). */
  proof?: {
    quote: string
    author?: string
    meta?: string
  }
  /** CTA text suggestion (when section has CTA). Marketer overrides freely. */
  ctaText?: string
}

export interface LadipageSectionImagePayload {
  /** Generated image URLs (empty when planned but not executed). */
  urls: string[]
  /** Suggested aspect ratio for upload box. */
  aspectRatio?: string
  /** Status from orchestration plan. */
  status: string
  /** Renderer routed to (gptImage / flux / sdxl). */
  renderer?: string
}

export interface LadipageSectionLayout {
  /** Padding intent for the container. */
  padding: 'tight' | 'comfortable' | 'spacious'
  /** Vertical spacing between elements. */
  spacing: 'tight' | 'normal' | 'wide'
  /** Text reading width. */
  textWidth: 'narrow' | 'standard' | 'wide'
  /** Typography dominance. */
  typography: 'headline-led' | 'body-led' | 'balanced' | 'quote-led'
  /** Proof visual style. */
  proofStyle: 'subtle' | 'standard' | 'spotlight' | 'none'
  /** Marketer should add a sticky CTA bar. */
  stickyCtaRecommended: boolean
}

export interface LadipageSection {
  /** Source section ID (traceable to validatedPage.sections[i].id). */
  sourceSectionId: string
  /** Order in final page. */
  order: number
  /** Locked template assignment — no AI override. */
  template: LadipageTemplateName
  /** Short human-readable intent (for marketer reference, not visible copy). */
  intent: string
  /** Text payload. */
  text: LadipageSectionTextPayload
  /** Image payload. */
  image?: LadipageSectionImagePayload
  /** Layout intent for marketer Ladipage block setup. */
  layout: LadipageSectionLayout
}

// ─── LadipageExportBundle — full page export ───────────────────────

export interface LadipageExportBundle {
  /** Generated when bundle is built — useful for share / dedup. */
  bundleId: string
  /** ISO timestamp of bundle creation. */
  createdAt: string
  /** Source pack metadata (lightweight, marketer-relevant). */
  meta: {
    totalSections: number
    totalWordCount: number
    estimatedScrollTimeSec: number
    productName?: string
    niche?: string
  }
  /** Ordered Ladipage sections — paste in this order. */
  sections: LadipageSection[]
  /** Aggregate validation summary (pass-through from P13). */
  validationSummary: {
    realismRisk: string
    polishDrift: string
    proofAuthenticity: string
    scrollFatigue: string
    repetitionRisk: string
    sectionAlignment: string
    warningCount: number
    advisoryKnobCount: number
  }
}

// ─── Re-exports for convenience ────────────────────────────────────

export type { ExportableSection, ExportablePage }
