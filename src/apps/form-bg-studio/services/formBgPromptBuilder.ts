// formBgPromptBuilder — dựng prompt gpt-4o-image cho từng DẢI (header/footer)
// của ảnh nền form, theo preset.
//
// Bất biến: (1) giữ identity SP/quà từ ref, (2) NHÚNG palette AI trích, (3)
// chữ đúng ngôn ngữ, (4) — QUAN TRỌNG — mép trong của dải là MÀU NỀN PHẲNG
// (palette.bg) để hoà liền với khu form, KHÔNG vẽ ô input/nút/field.
// Có quà → MỌI preset đều nhúng quà + badge. 2 biến thể khác bố cục.

import type { Market, FormBgPreset, ProductDirection, StripKind } from '../types'
import { langDisplayName, freeGiftBadge } from '../labels'

export interface BuildFormBgPromptParams {
  kind: StripKind
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

function paletteBlock(d: ProductDirection): string {
  const p = d.palette
  return `COLOUR PALETTE (anchored to the real product): background ${p.bg}, primary ${p.primary}, accent ${p.accent}, text-on-colour ${p.onColor}. Strong contrast, readable text.`
}

function textRules(langName: string): string {
  return `TEXT RENDERING: render all text as crisp, correctly spelled ${langName} with correct diacritics, spelled EXACTLY as given. Bold clean typography. Render ONLY the text specified.`
}

function identityBlock(d: ProductDirection): string {
  return `PRODUCT: ${d.productLabel}. Replicate the product EXACTLY from the reference photo(s) — same colour, shape, label, packaging, brand text. Do NOT redesign.`
}

function giftBlock(hasGift: boolean, lang: Market): string {
  return hasGift
    ? `BONUS GIFT: also show the FREE BONUS GIFT (replicate exactly from its reference photo) with a small glossy ${q(freeGiftBadge(lang))} badge.`
    : ''
}

function variantBlock(i: number): string {
  return i === 0
    ? `COMPOSITION: balanced primary layout (variation A).`
    : `COMPOSITION: a noticeably DIFFERENT arrangement from variation A (reposition hero/badges/decor) while keeping the SAME style, palette and identical text (variation B).`
}

/** Mép hoà với khu form — chìa khoá để 2 dải ghép liền với nền section. */
function blendEdge(kind: StripKind, bg: string): string {
  return kind === 'header'
    ? `FORMAT: a WIDE horizontal TOP banner strip. The content sits in the upper part. The ENTIRE BOTTOM EDGE must be a clean SOLID ${bg} band with NOTHING on it, so it blends seamlessly into a plain form area placed below. Absolutely NO input fields, NO buttons, NO form of any kind.`
    : `FORMAT: a WIDE horizontal BOTTOM strip. The ENTIRE TOP EDGE must be a clean SOLID ${bg} band with NOTHING on it, so it blends seamlessly from a plain form area placed above. Content sits in the lower part. Absolutely NO input fields, NO buttons, NO form of any kind.`
}

export function buildFormBgPrompt(params: BuildFormBgPromptParams): string {
  const { kind, preset, direction: d, hasGift, lang, variantIndex } = params
  const langName = langDisplayName(lang)
  const bg = d.palette.bg
  const shared = [identityBlock(d), paletteBlock(d), textRules(langName), variantBlock(variantIndex), blendEdge(kind, bg)]

  // ── HEADER ───────────────────────────────────────────────────────────
  if (kind === 'header') {
    if (preset === 'editorial') {
      const copy = [
        `Masthead kicker (small, very top): ${q(lang === 'vi' ? 'SỐNG KHỎE · SỐ ĐẶC BIỆT' : 'SIHAT · EDISI KHAS')}`,
        `Big serif headline: ${q(d.headline)}`,
        `Sub-headline: ${q(d.subhead)}`,
        `Expert seal/stamp: ${q(expertSeal(lang))}`,
      ]
      return [
        `TASK: Design the TOP banner of an order-form background in a premium HEALTH-MAGAZINE EDITORIAL style (trustworthy, not a loud sale flyer).`,
        `LAYOUT: magazine masthead bar + big serif headline + a clean studio shot of the product + a circular "expert recommended" seal. Refined, paper-like.`,
        ...shared, giftBlock(hasGift, lang),
        `TEXT TO RENDER:`, ...copy.map((c) => `  - ${c}`),
      ].filter(Boolean).join('\n\n')
    }
    if (preset === 'abundance') {
      const copy = [
        `Top ribbon banner headline: ${q(d.headline)}`,
        `Sub line: ${q(d.subhead)}`,
        `Scarcity badge: ${q(d.scarcity)}`,
        d.giftTeaser ? `Gift teaser: ${q(d.giftTeaser)}` : '',
      ].filter(Boolean)
      return [
        `TASK: Design the TOP banner of an order-form background in a warm, generous BUNDLE / VALUE-STACK style (makes shopper feel they get a LOT). Festive but designed.`,
        `LAYOUT: colourful ribbon banner + an abundant flat-lay cluster of the PRODUCT (several units)${hasGift ? ' together with the FREE BONUS GIFT' : ''} + glossy badges/tags.`,
        ...shared, giftBlock(hasGift, lang),
        `TEXT TO RENDER:`, ...copy.map((c) => `  - ${c}`),
      ].filter(Boolean).join('\n\n')
    }
    // transformation
    const [before, after] = beforeAfterWords(lang)
    const copy = [
      `Left panel label: ${q(before)}`,
      `Right panel label: ${q(after)}`,
      `Headline band: ${q(d.headline)}`,
      `Sub line: ${q(d.subhead)}`,
    ]
    return [
      `TASK: Design the TOP banner of an order-form background in a BEFORE→AFTER TRANSFORMATION style (the result/proof is the hook).`,
      `LAYOUT: split scene — left half "${before}" (dull, the problem) and right half "${after}" (bright, the result) with a transformation arrow between, and the PRODUCT as the bridge.`,
      ...shared, giftBlock(hasGift, lang),
      `TEXT TO RENDER:`, ...copy.map((c) => `  - ${c}`),
    ].filter(Boolean).join('\n\n')
  }

  // ── FOOTER ───────────────────────────────────────────────────────────
  if (preset === 'editorial') {
    const copy = [
      `Trust line: ${q(d.trust)}`,
      d.testimonial ? `One testimonial quote with a believable Malay name + city: ${q(d.testimonial)}` : '',
    ].filter(Boolean)
    return [
      `TASK: Design the BOTTOM strip of an order-form background, EDITORIAL style — refined trust + a customer testimonial.`,
      ...shared,
      `TEXT TO RENDER:`, ...copy.map((c) => `  - ${c}`),
    ].join('\n\n')
  }
  if (preset === 'abundance') {
    const copy = [
      `Bold value/trust line: ${q(d.trust)}`,
      `Scarcity line: ${q(d.scarcity)}`,
    ]
    return [
      `TASK: Design the BOTTOM strip of an order-form background, ABUNDANCE style — a bold value + trust strip with a guarantee/COD feel.`,
      ...shared,
      `TEXT TO RENDER:`, ...copy.map((c) => `  - ${c}`),
    ].join('\n\n')
  }
  // transformation footer
  const copy = [
    `Confident result line: ${q(d.subhead)}`,
    `Trust line: ${q(d.trust)}`,
  ]
  return [
    `TASK: Design the BOTTOM strip of an order-form background, TRANSFORMATION style — a confident result + trust strip.`,
    ...shared,
    `TEXT TO RENDER:`, ...copy.map((c) => `  - ${c}`),
  ].join('\n\n')
}
