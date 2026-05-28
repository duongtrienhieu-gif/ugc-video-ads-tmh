// ── Mechanism-Explain photographic module (P43) ─────────────────────────
//
// Photographic-engine replacement for the Canvas-templated
// mechanism-explain module. Matches Ladipage "Bagaimana Probiotik Bekerja"
// reference — biological / anatomical illustration showing the
// before/after mechanism of action with the product packaging as anchor.

import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'mechanism-explain',
  label: { vi: 'Cơ chế hoạt động', en: 'Mechanism Diagram' },
  category: 'infographic',
  scenePrompt:
    'Scientific mechanism diagram, single composed image. Top half shows '
    + 'a "before" state (problem) — small flat illustration of the affected '
    + 'body system in trouble (e.g. inflamed gut wall with bad bacteria, '
    + 'clogged pore, dull dehydrated skin layer). Bottom half shows the '
    + '"after" state — same body system restored / balanced. Product '
    + 'packaging anchored on the right side, label fully facing camera, '
    + 'with a thin elegant arrow / flow line pointing from the product '
    + 'into the body-system illustration. 3-5 small numbered stage labels '
    + 'placed along the flow path, each stage in locale-native phrasing '
    + 'starting with the locale\'s equivalent of "Bước N:" / "Step N:". '
    + 'Clinical premium medical-infographic aesthetic — soft anatomical '
    + 'illustration style with biology-grade detail, NOT cartoony. Brand-'
    + 'color light gradient background. Mobile-readable typography.',
  composition: { productDominance: 0.35, faceDominance: 0 },
  requiresAvatar: false,
  moduleNegatives: [
    'horror / overly graphic anatomical detail',
    'cartoony childish illustration',
    'inventing mechanism claims not supported by the product brief',
    'magical glow effects on the body illustration',
    'identical before / after halves (no contrast)',
    'unordered or missing step numbers',
    'unreadable mobile typography',
  ],
})
