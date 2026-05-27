// ─────────────────────────────────────────────────────────────────────
// Prompt Translation — fragment lookup tables (P10)
//
// 10 axes → fragment lists. Pure declarative tables. Each value maps to
// 1-3 short neutral descriptors. NO model syntax, NO emphasis tokens,
// NO cinematic vocabulary, NO award-winning language.
//
// VOCABULARY DISCIPLINE:
//   ✓ "close cropped framing"
//   ✗ "intimate, soul-piercing close-up"
//   ✓ "natural uneven lighting"
//   ✗ "dramatic chiaroscuro lighting"
//
// LOCKED: read-only config. No branching, no interpolation.
// ─────────────────────────────────────────────────────────────────────

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
  ImageRole,
} from '../../imageSemantics'

// ─── REALISM bucket sources ────────────────────────────────────────

export const REALISM_FRAGMENTS_BY_LEVEL: Record<RealismLevel, string[]> = {
  'documentary-realism': ['documentary realism', 'evidence-style capture', 'unstaged moment'],
  'imperfect-realism':   ['imperfect realism', 'honest moment', 'non-posed framing'],
  'natural-realism':     ['natural realism', 'believable everyday capture'],
  'polished-realism':    ['clean realistic capture'],
  'stylized':            ['intentionally stylized treatment'],
}

export const REALISM_FRAGMENTS_BY_POLISH: Record<PolishLevel, string[]> = {
  'raw-handheld':       ['phone-quality capture', 'handheld feel', 'unedited frame'],
  'low-polish':         ['low post-production polish', 'minimal editing'],
  'considered-natural': ['lightly edited natural composition'],
  'editorial':          ['considered editorial framing'],
  'high-polish':        ['clean production polish'],
}

// ─── COMPOSITION bucket sources ───────────────────────────────────

export const COMPOSITION_FRAGMENTS_BY_FRAMING: Record<FramingStyle, string[]> = {
  'close-emotional':  ['close cropped framing', 'emotionally close subject'],
  'mid-narrative':    ['mid-shot narrative framing'],
  'wide-context':     ['wide environmental framing'],
  'object-isolation': ['single subject isolation', 'clean negative space'],
  'flat-lay':         ['top-down flat-lay arrangement'],
  'screenshot-frame': ['device screenshot framing', 'screen-capture frame'],
}

export const COMPOSITION_FRAGMENTS_BY_TENSION: Record<CompositionTension, string[]> = {
  'high-tension-asymmetric': [
    'emotionally interrupted composition',
    'asymmetric framing',
    'off-balance subject placement',
  ],
  'mild-tension':            ['mild visual tension', 'slight off-center placement'],
  'balanced':                ['balanced composition'],
  'calm-symmetric':          ['calm-symmetric layout', 'attention-restoring composition'],
  'released':                ['released composition', 'open visual rest'],
}

export const COMPOSITION_FRAGMENTS_BY_DISTANCE: Record<SubjectDistance, string[]> = {
  'extreme-close': ['extreme close framing'],
  'close':         ['close framing'],
  'medium':        ['mid-distance framing'],
  'wide':          ['wide framing'],
  'environment':   ['environmental framing', 'subject small in frame'],
}

// ─── ATMOSPHERE bucket sources ────────────────────────────────────

export const ATMOSPHERE_FRAGMENTS_BY_LIGHTING: Record<LightingMood, string[]> = {
  'harsh-tension': ['harsh natural light', 'uneven contrast'],
  'natural-flat':  ['flat natural light', 'neutral daylight'],
  'warm-soft':     ['warm soft light'],
  'morning-clean': ['clean morning light'],
  'evening-warm':  ['warm evening tone'],
  'neutral':       ['neutral lighting'],
}

export const ATMOSPHERE_FRAGMENTS_BY_NOISE: Record<VisualNoise, string[]> = {
  'minimal':    ['minimal visual elements', 'clean background'],
  'restrained': ['restrained background details'],
  'moderate':   ['moderate contextual elements'],
  'lived-in':   ['lived-in environment', 'honest clutter'],
  'busy':       ['intentional visual density'],
}

export const ATMOSPHERE_FRAGMENTS_BY_EMOTION: Record<ImageEmotionalState, string[]> = {
  'tension':     ['tense atmosphere'],
  'unease':      ['subtle unease atmosphere'],
  'frustration': ['frustration mood'],
  'reflection':  ['reflective mood'],
  'curiosity':   ['curious atmosphere'],
  'uplift':      ['uplifted atmosphere'],
  'reassurance': ['reassuring atmosphere'],
  'silence':     ['quiet atmospheric silence'],
}

// ─── PROOF FEEL — composition fragments only (proof artifact look) ─

export const PROOF_FRAGMENTS_BY_FEEL: Record<ProofFeel, string[]> = {
  'screenshot':         ['phone screenshot artifact', 'messaging app capture feel'],
  'attribution-card':   ['attribution card framing'],
  'testimonial-still':  ['testimonial still capture'],
  'context-evidence':   ['evidence-context capture'],
  'none':               [],
}

// ─── IMAGE ROLE — small role-tag fragment ─────────────────────────
//  Most role info already encoded in framing/distance — this is just
//  a renderer-readable role tag, NOT a redundant aesthetic descriptor.

export const ROLE_FRAGMENTS: Record<ImageRole, string[]> = {
  'hero-anchor':       ['identity-anchor visual'],
  'mood-supporting':   ['supporting mood imagery'],
  'object-trace':      ['object-trace evidence imagery'],
  'lifestyle-context': ['lifestyle context'],
  'proof-callout':     ['proof callout visual'],
  'none':              [],
}
