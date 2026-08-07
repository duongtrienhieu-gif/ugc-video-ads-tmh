// generateGiftBenefits — Gemini vision đọc ẢNH các quà (1..3) + tên → mini-pitch
// BÁN HÀNG cho CẢ BỘ quà (hook WOW + công dụng + FOMO + nhấn tổng giá trị) ĐÚNG
// ngôn ngữ đích, + tên ĐÃ DỊCH của TỪNG quà (giftNamesLocalized theo thứ tự).
//
// User KHÔNG phải tự gõ. Đọc chính ảnh thật nên công dụng bám đúng quà.

import { directGeminiVision } from '../../../utils/gemini'
import { getUrl } from '../../../utils/assetStore'
import { langDisplayName } from '../labels'
import { giftSetValue, type Market, type GiftBenefits, type GiftItem } from '../types'

export interface GenerateGiftBenefitsParams {
  apiKey: string
  gifts: GiftItem[]
  lang: Market
}

/** Hash nhẹ để phát hiện benefits stale khi input đổi (mọi quà + giá trị + lang). */
export function benefitsSig(gifts: GiftItem[], lang: Market): string {
  const g = gifts.map((x) => `${x.imageRef ?? ''}~${x.name.trim().toLowerCase()}~${x.valueRM ?? ''}`).join('|')
  return `v3|${g}|${lang}`
}

async function refToBase64(assetRef: string): Promise<{ data: string; mimeType: string }> {
  const url = await getUrl(assetRef)
  if (!url) throw new Error('Không tải được ảnh quà (asset hết hạn hoặc thiếu).')
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Tải ảnh quà thất bại (HTTP ${resp.status}).`)
  const blob = await resp.blob()
  const mimeType = blob.type || 'image/jpeg'
  const dataUrl: string = await new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(new Error('Đọc ảnh quà thất bại.'))
    fr.readAsDataURL(blob)
  })
  return { data: dataUrl.split(',')[1] ?? '', mimeType }
}

const SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    wowHook: { type: 'string' },
    headline: { type: 'string' },
    giftNamesLocalized: { type: 'array', items: { type: 'string' } },
    bullets: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
    fomoLines: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 2 },
    valueLine: { type: 'string' },
  },
  required: ['wowHook', 'headline', 'giftNamesLocalized', 'bullets', 'fomoLines', 'valueLine'],
}

export async function generateGiftBenefits(params: GenerateGiftBenefitsParams): Promise<GiftBenefits> {
  const { apiKey, lang } = params
  const gifts = params.gifts.filter((g) => g.name.trim() || g.imageRef)
  if (gifts.length === 0) throw new Error('Chưa có quà nào — thêm ít nhất 1 quà (tên + ảnh).')
  const withImg = gifts.filter((g) => g.imageRef)
  if (withImg.length === 0) throw new Error('Quà chưa có ảnh — tải ảnh cho ít nhất 1 quà.')

  const imgs = await Promise.all(withImg.map((g) => refToBase64(g.imageRef!)))
  const langName = langDisplayName(lang)
  const setValue = giftSetValue(gifts)
  const valueHint = setValue > 0 ? `The gift bundle's total perceived value is RM${setValue}.` : ''
  const many = gifts.length > 1

  const systemInstruction =
    `You are a high-converting Malaysian/Vietnamese COD direct-response copywriter. ` +
    `You write SHORT, punchy, scroll-stopping microcopy for a FREE BONUS ${many ? `BUNDLE of ${gifts.length} gifts` : 'GIFT'} shown on a landing page. ` +
    `Look at the gift product image(s) + the given names, then write copy that makes the buyer go WOW, feel a great deal, and fear missing out.\n` +
    `OUTPUT LANGUAGE: ${langName} ONLY — every word natural, native ${langName} the way a real seller writes ` +
    (lang === 'ms' ? `(everyday Bahasa Malaysia, not textbook).\n` : `(everyday Vietnamese).\n`) +
    `${valueHint}\n` +
    `RULES:\n` +
    `- wowHook: <= 8 words, excited line about getting ${many ? 'all these gifts' : 'this gift'} FREE.\n` +
    `- headline: <= 6 words, names the ${many ? 'gift bundle' : 'gift'} appealingly.\n` +
    `- giftNamesLocalized: an ARRAY with EXACTLY ${gifts.length} item(s), IN ORDER, each = the given name translated FAITHFULLY into ${langName} as a clean natural product name (just the name, NO marketing words). Names given (in order): ${gifts.map((g, i) => `${i + 1}) "${g.name.trim()}"`).join('; ')}.\n` +
    `- bullets: 2-3 items, each <= 7 words, a CONCRETE use/benefit grounded in what you SEE (across the gift${many ? 's' : ''}).\n` +
    `- fomoLines: 1-2 items, each <= 6 words, scarcity/urgency (e.g. "Stok terhad", "Số lượng có hạn").\n` +
    `- valueLine: <= 9 words, emphasises the TOTAL value received for free.\n` +
    `- Be truthful to the images; do NOT invent specs. NO emojis. Do NOT invent prices other than the given value.`

  const userText =
    `Gift names (source, may be another language — render meaning in ${langName}, order preserved): ${gifts.map((g, i) => `${i + 1}) "${g.name.trim()}"`).join('; ')}.\n` +
    `The images (in order) are the gifts WITH a photo. Write the bonus-gift sales copy. Return JSON {wowHook, headline, giftNamesLocalized, bullets, fomoLines, valueLine}.`

  const raw = await directGeminiVision({
    apiKey,
    parts: [...imgs.map((im) => ({ inlineData: { mimeType: im.mimeType, data: im.data } })), { text: userText }],
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema: SCHEMA,
    thinkingBudget: 0,
    maxOutputTokens: 1024,
  })

  let parsed: { wowHook?: string; headline?: string; giftNamesLocalized?: string[]; bullets?: string[]; fomoLines?: string[]; valueLine?: string }
  try { parsed = JSON.parse(raw) } catch { throw new Error('Gemini trả về không phải JSON hợp lệ cho nội dung quà.') }

  const clean = (s: unknown) => String(s ?? '').trim()
  const headline = clean(parsed.headline) || gifts[0].name.trim()
  const bullets = (parsed.bullets ?? []).map(clean).filter(Boolean).slice(0, 3)
  const fomoLines = (parsed.fomoLines ?? []).map(clean).filter(Boolean).slice(0, 2)
  // Đảm bảo đủ tên cho MỌI quà (kể cả quà chưa có ảnh) — fallback tên thô.
  const localized = gifts.map((g, i) => clean((parsed.giftNamesLocalized ?? [])[i]) || g.name.trim())

  return {
    wowHook: clean(parsed.wowHook) || headline,
    headline,
    giftNamesLocalized: localized,
    bullets,
    fomoLines: fomoLines.length ? fomoLines : [lang === 'ms' ? 'Stok terhad' : 'Số lượng có hạn'],
    valueLine: clean(parsed.valueLine),
    lang,
    sig: benefitsSig(gifts, lang),
  }
}
