// ── B-roll Studio (Mode 2) — single-scene renderer (P6, Phase 0) ─────────────
// Renders ONE standalone B-roll clip from a concept prompt + the product image.
// Phase 0 wires the CORE i2v path (the default + the anti-drift chain the user chose):
//   product-present → gpt-4o-image FAITHFUL first-frame (keeps the product EXACT) →
//   Seedance 1.5 Pro image-to-video animates it.
// Reuses the existing KIE helpers (same as mode-1 insertRenderer) — no new render tech.
// Talking-head (InfiniteTalk) + Veo premium paths land in a later phase (credit for them
// already computed by estimateSceneCredit). Dev helper __testStudioScene tests via console.
// ─────────────────────────────────────────────────────────────────────────────

import { generateGpt4oImageFast, generateVideoJob, pollVideoJobUntilDone } from '../../../../utils/kieai'
import { STUDIO_MODELS, type StudioResolution } from './brollStudioModels'

export interface RenderStudioSceneParams {
  kieApiKey: string
  /** The i2v concept prompt (English) — what to animate. */
  conceptPromptEn: string
  /** Product image URLs (refs) — used for the faithful first-frame + i2v grounding. */
  productImageUrls?: string[]
  /** Product-present scene → gpt-4o-image faithful frame first (anti product-drift). */
  withFaithfulFrame: boolean
  resolution: StudioResolution
  durationSec: number
  onStage?: (stage: string) => void
}

/** Render one studio scene → returns the remote video URL (caller saves it as an asset). */
export async function renderStudioScene(params: RenderStudioSceneParams): Promise<string> {
  let startFrameUrl: string | undefined

  // Anti-drift: build a faithful product still first (gpt-4o-image keeps the product
  // EXACT), then animate THAT — so i2v only adds motion, never re-invents the product.
  if (params.withFaithfulFrame && params.productImageUrls?.length) {
    params.onStage?.('Tạo khung hình chuẩn (gpt-4o)…')
    startFrameUrl = await generateGpt4oImageFast({
      apiKey: params.kieApiKey,
      prompt:
        `${params.conceptPromptEn} — ONE clean still frame, vertical 9:16. The product must look ` +
        `EXACTLY like the reference image (same colour, shape, label) — do NOT redesign it. No text overlays.`,
      filesUrl: params.productImageUrls.slice(0, 4),
      size: '2:3',
      softTimeoutMs: 100_000,
      attemptTimeoutMs: 150_000,
      maxAttempts: 3,
    })
  }

  params.onStage?.('Render cảnh (Seedance i2v)…')
  const { taskId } = await generateVideoJob({
    apiKey: params.kieApiKey,
    jobModelId: STUDIO_MODELS.seedance.jobModelId,
    prompt: params.conceptPromptEn,
    aspectRatio: '9:16',
    resolution: params.resolution,
    duration: params.durationSec,
    // i2v: animate the faithful frame if we made one; else seed from the product photo.
    startFrameUrl,
    referenceImageUrls: startFrameUrl ? undefined : params.productImageUrls?.slice(0, 1),
  })
  return await pollVideoJobUntilDone({ apiKey: params.kieApiKey, taskId, logTag: 'STUDIO' })
}

// ── Dev helper — test ONE scene from the console, FREE of UI (Phase 0 sanity) ──
//   __testStudioScene("hands strapping a knee brace, velcro pull, home setting", 6, '720p', '<productImageUrl>')
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__testStudioScene = async (
    conceptPromptEn: string, durationSec = 6, resolution: StudioResolution = '720p', productImageUrl?: string,
  ) => {
    const mod = await import('../../../../stores/settingsStore')
    const kieApiKey = mod.useSettingsStore.getState().kieApiKey
    if (!kieApiKey) { console.error('[STUDIO_TEST] thiếu KIE key trong Settings'); return }
    console.log('[STUDIO_TEST] render…', { conceptPromptEn, durationSec, resolution, withFrame: !!productImageUrl })
    const url = await renderStudioScene({
      kieApiKey,
      conceptPromptEn,
      productImageUrls: productImageUrl ? [productImageUrl] : undefined,
      withFaithfulFrame: !!productImageUrl,
      resolution,
      durationSec,
      onStage: (s) => console.log('[STUDIO_TEST]', s),
    })
    console.log('[STUDIO_TEST] xong:', url)
    window.open(url, '_blank')
    return url
  }
}
