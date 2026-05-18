// ── Cafe Lifestyle module (P3) ──────────────────────────────────────────────
import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'cafe-lifestyle',
  label: { vi: 'Lifestyle quán cafe', en: 'Cafe Lifestyle' },
  category: 'ugc',
  scenePrompt: 'The person seated at a cafe table holding the product, a cappuccino and a laptop on the table, warm bokeh-free background, candid lifestyle moment, product label rotated toward the camera.',
  defaultStyleId: 'realistic',
  requiresAvatar: true,
  composition: { productDominance: 0.45, faceDominance: 0.45 },
})
