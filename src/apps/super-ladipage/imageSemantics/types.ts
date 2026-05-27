// ═════════════════════════════════════════════════════════════════════
// Image Semantics — type definitions (P9 image orchestration intent)
//
// Translates VisualSemanticsPage → image generation INTENT. Visuals are
// SUBORDINATE to semantic psychology — NOT the other way around.
//
// LOCKED: pure intent layer. No Midjourney prompts. No aesthetic logic.
// No AI sophistication. No prompt strings. No cinematic obsession.
// No automation. No image generation here.
//
// LOCKED: 9 semantic axes (user-specified) + imageRole (re-exported).
// LOCKED: renderer-agnostic. Output is data only — future P10+ consumes.
// ═════════════════════════════════════════════════════════════════════

import type { VisualSemanticsSection, VisualSemanticsPage } from '../visualSemantics'
import type { ImageRole } from '../composer'

export type { ImageRole }

// ─── 9 image-intent axes (LOCKED — no expansion) ───────────────────

export type RealismLevel =
  | 'documentary-realism'  // raw, evidence-feel, low staging
  | 'imperfect-realism'    // honest moment, not posed, slight flaw
  | 'natural-realism'      // believable everyday capture
  | 'polished-realism'     // clean but still real
  | 'stylized'             // intentional non-real treatment

export type FramingStyle =
  | 'close-emotional'      // face / object close, emotional impact
  | 'mid-narrative'        // standard mid-shot, contextual
  | 'wide-context'         // environment / lifestyle wide
  | 'object-isolation'     // single subject, clean negative space
  | 'flat-lay'             // top-down object cluster, frustration/context
  | 'screenshot-frame'     // device-screen aspect, proof artifact

export type ImageEmotionalState =
  | 'tension'              // hero impact
  | 'unease'               // recognition phase
  | 'frustration'          // failed-attempts phase
  | 'reflection'           // belief-shift moment
  | 'curiosity'            // solution opening
  | 'uplift'               // transformation
  | 'reassurance'          // close, anti-pressure
  | 'silence'              // visual decompression

export type CompositionTension =
  | 'high-tension-asymmetric'  // hero — visual interrupt
  | 'mild-tension'             // mid-story momentum
  | 'balanced'                 // standard composition
  | 'calm-symmetric'           // reframe — attention restoration
  | 'released'                 // close — visual rest

export type PolishLevel =
  | 'raw-handheld'         // phone-quality, unedited
  | 'low-polish'           // amateur but considered
  | 'considered-natural'   // natural composition, edited light
  | 'editorial'            // clean editorial, intentional
  | 'high-polish'          // commercial polish (rarely intended)

export type SubjectDistance =
  | 'extreme-close'        // micro detail
  | 'close'                // tight subject
  | 'medium'               // mid-shot
  | 'wide'                 // wide framing
  | 'environment'          // environmental, subject small in frame

export type ProofFeel =
  | 'screenshot'           // app/sms/chat capture
  | 'attribution-card'     // labeled testimonial graphic
  | 'testimonial-still'    // person-with-text still
  | 'context-evidence'     // before/after / object evidence
  | 'none'                 // section has no proof image

export type VisualNoise =
  | 'minimal'              // pure subject, no distraction
  | 'restrained'           // few accents
  | 'moderate'             // standard contextual props
  | 'lived-in'             // honest clutter, real life
  | 'busy'                 // intentional density / flat-lay

export type LightingMood =
  | 'harsh-tension'        // hero — high-contrast, anxious
  | 'natural-flat'         // documentary natural light
  | 'warm-soft'            // uplift / solution warmth
  | 'morning-clean'        // reframe / close clarity
  | 'evening-warm'         // intimate, reflective
  | 'neutral'              // unbiased

// ─── ImageIntent — per-section image governance contract ───────────

export interface ImageIntent {
  realismLevel: RealismLevel
  framingStyle: FramingStyle
  emotionalState: ImageEmotionalState
  compositionTension: CompositionTension
  polishLevel: PolishLevel
  subjectDistance: SubjectDistance
  proofFeel: ProofFeel
  visualNoise: VisualNoise
  lightingMood: LightingMood
  /** Re-export of composer's ImageRole for self-contained consumption. */
  imageRole: ImageRole
  /** INTERNAL governance note — future prompt builder may read this.
   *  NEVER visible to end users. NEVER a prompt string. */
  intentNote: string
}

// ─── ImageIntentSection extends VisualSemanticsSection ─────────────

export interface ImageIntentSection extends VisualSemanticsSection {
  /** Present only when imageRole !== 'none'. */
  imageIntent?: ImageIntent
}

// ─── ImageIntentPage extends VisualSemanticsPage ───────────────────

export interface ImageIntentPage extends VisualSemanticsPage {
  sections: ImageIntentSection[]
  /** Soft contradiction warnings from imageIntentCoherenceDetector. */
  imageIntentWarnings: string[]
  /** Count of sections that received an imageIntent (image roles !== none). */
  imageBearingSectionCount: number
}
