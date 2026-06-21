// generateGiftBenefits — Gemini vision đọc ẢNH quà + tên quà → mini-pitch
// BÁN HÀNG đầy đủ (hook WOW + công dụng + FOMO + nhấn giá trị) ĐÚNG ngôn
// ngữ đích.
//
// Đây là nguồn "quà là gì / tác dụng / vì sao phải lấy ngay": user KHÔNG
// phải tự gõ (đúng nguyên tắc tối thiểu input). Vì đọc chính ảnh thật nên
// công dụng bám đúng món quà, không bịa. Kết quả nướng vào cả 3 ảnh.

import { directGeminiVision } from '../../../utils/gemini'
import { getUrl } from '../../../utils/assetStore'
import { langDisplayName } from '../labels'
import type { Market, GiftBenefits } from '../types'

export interface GenerateGiftBenefitsParams {
  apiKey: string
  giftImageRef: string
  giftName: string
  giftValueRM: number | null
  lang: Market
}

/** Hash nhẹ để phát hiện benefits stale khi input đổi. */
export function benefitsSig(giftImageRef: string, giftName: string, giftValueRM: number | null, lang: Market): string {
  return `${giftImageRef}|${giftName.trim().toLowerCase()}|${giftValueRM ?? ''}|${lang}`
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
  const base64 = dataUrl.split(',')[1] ?? ''
  return { data: base64, mimeType }
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

export async function generateGiftBenefits(
  params: GenerateGiftBenefitsParams,
): Promise<GiftBenefits> {
  const { apiKey, giftImageRef, giftName, giftValueRM, lang } = params
  const img = await refToBase64(giftImageRef)
  const langName = langDisplayName(lang)
  const valueHint = giftValueRM != null ? `The gift's perceived value is RM${giftValueRM}.` : ''

  const systemInstruction =
    `You are a high-converting Malaysian/Vietnamese COD direct-response copywriter. ` +
    `You write SHORT, punchy, scroll-stopping microcopy for a FREE BONUS GIFT shown on a landing page. ` +
    `Look at the gift product in the image + the given gift name, then write copy that makes the buyer go WOW, ` +
    `feel they are getting a great deal, and fear missing out.\n` +
    `OUTPUT LANGUAGE: ${langName} ONLY — every word natural, native ${langName}, the way a real seller writes ` +
    (lang === 'ms' ? `(everyday Bahasa Malaysia, not formal/textbook).\n` : `(everyday Vietnamese).\n`) +
    `${valueHint}\n` +
    `RULES:\n` +
    `- wowHook: <= 8 words, an excited attention-grabbing line about getting this gift FREE.\n` +
    `- headline: <= 6 words, names the gift in an appealing way.\n` +
    `- bullets: 2-3 items, each <= 7 words, each a CONCRETE use/benefit grounded in what you SEE.\n` +
    `- fomoLines: 1-2 items, each <= 6 words, scarcity / urgency / don't-miss-out (e.g. "Stok terhad", "Hanya hari ini", "Jangan lepaskan").\n` +
    `- valueLine: <= 9 words, emphasises the gift's VALUE received for free.\n` +
    `- Be truthful to the image; do NOT invent specs you cannot see.\n` +
    `- NO emojis. Do NOT invent prices other than the given value.`

  const userText =
    `Gift name (source, may be in another language — render meaning in ${langName}): "${giftName.trim()}".\n` +
    `Write the bonus-gift sales copy. Return JSON {wowHook, headline, bullets, fomoLines, valueLine}.`

  const raw = await directGeminiVision({
    apiKey,
    parts: [
      { inlineData: { mimeType: img.mimeType, data: img.data } },
      { text: userText },
    ],
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema: SCHEMA,
    thinkingBudget: 0,
    maxOutputTokens: 1024,
  })

  let parsed: { wowHook?: string; headline?: string; bullets?: string[]; fomoLines?: string[]; valueLine?: string }
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Gemini trả về không phải JSON hợp lệ cho nội dung quà.')
  }

  const clean = (s: unknown) => String(s ?? '').trim()
  const headline = clean(parsed.headline) || giftName.trim()
  const bullets = (parsed.bullets ?? []).map(clean).filter(Boolean).slice(0, 3)
  const fomoLines = (parsed.fomoLines ?? []).map(clean).filter(Boolean).slice(0, 2)

  return {
    wowHook: clean(parsed.wowHook) || headline,
    headline,
    bullets,
    fomoLines: fomoLines.length ? fomoLines : [lang === 'ms' ? 'Stok terhad' : 'Số lượng có hạn'],
    valueLine: clean(parsed.valueLine),
    lang,
    sig: benefitsSig(giftImageRef, giftName, giftValueRM, lang),
  }
}
