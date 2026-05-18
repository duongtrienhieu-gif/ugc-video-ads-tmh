// ── Designed-Graphic Module Factory (P7 entry — scaffold for P8) ────────────
//
// Mirrors the role of engines/photographic/_buildModule.ts for the
// designed-graphic group: a single factory consumed by every concrete
// P8 module to keep the DesignedGraphicModule contract uniformly
// implemented.
//
// P7 ships the factory only — no concrete modules yet. P8 will write
// the infographic + cta-banner modules using this factory.

import type {
  AssetCategory,
  AssetTypeId,
  GenerateAssetParams,
  GeneratedAsset,
} from '../../types/asset'
import type {
  DesignedGraphicModule,
  DesignedGraphicLayout,
  DesignedGraphicTypography,
  DesignedGraphicColorTheme,
} from '../../types/designedGraphic'
import { findLayout } from '../../shared/design-system/grid'
import { findTypography } from '../../shared/design-system/typography'
import { findColorTheme } from '../../shared/design-system/colorThemes'

/** Spec for a single designed-graphic module — passed to the factory. */
export interface DesignedGraphicModuleSpec {
  id: AssetTypeId
  label: { vi: string; en: string }
  category: AssetCategory
  aspectRatio: DesignedGraphicModule['aspectRatio']
  /** Layout preset id from LAYOUT_PRESETS (or custom DesignedGraphicLayout). */
  defaultLayoutId: string
  /** Typography preset id. */
  defaultTypographyId: string
  /** Color theme preset id. */
  defaultColorThemeId: string
  /** Optional engine extras attached to every output. */
  engineExtras?: Record<string, unknown>
}

/**
 * Build a DesignedGraphicModule from a spec. The factory auto-resolves
 * layout / typography / theme presets via the design-system helpers,
 * with caller-supplied params.options able to override:
 *   options.layoutId   → grid.LAYOUT_PRESETS key
 *   options.typographyId → typography.TYPOGRAPHY_PRESETS key
 *   options.colorThemeId → colorThemes.COLOR_THEMES key
 */
export function buildDesignedGraphicModule(
  spec: DesignedGraphicModuleSpec,
): DesignedGraphicModule {
  return {
    id: spec.id,
    engineGroup: 'designed-graphic',
    label: spec.label,
    category: spec.category,
    aspectRatio: spec.aspectRatio,

    buildLayout(params: GenerateAssetParams): DesignedGraphicLayout {
      const opt = (params.options ?? {}) as Record<string, unknown>
      const id = (opt.layoutId as string | undefined) ?? spec.defaultLayoutId
      return findLayout(id)
    },

    buildTypography(params: GenerateAssetParams): DesignedGraphicTypography {
      const opt = (params.options ?? {}) as Record<string, unknown>
      const id = (opt.typographyId as string | undefined) ?? spec.defaultTypographyId
      return findTypography(id)
    },

    buildColorTheme(params: GenerateAssetParams): DesignedGraphicColorTheme {
      const opt = (params.options ?? {}) as Record<string, unknown>
      const id = (opt.colorThemeId as string | undefined) ?? spec.defaultColorThemeId
      return findColorTheme(id)
    },

    normalizeOutput(raw, params): GeneratedAsset {
      const now = Date.now()
      return {
        id: `${spec.id}_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        outputUrl: raw.outputUrl,
        metadata: {
          generatedAt: now,
          assetType: spec.id,
          engineGroup: 'designed-graphic',
          category: spec.category,
          productId: raw.productId,
          modelId: params.modelId,
          aspectRatio: spec.aspectRatio,
          tags: ['designed-graphic', spec.category],
          engineExtras: spec.engineExtras,
        },
      }
    },
  }
}
