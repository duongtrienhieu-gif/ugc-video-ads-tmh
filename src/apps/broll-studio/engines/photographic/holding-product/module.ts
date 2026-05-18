// ── Holding Product module (P3) — "Cầm sản phẩm" ────────────────────────────
import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'holding-product',
  label: { vi: 'Cầm sản phẩm', en: 'Holding Product' },
  category: 'product-shot',
  scenePrompt: 'The person holds the product at chest level with both hands, label fully facing the camera at eye level, gentle confident smile, looking directly at the lens. Neutral indoor background with soft daylight.',
  defaultStyleId: 'realistic',
  requiresAvatar: true,
  composition: { productDominance: 0.6, faceDominance: 0.5 },
})
