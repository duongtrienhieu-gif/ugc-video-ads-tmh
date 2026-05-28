// ── Group Holding Product module (P33) ────────────────────────────────────
//
// Đám đông cầm sản phẩm — group of 3-5 people (friends / family /
// coworkers) all holding the product together. Mass-trust signal:
// "nhiều người cùng dùng = sản phẩm hot". Culturally believable, never
// stock-photo posed.

import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'group-holding',
  label: { vi: 'Đám đông cầm sản phẩm', en: 'Group holding product' },
  category: 'ugc',
  scenePrompt:
    'Group of 3-5 people (friends, family, or coworkers) standing close '
    + 'together, all holding or showing the SAME product. Authentic, natural '
    + 'smiles — NOT model-portfolio poses, NOT stock-photo arrangement. '
    + 'Culturally believable for the target SEA market. Soft natural daylight, '
    + 'casual setting like a living room / kitchen / cafe table / community space.',
  composition: { productDominance: 0.45, faceDominance: 0.55 },
  requiresAvatar: true,
})
