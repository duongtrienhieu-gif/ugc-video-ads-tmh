// formBgPromptBuilder — dựng prompt gpt-4o-image cho ảnh NỀN FORM theo preset.
//
// Bất biến cho mọi preset: (1) giữ identity SP/quà từ ref, (2) NHÚNG palette
// AI trích, (3) chữ đúng ngôn ngữ, (4) — QUAN TRỌNG NHẤT — chừa PANEL FORM
// TRỐNG ở giữa (no input/no button/no text). 2 biến thể khác bố cục.

import type { Market, FormBgPreset, ProductDirection } from '../types'
import { langDisplayName, freeGiftBadge } from '../labels'

export interface BuildFormBgPromptParams {
  preset: FormBgPreset
  direction: ProductDirection
  hasGift: boolean
  lang: Market
  variantIndex: number
}

function q(s: string): string {
  return `"${(s ?? '').replace(/"/g, "'").trim()}"`
}

function beforeAfterWords(lang: Market): [string, string] {
  return lang === 'vi' ? ['TRƯỚC', 'SAU'] : ['SEBELUM', 'SELEPAS']
}

function expertSeal(lang: Market): string {
  return lang === 'vi' ? 'CHUYÊN GIA KHUYÊN DÙNG' : 'PAKAR CADANG'
}

const FORM_SAFE_ZONE =
  `FORM SAFE ZONE (CRITICAL, non-negotiable): reserve a LARGE EMPTY clean panel occupying roughly the middle 50% ` +
  `of the image — a softly rounded card in a near-solid light colour. This panel MUST be COMPLETELY EMPTY: ` +
  `absolutely NO input fields, NO text boxes, NO buttons, NO labels, NO icons, NO text of ANY kind inside it. ` +
  `It is reserved for an order form that will be overlaid later. Keep it low-detail so overlaid text stays readable.`

function paletteBlock(d: ProductDirection): string {
  const p = d.palette
  return `COLOUR PALETTE (use consistently, anchored to the real product): background ${p.bg}, primary ${p.primary}, accent ${p.accent}, text-on-colour ${p.onColor}. Ensure strong contrast and readable text.`
}

function textRules(langName: string): string {
  return `TEXT RENDERING: render all marketing text as crisp, correctly spelled ${langName} with correct diacritics, spelled EXACTLY as given. Bold clean typography. Do NOT add any text beyond what is specified, and NONE inside the form safe zone.`
}

function identityBlock(d: ProductDirection): string {
  return `PRODUCT: ${d.productLabel}. Replicate the product EXACTLY from the reference photo(s) — same colour, shape, label, packaging, brand text. Do NOT redesign or reinterpret it.`
}

function variantBlock(i: number): string {
  return i === 0
    ? `COMPOSITION: balanced, primary hero layout (variation A).`
    : `COMPOSITION: a noticeably DIFFERENT arrangement from variation A (reposition hero/badges/decor) while keeping the SAME style, palette and identical text (variation B).`
}

export function buildFormBgPrompt(params: BuildFormBgPromptParams): string {
  const { preset, direction: d, hasGift, lang, variantIndex } = params
  const langName = langDisplayName(lang)
  const shared = [identityBlock(d), paletteBlock(d), textRules(langName), variantBlock(variantIndex)]

  if (preset === 'editorial') {
    const copy = [
      `Masthead kicker (small, top): ${q(lang === 'vi' ? 'SỐNG KHỎE · SỐ ĐẶC BIỆT' : 'SIHAT · EDISI KHAS')}`,
      `Big serif headline: ${q(d.headline)}`,
      `Sub-headline: ${q(d.subhead)}`,
      `Expert seal/stamp: ${q(expertSeal(lang))}`,
      d.testimonial ? `One testimonial quote with name: ${q(d.testimonial)}` : '',
      `Trust line near bottom: ${q(d.trust)}`,
    ].filter(Boolean)
    return [
      `TASK: Design a TALL PORTRAIT (2:3) ORDER-FORM BACKGROUND in a premium HEALTH-MAGAZINE EDITORIAL style. Looks like a trustworthy magazine feature, NOT a loud sale flyer.`,
      `LAYOUT: top = magazine masthead bar + big serif headline + a clean studio shot of the product + a circular "expert recommended" seal. Middle = the EMPTY form panel. Bottom = a refined trust line + a short testimonial. Sophisticated, lots of whitespace, paper-like background.`,
      ...shared,
      FORM_SAFE_ZONE,
      `TEXT TO RENDER (outside the form zone only):`,
      ...copy.map((c) => `  - ${c}`),
    ].join('\n\n')
  }

  if (preset === 'abundance') {
    const copy = [
      `Top ribbon banner headline: ${q(d.headline)}`,
      `Sub line: ${q(d.subhead)}`,
      hasGift ? `Free-gift badge on the gift: ${q(freeGiftBadge(lang))}` : '',
      d.giftTeaser ? `Gift teaser line: ${q(d.giftTeaser)}` : '',
      `Scarcity badge: ${q(d.scarcity)}`,
      `Trust line near bottom: ${q(d.trust)}`,
    ].filter(Boolean)
    return [
      `TASK: Design a TALL PORTRAIT (2:3) ORDER-FORM BACKGROUND in a warm, generous BUNDLE / VALUE-STACK style — makes the shopper feel they get a LOT. Festive but designed (not clip-art).`,
      `LAYOUT: top = a colourful ribbon banner + an abundant flat-lay cluster of the PRODUCT (several units)${hasGift ? ' together with the FREE BONUS GIFT' : ''} + glossy badges/tags. Middle = the EMPTY form panel (warm cream card). Bottom = a bold value/trust strip.`,
      ...shared,
      hasGift ? `BONUS GIFT: replicate the gift from its reference photo exactly; show it clearly as a free bonus beside the product.` : '',
      FORM_SAFE_ZONE,
      `TEXT TO RENDER (outside the form zone only):`,
      ...copy.map((c) => `  - ${c}`),
    ].filter(Boolean).join('\n\n')
  }

  // transformation
  const [before, after] = beforeAfterWords(lang)
  const copy = [
    `Left panel label: ${q(before)}`,
    `Right panel label: ${q(after)}`,
    `Headline band: ${q(d.headline)}`,
    `Sub line: ${q(d.subhead)}`,
    `Scarcity badge: ${q(d.scarcity)}`,
    `Trust line near bottom: ${q(d.trust)}`,
  ]
  return [
    `TASK: Design a TALL PORTRAIT (2:3) ORDER-FORM BACKGROUND in a BEFORE→AFTER TRANSFORMATION style. The result/proof is the hook.`,
    `LAYOUT: top = a split scene — left half "${before}" (dull, desaturated, the problem) and right half "${after}" (bright, vivid, the result), with a clear transformation arrow between, and the PRODUCT as the bridge. Middle = the EMPTY form panel. Bottom = a confident result + trust strip.`,
    ...shared,
    FORM_SAFE_ZONE,
    `TEXT TO RENDER (outside the form zone only):`,
    ...copy.map((c) => `  - ${c}`),
  ].join('\n\n')
}
