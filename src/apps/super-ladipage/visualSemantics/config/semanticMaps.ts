// ─────────────────────────────────────────────────────────────────────
// Visual Semantics — SEMANTIC MAPS (P6 baseline lookup tables)
//
// 8 lookup tables, consolidated in 1 file. Maps renderContract fields
// → visualSemantics axes. Override logic in deriveVisualSemantics.ts.
//
// LOCK: pure semantic mappings. No implementation hints (no class names,
// no px values, no framework specifics).
// ─────────────────────────────────────────────────────────────────────

import type {
  MobilePattern, LayoutType, SpacingPreset, VisualEnergy,
  ProofPresentation, CtaPlacement, TypographyDominance,
} from '../../renderContract'
import type {
  VisualHierarchy, EyeFlow, ReadingTempo, SectionBreathing,
  EmotionalCompression, VisualNoiseTolerance, ProofWeight, CtaAggression,
} from '../types'

// ─── 1. VisualHierarchy ← typographyDominance + mobilePattern ─────

export const HIERARCHY_BY_DOMINANCE: Record<TypographyDominance, VisualHierarchy> = {
  'headline-led': 'headline-primary',
  'body-led':     'body-primary',
  'balanced':     'body-primary',     // default to body-primary, override per role
  'quote-led':    'quote-primary',
}

/** Override: impact-anchor pattern → image-primary regardless of dominance. */
export function hierarchyOverrideForPattern(pattern: MobilePattern): VisualHierarchy | null {
  if (pattern === 'impact-anchor') return 'image-primary'
  return null
}

// ─── 2. EyeFlow ← layoutType + mobilePattern ──────────────────────

export const EYEFLOW_BY_LAYOUT: Record<LayoutType, EyeFlow> = {
  'image-top':                'top-down',
  'image-side':               'side-to-side',
  'text-only':                'top-down',         // default; override per pattern
  'text-with-inline-proof':   'top-down',
  'image-bottom':             'inverted-pyramid',
  'mixed-flow':               'inverted-pyramid',
}

/** Override: text-only + reframe-spotlight → center-out (anchor reading). */
export function eyeFlowOverrideForPattern(
  pattern: MobilePattern,
  layout: LayoutType,
): EyeFlow | null {
  if (layout === 'text-only' && pattern === 'reframe-spotlight') return 'center-out'
  if (layout === 'text-only' && pattern === 'closing-quiet')     return 'sweeping'
  return null
}

// ─── 3. ReadingTempo ← mobilePattern ──────────────────────────────

export const TEMPO_BY_PATTERN: Record<MobilePattern, ReadingTempo> = {
  'impact-anchor':         'snap',
  'breathing-narrative':   'steady',
  'frustration-flat-lay':  'steady',
  'reframe-spotlight':     'slow-reflective',
  'solution-mixed':        'steady',
  'lifestyle-uplift':      'steady',
  'closing-quiet':         'lingering',
}

// ─── 4. SectionBreathing ← spacingPreset ──────────────────────────

export const BREATHING_BY_SPACING: Record<SpacingPreset, SectionBreathing> = {
  'snug':         'cramped',
  'comfortable':  'comfortable',
  'airy':         'generous',
  'expansive':    'vast',
}

// ─── 5. EmotionalCompression ← visualEnergy ───────────────────────

export const COMPRESSION_BY_ENERGY: Record<VisualEnergy, EmotionalCompression> = {
  'high-tension':    'compressed-tension',
  'subtle-unease':   'building',
  'frustration':     'building',
  'reflection':      'released',
  'curiosity':       'expanded',
  'uplift':          'expanded',
  'reassurance':     'decompressed',
}

// ─── 6. VisualNoiseTolerance ← mobilePattern ──────────────────────

export const NOISE_BY_PATTERN: Record<MobilePattern, VisualNoiseTolerance> = {
  'impact-anchor':         'minimal',        // hero — tight, no clutter
  'breathing-narrative':   'moderate',
  'frustration-flat-lay':  'busy-ok',        // object clutter intentional
  'reframe-spotlight':     'zero',           // pure text, no distraction
  'solution-mixed':        'moderate',
  'lifestyle-uplift':      'moderate',
  'closing-quiet':         'minimal',
}

// ─── 7. ProofWeight ← proofPresentation ───────────────────────────

export const PROOF_WEIGHT_BY_PRESENTATION: Record<ProofPresentation, ProofWeight> = {
  'none':                   'invisible',
  'subtle-attribution':     'whisper',
  'inline-quote-callout':   'standard',
  'bordered-block':         'spotlight',
}

// ─── 8. CtaAggression ← ctaPlacement ──────────────────────────────

export const CTA_AGGRESSION_BY_PLACEMENT: Record<CtaPlacement, CtaAggression> = {
  'none':                  'hidden',
  'inline-soft':           'inline-gentle',
  'sticky-low-friction':   'clear',
  'footer-emphasis':       'urgent-foot',
}

// ─── Psychology note per pattern (INTERNAL — never visible copy) ──

export const PSYCHOLOGY_NOTE_BY_PATTERN: Record<MobilePattern, string> = {
  'impact-anchor':
    'reader must feel emotional snap in first 1-3 seconds — visual tension high, distractions zero',
  'breathing-narrative':
    'embodied evidence — eye flows through paragraph rhythm, mood image supports',
  'frustration-flat-lay':
    'visual clutter intentional — failed attempts physically traced, density acceptable',
  'reframe-spotlight':
    'belief shift moment — pure text, centered, no competing visuals, slow reflection tempo',
  'solution-mixed':
    'curiosity unfolds — product emerges through felt difference, image subtle',
  'lifestyle-uplift':
    'future-self projection — warm wide context, reader imagines self forward',
  'closing-quiet':
    'soft action invitation — airy, decompressed, anti-pressure',
}
