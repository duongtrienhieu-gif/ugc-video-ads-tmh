// ── Failed Solutions UGC module (P37) ───────────────────────────────────
//
// Empathy moment: customer surrounded by previous-attempts (empty
// bottles, OTC meds, traditional remedies) looking disheartened. Sets
// up the "I've tried everything..." emotional beat in the funnel.
// Critical rule: target product is NOT in this frame — this is the
// PRE-discovery state.
//
// Per Ladipage `failed_solutions_01.jpg`. Used in advertorial funnels
// before the product-discovery section.

import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'failed-solutions',
  label: { vi: 'Đã thử nhiều thứ mà thất bại', en: 'Failed Solutions UGC' },
  category: 'ugc',
  scenePrompt:
    'A disheartened person surrounded by various empty or half-used '
    + 'bottles, supplement containers, traditional remedies, and OTC '
    + 'medications. Sitting in a bed / dining table / sofa context with '
    + 'soft natural lighting. Genuine frustrated exhausted expression. '
    + 'Candid UGC quality — looks like a real photo from a real customer.',
  composition: { productDominance: 0.1, faceDominance: 0.7 },
  requiresAvatar: false,
  moduleNegatives: [
    'the target product appears in the frame',
    'happy resolved expression',
    'studio polish or pro-model look',
    'real medication brand names visible',
  ],
})
