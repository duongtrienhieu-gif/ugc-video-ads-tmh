// ── CTA Banner Module (P8) ──────────────────────────────────────────────────
//
// Second concrete designed-graphic module. Composes via
// buildDesignedGraphicModule. The dispatcher routes module.id ===
// 'cta-banner' → renderCtaBanner.

import { buildDesignedGraphicModule } from '../_buildModule'

export const module = buildDesignedGraphicModule({
  id: 'cta-banner',
  label: { vi: 'Banner CTA', en: 'CTA banner' },
  category: 'banner',
  aspectRatio: '4:5',
  defaultLayoutId:     'cta-banner-4x5',
  defaultTypographyId: 'cta-banner-default',
  defaultColorThemeId: 'sport-vivid',
  engineExtras: {
    templateId: 'cta-banner-4x5-v1',
    rendererKind: 'cta-banner',
  },
})
