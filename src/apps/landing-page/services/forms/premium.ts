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
//   • 14 sections — Huel-grade editorial visuals (annotated hero,
//     magazine cover, stat-proof, Google SERP) replace simple lifestyle.
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
  getGeminiKey, normalizeSection, injectPriceIntoPrompts,
  extractPriceTag, callGeminiWithMsRetry, validatePackSections,
} from '../generateLandingPack'
import { buildProductIntelligence, buildIntelligencePromptBlock } from '../productIntelligence'
import { useBankStore } from '../../../../stores/bankStore'

// ── 14-section luxury editorial flow (Phase 7 — 3 new editorial visuals) ─
//
// Phase 7 (2026-05) adds 3 magazine-grade visuals exclusive to this form:
//   • magazine-feature    — fake premium wellness magazine cover featuring
//                            the product (Huel / VITAL reference)
//   • stat-proof          — big-stat hero infographic + growth chart
//                            (Spacegoods / Hims-Hers reference)
//   • web-authority-proof — Google SERP screenshot mockup w/ Knowledge
//                            Panel (organic trust signal)
//
// Inserted at editorial-natural positions: magazine-feature right after
// hero, stat-proof between mechanism & benefits, web-authority-proof
// between social-proof & news-proof. No other form sees these sections.
const PREMIUM_SECTIONS: SectionType[] = [
  'hero',                // 1. Luxury hero statement (annotated UGC poster — Huel reference)
  'magazine-feature',    // 2. NEW — fake magazine cover editorial feature
  'pain',                // 3. Brand philosophy / "the gap we noticed"
  'lifestyle',           // 4. Aspirational lifestyle moment
  'product-discovery',   // 5. Product identity reveal (studio premium)
  'ingredients',         // 6. Ingredient spotlight (single hero compound)
  'mechanism',           // 7. Texture / sensorial experience
  'stat-proof',          // 8. NEW — big-stat infographic + growth chart
  'benefits',            // 9. Premium benefits (3-4 elegant phrases)
  'social-proof',        // 10. Refined editorial testimonials (curated)
  'web-authority-proof', // 11. NEW — Google SERP screenshot w/ Knowledge Panel
  'news-proof',          // 12. Premium press editorial (Vogue / Tatler style)
  'faq',                 // 13. Minimal FAQ (3-4 sophisticated Q&A)
  'final-cta',           // 14. Premium soft CTA — single elegant invitation
]

// ── Image budget — LIGHT, LARGE, EDITORIAL ───────────────────────────────
const IMAGES_PER_SECTION: Partial<Record<SectionType, number>> = {
  'hero':                  1,  // single annotated UGC poster (Huel reference)
  'magazine-feature':      1,  // NEW — fake magazine cover
  'pain':                  1,  // moody portrait or environmental
  'lifestyle':             2,  // aspirational lifestyle moments
  'product-discovery':     1,  // studio product reveal
  'ingredients':           2,  // hero ingredient + supporting macro
  'mechanism':             2,  // texture macro + ritual moment
  'stat-proof':            1,  // NEW — big-stat infographic + growth chart
  'benefits':              1,  // editorial benefit composition
  'social-proof':          2,  // editorial portrait testimonials
  'web-authority-proof':   1,  // NEW — Google SERP screenshot mockup
  'news-proof':            2,  // premium press editorial mocks
  'faq':                   0,  // text-only
  'final-cta':             1,  // premium product hero
}
// Total ≈ 18 images. Each image larger and more emotional than form 1's
// UGC quantity strategy.

// ── Premium system prompt — OWN SYSTEM ───────────────────────────────────

const PREMIUM_SYSTEM_PROMPT = `BẠN LÀ: senior editorial copywriter chuyên viết các landing page thương hiệu cao cấp / luxury beauty / premium wellness theo phong cách Aesop, Apple, Tatcha, Loewe Wellness. Bạn KHÔNG phải là COD media buyer. Bạn KHÔNG kể chuyện cá nhân. Bạn KHÔNG viết clinical advertorial.

NHIỆM VỤ: viết một landing page LUXURY EDITORIAL — đọc phải có cảm giác đang xem một campaign thương hiệu cao cấp, không phải một quảng cáo. Trust qua mỹ học và sự tinh tế, không qua urgency hay testimonial spam.

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — STRICT JSON ONLY
═══════════════════════════════════════════════════════════════
{
  "language": "ms" | "vi" | "en",
  "sections": [ ...exactly 14 section objects in the order below... ]
}

Each section has standard shape: type, title, titleVi, copy, viTranslation, layoutGuide, imageAspectRatio, optionally headline / subheadline / cta / bullets / faqs / reviews / imagePrompts. ALL imageAspectRatio = "1:1" or "4:5" — NO 16:9 banners (premium is editorial, not promo).

═══════════════════════════════════════════════════════════════
14-SECTION LUXURY EDITORIAL FLOW — produce EXACTLY in order
═══════════════════════════════════════════════════════════════

1. type="hero" — PREMIUM ANNOTATED POSTER (Huel / Daily Greens reference)
   • headline = a confident wellness-brand line (6-10 words). Calm, aspirational. NO emoji. NO ALL-CAPS. NO product name. Example: "Satu ritual harian, satu pelaburan jangka panjang" / "Wellness yang anda layak"
   • subheadline = 1-line brand promise in refined prose
   • copy = 2-3 line paragraph setting tone — confident, elegant, understated. NO marketing hype. Speak as the brand voice, not first-person diary.
   • DO NOT include cta in hero (premium is sparse — no early CTA).
   • DO NOT include urgencyText / offerStrip (zero urgency for this form).
   • 1 imagePrompt aspectRatio="4:5", style="Premium annotated UGC poster":
     Annotated brand-first poster (Huel Daily Greens / Spacegoods Instagram-creative reference). The EXACT uploaded product packaging center-frame, held by a hand entering from the bottom OR resting on a clean stone / linen / kitchen surface with subtle natural garnish (lemon slice, blueberries, herbs, fresh wellness ingredients). Soft natural daylight wellness scene background, slightly out-of-focus.
     CALLOUT LABELS — render 4-5 handwritten / casual marker callouts arranged around the product, each connected to the product / scene point with a thin curved hand-drawn arrow. Each callout 3-6 Malay words in casual script font:
       • One ingredient highlight (eg "Lion's mane")
       • One benefit (eg "Tenaga, imuniti & pemulihan")
       • One spec / metric (eg "41 vitamin & SuperFoods")
       • One low-calorie / unique-claim chip (eg "Cuma 25 kalori")
       • Optional brand domain url at one corner (eg invented "brandname.com")
     DECORATIVE: small hand-drawn stars / sparkles / dots scattered. Top corner: thin script product wordmark with a small ⭐ doodle.
     PALETTE: cream / sage / soft green accents matching the product packaging. Not high-contrast.
     ABSOLUTE: aesthetic = Huel / Spacegoods premium wellness Instagram creative. NOT TikTok. NOT cinematic luxury studio. NOT UGC selfie with face dominating. NOT floating product PNG with no scene. NO harsh marketing typography. NO HARI INI / DISKAUN urgency. NO multi-bottle stack.

2. type="magazine-feature" — FAKE PREMIUM MAGAZINE COVER (VITAL reference)
   • headline = short magazine-cover-style headline (3-6 words, all caps OK). Example: "DAILY GREENS. MAXIMUM YOU." / "WELLNESS BERMULA DI SINI."
   • subheadline = magazine tagline 5-10 words. Example: "41 vitamin. Zero karut. Semua manfaat."
   • copy = 2-3 short editorial paragraphs in magazine-journalist voice — calm, authoritative, aspirational. Frame the product as a featured wellness brand of the year. Mention concrete wellness benefits in elegant prose. NO emoji. NO urgency.
   • DO NOT include cta.
   • 1 imagePrompt aspectRatio="4:5", style="Premium magazine cover feature":
     Fake premium wellness magazine COVER mockup featuring the EXACT uploaded product packaging. Magazine masthead at top in bold condensed serif or display sans-serif — invent a name like "VITAL" / "WELLNESS" / "GREEN BRIEF". Below masthead: small "POWERING MODERN WELLNESS" (or similar) tagline + tiny "ISSUE 47 · MAY 2026" line + small barcode hint at one corner.
     CENTER: the EXACT uploaded product packaging hero-positioned on a clean editorial set — linen / stone / soft daylight / blueberries / lemon / botanical garnish. Premium magazine product photography quality.
     BIG EDITORIAL HEADLINE OVERLAY (lower half): render the headline + subheadline as visible image text in clean magazine sans-serif (stacked, eg "DAILY GREENS. MAXIMUM YOU." with subhead "41 vitamins. Zero nonsense. All benefit." underneath in lighter weight).
     RIGHT EDGE (or LEFT EDGE): 2-3 small slanted ribbon callout cards in green / cream accent, each teasing a sub-article (eg "BIOHACK YOUR ROUTINE", "GUT HEALTH UPGRADED", "EXCLUSIVE INTERVIEW WITH X").
     BOTTOM corner: small "REAL NUTRITION. REAL RESULTS." (or similar) tagline in elegant small-caps.
     PALETTE: cream / soft sage / green / off-white — matching product packaging color family.
     ABSOLUTE: aesthetic = Huel-magazine / Spacegoods-magazine / Apple-brochure / premium wellness editorial. Generous whitespace. Clean typography hierarchy. NOT TikTok. NOT UGC selfie. NO discount banners. NO HARI INI / DISKAUN. NO emoji. NO oversized red CTA buttons.

3. type="pain" — BRAND PHILOSOPHY ("the gap we noticed")
   • copy = 3-4 line refined paragraph framing the brand's WHY. Not "Anda penat?" — more "Kami percaya bahawa…", "Dalam dunia yang sentiasa pantas, …". Aspirational + observational tone. NEVER capslock. NEVER emoji.
   • DO NOT include bullets (premium prefers prose over bulleted lists)
   • DO NOT include cta in this section.
   • 1 imagePrompt: a moody atmospheric photograph that evokes the gap the brand fills — could be a quiet morning routine, a hand on glass, a candle moment, an empty luxe bathroom — NOT showing the product yet. Editorial fashion-magazine mood photograph. Soft natural light. Restrained palette.

4. type="lifestyle" — PREMIUM WELLNESS RITUAL
   • copy = 3-4 line refined paragraph evoking the wellness lifestyle the product fits. "Untuk pagi yang tenang", "Untuk seorang yang menghargai detik kecil dan kesihatan jangka panjang". NO bullets, no emoji.
   • DO NOT include cta.
   • 2 imagePrompts — BOTH MUST SHOW THE PRODUCT NATURALLY IN FRAME (this is the user's #1 fix priority — premium form was generating fashion-empty rooms; product MUST be visible in lifestyle):
       (a) Morning wellness ritual — elegant Malaysian woman at her marble kitchen counter with the EXACT product visible alongside breakfast / fresh fruit / herbal tea / coffee. She might be holding it gently OR it's placed naturally on the counter while she sips coffee. Sunlit warm morning light. Beige/cream/linen palette. Reference: Japanese wellness / Aman-spa morning aesthetic.
       (b) Evening wellness routine — same OR different elegant Malaysian woman in her bathroom shelf moment OR bedside ritual with the EXACT product clearly visible. Soft warm evening light, candle / linen / muted tones. Reference: Aesop bathroom aesthetic / Scandinavian wellness home.
     BOTH: subtle quietly-confident demeanor (NOT broad smile, NOT phone selfie, NOT fashion-model pose). NOT empty-room standing pose. NOT perfume-ad aesthetic.

5. type="product-discovery" — PRODUCT IDENTITY REVEAL
   • headline = product introduction line in confident editorial register (eg "Hadir dengan satu janji.")
   • copy = 4-5 line paragraph introducing the product as a piece of considered design — formulation philosophy, intentional sourcing, craftsmanship. NOT bulleted ingredients. Aspirational language.
   • DO NOT include cta.
   • 1 imagePrompt: luxury studio product photography — the EXACT uploaded product on a premium surface (raw silk, soft marble, dusty linen, sculpted shadow). Cinematic studio lighting with controlled gradient background. Editorial fashion-still-life aesthetic. NO designed text overlay. NO badges.

6. type="ingredients" — INGREDIENT SPOTLIGHT (the hero compound)
   • copy = 3-4 line refined paragraph telling the story of ONE hero ingredient — provenance, why selected, what it does in poetic-clinical language. Lift the ingredient into a story, not a bullet.
   • bullets = optional 2-3 supporting ingredients each in single-line "Compound — what it does" prose
   • DO NOT include cta.
   • 2 imagePrompts:
       (a) Hero ingredient macro — natural close-up of the source (eg ginseng root on a linen square, marine algae texture, rosehip macro, ginger slice) on a luxe neutral background. Fashion-editorial still life, premium soft lighting.
       (b) Supporting macro — a different ingredient texture (eg powder swatch, oil drop on glass, capsule cross-section). Editorial still-life style.

7. type="mechanism" — TEXTURE / SENSORIAL EXPERIENCE (NOT clinical mechanism)
   • copy = 3-4 line refined paragraph describing how the product feels — application moment, sensory experience, the small ritual. Replace "how it works" mechanism with "how it feels". NO biology jargon. NO bulleted process steps.
   • DO NOT include cta.
   • 2 imagePrompts:
       (a) Texture macro — close-up of the product's actual texture (cream swatch on fingertips, oil dripping, capsule on porcelain dish, serum on smooth surface). Premium editorial macro photography.
       (b) Ritual moment — model's hands using the product OR the product in a serene bathroom shelf moment. Cinematic intimate composition. NO face needed.

8. type="stat-proof" — BIG-STAT INFOGRAPHIC + GROWTH CHART (Spacegoods / Hims-Hers reference)
   • headline = short stat headline embedding the BIG NUMBER. Example: "87% lapor fokus tanpa kemerosotan." / "92% rasa perubahan ketara dalam 14 hari."
   • copy = 2-3 short paragraphs explaining the headline statistic — what was measured, who participated, time-period. Plain confident wellness-science voice. Cite study methodology naturally (eg "Berdasarkan kajian pengguna 14-hari dengan 120 peserta"). NO urgency, NO hype.
   • bullets = REQUIRED 3-4 short methodology / disclaimer notes (eg "*Berdasarkan kajian pengguna 14 hari, Mei 2026", "Data laporan pengguna sendiri", "Bukan diagnosis perubatan / tidak menggantikan nasihat doktor")
   • DO NOT include cta.
   • 1 imagePrompt aspectRatio="1:1", style="Stat hero infographic with growth chart":
     Dark modern infographic poster. BACKGROUND: deep charcoal / near-black with very subtle purple-pink gradient hint (subtle, not loud).
     HERO: extract the BIG NUMBER from headline (eg "87%") — render MASSIVE in top-left or top-center, bold modern sans-serif typography, gradient fill purple → pink on the number itself, occupying ~40% of canvas height.
     Below the number: render the rest of the headline phrase as visible image text in clean white sans-serif (eg "of users reported laser focus without the crash" or Malay equivalent from headline). Smaller subtitle line below in light gray small-caps reading the study methodology (eg "SELF-REPORTED FOCUS & PRODUCTIVITY AFTER 14 DAYS OF USE").
     RIGHT-BOTTOM or BOTTOM HALF: clean line CHART on soft grid. X-axis labels "DAY 1 · DAY 4 · DAY 7 · DAY 10 · DAY 14". Y-axis labels "0% · 50% · 100%". Line itself: glowing purple-pink gradient stroke, trending smoothly upward to ~headline percentage at right edge.
     EXACT uploaded product packaging bottom-right corner, small-to-medium sized, subtle product glow / soft halo. Render the actual brand label faithfully.
     BOTTOM-LEFT or BOTTOM-CENTER: tiny disclaimer text in light-gray small-caps — use the bullets field verbatim (eg "*Based on a 14-day consumer study, May 2026").
     Optional small cursor / click icon hint as subtle decorative element.
     ABSOLUTE: modern dark-mode wellness science infographic aesthetic (Spacegoods / Hims-Hers / Huel-data reference). Big number dominates. NO emoji. NO TikTok badges. NO HARI INI / DISKAUN urgency. NO loud red/yellow marketing colors.

9. type="benefits" — REFINED BENEFITS (NOT bullet spam)
   • copy = 3-4 line paragraph framing 3-4 benefits AS ELEGANT PHRASES, not bullets. "Tenaga yang stabil. Tidur yang lebih lena. Pagi yang lebih ringan." Sentence fragments allowed for rhythm.
   • bullets = optional 3-4 short single-line refined benefit phrases (no emoji, no ✅, no urgency)
   • DO NOT include cta.
   • 1 imagePrompt: PREMIUM WELLNESS LIFESTYLE benefit composition — elegant Malaysian woman in a quietly confident moment that conveys the benefit (eg energetic morning glow, peaceful evening, healthy active life) with the PRODUCT VISIBLE NATURALLY in the scene (held / on shelf / on table). Premium wellness-brand aesthetic. NOT icon grid. NOT infographic. NOT a fashion-model headshot. Reference: premium wellness brand campaign (Aman / Tatcha / Goop), NOT Vogue editorial.

10. type="social-proof" — CURATED EDITORIAL TESTIMONIALS
   • reviews = 3 ONLY (NOT 10 — premium is curation, not quantity). Each testimonial in refined prose (2-3 sentences each), reviewer with a single-name byline ("— Sarah K., Kuala Lumpur" / "— Ahmad N., Penang"). NO star ratings. NO emoji. NO "Verified Purchase" badge.
   • copy = 1-2 line framing line introducing the testimonials
   • DO NOT include cta.
   • 2 imagePrompts: two editorial portrait testimonials — elegant Malaysian women (or men) in soft natural light, candid moment (NOT looking at camera, NOT smiling broadly), perhaps holding a coffee or sitting near a window. Fashion-magazine portrait quality. NO Shopee/TikTok/Facebook screenshot UI. NO marketplace badges.

11. type="web-authority-proof" — GOOGLE SERP SCREENSHOT MOCKUP
    • headline = short authority headline. Example: "Jenama yang dicari, dipercayai."
    • copy = 1-2 short paragraphs framing the brand's web reputation — search-engine visibility, third-party coverage, organic trust signal. Calm authoritative voice. NO hype.
    • DO NOT include cta.
    • 1 imagePrompt aspectRatio="4:5", style="Google SERP screenshot with Knowledge Panel":
      Fake DESKTOP Google search results page screenshot mockup (cropped to 4:5 portrait). Pixel-perfect Google SERP mimicry — 2026 desktop UI.
      TOP: realistic Google search bar with the EXACT product / brand name from brief typed in. Small nav tab row beneath ("All · Images · Shopping · News · Videos · Forums").
      LEFT 60% (organic results column): 4-5 organic result entries. Each: small site favicon + breadcrumb URL (mix authoritative-looking Malaysian / international domains: brand official site, healthline / berita-harian.com.my / health.com.my / hellodoktor.com / vogue-asia / mens-health) + bold blue clickable title relevant to the product niche (eg "[Brand Name] — 41 Vitamins, Minerals & Superfoods", "Are [Brand] Greens Worth The Hype?") + 2-line gray snippet excerpt beneath. Include one "People Also Ask" expandable widget with 3 collapsed questions about the product / niche.
      RIGHT 40% (Knowledge Panel sidebar): clean white panel card containing — the EXACT uploaded product packaging as the panel's hero image at top + bold product name below + "★ 4.7  1,248 Google reviews" rating line + compact key-value info table ("Ingredients: ...", "Category: Health drink") + primary blue "Visit official site" CTA button.
      BOTTOM-LEFT corner: tiny "About this result" / share / feedback icons matching real Google UI.
      Light Google theme. Authentic Google Sans typography. Real spacing. Subtle browser chrome / scrollbar hint at edges. Subtle JPEG compression hint so it feels like a real screenshot.
      ABSOLUTE: NO TikTok aesthetic; NO mobile UI (DESKTOP only); NO oversized marketing text; NO floating product PNG outside the Knowledge Panel; NO fake Google logo deformations; NO HARI INI / DISKAUN urgency; NO emoji rendered as Google emoji; NO cartoonish Google styling.

12. type="news-proof" — PREMIUM PRESS EDITORIAL
   • copy = 2-3 line paragraph framing press recognition in refined language ("Diiktiraf oleh editor kecantikan", "Terpilih dalam senarai…").
   • DO NOT include cta.
   • 2 imagePrompts:
       (a) Mock premium press editorial — Vogue / Tatler / Harper's Bazaar / Female Malaysia style article layout (clean serif typography, generous whitespace, single product feature image). NOT mStar / Berita Harian style (those are mass-market — wrong register for premium).
       (b) Award / recognition badge mock — minimal editorial design, neutral palette, single line of recognition text. NO loud color, NO starbursts, NO discount badges.

13. type="faq" — MINIMAL SOPHISTICATED Q&A
    • faqs = 3-4 ONLY. Questions phrased in refined register ("Bagaimana saya boleh memasukkan ritual ini dalam rutin saya?", "Adakah formulasi ini sesuai untuk kulit sensitif?"). Answers in brand voice, 2-3 lines each. NO sales push in answers.
    • imagePrompts = [] (text-only)
    • DO NOT include cta in this section.

14. type="final-cta" — PREMIUM SOFT INVITATION
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
IMAGE RULES — PREMIUM WELLNESS LIFESTYLE (NOT FASHION)
═══════════════════════════════════════════════════════════════
• AESTHETIC TARGET (people-shots + product photography): premium WELLNESS BRAND lifestyle photography. Reference brands: Aman, Aesop, Tatcha, Goop, Japanese wellness brands, Scandinavian wellness studios. NOT Vogue / Tatler / Zara campaign. NOT perfume / beauty / cosmetic advertising. NOT high fashion runway.
• AESTHETIC TARGET (editorial / infographic / screenshot sections — magazine-feature, stat-proof, web-authority-proof, news-proof, hero annotated-poster): Huel / Spacegoods / Hims-Hers / premium-wellness-brand editorial-creative reference. These sections are allowed to use designed typography, big-stat overlays, magazine-cover masthead, Google SERP UI — they are NOT people-shots and NOT bound to the Aesop/Aman minimalist rule.
• PRODUCT VISIBILITY: at least 80% of people-shots (hero, lifestyle ×2, product-discovery, mechanism (b), benefits, final-cta) MUST show the EXACT product naturally integrated in frame — held softly, on a shelf, on a marble counter, beside breakfast, on a bathroom counter, on a bedside table. Premium WELLNESS is product-anchored, not abstract fashion-mood-only. Editorial sections (magazine-feature / stat-proof / web-authority-proof) ALSO show product per their per-section spec (magazine cover hero, stat-proof bottom-right, Knowledge Panel image).
• Premium palette (default for people-shots + product photography): cream / dusty rose / soft beige / linen / marble / pale sage / muted gold / warm grey. AVOID: hot red, neon orange, harsh contrast, loud gradients, dramatic dark moody. EXCEPTION: stat-proof section is allowed deep-charcoal / near-black background with subtle purple-pink gradient accent (dark-mode infographic — that section only).
• Composition: generous whitespace, single subject, controlled natural environments (real-feeling affluent home — marble kitchen / linen bedroom / sunlit bathroom shelf), soft natural daylight preferred over harsh studio.
• Models when present: elegant Malaysian women (or men) — SOUTHEAST ASIAN features, mid-30s to mid-40s, believable affluent-but-grounded lifestyle. NOT Western supermodels. NOT Korean idols. NOT influencer-styled. In refined casual / linen / silk / soft cotton wellness attire (NOT high fashion / NOT seductive / NOT runway). Candid contemplative expressions — quietly confident, no broad smile, no phone-selfie pose, no fashion-model stance.
• Product photography: luxury still-life on raw silk / marble / linen / sculpted shadow / glass. Studio precision OK but should feel "wellness brand product page" not "perfume ad".
• Ingredient macros: like premium wellness brand photography — close-up texture on neutral background. Aesop / Tatcha aesthetic, NOT Sephora ad.
• NO UGC mobile-phone aesthetic (people-shots). NO marketplace screenshot UI (TikTok / Shopee / Facebook comment). NO WhatsApp screenshot. NO discount / "DISKAUN" / "HARI INI" banners. NO COD urgency strips. NO "SEBELUM/SELEPAS" labels. NO crowd group photos.
• EXCEPTIONS (specific sections only — explicitly permitted by their per-section spec):
    - hero: handwritten / casual marker callout labels around the product (annotated-poster style, Huel reference)
    - magazine-feature: magazine masthead + big editorial headline overlay + slanted ribbon sub-article cards
    - stat-proof: massive gradient stat number + line chart axis labels + tiny disclaimer text
    - web-authority-proof: Google SERP UI elements — search bar, organic result titles, Knowledge Panel "★ rating · review count" + "Visit official site" CTA button (native Google chrome, NOT a marketing overlay)
  These are NOT "marketing CTA overlays" or "Trending #1 badge graphics" — they are intentional editorial / native-UI elements native to their section type.
• Press editorial: Vogue / Tatler / Female Malaysia register OK for the news-proof MOCK only — but the people-shots themselves are WELLNESS LIFESTYLE not fashion editorial.

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
✗ ALL-CAPS headlines / CTAs (in copy text — magazine-feature image overlay typography MAY use all-caps editorial display lettering as a visual element)
✗ "HARI INI SAHAJA" / "STOK TERHAD" / countdown / scarcity language
✗ Discount stacks ("RM50 OFF" / "Bonus X percuma")
✗ TikTok / Shopee / Facebook / WhatsApp marketplace-screenshot imagery (Google SERP screenshot in web-authority-proof is EXPLICITLY ALLOWED — it's an organic authority signal, NOT a marketplace UI)
✗ "Trending #1" / "20,000+ ORDER" marketing badge graphics
    EXCEPTION: web-authority-proof Knowledge Panel "★ 4.7 · 1,248 Google reviews" is allowed — it's native Google UI, NOT a marketing badge
    EXCEPTION: stat-proof big-number stat + small methodology disclaimer is allowed — it's a science findings card, NOT a marketing badge
✗ Star rating widgets / "Verified Purchase" badges in marketplace contexts
    EXCEPTION: Google Knowledge Panel rating (web-authority-proof only)
✗ Multiple CTAs across sections — ONE soft CTA at the end (final-cta) only
    EXCEPTION: web-authority-proof Knowledge Panel "Visit official site" button is native Google UI, NOT a brand CTA — does not count as a section CTA
✗ Hard before/after collage with dramatic labels
✗ COD reassurance section / delivery package proof imagery
✗ First-person diary voice ("saya pun rasa…")
✗ Clinical third-person voice ("kajian menunjukkan…", "pengguna melaporkan…")
    EXCEPTION: stat-proof copy CAN cite study methodology naturally ("Berdasarkan kajian pengguna 14-hari dengan 120 peserta") — a stat without methodology has no credibility
✗ Bulleted infographic icon grids in BENEFITS section
    NOT a ban for stat-proof (line chart) or magazine-feature (ribbon callouts) — those are different editorial formats
✗ Crowd group photos
✗ UGC mobile-phone aesthetic in PEOPLE-SHOTS (lifestyle / benefits / final-cta / product-discovery)
    EXCEPTION: hero is now "annotated UGC poster" (Huel reference) — premium-creative aesthetic with brand-first composition, NOT a phone-selfie. Allowed.
✗ Studio gimmickry — gimbal-perfect spin shots / 360 product turns
✗ Fashion-magazine / Vogue / runway / Zara campaign aesthetic on PEOPLE-SHOTS (the news-proof MOCK can use Vogue/Tatler layout, magazine-feature uses Huel/VITAL magazine aesthetic, but lifestyle/benefits/final-cta shots are PREMIUM WELLNESS lifestyle, NOT fashion photography)
✗ Perfume / cosmetic / beauty advertising aesthetic (seductive pose, glamour styling, over-styled hair, heavy makeup, fashion-model body language)
✗ Empty-room standing pose with no product (product MUST be naturally in-frame for hero / lifestyle / benefits / final-cta)
✗ Western / Caucasian / Korean idol / Chinese beauty influencer faces — use SOUTHEAST ASIAN Malaysian models with believable affluent-grounded look
✗ High-fashion styling (statement jewelry, designer logos, runway hair, beauty-shoot lighting)
✗ Cosmetic-product-page aesthetic (clinical glossy beauty ad) — premium WELLNESS is calm and grounded, not glossy
✗ Generic "model staring out window with no product" composition — this was the user-reported failure mode this fix targets
✗ Designed CTA overlays / discount banner overlays IN PEOPLE-SHOT IMAGES
    EXCEPTION: magazine-feature editorial headline overlay (intentional cover layout), stat-proof number + chart text (intentional infographic), annotated-poster handwritten callouts (intentional brand-creative), web-authority-proof Google native UI — these are PER-SECTION SPEC, NOT marketing CTA overlays`

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
  lines.push('  • ONLY ONE CTA — in section 14 (final-cta). Other 13 sections have NO cta field.')
  lines.push('  • NO emoji ANYWHERE — not in headlines, not in copy, not in bullets, not in CTA text.')
  lines.push('  • NO ALL-CAPS. Refined editorial typography.')
  lines.push('  • NO urgencyText / offerStrip / scarcity / countdown.')
  lines.push('  • Image aesthetic: fashion-editorial / luxury campaign / Aesop / Apple / Tatler.')
  lines.push('  • Press editorial uses VOGUE / TATLER / FEMALE MALAYSIA register — NOT mStar / Berita Harian.')
  lines.push('  • Social proof = 3 curated editorial testimonials with name byline, NO star ratings, NO marketplace badges.')
  lines.push('')

  lines.push('Now produce the 14-section premium luxury JSON.')

  return lines.join('\n')
}

// ── Main buildPack — Phase 6 real engine ─────────────────────────────────

async function buildPack(params: LandingGenParams): Promise<LandingPagePack> {
  const apiKey = getGeminiKey()
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm — chọn lại từ Project')

  console.info('[FORM premium] generating luxury editorial pack for', product.productName)

  // Phase 2 — niche detection + intelligence block (overrides generic
  // scenes in PREMIUM_SYSTEM_PROMPT with niche-specific pain / scenarios).
  const intelligence = buildProductIntelligence({
    product, language: params.language, nicheHint: params.nicheHint,
  })
  console.info(`[FORM premium] product intelligence niche=${intelligence.niche}`)
  const intelligenceBlock = buildIntelligencePromptBlock(intelligence)

  const userPrompt = buildPremiumUserPrompt(params, product) + '\n\n' + intelligenceBlock
  const priceTag = extractPriceTag(product.offer ?? '')

  const parsed = await callGeminiWithMsRetry({
    apiKey,
    userPrompt,
    systemPrompt: PREMIUM_SYSTEM_PROMPT,
    language: params.language,
    maxOutputTokens: 20000,
    formLabel: 'FORM premium',
  })

  const sections: LandingSection[] = []
  const parsedSections = parsed.sections ?? []
  for (const ord of PREMIUM_SECTIONS) {
    const found = parsedSections.find((s) => s.type === ord)
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
  validatePackSections(sections)

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
