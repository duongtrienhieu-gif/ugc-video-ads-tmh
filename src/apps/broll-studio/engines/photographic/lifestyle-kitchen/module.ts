// ── Lifestyle Kitchen module (P3) ───────────────────────────────────────────
import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'lifestyle-kitchen',
  label: { vi: 'Lifestyle bếp', en: 'Kitchen Lifestyle' },
  category: 'ugc',
  scenePrompt: 'The product placed on a bright modern kitchen counter, morning sunlight through a window. The person is in the background slightly out of focus pouring coffee or preparing breakfast. The product label is sharp and clearly readable in the foreground.',
  defaultStyleId: 'iphone',
  composition: { productDominance: 0.5, faceDominance: 0.2 },
})
