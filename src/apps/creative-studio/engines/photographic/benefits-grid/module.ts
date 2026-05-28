// ── Benefits Icon Grid module (P40) ─────────────────────────────────────
//
// Photographic-engine version of "benefit infographic" matching Ladipage
// `benefits_01.jpg` reference: product packaging centered + 6 circular /
// hexagonal benefit badges arranged around the product, each badge
// pairs an icon with a short locale-native benefit label.
//
// Replaces (visually) the Canvas-rendered designed-graphic infographic
// variants when the user wants the richer image-gen aesthetic with
// proper iconography. Same product knowledge pipeline — Gemini-text is
// NOT involved; the photographic prompt itself describes the grid.

import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'benefits-grid',
  label: { vi: 'Lưới biểu tượng công dụng', en: 'Benefits Icon Grid' },
  category: 'infographic',
  scenePrompt:
    'Clean modern benefits icon grid composition. Product packaging '
    + 'centered with a subtle glow halo. 6 circular or hexagonal badges '
    + 'arranged AROUND the product (top-left, top-right, mid-left, '
    + 'mid-right, bottom-left, bottom-right). Each badge pairs a relevant '
    + 'lifestyle/health icon with a SHORT target-locale benefit label. '
    + 'Brand-color soft gradient background. Mobile-friendly typography. '
    + 'Premium ecommerce scroll-stop hook aesthetic.',
  composition: { productDominance: 0.45, faceDominance: 0 },
  requiresAvatar: false,
  moduleNegatives: [
    'fewer than 5 badges visible',
    'badges overlapping the product',
    'inventing benefit labels not in the product brief',
    'unreadable mobile typography',
    'random unrelated icons',
  ],
})
