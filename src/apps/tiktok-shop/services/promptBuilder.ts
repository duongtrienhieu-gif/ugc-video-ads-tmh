// Prompt builder for gpt-4o-image (TRUE i2i editing via filesUrl).
//
// DESIGN PRINCIPLES:
//   1. LEAN — ~150 words/slot total. Long prompts cause AI to ignore later
//      instructions + crowd out creative space. Use keywords, not paragraphs.
//   2. PRODUCT FIDELITY first — refs are passed via filesUrl and identified
//      by role (logo + product photos). One short replication directive.
//   3. PROFESSIONAL aesthetic — reference specific brands AI knows
//      (Pentavite Australia, BBOJI Korean) rather than vague "premium feel".
//   4. CONCRETE decor — name 3 specific elements per slot, not exhaustive list.
//   5. EMBEDDED text — exact strings the AI must render, in {lang}.

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
  /** True when brand kit logo URL was prepended to filesUrl (first ref).
   *  Lets the prompt tell AI which ref is logo vs product. */
  hasLogoRef: boolean
}

// ── Shared header (~80 words) — appears in every slot prompt ────────────

function header(ctx: PromptContext): string {
  const p = TPCN_PALETTES[ctx.paletteFamily]
  const productRefHint = ctx.hasLogoRef
    ? 'Reference 1 = brand logo (preserve exactly). References 2+ = product photos.'
    : 'All references are product photos.'
  const langName = ctx.language === 'ms' ? 'Bahasa Malaysia' : 'Vietnamese'

  return `1:1 square TikTok Shop image (1024×1024). ${productRefHint}

PRODUCT: Replicate EXACTLY from refs — same color, shape, label, brand name. Do NOT redesign or substitute.

BRAND: Logo top-left in 8% zone with store name "${ctx.brandKit.storeName}"${ctx.brandKit.flagOrigin ? ` + ${ctx.brandKit.flagOrigin.toUpperCase()} flag chip` : ''}. Same position EVERY slot.

STYLE: Premium TPCN catalog like Pentavite Australia / BBOJI Korean — info-heavy yet clean, bold typography, integrated decor. Plus Jakarta Sans ExtraBold for headlines (weight 800-900), Medium Italic for sub-text. Palette ONLY: ${p.primary} primary, ${p.secondary} secondary, ${p.cta} accent. Saturated, not washed out.

DECOR (subtle, intentional): geometric corner accent in accent color + thin accent-color divider line under headline + soft accent-color glow halo (low opacity) behind hero text. NO molecular bg, NO leaves, NO sparkles.

HIERARCHY: Strict — text zones NEVER overlap product. Mobile-readable at 300px thumbnail.

TRUST BAR (bottom 6%): "${ctx.language === 'ms'
    ? '📦 Stok Malaysia · 🚚 1-3 hari · ↩️ Pulangan 7 hari · 🤫 Diskret'
    : '📦 Sẵn hàng VN · 🚚 1-3 ngày · ↩️ Đổi trả 7 ngày · 🤫 Đóng gói kín'}"

LANGUAGE: ${langName} ONLY in image. No mixing with other languages.`
}

// ── Per-slot blocks (~70 words each) ─────────────────────────────────────

export function buildPromptSlot1(ctx: PromptContext): string {
  const t = ctx.language === 'ms'
    ? { hero: 'GIGI PUTIH 3X LEBIH CEPAT', tag: 'Senyum yakin dalam 14 hari' }
    : { hero: 'RĂNG TRẮNG NHANH 3 LẦN',   tag: 'Nụ cười tự tin trong 14 ngày' }
  return `${header(ctx)}

SLOT 1 — HERO HOOK
Product centered, slight 15° rotation, ~55% canvas height, lower-center sweet spot. Diagonal gradient bg (primary→secondary).
Text in image:
- TOP CENTER, giant bold (~130px) white with shadow: "${t.hero}"
- BELOW PRODUCT, italic (~44px) light tint with accent underline: "${t.tag}"`
}

export function buildPromptSlot2(ctx: PromptContext): string {
  const t = ctx.language === 'ms'
    ? { q: 'Gigi kuning sebab kopi & rokok?', b: ['Tak yakin nak senyum', 'Bau mulut tak fresh', 'Whitening klinik RM500+'] }
    : { q: 'Răng vàng vì cà phê & thuốc?',   b: ['Ngại cười trước người', 'Hơi thở không thơm', 'Whitening nha khoa 5tr+'] }
  return `${header(ctx)}

SLOT 2 — PAIN POINT
Documentary close-up of the painful "before" state (e.g., yellowed teeth macro). Slight desaturation (-15%). Product small ~18% in bottom-right corner. Soft bg.
Text in image:
- TOP, bold (~85px): "${t.q}"
- LEFT-SIDE STACK, 3 bullets with red ✗ + bold (~40px each):
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
50/50 SYMMETRIC vertical split — left "before" (yellowed), right "after" (white). SAME camera angle + SAME lighting on both halves (credibility-critical). Product small floats lower-center over split.
Text in image:
- TOP labels (~36px bold tracking-wide): left="${t.before}", right="${t.after}"
- CENTER GIANT (~170px ExtraBold accent color with shadow): "${t.metric}"
- Below metric (~44px bold uppercase): "${t.sub}"
- Tiny italic bottom (~24px): "${t.disc}"`
}

export function buildPromptSlot4(ctx: PromptContext): string {
  const t = ctx.language === 'ms'
    ? { title: 'FORMULA AKTIF', sub: 'Bahan semula jadi, selamat untuk enamel' }
    : { title: 'CÔNG THỨC HOẠT TÍNH', sub: 'Thành phần tự nhiên, an toàn cho men răng' }
  const ings = (ctx.product.ingredients || '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 5)
  const ingLine = ings.length > 0 ? ings.join(', ') : '(read from product label in refs)'
  return `${header(ctx)}

SLOT 4 — USP / MECHANISM
Product centered slightly LEFT. 4-5 REAL-LOOKING ingredient elements float around with realistic shadows — macro photography style, NOT cartoon icons.
Text in image:
- TOP CENTER giant bold (~120px) white: "${t.title}"
- RIGHT-SIDE STACK 4-5 pill chips (white rounded rect + shadow), each with numbered accent badge + ingredient + %: ${ingLine}
- BOTTOM italic (~24px): "${t.sub}"`
}

export function buildPromptSlot5(ctx: PromptContext): string {
  const t = ctx.language === 'ms'
    ? { q: 'Selepas 2 minggu, gigi saya jauh lebih putih. Suami pun perasan!', a: 'Aisyah, 34, Kuala Lumpur', v: 'Ulasan pelanggan sebenar' }
    : { q: 'Sau 2 tuần, răng tôi trắng hơn nhiều. Chồng cũng để ý!',           a: 'Linh, 32, TP.HCM',             v: 'Đánh giá khách hàng thật' }
  return `${header(ctx)}

SLOT 5 — SOCIAL PROOF
Light bg (secondary→neutral). Product small ~18% bottom-left corner. Big white rounded card center-right (~70% area) with soft shadow. Giant decorative "❝" behind card in accent color at 15% opacity.
Text in card:
- TOP large amber stars: ⭐⭐⭐⭐⭐
- CENTER italic (~44px) dark: "${t.q}"
- BOTTOM bold (~30px): "— ${t.a}"
- Below card, small italic (~22px) gray: "${t.v}"`
}

export function buildPromptSlot6(ctx: PromptContext): string {
  const t = ctx.language === 'ms'
    ? { title: 'CARA GUNA — 3 LANGKAH', s: ['Basahkan berus gigi', 'Celup dalam serbuk', 'Berus 2 minit, 2x sehari'], time: '🌅 Pagi • 🌙 Malam' }
    : { title: 'CÁCH DÙNG — 3 BƯỚC',     s: ['Làm ướt bàn chải',  'Chấm vào bột',         'Đánh 2 phút, 2 lần/ngày'], time: '🌅 Sáng • 🌙 Tối' }
  return `${header(ctx)}

SLOT 6 — USAGE DEMO
3 instances of product in horizontal triptych — one per step, slightly different angle each. Soft bathroom/vanity bg, NOT cluttered. Subtle vertical dividers between panels.
Text in image:
- TOP CENTER bold (~100px) dark primary: "${t.title}"
- BELOW EACH PRODUCT (3 columns): big accent circle with white number 1/2/3 (~90px diameter), then bold (~36px) step text:
  Col 1: "${t.s[0]}"
  Col 2: "${t.s[1]}"
  Col 3: "${t.s[2]}"
- BOTTOM center (~30px): "${t.time}"`
}

export function buildPromptSlot7(ctx: PromptContext): string {
  const t = ctx.language === 'ms'
    ? { title: 'PILIH YANG BAIK', us: 'Pilihan natural', them: 'Bahan kimia', rows: [['RM 89', 'RM 250+'], ['14 hari', '30+ hari'], ['Tiada sakit', 'Sensitif'], ['Semula jadi', 'Kimia']] }
    : { title: 'LỰA CHỌN ĐÚNG',   us: 'Tự nhiên',       them: 'Hóa chất',    rows: [['500K', '2.5tr+'], ['14 ngày', '30+ ngày'], ['Không đau', 'Ê buốt'], ['Tự nhiên', 'Hóa chất']] }
  const rowsStr = t.rows.map(([a, b]) => `${a} | ${b}`).join(' / ')
  return `${header(ctx)}

SLOT 7 — COMPARISON
Product top-center ~25% scale, slight angle. Bottom 70% reserved for table. Energetic bg.
Text in image:
- TOP large bold (~110px) white: "${t.title}"
- COMPARISON TABLE (white rounded card + shadow, 2 cols):
  - Headers (~30px bold): LEFT (accent-tinted bg) = "${t.us}", RIGHT = "${t.them}"
  - 4 rows (~36px), left = dark navy bold (winning), right = medium gray:
    ${rowsStr}`
}

export function buildPromptSlot8(ctx: PromptContext): string {
  const t = ctx.language === 'ms'
    ? { old: 'RM 159', cur: 'RM 89', disc: '-44%', combo: '+ FREE Berus Gigi Lembut (RM 25)', cta: 'BELI SEKARANG', urg: 'Stok terhad hari ini' }
    : { old: '999K',   cur: '500K',  disc: '-50%', combo: '+ TẶNG Bàn chải mềm (250K)',        cta: 'MUA NGAY',      urg: 'Số lượng có hạn hôm nay' }
  return `${header(ctx)}

SLOT 8 — OFFER
Product hero in bottom-right third. Energetic bg (primary → warm accent). Top-left clean for price block.
Text in image:
- UPPER-LEFT struck-through (~40px) light tint: "${t.old}"
- BELOW GIANT ExtraBold (~190px) white: "${t.cur}"
- AMBER PILL BADGE (~48px) dark: "${t.disc}"
- MIDDLE bold (~40px) white: "${t.combo}"
- BOTTOM wide rounded BUTTON accent color, big bold white inside (~56px) with shadow: "${t.cta}"
- Below button italic (~26px): "⏰ ${t.urg}"`
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
Light bg. Product small ~18% bottom-right corner. 3 white rounded cards stacked vertically center (each ~26% canvas height, soft shadow).
Text in image:
- TOP CENTER bold (~110px) dark primary: "${t.title}"
- 3 cards content, each with accent-color "Q" badge square (~40px) on left, bold question (~36px) + answer prefixed with "→" (~30px gray):
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
