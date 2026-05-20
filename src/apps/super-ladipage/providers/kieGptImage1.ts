import { submitGpt4oImage, pollGpt4oUntilDone, submitGptImage2, pollGptImage2UntilDone } from '../../../utils/kieai'
import { getUrl } from '../../../utils/assetStore'
import { saveAsset } from '../../../utils/assetStore'
import { mapAspectToKie } from '../assembler/assembleImagePrompt'

// ─────────────────────────────────────────────────────────────────────
// Super Ladipage — KIE image provider with HYBRID routing.
//
// 2 endpoints:
//   • /gpt4o-image/generate (gpt-4o-image) — TRUE i2i với filesUrl,
//     identity lock, dùng cho section có sản phẩm.
//   • /jobs/createTask gpt-image-2-text-to-image — text-only, sharper
//     polish + photorealism, dùng cho section KHÔNG có sản phẩm.
//
// Routing decision = code-driven via useImageToImage flag (derived from
// spec.productPolicy ở orchestrator). AI KHÔNG quyết định routing →
// tránh hoàn toàn nguy cơ route nhầm section có sản phẩm sang text-only.
//
// CRITICAL warning từ utils/kieai.ts: /jobs/createTask silently ignores
// image_urls. Nếu route nhầm section có sp → identity drift quay lại.
// Fail-safe: useImageToImage default true (gpt-4o-image).
// ─────────────────────────────────────────────────────────────────────

export interface KieImageGenInput {
  apiKey:        string
  prompt:        string
  aspectRatio:   '1:1' | '4:5' | '16:9' | '9:16'
  /** Asset refs làm reference image (max 5, KIE limit). Chỉ dùng khi
   *  useImageToImage=true. */
  referenceAssetRefs?: string[]
  /** P5 hybrid routing. true (default) = gpt-4o-image i2i với refs.
   *  false = gpt-image-2 text-only (cho sections không có sản phẩm). */
  useImageToImage?: boolean
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
  // Default true = fail-safe (giữ identity lock cho mọi trường hợp ambiguous)
  const useImageToImage = input.useImageToImage ?? true

  if (!apiKey) throw new Error('Thiếu KIE API key — vào Cài đặt nhập key kie.ai')

  const kieAspect = mapAspectToKie(aspectRatio)
  const filesUrl = referenceAssetRefs && referenceAssetRefs.length > 0
    ? await resolveRefsToUrls(referenceAssetRefs.slice(0, 5))
    : undefined

  const modelTag = useImageToImage ? 'gpt-4o-image (i2i)' : 'gpt-image-2 (text-only)'
  console.log(`[kieImage] using ${modelTag} for prompt (${prompt.length} chars, ${filesUrl?.length ?? 0} refs)`)

  const tryOnce = async (): Promise<string> => {
    if (useImageToImage) {
      // gpt-4o-image — TRUE i2i với reference images (identity lock).
      // Timeout 90s/attempt: nếu KIE stuck queue > 90s → abandon task,
      // outer retry loop sẽ submit FRESH task. Hai attempts × 90s = 180s
      // worst case mỗi image (vs cũ 4min × 2 = 8min). enableFallback
      // vẫn ON → KIE tự fallback GPT_IMAGE_1 nếu primary fail.
      const { taskId } = await submitGpt4oImage({
        apiKey,
        prompt,
        size:       kieAspect,
        filesUrl,
        enableFallback: true,
      })
      return pollGpt4oUntilDone({
        apiKey,
        taskId,
        timeoutMs: 90 * 1000,
        signal,
      })
    } else {
      // gpt-image-2 — text-only, sharper polish (sections không sản phẩm)
      // filesUrl SILENTLY IGNORED bởi endpoint này (KIE comment cảnh báo).
      // Không truyền refs để tránh nhầm lẫn.
      // Timeout 90s/attempt giống gpt-4o-image cho consistent UX.
      const { taskId } = await submitGptImage2({
        apiKey,
        prompt,
        size:       kieAspect,
        resolution: '1K',
      })
      return pollGptImage2UntilDone({
        apiKey,
        taskId,
        timeoutMs: 90 * 1000,
        signal,
      })
    }
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
