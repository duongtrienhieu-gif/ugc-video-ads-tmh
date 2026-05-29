// ── Product + Ingredient Composition module (P33) ─────────────────────────
//
// Product photograph arranged with key ingredients / herbs / botanicals
// in frame. Science + nature hybrid look. Used for niches where
// ingredient provenance matters (skincare / supplement / herbal / wellness).

import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'ingredient-composition',
  label: { vi: 'Sản phẩm + Nguyên liệu', en: 'Product + Ingredient Composition' },
  category: 'product-shot',
  scenePrompt:
    'Product as the centered hero on a clean natural surface (wood / stone / '
    + 'linen), surrounded by a tasteful arrangement of the key ingredients — '
    + 'herbs, leaves, dried flowers, raw extracts, or botanical accents that '
    + 'match the product brief. Composition feels like editorial wellness '
    + 'magazine — premium, scientific, natural. Soft directional daylight.',
  composition: { productDominance: 0.7, faceDominance: 0 },
})
