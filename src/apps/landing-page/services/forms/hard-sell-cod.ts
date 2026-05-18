// ─────────────────────────────────────────────────────────────────────────
// services/forms/hard-sell-cod.ts — Phase 5 — URGENCY ENGINE
//
// "Chốt Đơn Mạnh / Hard Sell COD" — conversion-first / urgency-heavy /
// COD aggressive landing page.
//
// Goal: maximum conversion pressure for impulse-buy COD products. Reader
// scrolls fast, sees CTAs every section, feels urgency / scarcity / social
// momentum, and clicks within 60-90 seconds. NOT educational. NOT
// storytelling. NOT premium. Pure mass-market COD funnel.
//
// What this engine does differently:
//   • Owns its own SYSTEM_PROMPT with conversion-first rules + heavy
//     CTA repetition + urgency / scarcity orchestration.
//   • NO character continuity — diversity of testimonial people is
//     desirable (different reviewers across Shopee/TikTok/WhatsApp).
//   • 14-section conversion funnel — heavier social proof + offer
//     repetition than form 1's "balanced UGC".
//   • Image strategy: cta-banner allowed, promo graphics allowed,
//     urgency badges allowed, designed text overlays allowed.
//     UGC selfie + social-proof screenshot pool maxed out.
//   • CTA appears in 6+ sections (vs 1 in advertorial, 1 in expert,
//     5 in form 1). Sticky pressure throughout.
//   • Form 1 hero character lock (Malaysian Muslim hijab default) is
//     INTENTIONALLY suppressed here — we want diverse testimonial
//     people across reviews.
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

// ── 14-section conversion funnel ─────────────────────────────────────────
const HARDSELL_SECTIONS: SectionType[] = [
  'hero',                  // 1. Aggressive hook with urgency strip
  'pain',                  // 2. Fast emotional pain hits
  'failed-solutions',      // 3. "Everything else failed"
  'product-discovery',     // 4. Fast solution reveal
  'benefits',              // 5. Key benefits dense
  'social-proof',          // 6. Burst of FB/TikTok/Shopee/selfie/crowd
  'whatsapp-testimonials', // 7. Chat proof — multiple different reviewers
  'before-after',          // 8. Dramatic transformation pair
  'offer',                 // 9. Value stack + COD emphasis + price
  'comparison',            // 10. Price/value vs alternatives
  'news-proof',            // 11. Viral momentum / "trending #1"
  'lifestyle',             // 12. COD reassurance + delivery proof
  'faq',                   // 13. Objection crushing
  'final-cta',             // 14. Final hard close + countdown
]

// ── Image count per section — CONVERSION-HEAVY ───────────────────────────
const IMAGES_PER_SECTION: Partial<Record<SectionType, number>> = {
  'hero':                  2,  // CTA banner hero + product hero
  'pain':                  4,  // 4 pain visualizations
  'failed-solutions':      2,
  'product-discovery':     2,
  'benefits':              2,
  'social-proof':          6,  // FB + TikTok + Shopee + selfie + crowd + delivery
  'whatsapp-testimonials': 4,  // 4 chats with attached photos
  'before-after':          4,  // 4 same-scene pair shots
  'offer':                 2,  // promo banners
  'comparison':            1,  // comparison chart
  'news-proof':            2,  // viral / trending screenshots
  'lifestyle':             2,  // COD delivery moment / unboxing
  'faq':                   0,  // text-only
  'final-cta':             2,  // final urgency banner + product hero
}
// Total ≈ 35 images — heavy conversion funnel.

// ── Hard-sell system prompt ──────────────────────────────────────────────

const HARDSELL_SYSTEM_PROMPT = `BẠN LÀ: COD media-buyer copywriter chuyên viết các landing page chốt đơn nhanh cho thị trường Malaysia FB Ads. Bạn KHÔNG phải là editorial writer. Bạn KHÔNG phải là expert health journalist. Bạn KHÔNG kể chuyện. Bạn CHỐT ĐƠN.

NHIỆM VỤ: viết một landing page CONVERSION-FIRST — đọc 60-90 giây phải có cảm giác "deal này hot, mình order luôn". Heavy urgency, heavy social proof, heavy CTA, COD-emphasized throughout.

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — STRICT JSON ONLY
═══════════════════════════════════════════════════════════════
{
  "language": "ms" | "vi" | "en",
  "sections": [ ...exactly 14 section objects in the order below... ]
}

Each section has standard shape: type, title, titleVi, copy, viTranslation, layoutGuide, imageAspectRatio, optionally headline / subheadline / cta / offerStrip / urgencyText / bullets / faqs / reviews / imagePrompts.

═══════════════════════════════════════════════════════════════
14-SECTION CONVERSION FUNNEL — produce EXACTLY in order
═══════════════════════════════════════════════════════════════

1. type="hero", imageAspectRatio="4:5"
   • headline = MASSIVE SHOCK HOOK (6-10 Malay words, capitalized, with emoji 🔥 or ⚠️). Example: "STOK HABIS DALAM 24 JAM 🔥"
   • subheadline = 1-line urgency / claim
   • urgencyText = "⏰ PROMOSI TUTUP MALAM INI" (REQUIRED — this is the urgency strip pinned at top)
   • cta = "CLAIM DISKAUN SEKARANG" or similar aggressive verb
   • offerStrip = bonus / discount tagline
   • copy = 3-4 line punchy paragraph hooking the reader. Heavy emoji.
   • 2 imagePrompts:
       (a) PROMO BANNER hero — designed CTA banner with the product centered, big "DISKAUN 50%" text overlay, urgency badge, native FB/TikTok ad ratio.
       (b) Product close-up with hand grip — UGC mobile photo style.

2. type="pain", imageAspectRatio="4:5"
   • copy = 3-4 line paragraph (SHORT punchy sentences, NOT long paragraphs). 1-2 emoji per section. Direct hits.
   • bullets = 4 sharp pain bullets each with ⚠️ or 😩 prefix
   • cta = repeat CTA chip
   • 4 imagePrompts: PURE pain / problem visualizations. EACH prompt must EXPLICITLY state "NO product, NO supplement bottle, NO testimonial framing, NO smiling pose — this is a problem scene". Show 4 different Malaysian people in pain moments: (a) close-up of person holding stomach in discomfort, (b) tired exhausted worker slumped at desk, (c) frustrated mother on couch with messy living room, (d) bloated body posture in mirror or person curled up in pain. DIVERSE people across the 4 shots. NO product can appear in any of these images.

3. type="failed-solutions", imageAspectRatio="4:5"
   • copy = "Anda dah cuba semua ni — kenapa tak jalan?" tone. 3-4 lines.
   • bullets = 3-4 things they tried ("Diet je tak cukup", "Supplement je tak berkesan", "Senaman tak ada masa")
   • cta = repeat CTA chip
   • 2 imagePrompts: frustration with OTHER alternatives (NOT our product). EACH prompt must state "NO uploaded product visible — this is a section about FAILED OTHER solutions". Show: (a) discarded random supplement bottles / diet shakes on a counter (these are OTHER brands the user tried, NOT our product), (b) frustrated person with messy collection of failed solutions OR exhausted person who has given up. Our uploaded product DOES NOT appear in this section.

4. type="product-discovery", imageAspectRatio="4:5"
   • copy = FAST reveal — 3 lines. "Inilah jawapannya — [PRODUCT_NAME]". Confident tone.
   • cta = "ORDER SEKARANG" repeated CTA
   • 2 imagePrompts: product hero + person holding product with proud reveal.

5. type="benefits", imageAspectRatio="4:5"
   • bullets = 5-7 benefit bullets each prefixed by ✅ or 🔥. Short sharp lines (5-8 words each).
   • copy = 2-3 line bridge connecting bullets.
   • cta = repeat CTA chip
   • 2 imagePrompts: benefit infographic with icon grid + benefit summary text overlay.

6. type="social-proof", imageAspectRatio="4:5"
   • reviews = 5-6 short Malaysian reviews with star ratings + names + emoji
   • copy = "Ramai dah cuba — anda?" hook
   • cta = repeat CTA chip
   • 6 imagePrompts ALL different reviewer types: (1) Facebook comment screenshot, (2) TikTok Shop review screenshot, (3) Shopee review screenshot, (4) Malaysian Muslim woman selfie holding product, (5) crowd group photo, (6) COD delivery package proof.

7. type="whatsapp-testimonials", imageAspectRatio="4:5"
   • reviews = 4 chat-style testimonials (multi-line, emoji, casual Malay)
   • copy = 2-line framing
   • cta = repeat CTA chip
   • 4 imagePrompts: WhatsApp screenshots with DIFFERENT senders + DIFFERENT chat contexts. 2 pure screenshots, 2 with attached product photo (1 bottle vs multi-bottle variation).

8. type="before-after", imageAspectRatio="4:5"
   • copy = "Dalam 14 hari — tengok beza" — dramatic but believable transformation framing.
   • 4 imagePrompts: 2 same-person pairs (ba_01/02 face/upper-body pair + ba_03/04 full-body pair). RENDER "SEBELUM"/"SELEPAS" labels stamped top-left.

   AUTHENTIC TRANSFORMATION RULES — CRITICAL (user reported the pairs looked like Photoshop edits):
     • Within each pair the SAME PERSON must appear (same face identity, same Malaysian ethnicity).
     • BUT the BEFORE and AFTER images must look like they were TAKEN ON DIFFERENT DAYS — they MUST DIFFER on every other axis:
         - OUTFIT — BEFORE: homewear / oversized t-shirt / darker / faded / casual tired look. AFTER: cleaner fit / brighter color / neater styling / healthier outfit. NEVER the same shirt in both photos.
         - HAIRSTYLE / HIJAB STYLING — BEFORE: lazy tied / messy / simple wrap. AFTER: brushed / neater wrap / styled. NEVER identical hair.
         - POSTURE — BEFORE: slouched / belly relaxed / low confidence. AFTER: straighter / shoulders back / confident stance.
         - EXPRESSION — BEFORE: tired / no smile / dull eyes / dark circles. AFTER: gentle natural smile / brighter eyes / healthier complexion.
         - LIGHTING — BEFORE: flat dim indoor / harsh phone flash / overcast. AFTER: brighter natural daylight / warmer / uplifting mood.
         - ROOM ANGLE / BACKGROUND — different corner of the same home OR slightly different angle (NOT a pixel-identical Photoshop overlay).
         - ENERGY LEVEL — BEFORE: low energy / sluggish / exhausted. AFTER: energetic / alert / quietly confident.
     • Identity stays consistent (same face structure, same ethnicity, similar body type — realistic 14-day change, NOT extreme slimming swap). Do NOT swap to a different person, do NOT do extreme face-swap-style edit.
     • NO uploaded product visible in any of the 4 shots (this is a transformation evidence section, NOT a product showcase).

   STRICTLY FORBIDDEN:
     ✗ Same outfit in BEFORE and AFTER (immediate fake giveaway)
     ✗ Same hair / hijab styling
     ✗ Same posture / same pose
     ✗ Same lighting in both
     ✗ Pixel-identical background (Photoshop overlay look)
     ✗ Extreme fake slimming that no one would believe
     ✗ Beauty-filter swap aesthetic
     ✗ AI-cloned face on different body

9. type="offer", imageAspectRatio="16:9"
   • headline = "DISKAUN 50% HARI INI SAHAJA"
   • offerStrip = "STOK TERHAD — X UNIT TINGGAL" + "COD SELURUH MALAYSIA"
   • urgencyText = "⏰ PROMOSI TAMAT MALAM INI"
   • bullets = 4-6 value stack items ("✅ Bonus X (RM Y)", "✅ COD percuma", "✅ Free shipping", "✅ Refund 7 hari")
   • cta = "ORDER SEKARANG — DISKAUN 50%"
   • copy = value stack pitch + COD reassurance
   • 2 imagePrompts:
       (a) Promo banner clean ecommerce style — product centered with big Malay discount text overlay + trust badges (HALAL / KKM / COD truck icon).
       (b) Hard-sell urgency banner — dark high-contrast bg + CTA button + scarcity text.

10. type="comparison", imageAspectRatio="1:1"
    • copy = "Berbanding alternatif lain — [PRODUCT_NAME] menang di mana?"
    • bullets = 4-5 comparison points (this product vs supplement umum vs DIY remedy vs do-nothing)
    • cta = repeat CTA chip
    • 1 imagePrompt: comparison table chart with ✓ ✗ icons — clean conversion-optimized layout (NOT clinical editorial).

11. type="news-proof", imageAspectRatio="4:5"
    • copy = "Trending di TikTok / FB / Shopee — ramai sedang order" momentum framing
    • cta = repeat CTA chip
    • 2 imagePrompts: (1) "Trending #1 Malaysia" badge mock-up with star rating + order count; (2) Mock viral FB post / news article screenshot in Malaysian publication style.

12. type="lifestyle", imageAspectRatio="4:5"
    • copy = COD reassurance — "Kami hantar dalam 2-3 hari", "Bayar bila barang sampai", refund policy
    • bullets = 4 COD-trust points (✅ COD seluruh Malaysia, ✅ Bayar bila terima, ✅ Refund 7 hari, ✅ Customer service 24/7)
    • cta = repeat CTA chip
    • 2 imagePrompts: (1) COD delivery package / courier handover moment; (2) Malaysian customer receiving package at door with smile.

13. type="faq"
    • faqs = 6-7 objection-crushing Q&A. QUESTIONS frame buyer hesitation ("Halal?", "Kesan sampingan?", "Berapa lama nampak hasil?", "Bagaimana kalau tidak berkesan?", "COD ke mana?", "Bagaimana cara order?", "Refund?"). ANSWERS confident + short + reassuring + CTA-anchored.
    • imagePrompts = [] (text-only)
    • cta = repeat CTA chip

14. type="final-cta", imageAspectRatio="16:9"
    • headline = "JANGAN TUNGGU SEHINGGA TERLAMBAT 🔥"
    • subheadline = "Ramai dah order — anda?"
    • cta = "CLAIM DISKAUN 50% SEKARANG"
    • urgencyText = "⏰ PROMOSI TAMAT MALAM INI · STOK X UNIT TINGGAL"
    • copy = 3-4 line closing hammer — final scarcity push, value reminder, single CTA
    • 2 imagePrompts:
        (a) Final CTA banner with social proof metrics (★ 4.8/5, 20,000+ orders, TRENDING #1, COD truck icon) + product centered + big CTA button.
        (b) Emotional urgency closer with red glow accent + "PROMOSI TAMAT MALAM INI" overlay.

═══════════════════════════════════════════════════════════════
CTA REPETITION RULE — CRITICAL
═══════════════════════════════════════════════════════════════
EVERY section EXCEPT faq (section 13) MUST include a "cta" field with an aggressive Malay action phrase. 13/14 sections have visible CTA chips. Examples:
  • "CLAIM DISKAUN SEKARANG"
  • "ORDER SEKARANG — STOK TERHAD"
  • "TEKAN DI SINI UNTUK COD"
  • "AMBIL TAWARAN INI"
  • "MUA NGAY — PROMOSI TAMAT MALAM INI"
Rotate the CTA wording per section so it doesn't feel like the same chip. NEVER omit cta in non-faq sections.

═══════════════════════════════════════════════════════════════
URGENCY ENGINE — orchestrate across sections
═══════════════════════════════════════════════════════════════
URGENCY SIGNALS REQUIRED:
  • Time pressure: "HARI INI SAHAJA", "PROMOSI TAMAT MALAM INI", "⏰" countdown text
  • Scarcity: "STOK TERHAD", "X UNIT JE TINGGAL", "RAMAI SEDANG ORDER"
  • Social momentum: "TRENDING #1 MALAYSIA", "20,000+ ORDER", "★ 4.8/5"
  • Loss aversion: "JANGAN LEPASKAN PELUANG", "JANGAN TUNGGU TERLAMBAT"

INJECT urgencyText into: hero, offer, final-cta MINIMUM. Recommend also: pain, failed-solutions, news-proof.

═══════════════════════════════════════════════════════════════
COPY RULES — DIFFERENT FROM OTHER FORMS
═══════════════════════════════════════════════════════════════
• Short punchy sentences (1-2 lines max per sentence, NEVER 5-line paragraphs)
• Heavy emoji use — 3-5 emoji per section is normal: 🔥 ⚠️ ✅ 🚨 💥 ⏰ 💯 🎉 🛒 📦
• ALL-CAPS for headlines and urgency text
• Direct address ("anda", "korang") — never third-person editorial
• MEASURED claims OK but tone should still feel marketing-confident — NOT clinical-cautious
• Bullet-heavy sections (benefits, value stack, FAQ-answer style)
• Repeat the CTA verb pattern — "ORDER", "CLAIM", "TEKAN", "AMBIL", "MUA NGAY"

═══════════════════════════════════════════════════════════════
IMAGE RULES — CONVERSION AESTHETIC ALLOWED
═══════════════════════════════════════════════════════════════
• UGC mobile phone aesthetic — imperfect, authentic FB Ads Malaysia native feel
• Designed text overlays ALLOWED on: hero, offer banner, final-cta, social-proof badges, news-proof "Trending #1"
• Promo graphics / urgency badges / CTA button shapes ALLOWED
• Designed CTA in image OK (eg "DISKAUN 50% — ORDER SEKARANG" rendered into the banner)
• Social proof screenshots (FB/TikTok/Shopee/WhatsApp) MUST mimic real platform UI per the standard spec (native status bar, real spacing, varied review thumbnails)
• Before/after: SAME PERSON / SAME FACE identity within each pair — but DIFFERENT outfit, DIFFERENT hairstyle/hijab styling, DIFFERENT posture, DIFFERENT expression, DIFFERENT lighting, DIFFERENT room angle between BEFORE and AFTER (looks like 14 days apart, NOT Photoshop overlay). RENDER "SEBELUM"/"SELEPAS" labels.
• DIVERSITY OF REVIEWER PEOPLE desired — Malaysian Muslim hijab woman, Malaysian Chinese man, Malaysian Malay woman, etc. NOT one consistent character (that's storytelling form's job).
• COD delivery / courier handover / package opening imagery encouraged in lifestyle section.

═══════════════════════════════════════════════════════════════
LANGUAGE RULES
═══════════════════════════════════════════════════════════════
• Output in the language specified by the user prompt
• titleVi / headlineVi / subheadlineVi / ctaVi / offerStripVi / urgencyTextVi / bulletsVi / viTranslation ALWAYS Vietnamese
• imagePrompt.prompt ALWAYS English
• Brand name + price + ingredient names kept as-is

═══════════════════════════════════════════════════════════════
ABSOLUTE BANS for this form
═══════════════════════════════════════════════════════════════
✗ Long storytelling paragraphs (5+ lines) — that's advertorial form
✗ Clinical / editorial / expert tone — that's chuyen-gia form
✗ Premium / luxury / minimal / whitespace aesthetic — that's premium form
✗ ONE-CTA-AT-THE-END structure — every section EXCEPT faq must have CTA
✗ Soft invitation language ("Cuba lihat di sini") — must be aggressive command
✗ Same character continuity across sections — diverse reviewers desired
✗ First-person diary voice — direct address only
✗ Fake fabricated specific citations or guaranteed cures`

// ── User prompt builder ──────────────────────────────────────────────────

function buildHardSellUserPrompt(
  params: LandingGenParams,
  product: { productName: string; offer?: string; productClaim?: string; targetAudience?: string },
): string {
  const langName = params.language === 'ms' ? 'Bahasa Melayu (Malaysian colloquial COD ad register)'
                  : params.language === 'vi' ? 'Tiếng Việt (urgency-heavy COD register)'
                  : 'English'

  const lines: string[] = []
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('PRODUCT BRIEF')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`Product name: ${product.productName}`)
  if (product.offer)          lines.push(`Offer / price: ${product.offer}`)
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
  lines.push('IMAGE BUDGET (target — heavy conversion funnel)')
  lines.push('═══════════════════════════════════════════════════════════════')
  Object.entries(IMAGES_PER_SECTION).forEach(([sec, n]) => {
    lines.push(`  • ${sec}: ${n} image${n === 1 ? '' : 's'}`)
  })
  lines.push('Total target: ~35 images — heavy conversion funnel with diverse reviewers.')
  lines.push('')

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('REMINDER — CRITICAL FOR THIS FORM')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('  • EVERY section except faq MUST have a cta field (13/14 visible CTAs)')
  lines.push('  • urgencyText REQUIRED in: hero, offer, final-cta (minimum)')
  lines.push('  • Heavy emoji, ALL-CAPS headlines, short punchy sentences')
  lines.push('  • DIVERSE reviewer people across sections — NOT a single character')
  lines.push('  • Designed CTA overlays ALLOWED in image prompts')
  lines.push('')

  lines.push('Now produce the 14-section hard-sell COD funnel JSON.')

  return lines.join('\n')
}

// ── Main buildPack — Phase 5 real engine ─────────────────────────────────

async function buildPack(params: LandingGenParams): Promise<LandingPagePack> {
  const apiKey = getGeminiKey()
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm — chọn lại từ Project')

  console.info('[FORM hard-sell-cod] generating urgency-first conversion funnel for', product.productName)

  // 1. Build user prompt (no character profile — diverse reviewers desired)
  const userPrompt = buildHardSellUserPrompt(params, product)
  const priceTag = extractPriceTag(product.offer ?? '')

  // 2. Single Gemini call with hard-sell system prompt
  const raw = await directGeminiVision({
    apiKey,
    parts: [{ text: userPrompt }],
    systemInstruction: HARDSELL_SYSTEM_PROMPT,
    maxOutputTokens: 28000,
    responseMimeType: 'application/json',
  })

  // 3. Parse + normalize
  let parsed: RawPack
  try {
    parsed = JSON.parse(extractJson(raw)) as RawPack
  } catch {
    console.error('[FORM hard-sell-cod] JSON parse failed. Raw head:', raw.slice(0, 500))
    throw new Error('Gemini trả về JSON không hợp lệ — thử lại')
  }

  if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    throw new Error('Gemini không trả về section nào — thử lại')
  }

  // 4. Iterate hard-sell section order
  const sections: LandingSection[] = []
  for (const ord of HARDSELL_SECTIONS) {
    const found = parsed.sections.find((s) => s.type === ord)
    if (found) {
      const norm = normalizeSection(found)
      if (norm) sections.push(norm)
    }
  }
  console.info('[FORM hard-sell-cod] emitted', sections.length, '/', HARDSELL_SECTIONS.length, 'sections · types =', sections.map((s) => s.type).join(' → '))

  // 5. CTA density validation — log warning if Gemini skimped on CTAs
  const sectionsExpectedToHaveCta = sections.filter((s) => s.type !== 'faq')
  const sectionsWithCta = sectionsExpectedToHaveCta.filter((s) => s.cta && s.cta.trim().length > 0)
  const ctaCoverage = sectionsExpectedToHaveCta.length > 0
    ? (sectionsWithCta.length / sectionsExpectedToHaveCta.length)
    : 0
  if (ctaCoverage < 0.7) {
    console.warn(`[FORM hard-sell-cod] CTA coverage low: ${sectionsWithCta.length}/${sectionsExpectedToHaveCta.length} sections have CTA (${Math.round(ctaCoverage * 100)}%). Hard-sell expects ≥70%.`)
  } else {
    console.info(`[FORM hard-sell-cod] CTA coverage: ${sectionsWithCta.length}/${sectionsExpectedToHaveCta.length} sections (${Math.round(ctaCoverage * 100)}%)`)
  }

  // 6. Urgency signal validation — hero / offer / final-cta MUST have urgencyText
  const urgencyPillars: SectionType[] = ['hero', 'offer', 'final-cta']
  const missingUrgency = urgencyPillars.filter((p) => {
    const s = sections.find((x) => x.type === p)
    return !s?.urgencyText || s.urgencyText.trim().length === 0
  })
  if (missingUrgency.length > 0) {
    console.warn('[FORM hard-sell-cod] missing urgencyText in:', missingUrgency.join(', '))
  }

  if (sections.length === 0) {
    throw new Error('Không có section nào hợp lệ trong JSON Gemini trả về')
  }

  // 7. Post-process — price injection
  injectPriceIntoPrompts(sections, priceTag)

  return {
    productId: params.productId,
    productName: product.productName,
    language: (parsed.language as LandingLanguage) ?? params.language,
    sections,
    visualMemory: params.visualMemory ?? [],
    generatedAt: Date.now(),
    form: 'hard-sell-cod',
    // No characterProfile — hard-sell wants diverse reviewers, not continuity
  }
}

// ── Module export ────────────────────────────────────────────────────────

export const module: FormBlueprintModule = {
  formId: 'hard-sell-cod',
  label: {
    vi: 'Chốt Đơn Mạnh',
    en: 'Hard Sell COD',
  },
  description: {
    vi: 'Landing page tập trung tối đa vào chuyển đổi nhanh, urgency, scarcity và CTA mạnh. Phù hợp sản phẩm COD, impulse buy, audience đọc nhanh.',
  },
  tooltip: {
    vi: '14-section conversion funnel với CTA xuất hiện ở 13/14 section (chỉ FAQ không có), urgency strip ở hero/offer/final-cta, ~35 ảnh heavy social proof + COD delivery + urgency banner + before-after pair. Phù hợp COD impulse buy, audience FB Ads Malaysia đọc nhanh.',
  },
  sections: HARDSELL_SECTIONS,
  psychology: {
    readingBehavior: 'impulse',
    pacing: 'punchy',
    densityChu: 'high',
    densityAnh: 'very-high',
  },
  cta: {
    placement: 'every-section',
    tone: 'urgency',
    ctaSections: HARDSELL_SECTIONS.filter((s) => s !== 'faq'),  // 13/14 CTAs
  },
  imageStrategy: {
    overallStyle: 'cta-banner',
    characterContinuity: false,   // diverse reviewers desired
    allowStudioLook: false,        // UGC mobile aesthetic
    imagesPerSection: IMAGES_PER_SECTION,
  },

  buildPack,
}
