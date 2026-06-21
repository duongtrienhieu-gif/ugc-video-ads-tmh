// generateFormBg — render 1 ẢNH NỀN form đầy đủ (header+FOMO+form trống+footer)
// qua gpt-4o-image (i2i), size 2:3. Ref = ảnh SP (hero AI chọn lên đầu, ÍT ref
// để bớt drift) + ảnh quà (nếu có, MỌI preset). Có RETRY lỗi mạng transient.

import { generateGpt4oImage, type ImageStatus } from '../../../utils/kieai'
import { getUrl, saveAsset } from '../../../utils/assetStore'
import type { Product } from '../../../stores/types'
import type { Market, FormBgPreset, ProductDirection } from '../types'
import { buildFormBgPrompt } from './formBgPromptBuilder'

export interface GenerateFormBgParams {
  apiKey: string
  variantIndex: number
  product: Product
  direction: ProductDirection
  preset: FormBgPreset
  lang: Market
  giftImageRef: string | null
  onStatus?: (status: ImageStatus) => void
  signal?: AbortSignal
}

const TIMEOUT_MS = 5 * 60 * 1000

function isHardError(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err)
  return m.includes('INSUFFICIENT_CREDITS') || m.toLowerCase().includes('policy') || m.includes('CANCELLED')
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (isHardError(err)) throw err
    }
  }
  throw lastErr
}

async function resolveUrls(refs: string[], max: number): Promise<string[]> {
  const urls: string[] = []
  for (const ref of refs.slice(0, max)) {
    try {
      const url = await getUrl(ref)
      if (url) urls.push(url)
    } catch { /* skip */ }
  }
  return urls
}

export async function generateFormBg(params: GenerateFormBgParams): Promise<{ assetRef: string; prompt: string }> {
  const { product, direction, preset, giftImageRef } = params
  const hasGift = !!giftImageRef

  const allImgs = (product.productImages ?? []).filter((s) => !!s && s.trim() !== '')
  const heroIdx = Math.max(0, Math.min(allImgs.length - 1, direction.heroImageIndex))
  const ordered = allImgs.length > 0 ? [allImgs[heroIdx], ...allImgs.filter((_, i) => i !== heroIdx)] : allImgs
  // Ít ref + sạch = bớt drift. Có quà chỉ lấy 2 ảnh SP để khỏi lẫn 2 sản phẩm.
  const productUrls = await resolveUrls(ordered, hasGift ? 2 : 3)
  if (productUrls.length === 0) throw new Error('Sản phẩm chưa có ảnh tham chiếu hợp lệ.')
  const giftUrls = hasGift ? await resolveUrls([giftImageRef as string], 1) : []
  const refUrls = [...productUrls, ...giftUrls].slice(0, 4)

  const prompt = buildFormBgPrompt({ preset, direction, hasGift, lang: params.lang, variantIndex: params.variantIndex })

  if (typeof console !== 'undefined') {
    console.log(`[form-bg] ${preset} v${params.variantIndex} lang=${params.lang} promptLen=${prompt.length} refs=${refUrls.length}`)
  }

  const kieImageUrl = await withRetry(() => generateGpt4oImage({
    apiKey: params.apiKey,
    prompt,
    filesUrl: refUrls,
    size: '2:3',
    onStatusChange: params.onStatus,
    timeoutMs: TIMEOUT_MS,
    signal: params.signal,
  }))

  const blob = await withRetry(async () => {
    const resp = await fetch(kieImageUrl)
    if (!resp.ok) throw new Error(`Tải ảnh AI thất bại (HTTP ${resp.status}).`)
    return resp.blob()
  })

  const assetRef = await saveAsset(blob, 'image/jpeg')
  return { assetRef, prompt }
}

export function friendlyFormBgError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('INSUFFICIENT_CREDITS')) return 'Hết credit kie.ai — nạp thêm để tiếp tục.'
  if (msg.toLowerCase().includes('policy')) return 'kie.ai từ chối prompt vì policy. Thử ảnh khác.'
  if (msg.includes('TIMEOUT')) return 'kie.ai quá lâu chưa xong — thử lại.'
  if (msg.includes('CANCELLED')) return 'Đã huỷ.'
  if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network')) return 'Lỗi mạng — đã thử lại nhưng chưa được. Bấm tạo lại.'
  return msg
}
