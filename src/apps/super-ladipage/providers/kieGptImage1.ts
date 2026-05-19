import { submitGpt4oImage, pollGpt4oUntilDone } from '../../../utils/kieai'
import { getUrl } from '../../../utils/assetStore'
import { saveAsset } from '../../../utils/assetStore'
import { mapAspectToKie } from '../assembler/assembleImagePrompt'

// ─────────────────────────────────────────────────────────────────────
// Super Ladipage — KIE gpt-image-1 provider (true i2i via /gpt4o-image/generate).
//
// CRITICAL: KIE comment cảnh báo rõ trong utils/kieai.ts:
//   /jobs/createTask + gpt-image-2-text-to-image is TEXT-ONLY — silently
//   ignores image_urls. For TRUE image editing with reference images,
//   MUST use /gpt4o-image/generate with filesUrl.
//
// Phase 3 bug: dùng nhầm submitGptImage2 → reference image bị KIE bỏ qua
// âm thầm → product packaging drift hoàn toàn (AI vẽ scratch theo text).
// Fix: switch sang submitGpt4oImage + pollGpt4oUntilDone (true i2i).
// ─────────────────────────────────────────────────────────────────────

export interface KieImageGenInput {
  apiKey:        string
  prompt:        string
  aspectRatio:   '1:1' | '4:5' | '16:9' | '9:16'
  /** Asset refs làm reference image (max 5, KIE limit). */
  referenceAssetRefs?: string[]
  signal?:       AbortSignal
}

export interface KieImageGenResult {
  /** Asset ref đã save vào Supabase Storage (asset-{uuid}). */
  assetRef:    string
  /** URL trực tiếp KIE trả về (chưa save, để debug). */
  rawUrl:      string
}

/** Resolve asset refs → public signed URLs cho KIE filesUrl. */
async function resolveRefsToUrls(refs: string[]): Promise<string[]> {
  const urls: string[] = []
  for (const ref of refs) {
    const url = await getUrl(ref)
    if (url) urls.push(url)
  }
  return urls
}

/** Tải ảnh từ URL → Blob → saveAsset() → trả assetRef. */
async function downloadAndSaveAsset(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Download image from KIE failed: HTTP ${res.status}`)
  }
  const blob = await res.blob()
  const mimeType = blob.type || 'image/png'
  return saveAsset(blob, mimeType)
}

/** Sinh 1 ảnh qua KIE gpt-image-2 (1K, 6 credit).
 *  Tự retry 1 lần nếu fail vì timeout / transient error.
 *  Hard fail (insufficient credits / content policy) → throw ngay. */
export async function generateImageGptImage1(input: KieImageGenInput): Promise<KieImageGenResult> {
  const { apiKey, prompt, aspectRatio, referenceAssetRefs, signal } = input

  if (!apiKey) throw new Error('Thiếu KIE API key — vào Cài đặt nhập key kie.ai')

  const kieAspect = mapAspectToKie(aspectRatio)
  const filesUrl = referenceAssetRefs && referenceAssetRefs.length > 0
    ? await resolveRefsToUrls(referenceAssetRefs.slice(0, 5))
    : undefined

  const tryOnce = async (): Promise<string> => {
    const { taskId } = await submitGpt4oImage({
      apiKey,
      prompt,
      size:       kieAspect,
      filesUrl,
      enableFallback: true,  // KIE auto-fallback GPT_IMAGE_1 nếu primary lỗi
    })
    return pollGpt4oUntilDone({
      apiKey,
      taskId,
      timeoutMs: 4 * 60 * 1000, // 4 phút
      signal,
    })
  }

  let lastError: Error | null = null
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (signal?.aborted) throw new Error('CANCELLED — user hủy')
    try {
      const url = await tryOnce()
      const assetRef = await downloadAndSaveAsset(url)
      return { assetRef, rawUrl: url }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const msg = lastError.message.toLowerCase()
      // Hard failures — không retry
      if (
        msg.includes('cancelled') ||
        msg.includes('insufficient_credits') ||
        msg.includes('content_policy') ||
        msg.includes('huỷ')
      ) {
        throw lastError
      }
      console.warn(`[kieGptImage1] attempt ${attempt}/2 failed: ${lastError.message.slice(0, 120)} — ${attempt < 2 ? 'retrying' : 'giving up'}`)
    }
  }

  throw lastError ?? new Error('KIE gpt-image-2 thất bại sau 2 lần thử')
}
