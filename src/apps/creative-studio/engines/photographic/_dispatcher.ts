// ── Photographic Engine Dispatcher (P3) ─────────────────────────────────────
//
// Runtime pipeline for the photographic engine group. Called by
// orchestration/dispatch.ts when a PhotographicModule is resolved.
//
// Flow:
//   1. Build composition (prompt + negatives + ref spec) from the module
//   2. Resolve product / avatar refs from bankStore + assetStore
//   3. Call KIE GPT-4o image generation
//   4. Save asset, return GeneratedAsset normalised via module
//
// QC is OPTIONAL here — modules can declare qc.enableProductLockQC to
// run a post-render Gemini Vision pass. P3 leaves the QC layer wired
// but skipped by default; runtime can opt-in.

import type { PhotographicModule } from '../../types/photographic'
import type { GenerateAssetParams, GeneratedAsset } from '../../types/asset'
import { generateGpt4oImage } from '../../../../utils/kieai'
import { saveAsset } from '../../../../utils/assetStore'
import { useBankStore } from '../../../../stores/bankStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { toPublicUrl } from '../../shared/utils/refResolver'
import { runBaselineQC } from '../../shared/qc/baselineQC'
import { findCreativeConfig } from '../../creativeConfig/configs'
import { assemblePrompt } from '../../shared/prompt/promptAssembler'
import { assembleCompressedPrompt } from '../../shared/prompt/compressedPrompt'
import { dnaSummary } from '../../shared/prompt/dnaDirective'
import { fromProduct } from '../../services/productKnowledge'
import type { UINativeLocale } from '../../types/uiNative'

export async function dispatchPhotographic(
  module: PhotographicModule,
  params: GenerateAssetParams,
): Promise<GeneratedAsset> {
  const apiKey = useSettingsStore.getState().kieApiKey
  if (!apiKey) {
    throw new Error('[photographic dispatcher] Missing KIE.ai API key in settings')
  }

  // Resolve product + avatar refs from bank
  const bank = useBankStore.getState()
  const product = params.productId ? bank.getProductById(params.productId) : null
  if (!product) {
    throw new Error(`[photographic dispatcher] Product not found: ${params.productId}`)
  }

  const productUrl = product.productImage ? await toPublicUrl(product.productImage) : null
  if (!productUrl) {
    throw new Error(`[photographic dispatcher] Cannot resolve product image for: ${product.productName}`)
  }

  const avatar = params.modelId ? bank.models.find((m) => m.id === params.modelId) : null
  const avatarUrl = avatar?.characterImage ? await toPublicUrl(avatar.characterImage) : null

  // Optional base ref for variation continuity (passed via options.baseRef)
  const baseRef = (params.options?.baseRef as string | undefined) ?? null
  const baseUrl = baseRef ? await toPublicUrl(baseRef) : null

  const referenceUrls: string[] = [productUrl]
  if (avatarUrl) referenceUrls.push(avatarUrl)
  if (baseUrl) referenceUrls.push(baseUrl)

  // P15: prefer Creative Config + PromptAssembler when a config exists
  // for this asset type. Falls back to legacy module.buildComposition()
  // when no config registered yet (back-compat).
  const config = findCreativeConfig(module.id)
  let finalPrompt: string
  let promptSource: 'compressed' | 'structured' | 'legacy'
  let blocksUsed: string[] = []
  if (config) {
    // P25 — load FULL product knowledge from bankStore (USPs / benefits
    // / pain points / audience / offer / tone) so the prompt assembler
    // can bake context into the scene composition. Locale defaults to
    // 'vi-VN' but can be overridden via params.options.locale.
    const locale = (params.options?.locale as UINativeLocale | undefined) ?? 'vi-VN'
    const productKnowledge = fromProduct(product, locale)

    const promptCtx = {
      productName: product.productName,
      productDescription: product.productDescription,
      hasAvatar: !!avatarUrl,
      hasBaseRef: !!baseUrl,
      variationHint: (params.options?.variationHint as string | undefined) ?? null,
      personaId: params.options?.personaId as string | undefined,
      beatId:    params.options?.beatId    as string | undefined,
      locale,
      productKnowledge,
    }

    const { prompt: structuredPrompt, blocksUsed: structuredBlocks } = assemblePrompt(config, promptCtx)
    const compressedPrompt = assembleCompressedPrompt(config, promptCtx)

    // P42 — default to the compressed flat-paragraph prompt (Ladipage
    // density profile, ~100-200 words). The structured multi-section
    // prompt remains available behind params.options.useStructuredPrompt
    // for A/B comparison + emergency rollback. blocksUsed is still
    // reported (from the structured assembly) for diagnostics — the
    // creative DNA snapshot persisted on the asset is independent of
    // which prompt path the model saw.
    const useCompressed = params.options?.useStructuredPrompt !== true
    finalPrompt = useCompressed ? compressedPrompt : structuredPrompt
    promptSource = useCompressed ? 'compressed' : 'structured'
    blocksUsed = structuredBlocks
  } else {
    const composition = module.buildComposition(params)
    finalPrompt = composition.prompt
    promptSource = 'legacy'
  }

  console.info('[photographic dispatcher]', {
    assetType: module.id,
    refs: referenceUrls.length,
    promptLen: finalPrompt.length,
    promptSource,
    blocksUsed,
  })

  const remoteUrl = await generateGpt4oImage({
    apiKey,
    prompt: finalPrompt,
    filesUrl: referenceUrls,
    size: '1:1',
  })

  // Persist the generated image
  const resp = await fetch(remoteUrl)
  if (!resp.ok) throw new Error(`[photographic dispatcher] fetch ${resp.status}`)
  const blob = await resp.blob()
  if (blob.size < 1000) throw new Error('[photographic dispatcher] response too small — likely corrupt')

  // P9 — baseline QC. Photographic accepts PNG OR JPEG from KIE, so do
  // not force JPEG SOI here; the size + decoded-dimension checks still
  // apply, dimensions are skipped (no fixed template size for KIE output).
  const qc = await runBaselineQC({
    blob,
    requireJpeg: false,
  })

  const assetRef = await saveAsset(blob, blob.type || 'image/png')

  const asset = module.normalizeOutput(
    { outputUrl: assetRef, productId: params.productId, modelId: params.modelId },
    params,
  )
  asset.metadata.qcSummary = {
    passed:     qc.passed,
    overall:    qc.overall,
    issues:     qc.issues,
    visionPass: qc.visionPass,
  }
  // P28 — surface DNA rule snapshot on the asset.
  if (config?.dna) {
    asset.metadata.engineExtras = {
      ...(asset.metadata.engineExtras ?? {}),
      creativeDna: dnaSummary(config.dna),
    }
  }
  return asset
}
