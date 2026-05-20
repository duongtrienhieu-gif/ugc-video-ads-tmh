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

/** Auto-soften prompt khi KIE từ chối lần 1 vì content_policy / generate_failed.
 *  Mục tiêu: giữ visual intent nhưng giảm các từ trigger Policy (medical
 *  professional, đau đớn explicit, anatomy organ, disease/illness terms).
 *  Coverage: EN + VI + MS — 3 ngôn ngữ pack output có thể có.
 *  CHỈ apply trên attempt 2 sau khi attempt 1 hit Policy → 70-80% ảnh
 *  giữ nguyên prompt mạnh, chỉ ảnh fail-retry mới soft. */
function softenPromptForPolicy(prompt: string): string {
  let soft = prompt
  // Medical professional → generic health expert
  soft = soft.replace(/\b(doctor|physician|surgeon|nurse|medical professional)\b/gi, 'health expert')
  soft = soft.replace(/\b(bác sĩ|y tá|dược sĩ)\b/gi, 'chuyên gia sức khỏe')
  soft = soft.replace(/\b(doktor|jururawat|pakar perubatan)\b/gi, 'pakar kesihatan')
  soft = soft.replace(/\b(stethoscope|white coat|lab coat|medical scrubs|surgical mask)\b/gi, 'professional attire')
  soft = soft.replace(/\b(ống nghe|áo blouse trắng|áo bác sĩ)\b/gi, 'trang phục chuyên gia')
  soft = soft.replace(/\b(stetoskop|kot makmal|jubah doktor)\b/gi, 'pakaian profesional')
  // Pain / suffering → discomfort / concern
  soft = soft.replace(/\b(in (severe |intense |excruciating )?pain|writhing|clutching .* in pain|grimacing in pain|suffering)\b/gi, 'looking concerned')
  soft = soft.replace(/\b(đau quằn quại|nhăn nhó vì đau|ôm bụng đau|đau đớn|đau dữ dội)\b/gi, 'nhăn mặt lo lắng')
  soft = soft.replace(/\b(menyeringai kesakitan|menggenggam perut kesakitan|kesakitan teruk)\b/gi, 'kelihatan bimbang')
  // Internal organs (anatomy explicit) → wellness focus area
  soft = soft.replace(/\b(kidney|liver|colon|intestine|bladder|gut lining|stomach lining)\b/gi, 'core wellness area')
  soft = soft.replace(/\b(thận|gan|đại tràng|ruột|bàng quang)\b/gi, 'vùng sức khỏe quan trọng')
  soft = soft.replace(/\b(buah pinggang|hati|usus besar|usus|pundi kencing)\b/gi, 'kawasan kesihatan utama')
  // Anatomical diagrams → abstract wellness
  soft = soft.replace(/\b(anatomical diagram|cross-section|organ illustration|medical infographic)\b/gi, 'lifestyle wellness illustration')
  // Disease / condition → wellness challenge
  soft = soft.replace(/\b(disease|disorder|infection|inflammation|chronic condition)\b/gi, 'wellness challenge')
  soft = soft.replace(/\b(bệnh tật|nhiễm trùng|viêm|rối loạn mãn tính)\b/gi, 'thử thách sức khỏe')
  soft = soft.replace(/\b(penyakit|jangkitan|keradangan|gangguan kronik)\b/gi, 'cabaran kesihatan')
  // Sick / ill → low energy
  soft = soft.replace(/\b(sick|ill|unhealthy|frail|gaunt)\b/gi, 'low energy')
  soft = soft.replace(/\b(bệnh hoạn|xanh xao bệnh tật|yếu ớt vì bệnh)\b/gi, 'thiếu sức sống')
  soft = soft.replace(/\b(sakit teruk|lemah longlai|kelihatan tidak sihat)\b/gi, 'kurang bertenaga')
  return soft
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

  const tryOnce = async (promptToUse: string): Promise<string> => {
    if (useImageToImage) {
      // gpt-4o-image — TRUE i2i với reference images (identity lock).
      // Timeout 90s/attempt: sweet spot khi mỗi user 1 KIE key riêng
      // (không còn nghẽn queue do dùng chung). Gen time bình thường
      // 30-90s; 90s đủ cover phần lớn case mà không giết oan task
      // genuine. Hai attempts × 90s = 180s worst case mỗi image.
      // enableFallback vẫn ON → KIE tự fallback GPT_IMAGE_1 nếu primary fail.
      const { taskId } = await submitGpt4oImage({
        apiKey,
        prompt: promptToUse,
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
        prompt: promptToUse,
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
  let lastWasPolicyFail = false
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (signal?.aborted) throw new Error('CANCELLED — user hủy')
    // Hybrid retry: attempt 2 dùng softened prompt CHỈ KHI attempt 1
    // hit Policy / generate_failed. Còn lại (timeout / transient) thì
    // retry với prompt gốc (giữ chất lượng visceral mạnh).
    const currentPrompt = (attempt === 2 && lastWasPolicyFail)
      ? softenPromptForPolicy(prompt)
      : prompt
    if (attempt === 2 && lastWasPolicyFail) {
      console.log(`[kieGptImage1] attempt 2 dùng SOFTENED prompt (attempt 1 hit KIE Policy)`)
    }
    try {
      const url = await tryOnce(currentPrompt)
      const assetRef = await downloadAndSaveAsset(url)
      return { assetRef, rawUrl: url }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const msg = lastError.message.toLowerCase()
      // Hard failures — không retry kể cả softened (user huỷ / hết credit)
      if (
        msg.includes('cancelled') ||
        msg.includes('insufficient_credits') ||
        msg.includes('huỷ')
      ) {
        throw lastError
      }
      // Track: nếu attempt này fail vì Policy → attempt 2 sẽ dùng softened.
      // content_policy + generate_failed đều là KIE từ chối render — cả 2
      // đều thử softer prompt vì có thể là Policy block ngầm.
      lastWasPolicyFail = msg.includes('content_policy') || msg.includes('generate_failed')
      const retryHint = attempt < 2
        ? (lastWasPolicyFail ? 'retrying with softened prompt' : 'retrying with same prompt')
        : 'giving up'
      console.warn(`[kieGptImage1] attempt ${attempt}/2 failed: ${lastError.message.slice(0, 120)} — ${retryHint}`)
    }
  }

  throw lastError ?? new Error('KIE gpt-image-2 thất bại sau 2 lần thử')
}
