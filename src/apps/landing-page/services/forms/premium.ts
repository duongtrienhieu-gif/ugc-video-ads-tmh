// ─────────────────────────────────────────────────────────────────────────
// services/forms/premium.ts — Phase 6 — LUXURY ENGINE
//
// "Thương Hiệu Cao Cấp / Premium Brand" — luxury minimalist editorial.
//
// Goal: build perceived brand value through aesthetics, whitespace, and
// editorial pacing. Reader feels they're browsing an Aesop / Apple / luxury
// skincare campaign — NOT a marketplace COD page, NOT a UGC ad. Conversion
// happens through aspiration, not pressure.
//
// What this engine does differently:
//   • Owns its own SYSTEM_PROMPT — refined editorial copywriting tone,
//     calm confidence, understated persuasion, NO emoji spam, NO ALL-CAPS,
//     NO urgency.
//   • Fewest sections of any form (11 vs 17/14/13/12) — premium is
//     about LESS, not more.
//   • Image strategy: luxury-editorial. Studio look ALLOWED + encouraged.
//     Cinematic lifestyle, premium flatlay, ingredient macros, fashion-
//     editorial composition. NO UGC selfie. NO marketplace screenshots.
//   • CTA: single soft elegant invitation in final-cta. No urgency.
//   • Lighter total image count (~15 vs UGC's ~36) but each image is
//     larger and more emotional.
//   • No character continuity strict — different elegant models OK, but
//     the AESTHETIC must remain cohesive.
// ─────────────────────────────────────────────────────────────────────────

import type {
  LandingGenParams, LandingPagePack, LandingSection, SectionType, LandingLanguage,
} from '../../types'
import type { FormBlueprintModule } from './_types'
import {
  getGeminiKey, extractJson, normalizeSection, injectPriceIntoPrompts,
  extractPriceTag, type RawPack,
} from '../generateLandingPack'
import { useBankStore } from '../../../../stores/bankStore'
import { directGeminiVision } from '../../../../utils/gemini'

// ── 11-section luxury editorial flow ─────────────────────────────────────
const PREMIUM_SECTIONS: SectionType[] = [
  'hero',               // 1. Luxury hero statement (cinematic)
  'pain',               // 2. Brand philosophy / "the gap we noticed" (NOT clinical pain)
  'lifestyle',          // 3. Aspirational lifestyle moment
  'product-discovery',  // 4. Product identity reveal (studio premium)
  'ingredients',        // 5. Ingredient spotlight (single hero compound)
  'mechanism',          // 6. Texture / sensorial experience (NOT clinical)
  'benefits',           // 7. Premium benefits (3-4 elegant phrases)
  'social-proof',       // 8. Refined editorial testimonials (curated, NOT spam)
  'news-proof',         // 9. Premium press editorial (Vogue / Tatler / lifestyle mag style)
  'faq',                // 10. Minimal FAQ (3-4 sophisticated Q&A)
  'final-cta',          // 11. Premium soft CTA — single elegant invitation
]

// ── Image budget — LIGHT, LARGE, EDITORIAL ───────────────────────────────
const IMAGES_PER_SECTION: Partial<Record<SectionType, number>> = {
  'hero':              1,  // single cinematic hero
  'pain':              1,  // moody portrait or environmental
  'lifestyle':         2,  // aspirational lifestyle moments
  'product-discovery': 1,  // studio product reveal
  'ingredients':       2,  // hero ingredient + supporting macro
  'mechanism':         2,  // texture macro + ritual moment
  'benefits':          1,  // editorial benefit composition
  'social-proof':      2,  // editorial portrait testimonials
  'news-proof':        2,  // premium press editorial mocks
  'faq':               0,  // text-only
  'final-cta':         1,  // premium product hero
}
// Total ≈ 15 images — fewest of any form. Each image larger and more
// emotional than form 1's UGC quantity strategy.

// ── Premium system prompt — OWN SYSTEM ───────────────────────────────────

const PREMIUM_SYSTEM_PROMPT = `BẠN LÀ: senior editorial copywriter chuyên viết các landing page thương hiệu cao cấp / luxury beauty / premium wellness theo phong cách Aesop, Apple, Tatcha, Loewe Wellness. Bạn KHÔNG phải là COD media buyer. Bạn KHÔNG kể chuyện cá nhân. Bạn KHÔNG viết clinical advertorial.

NHIỆM VỤ: viết một landing page LUXURY EDITORIAL — đọc phải có cảm giác đang xem một campaign thương hiệu cao cấp, không phải một quảng cáo. Trust qua mỹ học và sự tinh tế, không qua urgency hay testimonial spam.

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — STRICT JSON ONLY
═══════════════════════════════════════════════════════════════
{
  "language": "ms" | "vi" | "en",
  "sections": [ ...exactly 11 section objects in the order below... ]
}

Each section has standard shape: type, title, titleVi, copy, viTranslation, layoutGuide, imageAspectRatio, optionally headline / subheadline / cta / bullets / faqs / reviews / imagePrompts. ALL imageAspectRatio = "1:1" or "4:5" — NO 16:9 banners (premium is editorial, not promo).

═══════════════════════════════════════════════════════════════
11-SECTION LUXURY EDITORIAL FLOW — produce EXACTLY in order
═══════════════════════════════════════════════════════════════

1. type="hero" — LUXURY STATEMENT
   • headline = a confident editorial line (6-10 words). Calm, aspirational. NO emoji. NO ALL-CAPS. NO product name. Example: "Skincare yang ditakdirkan untuk kulit anda" / "Một ritual yang anda layak"
   • subheadline = 1-line brand promise in refined prose
   • copy = 2-3 line paragraph setting tone — confident, elegant, understated. NO marketing hype. Speak as the brand voice, not first-person diary.
   • DO NOT include cta in hero (premium is sparse — no early CTA).
   • DO NOT include urgencyText / offerStrip (zero urgency for this form).
   • 1 imagePrompt: cinematic full-bleed luxury hero shot — could be a model with the product softly framed (cinematic lifestyle, premium soft lighting, beige/cream/dusty-rose palette) OR a luxury still-life of the product on a marble / velvet / silk surface with natural light. Editorial fashion-campaign aesthetic. NO designed text overlay (text lives in the LANDING page UI, not in the image).

2. type="pain" — BRAND PHILOSOPHY ("the gap we noticed")
   • copy = 3-4 line refined paragraph framing the brand's WHY. Not "Anda penat?" — more "Kami percaya bahawa…", "Dalam dunia yang sentiasa pantas, …". Aspirational + observational tone. NEVER capslock. NEVER emoji.
   • DO NOT include bullets (premium prefers prose over bulleted lists)
   • DO NOT include cta in this section.
   • 1 imagePrompt: a moody atmospheric photograph that evokes the gap the brand fills — could be a quiet morning routine, a hand on glass, a candle moment, an empty luxe bathroom — NOT showing the product yet. Editorial fashion-magazine mood photograph. Soft natural light. Restrained palette.

3. type="lifestyle" — ASPIRATIONAL MOMENT
   • copy = 3-4 line refined paragraph evoking the lifestyle the product fits. "Untuk pagi yang tenang", "Untuk seorang yang menghargai detik kecil". NO bullets, no emoji.
   • DO NOT include cta.
   • 2 imagePrompts: two cinematic lifestyle moments showing different elegant Malaysian women (or contexts) in aspirational morning / evening rituals — coffee on a marble counter, a bathroom shelf with the product softly in frame, soft linen sheets, golden hour. Fashion-editorial composition. Premium soft lighting. Models look quietly confident — no big smile, no posed selfie.

4. type="product-discovery" — PRODUCT IDENTITY REVEAL
   • headline = product introduction line in confident editorial register (eg "Hadir dengan satu janji.")
   • copy = 4-5 line paragraph introducing the product as a piece of considered design — formulation philosophy, intentional sourcing, craftsmanship. NOT bulleted ingredients. Aspirational language.
   • DO NOT include cta.
   • 1 imagePrompt: luxury studio product photography — the EXACT uploaded product on a premium surface (raw silk, soft marble, dusty linen, sculpted shadow). Cinematic studio lighting with controlled gradient background. Editorial fashion-still-life aesthetic. NO designed text overlay. NO badges.

5. type="ingredients" — INGREDIENT SPOTLIGHT (the hero compound)
   • copy = 3-4 line refined paragraph telling the story of ONE hero ingredient — provenance, why selected, what it does in poetic-clinical language. Lift the ingredient into a story, not a bullet.
   • bullets = optional 2-3 supporting ingredients each in single-line "Compound — what it does" prose
   • DO NOT include cta.
   • 2 imagePrompts:
       (a) Hero ingredient macro — natural close-up of the source (eg ginseng root on a linen square, marine algae texture, rosehip macro, ginger slice) on a luxe neutral background. Fashion-editorial still life, premium soft lighting.
       (b) Supporting macro — a different ingredient texture (eg powder swatch, oil drop on glass, capsule cross-section). Editorial still-life style.

6. type="mechanism" — TEXTURE / SENSORIAL EXPERIENCE (NOT clinical mechanism)
   • copy = 3-4 line refined paragraph describing how the product feels — application moment, sensory experience, the small ritual. Replace "how it works" mechanism with "how it feels". NO biology jargon. NO bulleted process steps.
   • DO NOT include cta.
   • 2 imagePrompts:
       (a) Texture macro — close-up of the product's actual texture (cream swatch on fingertips, oil dripping, capsule on porcelain dish, serum on smooth surface). Premium editorial macro photography.
       (b) Ritual moment — model's hands using the product OR the product in a serene bathroom shelf moment. Cinematic intimate composition. NO face needed.

7. type="benefits" — REFINED BENEFITS (NOT bullet spam)
   • copy = 3-4 line paragraph framing 3-4 benefits AS ELEGANT PHRASES, not bullets. "Kulit yang lebih sihat. Tidur yang lebih lena. Pagi yang lebih ringan." Sentence fragments allowed for rhythm.
   • bullets = optional 3-4 short single-line refined benefit phrases (no emoji, no ✅, no urgency)
   • DO NOT include cta.
   • 1 imagePrompt: editorial benefit composition — could be a model in aspirational golden-hour light or an artful still-life conveying renewal. NO icon grid. NO infographic. Fashion-editorial photograph.

8. type="social-proof" — CURATED EDITORIAL TESTIMONIALS
   • reviews = 3 ONLY (NOT 10 — premium is curation, not quantity). Each testimonial in refined prose (2-3 sentences each), reviewer with a single-name byline ("— Sarah K., Kuala Lumpur" / "— Ahmad N., Penang"). NO star ratings. NO emoji. NO "Verified Purchase" badge.
   • copy = 1-2 line framing line introducing the testimonials
   • DO NOT include cta.
   • 2 imagePrompts: two editorial portrait testimonials — elegant Malaysian women (or men) in soft natural light, candid moment (NOT looking at camera, NOT smiling broadly), perhaps holding a coffee or sitting near a window. Fashion-magazine portrait quality. NO Shopee/TikTok/Facebook screenshot UI. NO marketplace badges.

9. type="news-proof" — PREMIUM PRESS EDITORIAL
   • copy = 2-3 line paragraph framing press recognition in refined language ("Diiktiraf oleh editor kecantikan", "Terpilih dalam senarai…").
   • DO NOT include cta.
   • 2 imagePrompts:
       (a) Mock premium press editorial — Vogue / Tatler / Harper's Bazaar / Female Malaysia style article layout (clean serif typography, generous whitespace, single product feature image). NOT mStar / Berita Harian style (those are mass-market — wrong register for premium).
       (b) Award / recognition badge mock — minimal editorial design, neutral palette, single line of recognition text. NO loud color, NO starbursts, NO discount badges.

10. type="faq" — MINIMAL SOPHISTICATED Q&A
    • faqs = 3-4 ONLY. Questions phrased in refined register ("Bagaimana saya boleh memasukkan ritual ini dalam rutin saya?", "Adakah formulasi ini sesuai untuk kulit sensitif?"). Answers in brand voice, 2-3 lines each. NO sales push in answers.
    • imagePrompts = [] (text-only)
    • DO NOT include cta in this section.

11. type="final-cta" — PREMIUM SOFT INVITATION
    • headline = elegant closing line (eg "Hadiahkan diri anda satu permulaan baru.")
    • copy = 3-4 line closing paragraph in brand voice — invitation rather than command. Aspirational, confident, calm.
    • cta = ONE soft elegant CTA button text:
        • "Mulakan ritual anda" / "Terokai koleksi" / "Hadiahkan kepada diri" / "Discover the ritual"
        • NEVER "BELI NOW", NEVER "ORDER SEKARANG", NEVER "DISKAUN", NEVER ALL-CAPS.
    • urgencyText = OMIT entirely. NO countdown. NO scarcity. NO "STOK TERHAD".
    • DO NOT include offerStrip with discount.
    • 1 imagePrompt: closing luxury product hero — the product elegantly displayed on a premium surface OR held by a relaxed model in cinematic golden-hour light. Fashion-editorial campaign aesthetic. NO designed text overlay. NO discount badge.

═══════════════════════════════════════════════════════════════
COPY RULES — REFINED EDITORIAL VOICE
═══════════════════════════════════════════════════════════════
• Brand voice — NOT first-person diary ("saya pun rasa…"), NOT clinical third-person ("kajian menunjukkan…"), NOT COD aggressive ("ORDER SEKARANG"). Confident editorial register.
• Sentence fragments OK for rhythm. Short refined paragraphs (2-4 lines per section).
• Vocabulary: lift words slightly — "ritual" instead of "use", "formulasi" instead of "produk", "detik" instead of "moment", "diiktiraf" instead of "approved".
• ZERO emoji. ZERO ALL-CAPS. ZERO "HARI INI SAHAJA" / "STOK TERHAD" / countdown / urgency.
• ZERO discount language. ZERO price comparison ("dari RM200 ke RM89"). ZERO bonus stack.
• Mention price only if the user prompt explicitly provides one — and present it as a single line, not stacked offer.
• One soft CTA at the end (section 11). All other sections are CTA-free.

═══════════════════════════════════════════════════════════════
IMAGE RULES — LUXURY EDITORIAL AESTHETIC
═══════════════════════════════════════════════════════════════
• Studio / cinematic / editorial / fashion-campaign aesthetic ENCOURAGED (this is the ONLY form besides chuyen-gia where studio look is fully welcomed).
• Premium palette: cream / dusty rose / soft beige / linen / marble / pale sage / muted gold / warm grey. AVOID: hot red, neon orange, harsh contrast, loud gradients.
• Composition: generous whitespace, single subject, controlled gradient backgrounds, soft natural OR controlled studio lighting.
• Models: when present — elegant Malaysian women (or men) in refined casual / linen / silk / soft cotton. Candid contemplative expressions, NOT broad smiles, NOT phone-selfie posing. Look like a fashion editorial.
• Product photography: luxury still-life on raw silk / marble / linen / sculpted shadow / glass. Studio precision, editorial composition.
• Ingredient macros: like premium beauty magazine photography — close-up texture, soft natural / studio light, neutral background.
• NO UGC mobile-phone aesthetic. NO marketplace screenshot UI (TikTok / Shopee / Facebook comment). NO WhatsApp screenshot. NO "Trending #1" badges. NO discount banners. NO designed CTA overlays. NO "SEBELUM/SELEPAS" labels. NO crowd group photos.
• Press editorial: Vogue / Tatler / Harper's Bazaar / Female Malaysia register — NEVER mStar / Berita Harian / health.com.my (wrong magazine class).

═══════════════════════════════════════════════════════════════
LANGUAGE RULES
═══════════════════════════════════════════════════════════════
• Output in the language specified by the user prompt
• titleVi / headlineVi / subheadlineVi / ctaVi / bulletsVi / viTranslation ALWAYS Vietnamese
• imagePrompt.prompt ALWAYS English
• Brand name + ingredient names kept as-is
• When language=ms, use refined Bahasa Melayu register (closer to written editorial / magazine voice than colloquial WhatsApp Malay)

═══════════════════════════════════════════════════════════════
ABSOLUTE BANS for this form
═══════════════════════════════════════════════════════════════
✗ Emoji anywhere (zero — not even one)
✗ ALL-CAPS headlines / CTAs
✗ "HARI INI SAHAJA" / "STOK TERHAD" / countdown / scarcity language
✗ Discount stacks ("RM50 OFF" / "Bonus X percuma")
✗ TikTok / Shopee / Facebook / WhatsApp screenshot imagery
✗ "Trending #1" / "20,000+ ORDER" badge graphics
✗ Star rating widgets / "Verified Purchase" badges
✗ Multiple CTAs across sections — ONE soft CTA at the end only
✗ Hard before/after collage with dramatic labels
✗ COD reassurance section / delivery package proof imagery
✗ First-person diary voice ("saya pun rasa…")
✗ Clinical third-person voice ("kajian menunjukkan…", "pengguna melaporkan…")
✗ Bulleted infographic icon grids
✗ Crowd group photos
✗ UGC mobile-phone aesthetic
✗ Studio gimmickry — gimbal-perfect spin shots / 360 product turns`

// ── User prompt builder ──────────────────────────────────────────────────

function buildPremiumUserPrompt(
  params: LandingGenParams,
  product: { productName: string; offer?: string; productClaim?: string; targetAudience?: string },
): string {
  const langName = params.language === 'ms' ? 'Bahasa Melayu (refined editorial register — written magazine voice, NOT colloquial WhatsApp Malay)'
                  : params.language === 'vi' ? 'Tiếng Việt (refined editorial register)'
                  : 'English (refined editorial register, premium beauty magazine voice)'

  const lines: string[] = []
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('PRODUCT BRIEF')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`Product name: ${product.productName}`)
  if (product.offer)          lines.push(`Offer / price (present as single line, NOT a stack): ${product.offer}`)
  if (product.productClaim)   lines.push(`Main claim: ${product.productClaim}`)
  if (product.targetAudience) lines.push(`Target audience: ${product.targetAudience}`)
  if (params.nicheHint)       lines.push(`Niche hint: ${params.nicheHint}`)
  lines.push('')

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('OUTPUT LANGUAGE')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`Write ALL copy fields ENTIRELY in ${langName}. Zero mixing.`)
  lines.push(`titleVi / viTranslation / *Vi fields: ALWAYS Vietnamese.`)
  lines.push(`imagePrompt.prompt: ALWAYS English.`)
  lines.push(`Output JSON field "language": "${params.language}"`)
  lines.push('')

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('IMAGE BUDGET — light, large, editorial')
  lines.push('═══════════════════════════════════════════════════════════════')
  Object.entries(IMAGES_PER_SECTION).forEach(([sec, n]) => {
    lines.push(`  • ${sec}: ${n} image${n === 1 ? '' : 's'}`)
  })
  lines.push('Total target: ~15 images — fewest of any form. Each image larger, more emotional, fashion-editorial quality.')
  lines.push('')

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('CRITICAL FOR THIS FORM')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('  • ONLY ONE CTA — in section 11 (final-cta). Other 10 sections have NO cta field.')
  lines.push('  • NO emoji ANYWHERE — not in headlines, not in copy, not in bullets, not in CTA text.')
  lines.push('  • NO ALL-CAPS. Refined editorial typography.')
  lines.push('  • NO urgencyText / offerStrip / scarcity / countdown.')
  lines.push('  • Image aesthetic: fashion-editorial / luxury campaign / Aesop / Apple / Tatler.')
  lines.push('  • Press editorial uses VOGUE / TATLER / FEMALE MALAYSIA register — NOT mStar / Berita Harian.')
  lines.push('  • Social proof = 3 curated editorial testimonials with name byline, NO star ratings, NO marketplace badges.')
  lines.push('')

  lines.push('Now produce the 11-section premium luxury JSON.')

  return lines.join('\n')
}

// ── Main buildPack — Phase 6 real engine ─────────────────────────────────

async function buildPack(params: LandingGenParams): Promise<LandingPagePack> {
  const apiKey = getGeminiKey()
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm — chọn lại từ Project')

  console.info('[FORM premium] generating luxury editorial pack for', product.productName)

  const userPrompt = buildPremiumUserPrompt(params, product)
  const priceTag = extractPriceTag(product.offer ?? '')

  const raw = await directGeminiVision({
    apiKey,
    parts: [{ text: userPrompt }],
    systemInstruction: PREMIUM_SYSTEM_PROMPT,
    maxOutputTokens: 20000,  // smaller than other forms — premium is concise
    responseMimeType: 'application/json',
  })

  let parsed: RawPack
  try {
    parsed = JSON.parse(extractJson(raw)) as RawPack
  } catch {
    console.error('[FORM premium] JSON parse failed. Raw head:', raw.slice(0, 500))
    throw new Error('Gemini trả về JSON không hợp lệ — thử lại')
  }

  if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    throw new Error('Gemini không trả về section nào — thử lại')
  }

  const sections: LandingSection[] = []
  for (const ord of PREMIUM_SECTIONS) {
    const found = parsed.sections.find((s) => s.type === ord)
    if (found) {
      const norm = normalizeSection(found)
      if (norm) sections.push(norm)
    }
  }
  console.info('[FORM premium] emitted', sections.length, '/', PREMIUM_SECTIONS.length, 'sections · types =', sections.map((s) => s.type).join(' → '))

  // ── Premium validation: warn if any forbidden patterns leaked through ──
  const urgencyLeak = sections.filter((s) =>
    (s.urgencyText && s.urgencyText.trim().length > 0)
    || (s.offerStrip && s.offerStrip.trim().length > 0),
  )
  if (urgencyLeak.length > 0) {
    console.warn('[FORM premium] urgency/offer leak in:', urgencyLeak.map((s) => s.type).join(', '), '— Gemini left urgency/offer fields populated despite spec ban. UI should hide them for premium form.')
  }

  const ctaLeak = sections.filter((s) => s.type !== 'final-cta' && s.cta && s.cta.trim().length > 0)
  if (ctaLeak.length > 0) {
    console.warn('[FORM premium] CTA leak in:', ctaLeak.map((s) => s.type).join(', '), '— premium spec allows only 1 CTA in final-cta.')
  }

  if (sections.length === 0) {
    throw new Error('Không có section nào hợp lệ trong JSON Gemini trả về')
  }

  injectPriceIntoPrompts(sections, priceTag)

  return {
    productId: params.productId,
    productName: product.productName,
    language: (parsed.language as LandingLanguage) ?? params.language,
    sections,
    visualMemory: params.visualMemory ?? [],
    generatedAt: Date.now(),
    form: 'premium',
    // No characterProfile — premium allows different elegant models across
    // sections (aesthetic continuity matters more than face continuity)
  }
}

// ── Module export ────────────────────────────────────────────────────────

export const module: FormBlueprintModule = {
  formId: 'premium',
  label: {
    vi: 'Thương Hiệu Cao Cấp',
    en: 'Premium Brand',
  },
  description: {
    vi: 'Landing page theo phong cách thương hiệu cao cấp, tối giản và sang trọng. Tập trung vào cảm xúc lifestyle, hình ảnh premium và trải nghiệm thương hiệu.',
  },
  tooltip: {
    vi: '11-section luxury editorial: hero cinematic → philosophy → lifestyle → product reveal → ingredient spotlight → texture/ritual → benefits → curated testimonials → premium press → minimal FAQ → soft CTA. ~15 ảnh fashion-editorial / Aesop / Apple aesthetic. KHÔNG có TikTok/Shopee/WhatsApp screenshot, KHÔNG có urgency, KHÔNG có discount. Phù hợp luxury skincare / beauty / premium wellness / high-AOV brand-first products.',
  },
  sections: PREMIUM_SECTIONS,
  psychology: {
    readingBehavior: 'aspirational',
    pacing: 'whitespace-heavy',
    densityChu: 'low',     // less text per section
    densityAnh: 'medium',  // fewer but larger images
  },
  cta: {
    placement: 'single-end',
    tone: 'soft',
    ctaSections: ['final-cta'],
  },
  imageStrategy: {
    overallStyle: 'luxury-editorial',
    characterContinuity: false,   // different elegant models OK, aesthetic continuity matters
    allowStudioLook: true,         // STUDIO ENCOURAGED for premium
    imagesPerSection: IMAGES_PER_SECTION,
  },

  buildPack,
}
