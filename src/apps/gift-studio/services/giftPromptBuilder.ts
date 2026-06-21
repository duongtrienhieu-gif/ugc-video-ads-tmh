// giftPromptBuilder — dựng prompt cho 3 ảnh quà (banner / combo / info).
//
// Full-AI, chữ NƯỚNG trong ảnh (no canvas) — đúng pipeline gpt-4o-image đã
// proven ở TikTok Shop / Super Ladipage. Mỗi prompt:
//   • Khoá identity: tái hiện ĐÚNG sản phẩm + ĐÚNG món quà từ ảnh tham chiếu.
//   • Nướng chữ ĐÚNG ngôn ngữ đích (chuỗi cố định localize sẵn + văn Gemini).
//   • KHÔNG bịa giá: chỉ dùng giá trị quà (user nhập) + offer sản phẩm (nếu có).
//
// Refs (ảnh tham chiếu) do generateGiftImage truyền riêng; builder chỉ lo CHỮ
// + bố cục. Thứ tự ref theo từng kind cũng do generateGiftImage quyết.

import type { Product } from '../../../stores/types'
import type { Market, GiftBenefits, GiftImageKind } from '../types'
import { giftLabels } from '../labels'

export interface BuildGiftPromptParams {
  kind: GiftImageKind
  product: Product
  giftName: string
  giftValueRM: number | null
  benefits: GiftBenefits
  lang: Market
  /** Số ảnh tham chiếu sản phẩm sẽ kèm (để câu chữ prompt khớp). */
  hasGiftRef: boolean
}

/** Tên SP dùng trong ảnh: ưu tiên localizedName đúng lang, fallback productName. */
function displayProductName(product: Product, lang: Market): string {
  if (product.localizedName && product.localizedNameLang === lang) {
    return product.localizedName.trim()
  }
  return product.productName.trim()
}

function quote(s: string): string {
  return `"${s.replace(/"/g, "'").trim()}"`
}

/** Khối nhận diện chung — bám ảnh tham chiếu, cấm drift (per product-fidelity). */
function identityBlock(product: Product, lang: Market): string {
  const name = displayProductName(product, lang)
  const visual = (product.visualBrief ?? '').trim()
  return [
    `PRODUCT (the hero you are selling): ${name}.`,
    visual ? `Product appearance to preserve EXACTLY from the reference photos: ${visual}` : '',
    `CRITICAL: replicate the product from the reference images EXACTLY — same color, shape, label, packaging and brand text. Do NOT redesign or reinterpret it.`,
  ].filter(Boolean).join('\n')
}

/** Khối nhận diện quà — bám ảnh quà thật. */
function giftIdentityBlock(giftName: string): string {
  return [
    `GIFT (the free bonus): ${giftName.trim()}.`,
    `Replicate the gift product from its reference photo EXACTLY — same color, shape and form. Do NOT invent a different object.`,
  ].join('\n')
}

const STYLE =
  `STYLE: clean modern e-commerce / TikTok-Shop promo aesthetic, bright even studio lighting, ` +
  `crisp focus, high contrast so text is readable, professional commercial look. ` +
  `Solid or soft-gradient background. No watermark, no logo unless present in references.`

/** Hướng dẫn render chữ — ép chính tả ngôn ngữ đích, gọn, dễ đọc. */
function textRenderRules(langName: string): string {
  return (
    `TEXT RENDERING — render the following text INTO the image as crisp, correctly spelled ${langName}. ` +
    `Spell every word EXACTLY as written, with correct diacritics. Use bold clean sans-serif. ` +
    `Keep text minimal, large and legible. Do NOT add any other text, numbers or currency you were not given.`
  )
}

export function buildGiftPrompt(params: BuildGiftPromptParams): string {
  const { kind, product, giftName, giftValueRM, benefits, lang } = params
  const L = giftLabels(lang)
  const valueText = giftValueRM != null ? L.valueLabel(giftValueRM) : ''
  const offer = (product.offer ?? '').trim()

  const head = [identityBlock(product, lang), giftIdentityBlock(giftName), STYLE, textRenderRules(L.langName)]

  if (kind === 'banner') {
    const texts = [
      `Big headline: ${quote(L.bannerCta)}`,
      `Small badge near the gift: ${quote(L.freeGiftBadge)}`,
      `Gift caption: ${quote(benefits.headline)}`,
    ]
    return [
      `TASK: Design a WIDE promotional BANNER (landscape) for a COD landing page.`,
      `LAYOUT: the PRODUCT is the large hero on one side; the GIFT appears smaller beside/below it with a clear "free gift" badge, so a shopper instantly sees "buy product, get this gift free".`,
      ...head,
      `TEXT TO RENDER (only these):`,
      ...texts.map((t) => `  - ${t}`),
    ].join('\n')
  }

  if (kind === 'combo') {
    const texts = [
      `Label: ${quote(L.comboLabel)}`,
      `Gift badge: ${quote(L.freeGiftBadge)}`,
      valueText ? `Gift value tag on the gift: ${quote(valueText)}` : '',
      offer ? `Offer line: ${quote(offer)}` : '',
    ].filter(Boolean)
    return [
      `TASK: Design a COMBO / bundle packshot showing the PRODUCT and the GIFT together as one money-saving deal.`,
      `LAYOUT: product and gift arranged together like a bundle (flat-lay or side-by-side packshot). Make the gift visibly a "bonus" via the badge + value tag.`,
      ...head,
      `TEXT TO RENDER (only these):`,
      ...texts.map((t) => `  - ${t}`),
    ].join('\n')
  }

  // kind === 'info' — thẻ thông tin quà (quà là hero)
  const bulletText = benefits.bullets.map((b) => `      • ${quote(b)}`).join('\n')
  const texts = [
    `Card title: ${quote(L.giftInfoTitle)}`,
    `Gift name headline: ${quote(benefits.headline)}`,
    valueText ? `Value tag: ${quote(valueText)} + ${quote(L.free)}` : `Free tag: ${quote(L.free)}`,
    `Benefit bullet points:`,
  ]
  return [
    `TASK: Design a clean GIFT-INFO card (portrait) that explains WHAT the free gift is and WHY it is useful.`,
    `LAYOUT: the GIFT product is the large hero in the upper area; below it a tidy info panel with the title, name, value tag and 2-3 short benefit bullets. This card must make the gift feel valuable and clearly understood.`,
    ...head,
    `TEXT TO RENDER (only these):`,
    ...texts.map((t) => `  - ${t}`),
    bulletText,
  ].join('\n')
}
