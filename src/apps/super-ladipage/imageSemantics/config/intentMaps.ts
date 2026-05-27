// ─────────────────────────────────────────────────────────────────────
// Image Semantics — declarative modifier maps (P9)
//
// These tables overlay the per-sectionRole baseline (roleProfiles.ts)
// with axis-driven adjustments. Pure data, no branching logic.
//
// Layers applied (in order, downstream of role baseline):
//   1. visualEnergy        → emotionalState  (direct map)
//   2. visualNoiseTolerance → visualNoise    (direct map)
//   3. emotionalCompression → compositionTension modifier
//   4. sectionBreathing    → polishLevel modifier
//   5. imageRole           → framing + distance + proofFeel override
// ─────────────────────────────────────────────────────────────────────

import type {
  VisualEnergy,
} from '../../renderContract'
import type {
  EmotionalCompression,
  SectionBreathing,
  VisualNoiseTolerance,
} from '../../visualSemantics'
import type { ImageRole } from '../../composer'
import type {
  ImageEmotionalState,
  CompositionTension,
  PolishLevel,
  VisualNoise,
  FramingStyle,
  SubjectDistance,
  ProofFeel,
} from '../types'

// ─── 1. visualEnergy → emotionalState (RC → image emotion) ─────────

export const EMOTION_BY_ENERGY: Record<VisualEnergy, ImageEmotionalState> = {
  'high-tension': 'tension',
  'subtle-unease': 'unease',
  'frustration': 'frustration',
  'reflection': 'reflection',
  'curiosity': 'curiosity',
  'uplift': 'uplift',
  'reassurance': 'reassurance',
}

// ─── 2. visualNoiseTolerance → visualNoise (allowed clutter) ───────

export const NOISE_BY_TOLERANCE: Record<VisualNoiseTolerance, VisualNoise> = {
  'zero': 'minimal',
  'minimal': 'restrained',
  'moderate': 'moderate',
  'busy-ok': 'lived-in',
}

// ─── 3. emotionalCompression → compositionTension modifier ─────────

export const COMPOSITION_BY_COMPRESSION: Record<EmotionalCompression, CompositionTension> = {
  'compressed-tension': 'high-tension-asymmetric',
  'building': 'mild-tension',
  'released': 'balanced',
  'expanded': 'calm-symmetric',
  'decompressed': 'released',
}

// ─── 4. sectionBreathing → polishLevel modifier ────────────────────

export const POLISH_BY_BREATHING: Record<SectionBreathing, PolishLevel> = {
  'cramped': 'raw-handheld',
  'comfortable': 'low-polish',
  'generous': 'considered-natural',
  'vast': 'editorial',
}

// ─── 5. imageRole → framing + distance + proofFeel override ────────

export interface ImageRoleOverride {
  framingStyle?: FramingStyle
  subjectDistance?: SubjectDistance
  proofFeel?: ProofFeel
}

export const ROLE_OVERRIDES: Record<ImageRole, ImageRoleOverride> = {
  'hero-anchor': {
    framingStyle: 'close-emotional',
    subjectDistance: 'close',
  },
  'mood-supporting': {
    framingStyle: 'mid-narrative',
    subjectDistance: 'medium',
  },
  'object-trace': {
    framingStyle: 'flat-lay',
    subjectDistance: 'close',
  },
  'lifestyle-context': {
    framingStyle: 'wide-context',
    subjectDistance: 'wide',
  },
  'proof-callout': {
    framingStyle: 'screenshot-frame',
    subjectDistance: 'medium',
    proofFeel: 'screenshot',
  },
  'none': {
    // No override — section produces no imageIntent.
  },
}
