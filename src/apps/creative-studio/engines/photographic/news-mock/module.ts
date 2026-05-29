// ── News Article Mock module (P37) ──────────────────────────────────────
//
// Authority signal via fake news / health-authority screenshot. Headline
// + partial article body about the product niche (gut health, skincare,
// etc.) framed inside the visual chrome of a real Malaysian / Vietnamese
// / Indonesian outlet. Per Ladipage `news_01.jpg` / `news_02.jpg`.
//
// HARD RULE: never impersonate a SPECIFIC named real outlet's branding
// pixel-perfect — the model produces "looks like a Malaysian news
// site" without claiming to BE Berita Harian / VnExpress. We surface
// this constraint in the DNA failureModes.

import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'news-mock',
  label: { vi: 'Mock báo / cơ quan y tế', en: 'News / Health Authority Mock' },
  category: 'social-proof',
  scenePrompt:
    'A realistic screenshot of a generic regional health news article — '
    + 'newspaper-style header, prominent headline relevant to the product '
    + 'niche, partial article body visible, publication chrome neutralized '
    + '(NOT pixel-copying a specific outlet). Mobile screenshot quality.',
  composition: { productDominance: 0.1, faceDominance: 0.2 },
  requiresAvatar: false,
  moduleNegatives: [
    'pixel-copying a specific real outlet brand',
    'fake doctor headshots with named credentials',
    'invented quotes attributed to real people',
  ],
})
