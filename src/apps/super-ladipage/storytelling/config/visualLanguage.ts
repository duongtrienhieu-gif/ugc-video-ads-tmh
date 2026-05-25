// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — visual language config
//
// Anti-aesthetic-drift guardrail: KHÔNG để engine drift sang Pinterest /
// fashion editorial / luxury catalog. Treatments hướng tới "real human
// life" — family album, smartphone candid, photo journalism.
// ─────────────────────────────────────────────────────────────────────

import type {
  BlockId, VisualLanguageConfig, VisualTreatment,
} from '../types'

export const VISUAL_LANGUAGE: VisualLanguageConfig = {
  treatments: [
    'smartphone-candid',
    'domestic-observational',
    'family-album',
    'photojournalism-light',
    'imperfect-real',
    'environmental-wide',
    'flat-lay-natural',
    'memory-snapshot',
    'still-life-domestic',
    'landscape-quiet',
  ],

  /** Blacklist — runtime sẽ inject "AVOID: <tag>" cho mỗi tag. */
  antiAestheticBlacklist: [
    'pinterest',
    'luxury-editorial',
    'fashion-campaign',
    'catalog',
    'ai-commercial',
    'tvc-montage',
    'instagram-aesthetic',
    'kinfolk-cereal',
    'overly-composed',
    'hyper-golden-hour',
  ],

  /** Single short self-test prompt — image gen runtime inject để LLM
   *  filter chính output của nó. */
  realismSelfTestPrompt:
    'Would a real family member post this photo on Facebook? Or only a brand stylist? If only a brand stylist — reject.',
}

/** Baseline preferred visual treatments per block (Chunk E rebuilds taxonomy). */
export const SECTION_VISUAL_MAP: Record<BlockId, VisualTreatment[]> = {
  // Phase 1 — RECOGNITION
  'self-recognition-hook':     ['family-album', 'domestic-observational'],
  'daily-micro-friction':      ['photojournalism-light', 'imperfect-real'],
  'hidden-emotional-truth':    ['imperfect-real'],
  'not-alone-bridge':          ['smartphone-candid', 'imperfect-real'],
  // Phase 2 — TRUST + RESISTANCE ALIGNMENT
  'narrator-validation-entry': ['family-album', 'domestic-observational'],
  'shared-failed-attempts':    ['flat-lay-natural'],
  'skepticism-alignment':      ['imperfect-real'],
  'belief-shift':              ['memory-snapshot', 'smartphone-candid'],
  // Phase 3 — SOLUTION OPENING
  'natural-product-discovery': ['still-life-domestic'],
  'why-this-felt-different':   ['still-life-domestic', 'imperfect-real'],
  'soft-mechanism-compare':    ['flat-lay-natural', 'still-life-domestic'],
  // Phase 4 — FUTURE SELF IMMERSION
  'micro-transformation':      ['domestic-observational', 'imperfect-real'],
  'emotional-wins':            ['family-album', 'environmental-wide'],
  'social-proof':              ['smartphone-candid', 'still-life-domestic'],
  'future-self-cta':           ['landscape-quiet', 'family-album'],
}
