// ── Product Shot module (P3) — generic product hero with person reviewing ───
import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'product-shot',
  label: { vi: 'Ảnh sản phẩm chính', en: 'Product Shot' },
  category: 'product-shot',
  scenePrompt: 'The person holds the product in one hand and uses the index finger of the other to point at a specific feature on the label, looking down at it with a focused interested expression, as if explaining to a friend on camera. Soft natural daylight.',
  defaultStyleId: 'iphone',
  composition: { productDominance: 0.7, faceDominance: 0.3 },
})
