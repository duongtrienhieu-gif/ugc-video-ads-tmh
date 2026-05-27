// ─────────────────────────────────────────────────────────────────────
// Image Semantics — per-sectionRole baseline profiles (P9)
//
// Pure declarative tables. 7 SectionRoles → 7 baseline ImageIntent
// profiles. Downstream derive function applies these as the starting
// point, then overlays modifiers from other semantic axes.
//
// LOCKED: no prompt strings, no Midjourney syntax, no aesthetic logic.
// LOCKED: read-only config. No runtime branching.
// ─────────────────────────────────────────────────────────────────────

import type { SectionRole } from '../../composer'
import type {
  RealismLevel,
  FramingStyle,
  ImageEmotionalState,
  CompositionTension,
  PolishLevel,
  SubjectDistance,
  ProofFeel,
  VisualNoise,
  LightingMood,
} from '../types'

export interface RoleProfile {
  realismLevel: RealismLevel
  framingStyle: FramingStyle
  emotionalState: ImageEmotionalState
  compositionTension: CompositionTension
  polishLevel: PolishLevel
  subjectDistance: SubjectDistance
  proofFeel: ProofFeel
  visualNoise: VisualNoise
  lightingMood: LightingMood
  /** Internal designer-style note (NOT a prompt). */
  intentNote: string
}

// ─── 7 role baseline profiles ──────────────────────────────────────

export const ROLE_PROFILES: Record<SectionRole, RoleProfile> = {
  'hero-recognition': {
    realismLevel: 'imperfect-realism',
    framingStyle: 'close-emotional',
    emotionalState: 'tension',
    compositionTension: 'high-tension-asymmetric',
    polishLevel: 'low-polish',
    subjectDistance: 'close',
    proofFeel: 'none',
    visualNoise: 'restrained',
    lightingMood: 'harsh-tension',
    intentNote:
      'Visual interrupt. Reader sees themselves. Imperfect, not posed. ' +
      'Asymmetric composition + close framing creates emotional snap.',
  },

  'lived-experience': {
    realismLevel: 'natural-realism',
    framingStyle: 'mid-narrative',
    emotionalState: 'unease',
    compositionTension: 'balanced',
    polishLevel: 'considered-natural',
    subjectDistance: 'medium',
    proofFeel: 'none',
    visualNoise: 'moderate',
    lightingMood: 'natural-flat',
    intentNote:
      'Mid-narrative beat. Real life captured honestly. Reader stays inside ' +
      'the moment — no styling that breaks immersion.',
  },

  'shared-struggle': {
    realismLevel: 'documentary-realism',
    framingStyle: 'flat-lay',
    emotionalState: 'frustration',
    compositionTension: 'mild-tension',
    polishLevel: 'low-polish',
    subjectDistance: 'close',
    proofFeel: 'none',
    visualNoise: 'lived-in',
    lightingMood: 'natural-flat',
    intentNote:
      'Frustration phase. Object-trace of failed attempts — products on a counter, ' +
      'half-finished bottles, repetitive evidence. Reader recognises the pattern.',
  },

  'reframe-moment': {
    realismLevel: 'natural-realism',
    framingStyle: 'object-isolation',
    emotionalState: 'reflection',
    compositionTension: 'calm-symmetric',
    polishLevel: 'editorial',
    subjectDistance: 'medium',
    proofFeel: 'none',
    visualNoise: 'minimal',
    lightingMood: 'morning-clean',
    intentNote:
      'Reframe pause. Visual restoration after frustration. Single subject, clean ' +
      'negative space. Reader breathes. If pattern is text-only, no image at all.',
  },

  'solution-opening': {
    realismLevel: 'natural-realism',
    framingStyle: 'mid-narrative',
    emotionalState: 'curiosity',
    compositionTension: 'balanced',
    polishLevel: 'considered-natural',
    subjectDistance: 'medium',
    proofFeel: 'none',
    visualNoise: 'restrained',
    lightingMood: 'warm-soft',
    intentNote:
      'Solution emerges. Product hint visible but unstaged. Warm light suggests ' +
      'discovery, not sales. Reader is curious, not pressured.',
  },

  'transformation': {
    realismLevel: 'natural-realism',
    framingStyle: 'wide-context',
    emotionalState: 'uplift',
    compositionTension: 'released',
    polishLevel: 'considered-natural',
    subjectDistance: 'wide',
    proofFeel: 'none',
    visualNoise: 'restrained',
    lightingMood: 'warm-soft',
    intentNote:
      'Lifestyle uplift. Wide framing — life-after, daily ease. Reader projects ' +
      'themselves into the scene. No product hero-shot.',
  },

  'close-invitation': {
    realismLevel: 'natural-realism',
    framingStyle: 'wide-context',
    emotionalState: 'silence',
    compositionTension: 'released',
    polishLevel: 'considered-natural',
    subjectDistance: 'environment',
    proofFeel: 'none',
    visualNoise: 'minimal',
    lightingMood: 'morning-clean',
    intentNote:
      'Decompression. Visual silence. If image at all, environmental + soft. ' +
      'Often image-less — text alone carries the close.',
  },
}
