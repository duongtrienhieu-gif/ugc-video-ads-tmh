// generateGiftBenefits — Gemini vision đọc ẢNH quà + tên quà → mini-pitch
// (headline + 2-3 công dụng) ĐÚNG ngôn ngữ đích.
//
// Đây là nguồn "quà là gì / tác dụng như nào": user KHÔNG phải tự gõ công
// dụng (đúng nguyên tắc tối thiểu input). Vì đọc chính ảnh thật nên công
// dụng bám đúng món quà, không bịa. Kết quả được nướng vào ảnh "thẻ info".

import { directGeminiVision } from '../../../utils/gemini'
import { getUrl } from '../../../utils/assetStore'
import { langDisplayName } from '../labels'
import type { Market, GiftBenefits } from '../types'

export interface GenerateGiftBenefitsParams {
  apiKey: string
  giftImageRef: string
  giftName: string
  lang: Market
}

/** Hash nhẹ để phát hiện benefits stale khi input đổi. */
export function benefitsSig(giftImageRef: string, giftName: string, lang: Market): string {
  return `${giftImageRef}|${giftName.trim().toLowerCase()}|${lang}`
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
    headline: { type: 'string' },
    bullets: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
  },
  required: ['headline', 'bullets'],
}

export async function generateGiftBenefits(
  params: GenerateGiftBenefitsParams,
): Promise<GiftBenefits> {
  const { apiKey, giftImageRef, giftName, lang } = params
  const img = await refToBase64(giftImageRef)
  const langName = langDisplayName(lang)

  const systemInstruction =
    `You write SHORT marketing microcopy for a FREE BONUS GIFT shown on a Malaysian/Vietnamese ` +
    `COD landing page. Look at the gift product in the image and the given gift name, then describe ` +
    `what the gift is and its concrete usefulness for the buyer.\n` +
    `OUTPUT LANGUAGE: ${langName} ONLY — every word must be natural, native ${langName}. ` +
    (lang === 'ms'
      ? `Use natural everyday Bahasa Malaysia (not formal/textbook), the way a real seller writes.\n`
      : `Use natural everyday Vietnamese the way a real seller writes.\n`) +
    `RULES:\n` +
    `- headline: <= 6 words, names the gift in an appealing way.\n` +
    `- bullets: 2-3 items, each <= 7 words, each a CONCRETE use/benefit grounded in what you SEE.\n` +
    `- Be truthful to the image; do NOT invent specs you cannot see.\n` +
    `- NO prices, NO numbers about money, NO emojis.`

  const userText =
    `Gift name (source, may be in another language — render meaning in ${langName}): "${giftName.trim()}".\n` +
    `Describe this gift for the bonus block. Return JSON {headline, bullets}.`

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

  let parsed: { headline?: string; bullets?: string[] }
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Gemini trả về không phải JSON hợp lệ cho công dụng quà.')
  }

  const headline = (parsed.headline ?? '').trim() || giftName.trim()
  const bullets = (parsed.bullets ?? [])
    .map((b) => String(b).trim())
    .filter(Boolean)
    .slice(0, 3)

  return {
    headline,
    bullets,
    lang,
    sig: benefitsSig(giftImageRef, giftName, lang),
  }
}
