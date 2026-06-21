// analyzeRebrand — Gemini vision đọc ảnh GỐC + tên SP → "rebrand identity":
//   • 3 tên brand đề xuất (hợp thị trường đích)
//   • palette khoá từ bản gốc (giữ thần thái)
//   • mô tả form + loại SP (để i2i giữ form)
//   • copy nhãn (tagline/benefits/ingredients/usage/caution) ĐÚNG ngôn ngữ
//     nhãn (vi→Tiếng Việt, ms→English) + netWeight lấy từ gốc nếu thấy.
// KHÔNG bịa chứng nhận (Halal/KKM/FDA…) — chỉ giữ thứ có trên bản gốc.

import { directGeminiVision } from '../../../utils/gemini'
import { getUrl } from '../../../utils/assetStore'
import {
  type Market,
  type RebrandIdentity,
  labelLangName,
  rebrandSig,
} from '../types'

export interface AnalyzeRebrandParams {
  apiKey: string
  productId: string | null
  originalImageRefs: string[]
  productName: string
  market: Market
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
    names: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
    palette: {
      type: 'object',
      properties: { bg: { type: 'string' }, primary: { type: 'string' }, accent: { type: 'string' }, onColor: { type: 'string' } },
      required: ['bg', 'primary', 'accent', 'onColor'],
    },
    productForm: { type: 'string' },
    productType: { type: 'string' },
    tagline: { type: 'string' },
    benefits: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
    netWeight: { type: 'string' },
    ingredients: { type: 'string' },
    usage: { type: 'string' },
    caution: { type: 'string' },
  },
  required: ['names', 'palette', 'productForm', 'productType', 'tagline', 'benefits', 'netWeight', 'ingredients', 'usage', 'caution'],
}

export async function analyzeRebrand(params: AnalyzeRebrandParams): Promise<RebrandIdentity> {
  const { apiKey, originalImageRefs, productName, market } = params
  const langName = labelLangName(market)
  const refs = originalImageRefs.slice(0, 4)
  const inlineParts = (await Promise.all(refs.map(refToInline))).filter(Boolean) as Array<{ inlineData: { mimeType: string; data: string } }>
  if (inlineParts.length === 0) throw new Error('Không tải được ảnh gốc để phân tích.')

  const systemInstruction =
    `You are an expert product BRANDING + packaging designer for a Malaysian/Vietnamese COD seller doing white-label rebranding. ` +
    `You are given photo(s) of an ORIGINAL product / its packaging. Analyse them and design a NEW brand.\n` +
    `TASKS:\n` +
    `1) names: propose 3 DISTINCT new brand names suitable for the ${market === 'vi' ? 'Vietnamese' : 'Malaysian (English-label)'} market — short, brandable, pronounceable, fitting the product niche. Avoid obvious existing trademarks.\n` +
    `2) palette: extract the ORIGINAL packaging's colour scheme so the rebrand keeps a similar look. Hex: bg, primary, accent, onColor (text on primary/accent). Strong contrast.\n` +
    `3) productForm: short ENGLISH description of the physical form (e.g. "red squeeze tube", "amber dropper bottle", "round jar", "sachet") — for image generation that preserves the form.\n` +
    `4) productType: 2-4 word ENGLISH product category (e.g. "joint massage gel").\n` +
    `5) Label copy in ${langName} ONLY (native, natural ${langName}): tagline (<=8 words), benefits (2-3 items, each <=7 words), ingredients (one line, from what's visible on the original if any), usage (one short line), caution (one short line, storage/skin-test style).\n` +
    `6) netWeight: copy the net weight/volume EXACTLY from the original if visible (e.g. "30ml", "100g"); else "".\n` +
    `RULES: Do NOT invent certifications (Halal/KKM/FDA/GMP) or fake claims. Keep it believable. Output ONLY JSON.`

  const userText = `Original product name (reference): "${productName.trim()}". Analyse the photos and return the rebrand identity JSON in ${langName} for label copy.`

  const raw = await directGeminiVision({
    apiKey,
    parts: [...inlineParts, { text: userText }],
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema: SCHEMA,
    thinkingBudget: 0,
    maxOutputTokens: 1536,
  })

  let p: Partial<RebrandIdentity> & { palette?: Partial<RebrandIdentity['palette']> }
  try {
    p = JSON.parse(raw)
  } catch {
    throw new Error('Gemini trả về không phải JSON hợp lệ khi phân tích rebrand.')
  }

  const hex = (v: unknown, d: string) => (typeof v === 'string' && /^#?[0-9a-fA-F]{3,8}$/.test(v.trim()) ? (v.trim().startsWith('#') ? v.trim() : `#${v.trim()}`) : d)
  const clean = (s: unknown) => String(s ?? '').trim()
  const names = (p.names ?? []).map(clean).filter(Boolean).slice(0, 3)

  return {
    names: names.length ? names : ['Brand A', 'Brand B', 'Brand C'],
    palette: {
      bg: hex(p.palette?.bg, '#FFFFFF'),
      primary: hex(p.palette?.primary, '#C0392B'),
      accent: hex(p.palette?.accent, '#E0A82E'),
      onColor: hex(p.palette?.onColor, '#FFFFFF'),
    },
    productForm: clean(p.productForm) || 'product container',
    productType: clean(p.productType) || productName.trim(),
    tagline: clean(p.tagline),
    benefits: (p.benefits ?? []).map(clean).filter(Boolean).slice(0, 3),
    netWeight: clean(p.netWeight),
    ingredients: clean(p.ingredients),
    usage: clean(p.usage),
    caution: clean(p.caution),
    market,
    sig: rebrandSig({ productId: params.productId, originalImageRefs: refs, market }),
  }
}
