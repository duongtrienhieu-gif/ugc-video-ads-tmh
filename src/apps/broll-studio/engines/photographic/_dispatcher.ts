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

  // Build the full prompt via the module's builder
  const composition = module.buildComposition(params)
  const finalPrompt = composition.prompt

  console.info('[photographic dispatcher]', {
    assetType: module.id,
    refs: referenceUrls.length,
    promptLen: finalPrompt.length,
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
  return asset
}
