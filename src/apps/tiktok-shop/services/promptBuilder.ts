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
- APPLICATION (where/how on body): ${ctx.brief.applicationDetails.bodyZone} · ${ctx.brief.applicationDetails.howApplied}
- USAGE SCENE direction: ${ctx.brief.applicationDetails.usageScene}
` : ''

  // Vietnamese diacritics rule — gpt-4o-image tends to strip dấu (ă/â/ê/ô/ơ/ư/đ
  // + sắc/huyền/hỏi/ngã/nặng) when rendering stylized headlines. Make the rule
  // explicit and provide a few good/bad examples so the model knows what to do.
  const diacriticsRule = ctx.language === 'vi'
    ? `\nVIETNAMESE DIACRITICS (CRITICAL — render text faithfully):
- Render ALL Vietnamese diacritics EXACTLY: ă â ê ô ơ ư đ AND all tonal marks (sắc/huyền/hỏi/ngã/nặng).
- Render text strings VERBATIM as provided in this prompt. Do NOT transliterate to ASCII.
- ✓ "Đầu Gối", "Hỗ Trợ", "Công Nghệ", "Vật Liệu Thoáng Khí", "Thoải Mái", "Chính Hãng"
- ✗ NEVER render "Dau Goi", "Ho Tro", "Cong Nghe", "Vat Lieu Thoang Khi", "Thoai Mai", "Chinh Hang"
- Every Vietnamese word with a vowel mark or tone MUST keep the mark in the rendered image — even at large display sizes, even in ExtraBold weight.`
    : ''

  return `1:1 square TikTok Shop image (1024×1024). ${productRefHint}

PRODUCT FIDELITY: Replicate the product EXACTLY from product refs — same color, shape, label, brand name. Do NOT redesign or substitute.${briefBlock}

=== BACKGROUND — full canvas brand gradient ===
- The ENTIRE canvas (y=0 to y=1024) is filled with a saturated brand-color gradient (${p.primary} → ${p.secondary}) with subtle decorative elements (particles, soft glow, geometric accents). This is the unified backdrop.

=== BRAND SEAL — TOP-RIGHT CORNER BADGE (slightly larger for clean logo render), IDENTICAL across all 9 slots ===
- Render a WHITE (#FFFFFF) rounded rectangle badge in the TOP-RIGHT corner of the canvas.
- Badge dimensions (EXACT, identical on every slot — do NOT scale up or down per slot): ~320px wide × 100px tall (3.2:1 aspect). Rounded corners 18px. Subtle soft drop shadow below.
- Badge position: top-right corner with 20px margin from the right edge and 20px margin from the top edge. Badge spans approximately x=684 to x=1004 and y=20 to y=120. NOT centered on canvas — must hug the top-right corner.
- CONTENTS — HORIZONTAL ROW (single row, vertically centered inside the badge at y≈70):
  - LEFT: brand logo from Reference 1, ~80px wide × 80px tall (large enough to render the logo's details cleanly — text, icon, decorations all visible), at x≈700 (14px padding from left edge of badge). Vertically centered. Preserve the logo's ORIGINAL colors and DETAILS EXACTLY from Reference 1 — render every element of the logo (brand mark, decorative orbit, subscript text if any) crisply; do NOT simplify, blur, or omit any logo element. The white badge background lets original colors render naturally.
  - MIDDLE: thin vertical "|" separator in DARK NAVY (#0E2A47) at 40% opacity, ~40px tall, at x≈800.
  - RIGHT: text "Official | ${marketBadge}" in DARK NAVY (#0E2A47), Plus Jakarta Sans Medium ~16px, vertically centered, at x≈820-990.
- The badge is COMPACT but the logo MUST be rendered with full fidelity at 80×80px — this size gives the AI enough resolution to draw the brand mark cleanly.
- DO NOT enlarge the badge past ~320px wide.
- DO NOT center the badge — must be in the TOP-RIGHT corner.
- DO NOT simplify, redraw, or partially render the logo — every visual element from Reference 1 must appear in the badge logo.
- DO NOT render the brand kit's store name as additional text.

LAYOUT: ALL slot content (headlines, product hero, price overlays, decorations) sits in the rest of the canvas — content area starts y≈140 (just below the corner badge) down to y≈980. Headlines centered at top should sit at y≈160-300. Content text uses WHITE / light colors (it's on the brand gradient).

STYLE: Premium e-commerce listing — top-seller aesthetic for this product's category. Saturated brand palette (NOT pastel), polished commercial photography, integrated decorative elements. Plus Jakarta Sans ExtraBold (weight 800-900) for headlines, Medium Italic for sub-text.

PALETTE (use ONLY these): ${p.primary} primary, ${p.secondary} secondary, ${p.cta} accent. High saturation.

LANGUAGE: ${langName} ONLY in any rendered text (except "Official store" subtitle which stays English as universal e-commerce terminology). NO other language characters.${diacriticsRule}

NO trust bar at bottom — leave clean for visual breathing.`
}

// ── Fallback helpers — brief-aware when ctx.brief present, else product fields ──
// Phase 10.2 fix: when Gemini's slotTexts output is missing/incomplete, fall
// back to BRIEF data (BM/VN, customer-voice) instead of raw product fields
// (often English). This is the safety net that ensures images stay product-
// specific even when description-gen's slotTexts shape isn't perfect.

function deriveSlot1(ctx: PromptContext): { headline: string; tagline: string } {
  if (ctx.brief) {
    // Brief.specificMetric is already ALL CAPS short metric (S1 headline anchor).
    // Brief.transformationPromise is 1-2 sentence promise (S1 tagline expansion).
    return {
      headline: ctx.brief.specificMetric.toUpperCase().slice(0, 60),
      tagline:  ctx.brief.transformationPromise.slice(0, 100),
    }
  }
  // No brief — fall back to product fields (last resort).
  const name = ctx.product.productName || 'PRODUCT'
  const usps = (ctx.product.usps || '').split(/[\n,;.]/).map((s) => s.trim()).filter(Boolean)
  const headline = (usps[0] || name).toUpperCase().slice(0, 60)
  const tagline = (ctx.product.productDescription || usps[1] || '').slice(0, 80)
  return { headline, tagline }
}

function deriveSlot2(ctx: PromptContext): { question: string; painBullets: string[] } {
  if (ctx.brief) {
    const pains = ctx.brief.corePains.slice(0, 3)
    return {
      question:    pains[0] || (ctx.language === 'ms' ? 'Mempunyai masalah?' : 'Đang gặp vấn đề?'),
      painBullets: pains.length >= 3 ? pains : (ctx.language === 'ms'
        ? pains.concat(['Cari penyelesaian?', 'Mahu hasil lebih baik?'].slice(0, 3 - pains.length))
        : pains.concat(['Cần giải pháp?', 'Muốn kết quả tốt hơn?'].slice(0, 3 - pains.length))),
    }
  }
  // No brief
  const pains = (ctx.product.painPoints || '').split(/[\n;.]|•/).map((s) => s.trim()).filter(Boolean).slice(0, 3)
  const fallback = ctx.language === 'ms'
    ? { q: `Mempunyai masalah dengan ${ctx.product.productName}?`, b: ['Cari penyelesaian?', 'Tidak puas hati?', 'Mencari yang lebih baik?'] }
    : { q: `Đang gặp vấn đề với ${ctx.product.productName}?`, b: ['Tìm giải pháp?', 'Không hài lòng?', 'Cần lựa chọn tốt hơn?'] }
  return {
    question: pains[0] ? pains[0] : fallback.q,
    painBullets: pains.length >= 3 ? pains : (pains.length > 0 ? pains.concat(fallback.b.slice(pains.length)) : fallback.b),
  }
}

function deriveSlot3(ctx: PromptContext): { beforeLabel: string; afterLabel: string; metric: string; metricSubtitle: string; disclaimer: string } {
  const beforeLabel = ctx.language === 'ms' ? 'SEBELUM' : 'TRƯỚC'
  const afterLabel  = ctx.language === 'ms' ? 'SELEPAS' : 'SAU'
  const disclaimer  = ctx.language === 'ms' ? '*Hasil mungkin berbeza individu' : '*Kết quả có thể khác tùy người'
  if (ctx.brief) {
    return {
      beforeLabel, afterLabel,
      metric: ctx.brief.specificMetric.toUpperCase().slice(0, 30),
      metricSubtitle: ctx.brief.transformationPromise.slice(0, 50),
      disclaimer,
    }
  }
  return {
    beforeLabel, afterLabel,
    metric: ctx.language === 'ms' ? 'HASIL JELAS' : 'KẾT QUẢ RÕ RỆT',
    metricSubtitle: ctx.language === 'ms' ? 'DALAM MASA SINGKAT' : 'TRONG THỜI GIAN NGẮN',
    disclaimer,
  }
}

function deriveSlot4(ctx: PromptContext): { title: string; ingredients: Array<{ name: string; pct?: string; photoHint?: string }>; tagline: string } {
  const isMS = ctx.language === 'ms'
  // Title adapts to product type — supplements/cosmetics → "Thành phần"; everything else → "Cấu tạo / Vật liệu / Đặc điểm".
  const subtype = (ctx.brief?.productSubtype || '').toLowerCase()
  const isConsumable = /tablet|capsule|powder|sachet|drink|spray|cream|gel|serum|oil|liquid/i.test(subtype)
  const title = isConsumable
    ? (isMS ? 'BAHAN AKTIF' : 'THÀNH PHẦN CHÍNH')
    : (isMS ? 'CIRI UTAMA' : 'CẤU TẠO NỔI BẬT')
  const tagline = isConsumable
    ? (isMS ? 'Bahan berkualiti, selamat digunakan' : 'Thành phần chất lượng, an toàn')
    : (isMS ? 'Reka bentuk teliti, tahan lama' : 'Thiết kế tỉ mỉ, bền bỉ')

  // Priority: brief.keyFeatures (universal, type-adapted) > visible ingredients > seller ingredients > seller usps > [].
  if (ctx.brief && ctx.brief.keyFeatures.length > 0) {
    return {
      title,
      ingredients: ctx.brief.keyFeatures.slice(0, 5).map((f) => ({
        name: f.name,
        pct: f.detail,
        photoHint: f.photoHint,
      })),
      tagline,
    }
  }
  const visionIngs = ctx.brief?.visibleIngredients ?? []
  if (visionIngs.length > 0) {
    return { title, ingredients: visionIngs.slice(0, 5).map((name) => ({ name })), tagline }
  }
  const sellerIngs = (ctx.product.ingredients || '').split(/[\n,]/).map((s) => s.trim()).filter(Boolean).slice(0, 5)
  if (sellerIngs.length > 0) {
    return { title, ingredients: sellerIngs.map((name) => ({ name })), tagline }
  }
  const sellerUsps = (ctx.product.usps || '').split(/[\n,;.]/).map((s) => s.trim()).filter(Boolean).slice(0, 5)
  if (sellerUsps.length > 0) {
    return { title, ingredients: sellerUsps.map((name) => ({ name })), tagline }
  }
  return { title, ingredients: [], tagline }
}

function deriveSlot5(ctx: PromptContext): { contactName: string; conversation: Array<{ from: 'customer' | 'shop'; text: string }>; verifiedNote: string } {
  const isMS = ctx.language === 'ms'
  const verifiedNote = isMS ? 'Ulasan pelanggan sebenar' : 'Phản hồi khách hàng thật'
  const contactName = isMS ? 'Aisyah' : 'Mai Anh'
  if (ctx.brief) {
    const pain = ctx.brief.corePains[0]?.replace(/\?$/, '').trim() || (isMS ? 'masalah saya' : 'vấn đề của tôi')
    const promise = ctx.brief.transformationPromise.slice(0, 80).trim()
    const zone = ctx.brief.applicationDetails.bodyZone
    const usageHint = ctx.brief.applicationDetails.howApplied.slice(0, 60)
    const conversation: Array<{ from: 'customer' | 'shop'; text: string }> = isMS
      ? [
          { from: 'customer', text: `Hi kak, sebelum ni saya ${pain.toLowerCase()} (${zone}) 😩` },
          { from: 'customer', text: `Dah guna ${ctx.brief.productNameExact} seminggu, ${promise.toLowerCase()} 🥰` },
          { from: 'shop',     text: `Terima kasih kak! Teruskan ${usageHint.toLowerCase()} setiap hari untuk hasil yang lebih lama tau 💚` },
          { from: 'customer', text: `Okay! Akan order lagi nanti 🙏` },
        ]
      : [
          { from: 'customer', text: `Chị ơi, trước em bị ${pain.toLowerCase()} ở ${zone} 😩` },
          { from: 'customer', text: `Em dùng ${ctx.brief.productNameExact} được 1 tuần, ${promise.toLowerCase()} ạ ❤️` },
          { from: 'shop',     text: `Cảm ơn em! Nhớ ${usageHint.toLowerCase()} đều mỗi ngày để duy trì hiệu quả nha 💚` },
          { from: 'customer', text: `Dạ em nhớ rồi! Em sẽ đặt thêm ạ 🙏` },
        ]
    return { contactName, conversation, verifiedNote }
  }
  return {
    contactName,
    conversation: isMS
      ? [
          { from: 'customer', text: `Hi kak, saya nak share` },
          { from: 'customer', text: `Saya sangat berpuas hati dengan ${ctx.product.productName}! 🥰` },
          { from: 'shop',     text: `Terima kasih kak! Teruskan penggunaan harian untuk hasil terbaik 💚` },
          { from: 'customer', text: `Akan order lagi nanti 🙏` },
        ]
      : [
          { from: 'customer', text: `Chị ơi, em muốn chia sẻ` },
          { from: 'customer', text: `Em hài lòng lắm với ${ctx.product.productName}! ❤️` },
          { from: 'shop',     text: `Cảm ơn em! Nhớ dùng đều hằng ngày để duy trì hiệu quả nha 💚` },
          { from: 'customer', text: `Dạ em sẽ đặt thêm ạ 🙏` },
        ],
    verifiedNote,
  }
}

function deriveSlot6(ctx: PromptContext): { title: string; steps: string[]; timing: string } {
  const isMS = ctx.language === 'ms'
  const title  = isMS ? '3 LANGKAH MUDAH' : '3 BƯỚC ĐƠN GIẢN'
  const timing = isMS ? '🌅 Pagi • 🌙 Malam' : '🌅 Sáng • 🌙 Tối'
  if (ctx.brief) {
    // Use brief.usageContext to hint at usage; generate specific steps grounded in subtype
    const subtype = ctx.brief.productSubtype.toLowerCase()
    const steps = isMS
      ? [
          `Sediakan ${subtype}`,
          ctx.brief.usageContext.slice(0, 60) || 'Gunakan mengikut keperluan',
          'Ulang untuk hasil optimum',
        ]
      : [
          `Chuẩn bị ${subtype}`,
          ctx.brief.usageContext.slice(0, 60) || 'Sử dụng khi cần',
          'Lặp lại để đạt hiệu quả tối ưu',
        ]
    return { title, steps, timing }
  }
  return {
    title,
    steps: isMS
      ? ['Sediakan produk', 'Aplikasikan mengikut arahan', 'Ulang setiap hari']
      : ['Chuẩn bị sản phẩm', 'Sử dụng theo hướng dẫn', 'Lặp lại hằng ngày'],
    timing,
  }
}

function deriveSlot7(ctx: PromptContext): { title: string; usLabel: string; themLabel: string; points: Array<[string, string]> } {
  const isMS = ctx.language === 'ms'
  const title    = isMS ? 'PILIH YANG BAIK' : 'LỰA CHỌN ĐÚNG'
  const usLabel  = isMS ? 'Pilihan kami' : 'Lựa chọn của chúng tôi'
  const themLabel = isMS ? 'Alternatif lain' : 'Lựa chọn khác'
  if (ctx.brief) {
    // Build comparison rows from brief.keyDifferentiator (our specific edge vs generic)
    const edge = ctx.brief.keyDifferentiator.slice(0, 40)
    const points: Array<[string, string]> = isMS
      ? [
          [edge,                       'Formula biasa'],
          ['Bahan diuji nyahnyatakan', 'Bahan tidak jelas'],
          [ctx.brief.specificMetric,   'Hasil tidak ditentukan'],
          ['Selamat untuk harian',     'Kesan tidak diketahui'],
        ]
      : [
          [edge,                       'Công thức thông thường'],
          ['Thành phần kiểm chứng',    'Thành phần không rõ'],
          [ctx.brief.specificMetric,   'Kết quả không xác định'],
          ['An toàn dùng hằng ngày',   'Tác dụng không rõ'],
        ]
    return { title, usLabel, themLabel, points }
  }
  return {
    title, usLabel, themLabel,
    points: [[isMS ? 'Berkualiti tinggi' : 'Chất lượng cao', isMS ? 'Kualiti biasa' : 'Chất lượng thường']],
  }
}

function deriveSlot8(ctx: PromptContext): { title: string; signs: string[]; qualifier: string } {
  const isMS = ctx.language === 'ms'
  const title = isMS ? 'SIAPA PERLU GUNA?' : 'AI NÊN DÙNG?'
  const qualifier = isMS
    ? 'Ada 2/5 tanda? Produk ni untuk anda'
    : 'Có 2/5 dấu hiệu? Đây là sản phẩm cho bạn'
  if (ctx.brief) {
    // Build 5 concrete signs from brief.corePains + targetCustomer.dailyContext
    const pains = ctx.brief.corePains.map((p) => p.replace(/\?$/, '').trim()).filter(Boolean)
    const context = ctx.brief.targetCustomer.dailyContext
    const fromContext = context.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
    const merged = [...pains, ...fromContext].slice(0, 5)
    if (merged.length >= 3) {
      const padded = merged.concat(isMS
        ? ['Mahu hasil tahan lama', 'Cari penyelesaian semula jadi']
        : ['Muốn kết quả lâu dài', 'Tìm giải pháp tự nhiên']).slice(0, 5)
      return { title, signs: padded, qualifier }
    }
  }
  return {
    title,
    signs: isMS
      ? ['Masalah berulang setiap hari', 'Cuba banyak cara tapi tak berkesan', 'Mahu penyelesaian semula jadi', 'Hidup terganggu kerana masalah ni', 'Mencari produk yang dipercayai'].slice(0, 5)
      : ['Vấn đề lặp lại mỗi ngày', 'Thử nhiều cách nhưng không hiệu quả', 'Muốn giải pháp tự nhiên', 'Cuộc sống bị ảnh hưởng vì vấn đề này', 'Tìm sản phẩm tin được'].slice(0, 5),
    qualifier,
  }
}

function deriveSlot9(ctx: PromptContext): { title: string; reasons: Array<{ headline: string; detail: string }> } {
  const isMS = ctx.language === 'ms'
  const title = isMS ? 'KENAPA PILIH KAMI' : 'VÌ SAO CHỌN CHÚNG TÔI'
  if (ctx.brief) {
    // Build 3 product-specific reasons from brief data — NEVER generic.
    // Reason 1 → keyDifferentiator (the unique edge)
    // Reason 2 → visibleIngredients OR packagingDescription (proof of mechanism)
    // Reason 3 → nicheSafeClaims OR targetCustomer.dailyContext (who/where it fits)
    const edge = ctx.brief.keyDifferentiator.trim()
    const ings = ctx.brief.visibleIngredients.slice(0, 3).join(', ')
    const safe = ctx.brief.nicheSafeClaims[0]?.trim() || ''
    const context = ctx.brief.targetCustomer.dailyContext.trim()
    const reasons: Array<{ headline: string; detail: string }> = []

    reasons.push({
      headline: edge.split(/[,.;]/)[0]?.trim().slice(0, 50) || edge.slice(0, 50),
      detail: edge.slice(0, 90),
    })

    if (ings) {
      reasons.push({
        headline: ings.slice(0, 50),
        detail: isMS
          ? `Bahan utama dari ${ctx.brief.packagingDescription.split(/[,.;]/)[0]?.trim().slice(0, 60) || 'sumber yang dipercayai'}`
          : `Thành phần chính từ ${ctx.brief.packagingDescription.split(/[,.;]/)[0]?.trim().slice(0, 60) || 'nguồn tin cậy'}`,
      })
    } else {
      reasons.push({
        headline: ctx.brief.transformationPromise.split(/[,.;]/)[0]?.trim().slice(0, 50) || ctx.brief.transformationPromise.slice(0, 50),
        detail: ctx.brief.specificMetric.slice(0, 80),
      })
    }

    reasons.push({
      headline: safe ? safe.slice(0, 50) : context.split(/[,.;]/)[0]?.trim().slice(0, 50) || (isMS ? 'Sesuai untuk semua' : 'Phù hợp mọi người'),
      detail: (context || ctx.brief.usageContext).slice(0, 90),
    })

    return { title, reasons: reasons.slice(0, 3) }
  }
  return {
    title,
    reasons: isMS
      ? [
          { headline: 'Formula khusus', detail: 'Direka untuk masalah khusus anda' },
          { headline: 'Bahan terpilih',  detail: 'Setiap bahan ada fungsi yang jelas' },
          { headline: 'Sesuai harian',   detail: 'Boleh diguna setiap hari tanpa kesan sampingan' },
        ]
      : [
          { headline: 'Công thức chuyên biệt', detail: 'Thiết kế riêng cho vấn đề của bạn' },
          { headline: 'Thành phần chọn lọc',   detail: 'Mỗi thành phần có vai trò rõ ràng' },
          { headline: 'Phù hợp dùng hằng ngày', detail: 'An tâm sử dụng mỗi ngày' },
        ],
  }
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
  const bodyZoneHint = ctx.brief
    ? `Documentary close-up of the customer's "before" pain — show DISCOMFORT in the EXACT body zone the product targets: "${ctx.brief.applicationDetails.bodyZone}". E.g., if product = knee brace, show person grabbing/touching the KNEE; if product = nasal spray, show person rubbing the NOSE; if product = face cream, show person frowning at facial skin. NEVER show pain on the wrong body part.`
    : `Documentary close-up of the painful "before" state related to this product's category.`
  return `${header(ctx)}

SLOT 2 — PAIN POINT
COMPOSITION: ${bodyZoneHint} The "before" scene sits in middle-right (y≈380-760). Slight desaturation (-15%) to convey discomfort. The product (matching refs) floats in BOTTOM-RIGHT corner, small (~18%), tilted, glowing softly.
TEXT in image:
- BELOW BRAND SEAL, centered (y≈250-340), bold (~90px) white with shadow: "${question}"
- LEFT-SIDE STACK 3 bullets (y≈400-760) with red ✗ + bold (~42px each):
${bullets.map((b) => `  ✗ ${b}`).join('\n')}`
}

export function buildPromptSlot3(ctx: PromptContext): string {
  const st = ctx.slotTexts?.slot3
  const derived = deriveSlot3(ctx)
  const beforeLabel  = st?.beforeLabel    ?? derived.beforeLabel
  const afterLabel   = st?.afterLabel     ?? derived.afterLabel
  const metric       = st?.metric         ?? derived.metric
  const metricSub    = st?.metricSubtitle ?? derived.metricSubtitle
  const disclaimer   = st?.disclaimer     ?? derived.disclaimer
  const transformBodyHint = ctx.brief
    ? `BOTH halves must show the EXACT body zone the product targets ("${ctx.brief.applicationDetails.bodyZone}"). LEFT shows the BEFORE state (discomfort / problem visible at that zone). RIGHT shows the AFTER state (relief / improvement visible at that zone, often with the product worn/applied if appropriate). The body zone MUST match the product type — e.g., knee brace → both halves show the KNEE.`
    : `LEFT "before" state, RIGHT "after" state (both directly relevant to this product's effect).`
  return `${header(ctx)}

SLOT 3 — TRANSFORMATION
COMPOSITION: 50/50 SYMMETRIC vertical split (occupying y≈240-900) — ${transformBodyHint} SAME camera angle + SAME lighting both halves (credibility critical). Thin accent-color vertical divider. Product floats lower-center over the divide, small.
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
  // Prefer AI's slotTexts but enrich with photoHint from derived (slotTexts schema doesn't carry photoHint).
  const aiIngs = st?.ingredients ?? []
  const ingredients = (aiIngs.length > 0
    ? aiIngs.map((ai, i) => ({
        name:      ai.name,
        pct:       ai.pct,
        photoHint: derived.ingredients[i]?.photoHint,
      }))
    : derived.ingredients
  ).slice(0, 5)
  const tagline = st?.tagline ?? derived.tagline

  // If there are no chips at all, render a clean USP version of slot 4 with a
  // generic decorative panel instead of an empty chip stack (which causes
  // earlier "Grape Seed Extract" hallucination from leftover example wording).
  if (ingredients.length === 0) {
    return `${header(ctx)}

SLOT 4 — PRODUCT HIGHLIGHTS (clean panel — no specific feature breakdown available)
COMPOSITION: Product centered on subtle podium (y≈420-880). Soft decorative elements (light particles, brand-color glow) around the product. NO chips, NO numbered badges, NO ingredient photos.
TEXT in image:
- Headline JUST BELOW BRAND SEAL (y≈250-360), giant bold (~120px) white: "${title}"
- BOTTOM italic (~26px) tinted: "${tagline}"
EXTRA RULES: Do NOT invent ingredient names, materials, or feature breakdowns. This slot is intentionally minimal because the product brief did not provide structured features.`
  }

  const ingLine = ingredients
    .map((i, n) => {
      const detail = i.pct ? ` — ${i.pct}` : ''
      const hint = i.photoHint ? `  ↳ MACRO PHOTO: ${i.photoHint}` : ''
      return `  Chip ${n + 1}: "${i.name}${detail}"${hint ? '\n' + hint : ''}`
    })
    .join('\n')

  return `${header(ctx)}

SLOT 4 — KEY FEATURES PANEL (ingredient / material / component breakdown)
COMPOSITION: Product centered slightly LEFT on subtle podium (y≈420-880). Around the product: decorative elements that visually echo the listed features (e.g., for fabric features → soft fabric folds in bg; for ingredients → leaves/herbs in bg; for tech components → subtle circuit-pattern glow). Pick decor that MATCHES the feature list, NOT a default herbal/leaf set.
TEXT in image:
- Headline JUST BELOW BRAND SEAL (y≈250-360), giant bold (~120px) white: "${title}"
- RIGHT-SIDE STACK of pill-shaped chips (white rounded rect + soft shadow), each chip has FOUR elements LEFT-TO-RIGHT:
  (1) numbered accent badge 1-${ingredients.length}
  (2) feature/ingredient/material name in bold dark navy ~30px
  (3) detail (% / measurement / spec) in accent color ~28px
  (4) REAL MACRO PHOTOGRAPH on the right side of the chip showing the actual feature/material/ingredient described by the "MACRO PHOTO" hint for that chip.
Chips (RENDER EXACTLY THESE ${ingredients.length} CHIPS — NO MORE, NO LESS, NO EXAMPLES FROM OTHER PRODUCTS):
${ingLine}

EXTRA RULES (critical — anti-contamination):
- The macro photos on the chips MUST match the product type. If the chips are about fabric / springs / velcro (accessory product), the macro shots must show FABRIC / METAL SPRINGS / VELCRO — NEVER grape seeds, bamboo charcoal, mint leaves, coconut, or vitamin capsules.
- If the chips are about ingredients (supplement / cream), show the actual ingredient material.
- NEVER invent a 6th chip. NEVER substitute one chip with a different feature.
- Commercial product catalog photography style. STRICTLY NOT abstract icons, NOT cartoon symbols, NOT generic geometric shapes.
- BOTTOM italic (~26px) tinted: "${tagline}"`
}

export function buildPromptSlot5(ctx: PromptContext): string {
  const st = ctx.slotTexts?.slot5
  const derived = deriveSlot5(ctx)
  const contactName = st?.contactName ?? derived.contactName
  const conversation = (st?.conversation && st.conversation.length > 0 ? st.conversation : derived.conversation).slice(0, 5)
  const verified    = st?.verifiedNote ?? derived.verifiedNote
  const bubblesList = conversation
    .map((b, i) => {
      const minute = String(21 + i).padStart(2, '0')
      if (b.from === 'customer') {
        return `  Bubble ${i + 1} — CUSTOMER (RIGHT-aligned, LIGHT GREEN #DCF8C6 with tail on right, dark text), timestamp "14:${minute}" + ✓✓ BLUE read-tick: "${b.text}"`
      }
      return `  Bubble ${i + 1} — SHOP (LEFT-aligned, WHITE #FFFFFF with tail on left, dark text, slight drop shadow), timestamp "14:${minute}" (no read-tick on shop bubbles): "${b.text}"`
    })
    .join('\n')

  return `${header(ctx)}

SLOT 5 — SOCIAL PROOF (WhatsApp 2-way chat screenshot inside iPhone mockup)
COMPOSITION:
- Soft brand-color background fills the canvas.
- CENTER OF CANVAS (y≈150-940), a realistic BLACK iPhone 14 / 15 mockup, tilted ~3° for natural perspective. The phone occupies ~58% of canvas width, sharp 3D-rendered look with subtle screen reflection. Notch + dynamic island visible at the top of the screen.
- Phone screen content = WhatsApp chat thread (authentic WhatsApp UI, 2-way conversation):
  - iOS status bar at very top (small): time "14:25", signal/wifi/battery icons.
  - WHATSAPP HEADER BAR (height ~80px on the screen, background = WhatsApp green #075E54): back arrow on the left, circular avatar (generic person silhouette in muted color — NO real face), then contact name "${contactName}" in WHITE Plus Jakarta Sans Semibold ~32px, with sub-text "online" in lighter green ~22px below the name. Camera + phone call icons on the right.
  - CHAT AREA below header: classic WhatsApp light beige #ECE5DD background with subtle faint geometric WhatsApp pattern texture.
  - BUBBLES (ALTERNATING customer right-green / shop left-white — render in this EXACT order, top to bottom):
${bubblesList}
  - Each customer bubble: WhatsApp light-green #DCF8C6, tail on RIGHT side, dark gray text ~28px, timestamp + BLUE ✓✓ read-receipt in bottom-right.
  - Each shop bubble: pure WHITE #FFFFFF, tail on LEFT side, dark gray text ~28px, timestamp in bottom-right (NO read-tick — shop is the receiver).
  - Vertical spacing between bubbles ~12-16px. Bubbles stacked naturally as in a real chat.
- Around the phone: subtle accent-color soft glow halo, gentle shadow under the phone.
- Product (matching refs) appears small ~14% in the BOTTOM-LEFT corner of the canvas (NOT inside the chat screen), slightly out-of-focus for depth.
TEXT in image (OUTSIDE the phone screen):
- BOTTOM CENTER (y≈980), small italic ~22px dark navy on the bg: "${verified}"
EXTRA RULES:
- Render the chat as an authentic forwarded screenshot — NOT a designed marketing card. NO "5 star" overlay, NO testimonial frame.
- WhatsApp bubble layout must follow real conventions: customer = right-green, shop = left-white. NEVER mix or swap.
- Render every bubble's text EXACTLY as written (no paraphrasing, no truncation). If a bubble has emoji, render the emoji.
- The conversation MUST feel like a real back-and-forth: customer shares result, shop thanks + gives instruction, customer acknowledges.`
}

export function buildPromptSlot6(ctx: PromptContext): string {
  const st = ctx.slotTexts?.slot6
  const derived = deriveSlot6(ctx)
  const title  = st?.title  ?? derived.title
  const steps  = (st?.steps && st.steps.length > 0 ? st.steps : derived.steps).slice(0, 3)
  const timing = st?.timing ?? derived.timing
  // The TRIPTYCH must show a PERSON physically applying the product on the
  // correct body zone — NOT 3 product-only shots. usageScene from brief gives
  // the AI a concrete photo direction. Without brief, fall back to generic.
  const usageDirection = ctx.brief
    ? `Each of the 3 panels shows a PERSON actually using the product on the correct body zone "${ctx.brief.applicationDetails.bodyZone}". Use this scene direction as the base for all 3 panels: "${ctx.brief.applicationDetails.usageScene}". Vary the panels by step progression (e.g., Panel 1 = preparing/positioning, Panel 2 = active application motion, Panel 3 = result/finished). DO NOT show only the product — every panel must show body-product interaction at the target zone. NEVER place the product on the wrong body part.`
    : `TRIPTYCH — 3 instances of the product being USED (with a person interacting), in horizontal sequence. Each panel = one usage step.`
  return `${header(ctx)}

SLOT 6 — USAGE DEMO
COMPOSITION: ${usageDirection} Panels occupy y≈400-820 in horizontal sequence. Soft context bg (home/bathroom/clinic depending on usage scene), NOT cluttered. Subtle accent-color vertical dividers between panels.
TEXT in image:
- BELOW BRAND SEAL, centered (y≈250-340), bold (~110px) dark primary or white: "${title}"
- BELOW EACH PANEL (3 columns, y≈840): big accent-color circle (~90px) with white number, then bold step text (~36px):
${steps.map((s, i) => `  Col ${i + 1}: "${s}"`).join('\n')}
- BOTTOM center (y≈970, ~32px) tinted: "${timing}"`
}

export function buildPromptSlot7(ctx: PromptContext): string {
  const st = ctx.slotTexts?.slot7
  const derived = deriveSlot7(ctx)
  const title  = st?.title    ?? derived.title
  const us     = st?.usLabel  ?? derived.usLabel
  const them   = st?.themLabel ?? derived.themLabel
  const points = (st?.points && st.points.length > 0 ? st.points : derived.points).slice(0, 4)
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
  const title     = st?.title     ?? derived.title
  const signs     = (st?.signs && st.signs.length > 0 ? st.signs : derived.signs).slice(0, 5)
  const qualifier = st?.qualifier ?? derived.qualifier
  const signsList = signs
    .map((s, i) => `  Row ${i + 1} (y≈${410 + i * 90}): white rounded pill ~760px wide × 76px tall, with accent-color circle checkbox ~46px on the LEFT (white ✓ inside) and DARK NAVY bold ~34px text on the right: "${s}"`)
    .join('\n')

  return `${header(ctx)}

SLOT 8 — QUALIFYING CHECKLIST ("Ai nên dùng?")
COMPOSITION:
- Brand gradient fills the canvas (energetic but readable — not too dark).
- Product (matching refs) small ~14% in the BOTTOM-RIGHT corner (y≈800-960), slightly tilted, soft glow — acts as a quiet visual anchor, NOT the hero.
- The hero of this slot is the CHECKLIST, not the product.
TEXT / LAYOUT in image:
- BELOW BRAND SEAL (y≈230-340), centered, bold ExtraBold (~110px) WHITE with strong drop shadow: "${title}"
- VERTICAL STACK of ${signs.length} checklist pills, evenly spaced, centered horizontally (x≈130-890):
${signsList}
- BOTTOM CALLOUT BAR (y≈900-970), wide rounded rectangle in ACCENT color, big bold WHITE text (~44px) centered with subtle shadow: "${qualifier}"

EXTRA RULES:
- NO prices, NO percentage discounts, NO "BELI SEKARANG" / "MUA NGAY" buttons, NO countdown timers, NO stock counters.
- Pills must look CLEAN and uniform — same width, same height, same checkbox style. Like a wellness self-diagnosis quiz card, not a sale slide.
- The 5 signs are short, concrete symptoms / situations the customer recognizes — render them faithfully without paraphrasing.`
}

export function buildPromptSlot9(ctx: PromptContext): string {
  const st = ctx.slotTexts?.slot9
  const derived = deriveSlot9(ctx)
  const title   = st?.title ?? derived.title
  const reasons = (st?.reasons && st.reasons.length > 0 ? st.reasons : derived.reasons).slice(0, 3)
  const reasonsList = reasons
    .map((r, i) => `  Card ${i + 1} (y≈${400 + i * 165}): WHITE rounded card ~840px × 150px with soft shadow.\n    - LEFT: large accent-color circle ~96px with WHITE ExtraBold number "${i + 1}" inside (~64px).\n    - CENTER-RIGHT: TOP line bold DARK NAVY ~38px headline: "${r.headline}"\n    - CENTER-RIGHT: BOTTOM line medium gray ~26px detail: "${r.detail}"`)
    .join('\n')

  return `${header(ctx)}

SLOT 9 — BRAND STORY BAR (3 product-specific reasons)
COMPOSITION:
- Soft brand-tint background (calm, trustworthy — not energetic).
- Product (matching refs) small ~14% in the BOTTOM-RIGHT corner (y≈810-960), gently lit — acts as anchor only.
- Hero is the 3-reason stack.
TEXT / LAYOUT in image:
- BELOW BRAND SEAL (y≈230-340), centered, bold ExtraBold (~110px) DARK PRIMARY color (NOT white — this section feels editorial): "${title}"
- 3 stacked reason cards centered horizontally:
${reasonsList}

EXTRA RULES (critical — anti-generic):
- The 3 reasons are the EXACT strings provided. Do NOT generalize or rewrite them.
- NO generic adjective-only badges ("chất lượng cao", "uy tín", "an toàn", "hiệu quả nhanh", "kualiti tinggi", "dipercayai", "selamat", "berkesan cepat").
- Each headline must contain at least one concrete noun (ingredient name, country/region, technology, mechanism, certification type, timeframe, target customer) — NOT just adjectives.
- This slot is brand differentiation, not generic FAQ. NO "Q:" / "A:" formatting, NO question marks, NO refund/shipping/return talk.
- Numbers 1-2-3 are large circles, visually anchoring each reason. Reasons read as 3 short proof points, not 3 questions.`
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
