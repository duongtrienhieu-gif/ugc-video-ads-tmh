// generateComboBenefits — Gemini vision đọc ẢNH SẢN PHẨM CHÍNH → copy bán hàng
// cho poster COMBO GIÁ (không quà): hook mua-nhiều-rẻ + FOMO + nhấn giá trị deal.
// Khác generateGiftBenefits: xoay quanh SẢN PHẨM + DEAL, KHÔNG có quà.
// Trả về GiftBenefits (giftNameLocalized để rỗng — combo giá không dùng).

import { directGeminiVision } from '../../../utils/gemini'
import { getUrl } from '../../../utils/assetStore'
import { langDisplayName } from '../labels'
import type { Product } from '../../../stores/types'
import type { Market, GiftBenefits } from '../types'

export interface GenerateComboBenefitsParams {
  apiKey: string
  product: Product
  lang: Market
  hasFreeship: boolean
}

/** Hash phát hiện stale khi input đổi. */
export function comboBenefitsSig(productId: string, lang: Market, hasFreeship: boolean): string {
  return `combo-v1|${productId}|${lang}|${hasFreeship ? 'fs' : 'nofs'}`
}

async function refToBase64(assetRef: string): Promise<{ data: string; mimeType: string }> {
  const url = await getUrl(assetRef)
  if (!url) throw new Error('Không tải được ảnh sản phẩm (asset hết hạn hoặc thiếu).')
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Tải ảnh sản phẩm thất bại (HTTP ${resp.status}).`)
  const blob = await resp.blob()
  const mimeType = blob.type || 'image/jpeg'
  const dataUrl: string = await new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(new Error('Đọc ảnh sản phẩm thất bại.'))
    fr.readAsDataURL(blob)
  })
  return { data: dataUrl.split(',')[1] ?? '', mimeType }
}

const SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    wowHook: { type: 'string' },
    headline: { type: 'string' },
    bullets: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
    fomoLines: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 2 },
    valueLine: { type: 'string' },
  },
  required: ['wowHook', 'headline', 'bullets', 'fomoLines', 'valueLine'],
}

export async function generateComboBenefits(params: GenerateComboBenefitsParams): Promise<GiftBenefits> {
  const { apiKey, product, lang, hasFreeship } = params
  const productRefs = (product.productImages ?? []).filter((s) => !!s && s.trim() !== '')
  if (productRefs.length === 0) throw new Error('Sản phẩm chưa có ảnh — cần ít nhất 1 ảnh để sinh nội dung.')
  const img = await refToBase64(productRefs[0])
  const langName = langDisplayName(lang)
  const shipHint = hasFreeship ? `Some tiers include FREE shipping — you may leverage "free shipping" as a hook/FOMO.` : ''

  const systemInstruction =
    `You are a high-converting Malaysian/Vietnamese COD direct-response copywriter. ` +
    `You write SHORT, punchy microcopy for a MULTI-BUY COMBO PRICING poster (buy more = cheaper per unit). ` +
    `Look at the product in the image + its name, then write copy that pushes the shopper to buy the BIGGER bundle (better price/unit), and fear missing the deal.\n` +
    `OUTPUT LANGUAGE: ${langName} ONLY — every word natural, native ${langName} the way a real seller writes ` +
    (lang === 'ms' ? `(everyday Bahasa Malaysia, not textbook).\n` : `(everyday Vietnamese).\n`) +
    `${shipHint}\n` +
    `RULES:\n` +
    `- wowHook: <= 8 words, excited line about the combo deal / buy-more-save-more.\n` +
    `- headline: <= 6 words, names the product appealingly.\n` +
    `- bullets: 2-3 items, each <= 7 words, CONCRETE benefit/use grounded in what you SEE.\n` +
    `- fomoLines: 1-2 items, each <= 6 words, scarcity/urgency (e.g. "Stok terhad", "Hanya hari ini", "Số lượng có hạn").\n` +
    `- valueLine: <= 9 words, emphasises SAVINGS from buying the combo.\n` +
    `- Be truthful to the image; do NOT invent specs. NO emojis. Do NOT invent prices.`

  const userText =
    `Product name (source, may be another language — render meaning in ${langName}): "${product.productName.trim()}".\n` +
    `Write the combo-deal sales copy. Return JSON {wowHook, headline, bullets, fomoLines, valueLine}.`

  const raw = await directGeminiVision({
    apiKey,
    parts: [{ inlineData: { mimeType: img.mimeType, data: img.data } }, { text: userText }],
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema: SCHEMA,
    thinkingBudget: 0,
    maxOutputTokens: 1024,
  })

  let parsed: { wowHook?: string; headline?: string; bullets?: string[]; fomoLines?: string[]; valueLine?: string }
  try { parsed = JSON.parse(raw) } catch { throw new Error('Gemini trả về không phải JSON hợp lệ cho nội dung combo.') }

  const clean = (s: unknown) => String(s ?? '').trim()
  const headline = clean(parsed.headline) || product.productName.trim()
  const bullets = (parsed.bullets ?? []).map(clean).filter(Boolean).slice(0, 3)
  const fomoLines = (parsed.fomoLines ?? []).map(clean).filter(Boolean).slice(0, 2)

  return {
    wowHook: clean(parsed.wowHook) || headline,
    headline,
    giftNameLocalized: '', // combo giá không có quà
    bullets,
    fomoLines: fomoLines.length ? fomoLines : [lang === 'ms' ? 'Stok terhad' : 'Số lượng có hạn'],
    valueLine: clean(parsed.valueLine),
    lang,
    sig: comboBenefitsSig(product.id, lang, hasFreeship),
  }
}
