// giftPromptBuilder — dựng prompt cho 3 ảnh quà (banner / combo / info).
//
// Full-AI, chữ NƯỚNG trong ảnh (no canvas) — pipeline gpt-4o-image proven.
// Cả 3 ảnh là INFOGRAPHIC THIẾT KẾ giàu chữ/FOMO/WOW (không phải "ảnh SP +
// 1 caption"). Combo port nguyên layout `combo-vertical` của super-ladipage
// (đã rated đẹp): tier xếp chồng, badge, price block gạch + JIMAT, màu tier,
// + THÊM món quà tặng kèm ở mỗi tier.
//
//   • Khoá identity: tái hiện ĐÚNG sản phẩm + ĐÚNG món quà từ ảnh tham chiếu.
//   • Nướng chữ ĐÚNG ngôn ngữ đích (chuỗi cố định localize + văn Gemini).
//   • STRICT giá/label EXACTLY từ tier input — KHÔNG bịa offer/giá.

import type { Product } from '../../../stores/types'
import type { Market, GiftBenefits, GiftImageKind, GiftTier, GiftItem } from '../types'
import { computeTierPricing, giftSetValue } from '../types'
import { giftLabels, TIER_CORNER_BADGES, TIER_COLORS } from '../labels'

export interface BuildGiftPromptParams {
  kind: GiftImageKind
  product: Product
  /** DANH SÁCH quà (1..3). Bộ quà dùng chung mọi tier. */
  gifts: GiftItem[]
  tiers: GiftTier[]
  benefits: GiftBenefits
  lang: Market
  /** Mode COMBO GIÁ: KHÔNG có quà tặng — mọi đơn vị là SP CHÍNH; mỗi tier có badge ship. */
  noGift?: boolean
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

/** Khối nhận diện chung — bám ảnh tham chiếu, cấm drift (product-fidelity). */
function identityBlock(product: Product, lang: Market): string {
  const name = displayProductName(product, lang)
  const visual = (product.visualBrief ?? '').trim()
  return [
    `PRODUCT (the hero you are selling): ${name}.`,
    visual ? `Product appearance to preserve EXACTLY from the reference photos: ${visual}` : '',
    `CRITICAL: replicate the product from the reference images EXACTLY — same color, shape, label, packaging and brand text. Do NOT redesign or reinterpret it.`,
  ].filter(Boolean).join('\n')
}

/** Khối nhận diện quà — bám ảnh quà thật. Hỗ trợ NHIỀU quà (mỗi quà 1 vật riêng). */
function giftsIdentityBlock(names: string[]): string {
  if (names.length <= 1) {
    return [
      `GIFT (the free bonus, a DIFFERENT product given free): ${(names[0] ?? '').trim()}.`,
      `Replicate the gift product from its reference photo EXACTLY — same color, shape and form. Do NOT invent a different object.`,
    ].join('\n')
  }
  return [
    `GIFTS — ${names.length} DIFFERENT free bonus products given TOGETHER: ${names.map((n, i) => `${i + 1}) ${n.trim()}`).join('; ')}.`,
    `Each gift is a SEPARATE object with its OWN reference photo (order matches). Replicate EACH EXACTLY (color/shape/form). Do NOT merge them into one, do NOT drop any, do NOT invent extras.`,
  ].join('\n')
}

const STYLE =
  `STYLE: premium Malaysian e-commerce / TikTok-Shop promo INFOGRAPHIC. Designer-grade layout, ` +
  `bold modern sans-serif, strong visual hierarchy, vivid high-contrast colors, glossy badges, ` +
  `starbursts and ribbons for emphasis, generous but tidy spacing so every text is crisp and readable. ` +
  `Looks like a high-converting paid-ad creative. No watermark.`

/** Hướng dẫn render chữ — ép chính tả ngôn ngữ đích, gọn, dễ đọc. */
function textRenderRules(langName: string): string {
  return (
    `TEXT RENDERING — render ALL text INTO the image as crisp, correctly spelled ${langName}. ` +
    `Spell every word EXACTLY as written, with correct diacritics. Bold clean sans-serif, large and legible. ` +
    `Do NOT add any other text, numbers or currency you were not given.`
  )
}

/** Lớp copy bán hàng (wow / FOMO / value) — nướng vào mọi ảnh. */
function salesCopyBlock(b: GiftBenefits, valueText: string): string {
  const lines = [
    `WOW hook: ${quote(b.wowHook)}`,
    valueText ? `Gift value, big & bold (starburst): ${quote(valueText)}` : '',
    b.valueLine ? `Value emphasis: ${quote(b.valueLine)}` : '',
    b.fomoLines.length ? `Urgency / FOMO badges: ${b.fomoLines.map(quote).join(', ')}` : '',
  ].filter(Boolean)
  return `SALES COPY TO RENDER (make these visually punchy — bursts/ribbons/contrasting color):\n` +
    lines.map((l) => `  - ${l}`).join('\n')
}

export function buildGiftPrompt(params: BuildGiftPromptParams): string {
  const { kind, product, gifts, tiers, benefits, lang } = params
  const L = giftLabels(lang)
  const setValue = giftSetValue(gifts)                        // tổng trị giá BỘ quà
  const valueText = setValue > 0 ? L.valueLabel(setValue) : ''
  // Tên TỪNG quà render trong ảnh = bản ĐÃ DỊCH (fallback tên thô), theo thứ tự gifts[].
  const giftNames = gifts.map((g, i) => (benefits.giftNamesLocalized[i] || g.name).trim()).filter(Boolean)
  const nGifts = giftNames.length
  const giftListText = giftNames.join(' + ')
  // Mode Combo giá: bỏ khối nhận diện quà (không có SP thứ 2).
  const head = [
    identityBlock(product, lang),
    params.noGift ? '' : giftsIdentityBlock(giftNames),
    STYLE,
    textRenderRules(L.langName),
  ].filter(Boolean)

  // Tier rẻ nhất (primary) cho banner.
  const primary = tiers[0]

  if (kind === 'banner') {
    const dealLine = primary
      ? `Primary deal: ${quote(L.mainDealLabel(primary.buyMainQty, primary.freeMainQty))} — price ${quote(`RM${primary.price}`)}`
      : ''
    const texts = [
      `Big top headline: ${quote(L.bannerCta)}`,
      dealLine,
      `Free-gift badge near the gifts: ${quote(L.freeGiftBadge)}`,
      nGifts > 0 ? `Gift name caption (${nGifts === 1 ? 'the gift' : `all ${nGifts} gifts`}): ${quote(giftListText)}` : '',
    ].filter(Boolean)
    return [
      `TASK: Design a WIDE high-impact promo BANNER (landscape) for a Malaysian COD landing page.`,
      `LAYOUT: the PRODUCT is the large hero on one side; ${nGifts > 1 ? `ALL ${nGifts} GIFTS appear grouped together` : `the GIFT appears`} prominently beside it with a glossy "free gift" badge + a BIG starburst showing the total value, so a shopper instantly feels "buy product, get ${nGifts > 1 ? 'these valuable gifts' : 'this valuable gift'} FREE". Punchy, ad-creative look.`,
      ...head,
      salesCopyBlock(benefits, valueText),
      `OTHER TEXT TO RENDER:`,
      ...texts.map((t) => `  - ${t}`),
      `STRICT: prices + deal label EXACTLY as given. No invented offers.`,
    ].join('\n\n')
  }

  if (kind === 'combo') {
    const noGift = !!params.noGift
    const dealsList = tiers.map((t, i) => {
      const p = computeTierPricing(t, setValue)
      const corner = TIER_CORNER_BADGES[i] || ''
      const color = TIER_COLORS[i] || TIER_COLORS[TIER_COLORS.length - 1]
      // Bộ quà (mode A dùng chung mọi mốc): mỗi mốc tặng cả bộ × số-bộ (giftQty).
      const setLabel = giftNames.map((g) => (t.giftQty > 1 ? `${t.giftQty}× ${g}` : g)).join(' + ')
      const bonusBlock = noGift
        ? (t.shippingNote?.trim() ? `shipping badge=${quote(t.shippingNote.trim())} (small pill, freeship=green / paid=orange)` : '')
        : (t.giftQty > 0 && nGifts > 0
          ? `FREE GIFTS (show ALL ${nGifts} gift${nGifts > 1 ? 's grouped together' : ''})=${quote(setLabel)} with tag ${quote(L.freeGiftBadge)}${p.giftTotalValue > 0 ? ` + total value ${quote(L.valueLabel(p.giftTotalValue))}` : ''}`
          : `NO bonus gift in this tier (do NOT show a gift here)`)
      const mockup = noGift
        ? `product mockup=${p.totalMainUnits} unit(s) of the SAME main product (buy ${t.buyMainQty} + get ${t.freeMainQty} more, ALL identical to reference)`
        : `product mockup=${p.totalMainUnits} unit(s) (buy ${t.buyMainQty} + free ${t.freeMainQty})`
      const parts = [
        `Tier ${i + 1}: package badge=${quote(L.packageBadge(i + 1))}`,
        `color theme=${color}${corner ? `, corner badge=${quote(corner)}` : ''}`,
        `main deal label=${quote(L.mainDealLabel(t.buyMainQty, t.freeMainQty))}`,
        mockup,
        `sale price=${quote(`RM${t.price}`)}`,
        p.jimat > 0 ? `original price (strikethrough)=${quote(`RM${p.originalPrice}`)}` : '',
        p.jimat > 0 ? `savings=${quote(L.savingsLabel(p.jimat))}` : '',
        bonusBlock,
      ].filter(Boolean)
      return '  ' + parts.join(', ')
    }).join('\n')

    const layout = noGift
      ? `LAYOUT (COMBO VERTICAL): Bold title at top: ${quote(L.comboTitle)}. Then stack each tier as its own colored block. Each tier block contains: the package badge, the product mockup (N identical units of the SAME product = tier quantity, SHAPE LOCK to reference), the deal label, a price block (original price struck through → big highlighted sale price + savings burst), AND a small shipping badge. NO gift, NO second product — only the main product bundles. Color-code tiers distinctly; add the corner badges.`
      : `LAYOUT (COMBO VERTICAL): Bold title at top: ${quote(L.comboTitle)}. Then stack each tier as its own colored block. Each tier block contains: the package badge, the product mockup (N units = tier quantity, SHAPE LOCK identical to reference), the deal label, a price block (original price struck through → big highlighted sale price + savings burst), AND the FREE GIFT${nGifts > 1 ? `S — show ALL ${nGifts} different gifts grouped together as one bonus cluster` : ''} shown as bonus item(s) with a "free gift" badge + total value. Color-code tiers distinctly; add the corner badges. Make the FREE GIFT${nGifts > 1 ? 'S' : ''} visually obvious in every tier.`

    return [
      `TASK: Design a TALL PORTRAIT (9:16) COMBO PRICING INFOGRAPHIC — a Malaysian COD offer poster stacking ALL tiers vertically. This must look like a polished, high-converting deal poster.`,
      layout,
      ...head,
      `MULTI-PRODUCT: all product units across tiers must match the SAME reference — identical label, shape, color; just scale the count per tier.`,
      salesCopyBlock(benefits, valueText),
      `FULL DEALS LIST (render ALL tiers below, each as a separate vertical block, data EXACTLY as given):\n${dealsList}`,
      `STRICT: all tier prices, savings, deal labels${noGift ? ' and shipping notes' : ' and gift counts'} EXACTLY from the list above. Each tier distinct + readable. No invented numbers.`,
    ].join('\n\n')
  }

  // kind === 'info' — thẻ thông tin quà (quà là hero). NHIỀU quà → gộp CẢ BỘ vào 1 thẻ.
  const bulletText = benefits.bullets.map((b) => `      • ${quote(b)}`).join('\n')
  const texts = [
    `Card title: ${quote(L.giftInfoTitle)}`,
    nGifts > 1
      ? `Gift set — list ALL ${nGifts} gift names, each with a small "${L.free}" tag: ${quote(giftListText)}`
      : `Gift name headline: ${quote(benefits.headline)}`,
    valueText ? `Big TOTAL value tag (starburst): ${quote(valueText)} + ${quote(L.free)}` : `Free tag: ${quote(L.free)}`,
    `Benefit bullet points:`,
  ]
  return [
    `TASK: Design a clean, premium GIFT-INFO card (portrait) that explains WHAT the free ${nGifts > 1 ? 'gifts are' : 'gift is'} and WHY they are valuable — make the buyer feel they'd regret missing out.`,
    nGifts > 1
      ? `LAYOUT: ALL ${nGifts} GIFT products shown TOGETHER as the hero cluster in the upper area (each clearly a separate item, shape-locked to its reference); below, a tidy info panel with the title, the gift names, a BIG TOTAL value starburst, 2-3 short benefit bullets, and a FOMO ribbon. Designer infographic look.`
      : `LAYOUT: the GIFT product is the large hero in the upper area; below it a tidy info panel with the title, name, a BIG value starburst, 2-3 short benefit bullets, and a FOMO ribbon. Designer infographic look.`,
    ...head,
    salesCopyBlock(benefits, valueText),
    `OTHER TEXT TO RENDER:`,
    ...texts.map((t) => `  - ${t}`),
    bulletText,
    `STRICT: render only the text given. No invented prices.`,
  ].join('\n\n')
}
