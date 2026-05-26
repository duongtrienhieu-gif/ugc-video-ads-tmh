// ═════════════════════════════════════════════════════════════════════
// Visual Semantics — type definitions (P6 visual psychology layer)
//
// Translates renderContract → visual semantic rules. Answers:
//   "How should this section FEEL visually while scrolling?"
// NOT:
//   "How should this section be coded?"
//
// LOCKED: renderer-agnostic, implementation-free, headless, declarative.
// No Tailwind / React / CSS / px / animation specs / color tokens.
//
// LOCKED: 8 semantic axes (user-specified, no expansion).
// ═════════════════════════════════════════════════════════════════════

import type { RenderContractedSection, RenderContractedPage } from '../renderContract'

// ─── 8 semantic axes (locked names) ────────────────────────────────

export type VisualHierarchy =
  | 'image-primary'        // image dominates the visual field
  | 'headline-primary'     // headline draws eye first
  | 'body-primary'         // body text leads attention
  | 'quote-primary'        // proof quote dominant
  | 'cta-primary'          // CTA visually leads

export type EyeFlow =
  | 'top-down'             // standard vertical scan
  | 'inverted-pyramid'     // big at top, narrows
  | 'side-to-side'         // image | text alternation
  | 'center-out'           // center-anchored, content radiates
  | 'sweeping'             // long flowing horizontal-ish read

export type ReadingTempo =
  | 'snap'                 // 1-3 sec hero impact
  | 'steady'               // normal narrative pace
  | 'slow-reflective'      // pause-and-think tempo
  | 'lingering'            // close-out, no rush

export type SectionBreathing =
  | 'cramped'              // dense, no air
  | 'comfortable'          // standard spacing
  | 'generous'             // breathing room
  | 'vast'                 // expansive close-out

export type EmotionalCompression =
  | 'compressed-tension'   // hero impact moment
  | 'building'             // mid-story momentum
  | 'released'             // post-reframe relief
  | 'expanded'             // future-self projection
  | 'decompressed'         // close calm

export type VisualNoiseTolerance =
  | 'zero'                 // reframe — pure text, no decoration
  | 'minimal'              // close — barely any visual chrome
  | 'moderate'             // most sections
  | 'busy-ok'              // shared-struggle flat-lay — clutter acceptable

export type ProofWeight =
  | 'invisible'            // no proof in section
  | 'whisper'              // subtle attribution, secondary
  | 'standard'             // inline quote callout, normal weight
  | 'spotlight'            // bordered block, scannable emphasis

export type CtaAggression =
  | 'hidden'               // no CTA visibility
  | 'inline-gentle'        // soft micro-commitment woven in
  | 'clear'                // visible CTA but not pushy
  | 'urgent-foot'          // final emphatic CTA at foot

// ─── VisualSemantics — per-section visual psychology contract ──────

export interface VisualSemantics {
  visualHierarchy: VisualHierarchy
  eyeFlow: EyeFlow
  readingTempo: ReadingTempo
  sectionBreathing: SectionBreathing
  emotionalCompression: EmotionalCompression
  visualNoiseTolerance: VisualNoiseTolerance
  proofWeight: ProofWeight
  ctaAggression: CtaAggression
  /** INTERNAL renderer guidance — never visible copy. */
  psychologyNote: string
}

// ─── VisualSemanticsSection extends RenderContractedSection ────────

export interface VisualSemanticsSection extends RenderContractedSection {
  visualSemantics: VisualSemantics
}

// ─── VisualSemanticsPage extends RenderContractedPage ──────────────

export interface VisualSemanticsPage extends RenderContractedPage {
  sections: VisualSemanticsSection[]
  /** Soft warnings from visualSemanticsCoherenceDetector. */
  semanticsWarnings: string[]
}
