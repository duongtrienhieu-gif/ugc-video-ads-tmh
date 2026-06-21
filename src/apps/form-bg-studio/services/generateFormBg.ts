// generateFormBg — render 1 biến thể ảnh nền form qua gpt-4o-image (i2i).
// Hero ref = ảnh SP AI đã chọn (heroImageIndex) đứng đầu; + vài ảnh SP khác;
// + ảnh quà (preset abundance). size 2:3 (dọc tối đa của gpt-4o-image).

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
  const hasGift = preset === 'abundance' && !!giftImageRef

  // Ưu tiên ảnh hero AI chọn lên đầu danh sách ref.
  const allImgs = (product.productImages ?? []).filter((s) => !!s && s.trim() !== '')
  const heroIdx = Math.max(0, Math.min(allImgs.length - 1, direction.heroImageIndex))
  const ordered = heroIdx >= 0 && allImgs.length > 0
    ? [allImgs[heroIdx], ...allImgs.filter((_, i) => i !== heroIdx)]
    : allImgs

  const productUrls = await resolveUrls(ordered, hasGift ? 4 : 5)
  if (productUrls.length === 0) throw new Error('Sản phẩm chưa có ảnh tham chiếu hợp lệ.')
  const giftUrls = hasGift ? await resolveUrls([giftImageRef as string], 1) : []
  const refUrls = [...productUrls, ...giftUrls].slice(0, 5)

  const prompt = buildFormBgPrompt({
    preset,
    direction,
    hasGift,
    lang: params.lang,
    variantIndex: params.variantIndex,
  })

  if (typeof console !== 'undefined') {
    console.log(`[form-bg] preset=${preset} variant=${params.variantIndex} lang=${params.lang} promptLen=${prompt.length} refs=${refUrls.length}`)
  }

  const kieImageUrl = await generateGpt4oImage({
    apiKey: params.apiKey,
    prompt,
    filesUrl: refUrls,
    size: '2:3',
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

export function friendlyFormBgError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('INSUFFICIENT_CREDITS')) return 'Hết credit kie.ai — nạp thêm để tiếp tục.'
  if (msg.toLowerCase().includes('policy')) return 'kie.ai từ chối prompt vì policy. Thử ảnh khác.'
  if (msg.includes('TIMEOUT')) return 'kie.ai quá lâu chưa xong — thử lại.'
  if (msg.includes('CANCELLED')) return 'Đã huỷ.'
  return msg
}
