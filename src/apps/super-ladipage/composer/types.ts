// ═════════════════════════════════════════════════════════════════════
// Composer System — type definitions (P4 headless orchestration)
//
// Composer = PARASITIC translation layer. Reads existing pack
// (storytelling + proof + cta) → produces mobile-ready ComposedPage.
// Does NOT modify storytelling / proof / cta systems.
//
// Module sandbox: src/apps/super-ladipage/composer/
//
// LOCK: render-agnostic. NO visual UI, NO renderer, NO image gen, NO HTML.
// Just orchestration logic for future visual layer to consume.
//
// LOCK: ~7 SectionRoles only. No taxonomy expansion.
// LOCK: transitionHint = INTERNAL metadata for renderer guidance.
//       NEVER emit as visible copy.
// ═════════════════════════════════════════════════════════════════════

import type { BlockId } from '../storytelling/types'

export type { BlockId }

// ─── Section roles (LOCKED — 7 only, no expansion) ─────────────────

export type SectionRole =
  | 'hero-recognition'    // Block 1 opener — impact moment
  | 'lived-experience'    // Phase 1 body + proof-recognition
  | 'shared-struggle'     // Phase 2 — narrator joins + frustration
  | 'reframe-moment'      // belief-shift block
  | 'solution-opening'    // Phase 3 + proof-solution
  | 'transformation'      // Phase 4 wins + proof-future-self
  | 'close-invitation'    // future-self-cta + CTA touches

// ─── Density / pacing / image / scroll metrics ─────────────────────

export type SectionDensity = 'tight' | 'medium' | 'airy' | 'fragmented'

export type PacingRole = 'impact' | 'breathing' | 'dense' | 'mixed' | 'close'

export type ImageRole =
  | 'hero-anchor'         // section 1 — identity lock
  | 'mood-supporting'     // mid-page — emotional atmosphere
  | 'object-trace'        // frustration / failed attempts visualization
  | 'lifestyle-context'   // wide context, daily life
  | 'proof-callout'       // proof callout visual
  | 'none'                // pure text section

export type ScrollWeight = 'light' | 'moderate' | 'heavy'

export type SpacingHint = 'tight' | 'normal' | 'wide'

// ─── Inline proof piece (re-exported shape from proof system) ──────

export interface InlineProofPiece {
  quote: string
  author?: string
  meta?: string
}

// ─── ComposedSection — render-agnostic mobile section unit ─────────

export interface ComposedSection {
  /** Generated ID, e.g. "sec-2-lived-experience". */
  id: string
  role: SectionRole
  /** Storytelling block IDs that fed this section (traceable). */
  sourceBlockIds: BlockId[]
  /** Merged narrative text (separated from inline proof). */
  paragraphs: string[]
  /** Optional inline proof callout if a proof block was absorbed here. */
  inlineProof?: InlineProofPiece
  /** Density tier — derived from word/paragraph count. */
  density: SectionDensity
  /** Pacing role — derived from section role + density. */
  pacingRole: PacingRole
  /** Image necessity — what role visual should serve here. */
  imageRole: ImageRole
  /** Scroll weight — how heavy this section feels on mobile scroll. */
  scrollWeight: ScrollWeight
  /** Does this section contain CTA touches (micro-commitment / urgency / etc.)? */
  ctaInline: boolean
  /** Spacing hint BEFORE this section (renderer guidance). */
  spacingBefore: SpacingHint
  /** Spacing hint AFTER this section (renderer guidance). */
  spacingAfter: SpacingHint
  /** INTERNAL transition note (renderer/pacing logic only — NEVER visible copy).
   *  Used for: pacing continuity / spacing logic / emotional flow tracking. */
  transitionHint: string
  /** Word count for density audit. */
  wordCount: number
  /** Paragraph count for density audit. */
  paragraphCount: number
}

// ─── ComposedPage — top-level mobile structure ─────────────────────

export interface ComposedPage {
  sections: ComposedSection[]
  /** Final section count (typically 6-8 depending on optional blocks). */
  totalSections: number
  /** Source pack block count (15-17). */
  sourcePackBlockCount: number
  /** Total word count across all sections. */
  totalWordCount: number
  /** Estimated mobile scroll time (seconds, based on ~200 WPM reading). */
  estimatedScrollTimeSec: number
  /** Soft fatigue flags from scrollFatigueDetector. */
  fatigueWarnings: string[]
}
