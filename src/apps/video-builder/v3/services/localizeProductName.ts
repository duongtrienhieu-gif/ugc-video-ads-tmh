// ── Localize product name (P6i) ──────────────────────────────────────────────
// The product name is ONE field used everywhere (spoken script, director, stickers,
// banner, thumbnail, social-proof card). When it arrives in another language (an
// all-caps English "HAWTHORNS SNACK", or a Vietnamese-worded brief name), the engine
// used it VERBATIM → the ad spoke a foreign/untranslated name and leaked source words.
//
// This resolves the name ONCE into the picked OUTPUT language the way a real local
// creator would SAY it: the DESCRIPTIVE / common-noun parts are translated ("Snack" →
// "snek", "Knee Support Booster" → "đai trợ lực gối"), while a GENUINE invented BRAND
// token is kept as-is (Adam, Mochi, Anessa, Hada Labo, Xiaomi). Cached on the product
// (localizedName + localizedNameLang) so every downstream surface uses ONE consistent
// name. The original `productName` (bank/UI display) is NEVER touched. Graceful: any
// failure (no key / Gemini error / empty) keeps the original name → never blocks gen.
// ─────────────────────────────────────────────────────────────────────────────

import { directGeminiText } from '../../../../utils/gemini'
import { SCRIPT_LANG_GEMINI_NAME, type ScriptLang } from '../types'
import type { Product } from '../../../../stores/types'

/** Resolve the spoken/display name in `lang`. Returns the original on any failure. */
export async function localizeProductName(
  name: string, lang: ScriptLang, geminiKey: string,
): Promise<string> {
  const original = (name ?? '').trim()
  if (!original || !geminiKey) return original
  const langName = SCRIPT_LANG_GEMINI_NAME[lang] ?? 'Vietnamese'
  const systemInstruction =
`You localize ONE product name for a TikTok ad spoken in ${langName}. Output ONLY the name a
real ${langName} creator would SAY out loud — no quotes, no explanation, no extra words.

RULES:
- Translate the DESCRIPTIVE / common-noun parts into natural ${langName} ("Snack" → the ${langName}
  word for snack, "Knee Support Booster" → the ${langName} phrase, "garlic"/"tỏi" → the ${langName} word).
- KEEP a GENUINE INVENTED BRAND token / proper name UNCHANGED (e.g. Adam, Mochi, Anessa, Hada Labo,
  Xiaomi) — a made-up coined word with no dictionary meaning.
- A Capitalized COMMON NOUN is NOT a brand (Snack, Booster, Gel, Serum, Hawthorn, Apricot) — translate it.
  When UNSURE whether a word is a brand or a description, TRANSLATE it.
- Result must be SHORT (≤ 6 words) and 100% sayable in ${langName} — no leftover English/Vietnamese word
  a ${langName} viewer wouldn't say. Output the name ONLY.`
  try {
    const raw = await directGeminiText({
      apiKey: geminiKey,
      prompt: `Product name: "${original}"\nLocalized name (${langName}) only:`,
      systemInstruction,
      maxOutputTokens: 60,
      temperature: 0.2,
      thinkingBudget: 0,
    })
    const out = raw.trim().replace(/^["'“”]+|["'“”]+$/g, '').split('\n')[0].trim()
    // Sanity: non-empty, not absurdly long → else keep original.
    if (out && out.length <= 80 && out.split(/\s+/).length <= 8) return out
    return original
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[localizeName] giữ tên gốc (lỗi):', e)
    return original
  }
}

/** Compute + cache the localized name on the product for `lang` (only if missing/stale).
 *  Returns the product (possibly with localizedName set). Caller persists via setProduct. */
export async function ensureLocalizedName(
  product: Product, lang: ScriptLang, geminiKey: string,
): Promise<Product> {
  if (!product?.productName?.trim()) return product
  if (product.localizedName && product.localizedNameLang === lang) return product   // cached
  const localizedName = await localizeProductName(product.productName, lang, geminiKey)
  return { ...product, localizedName, localizedNameLang: lang }
}

/** Sync: the product COPY whose `productName` is the localized name (for the picked lang),
 *  so every downstream service that reads `product.productName` gets the localized one.
 *  Falls back to the original name when nothing is cached for this lang. */
export function applyLocalizedName(product: Product, lang: ScriptLang): Product
export function applyLocalizedName(product: Product | null | undefined, lang: ScriptLang): Product | null | undefined
export function applyLocalizedName(product: Product | null | undefined, lang: ScriptLang): Product | null | undefined {
  if (!product) return product
  if (product.localizedName && product.localizedNameLang === lang && product.localizedName !== product.productName) {
    return { ...product, productName: product.localizedName }
  }
  return product
}
