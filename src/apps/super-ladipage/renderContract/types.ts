// ═════════════════════════════════════════════════════════════════════
// Render Contract — type definitions (P5 mobile rendering intelligence)
//
// Render-AGNOSTIC contract layer. Describes mobile rendering INTENT,
// NOT implementation. Future renderers (preview UI / Ladipage export /
// HTML export / etc.) all consume same contract.
//
// LOCK: No Tailwind class names. No React component names. No CSS
// property values. No pixel values. No animation specs. No color tokens.
// Pure semantic / intent-level descriptors only.
//
// LOCK: feelNote = INTERNAL renderer guidance ONLY. Never visible copy.
// ═════════════════════════════════════════════════════════════════════

import type { ComposedSection, ComposedPage } from '../composer'

// ─── LayoutType — how section physically arranges content ─────────

export type LayoutType =
  | 'image-top'                  // hero pattern: image first, text below
  | 'image-side'                 // image adjacent to text
  | 'text-only'                  // pure text section
  | 'text-with-inline-proof'     // text + small proof callout inset
  | 'image-bottom'               // text first, image below for context
  | 'mixed-flow'                 // alternating image/text within section

// ─── MobilePattern — semantic scroll experience pattern ───────────

export type MobilePattern =
  | 'impact-anchor'              // hero top-of-page strong visual + headline
  | 'breathing-narrative'        // text-led with mood image
  | 'frustration-flat-lay'       // object-symbol image + dense text
  | 'reframe-spotlight'          // pure text centered, no image
  | 'solution-mixed'             // narrative + product hint
  | 'lifestyle-uplift'           // wide context + projection
  | 'closing-quiet'              // text-only airy close

// ─── Image specs ──────────────────────────────────────────────────

export type ImageAspectRatio = '1:1' | '4:5' | '3:4' | '16:9' | '9:16'

// ─── Typography intent ─────────────────────────────────────────────

export type TextChunking =
  | 'small-paragraph'            // 2-3 sentences per chunk
  | 'medium-paragraph'           // 3-4 sentences per chunk
  | 'long-flowing'               // longer prose blocks
  | 'fragmented-lines'           // short impact lines, snap rhythm

export type TypographyDominance =
  | 'headline-led'               // headline visually dominant
  | 'body-led'                   // body text dominant
  | 'balanced'                   // headline + body equal weight
  | 'quote-led'                  // proof quote visually dominant

// ─── Proof presentation intent ─────────────────────────────────────

export type ProofPresentation =
  | 'inline-quote-callout'       // proof quote called out within section flow
  | 'bordered-block'             // proof as bordered block, more separation
  | 'subtle-attribution'         // proof as gentle attribution line, minimal
  | 'none'                       // section has no proof

// ─── CTA placement intent ─────────────────────────────────────────

export type CtaPlacement =
  | 'none'                       // no CTA in this section
  | 'inline-soft'                // gentle micro-commitment line woven in
  | 'footer-emphasis'            // CTA at section footer, emphasized
  | 'sticky-low-friction'        // sticky CTA, low visual friction

// ─── Spacing intent (relative, NOT pixel values) ──────────────────

export type SpacingPreset = 'snug' | 'comfortable' | 'airy' | 'expansive'

// ─── Visual energy intent ──────────────────────────────────────────

export type VisualEnergy =
  | 'high-tension'               // hero — emotional snap
  | 'subtle-unease'              // recognition phase — quiet pressure
  | 'frustration'                // failed-attempts phase
  | 'reflection'                 // belief-shift moment
  | 'curiosity'                  // solution opening
  | 'uplift'                     // transformation phase
  | 'reassurance'                // close — calming, anti-pressure

// ─── RenderContract — per-section render intent contract ───────────

export interface RenderContract {
  layoutType: LayoutType
  mobilePattern: MobilePattern
  /** Number of images this section recommends (0-2). */
  recommendedImageCount: number
  imageAspectRatio?: ImageAspectRatio
  textChunking: TextChunking
  typographyDominance: TypographyDominance
  proofPresentation: ProofPresentation
  ctaPlacement: CtaPlacement
  spacingPreset: SpacingPreset
  visualEnergy: VisualEnergy
  /** INTERNAL renderer note about "feel" — NEVER visible copy. */
  feelNote: string
}

// ─── RenderContractedSection extends ComposedSection ───────────────

export interface RenderContractedSection extends ComposedSection {
  renderContract: RenderContract
}

// ─── RenderContractedPage extends ComposedPage ────────────────────

export interface RenderContractedPage extends ComposedPage {
  sections: RenderContractedSection[]
  /** Soft consistency warnings from renderContractConsistencyDetector. */
  consistencyWarnings: string[]
}
