// ── Benefit Timeline Infographic (P35) ──────────────────────────────────────
//
// Variant of the infographic renderer specialized for time-stamped
// result progression: "Sau 5 phút / Sau 7 ngày / Sau 30 ngày". Each
// bullet becomes a time-anchored milestone instead of a generic benefit.

import { buildDesignedGraphicModule } from '../_buildModule'

export const module = buildDesignedGraphicModule({
  id: 'benefit-timeline',
  label: { vi: 'Timeline kết quả', en: 'Benefit timeline' },
  category: 'infographic',
  aspectRatio: '4:5',
  defaultLayoutId:     'infographic-4x5',
  defaultTypographyId: 'infographic-default',
  defaultColorThemeId: 'wellness-clean',
  engineExtras: {
    templateId: 'infographic-timeline-v1',
    rendererKind: 'infographic',
    infographicVariant: 'timeline',
  },
})
