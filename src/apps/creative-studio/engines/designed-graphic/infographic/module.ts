// ── Infographic Module (P8) ─────────────────────────────────────────────────
//
// First concrete designed-graphic module. Composes the standard
// DesignedGraphicModule via the buildDesignedGraphicModule factory
// from P7. The rendering pipeline lives in template.ts; the dispatcher
// (engines/designed-graphic/_dispatcher.ts) routes module.id ===
// 'infographic' → renderInfographic.

import { buildDesignedGraphicModule } from '../_buildModule'

export const module = buildDesignedGraphicModule({
  id: 'infographic',
  label: { vi: 'Infographic', en: 'Infographic' },
  category: 'infographic',
  aspectRatio: '4:5',
  defaultLayoutId:     'infographic-4x5',
  defaultTypographyId: 'infographic-default',
  defaultColorThemeId: 'wellness-clean',
  engineExtras: {
    templateId: 'infographic-4x5-v1',
    rendererKind: 'infographic',
  },
})
