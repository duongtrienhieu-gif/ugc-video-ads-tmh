// ── giftBenefitForVideo (Phase A) ────────────────────────────────────────────
// The gift's entry point into the SCRIPT TEXT. Gemini VISION reads ONLY the
// uploaded gift image (never the main product image — that blends/confuses the
// model) + the gift name + the main product name (as plain TEXT context), and
// returns:
//   • localizedGiftName — the gift name a real creator would SAY in the output
//     language (Vietnamese-typed "túi chườm nóng" → MS "tuala terma panas").
//   • benefitLine — ONE short, native, no-price benefit line for the gift,
//     grounded in what the image actually shows.
//
// Used in TWO places:
//   1. The "✨ AI gợi ý" button in the gift input (fills the editable hint field).
//   2. generateScript at script time, when the user left the benefit hint empty,
//      so the CTA always has a real gift line even with zero manual input.
//
// temp 0.7 (per spec) for a lively, non-robotic suggestion. Graceful: any
// failure returns the original name + an empty benefit (the caller copes).
// ─────────────────────────────────────────────────────────────────────────────

import { directGeminiVision } from '../../../../utils/gemini'
import { getUrl, isAssetRef } from '../../../../utils/assetStore'
import { SCRIPT_LANG_GEMINI_NAME, type ScriptLang } from '../types'

export interface GiftBenefitForVideoParams {
  apiKey: string
  /** asset:xxx (or a raw URL) of the gift image — the ONLY image read. */
  giftImageRef: string
  /** Gift name as typed (may be Vietnamese). */
  giftName: string
  /** Main product name — TEXT context only so the benefit feels on-campaign. */
  productName: string
  lang: ScriptLang
}

export interface GiftBenefitForVideoResult {
  localizedGiftName: string
  benefitLine: string
}

async function refToBase64(ref: string): Promise<{ data: string; mimeType: string }> {
  const url = isAssetRef(ref) ? await getUrl(ref) : ref
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
    localizedGiftName: { type: 'string' },
    benefitLine: { type: 'string' },
  },
  required: ['localizedGiftName', 'benefitLine'],
}

/** Read the gift image → { localizedGiftName, benefitLine } in the output language.
 *  Returns the original name + '' on any failure (never blocks the script flow). */
export async function giftBenefitForVideo(
  params: GiftBenefitForVideoParams,
): Promise<GiftBenefitForVideoResult> {
  const { apiKey, giftImageRef, giftName, productName, lang } = params
  const original = (giftName ?? '').trim()
  const fallback: GiftBenefitForVideoResult = { localizedGiftName: original, benefitLine: '' }
  if (!apiKey || !giftImageRef || !original) return fallback

  const langName = SCRIPT_LANG_GEMINI_NAME[lang] ?? 'Vietnamese'

  const systemInstruction =
    `You write microcopy for a FREE BONUS GIFT bundled with a product in a TikTok ad. ` +
    `LOOK AT THE GIFT IMAGE to understand what the gift actually is, then output JSON.\n` +
    `OUTPUT LANGUAGE: ${langName} ONLY — natural, native, the way a real ${langName} seller ` +
    (lang === 'ms' ? `talks (everyday Bahasa Malaysia, not formal/textbook).\n` : lang === 'vi' ? `talks (everyday Vietnamese).\n` : `talks.\n`) +
    `FIELDS:\n` +
    `- localizedGiftName: the gift name a creator would SAY in ${langName}. Translate the descriptive ` +
    `parts (the Vietnamese "túi chườm nóng" → the ${langName} words); keep a genuine invented brand token. ` +
    `≤ 6 words, name ONLY.\n` +
    `- benefitLine: ONE short line (≤ 12 words) — the single most appealing, CONCRETE benefit of THIS ` +
    `gift, grounded in what you SEE in the image. Make the buyer feel the bundle is worth grabbing.\n` +
    `HARD RULES:\n` +
    `- NO price, NO money amount, NO "RM"/"đ"/numbers-as-value, NO discount %.\n` +
    `- Be truthful to the image; do NOT invent specs you cannot see.\n` +
    `- NO emojis, NO quotes, NO extra commentary.`

  const userText =
    `Gift name (source, may be another language): "${original}".\n` +
    `Main product it is bundled with (context only): "${(productName ?? '').trim() || 'the product'}".\n` +
    `Return JSON {localizedGiftName, benefitLine} in ${langName}.`

  try {
    const img = await refToBase64(giftImageRef)
    const raw = await directGeminiVision({
      apiKey,
      parts: [
        { inlineData: { mimeType: img.mimeType, data: img.data } },
        { text: userText },
      ],
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: SCHEMA,
      temperature: 0.7,
      thinkingBudget: 0,
      maxOutputTokens: 512,
    })
    const parsed = JSON.parse(raw) as { localizedGiftName?: string; benefitLine?: string }
    const clean = (s: unknown) => String(s ?? '').trim().replace(/^["'“”]+|["'“”]+$/g, '')
    const name = clean(parsed.localizedGiftName) || original
    return { localizedGiftName: name, benefitLine: clean(parsed.benefitLine) }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[giftBenefitForVideo] giữ tên gốc (lỗi):', e)
    return fallback
  }
}
