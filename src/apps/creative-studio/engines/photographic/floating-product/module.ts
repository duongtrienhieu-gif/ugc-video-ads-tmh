// ── Floating Product Ad module (P33) ──────────────────────────────────────
//
// Dynamic ad packshot: product floating mid-frame with splash / glow /
// particles surrounding it. Targets premium ad creative, NOT clean
// ecommerce thumbnail (that's product-shot's job).

import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'floating-product',
  label: { vi: 'Floating Product Ad', en: 'Floating Product Ad' },
  category: 'product-shot',
  scenePrompt:
    'Product floats mid-frame with dynamic splash + glow + particles around it. '
    + 'Premium ad creative vibe — like a hero shot for a paid Facebook ad. '
    + 'Centered subject with negative space, dramatic rim light, soft splash '
    + 'or powder burst emanating outward, subtle particle accents.',
  composition: { productDominance: 0.9, faceDominance: 0 },
})
