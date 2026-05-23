// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — visual language config
//
// Anti-aesthetic-drift guardrail: KHÔNG để engine drift sang Pinterest /
// fashion editorial / luxury catalog. Treatments hướng tới "real human
// life" — family album, smartphone candid, photo journalism.
// ─────────────────────────────────────────────────────────────────────

import type {
  SectionId, VisualLanguageConfig, VisualTreatment,
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

/** v4.1 — 11 sections. Image purpose roles + camera language come in v4.3.
 *  For now, baseline preferred treatments per section. */
export const SECTION_VISUAL_MAP: Record<SectionId, VisualTreatment[]> = {
  'hook-interrupt':      ['family-album', 'domestic-observational'],   // anchor-face + emotion-detail
  'daily-friction':      ['photojournalism-light', 'imperfect-real'],  // daily struggle candid
  'internal-fear':       ['imperfect-real'],                            // silence-frame, partial face
  'failed-attempts':     ['flat-lay-natural'],                          // object-symbol
  'belief-shift':        ['memory-snapshot', 'smartphone-candid'],      // cafe scene with friend
  'soft-reveal':         ['still-life-domestic'],                       // product ~15% frame
  'micro-reward':        ['domestic-observational', 'imperfect-real'],  // mở rèm, đi bộ
  'emotional-payoff':    ['family-album', 'environmental-wide'],        // siêu thị, nấu ăn
  'reflection-trust':    ['landscape-quiet', 'imperfect-real'],         // ban công, cửa sổ
  'trust-continuity':    ['smartphone-candid', 'still-life-domestic'],  // FB feedback + product clean
  'soft-cta':            ['landscape-quiet', 'family-album'],           // landscape OR window
}
