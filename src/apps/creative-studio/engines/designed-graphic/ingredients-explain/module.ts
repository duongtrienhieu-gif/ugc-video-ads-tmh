// ── Ingredients Explain Infographic (P35) ───────────────────────────────────
//
// Variant of the infographic renderer specialized for ingredient
// breakdown. Same Canvas layout as the generic infographic, but the
// content generator is steered to emit bullets that read
// "Ingredient — its benefit" pairs instead of generic claims.
//
// Renderer: shared infographic template (rendererKind: 'infographic').
// Variant flag: engineExtras.infographicVariant = 'ingredients'.

import { buildDesignedGraphicModule } from '../_buildModule'

export const module = buildDesignedGraphicModule({
  id: 'ingredients-explain',
  label: { vi: 'Thành phần sản phẩm', en: 'Ingredients map' },
  category: 'infographic',
  aspectRatio: '4:5',
  defaultLayoutId:     'infographic-4x5',
  defaultTypographyId: 'infographic-default',
  defaultColorThemeId: 'wellness-clean',
  engineExtras: {
    templateId: 'infographic-ingredients-v1',
    rendererKind: 'infographic',
    infographicVariant: 'ingredients',
  },
})
