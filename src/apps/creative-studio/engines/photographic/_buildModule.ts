// ── Photographic Module Builder (P3) ────────────────────────────────────────
//
// Shared factory for creating PhotographicModule instances. Each scene
// module declares its identity + scene-specific prompt + composition rules
// and the factory wires up the standard buildPrompt / buildNegativePrompt /
// buildComposition / buildQC / normalizeOutput methods.
//
// This eliminates 80% of the boilerplate that would otherwise repeat
// across 9 scene modules.

import type { AssetTypeId, AssetCategory, GenerateAssetParams, GeneratedAsset } from '../../types/asset'
import type {
  PhotographicModule, PhotographicComposition, PhotographicNegative,
  PhotographicQCConfig,
} from '../../types/photographic'
import { PRODUCT_LOCK_BLOCK, AVATAR_LOCK_BLOCK, buildRefMapText } from '../../shared/prompts/productLock'
import { buildFormatNegative } from '../../shared/prompts/negativeGlobal'
import { findStyleVariant } from '../../shared/metadata/styleVariants'

export interface PhotographicModuleSpec {
  id: AssetTypeId
  label: { vi: string; en: string }
  category: AssetCategory
  /** Scene prompt fragment baked into [SCENE] block. */
  scenePrompt: string
  /** Default style id from STYLE_VARIANTS (user can override via options.styleId). */
  defaultStyleId?: string
  /** Module-specific composition rules. */
  composition?: Partial<PhotographicComposition>
  /** Module-specific negative additions on top of global format negatives. */
  moduleNegatives?: string[]
  /** Module-specific QC overrides. */
  qcOverrides?: Partial<PhotographicQCConfig>
  /** Whether the scene REQUIRES the avatar reference. */
  requiresAvatar?: boolean
  /** Whether the scene allows multi-product (eg "Bàn nhiều SP"). */
  allowsMultiProduct?: boolean
  /** P48 — UI aspect ratio for this asset. The dispatcher maps it to the
   *  closest KIE-supported size (1:1, 3:2, 2:3) before calling the model.
   *  Default '1:1'. */
  aspectRatio?: '1:1' | '4:5' | '9:16' | '3:2' | '16:9'
}

const DEFAULT_COMPOSITION: PhotographicComposition = {
  productDominance: 0.6,
  faceDominance: 0.4,
  allowedAngles: ['eye-level', 'slight-low-angle', '3/4 angle', 'over-the-shoulder'],
  forbiddenLayouts: ['centered-symmetrical', 'studio-product-only'],
}

const DEFAULT_QC: PhotographicQCConfig = {
  enableProductLockQC: true,
  minPassScore: 70,
  extraChecks: ['label-readable', 'logo-intact'],
}

export function buildPhotographicModule(spec: PhotographicModuleSpec): PhotographicModule {
  const composition: PhotographicComposition = {
    ...DEFAULT_COMPOSITION,
    ...spec.composition,
  }

  const negative: PhotographicNegative = {
    moduleNegatives: spec.moduleNegatives ?? [],
    applyGlobalNegatives: true,
  }

  const qc: PhotographicQCConfig = {
    ...DEFAULT_QC,
    ...spec.qcOverrides,
  }

  const aspectRatio = spec.aspectRatio ?? '1:1'

  return {
    id: spec.id,
    engineGroup: 'photographic',
    label: spec.label,
    category: spec.category,
    aspectRatio,
    composition,
    negative,
    qc,

    buildPrompt(params: GenerateAssetParams): string {
      const opts = params.options ?? {}
      const styleId = (opts.styleId as string | undefined) ?? spec.defaultStyleId ?? 'realistic'
      const style = findStyleVariant(styleId)
      const hasAvatar = !!params.modelId
      const hasBaseRef = !!opts.baseRef
      const variationHint = (opts.variationHint as string | null | undefined) ?? null

      const refMap = buildRefMapText(hasAvatar, hasBaseRef)
      const avatarBlock = hasAvatar ? `\n\n${AVATAR_LOCK_BLOCK}` : ''
      const sceneBlock = `\n\n[SCENE]\n${spec.scenePrompt}`
      const styleBlock = `\n\n[STYLE]\n${style.stylePrompt}`
      const variationBlock = variationHint
        ? `\n\n[VARIATION]\n${variationHint}\nThe product must remain pixel-faithful to the FIRST reference. The person must remain the same individual as in the previous shot.`
        : ''
      const formatBlock = `\n\n[FORMAT]
${aspectRatio} composition (${aspectRatio === '1:1' ? 'square' : aspectRatio === '9:16' || aspectRatio === '4:5' ? 'portrait' : aspectRatio === '16:9' || aspectRatio === '3:2' ? 'landscape' : 'as-declared'}). The product label must be fully readable and unobstructed. ${spec.allowsMultiProduct ? '' : 'Exactly one product instance unless the scene explicitly calls for multiple.'} ${hasAvatar ? 'Exactly one person.' : ''}`

      return `IMAGE-EDITING TASK: ${refMap}

${PRODUCT_LOCK_BLOCK}${avatarBlock}${sceneBlock}${styleBlock}${variationBlock}${formatBlock}`
    },

    buildNegativePrompt(params: GenerateAssetParams): string {
      const hasAvatar = !!params.modelId
      const baseNeg = buildFormatNegative(hasAvatar)
      const moduleNeg = spec.moduleNegatives && spec.moduleNegatives.length > 0
        ? `\n- ${spec.moduleNegatives.join('\n- ')}`
        : ''
      return baseNeg + moduleNeg
    },

    buildComposition(params: GenerateAssetParams) {
      const fullPrompt = this.buildPrompt(params)
      const negativePrompt = this.buildNegativePrompt(params)
      // referenceUrls resolution happens at dispatch time (orchestrator
      // resolves asset:xxx refs to public URLs). At module level we just
      // declare the spec.
      const compositionAspect: '1:1' | '2:3' | '3:2' =
          aspectRatio === '3:2' || aspectRatio === '16:9' ? '3:2'
        : aspectRatio === '9:16' || aspectRatio === '4:5' ? '2:3'
        : '1:1'
      return {
        prompt: fullPrompt + '\n\n' + negativePrompt,
        negativePrompt,
        referenceUrls: [],  // populated by dispatcher
        aspect: compositionAspect,
      }
    },

    buildQC(): PhotographicQCConfig {
      return qc
    },

    normalizeOutput(raw, params: GenerateAssetParams): GeneratedAsset {
      const id = `asset_${spec.id}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
      return {
        id,
        outputUrl: raw.outputUrl,
        metadata: {
          generatedAt: Date.now(),
          assetType: spec.id,
          engineGroup: 'photographic',
          category: spec.category,
          productId: raw.productId ?? params.productId,
          modelId: raw.modelId ?? params.modelId,
          aspectRatio,
          tags: [spec.id, spec.category],
        },
      }
    },
  }
}
