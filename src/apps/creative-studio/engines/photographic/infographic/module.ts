// ── Infographic (stats) module (P43) ────────────────────────────────────
//
// Photographic-engine replacement for the Canvas-templated infographic
// module. Matches Ladipage "FAKTA TERBUKTI" / "Probiotik Plus" reference
// quality — a big hero stat + 3-5 supporting bullets + product packaging
// hero in a richly illustrated single-image composition.

import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'infographic',
  label: { vi: 'Thống kê & Số liệu', en: 'Stats Infographic' },
  category: 'infographic',
  scenePrompt:
    'Premium ecommerce stat-driven infographic, single composed image. '
    + 'One BIG bold hero stat number prominently anchored at the top-left '
    + '(e.g. "96%" or "30 hari") with a 2-4 word target-locale label beside '
    + 'or below it. 3-5 supporting bullet points stacked below the hero '
    + 'stat — each bullet pairs a small flat illustrated icon with a SHORT '
    + 'locale-native phrase. Product packaging shown on the right side as '
    + 'anchor, label fully facing camera. Soft brand-color gradient '
    + 'background (cream / pearl / pastel teal). Clean ecommerce-readable '
    + 'typography, NOT a stock photo, NOT a vector flat illustration only — '
    + 'a hybrid photographic product + illustrated infographic feel like a '
    + 'premium landing-page hero section.',
  composition: { productDominance: 0.4, faceDominance: 0 },
  requiresAvatar: false,
  moduleNegatives: [
    'cluttered busy layout',
    'unreadable tiny typography',
    'random photo as background',
    'inventing statistics not in the product brief',
    'multiple competing hero numbers',
  ],
})
