// generateGiftImage — sinh 1 ảnh quà (banner | combo | info) end-to-end.
//
// Mô phỏng tiktok-shop/generateSlot.ts: gpt-4o-image (i2i thật, refs được
// HONOR qua filesUrl) → tải ảnh → saveAsset. Chữ do prompt nướng sẵn.
//
// Thứ tự refs theo kind:
//   • banner / combo → ảnh SẢN PHẨM trước, ảnh QUÀ sau (SP là hero).
//   • info           → ảnh QUÀ trước, ảnh SP sau (quà là hero).
// gpt-4o-image nhận tối đa 5 refs.

import { generateGpt4oImage, type ImageStatus, type Gpt4oSize } from '../../../utils/kieai'
import { getUrl, saveAsset } from '../../../utils/assetStore'
import type { Product } from '../../../stores/types'
import type { Market, GiftBenefits, GiftImageKind } from '../types'
import { buildGiftPrompt } from './giftPromptBuilder'

export interface GenerateGiftImageParams {
  apiKey: string
  kind: GiftImageKind
  product: Product
  giftName: string
  giftValueRM: number | null
  giftImageRef: string
  benefits: GiftBenefits
  lang: Market
  onStatus?: (status: ImageStatus) => void
  signal?: AbortSignal
}

export interface GenerateGiftImageResult {
  assetRef: string
  prompt: string
}

const TIMEOUT_MS = 5 * 60 * 1000

const SIZE_BY_KIND: Record<GiftImageKind, Gpt4oSize> = {
  banner: '3:2',
  combo: '1:1',
  info: '2:3',
}

async function resolveUrls(assetRefs: string[], max: number): Promise<string[]> {
  const urls: string[] = []
  for (const ref of assetRefs.slice(0, max)) {
    try {
      const url = await getUrl(ref)
      if (url) urls.push(url)
    } catch { /* skip — prompt still works with fewer refs */ }
  }
  return urls
}

export async function generateGiftImage(
  params: GenerateGiftImageParams,
): Promise<GenerateGiftImageResult> {
  const { kind, product, giftImageRef } = params

  // Refs sản phẩm: dùng productImages (asset refs), cắt còn 4 để chừa chỗ cho quà.
  const productRefs = (product.productImages ?? []).filter((s) => !!s && s.trim() !== '')
  const productUrls = await resolveUrls(productRefs, 4)
  const giftUrls = await resolveUrls([giftImageRef], 1)

  if (productUrls.length === 0) {
    throw new Error('Sản phẩm chưa có ảnh tham chiếu hợp lệ — hãy chọn sản phẩm có ảnh.')
  }
  if (giftUrls.length === 0) {
    throw new Error('Không tải được ảnh quà — hãy tải lại ảnh quà.')
  }

  // Thứ tự ref theo kind (hero đứng trước), tổng tối đa 5.
  const ordered = kind === 'info'
    ? [...giftUrls, ...productUrls]
    : [...productUrls, ...giftUrls]
  const refUrls = ordered.slice(0, 5)

  const prompt = buildGiftPrompt({
    kind,
    product: params.product,
    giftName: params.giftName,
    giftValueRM: params.giftValueRM,
    benefits: params.benefits,
    lang: params.lang,
    hasGiftRef: giftUrls.length > 0,
  })

  if (typeof console !== 'undefined') {
    console.log(`[gift-studio] kind=${kind} lang=${params.lang} promptLen=${prompt.length} refs=${refUrls.length}`)
  }

  const kieImageUrl = await generateGpt4oImage({
    apiKey: params.apiKey,
    prompt,
    filesUrl: refUrls,
    size: SIZE_BY_KIND[kind],
    onStatusChange: params.onStatus,
    timeoutMs: TIMEOUT_MS,
    signal: params.signal,
  })

  const resp = await fetch(kieImageUrl)
  if (!resp.ok) throw new Error(`Tải ảnh AI thất bại (HTTP ${resp.status}).`)
  const blob = await resp.blob()
  const assetRef = await saveAsset(blob, 'image/jpeg')

  return { assetRef, prompt }
}

// Phân loại lỗi thân thiện (mirror tiktok-shop classifier).
export function friendlyGiftError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('INSUFFICIENT_CREDITS')) return 'Hết credit kie.ai — nạp thêm để tiếp tục.'
  if (msg.toLowerCase().includes('policy')) return 'kie.ai từ chối prompt vì policy. Thử ảnh khác.'
  if (msg.includes('TIMEOUT')) return 'kie.ai quá lâu chưa xong — thử lại.'
  if (msg.includes('CANCELLED')) return 'Đã huỷ.'
  return msg
}
