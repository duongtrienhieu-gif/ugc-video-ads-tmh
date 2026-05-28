// Prompt builder for gpt-4o-image (TRUE i2i editing via filesUrl).
//
// DESIGN PRINCIPLES (calibrated against top-seller refs: EXOLABO V-SHINE,
// SMILEE EXTRA PRO, EUCRYL ROYAL LONDON):
//   1. LEAN — ~180 words/slot. Long prompts crowd out creative space.
//   2. PRODUCT FIDELITY first — refs honored via filesUrl + replication directive.
//   3. PROFESSIONAL aesthetic — reference real top-seller styles by name.
//   4. CONCRETE decor — saturated bg + subtle pattern (sparkles/dots/shapes).
//   5. COMPOSITION VARIETY — each slot has a distinct visual treatment (podium,
//      floating, triptych, VS, hero+overlay) instead of generic "centered product".
//   6. NO TRUST BAR — top sellers don't use them; removed entirely per user
//      feedback. Bottom area is free for visual breathing / decor.
//   7. Brand identity STAYS small top-left (logo from ref1 + store name).

import type { ResolvedBrandKit, Market } from '../../../types/brandKit'
import type { Product } from '../../../stores/types'
import type { SlotConfig, PaletteFamily } from '../types'
import { TPCN_PALETTES } from '../constants'

export interface PromptContext {
  brandKit: ResolvedBrandKit
  product: Product
  slotConfig: SlotConfig
  paletteFamily: PaletteFamily
  language: Market
  /** True when brand kit logo URL was prepended to filesUrl (first ref). */
  hasLogoRef: boolean
}

// ── Shared header (~100 words) — appears in every slot prompt ───────────

function header(ctx: PromptContext): string {
  const p = TPCN_PALETTES[ctx.paletteFamily]
  const productRefHint = ctx.hasLogoRef
    ? 'Reference 1 = brand logo (preserve exactly). References 2+ = product photos.'
    : 'All references are product photos.'
  const langName = ctx.language === 'ms' ? 'Bahasa Malaysia' : 'Vietnamese'

  return `1:1 square TikTok Shop image (1024×1024). ${productRefHint}

PRODUCT: Replicate EXACTLY from refs — same color, shape, label, brand name. Do NOT redesign or substitute.

BRAND IDENTITY: Small top-left zone (~8% canvas height) with brand logo + store name "${ctx.brandKit.storeName}"${ctx.brandKit.flagOrigin ? ` + ${ctx.brandKit.flagOrigin.toUpperCase()} flag chip` : ''}. Same position EVERY slot. Subtle, doesn't compete with main message.

STYLE: Premium TPCN listing in the style of top sellers EXOLABO V-SHINE / SMILEE EXTRA PRO / EUCRYL Royal London — saturated brand palette (NOT pastel washed out), polished commercial photography, integrated decorative elements. Use Plus Jakarta Sans ExtraBold (weight 800-900) for headlines, Medium Italic for sub-text. SAME font family across all text in image.

PALETTE (use ONLY these): ${p.primary} primary, ${p.secondary} secondary, ${p.cta} accent. High saturation, colors pop.

BACKGROUND: Saturated brand-color gradient + subtle decorative elements (sparingly placed floating particles, soft glow halos, small geometric accents in accent color). NO molecular bg, NO leaves scatter, NO sparkles overload — keep balanced.

LANGUAGE: ${langName} ONLY in image. NO other language characters.

NO TRUST BAR at bottom — leave bottom area clean for visual breathing or relevant content.`
}

// ── Per-slot blocks (~80 words each) — varied compositions per refs ─────

export function buildPromptSlot1(ctx: PromptContext): string {
  const t = ctx.language === 'ms'
    ? { hero: 'GIGI PUTIH 3X LEBIH CEPAT', tag: 'Senyum yakin dalam 14 hari' }
    : { hero: 'RĂNG TRẮNG NHANH 3 LẦN',   tag: 'Nụ cười tự tin trong 14 ngày' }
  return `${header(ctx)}

SLOT 1 — HERO HOOK
COMPOSITION: Product on transparent glass PODIUM, centered, slight 12° rotation. Soft brand-color SPOTLIGHT HALO from above grounding the product. Subtle floating decorative particles (3-5 max) around — sparkles or geometric shapes in accent color.
TEXT in image:
- TOP CENTER, giant bold (~140px) white with subtle shadow: "${t.hero}"
- BELOW PRODUCT, italic medium (~46px) light tint with accent underline (~80px wide, 5px tall): "${t.tag}"`
}

export function buildPromptSlot2(ctx: PromptContext): string {
  const t = ctx.language === 'ms'
    ? { q: 'Gigi kuning sebab kopi & rokok?', b: ['Tak yakin nak senyum', 'Bau mulut tak fresh', 'Whitening klinik RM500+'] }
    : { q: 'Răng vàng vì cà phê & thuốc?',   b: ['Ngại cười trước người', 'Hơi thở không thơm', 'Whitening nha khoa 5tr+'] }
  return `${header(ctx)}

SLOT 2 — PAIN POINT
COMPOSITION: Documentary close-up of the painful "before" state (e.g., yellowed teeth macro), slight desaturation (-15%) to convey discomfort. The product (matching refs) floats in BOTTOM-RIGHT corner, small (~18%), tilted, glowing softly as if "the answer".
TEXT in image:
- TOP CENTER, bold (~90px) white with shadow: "${t.q}"
- LEFT-SIDE STACK, 3 bullets with red ✗ + bold (~42px each):
  ✗ ${t.b[0]}
  ✗ ${t.b[1]}
  ✗ ${t.b[2]}`
}

export function buildPromptSlot3(ctx: PromptContext): string {
  const t = ctx.language === 'ms'
    ? { before: 'SEBELUM', after: 'SELEPAS', metric: '+8 SHADE', sub: 'DALAM 14 HARI', disc: '*Hasil mungkin berbeza individu' }
    : { before: 'TRƯỚC',   after: 'SAU',     metric: '+8 SHADE', sub: 'SAU 14 NGÀY',    disc: '*Kết quả có thể khác tùy người' }
  return `${header(ctx)}

SLOT 3 — TRANSFORMATION
COMPOSITION: 50/50 SYMMETRIC vertical split — LEFT "before" (yellowed teeth), RIGHT "after" (whitened). SAME camera angle + SAME lighting (credibility critical). Thin vertical accent-color divider with subtle glow. Product floats lower-center over the divide, small.
TEXT in image:
- TOP labels (~38px bold tracking-wide white with shadow): left="${t.before}", right="${t.after}"
- CENTER GIANT (~180px ExtraBold accent color with strong shadow): "${t.metric}"
- Below metric (~46px bold uppercase white): "${t.sub}"
- Bottom small italic (~24px tinted): "${t.disc}"`
}

export function buildPromptSlot4(ctx: PromptContext): string {
  const t = ctx.language === 'ms'
    ? { title: 'FORMULA AKTIF', sub: 'Bahan semula jadi, selamat untuk enamel' }
    : { title: 'CÔNG THỨC HOẠT TÍNH', sub: 'Thành phần tự nhiên, an toàn cho men răng' }
  const ings = (ctx.product.ingredients || '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 5)
  const ingLine = ings.length > 0 ? ings.join(', ') : '(read from product label in refs)'
  return `${header(ctx)}

SLOT 4 — USP / MECHANISM (ref style: EXOLABO V-SHINE ingredient panel)
COMPOSITION: Product centered slightly LEFT on subtle podium. Around it: 4-5 REAL-LOOKING ingredient elements (charcoal pieces, mint leaves, vitamin powder, crystals) floating with realistic shadows — macro photography style, NOT cartoon icons.
TEXT in image:
- TOP CENTER giant bold (~120px) white: "${t.title}"
- RIGHT-SIDE STACK of 4-5 pill-shaped chips (white rounded rect + soft shadow), each containing: small CUSTOM-DESIGNED icon (leaf for plant, drop for liquid, crystal/diamond for mineral, shield for protection — NOT emoji), numbered accent badge (1-5), ingredient name + percentage in bold dark navy:
  ${ingLine}
- BOTTOM italic (~26px) tinted: "${t.sub}"`
}

export function buildPromptSlot5(ctx: PromptContext): string {
  const t = ctx.language === 'ms'
    ? { q: 'Selepas 2 minggu, gigi saya jauh lebih putih. Suami pun perasan!', a: 'Aisyah, 34, Kuala Lumpur', v: 'Ulasan pelanggan sebenar' }
    : { q: 'Sau 2 tuần, răng tôi trắng hơn nhiều. Chồng cũng để ý!',           a: 'Linh, 32, TP.HCM',             v: 'Đánh giá khách hàng thật' }
  return `${header(ctx)}

SLOT 5 — SOCIAL PROOF
COMPOSITION: Soft brand-tint bg (lighter shade of primary). Product small ~18% bottom-left corner. Big white rounded testimonial card center-right (~70% area), generous shadow. Giant decorative "❝" behind card in accent color at 15% opacity.
TEXT in card:
- TOP large amber stars: ⭐⭐⭐⭐⭐
- CENTER italic (~46px) dark navy: "${t.q}"
- BOTTOM bold (~32px) gray: "— ${t.a}"
- Below card, small italic (~22px) soft gray: "${t.v}"`
}

export function buildPromptSlot6(ctx: PromptContext): string {
  const t = ctx.language === 'ms'
    ? { title: 'CARA GUNA — 3 LANGKAH', s: ['Basahkan berus gigi', 'Celup dalam serbuk', 'Berus 2 minit, 2x sehari'], time: '🌅 Pagi • 🌙 Malam' }
    : { title: 'CÁCH DÙNG — 3 BƯỚC',     s: ['Làm ướt bàn chải',  'Chấm vào bột',         'Đánh 2 phút, 2 lần/ngày'], time: '🌅 Sáng • 🌙 Tối' }
  return `${header(ctx)}

SLOT 6 — USAGE DEMO
COMPOSITION: TRIPTYCH — 3 instances of product in horizontal sequence, each in slightly different angle/state representing the step (closed jar → finger dipping → applied to brush). Soft bathroom/vanity context bg, NOT cluttered. Subtle vertical accent-color dividers between panels.
TEXT in image:
- TOP CENTER bold (~110px) dark primary or white (depending on bg): "${t.title}"
- BELOW EACH PRODUCT (3 columns): big accent-color circle (~90px) with white number 1/2/3, then bold step text (~38px) below:
  Col 1: "${t.s[0]}"
  Col 2: "${t.s[1]}"
  Col 3: "${t.s[2]}"
- BOTTOM center (~32px) tinted: "${t.time}"`
}

export function buildPromptSlot7(ctx: PromptContext): string {
  const t = ctx.language === 'ms'
    ? { title: 'PILIH YANG BAIK', us: 'Pilihan natural', them: 'Bahan kimia', points: [
        ['RM 89', 'RM 250+'],
        ['14 hari', '30+ hari'],
        ['Tiada sakit', 'Sensitif'],
        ['Semula jadi', 'Kimia'],
      ] }
    : { title: 'LỰA CHỌN ĐÚNG', us: 'Tự nhiên', them: 'Hóa chất', points: [
        ['500K', '2.5tr+'],
        ['14 ngày', '30+ ngày'],
        ['Không đau', 'Ê buốt'],
        ['Tự nhiên', 'Hóa chất'],
      ] }
  const pointsStr = t.points.map(([a, b]) => `${a} vs ${b}`).join(' / ')
  return `${header(ctx)}

SLOT 7 — COMPARISON (VS visual, NOT table)
COMPOSITION: SIDE-BY-SIDE split — LEFT half shows our product (matching refs) on accent-tinted pedestal with confident lighting + "${t.us}" label badge top. RIGHT half shows a GENERIC competitor product (unbranded blurred bottle/tube) on neutral pedestal with dimmer lighting + "${t.them}" label. Large bold "VS" in accent color sits at center between them.
TEXT in image:
- TOP CENTER bold (~110px) white with shadow: "${t.title}"
- BELOW PEDESTALS, 4 quick comparison rows with checkmark (left side) vs cross (right side), bold (~32px):
  ${pointsStr}
NO traditional table — use visual VS layout instead.`
}

export function buildPromptSlot8(ctx: PromptContext): string {
  const t = ctx.language === 'ms'
    ? { old: 'RM 159', cur: 'RM 89', disc: '-44%', combo: '+ FREE Berus Gigi Lembut (RM 25)', cta: 'BELI SEKARANG', urg: 'Stok terhad hari ini' }
    : { old: '999K',   cur: '500K',  disc: '-50%', combo: '+ TẶNG Bàn chải mềm (250K)',        cta: 'MUA NGAY',      urg: 'Số lượng có hạn hôm nay' }
  return `${header(ctx)}

SLOT 8 — OFFER (hero composition + price overlay)
COMPOSITION: Product hero shot in BOTTOM-RIGHT third, optionally with combo product (smaller, secondary) next to it. Energetic saturated bg (primary → warm accent). Top-left area clean for price block.
TEXT in image:
- UPPER-LEFT struck-through (~42px) light tint: "${t.old}"
- BELOW it, GIANT ExtraBold (~200px) white with shadow: "${t.cur}"
- AMBER PILL BADGE next to or below price (~50px dark bold): "${t.disc}"
- MIDDLE band bold (~42px) white: "${t.combo}"
- BOTTOM wide rounded BUTTON in accent color, big bold white inside (~58px) with shadow: "${t.cta}"
- Below button italic (~28px) light tint: "⏰ ${t.urg}"`
}

export function buildPromptSlot9(ctx: PromptContext): string {
  const t = ctx.language === 'ms'
    ? { title: 'SOALAN LAZIM', items: [
        { q: 'Selamat untuk enamel?', a: 'pH neutral, formula lembut' },
        { q: 'Bila nampak hasil?',    a: '7-14 hari, bergantung condition' },
        { q: 'Boleh pulangkan?',      a: 'Ya, 7 hari tanpa soal' },
      ] }
    : { title: 'CÂU HỎI THƯỜNG GẶP', items: [
        { q: 'An toàn cho men răng?', a: 'pH trung tính, công thức nhẹ' },
        { q: 'Khi nào thấy kết quả?',  a: '7-14 ngày, tùy tình trạng' },
        { q: 'Có được đổi trả?',       a: 'Có, 7 ngày miễn hỏi' },
      ] }
  const itemsStr = t.items.map((it, i) => `Card ${i + 1}: Q: "${it.q}" → A: "${it.a}"`).join(' / ')
  return `${header(ctx)}

SLOT 9 — FAQ & ASSURANCE
COMPOSITION: Soft light bg (secondary washing to neutral). Product small ~18% bottom-right corner. 3 white rounded cards stacked vertically center (~26% canvas height each, soft shadow).
TEXT in image:
- TOP CENTER bold (~110px) dark primary: "${t.title}"
- 3 cards content, each with accent-color "Q" badge square (~40px) on left, bold question (~38px) + answer prefixed with "→" (~30px gray):
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
