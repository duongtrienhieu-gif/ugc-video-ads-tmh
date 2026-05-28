// ── Comparison Table Infographic module (P37) ───────────────────────────
//
// 2-column VS competitor table: our product highlighted (green emerald
// + checkmarks) vs "other supplements" (gray + red X). 5-6 rows of
// comparison attributes. Mobile-readable Malaysia/Vietnam/Indonesia
// ecommerce style.
//
// Per Ladipage `comparison_01.jpg`. v1 ships through photographic
// engine since image gen handles 2-col tables reasonably and avoids
// the Canvas-renderer build cost. The designedOverlay('comparison-
// table') block produces the per-locale column labels.

import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'comparison-table',
  label: { vi: 'Bảng so sánh đối thủ', en: 'Comparison Table' },
  category: 'infographic',
  scenePrompt:
    'A clean mobile-readable comparison table infographic. Two-column '
    + 'layout. Left column = the target product, highlighted background '
    + 'with green checkmarks. Right column = "other supplements", gray '
    + 'background with red X marks. 5-6 rows compare quality / formula / '
    + 'certification / pricing attributes. Bold target-locale typography.',
  composition: { productDominance: 0.3, faceDominance: 0 },
  requiresAvatar: false,
  moduleNegatives: [
    'naming a specific competitor brand on the right column',
    'unreadable mobile typography',
    'cluttered design with more than 6 rows',
  ],
})
