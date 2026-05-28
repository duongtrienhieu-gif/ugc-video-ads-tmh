// Prompt builder for gpt-4o-image (TRUE i2i editing via filesUrl).
//
// PHASE 8 — All slot text is now DYNAMIC, sourced from ctx.slotTexts (which
// the description AI generates per product). Hardcoded teeth/whitening text
// was removed because it leaked into unrelated products (nasal spray etc.)
// when users tested other niches. Fallback: derive from product fields.

import type { ResolvedBrandKit, Market } from '../../../types/brandKit'
import type { Product } from '../../../stores/types'
import type { SlotConfig, PaletteFamily, SlotTexts, TiktokShopProductBrief } from '../types'
import { TPCN_PALETTES } from '../constants'

export interface PromptContext {
  brandKit: ResolvedBrandKit
  product: Product
  slotConfig: SlotConfig
  paletteFamily: PaletteFamily
  language: Market
  /** True when brand kit logo URL was prepended to filesUrl (first ref). */
  hasLogoRef: boolean
  /** AI-generated per-slot text from the description gen call. When undefined
   *  (description failed or hadn't run yet), prompts fall back to product
   *  field derivation. */
  slotTexts?: SlotTexts
  /** Phase 10 — Vision-extracted brief, shared across all 9 slots for identity
   *  consistency. When present, the brief block is prepended to each slot prompt
   *  so the AI image generator has the same product understanding everywhere. */
  brief?: TiktokShopProductBrief
}

// ── Shared header — same across every slot ──────────────────────────────

function header(ctx: PromptContext): string {
  const p = TPCN_PALETTES[ctx.paletteFamily]
  const productRefHint = ctx.hasLogoRef
    ? 'Reference 1 = brand logo (render EXACTLY as shown — same shape, same colors, no redraw). References 2+ = product photos.'
    : 'All references are product photos.'
  const langName = ctx.language === 'ms' ? 'Bahasa Malaysia' : 'Vietnamese'
  const marketBadge = ctx.language === 'ms' ? '🇲🇾 MY' : '🇻🇳 VN'

  // Brief block — render compact summary inline so AI has shared product
  // understanding across all 9 slots (mirrors Super Ladipage identity pattern).
  const briefBlock = ctx.brief ? `\nPRODUCT BRIEF (Vision-extracted, READ-ONLY identity lock for all slots):
- Name (exact as on label): "${ctx.brief.productNameExact}"
- Category: ${ctx.brief.productCategory} (subtype: ${ctx.brief.productSubtype})
- Packaging: ${ctx.brief.packagingDescription}
- Primary colors: ${ctx.brief.primaryColors.join(', ')}
- Target customer: ${ctx.brief.targetCustomer.ageRange} ${ctx.brief.targetCustomer.primaryGender} · ${ctx.brief.targetCustomer.dailyContext}
- Transformation: ${ctx.brief.transformationPromise}
- Key edge: ${ctx.brief.keyDifferentiator}
` : ''

  return `1:1 square TikTok Shop image (1024×1024). ${productRefHint}

PRODUCT FIDELITY: Replicate the product EXACTLY from product refs — same color, shape, label, brand name. Do NOT redesign or substitute.${briefBlock}

═══ BRAND SEAL — MANDATORY, IDENTICAL on all 9 slots (universal master spec, no white banner) ═══
- LAYER 1 — LOGO: Render Reference 1 (brand logo) LARGE and CENTERED at the top of the canvas. Logo size ~280px wide × 120px tall, positioned at y≈40-160. NO white box, NO banner background — the logo sits directly on the brand-color gradient. Logo must be preserved EXACTLY from Reference 1 (no redraw, no recoloring, no shape change).
- LAYER 2 — SUBTITLE: Directly below the logo at y≈170-205, render the horizontal text line "Official store | ${marketBadge}" in WHITE Plus Jakarta Sans Medium Italic ~28px. The "|" separator is a thin vertical bar in white at 60% opacity. Center-aligned under the logo.
- LAYER 3 — UNDERLINE: A thin horizontal white line ~140px wide at 50% opacity centered at y≈215, just below the subtitle. Provides clean visual closure.
- DO NOT add the brand kit's store name as a separate text element anywhere — the logo already carries the brand identity; adding text would duplicate it.
- DO NOT enclose the brand seal in any box, banner, or pill background.

LAYOUT: ALL slot content (headlines, product hero, price overlays, decorations) sits BELOW the brand seal — content area starts from y≈240 down to y≈980.

STYLE: Premium e-commerce listing — top-seller aesthetic for this product's category. Saturated brand palette (NOT pastel), polished commercial photography, integrated decorative elements. Plus Jakarta Sans ExtraBold (weight 800-900) for headlines, Medium Italic for sub-text.

PALETTE (use ONLY these): ${p.primary} primary, ${p.secondary} secondary, ${p.cta} accent. High saturation.

BACKGROUND: saturated brand-color gradient + subtle decorative elements (floating particles, soft glow, geometric accents). Balanced, not cluttered. The brand seal sits on top of this gradient with no separating box.

LANGUAGE: ${langName} ONLY in any rendered text (except "Official store" subtitle which stays English as universal e-commerce terminology). NO other language characters.

NO trust bar at bottom — leave clean for visual breathing.`
}

// ── Fallback helpers — derive text from product when slotTexts missing ──

function deriveSlot1(ctx: PromptContext): { headline: string; tagline: string } {
  const name = ctx.product.productName || 'PRODUCT'
  const usps = (ctx.product.usps || '').split(/[\n,;.]/).map((s) => s.trim()).filter(Boolean)
  const headline = (usps[0] || name).toUpperCase().slice(0, 60)
  const tagline = (ctx.product.productDescription || usps[1] || '').slice(0, 80)
  return { headline, tagline }
}

function deriveSlot2(ctx: PromptContext): { question: string; painBullets: string[] } {
  const pains = (ctx.product.painPoints || '').split(/[\n;.]|•/).map((s) => s.trim()).filter(Boolean).slice(0, 3)
  const fallback = ctx.language === 'ms'
    ? { q: `Mempunyai masalah dengan ${ctx.product.productName}?`, b: ['Cari penyelesaian?', 'Tidak puas hati?', 'Mencari yang lebih baik?'] }
    : { q: `Đang gặp vấn đề với ${ctx.product.productName}?`, b: ['Tìm giải pháp?', 'Không hài lòng?', 'Cần lựa chọn tốt hơn?'] }
  return {
    question: pains[0] ? pains[0] : fallback.q,
    painBullets: pains.length >= 3 ? pains : (pains.length > 0 ? pains.concat(fallback.b.slice(pains.length)) : fallback.b),
  }
}

function deriveSlot4(ctx: PromptContext): { title: string; ingredients: Array<{ name: string; pct?: string }>; tagline: string } {
  const title = ctx.language === 'ms' ? 'BAHAN AKTIF' : 'THÀNH PHẦN CHÍNH'
  const tagline = ctx.language === 'ms' ? 'Bahan berkualiti, selamat digunakan' : 'Thành phần chất lượng, an toàn'
  const ings = (ctx.product.ingredients || '').split(/[\n,]/).map((s) => s.trim()).filter(Boolean).slice(0, 5)
  return {
    title,
    ingredients: ings.length > 0 ? ings.map((name) => ({ name })) : [{ name: '(Bổ sung từ Bank Sản phẩm)' }],
    tagline,
  }
}

function deriveSlot8(ctx: PromptContext): { originalPrice?: string; currentPrice: string; discount?: string; combo?: string; cta: string; urgency?: string } {
  const offer = ctx.product.offer || ''
  const ctaText = ctx.language === 'ms' ? 'BELI SEKARANG' : 'MUA NGAY'
  return { currentPrice: offer || '(Giá)', cta: ctaText, urgency: ctx.language === 'ms' ? 'Stok terhad hari ini' : 'Số lượng có hạn' }
}

// ── Per-slot prompts ────────────────────────────────────────────────────

export function buildPromptSlot1(ctx: PromptContext): string {
  const st = ctx.slotTexts?.slot1
  const { headline, tagline } = st ?? deriveSlot1(ctx)
  return `${header(ctx)}

SLOT 1 — HERO HOOK
COMPOSITION: Product on transparent glass PODIUM, centered horizontally, sits in lower-middle area (y≈460-820), slight 12° rotation. Soft brand-color SPOTLIGHT HALO from above. 3-5 floating decorative particles in accent color.
TEXT in image:
- BELOW BRAND SEAL, centered (y≈250-380), giant bold (~140px) white with subtle shadow: "${headline}"
- BELOW PRODUCT (y≈860), italic medium (~46px) light tint with accent underline: "${tagline}"`
}

export function buildPromptSlot2(ctx: PromptContext): string {
  const st = ctx.slotTexts?.slot2
  const { question, painBullets } = st ?? deriveSlot2(ctx)
  const bullets = painBullets.slice(0, 3)
  return `${header(ctx)}

SLOT 2 — PAIN POINT
COMPOSITION: Documentary close-up of the painful "before" state related to this product's category, sits in middle-right (y≈380-760). Slight desaturation (-15%) to convey discomfort. The product (matching refs) floats in BOTTOM-RIGHT corner, small (~18%), tilted, glowing softly.
TEXT in image:
- BELOW BRAND SEAL, centered (y≈250-340), bold (~90px) white with shadow: "${question}"
- LEFT-SIDE STACK 3 bullets (y≈400-760) with red ✗ + bold (~42px each):
${bullets.map((b) => `  ✗ ${b}`).join('\n')}`
}

export function buildPromptSlot3(ctx: PromptContext): string {
  const st = ctx.slotTexts?.slot3
  const beforeLabel = st?.beforeLabel ?? (ctx.language === 'ms' ? 'SEBELUM' : 'TRƯỚC')
  const afterLabel = st?.afterLabel ?? (ctx.language === 'ms' ? 'SELEPAS' : 'SAU')
  const metric = st?.metric ?? (ctx.language === 'ms' ? 'HASIL JELAS' : 'KẾT QUẢ RÕ RỆT')
  const metricSub = st?.metricSubtitle ?? (ctx.language === 'ms' ? 'DALAM MASA SINGKAT' : 'TRONG THỜI GIAN NGẮN')
  const disclaimer = st?.disclaimer ?? (ctx.language === 'ms' ? '*Hasil mungkin berbeza individu' : '*Kết quả có thể khác tùy người')
  return `${header(ctx)}

SLOT 3 — TRANSFORMATION
COMPOSITION: 50/50 SYMMETRIC vertical split (occupying y≈240-900) — LEFT "before" state, RIGHT "after" state (both directly relevant to this product's effect). SAME camera angle + SAME lighting both halves (credibility critical). Thin accent-color vertical divider. Product floats lower-center over the divide, small.
TEXT in image:
- JUST BELOW BRAND SEAL (y≈250), two labels (~38px bold tracking-wide white with shadow): left half="${beforeLabel}", right half="${afterLabel}"
- CENTER MIDDLE GIANT (y≈500, ~180px ExtraBold accent color with strong shadow): "${metric}"
- Below the metric (y≈660, ~46px bold uppercase white): "${metricSub}"
- Bottom (y≈940, ~24px italic tinted): "${disclaimer}"`
}

export function buildPromptSlot4(ctx: PromptContext): string {
  const st = ctx.slotTexts?.slot4
  const derived = deriveSlot4(ctx)
  const title = st?.title ?? derived.title
  // Use AI ingredients if non-empty; fall back to derived when AI returned [] (no ingredients in product data)
  const ingredients = (st?.ingredients && st.ingredients.length > 0) ? st.ingredients : derived.ingredients
  const tagline = st?.tagline ?? derived.tagline
  const ingLine = ingredients
    .map((i, n) => `  ${n + 1}. ${i.name}${i.pct ? ` ${i.pct}` : ''}`)
    .join('\n')

  return `${header(ctx)}

SLOT 4 — INGREDIENTS / MECHANISM (ref style: BBOJI / EXOLABO ingredient panel with REAL photos)
COMPOSITION: Product centered slightly LEFT on subtle podium (y≈420-880). Around the product: natural decorative elements relevant to the ingredients (leaves, herbs, fruit pieces) grounding the scene.
TEXT in image:
- Headline JUST BELOW BRAND SEAL (y≈250-360), giant bold (~120px) white: "${title}"
- RIGHT-SIDE STACK of pill-shaped chips (white rounded rect + soft shadow), each chip contains FOUR elements in order from left to right: (1) numbered accent badge 1-5, (2) ingredient name in bold dark navy ~30px, (3) percentage in accent color ~28px, (4) REAL MACRO PHOTOGRAPH of the actual ingredient material on the right side of the chip — e.g., real grape cluster + seeds for "Grape Seed Extract", real bamboo charcoal pieces for "Bamboo Charcoal", real mint leaves for "Mint Extract", real coconut shell for "Coconut Powder", real vitamin capsules for "Vitamin E". Commercial product catalog photography style. STRICTLY NOT abstract icons, NOT cartoon symbols, NOT generic geometric shapes.
Chips list:
${ingLine}
- BOTTOM italic (~26px) tinted: "${tagline}"`
}

export function buildPromptSlot5(ctx: PromptContext): string {
  const st = ctx.slotTexts?.slot5
  const quote = st?.quote ?? (ctx.language === 'ms' ? `Saya sangat berpuas hati dengan ${ctx.product.productName}!` : `Tôi rất hài lòng với ${ctx.product.productName}!`)
  const author = st?.author ?? (ctx.language === 'ms' ? 'Pelanggan Sebenar' : 'Khách Hàng Thật')
  const verified = st?.verifiedNote ?? (ctx.language === 'ms' ? 'Ulasan pelanggan sebenar' : 'Đánh giá khách hàng thật')
  return `${header(ctx)}

SLOT 5 — SOCIAL PROOF
COMPOSITION: Soft brand-tint bg. Product small ~18% bottom-left corner. Big white rounded testimonial card center-right (~70% area), generous shadow. Giant "❝" behind card in accent color at 15% opacity.
TEXT in card:
- TOP large amber stars: ⭐⭐⭐⭐⭐
- CENTER italic (~44px) dark navy: "${quote}"
- BOTTOM bold (~30px) gray: "— ${author}"
- Below card, small italic (~22px) gray: "${verified}"`
}

export function buildPromptSlot6(ctx: PromptContext): string {
  const st = ctx.slotTexts?.slot6
  const title = st?.title ?? (ctx.language === 'ms' ? 'CARA GUNA' : 'CÁCH DÙNG')
  const steps = (st?.steps ?? [
    ctx.language === 'ms' ? 'Sediakan produk' : 'Chuẩn bị sản phẩm',
    ctx.language === 'ms' ? 'Aplikasikan mengikut arahan' : 'Sử dụng theo hướng dẫn',
    ctx.language === 'ms' ? 'Ulang setiap hari' : 'Lặp lại hằng ngày',
  ]).slice(0, 3)
  const timing = st?.timing ?? (ctx.language === 'ms' ? '🌅 Pagi • 🌙 Malam' : '🌅 Sáng • 🌙 Tối')
  return `${header(ctx)}

SLOT 6 — USAGE DEMO
COMPOSITION: TRIPTYCH — 3 instances of product in horizontal sequence (y≈400-820), each in slightly different angle/state representing the step. Soft context bg (relevant to where product is used), NOT cluttered. Subtle accent-color vertical dividers between panels.
TEXT in image:
- BELOW BRAND SEAL, centered (y≈250-340), bold (~110px) dark primary or white: "${title}"
- BELOW EACH PRODUCT (3 columns, y≈840): big accent-color circle (~90px) with white number, then bold step text (~36px):
${steps.map((s, i) => `  Col ${i + 1}: "${s}"`).join('\n')}
- BOTTOM center (y≈970, ~32px) tinted: "${timing}"`
}

export function buildPromptSlot7(ctx: PromptContext): string {
  const st = ctx.slotTexts?.slot7
  const title = st?.title ?? (ctx.language === 'ms' ? 'PILIH YANG BAIK' : 'LỰA CHỌN ĐÚNG')
  const us = st?.usLabel ?? (ctx.language === 'ms' ? 'Pilihan kami' : 'Lựa chọn của chúng tôi')
  const them = st?.themLabel ?? (ctx.language === 'ms' ? 'Alternatif lain' : 'Lựa chọn khác')
  const points = (st?.points ?? [
    [ctx.language === 'ms' ? 'Berkualiti tinggi' : 'Chất lượng cao', ctx.language === 'ms' ? 'Kualiti biasa' : 'Chất lượng thường'],
  ]).slice(0, 4)
  const pointsStr = points.map(([a, b]) => `${a} vs ${b}`).join(' / ')

  return `${header(ctx)}

SLOT 7 — COMPARISON (VS visual, NOT table)
COMPOSITION: SIDE-BY-SIDE split (y≈400-770) — LEFT half shows our product (matching refs) on accent-tinted pedestal with confident lighting + "${us}" label badge top. RIGHT half shows a GENERIC unbranded competitor product on neutral pedestal with dimmer lighting + "${them}" label. Large bold "VS" in accent color sits at center between them.
TEXT in image:
- BELOW BRAND SEAL, centered (y≈250-360), bold (~110px) white with shadow: "${title}"
- BELOW PEDESTALS (y≈800-950), ${points.length} quick comparison rows with checkmark (left) vs cross (right), bold (~32px):
  ${pointsStr}`
}

export function buildPromptSlot8(ctx: PromptContext): string {
  const st = ctx.slotTexts?.slot8
  const derived = deriveSlot8(ctx)
  const cur = st?.currentPrice ?? derived.currentPrice
  const orig = st?.originalPrice
  const disc = st?.discount
  const combo = st?.combo
  const cta = st?.cta ?? derived.cta
  const urgency = st?.urgency ?? derived.urgency

  const priceBlock = orig
    ? `- BELOW BRAND SEAL, LEFT half (y≈260), struck-through (~42px) light tint: "${orig}"\n- DIRECTLY BELOW the strike-through (y≈320, still LEFT half), GIANT ExtraBold (~200px) white with shadow: "${cur}"`
    : `- BELOW BRAND SEAL, LEFT half (y≈280), GIANT ExtraBold (~200px) white with shadow: "${cur}"`
  const discBlock = disc ? `\n- AMBER PILL BADGE next to or below current price (~50px dark bold): "${disc}"` : ''
  const comboBlock = combo ? `\n- MIDDLE band (y≈640) bold (~40px) white: "${combo}"` : ''
  const urgBlock = urgency ? `\n- Below CTA button italic (~28px) light tint: "⏰ ${urgency}"` : ''

  return `${header(ctx)}

SLOT 8 — OFFER (hero composition + price overlay)
COMPOSITION: Product hero shot in BOTTOM-RIGHT third (y≈520-880). Energetic saturated bg (primary → warm accent). Price block sits in the LEFT half BELOW the brand seal.
TEXT in image:
${priceBlock}${discBlock}${comboBlock}
- BOTTOM (y≈930) wide rounded BUTTON in accent color, big bold white inside (~58px) with shadow: "${cta}"${urgBlock}`
}

export function buildPromptSlot9(ctx: PromptContext): string {
  const st = ctx.slotTexts?.slot9
  const title = st?.title ?? (ctx.language === 'ms' ? 'SOALAN LAZIM' : 'CÂU HỎI THƯỜNG GẶP')
  const items = (st?.items ?? [
    { q: ctx.language === 'ms' ? 'Selamat digunakan?' : 'Có an toàn không?',
      a: ctx.language === 'ms' ? 'Ya, formula lembut' : 'Có, công thức an toàn' },
    { q: ctx.language === 'ms' ? 'Bila nampak hasil?' : 'Khi nào thấy kết quả?',
      a: ctx.language === 'ms' ? 'Bergantung penggunaan' : 'Tùy cách dùng' },
    { q: ctx.language === 'ms' ? 'Boleh pulangkan?' : 'Có đổi trả không?',
      a: ctx.language === 'ms' ? 'Ya, dalam 7 hari' : 'Có, trong 7 ngày' },
  ]).slice(0, 3)
  const itemsStr = items.map((it, i) => `Card ${i + 1}: Q: "${it.q}" → A: "${it.a}"`).join(' / ')

  return `${header(ctx)}

SLOT 9 — FAQ & ASSURANCE
COMPOSITION: Soft light bg. Product small ~18% bottom-right corner (y≈790-960). 3 white rounded cards stacked vertically centered (y≈380-880, each ~160px tall, soft shadow).
TEXT in image:
- BELOW BRAND SEAL, centered (y≈250-340), bold (~110px) dark primary: "${title}"
- 3 cards content (stacked), each with accent-color "Q" badge square (~40px) on left, bold question (~38px) + answer prefixed with "→" (~30px gray):
  ${itemsStr}`
}

// ── Dispatcher ───────────────────────────────────────────────────────────

export function buildPromptForSlot(ctx: PromptContext): string {
  switch (ctx.slotConfig.slot) {
    case 1: return buildPromptSlot1(ctx)
    case 2: return buildPromptSlot2(ctx)
    case 3: return buildPromptSlot3(ctx)
    case 4: return buildPromptSlot4(ctx)
    case 5: return buildPromptSlot5(ctx)
    case 6: return buildPromptSlot6(ctx)
    case 7: return buildPromptSlot7(ctx)
    case 8: return buildPromptSlot8(ctx)
    case 9: return buildPromptSlot9(ctx)
    default: return buildPromptSlot1(ctx)
  }
}
