// ── Mechanism Explain Infographic (P35) ─────────────────────────────────────
//
// Variant of the infographic renderer specialized for "how it works"
// explanations. Bullets become ordered mechanism steps; heroStat
// emphasizes the key delivery metric (speed, depth, coverage).

import { buildDesignedGraphicModule } from '../_buildModule'

export const module = buildDesignedGraphicModule({
  id: 'mechanism-explain',
  label: { vi: 'Cơ chế hoạt động', en: 'How it works' },
  category: 'infographic',
  aspectRatio: '4:5',
  defaultLayoutId:     'infographic-4x5',
  defaultTypographyId: 'infographic-default',
  defaultColorThemeId: 'wellness-clean',
  engineExtras: {
    templateId: 'infographic-mechanism-v1',
    rendererKind: 'infographic',
    infographicVariant: 'mechanism',
  },
})
