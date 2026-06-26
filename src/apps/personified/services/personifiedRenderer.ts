// ── Mode 3 — Personified RENDER core (P2a) ───────────────────────────────────
// 1 cảnh → KEYFRAME (gpt-4o-image, nhân vật 3D) → i2v Seedance 1.5 Pro 480p (no-audio)
// → clip CÂM. Tái dùng KIE utils chung (kieai.ts), Mode 3 standalone — KHÔNG phụ thuộc
// logic preset của v3. Lipsync (P2c) + ghép/upscale (P2d) là bước sau.
// ─────────────────────────────────────────────────────────────────────────────

import {
  generateGpt4oImageFast, generateVideoJob, pollVideoJobUntilDone, type Resolution,
} from '../../../utils/kieai'
import { saveAsset, getUrl, isAssetRef } from '../../../utils/assetStore'
import type { PersonifiedScene, PersonifiedCharacter } from '../types'
import type { RenderTier } from '../constants'

function tierToModel(tier: RenderTier): string {
  return tier === 'grok480' ? 'grok-imagine/image-to-video' : 'bytedance/seedance-1.5-pro'
}
function tierToRes(tier: RenderTier): Resolution {
  return tier === 'seedance720' ? '720p' : '480p'
}

/** Prompt KEYFRAME 1 cảnh: nhân vật 3D (imagePromptEn) + biểu cảm + (nếu hasProduct) KHÓA sản phẩm
 *  thật từ ảnh ref (copy bao bì, cấm bịa) — đúng luật "preserve product" của repo. */
function buildKeyframePrompt(
  scene: PersonifiedScene, character: PersonifiedCharacter | undefined, hasProductRef: boolean,
): string {
  const base = (character?.imagePromptEn ?? '').trim() || (scene.action ?? '').trim() || 'A 3D Pixar cartoon character'
  const mood = scene.emotion ? ` Expression / mood: ${scene.emotion}.` : ''
  const product = hasProductRef
    ? ' The REAL PRODUCT appears in frame EXACTLY as reference image #1 — same packaging, label, colour, shape and on-pack text; do NOT invent, alter, or re-spell any packaging or text, copy it from the reference.'
    : ''
  return `${base}${mood}${product} 3D Pixar cartoon style, cinematic lighting, vertical 9:16 framing. NO on-screen text, NO captions, NO watermark, NO subtitles.`
}

export interface RenderSceneParams {
  apiKey: string
  scene: PersonifiedScene
  /** Nhân vật nói/chủ thể của cảnh (cho imagePromptEn). */
  character?: PersonifiedCharacter
  /** Ảnh sản phẩm thật (asset ref hoặc URL) — chỉ dùng khi scene.hasProduct. */
  productRefs?: string[]
  tier: RenderTier
  signal?: AbortSignal
  onStage?: (stage: 'keyframe' | 'i2v' | 'done', info?: { keyframeRef?: string; taskId?: string; clipRef?: string }) => void
}

export interface RenderSceneResult { keyframeRef: string; clipRef: string; taskId: string }

/** Render 1 cảnh end-to-end → { keyframeRef, clipRef }. Throw nếu lỗi (caller surface). */
export async function renderPersonifiedScene(p: RenderSceneParams): Promise<RenderSceneResult> {
  if (!p.apiKey) throw new Error('Thiếu KIE API key (Cài đặt)')
  if (p.signal?.aborted) throw new Error('CANCELLED — user hủy')

  // ── 1. KEYFRAME ──────────────────────────────────────────────────────────
  const useProduct = !!(p.scene.hasProduct && p.productRefs && p.productRefs.length > 0)
  const filesUrl: string[] = []
  if (useProduct) {
    for (const ref of p.productRefs!.slice(0, 4)) {
      const url = isAssetRef(ref) ? await getUrl(ref) : ref
      if (url) filesUrl.push(url)
    }
  }
  const kfPrompt = buildKeyframePrompt(p.scene, p.character, filesUrl.length > 0)
  const remoteUrl = await generateGpt4oImageFast({
    apiKey: p.apiKey, prompt: kfPrompt, filesUrl, size: '2:3',
    softTimeoutMs: 100_000, attemptTimeoutMs: 150_000, maxAttempts: 3, signal: p.signal,
  })
  const kfBlob = await fetch(remoteUrl).then((r) => r.blob())
  const keyframeRef = await saveAsset(kfBlob, kfBlob.type || 'image/png')
  p.onStage?.('keyframe', { keyframeRef })
  if (p.signal?.aborted) throw new Error('CANCELLED — user hủy')

  // ── 2. i2v (Seedance 1.5 Pro 480p, no-audio = tier rẻ) ───────────────────
  const kfPublic = await getUrl(keyframeRef)
  if (!kfPublic) throw new Error('Không lấy được URL keyframe')
  const sub = await generateVideoJob({
    apiKey: p.apiKey,
    jobModelId: tierToModel(p.tier),
    prompt: (p.scene.videoPromptEn ?? '').trim() || (p.scene.action ?? '').trim() || 'subtle natural motion',
    aspectRatio: '9:16',
    resolution: tierToRes(p.tier),
    duration: p.scene.clipDuration,
    startFrameUrl: kfPublic,
  })
  p.onStage?.('i2v', { keyframeRef, taskId: sub.taskId })

  const clipUrl = await pollVideoJobUntilDone({
    apiKey: p.apiKey, taskId: sub.taskId, timeoutMs: 10 * 60 * 1000,
    logTag: `personified/${p.scene.sceneType}#${p.scene.idx}`,
  })
  const clipBlob = await fetch(clipUrl).then((r) => r.blob())
  const clipRef = await saveAsset(clipBlob, 'video/mp4')
  p.onStage?.('done', { keyframeRef, clipRef, taskId: sub.taskId })
  return { keyframeRef, clipRef, taskId: sub.taskId }
}

// ── Dev helper — test render 1 cảnh từ kịch bản đang lưu (console, P2a) ───────
//   __testRenderScene(1)   → render cảnh #1 của kịch bản personified hiện tại
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__testRenderScene = async (sceneIdx = 1) => {
    const { useSettingsStore } = await import('../../../stores/settingsStore')
    const apiKey = useSettingsStore.getState().kieApiKey
    if (!apiKey) { console.error('[RENDER_TEST] thiếu KIE key trong Cài đặt'); return }
    const cache = JSON.parse(localStorage.getItem('personified-state-v1') ?? '{}')
    const script = cache.script
    if (!script?.scenes?.length) { console.error('[RENDER_TEST] chưa có kịch bản — tạo trước'); return }
    const scene = script.scenes[sceneIdx - 1]
    if (!scene) { console.error(`[RENDER_TEST] không có cảnh #${sceneIdx}`); return }
    const character = (script.characters ?? []).find(
      (c: PersonifiedCharacter) => c.name === scene.speaker || c.role === scene.speaker,
    ) ?? script.characters?.[0]
    console.log(`[RENDER_TEST] render cảnh #${sceneIdx} (${scene.sceneType}) tier=${cache.tier ?? 'seedance480'}…`)
    try {
      const res = await renderPersonifiedScene({
        apiKey, scene, character, tier: cache.tier ?? 'seedance480',
        onStage: (s, info) => console.log('[RENDER_TEST]', s, info),
      })
      const url = await getUrl(res.clipRef)
      console.log('[RENDER_TEST] DONE → clip:', url)
      if (url) window.open(url, '_blank')
      return res
    } catch (e) {
      console.error('[RENDER_TEST] lỗi:', e)
    }
  }
}
