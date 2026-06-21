// formBgPromptBuilder — dựng prompt gpt-4o-image cho 1 ẢNH NỀN form đầy đủ:
//   (1) header banner  (2) dải FOMO + Ô TRỐNG đồng hồ  (3) khu form trống
//   (nền phẳng palette.bg)  (4) footer trust.
// User tự cắt header/footer, set nền section = palette.bg, nhét đồng hồ + form
// vào 2 ô trống.
//
// Bất biến: identity lock (chống drift), palette AI trích, chữ đúng ngôn ngữ,
// quà cho MỌI preset khi có. 2 reserved zones (đồng hồ + form) KHÔNG vẽ gì.

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

function identityBlock(d: ProductDirection): string {
  return `PRODUCT IDENTITY LOCK (HIGHEST PRIORITY — overrides styling): the product is ${d.productLabel}. ` +
    `Reproduce it 100% IDENTICAL to the reference photo: exact packaging shape, exact colours, exact logo, and ALL printed label text COPIED character-for-character. ` +
    `Do NOT rotate, redesign, restyle, re-letter, translate, blur, or invent any text/graphic on the packaging. Show it from an angle close to the reference. ` +
    `It must read as the SAME real product photographed, NOT an AI redraw. Do NOT add any extra/unbranded product not in the references.`
}

function giftBlock(hasGift: boolean, lang: Market): string {
  return hasGift
    ? `SEPARATE BONUS GIFT: the LAST reference image is a DIFFERENT bonus product. Reproduce it faithfully, kept VISUALLY DISTINCT from the main product — do NOT merge/blend the two products' shapes, colours, labels or text. Place a small glossy ${q(freeGiftBadge(lang))} badge near it.`
    : ''
}

function paletteBlock(d: ProductDirection): string {
  const p = d.palette
  return `COLOUR PALETTE (anchored to the real product): background ${p.bg}, primary ${p.primary}, accent ${p.accent}, text-on-colour ${p.onColor}. Strong contrast, readable.`
}

function textRules(langName: string): string {
  return `TEXT RENDERING: render all text as crisp, correctly spelled ${langName} with correct diacritics, spelled EXACTLY as given. Bold clean typography. Render ONLY the text specified; NOTHING in the two reserved empty areas.`
}

function variantBlock(i: number): string {
  return i === 0
    ? `COMPOSITION: balanced primary layout (variation A).`
    : `COMPOSITION: a noticeably DIFFERENT arrangement from variation A — reposition the hero/badges/decor (variation B). Keep the same headline, style and palette; the urgency lines provided already differ between variants.`
}

function headerLayout(preset: FormBgPreset, d: ProductDirection, lang: Market, hasGift: boolean): string {
  if (preset === 'editorial') {
    return `HEADER (top): premium HEALTH-MAGAZINE EDITORIAL look (trustworthy, not a loud flyer). A magazine masthead kicker ${q(lang === 'vi' ? 'SỐNG KHỎE · SỐ ĐẶC BIỆT' : 'SIHAT · EDISI KHAS')}, a big SERIF headline ${q(d.headline)}, sub-headline ${q(d.subhead)}, a clean studio shot of the product${hasGift ? ' plus the bonus gift' : ''}, and a circular expert seal ${q(expertSeal(lang))}.`
  }
  if (preset === 'abundance') {
    return `HEADER (top): warm generous BUNDLE / VALUE-STACK look. A colourful ribbon banner with headline ${q(d.headline)} + sub ${q(d.subhead)}, an abundant cluster of the PRODUCT (several units)${hasGift ? ' together with the FREE BONUS GIFT' : ''} and glossy badges; a scarcity badge ${q(d.scarcity)}.`
  }
  const [before, after] = beforeAfterWords(lang)
  return `HEADER (top): BEFORE→AFTER TRANSFORMATION. A split scene — left half labelled ${q(before)} (dull, the problem) and right half labelled ${q(after)} (bright, the result) with a transformation arrow between, the PRODUCT${hasGift ? ' + bonus gift' : ''} as the bridge; a headline band ${q(d.headline)} and sub ${q(d.subhead)}.`
}

function footerLayout(preset: FormBgPreset, d: ProductDirection): string {
  if (preset === 'editorial') {
    return `FOOTER (bottom): a refined trust line ${q(d.trust)}${d.testimonial ? ` and one customer testimonial with a believable Malay name + city ${q(d.testimonial)}` : ''}.`
  }
  if (preset === 'abundance') {
    return `FOOTER (bottom): a bold value + trust strip ${q(d.trust)} with a guarantee/COD feel.`
  }
  return `FOOTER (bottom): a confident result + trust strip ${q(d.trust)}.`
}

export function buildFormBgPrompt(params: BuildFormBgPromptParams): string {
  const { preset, direction: d, hasGift, lang, variantIndex } = params
  const langName = langDisplayName(lang)
  const bg = d.palette.bg

  // Pool FOMO → mỗi biến thể lấy 2 dòng KHÁC nhau (chống "y chang").
  const pool = (d.fomoLines && d.fomoLines.length ? d.fomoLines : [d.scarcity]).filter(Boolean)
  const picked = [pool[(variantIndex * 2) % pool.length], pool[(variantIndex * 2 + 1) % pool.length]]
    .filter((v, i, a) => v && a.indexOf(v) === i)
  const fomoLinesText = picked.map(q).join(' and ')

  return [
    `TASK: Design ONE TALL PORTRAIT (2:3) order-form BACKGROUND, stacked top-to-bottom: (1) header banner, (2) an urgency FOMO band containing an EMPTY countdown slot, (3) a LARGE EMPTY form area, (4) footer. High-converting Malaysian COD marketing infographic.`,
    headerLayout(preset, d, lang, hasGift),
    `FOMO BAND (directly below header): a bold urgency strip in the accent colour. Top label ${q(d.fomoTitle)}. ` +
      `Then a RESERVED EMPTY countdown SLOT — make it NARROW in width (centred, about 55% of the strip width, NOT full-width) and TALL in height (generous, about twice a text line). Leave it COMPLETELY EMPTY: render NO clock, NO numbers, NO digits, NO boxes, NO text inside it (a real countdown widget is overlaid there later). ` +
      `Below the slot, show these ${picked.length} DISTINCT urgency lines (each visually punchy): ${fomoLinesText}.`,
    `FORM SAFE ZONE (below the FOMO band): a LARGE area (~40% of the height) that is a FLAT SOLID ${bg} colour, COMPLETELY EMPTY — no card, no border, no fields, no buttons, no icons, no text. One uniform solid colour so it crops cleanly into a form area.`,
    footerLayout(preset, d),
    identityBlock(d),
    giftBlock(hasGift, lang),
    paletteBlock(d),
    textRules(langName),
    variantBlock(variantIndex),
    `STRICT: render only the specified marketing text. The TWO reserved areas (countdown slot + form area) MUST contain absolutely nothing.`,
  ].filter(Boolean).join('\n\n')
}
