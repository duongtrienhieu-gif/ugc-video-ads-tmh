// Prompt builder for Nano Banana 2 image generation.
//
// CRITICAL DESIGN PRINCIPLE per [[feedback-product-fidelity-mandate]]:
//   The product in the output MUST match the reference images EXACTLY.
//   Same color, shape, label, brand name. NO drift, NO reinterpretation.
//   Aesthetic prescriptions ("matte plastic", "editorial") are AVOIDED here
//   because they cause the model to drift away from the actual product.
//
// Each slot prompt embeds the COMPLETE composition: scene + product placement
// + ALL text overlays + brand identity + trust bar — there is no separate
// canvas overlay layer anymore.
//
// Language hard-lock per [[feedback-language-isolation]] + [[project-target-market]]:
//   Default Bahasa Malaysia. VN secondary.

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
}

// ── Shared blocks (prepended to every slot prompt) ──────────────────────

function productFidelityBlock(ctx: PromptContext): string {
  // The single most important block. Repeated emphasis on EXACT replication.
  return `═══════════════════════════════════════════════════
PRODUCT FIDELITY — NON-NEGOTIABLE:
═══════════════════════════════════════════════════
The product in the output MUST match the reference images EXACTLY.

Reference images show the actual product the user is selling. You MUST:
- Reproduce the SAME exact color (if reference is purple, output MUST be purple — NOT white, NOT orange, NOT any other color)
- Reproduce the SAME exact shape (jar vs bottle vs tube — keep what reference shows)
- Reproduce the SAME label design (preserve label colors, layout, text orientation)
- Reproduce the SAME brand name and text on the label (read from reference, keep visible)
- Reproduce the SAME cap color and material
- Reproduce the SAME packaging style and proportions

The product appearance is INVARIANT — only the scene around it varies per slot.

DO NOT:
- Redesign the product
- Generate a "similar" product
- Change product color, shape, or label
- Substitute with a generic pharmacy bottle or supplement jar

If you cannot reproduce the product accurately from the references, return an
error rather than generating a different product.

Product name (for context only — the appearance comes from REFERENCES, not this name):
"${ctx.product.productName}"
${ctx.product.productDescription ? `Product description: "${ctx.product.productDescription}"` : ''}
═══════════════════════════════════════════════════`
}

function brandIdentityBlock(ctx: PromptContext): string {
  const flag = ctx.brandKit.flagOrigin ? `${ctx.brandKit.flagOrigin.toUpperCase()} flag` : ''
  const tagline = ctx.brandKit.tagline ? `Brand tagline (small under store name): "${ctx.brandKit.tagline}"` : ''
  return `BRAND IDENTITY (must appear in EVERY image, consistent across all 9 slots):
- Top-left corner small zone (about 8% of canvas height):
  - Brand store name text: "${ctx.brandKit.storeName}"
  - ${flag ? `Small ${flag} chip badge next to store name` : ''}
  ${tagline}
- This zone is small and unobtrusive — it identifies the seller but does NOT
  compete with the main message of the slot.`
}

function trustBarBlock(ctx: PromptContext): string {
  const items = ctx.language === 'ms'
    ? '📦 Stok Malaysia · 🚚 Penghantaran 1-3 hari · ↩️ Pulangan 7 hari · 🤫 Pembungkusan diskret'
    : '📦 Sẵn hàng VN · 🚚 Giao 1-3 ngày · ↩️ Đổi trả 7 ngày · 🤫 Đóng gói kín đáo'
  return `TRUST BAR (must appear at bottom of EVERY image, consistent):
- Single thin strip at the very bottom (~6% of canvas height)
- Text content (single line, evenly spaced, small but readable on mobile thumbnail):
  "${items}"
- Style: light background tint or transparent overlay, dark text — must be
  legible without dominating. ALL safe service claims only — NO cert badges.`
}

function paletteBlock(ctx: PromptContext): string {
  const p = TPCN_PALETTES[ctx.paletteFamily]
  return `BRAND COLORS (use ONLY these for background, accents, and overlay graphics — do NOT introduce other colors):
- Primary: ${p.primary}
- Secondary: ${p.secondary}
- Accent / CTA: ${p.cta}
- Neutral (white): ${p.neutral}`
}

function languageLockBlock(lang: Market): string {
  if (lang === 'ms') {
    return `LANGUAGE: ALL text in the image must be in Bahasa Malaysia ONLY.
NO English, Vietnamese, Chinese, Japanese, Arabic, Thai characters anywhere in the image.
Spell every word correctly — typos are unacceptable.
Render text bold and large enough to read on a mobile thumbnail (300px wide).`
  }
  return `LANGUAGE: ALL text in the image must be in Vietnamese ONLY (with proper diacritics).
NO English, Malay, Chinese, Japanese, Arabic, Thai characters anywhere in the image.
Spell every word correctly with correct dấu — typos are unacceptable.
Render text bold and large enough to read on a mobile thumbnail (300px wide).`
}

function commonHeader(ctx: PromptContext): string {
  return [
    `Generate a 1:1 square TikTok Shop product listing image (1024×1024).`,
    productFidelityBlock(ctx),
    brandIdentityBlock(ctx),
    trustBarBlock(ctx),
    paletteBlock(ctx),
    languageLockBlock(ctx.language),
  ].join('\n\n')
}

// ── Per-slot prompts ────────────────────────────────────────────────────
// Each slot adds: SCENE description + TEXT OVERLAY content + sizing rules.

export function buildPromptSlot1(ctx: PromptContext): string {
  const lang = ctx.language === 'ms'
    ? {
        headline: 'GIGI PUTIH 3X LEBIH CEPAT',
        tagline: 'Senyum yakin dalam 14 hari',
      }
    : {
        headline: 'RĂNG TRẮNG NHANH GẤP 3 LẦN',
        tagline: 'Nụ cười tự tin sau 14 ngày',
      }

  return `${commonHeader(ctx)}

═══════════════════════════════════════════════════
SLOT 1 — HERO HOOK
═══════════════════════════════════════════════════
SCENE: Clean gradient background (primary → secondary, diagonal top-left to bottom-right).
The product (matching references EXACTLY) is centered, with slight ~15° natural rotation,
occupying about 50-55% of canvas height, positioned in the lower-center sweet spot.
Subtle realistic shadow under product. Premium first-impression feel — confident but inviting.

TEXT OVERLAYS (render directly in the image, large and bold):
- TOP CENTER, very large bold sans-serif (~120-140px), in white with subtle drop shadow:
  "${lang.headline}"
- BELOW THE PRODUCT, italic medium (~40-48px), in light tint:
  "${lang.tagline}"
- A thin accent-color underline (5-8px) above the tagline, centered, ~80px wide.

Negative space at top 25% and bottom 18% holds the headline + tagline cleanly.
Brand identity (top-left) and trust bar (bottom) are small but always present.`
}

export function buildPromptSlot2(ctx: PromptContext): string {
  const lang = ctx.language === 'ms'
    ? {
        question: 'Gigi kuning sebab kopi & rokok?',
        bullets: ['Tak yakin nak senyum', 'Bau mulut tak fresh', 'Whitening klinik mahal RM500+'],
      }
    : {
        question: 'Răng vàng vì cà phê & thuốc lá?',
        bullets: ['Ngại cười trước mọi người', 'Hơi thở không thơm', 'Whitening nha khoa đắt 5 triệu+'],
      }

  return `${commonHeader(ctx)}

═══════════════════════════════════════════════════
SLOT 2 — PAIN POINT
═══════════════════════════════════════════════════
SCENE: Documentary-style close-up that shows the "before" state — the problem
this product solves. For a teeth-whitening product: a realistic close-up of
yellowed/stained teeth, slight desaturation (~-15%) to convey discomfort.
For other products: the equivalent painful state.
The product (matching references) appears small in the bottom-right corner (~20% size),
slightly tilted, suggesting "the solution is here".
Background uses the brand secondary color softly.

TEXT OVERLAYS:
- TOP CENTER, large bold (~80-90px), in white or primary color depending on bg:
  "${lang.question}"
- LEFT SIDE STACK, 3 bullets with ✗ red mark + bold text (~36-44px each):
  ✗ ${lang.bullets[0]}
  ✗ ${lang.bullets[1]}
  ✗ ${lang.bullets[2]}

The pain visual occupies right 60% of canvas; text on left 40%.`
}

export function buildPromptSlot3(ctx: PromptContext): string {
  const lang = ctx.language === 'ms'
    ? {
        beforeLabel: 'SEBELUM',
        afterLabel: 'SELEPAS',
        metric: '+8 SHADE',
        metricSub: 'DALAM 14 HARI',
        disclaimer: '*Hasil mungkin berbeza individu',
      }
    : {
        beforeLabel: 'TRƯỚC',
        afterLabel: 'SAU',
        metric: '+8 SHADE',
        metricSub: 'SAU 14 NGÀY',
        disclaimer: '*Kết quả có thể khác nhau tùy cơ địa',
      }

  return `${commonHeader(ctx)}

═══════════════════════════════════════════════════
SLOT 3 — TRANSFORMATION / RESULT
═══════════════════════════════════════════════════
SCENE: A 50/50 SYMMETRIC vertical split-screen.
LEFT HALF shows the "before" state (e.g., yellowed teeth close-up).
RIGHT HALF shows the "after" state (e.g., whitened, brighter teeth — same person/area).
CRITICAL: same camera angle, same lighting on both halves — equal lighting is essential
for credibility. Do NOT use different lighting that fakes the after.
The product (matching references) is small and floats in the lower-center, overlapping
the split line subtly, as if "delivering the result".

TEXT OVERLAYS:
- VERY TOP, two small labels (~32-40px bold uppercase tracking-wide):
  - Left half: "${lang.beforeLabel}"
  - Right half: "${lang.afterLabel}"
- CENTER (over the split line, dominating the frame), GIANT metric in accent color
  (~160-180px ExtraBold with strong drop shadow):
  "${lang.metric}"
- Just below the metric, medium bold uppercase (~40-48px):
  "${lang.metricSub}"
- BOTTOM (above trust bar), small italic disclaimer (~22-26px):
  "${lang.disclaimer}"`
}

export function buildPromptSlot4(ctx: PromptContext): string {
  const lang = ctx.language === 'ms'
    ? { title: 'FORMULA AKTIF', subtitle: 'Bahan semula jadi, selamat untuk enamel' }
    : { title: 'CÔNG THỨC HOẠT TÍNH', subtitle: 'Thành phần tự nhiên, an toàn cho men răng' }

  // Pull ingredients from product if available; fallback to generic
  const ingredients = (ctx.product.ingredients || '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 5)
  const ingredientsList = ingredients.length > 0
    ? ingredients.map((ing, i) => `  ${i + 1}. ${ing}`).join('\n')
    : '  (use the ingredients shown on the product label from references — read them carefully)'

  return `${commonHeader(ctx)}

═══════════════════════════════════════════════════
SLOT 4 — USP / MECHANISM
═══════════════════════════════════════════════════
SCENE: The product (matching references) is centered slightly to the left.
Around the product, 4-5 REAL-LOOKING ingredient elements float at natural positions
(e.g., charcoal pieces, mint leaves, vitamin powder, mineral crystals) — each with its
own realistic shadow grounding it. Ingredients should look like macro photography
of actual physical material, NOT 3D-rendered icons or illustrations.
Background uses primary color gradient.

TEXT OVERLAYS:
- TOP CENTER, very large bold (~110-130px), in white:
  "${lang.title}"
- RIGHT SIDE STACK of 4-5 pill-shaped ingredient chips (rounded rectangles with white fill
  and subtle shadow), each containing a numbered circle (accent color) + ingredient name + percentage,
  text ~32-40px bold dark navy:
${ingredientsList}
- BOTTOM (above trust bar), small italic (~22-26px):
  "${lang.subtitle}"`
}

export function buildPromptSlot5(ctx: PromptContext): string {
  const lang = ctx.language === 'ms'
    ? {
        quote: 'Selepas 2 minggu guna, gigi saya jauh lebih putih. Suami pun perasan!',
        author: 'Aisyah, 34, Kuala Lumpur',
        verified: 'Ulasan pelanggan sebenar',
      }
    : {
        quote: 'Sau 2 tuần dùng, răng tôi trắng hơn nhiều. Chồng cũng để ý!',
        author: 'Linh, 32, TP.HCM',
        verified: 'Đánh giá khách hàng thật',
      }

  return `${commonHeader(ctx)}

═══════════════════════════════════════════════════
SLOT 5 — SOCIAL PROOF
═══════════════════════════════════════════════════
SCENE: Soft light background (secondary color washing to neutral). The product (matching
references) sits in the lower-left corner small (~20% size). A large white testimonial
card with rounded corners and soft shadow occupies the center-right, ~70% of canvas area.
A giant decorative quotation mark "❝" in accent color (very low opacity ~15%) sits
behind the card.

TEXT OVERLAYS (all inside the white testimonial card):
- TOP OF CARD, large bold amber star rating:
  ⭐⭐⭐⭐⭐
- CENTER OF CARD, italic medium dark text (~40-48px), wrapped to fit:
  "${lang.quote}"
- BOTTOM OF CARD, bold smaller (~28-32px), aligned right or center:
  "— ${lang.author}"
- BELOW THE CARD outside, small italic (~22px) in soft gray:
  "${lang.verified}"`
}

export function buildPromptSlot6(ctx: PromptContext): string {
  const lang = ctx.language === 'ms'
    ? {
        title: 'CARA GUNA — 3 LANGKAH',
        steps: ['Basahkan berus gigi', 'Celup dalam serbuk', 'Berus 2 minit, 2x sehari'],
        timing: '🌅 Pagi    •    🌙 Malam',
      }
    : {
        title: 'CÁCH DÙNG — 3 BƯỚC',
        steps: ['Làm ướt bàn chải', 'Chấm vào bột', 'Đánh 2 phút, 2 lần/ngày'],
        timing: '🌅 Sáng    •    🌙 Tối',
      }

  return `${commonHeader(ctx)}

═══════════════════════════════════════════════════
SLOT 6 — USAGE DEMO
═══════════════════════════════════════════════════
SCENE: A clean instructional layout. Three instances of the product (matching references)
are placed in a horizontal triptych — one per step. Each instance is in a slightly
different position/angle representing the step. Background is a soft bathroom/vanity
setting tone, NOT cluttered. Subtle vertical dividers between the 3 panels (light gray).

TEXT OVERLAYS:
- TOP CENTER, large bold (~96-110px), in dark primary color (bg is light):
  "${lang.title}"
- BELOW EACH PRODUCT INSTANCE (3 columns), centered:
  - Large numbered circle in accent color with white number 1/2/3 (~80-100px diameter)
  - Step text below, bold dark (~32-40px), short and clear:
    Column 1: "${lang.steps[0]}"
    Column 2: "${lang.steps[1]}"
    Column 3: "${lang.steps[2]}"
- BOTTOM (above trust bar), centered medium (~28-32px) in dark gray:
  "${lang.timing}"`
}

export function buildPromptSlot7(ctx: PromptContext): string {
  const lang = ctx.language === 'ms'
    ? {
        title: 'PILIH YANG BAIK',
        usHeader: 'Pilihan natural',
        themHeader: 'Bahan kimia',
        rows: [
          ['RM 89', 'RM 250+'],
          ['14 hari', '30+ hari'],
          ['Tiada sakit', 'Sensitif'],
          ['Semula jadi', 'Kimia'],
        ],
      }
    : {
        title: 'LỰA CHỌN ĐÚNG',
        usHeader: 'Tự nhiên',
        themHeader: 'Hóa chất',
        rows: [
          ['500K', '2.5tr+'],
          ['14 ngày', '30+ ngày'],
          ['Không đau', 'Ê buốt'],
          ['Tự nhiên', 'Hóa chất'],
        ],
      }

  const rowsRendered = lang.rows.map(([a, b]) => `  | ${a} | ${b} |`).join('\n')

  return `${commonHeader(ctx)}

═══════════════════════════════════════════════════
SLOT 7 — COMPARISON
═══════════════════════════════════════════════════
SCENE: Product (matching references) sits in the TOP-CENTER smaller scale (~25%),
slightly angled. Bottom 70% of canvas reserved for the comparison table.
Background: energetic gradient (primary intensified, slight accent edge glow).

TEXT OVERLAYS:
- TOP CENTER ABOVE PRODUCT, large bold (~100-120px), in white:
  "${lang.title}"
- COMPARISON TABLE (2 columns, bottom 60% of canvas):
  - Table background: white rounded card with subtle shadow
  - Left column header (highlighted accent-color tint background):
    "${lang.usHeader}"
  - Right column header (neutral):
    "${lang.themHeader}"
  - 4 rows below headers, each row separated by thin gray line, bold text ~32-40px:
${rowsRendered}
  - Left column cells: dark navy bold (we win)
  - Right column cells: medium gray regular (competitor)`
}

export function buildPromptSlot8(ctx: PromptContext): string {
  const lang = ctx.language === 'ms'
    ? {
        original: 'RM 159',
        current: 'RM 89',
        discount: '-44%',
        combo: '+ FREE Berus Gigi Lembut (RM 25)',
        cta: 'BELI SEKARANG',
        urgency: 'Stok terhad hari ini',
      }
    : {
        original: '999K',
        current: '500K',
        discount: '-50%',
        combo: '+ TẶNG Bàn chải mềm (250K)',
        cta: 'MUA NGAY',
        urgency: 'Số lượng có hạn hôm nay',
      }

  return `${commonHeader(ctx)}

═══════════════════════════════════════════════════
SLOT 8 — OFFER / COMBO
═══════════════════════════════════════════════════
SCENE: Hero shot of the product (matching references) in the BOTTOM-RIGHT third,
slight forward lean, optimistic confident mood. Energetic background gradient
(primary to warmer accent). Top-left area kept clean for price block.

TEXT OVERLAYS:
- UPPER-LEFT, struck-through medium (~36-44px) in light tint:
  "${lang.original}"
- BELOW, GIANT current price in white bold ExtraBold (~180-200px):
  "${lang.current}"
- TO THE RIGHT OF PRICE OR BELOW, amber pill badge with bold dark text (~44-52px):
  "${lang.discount}"
- MIDDLE, medium bold white text (~36-44px):
  "${lang.combo}"
- BOTTOM AREA (above trust bar), wide rounded button in accent color, large bold white
  text inside (~52-60px), with subtle drop shadow:
  "${lang.cta}"
- BELOW THE BUTTON, small italic (~24-28px) in light tint:
  "⏰ ${lang.urgency}"`
}

export function buildPromptSlot9(ctx: PromptContext): string {
  const lang = ctx.language === 'ms'
    ? {
        title: 'SOALAN LAZIM',
        items: [
          { q: 'Selamat untuk enamel?',    a: 'Ya, pH neutral, formula lembut' },
          { q: 'Bila nampak hasil?',       a: '7-14 hari, bergantung condition' },
          { q: 'Boleh pulangkan?',         a: 'Ya, pulangan 7 hari tanpa soal' },
        ],
      }
    : {
        title: 'CÂU HỎI THƯỜNG GẶP',
        items: [
          { q: 'Có an toàn cho men răng?',     a: 'Có, pH trung tính, công thức nhẹ' },
          { q: 'Khi nào thấy kết quả?',         a: '7-14 ngày, tùy tình trạng' },
          { q: 'Có được đổi trả?',              a: 'Có, đổi trả 7 ngày miễn hỏi' },
        ],
      }

  const itemsRendered = lang.items
    .map((it, i) => `  Card ${i + 1}:\n    Q: ${it.q}\n    A: → ${it.a}`)
    .join('\n')

  return `${commonHeader(ctx)}

═══════════════════════════════════════════════════
SLOT 9 — FAQ & ASSURANCE
═══════════════════════════════════════════════════
SCENE: Soft light background (secondary washing to neutral white). The product
(matching references) sits in the lower-right corner small (~18% size), subtle.
The main visual focus is the FAQ cards stacked vertically.

TEXT OVERLAYS:
- TOP CENTER, large bold (~100-120px) in dark primary color:
  "${lang.title}"
- 3 WHITE ROUNDED CARDS stacked vertically (each ~28% canvas height, with soft shadow):
${itemsRendered}
- Each card layout:
  - Left side: small accent-color "Q" badge square (~40px)
  - Question text (bold dark navy ~32-40px) to the right of badge
  - Answer text below question (medium gray ~28-34px), prefixed with "→"`
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
