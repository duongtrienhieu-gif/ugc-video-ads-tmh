// ── Metric-Chip CTA Banner module (P37) ─────────────────────────────────
//
// Last-scroll-stopper conversion banner: product packaging centered
// with a subtle glow halo, surrounded by floating metric chips (rating,
// customer count, trust badges, "TOP RATED 2026" etc). Locale-aware
// text overlay + price-lock anti-invention pattern.
//
// Per Ladipage `finalcta_01.jpg` / `finalcta_02.jpg`. This is the
// photographic-engine version of `cta-banner` — heavier on the
// product visual + social proof metrics, lighter on the typography
// CTA structure.

import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'metric-cta',
  label: { vi: 'Banner CTA + Metric Chip', en: 'Metric-Chip CTA' },
  category: 'banner',
  scenePrompt:
    'Last-scroll-stopper conversion banner. The EXACT product packaging '
    + 'centered with a subtle premium glow halo, surrounded by 4-6 '
    + 'floating metric chips (rating stars, customer count, trust '
    + 'badges). Optional bottom-row mini before/after thumbnail chips. '
    + 'Large readable target-locale headline + CTA button shape.',
  composition: { productDominance: 0.55, faceDominance: 0 },
  requiresAvatar: false,
  moduleNegatives: [
    'inventing prices not in the offer field',
    'inventing certification labels not real',
    'busy gradient hiding the product',
  ],
})
