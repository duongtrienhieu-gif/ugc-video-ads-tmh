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
  /** Toàn bộ ảnh tham chiếu: ảnh upload (đầu danh sách, quyết định FORM bao bì)
   *  + 4 ảnh sản phẩm từ bank. */
  originalImageRefs: string[]
  /** Số ảnh đầu là ảnh UPLOAD (bao bì thật) — phần còn lại là ảnh bank. */
  uploadedCount: number
  productName: string
  /** Mọi field sản phẩm (description/benefits/ingredients/usage/…) để AI đọc hiểu. */
  productContext: string
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
      properties: {
        bg: { type: 'string' }, primary: { type: 'string' }, accent: { type: 'string' }, onColor: { type: 'string' },
        colors: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 6 },
      },
      required: ['bg', 'primary', 'accent', 'onColor', 'colors'],
    },
    vibe: { type: 'string' },
    productForm: { type: 'string' },
    productType: { type: 'string' },
    tagline: { type: 'string' },
    benefits: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
    netWeight: { type: 'string' },
    ingredients: { type: 'string' },
    usage: { type: 'string' },
    caution: { type: 'string' },
    nutritionTitle: { type: 'string' },
    nutrition: { type: 'string' },
  },
  required: ['names', 'palette', 'vibe', 'productForm', 'productType', 'tagline', 'benefits', 'netWeight', 'ingredients', 'usage', 'caution', 'nutritionTitle', 'nutrition'],
}

export async function analyzeRebrand(params: AnalyzeRebrandParams): Promise<RebrandIdentity> {
  const { apiKey, originalImageRefs, uploadedCount, productName, productContext, market } = params
  const langName = labelLangName(market)
  const refs = originalImageRefs.slice(0, 6)
  const inlineParts = (await Promise.all(refs.map(refToInline))).filter(Boolean) as Array<{ inlineData: { mimeType: string; data: string } }>
  if (inlineParts.length === 0) throw new Error('Không tải được ảnh gốc để phân tích.')
  const nUploaded = Math.min(uploadedCount, inlineParts.length)

  const systemInstruction =
    `You are an expert product BRANDING + packaging designer for a Malaysian/Vietnamese COD seller doing white-label rebranding. ` +
    `Study the ENTIRE input carefully: ALL ${inlineParts.length} photos AND all product fields given. Do NOT invent a product that differs from these references.\n` +
    (nUploaded > 0
      ? `IMPORTANT: the FIRST ${nUploaded} photo(s) are the seller's ACTUAL packaging — they DECIDE the real packaging FORM/shape (box/pouch/jar/bottle/sachet). The remaining photos show the real PRODUCT content/item. Reproduce THIS real product, not an imagined one.\n`
      : `The photos show the real product/packaging — reproduce THIS real product, not an imagined one.\n`) +
    `TASKS:\n` +
    `1) names: propose 3 DISTINCT new brand names for the ${market === 'vi' ? 'Vietnamese' : 'Malaysian (English-label)'} market. RELEVANCE FIRST — EVERY name MUST clearly relate to THIS product: its main ingredient (the actual fruit you see, e.g. apricot), its category/texture (dried snack, chewy, sweet) OR its core benefit. Do NOT use abstract words unrelated to the product (no random "Stone/Bliss/Burst/Kiss/Glow" unless genuinely tied to the product). Use 3 angles: (a) ingredient-led, (b) benefit-led, (c) evocative but ON-THEME. Short, brandable, pronounceable; avoid obvious existing trademarks.\n` +
    `2) palette: extract the colour scheme so the rebrand keeps a similar RICH look. Hex: bg, primary, accent, onColor, AND colors = 5-6 dominant hex colours sampled from the original (sky/background tones, brand colour, product colour, leaf/decoration, neutrals) — capture the real richness, not just 2 colours.\n` +
    `   vibe: one sentence (ENGLISH) describing the original's overall LOOK & FEEL — background scene/style, mood, and decorative motifs (e.g. "illustrated nature scene: teal sky gradient, fruit branch, distant mountains, warm oriental wellness mood").\n` +
    `3) productForm: short ENGLISH description of the REAL physical form taken from the packaging photo(s) (e.g. "stand-up pouch", "folding carton box", "round jar", "squeeze tube") — generation must preserve THIS form.\n` +
    `4) productType: 2-4 word ENGLISH product category grounded in the fields (e.g. "dried hawthorn snack").\n` +
    `5) Label copy in ${langName} ONLY. The product fields are CONTEXT to UNDERSTAND the product — do NOT copy them verbatim and do NOT dump everything. Write fresh, concise, natural label copy, keeping ONLY what a real retail label needs: tagline (<=8 words), benefits (2-3 items, each <=7 words — pick only the strongest, rephrased), usage (one short line), caution (one short line).\n` +
    `   ingredients: list ONLY the REAL ingredient names that actually appear in the source/photos — the source fields may be in Vietnamese, so TRANSLATE each ingredient name ACCURATELY into ${langName} (e.g. Vừng đen → Black Sesame, Dâu tằm → Mulberry, Bạch chỉ → Angelica, Linh chi → Ganoderma). Do NOT add or invent any ingredient that isn't there, and DROP marketing phrases (like "9 natural extracts"). For EACH real ingredient, ADD a PLAUSIBLE estimated amount (mg or g) typical for this product type — format like "Black Sesame 200mg, Mulberry 150mg, Angelica 100mg, Ganoderma 80mg". (Amounts are estimates the seller will verify.)\n` +
    `6) netWeight: copy net weight/volume EXACTLY from a photo if visible (e.g. "500g", "30ml"); else "".\n` +
    `7) Nutrition panel — DERIVE it from the product KIND + the REAL ingredients above. Do NOT output a fixed food template:\n` +
    `   • If this is a DIETARY SUPPLEMENT / vitamin / herbal remedy in TABLET / CAPSULE / SOFTGEL / PILL / powder-sachet form → nutritionTitle = "SUPPLEMENT FACTS"; nutrition = a Supplement Facts panel that STARTS with "Serving size: <the real dose, e.g. 1 tablet (290mg)>", then lists EACH active ingredient with its amount PER SERVING and an estimated %NRV/RDI, taken DIRECTLY from the real ingredients listed above (e.g. "Vitamin B1 1.2mg (109% NRV), Vitamin B2 1.2mg (86% NRV), Niacin 15mg (94% NRV), Folic Acid 300mcg (150% NRV)"). Do NOT output Energy/Protein/Fat/Carbohydrate for supplements — they are meaningless for a tablet.\n` +
    `   • Otherwise (a real FOOD / snack / drink) → nutritionTitle = "NUTRITION INFORMATION (per 100g)"; nutrition = compact food macros (Energy kcal, Protein, Fat, Carbohydrate, Sugars, Dietary Fibre, Sodium).\n` +
    `   These are ESTIMATES for layout — the seller will verify.\n` +
    `RULES: Do NOT invent certifications (Halal/KKM/FDA/GMP) or fake claims. Keep it concise + believable. Output ONLY JSON.`

  // Seed ngẫu nhiên mỗi lần bấm → 3 tên brand KHÁC HẲN lần trước.
  const seed = Math.random().toString(36).slice(2, 8)
  const userText =
    `Original product name: "${productName.trim()}".\n` +
    (productContext ? `Product fields (CONTEXT to understand the product — do NOT copy verbatim):\n${productContext}\n` : '') +
    `Understand the product from the photos + fields, then return the rebrand identity JSON in ${langName} with CONCISE label copy (only what's necessary).\n` +
    `Variation seed: ${seed} — make the 3 names fresh & different each time, but EVERY name must still clearly read as THIS product (its fruit / category / benefit), never generic or off-topic.`

  const raw = await directGeminiVision({
    apiKey,
    parts: [...inlineParts, { text: userText }],
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema: SCHEMA,
    thinkingBudget: 0,
    temperature: 0.8,
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
      colors: ((p.palette?.colors as string[] | undefined) ?? [])
        .map((c) => hex(c, '')).filter(Boolean).slice(0, 6),
    },
    vibe: clean(p.vibe),
    productForm: clean(p.productForm) || 'product container',
    productType: clean(p.productType) || productName.trim(),
    tagline: clean(p.tagline),
    benefits: (p.benefits ?? []).map(clean).filter(Boolean).slice(0, 3),
    netWeight: clean(p.netWeight),
    ingredients: clean(p.ingredients),
    usage: clean(p.usage),
    caution: clean(p.caution),
    nutritionTitle: clean(p.nutritionTitle) || 'NUTRITION INFORMATION',
    nutrition: clean(p.nutrition),
    market,
    sig: rebrandSig({ productId: params.productId, originalImageRefs: refs, market }),
  }
}
