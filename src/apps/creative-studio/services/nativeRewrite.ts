// ── Native-Locale Product Rewriting Service (P32) ──────────────────────────
//
// User spec: "KHÔNG ĐƯỢC TRANSLATE — phải Malaysia-native rewriting"
//
// This service does NOT translate Vietnamese → Malay. It asks Gemini to
// RE-WRITE the product knowledge in the target market's NATIVE
// marketing voice:
//
//   • Malaysia-native ad tone (mixed BM + occasional EN brand terms,
//     local slang like "nak", "tak", "memang", "gila")
//   • Indonesia-native marketing voice (yang/dgn/krn shorthand,
//     casual urban tone)
//   • Global English (plain confident, no Vietnamese sentence shape)
//
// Output schema matches LocalizedProductFields exactly. Post-validated
// against the locale validator (P29) — if the model leaks Vietnamese,
// retried under the strict suffix; if all retries fail, surfaces an
// error to the caller.

import type { UINativeLocale } from '../types/uiNative'
import type { Product } from '../../../stores/types'
import { safeGenerateStructured } from '../shared/llm/safeGenerateStructured'
import { validateLocaleMany } from '../shared/qc/localeValidator'
import type { LocalizedProductFields } from './productLocalizations'

const NATIVE_REWRITE_SYSTEM_INSTRUCTION =
  'You are a senior marketing copywriter who NATIVELY writes for SEA ecommerce '
  + 'markets (Malaysia, Indonesia, Vietnam, global English). Your job is NOT '
  + 'translation — it is NATIVE REWRITING. Given a source product brief in '
  + 'Vietnamese (or any source language), you RE-WRITE the brief in the '
  + 'target market\'s authentic marketing voice — local idioms, local pain '
  + 'point phrasing, local ad rhythm, local CTA conventions. '
  + 'NEVER produce literal word-for-word translation. NEVER carry over '
  + 'Vietnamese sentence structure. Output STRICT JSON, no prose, no markdown.'

const TARGET_VOICE: Record<UINativeLocale, string> = {
  'vi-VN':
    'Vietnamese (Tiếng Việt with diacritics). Marketing voice — confident, '
    + 'casual conversational. Use natural Vietnamese ad phrasing, not literal '
    + 'translation. Avoid corporate stiffness.',
  'my-MY':
    'Bahasa Melayu — Malaysia ad market voice. Mix BM with occasional English '
    + 'brand terms ("body", "skincare", "deal", "promo") as Malaysian copy '
    + 'naturally does. Local slang acceptable in tone field ("memang", '
    + '"jimat", "berbaloi", "best", "power", "ringan"). Use Malaysian price '
    + 'conventions if applicable (RM). Pain points written from Malaysian '
    + 'consumer perspective.',
  'id-ID':
    'Bahasa Indonesia — urban casual marketing voice. Use Indonesian '
    + 'shorthand naturally ("yang", "dengan", "karena", "juga"). Avoid '
    + 'Malay-only words. Pain points written from Indonesian consumer '
    + 'perspective. Use IDR price conventions if applicable (Rp).',
  'global':
    'Plain confident English marketing voice — no Vietnamese sentence '
    + 'structure, no awkward translation tells. Direct benefit-driven copy '
    + 'fit for international ecommerce.',
}

interface RewriteRequest {
  product: Product
  targetLocale: UINativeLocale
}

interface RewriteResponse {
  productName: string
  productDescription: string
  niche: string
  audience: string
  benefits: string
  usps: string
  painPoints: string
  ingredients: string
  offer: string
  tone: string
}

function buildRewritePrompt(req: RewriteRequest): string {
  const { product, targetLocale } = req
  const voice = TARGET_VOICE[targetLocale]
  return [
    `Re-write the product brief below in: ${voice}`,
    '',
    '── SOURCE BRIEF (do NOT translate literally; use as marketing source material only) ──',
    `Product name: ${product.productName}`,
    product.productDescription ? `Description: ${product.productDescription}` : '',
    product.targetMarket       ? `Niche / market: ${product.targetMarket}` : '',
    product.painPoints         ? `Pain points: ${product.painPoints}` : '',
    product.usps               ? `USPs: ${product.usps}` : '',
    product.benefits           ? `Benefits: ${product.benefits}` : '',
    product.ingredients        ? `Ingredients: ${product.ingredients}` : '',
    product.offer              ? `Offer / pricing: ${product.offer}` : '',
    '',
    'STRICT JSON OUTPUT — every field is a string written natively in the target voice:',
    '{',
    '  "productName": "<keep brand name as-is; localize any descriptive suffix only>",',
    '  "productDescription": "<2-4 sentence native description>",',
    '  "niche": "<localized niche name>",',
    '  "audience": "<localized audience descriptor>",',
    '  "benefits": "<benefits as bullet-like list separated by \\n or ;>",',
    '  "usps": "<USPs separated by \\n or ;>",',
    '  "painPoints": "<pain points separated by \\n or ;>",',
    '  "ingredients": "<ingredients separated by , or ;>",',
    '  "offer": "<localized offer / pricing line>",',
    '  "tone": "<short tone descriptor in English, eg \\"confident-natural\\">"',
    '}',
    '',
    'CRITICAL RULES:',
    '- This is NOT translation. RE-WRITE in the target market\'s native ad voice.',
    '- NEVER carry over Vietnamese sentence structure. NEVER use Vietnamese diacritics in the target locale (unless target IS vi-VN).',
    '- Brand name stays the same. Everything else gets re-written.',
    '- Match the target market\'s ad cliches and rhythm.',
    '- Keep the marketing INTENT identical; change the WORDING completely.',
  ].filter(Boolean).join('\n')
}

function isRewriteResponse(v: unknown): v is RewriteResponse {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  return typeof obj.productName === 'string'
      && typeof obj.benefits === 'string'
      && (typeof obj.usps === 'string' || typeof obj.painPoints === 'string')
}

function fallbackResponse(req: RewriteRequest): RewriteResponse {
  // Last-resort fallback — return source fields with a marker tone so
  // the user knows the rewrite did not complete.
  return {
    productName:        req.product.productName,
    productDescription: req.product.productDescription,
    niche:              req.product.targetMarket,
    audience:           '',
    benefits:           req.product.benefits,
    usps:               req.product.usps,
    painPoints:         req.product.painPoints,
    ingredients:        req.product.ingredients,
    offer:              req.product.offer,
    tone:               `fallback (rewrite to ${req.targetLocale} failed)`,
  }
}

/** Native-rewrite a product's marketing copy from the source language
 *  into the target locale's native ad voice. Throws when the LLM is
 *  unreachable; otherwise always returns something (fallback if needed). */
export async function nativeRewriteProduct(
  apiKey: string,
  req: RewriteRequest,
): Promise<{ ok: boolean; fields: LocalizedProductFields; attempts: number }> {
  if (!apiKey) throw new Error('[nativeRewrite] Missing Gemini API key')

  const result = await safeGenerateStructured<RewriteResponse>({
    apiKey,
    prompt: buildRewritePrompt(req),
    systemInstruction: NATIVE_REWRITE_SYSTEM_INSTRUCTION,
    maxOutputTokens: 2048,
    schema: { name: 'NativeRewriteResponse', validate: isRewriteResponse },
    fallback: fallbackResponse(req),
    generatorLabel: `native-rewrite:${req.targetLocale}`,
    // Post-validate every text field — if Vietnamese leaks into a my-MY
    // rewrite, retry under STRICT_SUFFIX. This is the core mechanism
    // that enforces "Malaysia-native, NOT translation".
    postValidate: (v) => validateLocaleMany([
      v.productDescription, v.benefits, v.usps, v.painPoints,
      v.audience, v.offer, v.niche,
    ], req.targetLocale),
  })

  return {
    ok: result.ok,
    attempts: result.attempts,
    fields: {
      productName:        result.value.productName,
      productDescription: result.value.productDescription,
      niche:              result.value.niche,
      audience:           result.value.audience,
      benefits:           result.value.benefits,
      usps:               result.value.usps,
      painPoints:         result.value.painPoints,
      ingredients:        result.value.ingredients,
      offer:              result.value.offer,
      tone:               result.value.tone,
      updatedAt:          Date.now(),
      source:             'native-rewrite',
    },
  }
}
