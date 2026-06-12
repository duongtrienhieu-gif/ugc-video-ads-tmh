// Shared product-field localization ("mức Chuẩn"). The product bank fields are
// always written in Vietnamese (source). When an app generates output in a
// NON-Vietnamese language (Bahasa Melayu / English), it should translate the
// product's text fields ONCE up-front — including the product NAME — so no
// Vietnamese (or "đ" currency, or "TIẾT KIỆM"-style labels) leaks into the
// final ad. This is the reliable replacement for the prompt-level "translate
// everything" instruction (which depends on the generating model also obeying).
//
// Returns a Product with the 9 text fields translated; images/id/createdAt are
// untouched. Cached + in-flight-deduped per (productId + targetLang). On any
// failure it returns the ORIGINAL product (graceful — never blocks generation).

import type { Product } from '../stores/types'
import { directGeminiText } from '../utils/gemini'

const TEXT_FIELDS = [
  'productName', 'productDescription', 'targetMarket', 'painPoints',
  'usps', 'benefits', 'offer', 'ingredients', 'usageGuide',
] as const

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: Object.fromEntries(TEXT_FIELDS.map((f) => [f, { type: 'string' }])),
  required: [...TEXT_FIELDS],
} as const

const cache = new Map<string, Product>()
const inflight = new Map<string, Promise<Product>>()

function langName(target: string): string {
  return target === 'ms' ? 'Bahasa Melayu (Malaysian Malay)'
    : target === 'en' ? 'English'
    : target
}

/**
 * Translate/localize a product's text fields from Vietnamese → targetLang.
 * Vietnamese target (or missing key) → returns the product unchanged.
 */
export async function localizeProduct(
  product: Product,
  targetLang: string,
  geminiApiKey: string,
): Promise<Product> {
  if (!targetLang || targetLang === 'vi') return product
  if (!geminiApiKey?.trim()) return product  // can't translate → source (graceful)

  const key = `${product.id}::${targetLang}`
  const cached = cache.get(key)
  if (cached) return cached
  const pending = inflight.get(key)
  if (pending) return pending

  const promise = doLocalize(product, targetLang, geminiApiKey, key)
  inflight.set(key, promise)
  try {
    return await promise
  } finally {
    inflight.delete(key)
  }
}

async function doLocalize(
  product: Product,
  targetLang: string,
  geminiApiKey: string,
  key: string,
): Promise<Product> {
  const ln = langName(targetLang)
  const source: Record<string, string> = {}
  for (const f of TEXT_FIELDS) source[f] = product[f] ?? ''

  const prompt = `Translate/localize these e-commerce product fields from Vietnamese into ${ln}. Output ONLY a JSON object with the SAME keys.

Rules:
- Natural, native ${ln} (not literal/word-for-word). This is ad copy.
- productName: translate the DESCRIPTIVE part into ${ln}; keep ONLY genuine brand proper nouns + international scientific/ingredient names (e.g. "Collagen", "Hyaluronic Acid") as-is.
- ingredients: keep scientific ingredient names as-is, translate the surrounding mechanism text.
- offer: translate all labels (e.g. "TIẾT KIỆM" → target language) and use the TARGET market's currency (ms → RM, en → keep a sensible currency). If the source price is in a different currency than the target market, infer a market-appropriate price for the category rather than copying the foreign-currency number; never leave a "đ" amount.
- Leave a field empty ("") if its source is empty.
- ZERO Vietnamese words may remain in any value.

SOURCE (Vietnamese):
${JSON.stringify(source)}`

  try {
    const raw = await directGeminiText({
      apiKey: geminiApiKey,
      prompt,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA as unknown as Record<string, unknown>,
      thinkingBudget: 0,
      maxOutputTokens: 2048,
    })
    const parsed = JSON.parse(
      raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, ''),
    ) as Record<string, unknown>

    const localized: Product = { ...product }
    for (const f of TEXT_FIELDS) {
      const v = parsed[f]
      if (typeof v === 'string' && v.trim() !== '') localized[f] = v
    }
    cache.set(key, localized)
    return localized
  } catch (err) {
    console.warn('[localizeProduct] failed — returning source product (Vietnamese)', err)
    return product
  }
}
