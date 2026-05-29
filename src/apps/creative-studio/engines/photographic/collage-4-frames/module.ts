// ── Collage 4-Frame Testimonial module (P35) ──────────────────────────────
//
// Single-prompt 4-frame composite rendered by KIE GPT-4o. Asks the
// model directly for a 2×2 grid where each cell shows a different
// person holding the SAME product. Same lighting + background style
// across cells, with thin gutter lines separating them.
//
// This is the pragmatic v1 — a true multi-asset composite engine
// (generate 4 portraits separately then Canvas-assemble) is a Phase
// 36+ scope item. v1 ships now with a single-call layout that the
// model can usually produce well.

import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'collage-4-frames',
  label: { vi: 'Collage 4 khung feedback', en: '4-frame testimonial collage' },
  category: 'social-proof',
  scenePrompt:
    'A 2×2 grid composition (4 equal cells) where EACH CELL shows a DIFFERENT '
    + 'person — varied age / gender / look — all holding the SAME product. '
    + 'Thin clean white gutter lines separate the 4 cells. Identical lighting '
    + 'style + background tone across all 4 cells so the grid reads as a '
    + 'cohesive testimonial collage. Each person has authentic natural '
    + 'expression, NOT model-portfolio pose, NOT stock-photo uniformity. '
    + 'Product label clearly visible in every cell. Each face culturally '
    + 'believable for SEA market.',
  composition: { productDominance: 0.45, faceDominance: 0.55 },
  requiresAvatar: false,
  moduleNegatives: [
    'same face repeated across cells',
    'cells with different products',
    'inconsistent lighting between cells',
    'studio-perfect uniform poses',
  ],
})
