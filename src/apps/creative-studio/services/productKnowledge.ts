// ── Product Knowledge Loader (P25 — Phase 1 foundation) ───────────────────
//
// Loads the FULL product profile from bankStore and synthesizes a typed
// ProductKnowledge object that flows through every engine's prompt /
// text-generation context.
//
// ARCHITECTURE RULE (per Phase 1 spec):
//   • Project Product Database is the PRIMARY source of truth
//   • Image references are SECONDARY visual anchors only
//   • DO NOT rely on AI vision-analysis of the product image to infer
//     niche / benefits / pain points — read them from the typed
//     Product record the user filled in
//
// Engines consume ProductKnowledge via PromptContext. Photographic engine
// bakes it into a `BLOCKS.productContext()` block. UI-native text
// generator passes it into the Gemini prompt so chat / review / comments
// reference real product details. Designed-graphic content generator
// uses it for infographic stats + cta headlines.

import { useBankStore } from '../../../stores/bankStore'
import type { Product } from '../../../stores/types'
import type { UINativeLocale } from '../types/uiNative'
import { readLocalization } from './productLocalizations'

export interface ProductKnowledge {
  /** Brand name as the user entered it in Project. */
  productName: string
  /** Long-form description. */
  description: string
  /** Target niche (eg "skincare", "supplement", "office wellness"). */
  niche: string
  /** Audience descriptor (eg "women 25-40 with sleep issues"). */
  audience: string
  /** Key benefits, split from the freeform product.benefits string. */
  benefits: string[]
  /** USPs, split from product.usps. */
  usps: string[]
  /** Pain points the product solves. */
  painPoints: string[]
  /** Active ingredients / formulation notes. */
  ingredients: string[]
  /** Offer / pricing terms. */
  offer: string
  /** Tone hint — inferred from niche if not explicit. */
  tone: string
  /** Market the locale implies (vi-VN → "Vietnam", my-MY → "Malaysia", ...). */
  market: string
  /** Reference image (asset:xxx) — the visual anchor. */
  productImage: string | null
}

// ── Locale → market mapping ──────────────────────────────────────────

const MARKET_BY_LOCALE: Record<UINativeLocale, string> = {
  'vi-VN':  'Vietnam',
  'my-MY':  'Malaysia',
  'id-ID':  'Indonesia',
  'global': 'Southeast Asia (English)',
}

// ── List splitter — bankStore stores benefits/USPs as freeform strings,
//    sometimes with newlines / semicolons / bullet glyphs as separators.

function splitList(s: string | undefined | null): string[] {
  if (!s) return []
  return s
    .split(/\n|;|•|·|—|\|/)
    .map((p) => p.replace(/^\s*[-*•·]\s*/, '').trim())
    .filter((p) => p.length > 1)
}

// ── Tone inference ───────────────────────────────────────────────────

function inferTone(niche: string, painPoints: string[]): string {
  const lo = niche.toLowerCase()
  if (lo.includes('luxury') || lo.includes('premium')) return 'refined-aspirational'
  if (lo.includes('skincare') || lo.includes('beauty')) return 'warm-glow'
  if (lo.includes('supplement') || lo.includes('vitamin')) return 'trustworthy-clinical'
  if (lo.includes('food') || lo.includes('drink')) return 'cozy-natural'
  if (lo.includes('fitness') || lo.includes('gym')) return 'energetic-direct'
  if (painPoints.length > 2) return 'empathetic-relief'
  return 'natural-warm'
}

// ── Public loader ────────────────────────────────────────────────────

export function loadProductKnowledge(
  productId: string | undefined,
  locale: UINativeLocale = 'vi-VN',
): ProductKnowledge | null {
  if (!productId) return null
  const product = useBankStore.getState().getProductById(productId)
  if (!product) return null
  return fromProduct(product, locale)
}

/** Build ProductKnowledge from a raw Product record + locale.
 *
 *  P32: when a localization exists for the target locale, its fields
 *  OVERRIDE the legacy Vietnamese product fields. This is the key
 *  mechanism that prevents Vietnamese leakage into my-MY / id-ID /
 *  global generations — the LLM never sees the Vietnamese source when
 *  a native-rewritten override is available. */
export function fromProduct(product: Product, locale: UINativeLocale = 'vi-VN'): ProductKnowledge {
  const override = readLocalization(product.id, locale)

  // Per-field resolution: localization wins, legacy is fallback.
  const productName        = override?.productName        ?? product.productName
  const productDescription = override?.productDescription ?? product.productDescription
  const benefitsStr        = override?.benefits           ?? product.benefits
  const uspsStr            = override?.usps               ?? product.usps
  const painPointsStr      = override?.painPoints         ?? product.painPoints
  const ingredientsStr     = override?.ingredients        ?? product.ingredients
  const offerStr           = override?.offer              ?? product.offer
  const niche              = override?.niche              ?? product.targetMarket ?? 'general consumer'
  const audience           = override?.audience           ?? product.targetMarket ?? 'general SEA consumer'

  const benefits    = splitList(benefitsStr)
  const usps        = splitList(uspsStr)
  const painPoints  = splitList(painPointsStr)
  const ingredients = splitList(ingredientsStr)

  return {
    productName,
    description:  productDescription || '',
    niche,
    audience,
    benefits,
    usps,
    painPoints,
    ingredients,
    offer:        offerStr || '',
    tone:         override?.tone ?? inferTone(niche, painPoints),
    market:       MARKET_BY_LOCALE[locale],
    productImage: product.productImage || null,
  }
}

// ── Compact textual summary for embedding in prompts ─────────────────

/** Build a short multi-line product-knowledge block that goes into the
 *  prompt (photographic) or system instruction (text generators). Keep
 *  it under ~400 tokens — too long blows the prompt budget. */
export function formatProductKnowledgeForPrompt(k: ProductKnowledge): string {
  const lines: string[] = []
  lines.push(`Brand: ${k.productName}`)
  if (k.description) lines.push(`Description: ${k.description.slice(0, 220)}`)
  lines.push(`Niche: ${k.niche}`)
  lines.push(`Market: ${k.market}`)
  lines.push(`Audience: ${k.audience}`)
  if (k.benefits.length)    lines.push(`Key benefits: ${k.benefits.slice(0, 4).join(' · ')}`)
  if (k.usps.length)        lines.push(`USPs: ${k.usps.slice(0, 3).join(' · ')}`)
  if (k.painPoints.length)  lines.push(`Pain points solved: ${k.painPoints.slice(0, 3).join(' · ')}`)
  if (k.ingredients.length) lines.push(`Key ingredients: ${k.ingredients.slice(0, 4).join(' · ')}`)
  if (k.offer)              lines.push(`Offer: ${k.offer.slice(0, 120)}`)
  lines.push(`Tone: ${k.tone}`)
  return lines.join('\n')
}
