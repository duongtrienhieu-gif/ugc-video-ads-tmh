// analyzeProduct — Gemini vision đọc CÁC ảnh sản phẩm → art-direction:
//   • chọn ảnh hero hợp nhất (heroImageIndex)
//   • trích palette màu chủ đạo TỪ sản phẩm/bao bì
//   • sinh copy MY/VN bản địa theo preset (headline, scarcity, trust, …)
//
// Một call duy nhất. Fail → caller fallback palette/copy mặc định.

import { directGeminiVision } from '../../../utils/gemini'
import { getUrl } from '../../../utils/assetStore'
import { langDisplayName } from '../labels'
import {
  type Market,
  type FormBgPreset,
  type ProductDirection,
  defaultPalette,
  directionSig,
} from '../types'

export interface AnalyzeProductParams {
  apiKey: string
  productImageRefs: string[]   // tối đa 4 ảnh SP (asset refs)
  productName: string
  preset: FormBgPreset
  lang: Market
  hasGift: boolean
  productId: string | null
  giftImageRef: string | null
}

async function refToInline(assetRef: string): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  try {
    const url = await getUrl(assetRef)
    if (!url) return null
    const resp = await fetch(url)
    if (!resp.ok) return null
    const blob = await resp.blob()
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = () => reject(new Error('read fail'))
      fr.readAsDataURL(blob)
    })
    return { inlineData: { mimeType: blob.type || 'image/jpeg', data: dataUrl.split(',')[1] ?? '' } }
  } catch {
    return null
  }
}

const SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    heroImageIndex: { type: 'integer' },
    palette: {
      type: 'object',
      properties: {
        bg: { type: 'string' }, primary: { type: 'string' }, accent: { type: 'string' }, onColor: { type: 'string' },
      },
      required: ['bg', 'primary', 'accent', 'onColor'],
    },
    productLabel: { type: 'string' },
    headline: { type: 'string' },
    subhead: { type: 'string' },
    ctaWord: { type: 'string' },
    scarcity: { type: 'string' },
    trust: { type: 'string' },
    fomoTitle: { type: 'string' },
    fomoLine: { type: 'string' },
    testimonial: { type: 'string' },
    giftTeaser: { type: 'string' },
  },
  required: ['heroImageIndex', 'palette', 'productLabel', 'headline', 'subhead', 'ctaWord', 'scarcity', 'trust', 'fomoTitle', 'fomoLine'],
}

const PRESET_BRIEF: Record<FormBgPreset, string> = {
  editorial:
    `Style = trustworthy health-magazine editorial. Copy is calm + credible (not shouty). ` +
    `Provide a short "testimonial" (1 sentence, with a believable Malay name + city).`,
  abundance:
    `Style = generous bundle / value-stack. Copy celebrates getting a lot for the price. ` +
    `Provide a short "giftTeaser" line about the free bonus gift.`,
  transformation:
    `Style = before/after transformation. Copy promises a visible change in a timeframe (e.g. "14 hari").`,
}

export async function analyzeProduct(params: AnalyzeProductParams): Promise<ProductDirection> {
  const { apiKey, productImageRefs, productName, preset, lang, hasGift } = params
  const langName = langDisplayName(lang)
  const refs = productImageRefs.slice(0, 4)
  const inlineParts = (await Promise.all(refs.map(refToInline))).filter(Boolean) as Array<{ inlineData: { mimeType: string; data: string } }>
  if (inlineParts.length === 0) throw new Error('Không tải được ảnh sản phẩm để phân tích.')

  const systemInstruction =
    `You are an expert Malaysian COD direct-response ART DIRECTOR + copywriter. You design the BACKGROUND ` +
    `art-direction for an order-form landing page. You are given ${inlineParts.length} product photo(s), indexed 0..${inlineParts.length - 1}.\n` +
    `TASKS:\n` +
    `1) heroImageIndex: pick the SINGLE best photo for IDENTITY FIDELITY — a CLEAN studio packshot where the product + its label text are sharp, front-facing and clearly readable (avoid lifestyle/in-use shots, hands, or busy backgrounds). This image will be copied faithfully, so clarity of the packaging matters most.\n` +
    `2) palette: extract a harmonious colour scheme ANCHORED to the product's real colours/packaging. ` +
    `Return hex strings: bg (page background), primary (headline/brand colour), accent (badge/highlight), onColor (text that sits on primary/accent). Ensure strong contrast + readable.\n` +
    `3) Write SHORT punchy marketing copy in ${langName} ONLY (native, natural ${lang === 'ms' ? 'Bahasa Malaysia' : 'Vietnamese'}):\n` +
    `   - headline (<=7 words, benefit + desire), subhead (<=9 words), ctaWord (1-2 words, e.g. "Pesan sekarang"),\n` +
    `   - scarcity (<=6 words, urgency/limited), trust (<=8 words, guarantee/COD/credibility).\n` +
    `   - fomoTitle (<=4 words, a countdown/urgency label that sits ABOVE a countdown timer, e.g. deadline framing),\n` +
    `   - fomoLine (<=10 words, loss-aversion: price goes back up / stock runs out when time ends). Fresh wording, do NOT copy common templates verbatim.\n` +
    `${PRESET_BRIEF[preset]}\n` +
    `${hasGift ? 'A free BONUS GIFT is included — reference it where relevant.' : 'No bonus gift.'}\n` +
    `NO emojis. Do NOT invent specific prices or money amounts. Output ONLY the JSON.`

  const userText = `Product name (may be in another language): "${productName.trim()}". Analyse the photos and return the art-direction JSON.`

  const raw = await directGeminiVision({
    apiKey,
    parts: [...inlineParts, { text: userText }],
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema: SCHEMA,
    thinkingBudget: 0,
    maxOutputTokens: 1024,
  })

  let p: Partial<ProductDirection> & { palette?: Partial<ProductDirection['palette']> }
  try {
    p = JSON.parse(raw)
  } catch {
    throw new Error('Gemini trả về không phải JSON hợp lệ khi phân tích sản phẩm.')
  }

  const fallback = defaultPalette(preset)
  const hex = (v: unknown, d: string) => (typeof v === 'string' && /^#?[0-9a-fA-F]{3,8}$/.test(v.trim()) ? (v.trim().startsWith('#') ? v.trim() : `#${v.trim()}`) : d)
  const heroIdx = Math.max(0, Math.min(refs.length - 1, Math.round(Number(p.heroImageIndex ?? 0)) || 0))
  const clean = (s: unknown) => String(s ?? '').trim()

  return {
    heroImageIndex: heroIdx,
    palette: {
      bg: hex(p.palette?.bg, fallback.bg),
      primary: hex(p.palette?.primary, fallback.primary),
      accent: hex(p.palette?.accent, fallback.accent),
      onColor: hex(p.palette?.onColor, fallback.onColor),
    },
    productLabel: clean(p.productLabel) || productName.trim(),
    headline: clean(p.headline),
    subhead: clean(p.subhead),
    ctaWord: clean(p.ctaWord) || (lang === 'ms' ? 'Pesan sekarang' : 'Đặt ngay'),
    scarcity: clean(p.scarcity),
    trust: clean(p.trust),
    fomoTitle: clean(p.fomoTitle) || (lang === 'ms' ? 'Tawaran tamat dalam' : 'Ưu đãi kết thúc sau'),
    fomoLine: clean(p.fomoLine) || (lang === 'ms' ? 'Bila masa habis, harga naik balik!' : 'Hết giờ là giá về như cũ!'),
    testimonial: clean(p.testimonial) || undefined,
    giftTeaser: clean(p.giftTeaser) || undefined,
    lang,
    preset,
    sig: directionSig({ productId: params.productId, preset, lang, giftImageRef: params.giftImageRef }),
  }
}
