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

/** Map section → preferred visual treatments. Image prompt assembler
 *  pick 1-2 treatments từ list này. Niche preset có thể override. */
export const SECTION_VISUAL_MAP: Record<SectionId, VisualTreatment[]> = {
  'intro-portrait':      ['family-album', 'domestic-observational'],
  'ordinary-life':       ['environmental-wide', 'smartphone-candid'],
  'daily-friction':      ['photojournalism-light', 'imperfect-real'],
  'failed-attempts':     ['flat-lay-natural'],
  'inner-realization':   [],  // no image
  'discovery-moment':    ['memory-snapshot', 'smartphone-candid'],
  'first-trial':         ['still-life-domestic'],
  'subtle-change':       ['domestic-observational', 'imperfect-real'],
  'new-normal':          ['family-album', 'environmental-wide'],
  'sharing-invitation':  ['family-album', 'landscape-quiet'],
}
