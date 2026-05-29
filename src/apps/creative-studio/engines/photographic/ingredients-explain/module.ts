// ── Ingredients-Explain photographic module (P43) ───────────────────────
//
// Photographic-engine replacement for the Canvas-templated
// ingredients-explain module. Matches Ladipage "6 Strain Probiotik
// Berfaedah" reference — central product packaging surrounded by 4-6
// illustrated ingredient badges showing the scientific / brand-given
// ingredient name + a 2-3 word benefit.

import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'ingredients-explain',
  label: { vi: 'Giải thích thành phần', en: 'Ingredients Infographic' },
  category: 'infographic',
  scenePrompt:
    'Scientific ingredient infographic, single composed image. Product '
    + 'packaging CENTERED with a subtle premium glow halo, label fully '
    + 'facing camera. 4-6 illustrated ingredient badges arranged '
    + 'symmetrically AROUND the product (top-left / top-right / mid-left '
    + '/ mid-right / bottom-left / bottom-right). Each badge contains a '
    + 'flat illustrated icon matching the ingredient nature (microorganism '
    + 'cluster for probiotic strains, leaf for botanical, capsule for '
    + 'extract, molecule for active compound, drop for liquid) plus the '
    + 'ingredient name in bold + a 2-3 word locale-native benefit phrase. '
    + 'Use EXACTLY the ingredient names supplied in the brief — do NOT '
    + 'invent latin names or strains. Brand-color soft gradient background '
    + '(white / pearl / soft teal / pastel). Premium clinical medical-grade '
    + 'aesthetic, NOT cartoony. Subtle product brand badge at the top of '
    + 'the frame.',
  composition: { productDominance: 0.4, faceDominance: 0 },
  requiresAvatar: false,
  moduleNegatives: [
    'fewer than 4 ingredient badges visible',
    'badges overlapping the product packaging',
    'inventing ingredient names not in the product brief',
    'cartoony childish icon style',
    'unreadable mobile typography',
    'cluttered busy gradient hiding the product',
  ],
})
