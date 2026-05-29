// ── Benefit-Timeline photographic module (P43) ──────────────────────────
//
// Photographic-engine replacement for the Canvas-templated benefit-timeline
// module. Matches Ladipage "PERJALANAN KESIHATAN" reference — a horizontal
// (or vertical) progression timeline with time markers (5 phút / 1 tuần /
// 30 ngày, etc.) and a small icon per milestone showing the visible
// change, anchored by the product packaging.

import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'benefit-timeline',
  label: { vi: 'Dòng thời gian hiệu quả', en: 'Benefit Timeline' },
  category: 'infographic',
  scenePrompt:
    'Premium ecommerce progress-timeline infographic, single composed '
    + 'image. Product packaging anchored on the left side as the visual '
    + 'origin, label fully facing camera. A clean horizontal timeline '
    + 'flows to the right, with 3-5 ASCENDING time markers in bold '
    + '(locale-native — e.g. "5 phút" / "3 hari" / "1 minggu" / "30 hari"). '
    + 'Each time marker has a small flat illustrated icon ABOVE it showing '
    + 'the visible change at that stage (calmed-skin, smiling-face, '
    + 'energised-body, restored-gut, etc.) and a SHORT 4-9 word locale-'
    + 'native description BELOW it. The earliest marker shows a SMALL '
    + 'early effect; the latest shows the mature result. Connected by a '
    + 'soft brand-color arrow line. Mobile-readable typography. Premium '
    + 'landing-page aesthetic, NOT a flat vector poster — hybrid '
    + 'photographic product + illustrated infographic feel.',
  composition: { productDominance: 0.35, faceDominance: 0 },
  requiresAvatar: false,
  moduleNegatives: [
    'time markers out of order',
    'identical icons across all milestones (no progression)',
    'instant-cure overpromise in the early marker',
    'inventing time-based claims not in the product brief',
    'cluttered overlapping milestone icons',
    'unreadable mobile typography',
  ],
})
