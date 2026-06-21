// generateFormBg — render 1 DẢI (header/footer) qua gpt-4o-image (i2i), 3:2.
// Header: dùng ref ảnh SP (hero AI chọn lên đầu) + ảnh quà (nếu có, MỌI preset).
// Footer: chủ yếu chữ, không cần ref. Có RETRY cho lỗi mạng transient.

import { generateGpt4oImage, type ImageStatus } from '../../../utils/kieai'
import { getUrl, saveAsset } from '../../../utils/assetStore'
import type { Product } from '../../../stores/types'
import type { Market, FormBgPreset, ProductDirection, StripKind } from '../types'
import { buildFormBgPrompt } from './formBgPromptBuilder'

export interface GenerateStripParams {
  apiKey: string
  kind: StripKind
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

/** Lỗi cứng — KHÔNG retry (retry chỉ tốn credit vô ích). */
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
      // transient (Failed to fetch / network / timeout) → thử lại
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

export async function generateStrip(params: GenerateStripParams): Promise<{ assetRef: string; prompt: string }> {
  const { kind, product, direction, preset, giftImageRef } = params
  const hasGift = !!giftImageRef

  let refUrls: string[] = []
  if (kind === 'header') {
    const allImgs = (product.productImages ?? []).filter((s) => !!s && s.trim() !== '')
    const heroIdx = Math.max(0, Math.min(allImgs.length - 1, direction.heroImageIndex))
    const ordered = allImgs.length > 0 ? [allImgs[heroIdx], ...allImgs.filter((_, i) => i !== heroIdx)] : allImgs
    // Ít ref hơn + sạch hơn = ÍT DRIFT. Khi có quà chỉ lấy 2 ảnh SP (hero + 1)
    // để chừa chỗ cho quà mà không làm model lẫn 2 sản phẩm.
    const productUrls = await resolveUrls(ordered, hasGift ? 2 : 3)
    if (productUrls.length === 0) throw new Error('Sản phẩm chưa có ảnh tham chiếu hợp lệ.')
    const giftUrls = hasGift ? await resolveUrls([giftImageRef as string], 1) : []
    refUrls = [...productUrls, ...giftUrls].slice(0, 4)
  }

  const prompt = buildFormBgPrompt({ kind, preset, direction, hasGift, lang: params.lang, variantIndex: params.variantIndex })

  if (typeof console !== 'undefined') {
    console.log(`[form-bg] ${preset} v${params.variantIndex} ${kind} lang=${params.lang} promptLen=${prompt.length} refs=${refUrls.length}`)
  }

  // Submit + poll (retry transient — re-submit nếu lỗi mạng trước khi có task).
  const kieImageUrl = await withRetry(() => generateGpt4oImage({
    apiKey: params.apiKey,
    prompt,
    filesUrl: refUrls.length ? refUrls : undefined,
    size: '3:2',
    onStatusChange: params.onStatus,
    timeoutMs: TIMEOUT_MS,
    signal: params.signal,
  }))

  // Tải ảnh về (retry riêng — rẻ, không tốn credit).
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
