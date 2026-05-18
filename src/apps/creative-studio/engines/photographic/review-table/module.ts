// ── Review Table module (P3) — "Review trên bàn" ────────────────────────────
import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'review-table',
  label: { vi: 'Review trên bàn', en: 'Desk Flat-lay Review' },
  category: 'product-shot',
  scenePrompt: 'The product is placed on a clean wooden desk with the person\'s hands visible holding or arranging it. Three-quarter overhead angle, soft daylight, no shadow obscuring the label.',
  defaultStyleId: 'realistic',
  composition: { productDominance: 0.65, faceDominance: 0.15, allowedAngles: ['three-quarter-overhead', 'top-down-flatlay'] },
})
