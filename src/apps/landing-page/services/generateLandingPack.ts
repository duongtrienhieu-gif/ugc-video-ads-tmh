import type {
  LandingGenParams, LandingPagePack, LandingSection, SectionType, LandingLanguage,
} from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useBankStore } from '../../../stores/bankStore'
import { directGeminiVision } from '../../../utils/gemini'

// ─────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — 17-section advertorial factory for Malaysian FB ads.
//
// Fix round changes vs previous version:
// • 9:16 aspect ratio removed completely — only 1:1 and 4:5 allowed
// • imageAspectRatio field added to each section (section-level lock)
// • Product identity lock instruction added to image prompt rules
// • Pricing accuracy instruction added for TikTok / Shopee screenshots
// • social-proof images changed from 9:16 → 4:5
// • whatsapp screenshots changed from 9:16 → 4:5
// ─────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite Malaysian DTC ecommerce media buyer and advertorial copywriter who has launched 200+ Facebook ad landing pages scaling to RM 1M+ in revenue. You specialise in:
- Supplement / skincare / patch / health product niches
- Malaysian Bahasa Melayu advertorial voice (NOT formal, NOT textbook — mix English naturally)
- Mobile-first, conversion-first landing page structure
- COD ecommerce psychology
- UGC + native ad aesthetics (NOT cinematic, NOT studio, NOT luxury)

You are an ASSET FACTORY — every section produces both persuasive copy AND image generation prompts describing REAL photos / screenshots / infographics.

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — STRICT JSON ONLY, no markdown fences, no commentary
═══════════════════════════════════════════════════════════════
{
  "language": "ms" | "vi" | "en",
  "sections": [ ...exactly 17 section objects in the order below... ]
}

Each section object:
{
  "type": "<one of the 17 types below>",
  "title": "Section heading shown in UI — written in the OUTPUT LANGUAGE (catchy ad-style heading, not just the section role)",
  "titleVi": "ALWAYS REQUIRED — Vietnamese translation of title. Shown italic under the title in the section header bar.",
  "copy": "main body copy in chosen language",
  "viTranslation": "ALWAYS REQUIRED — Vietnamese translation of copy (for the Vietnamese marketer). Never omit.",
  "layoutGuide": "VIETNAMESE — how to arrange this section in Ladipage",
  "imageAspectRatio": "1:1" or "4:5" — REQUIRED on every section that has images. All images in the section MUST use this ratio. NEVER use 9:16 or 16:9.
  "headline": "optional",
  "headlineVi": "ALWAYS include when headline exists — Vietnamese translation of headline",
  "subheadline": "optional",
  "subheadlineVi": "ALWAYS include when subheadline exists — Vietnamese translation",
  "cta": "optional CTA button text",
  "ctaVi": "ALWAYS include when cta exists — Vietnamese translation",
  "offerStrip": "optional offer strip",
  "offerStripVi": "ALWAYS include when offerStrip exists — Vietnamese translation",
  "urgencyText": "optional urgency line",
  "urgencyTextVi": "ALWAYS include when urgencyText exists — Vietnamese translation",
  "bullets": ["optional bullet list"],
  "bulletsVi": ["ALWAYS include when bullets exist — Vietnamese translation, parallel array with SAME LENGTH as bullets, index-aligned"],
  "faqs": [{"question":"...","answer":"..."}],
  "reviews": [{"author":"...","quote":"...","meta":"optional","rating":5}],
  "imagePrompts": [
    {
      "filename": "hero_01.jpg",
      "prompt": "English image-generation prompt 30-80 words. Include exact text overlay content where specified.",
      "style": "Asset-type label — see per-section spec",
      "aspectRatio": "must match section imageAspectRatio — ONLY 1:1 or 4:5, NEVER 9:16 or 16:9"
    }
  ],
  "imageSizeHint": "optional"
}

═══════════════════════════════════════════════════════════════
ASPECT RATIO LAW — READ CAREFULLY
═══════════════════════════════════════════════════════════════
• Allowed ratios depend on section type:
    - MOST sections: ONLY "1:1" (square) OR "4:5" (portrait)
    - BANNER sections (offer + final-cta) ONLY: "1:1" OR "16:9" (landscape)
      → 4:5 is FORBIDDEN for offer + final-cta
• 9:16 is COMPLETELY BANNED everywhere — never use it
• 16:9 is BANNED everywhere EXCEPT offer + final-cta (banner sections)
• Every section's imageAspectRatio sets the ratio for ALL its images
• Every individual imagePrompt's aspectRatio MUST match the section imageAspectRatio
• Per-section defaults: hero=4:5 | pain=4:5 | why-happens=1:1 | failed-solutions=4:5 |
  product-discovery=4:5 | ingredients=1:1 | mechanism=1:1 | benefits=1:1 | comparison=1:1 |
  lifestyle=4:5 | social-proof=4:5 | whatsapp-testimonials=4:5 | news-proof=4:5 |
  before-after=4:5 | offer=16:9 | final-cta=16:9

═══════════════════════════════════════════════════════════════
SECTION SPEC — produce EXACTLY these 17 in this order
═══════════════════════════════════════════════════════════════

1. type="hero", imageAspectRatio="4:5"
   • headline, subheadline, cta, offerStrip, urgencyText
   • copy: 2-3 short paragraphs reinforcing headline
   • 2 imagePrompts REQUIRED (both hero variants) — both must use DESIGNED text overlay (not plain text):
     - hero_01.jpg, style="Hero text overlay A — designed decor", aspectRatio="4:5"
       Malaysian woman mid-30s holding the product, natural window light, casual indoor background, iPhone selfie
       quality, UGC style. DESIGNED text overlay with multi-layer hierarchy:
         · BIG bold condensed main hook headline (top) — 5-8 Malay words from the product hook, white with subtle
           glow / drop-shadow, font feels like a sans-serif display
         · Below: 3-5 benefit bullets as glassmorphism rounded badges, each prefixed by a relevant emoji icon
           from this pool: ⚡ tenaga / 🔥 metabolisme / ✅ berkesan / 💊 vitamin / 🧠 fokus / ❤️ kesihatan
           Example layout: "⚡ Tenaga lebih stabil" "🧠 Fokus tajam" "✅ Bangun segar"
         · Optional small CTA chip / arrow sticker pointing toward the product
       Visual decor: subtle gradient panel behind text (NOT a flat black bar), depth — text mid-layer floating
       above background. Soft particles or spark behind the headline. Mobile-readable, max 12 words total overlay.
     - hero_02.jpg, style="Hero text overlay B — designed decor", aspectRatio="4:5"
       Slightly different setting (outdoor morning light, or kitchen counter), same product held by a different
       Malaysian woman, UGC selfie feel. Same DESIGNED overlay format (multi-layer hierarchy, glassmorphism
       badges with emoji icons, subtle glow) but 3-5 DIFFERENT benefit bullets and a different main hook headline
       from variant A. Different gradient color palette so the two hero variants feel distinct.

2. type="pain", imageAspectRatio="4:5"
   • copy: emotional pain agitation
   • 5 imagePrompts REQUIRED — each with DESIGNED text overlay (NOT plain centered text):
     OVERLAY DESIGN RULES — apply to all 5:
       · Use italic / slanted display font for the pain statement (conveys urgency / emotion)
       · Place overlay on a rounded glassmorphism or gradient panel (NOT plain text floating)
       · Add a relevant emoji at the start: 😩 fatigue / 😣 pain / 💤 sleep / ⚠️ warning / 🤯 stress
       · Subtle red / dark gradient shadow behind text for contrast
       · Small decorative element (arrow, spark, burst) drawing attention to the face/body part the pain is about
       · Max 4-6 Malay words per overlay — mobile-readable
     - pain_01.jpg, style="Pain text overlay 1 — italic urgent decor", aspectRatio="4:5": tired Malaysian woman at office desk, head in hands, frustrated. Italic slanted Malay overlay on rounded dark glass panel, e.g. "😩 Penat walaupun dah rehat?" with subtle red glow + arrow pointing to her temple.
     - pain_02.jpg, style="Pain text overlay 2 — italic urgent decor", aspectRatio="4:5": Malaysian person, bathroom mirror, bloated belly gesture. Italic Malay overlay on glassmorphism panel: second distinct pain statement starting with ⚠️ or 😣, with subtle red/orange gradient highlight near belly.
     - pain_03.jpg, style="Pain text overlay 3 — italic urgent decor", aspectRatio="4:5": sleepless person, phone light on face at night, dark circles. Italic Malay overlay with 💤 or 😩 emoji on dark-blue glass panel, soft glow under the eyes, third pain statement.
     - pain_04.jpg, style="Pain text overlay 4 — italic urgent decor", aspectRatio="4:5": person at dining table unable to eat, uncomfortable expression. Italic Malay overlay with 😣 or ⚠️ emoji, glassmorphism panel, subtle highlight near stomach, fourth pain statement.
     - pain_05.jpg, style="Pain text overlay 5 — italic urgent decor", aspectRatio="4:5": Malaysian woman looking at scale sadly, plain clothes, honest moment. Italic Malay overlay with 🤯 or 😩 emoji on glass panel, soft red shadow, fifth pain statement.

3. type="why-happens", imageAspectRatio="1:1"
   • copy: root cause explanation, conversational NOT medical-textbook
   • 1-2 imagePrompts: mechanism infographic (gut microbiome / skin layer / absorption — pick by niche). style="Mechanism infographic", aspectRatio="1:1"

4. type="failed-solutions", imageAspectRatio="4:5"
   • bullets: 3-5 "❌ Tried X — didn't work" lines
   • copy: validate customer frustration
   • 1-2 imagePrompts: tired Malaysian surrounded by failed products / empty bottles. style="Failed solutions UGC", aspectRatio="4:5". NO our product visible.

5. type="product-discovery", imageAspectRatio="4:5"
   • copy: "aha" moment — friend rec / Facebook / TikTok find
   • 1 imagePrompt: Malaysian person holding product first time, curious+hopeful, soft natural light. style="Product discovery UGC", aspectRatio="4:5"

6. type="ingredients", imageAspectRatio="1:1"
   • bullets: 3-5 ingredient → effect lines (use REAL ingredients from brief)
   • copy: explain hero ingredients simply
   • 2-3 imagePrompts: ingredient card infographics. style="Ingredient card infographic", aspectRatio="1:1"

7. type="mechanism", imageAspectRatio="1:1"
   • copy: step-by-step HOW the formula works — plain language
   • 1-2 imagePrompts: science mechanism diagram (pick by niche). style="Science mechanism diagram", aspectRatio="1:1"

8. type="benefits", imageAspectRatio="1:1"
   • bullets: 5-7 benefits with leading emoji
   • copy: short framing paragraph
   • 1 imagePrompt: benefits icon grid. style="Benefits comparison grid", aspectRatio="1:1"

9. type="comparison", imageAspectRatio="1:1"
   • copy: why our product vs generics
   • 1 imagePrompt: style="Comparison infographic MY ecommerce", aspectRatio="1:1"
     Malaysia ecommerce style comparison table infographic. Left column: our product name, green checkmarks, emerald highlighted background. Right: "Suplemen Lain" / "Produk Biasa", red X, gray background. Rows: ingredient quality, absorption, certifications, side effects, manufacturing, price value. Clean mobile-readable design, bold Bahasa Melayu labels.

10. type="lifestyle", imageAspectRatio="4:5"
    • copy: after-life paint — energetic mornings, confidence
    • 1-2 imagePrompts: Malaysian family happy / woman laughing outdoors / energetic candid. style="Lifestyle transformation UGC", aspectRatio="4:5". NO product visible.

11. type="social-proof", imageAspectRatio="4:5"
    • reviews: 4-6 realistic Malaysian reviews
    • copy: short framing
    • 5 imagePrompts ALL REQUIRED — ALL aspectRatio="4:5":
      - social_fb.jpg, style="Facebook comment screenshot", aspectRatio="4:5": realistic Facebook post comment section screenshot. Slightly JPEG-compressed quality, imperfect real-phone feel. Malay text + emojis. Multiple positive comments from Malaysian names. IMPORTANT: Product name visible in the post.
      - social_tiktok.jpg, style="TikTok Shop review screenshot", aspectRatio="4:5":
        Ultra realistic TikTok Shop Malaysia review page screenshot. The image MUST look EXACTLY like a genuine TikTok Shop mobile screenshot captured from a real phone. Use authentic TikTok Shop interface: dark and white UI sections, realistic review tabs, star ratings, user profile circles, real mobile spacing, compressed screenshot quality, subtle blur and imperfect sharpness. Include Malay customer reviews about probiotics supplement, realistic customer-uploaded photos (some show 1 bottle only, some show 2-4 bottles together, some show product in kitchen / on dining table), casual real-life photography. DO NOT: poster or infographic layout, fake ecommerce UI, floating product box, unrealistic symmetry, studio advertisement composition, fake app icons, centered marketing layout. The screenshot must feel "captured directly from real TikTok Shop app". Show EXACT PRODUCT PRICE from brief.
      - social_shopee.jpg, style="Shopee review screenshot", aspectRatio="4:5":
        Ultra realistic REAL Shopee Malaysia mobile app screenshot. The image MUST look EXACTLY like a real Shopee app screenshot captured from an iPhone. Use authentic Shopee mobile UI: top status bar with battery/wifi/time, Shopee orange accent colors, review tab navigation, filter chips, realistic review cards, real spacing and typography, compressed mobile screenshot quality, native app feel, subtle JPEG compression. Show 5-star customer reviews, Malay language review text, "verified purchase" labels, real customer uploaded photos, probiotics bottle product photos (some reviews contain 2-4 bottles without packaging box), natural casual lighting. DO NOT: invent fantasy UI, floating product packaging, centered composition, poster-style layout, ecommerce advertisement, fake futuristic interface, symmetrical design. The image must feel "a real person opened Shopee app and took a screenshot". Show EXACT PRODUCT PRICE from brief.
      - social_selfie.jpg, style="Muslim woman selfie social proof", aspectRatio="4:5": Malaysian Muslim woman in hijab, mid-30s, holding product in selfie, genuine smile, casual home, natural daylight, UGC quality.
      - social_crowd.jpg, style="Crowd group social proof", aspectRatio="4:5": group of 3-4 Malaysian women different ages (some in hijab), each holding the product, smiling, casual outdoor, candid group photo feel, trust and community vibe.

12. type="whatsapp-testimonials", imageAspectRatio="4:5"
    • reviews: 4 chat-style testimonials (multi-line, emojis, authentic Malay)
    • copy: short framing
    • 4 imagePrompts ALL aspectRatio="4:5":
      ALL 4 ARE REAL WHATSAPP SCREENSHOTS — NOT marketing graphics. The image must look like "a real person opened WhatsApp and took a screenshot". Use authentic WhatsApp 2025 UI: status bar with battery/wifi/time, green header, contact name + avatar circle, message bubbles (green outgoing + white incoming), realistic timestamps, real font hierarchy, real spacing, input bar at bottom. Compressed mobile screenshot quality, subtle JPEG compression, slightly imperfect crop. Malay/English mix text, natural emoji use.

      MIX STRUCTURE — 2 pure chats + 2 chats WITH attached product photo (DIFFERENT compositions):
      - wa_01.jpg, style="WhatsApp screenshot PURE — no attachment", aspectRatio="4:5": Pure chat screen — header, message bubbles, input bar. NO image attachment in chat. Malaysian sender, casual review text about product results.
      - wa_02.jpg, style="WhatsApp screenshot PURE — different convo, no attachment", aspectRatio="4:5": DIFFERENT Malaysian sender name + DIFFERENT avatar color + DIFFERENT timestamps from wa_01. Different conversation flow, different emojis. Still pure chat, no attachment.
      - wa_03.jpg, style="WhatsApp screenshot WITH single-bottle attachment", aspectRatio="4:5": Real WhatsApp chat where the user sent an image attachment of ONE bottle ONLY (no packaging box) on a casual home surface — kitchen counter or dining table. The attached image looks like a customer phone snap (slightly imperfect lighting, real home background). Surrounding chat: 2-3 Malay text messages discussing the product.
      - wa_04.jpg, style="WhatsApp screenshot WITH multi-bottle attachment", aspectRatio="4:5": DIFFERENT chat partner from wa_03 (different name, different avatar, different timestamps). Image attachment shows 2-4 bottles together (family pack feel) — NO packaging box, just multiple bottles standing on a real surface (dining table / shelf / kitchen). Different home environment from wa_03. Surrounding chat: different message flow, different emojis.

      STRICT BAN for the whole WhatsApp section:
        • Identical attached product photos across wa_03 and wa_04 (must be DIFFERENT composition: single vs multi)
        • Always-paired "box + bottle side-by-side" composition in the attachment (no box at all in wa_03/wa_04)
        • Floating product PNG over the chat UI (the product appears ONLY as a natural image-message bubble)
        • Fake / futuristic / AI-looking WhatsApp UI — must match real WhatsApp 2025 spacing and typography
        • Poster / infographic / advertisement layout

13. type="news-proof", imageAspectRatio="4:5"
    • copy: authority framing text about health concern
    • 2 imagePrompts both aspectRatio="4:5":
      - news_01.jpg, style="Malaysia news article screenshot", aspectRatio="4:5": realistic Malaysian newspaper/health portal article screenshot (mStar / Berita Harian / health.com.my style). Headline about the health problem this product solves. Article text partially visible. Publication header. Real article aesthetic.
      - news_02.jpg, style="Malaysia health authority screenshot", aspectRatio="4:5": realistic Malaysian health authority website or viral Facebook health post. Ministry of Health or university hospital branding. Authentic institutional aesthetic.

14. type="before-after", imageAspectRatio="4:5"
    • copy: transformation narrative
    • 4 imagePrompts all aspectRatio="4:5":
      4 INDEPENDENT phone-quality photos in PAIRS. NO collages, NO split-frames, NO "Sebelum/Selepas" labels rendered inside the image, NO gym-influencer transformation, NO race/body-shape swap, NO activewear / sports-bra reveal.

      PAIR A (ba_01 ↔ ba_02) — portrait pair, SAME-SCENE LOCK:
        Same Malaysian woman, same room, same camera distance, same camera angle, same outfit family (both casual home tees / both modest hijab + loose top). Only stomach contour + posture + lighting mood + expression differ.
      - ba_01.jpg, style="Before portrait — same-scene, tired state", aspectRatio="4:5": Malaysian woman in casual home setting, cool dim window light, slouched posture, low-energy expression, slight bloat visible under loose tee. NO product. NO text overlay.
      - ba_02.jpg, style="After portrait — same-scene, brighter state", aspectRatio="4:5": SAME person, SAME room corner, SAME camera angle, SAME outfit family as ba_01. Warmer light through the SAME window. Relaxed upright posture, subtle natural smile, skin and eyes brighter, stomach noticeably flatter under the same style top. NO product. NO text overlay.

      PAIR B (ba_03 ↔ ba_04) — half-body pair (face MUST be visible), SAME-SCENE LOCK:
        Second Malaysian woman testimonial. THREE-QUARTER body framing showing head-to-waist (face visible + stomach visible together — DO NOT crop the face out). Same room, same mirror or wall background, same camera distance, same outfit family. Not a side-only or stomach-only crop — viewer must see WHO this is.
      - ba_03.jpg, style="Before half-body — face + stomach visible, tired state", aspectRatio="4:5": three-quarter body shot of Malaysian woman, casual loose top, slight belly bloat visible under shirt, low-energy tired expression on her face. Dim same-room lighting, slumped posture. Face fully visible — no body-only crop. NO product. NO labels. NO sports bra / activewear / lingerie.
      - ba_04.jpg, style="After half-body — face + stomach visible, healthier state", aspectRatio="4:5": SAME person, SAME three-quarter framing, SAME camera distance, SAME outfit family as ba_03. Brighter same-window light. Natural confident smile on face, flatter stomach under the same casual top, improved posture. Face fully visible. NO product. NO labels.

      ABSOLUTE BANS for the whole before-after section:
        • Collages / split-frames / side-by-side composites
        • "Sebelum" / "Selepas" / "Before" / "After" text rendered into the image
        • Gym influencer transformation / sports-bra reveal / lingerie
        • Race or body-shape swap between BEFORE and AFTER (must be the same person)
        • Different room / different camera / different outfit family between pair members

15. type="faq"
    • faqs: 5-7 Malaysia FAQs (halal, side effects, "berapa lama nampak hasil", COD, shipping, return, allergies)
    • imagePrompts: []

16. type="offer", imageAspectRatio="16:9" (or "1:1") — PROMO BANNER SECTION (price + discount focus)
    • offerStrip, urgencyText, cta
    • bullets: 3-5 "✅ Bonus X (RM Y)" stack items
    • copy: value stack + COD offer
    • 2 imagePrompts REQUIRED — both must use the SAME ratio as the section (1:1 OR 16:9, never mix):
      - offer_01.jpg, style="Promo banner clean ecommerce", aspectRatio="<section ratio>":
        Clean Malaysian ecommerce promo banner. The EXACT uploaded product packaging large and centered (preserve label/typography/cap/colors). Soft gradient background (warm amber → cream OR cool teal → white). Large readable Malay promo text overlay reading EXACTLY these three lines: "DISKAUN 50% HARI INI" + "COD SELURUH MALAYSIA" + "STOK TERHAD". Small trust badges (HALAL / KKM / shield icon). Native Facebook/TikTok ecommerce feel. Mobile-friendly composition.
      - offer_02.jpg, style="Promo banner hard sell urgency", aspectRatio="<section ratio>":
        Higher-contrast urgent Malaysian ecommerce banner. EXACT uploaded product packaging large and bold. Background darker / more saturated (deep red, navy + amber accent). Strong CTA arrow or starburst. Bold readable Malay text overlay reading EXACTLY: "PROMOSI TAMAT MALAM INI" + "JANGAN LEPASKAN PELUANG" + "RAMAI DAH CUBA". Visible CTA button shape. Native MY ecommerce hard-sell feel, not luxury, not cinematic.
      ABSOLUTE: Show EXACT PRODUCT PRICE from brief in both banners. Use ONLY the uploaded packaging — never invent label, logo, or bottle shape. Negative: fake packaging, Western branding, luxury cinematic poster, tiny product, unreadable text, blurry overlay, random supplement bottle, overdesigned layout.

17. type="final-cta", imageAspectRatio="16:9" (or "1:1") — SOCIAL PROOF METRICS BANNER (CTA emphasis)
    • headline, subheadline, cta, urgencyText
    • copy: closing pitch
    • 2 imagePrompts REQUIRED — both must use the SAME ratio as the section (1:1 OR 16:9, never mix):
      - finalcta_01.jpg, style="Final CTA social proof banner — clean premium metrics", aspectRatio="<section ratio>":
        Last-scroll-stopper CTA infographic banner with social proof METRICS.
        EXACT uploaded product packaging centered with subtle glow halo, surrounded by a halo of small
        floating metric chips: "★ 4.8/5", "20,000+ pengguna", "✓ Verified KKM Malaysia", "✓ COD seluruh Malaysia",
        "TOP RATED 2026". A row of 2-3 mini before/after thumbnail cards across the bottom (abstract or blurred faces).
        Clean premium gradient (cream / pearl / soft teal). Large readable Malay text overlay:
          "KESIHATAN ANDA BERMULA HARI INI" + "CUBA SEKARANG" + "DISKAUN 50%"
        Trust feel, CTA centered as a clear button. Mobile-friendly text size.
      - finalcta_02.jpg, style="Final CTA social proof banner — emotional urgency metrics", aspectRatio="<section ratio>":
        Emotional urgent CTA banner with social proof.
        EXACT uploaded product packaging large with red glow accent. Around it: big bold "★★★★★ 4.8/5", "20,000+
        ORDER", "TRENDING #1 MALAYSIA", "PILIHAN IBU-IBU" cards, "COD MALAYSIA" badge with truck icon.
        Mini testimonial chips ("Best!", "Suka sangat!") across the bottom.
        Darker high-contrast bg (deep navy or charcoal with red accent). Strong visible CTA button. Bold Malay text:
          "JANGAN TUNGGU SEHINGGA MAKIN TERUK" + "BERTINDAK HARI INI" + "PROMOSI TERHAD"
        Native MY ecommerce conversion feel — multi-card infographic, not a plain poster.
      ABSOLUTE: Use ONLY the uploaded packaging — never invent or alter. Both banners MUST be SOCIAL PROOF METRICS
      infographics (rating + user count + trust badge + COD badge as visible elements) — never a plain product photo.
      Negative: fake packaging, Western branding, luxury cinematic poster, tiny product, unreadable text, blurry
      overlay, random supplement bottle, overdesigned layout, plain solo product shot with no social proof.

═══════════════════════════════════════════════════════════════
CRITICAL IMAGE PROMPT RULES
═══════════════════════════════════════════════════════════════
• ALWAYS English, 30-80 words
• ASPECT RATIO: only "1:1" or "4:5" — 9:16 and 16:9 are completely banned
• All imagePrompts in a section must use the section's imageAspectRatio value
• DEFAULT ETHNICITY: Malaysian native / Southeast Asian
• NEVER cinematic / editorial / luxury / stock-photo
• Aesthetic: Facebook Ads Malaysia native ecommerce UGC — real phone, real lighting
• PRODUCT IDENTITY: for sections where the product appears (TikTok, Shopee, selfie, crowd, hero), instruct the model to use the exact same product packaging — same bottle shape, label, cap color, logo placement
• PRICE ACCURACY: for TikTok Shop, Shopee, promo banner image prompts — include the EXACT price from the product offer field. Do NOT invent any other price.
• Text overlay prompts: include exact text content (e.g. "bold white text overlay reads: ✓ Kurang Penat ✓ Tenaga Lebih")
• Screenshot prompts: note "slightly JPEG-compressed", "imperfect real phone quality", "authentic"
• Before/after (V4 spec): amateur quality, NOT gym influencer, NOT professional. ba_01↔ba_02 = SAME-SCENE pair (same person/room/camera/outfit family). ba_03↔ba_04 = SAME-SCENE pair (same person side-profile). Only stomach contour + light mood + posture differ within each pair. This OVERRIDES the global diversity rule below for these 4 images.

═══════════════════════════════════════════════════════════════
DIVERSITY RULES — ZERO TOLERANCE FOR AI-CLONE LOOK (applies to ALL non-banner sections except before-after)
═══════════════════════════════════════════════════════════════
The #1 dead giveaway of AI-generated landing pages is "same hand pose / same bottle angle / same lighting / same background" across multiple shots. End users spot it instantly and lose trust. Treat every image as if a DIFFERENT person took it on a DIFFERENT day in a DIFFERENT room.

LOCK (must stay identical across all images in the pack):
  • Product brand TEXT on the label (no fake brand substitution like "OXEVIN" / "DOSPRO")
  • Logo design + label typography + label colors
  • Bottle / jar / sachet SHAPE + cap style + packaging ratio
  • Person ethnicity (Malaysian) and broad age range

VARY (MUST change image-to-image inside the same section):
  • Background / room / surface / props — different room corner, different surface
  • Camera angle — eye-level / slight low-angle / 3/4 / top-down / waist-level / mirror
  • Hand pose — both hands / one hand / no hands / pointing / cradling / lifting / palm
  • Lighting direction — left window / right window / overhead / warm dim / cool morning / golden hour
  • Bottle rotation — front-facing / 3/4 / side / slight back / top-down
  • Person outfit (when person appears) — different shirt color/style per shot
  • Person facial expression — never copy the exact same expression twice

PROHIBITED in any single section with 3+ images:
  ✗ Two consecutive images using the same camera angle
  ✗ Two consecutive images using the same hand pose
  ✗ Two consecutive images using the same lighting direction
  ✗ Two consecutive images using the same background context

ABSOLUTE BANS across the whole pack:
  ✗ Product rendered as a cut-out PNG pasted over a background (floating packshot)
  ✗ Two product variants stacked / composited in one frame
  ✗ Identical product packshot reused as a "designed graphic" next to chat / review screens
  ✗ Studio / cinematic / luxury aesthetic — we want phone UGC

ENFORCEMENT: in every imagePrompt body, EXPLICITLY state the chosen background + angle + hand + lighting. Example: "kitchen morning sunlight, 3/4 waist-height angle, one hand cradling product at chest, warm window glow from left". DO NOT write generic "Malaysian woman holding product" — that produces clones

═══════════════════════════════════════════════════════════════
LANGUAGE RULES — ABSOLUTE
═══════════════════════════════════════════════════════════════
• The user prompt specifies the OUTPUT LANGUAGE — this is BINDING and NON-NEGOTIABLE
• ALL copy fields MUST be written ENTIRELY in the specified output language:
  copy, headline, subheadline, cta, offerStrip, urgencyText, bullets,
  faqs (questions AND answers), reviews (quotes), WhatsApp message text,
  before/after labels, comparison table labels, imagePrompt text overlay content
• DO NOT mix languages within any single field — if language is Bahasa Melayu,
  every word of copy must be Bahasa Melayu (natural colloquial, can include
  common English loanwords like "detox", "supplement" — but NO full English sentences)
• viTranslation: ALWAYS on every section — Vietnamese translation of copy (regardless of output language)
• Per-field Vietnamese translations (titleVi, headlineVi, subheadlineVi, ctaVi, offerStripVi, urgencyTextVi, bulletsVi):
  ALWAYS in Vietnamese regardless of output language. Generate them whenever the source field exists.
  If output language is already 'vi' (Vietnamese), still include them — just mirror the original (UI dedupes).
• bulletsVi MUST have the same length as bullets and be index-aligned (bullet[0] ↔ bulletsVi[0]).
• layoutGuide: ALWAYS Vietnamese regardless of output language
• imagePrompt.prompt: ALWAYS English (required by the image generation model)
• Product name + ingredient names: keep original English / brand name in any language

═══════════════════════════════════════════════════════════════
COPY FORMAT — mobile-first
═══════════════════════════════════════════════════════════════
• Short paragraphs (1-3 lines) + blank lines between
• Strategic emojis at paragraph starts
• ✅ benefits / ❌ failed alternatives
• 👉 / 👇 for CTAs
• NO walls of text, NO markdown headers
• NEVER claim cure / treatment / guaranteed — advertorial-safe only`

// ─────────────────────────────────────────────────────────────────────

function getGeminiKey(): string {
  const s = useSettingsStore.getState()
  if (!s.hasGeminiKey()) {
    throw new Error('Chưa có Google Gemini API key. Vào Cài đặt → nhập key từ aistudio.google.com')
  }
  return s.getGeminiApiKey()
}

/** Extract the first RM price string from the product offer field. */
function extractPriceTag(offer: string): string | null {
  if (!offer) return null
  const match = offer.match(/RM\s*\d+(?:\.\d{1,2})?/i)
  return match ? match[0].replace(/\s+/, '') : null
}

function buildUserPrompt(params: LandingGenParams): string {
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm trong bank')

  const lines: string[] = []
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('PRODUCT BRIEF (use REAL fields — never invent)')
  lines.push('═══════════════════════════════════════════════════════════════')
  if (product.productName)        lines.push(`Name: ${product.productName}`)
  if (product.productDescription) lines.push(`Description: ${product.productDescription}`)
  if (product.targetMarket)       lines.push(`Target market: ${product.targetMarket}`)
  if (product.painPoints)         lines.push(`Pain points: ${product.painPoints}`)
  if (product.usps)               lines.push(`USPs: ${product.usps}`)
  if (product.benefits)           lines.push(`Benefits: ${product.benefits}`)
  if (product.offer)              lines.push(`Offer: ${product.offer}`)
  if (product.ingredients)        lines.push(`★ Ingredients (use REAL names): ${product.ingredients}`)

  // ── Explicit pricing line — prevents Gemini from hallucinating wrong prices ──
  const priceTag = extractPriceTag(product.offer ?? '')
  if (priceTag) {
    lines.push(`★ EXACT SELLING PRICE: ${priceTag} — ALL ecommerce screenshot image prompts (TikTok Shop, Shopee, promo banners) MUST display ONLY this price. Do NOT invent any other price.`)
  }

  lines.push('')

  // ── LANGUAGE LOCK — strong explicit block prevents mixing ────────────
  const langName =
    params.language === 'ms' ? 'Bahasa Melayu (Malaysia)' :
    params.language === 'vi' ? 'Tiếng Việt (Vietnamese)' :
    'English'
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`OUTPUT LANGUAGE LOCK: ${langName}`)
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`ALL copy fields (copy, headline, subheadline, cta, offerStrip, urgencyText,`)
  lines.push(`bullets, faqs questions+answers, reviews quotes, WhatsApp texts, before/after labels,`)
  lines.push(`comparison table labels, imagePrompt text overlay content) MUST be written`)
  lines.push(`ENTIRELY in ${langName}. Zero exceptions. Zero mixing with other languages.`)
  lines.push(`EXCEPTIONS (always Vietnamese regardless of output language):`)
  lines.push(`  layoutGuide, viTranslation, titleVi, headlineVi, subheadlineVi, ctaVi, offerStripVi, urgencyTextVi, bulletsVi`)
  lines.push(`EXCEPTIONS (always English): imagePrompt.prompt`)
  lines.push(`EXCEPTIONS (keep brand name as-is): product name, ingredient names`)
  lines.push(`bulletsVi MUST be the same length as bullets (index-aligned 1:1 translation).`)
  lines.push(`Output language field in JSON: "${params.language}"`)

  if (params.nicheHint) {
    lines.push('')
    lines.push(`Niche hint: ${params.nicheHint}`)
  }

  // ── FORM-SPECIFIC COPY STYLE ─────────────────────────────────────────
  const form = params.form ?? 'ugc-malaysia'
  if (form !== 'ugc-malaysia') {
    lines.push('')
    lines.push('═══════════════════════════════════════════════════════════════')
    if (form === 'advertorial') {
      lines.push('FORM STYLE: ADVERTORIAL / REVIEW')
      lines.push('═══════════════════════════════════════════════════════════════')
      lines.push('• Write copy as a personal editorial / review article — first-person narrative throughout')
      lines.push('• Story arc: relatable hook story → problem deep-dive → discovery moment → results journey → social proof → offer')
      lines.push('• Longer paragraphs (3-5 lines), storytelling rhythm, build trust before selling')
      lines.push('• Reduce direct hard-sell language — increase "this is what happened to me / my friend" authenticity')
      lines.push('• Pain section: personal story angle, not just bullet lists')
      lines.push('• FAQ: feel like real reader questions answered by a trusted blogger, not a brand')
      lines.push('• Social proof: integrate testimonials into the narrative, not just as screenshots')
    } else if (form === 'premium') {
      lines.push('FORM STYLE: PREMIUM BRAND')
      lines.push('═══════════════════════════════════════════════════════════════')
      lines.push('• Clean, sophisticated copy — minimal hard-sell urgency, no countdown scarcity')
      lines.push('• Focus on aspirational lifestyle, quality ingredients, brand heritage, efficacy')
      lines.push('• Fewer emojis (max 1-2 per section), more elegant flowing prose')
      lines.push('• Avoid "❌ SOLD OUT" / "HARI INI SAHAJA" / countdown language')
      lines.push('• Social proof: curated quality testimonials over quantity screenshots')
      lines.push('• Offer section: premium framing — value, exclusivity, quality promise — not cheap COD discount')
      lines.push('• Before/after: subtle transformation, not dramatic COD-style comparison')
      lines.push('• WhatsApp: fewer but more thoughtful/eloquent testimonials')
    } else if (form === 'hard-sell-cod') {
      lines.push('FORM STYLE: HARD SELL COD')
      lines.push('═══════════════════════════════════════════════════════════════')
      lines.push('• MAXIMUM urgency in every section — scarcity, time pressure, FOMO throughout')
      lines.push('• Multiple strong CTAs: not just in offer section but also in hero, social proof, before/after')
      lines.push('• Copy: short punchy sentences (max 1-2 lines), heavy emoji use 🔥 ⚠️ ✅ 🚨 💥')
      lines.push('• Urgency phrases: "HARI INI SAHAJA", "STOK TERHAD — X unit je tinggal", "ORDER SEKARANG"')
      lines.push('• Offer section: ultra-aggressive — big value stack, bonus expiry warning, COD emphasis')
      lines.push('• Pain section: short sharp emotional hits, not long paragraphs')
      lines.push('• FAQ: reframe as objection-crushing — address "berapa lama?" with specific rapid results')
      lines.push('• Add urgency strip: "⏰ PROMOSI TUTUP [TIME/DATE]" to headline/offer')
    }
  }

  // ── COMPETITOR INFLUENCE ─────────────────────────────────────────────
  const competitorUrl = params.competitorUrl || params.sourceUrl
  if (competitorUrl) {
    lines.push('')
    lines.push('═══════════════════════════════════════════════════════════════')
    lines.push('COMPETITOR REFERENCE')
    lines.push('═══════════════════════════════════════════════════════════════')
    lines.push(`Competitor landing page: ${competitorUrl}`)
    const influence = params.competitorInfluence ?? 'low'
    if (influence === 'low') {
      lines.push('INFLUENCE LEVEL: LOW')
      lines.push('→ Only learn the tone, voice, and writing style from this competitor.')
      lines.push('→ Do NOT copy their structure, section ideas, or any product information.')
    } else if (influence === 'medium') {
      lines.push('INFLUENCE LEVEL: MEDIUM')
      lines.push('→ Adopt their copywriting style AND borrow interesting section angles / ideas that suit our product.')
      lines.push('→ Do NOT copy their product claims, pricing, brand name, or specific product facts.')
    } else if (influence === 'high') {
      lines.push('INFLUENCE LEVEL: HIGH')
      lines.push('→ Strongly adapt the persuasion structure, argumentation flow, and emotional triggers from this competitor.')
      lines.push('→ Rebuild it entirely for our product. Mirror what works, reimagine for our niche.')
      lines.push('→ NEVER copy: product name, ingredients, price, dosage, brand identity, or any product-specific fact.')
    }
    lines.push('HARD RULES regardless of influence level:')
    lines.push('• NEVER override product name, price, ingredients, selected language, or 17-section structure')
    lines.push('• NEVER reproduce verbatim sentences from the competitor page')
  }

  lines.push('')
  lines.push('Generate the 17-section advertorial asset pack as a single STRICT JSON object. No markdown fences, no commentary — JSON only. EVERY section MUST include viTranslation and imageAspectRatio (where images exist).')

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────

function extractJson(raw: string): string {
  let s = raw.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]+?)```/)
  if (fence) s = fence[1].trim()
  const first = s.indexOf('{')
  const last  = s.lastIndexOf('}')
  if (first >= 0 && last > first) s = s.slice(first, last + 1)
  return s
}

type RawSection = Omit<Partial<LandingSection>, 'type'> & { type?: string }

interface RawPack {
  language?: string
  sections?: RawSection[]
}

const SECTION_ORDER: SectionType[] = [
  'hero', 'pain', 'why-happens', 'failed-solutions', 'product-discovery',
  'ingredients', 'mechanism', 'benefits', 'comparison', 'lifestyle',
  'social-proof', 'whatsapp-testimonials', 'news-proof', 'before-after',
  'faq', 'offer', 'final-cta',
]

type LockedRatio = '1:1' | '4:5' | '16:9'

/** Hardcoded fallback aspect ratios — applied even when Gemini omits the field.
 *  Guarantees no 9:16 ever makes it into the pack.
 *  offer + final-cta are BANNER sections and default to 16:9 landscape. */
const SECTION_ASPECT_DEFAULTS: Partial<Record<SectionType, LockedRatio>> = {
  'hero':                    '4:5',
  'pain':                    '4:5',
  'why-happens':             '1:1',
  'failed-solutions':        '4:5',
  'product-discovery':       '4:5',
  'ingredients':             '1:1',
  'mechanism':               '1:1',
  'benefits':                '1:1',
  'comparison':              '1:1',
  'lifestyle':               '4:5',
  'social-proof':            '4:5',
  'whatsapp-testimonials':   '4:5',
  'news-proof':              '4:5',
  'before-after':            '4:5',
  'offer':                   '16:9',
  'final-cta':               '16:9',
}

/** Which ratios are LEGAL for each section.
 *  Banner sections (offer, final-cta): 1:1 or 16:9 only (no 4:5).
 *  Everything else: 1:1 or 4:5 only (no 16:9). */
const ALLOWED_RATIOS_BY_SECTION: Partial<Record<SectionType, ReadonlyArray<LockedRatio>>> = {
  'offer':     ['1:1', '16:9'],
  'final-cta': ['1:1', '16:9'],
}
const DEFAULT_ALLOWED: ReadonlyArray<LockedRatio> = ['1:1', '4:5']

function normalizeSection(s: RawSection): LandingSection | null {
  const type = SECTION_ORDER.find((t) => t === s.type)
  if (!type) return null

  // Sanitize the section-level aspect ratio against the per-section whitelist.
  const allowed = ALLOWED_RATIOS_BY_SECTION[type] ?? DEFAULT_ALLOWED
  const rawRatio = s.imageAspectRatio as string | undefined
  const lockedRatio: LockedRatio =
    (rawRatio === '1:1' || rawRatio === '4:5' || rawRatio === '16:9') && allowed.includes(rawRatio as LockedRatio)
      ? (rawRatio as LockedRatio)
      : SECTION_ASPECT_DEFAULTS[type] ?? '4:5'

  // Sanitize each image prompt's aspectRatio to match the section lock.
  const imagePrompts = Array.isArray(s.imagePrompts)
    ? s.imagePrompts.map((p) => ({ ...p, aspectRatio: lockedRatio }))
    : []

  // Z10: pad bulletsVi to match bullets length if Gemini under-translated
  const bullets = Array.isArray(s.bullets) ? s.bullets.map(String) : undefined
  let bulletsVi: string[] | undefined
  if (bullets && Array.isArray(s.bulletsVi)) {
    const viArr = s.bulletsVi.map(String)
    // Truncate or pad to match — guard against Gemini returning mismatched array
    bulletsVi = bullets.map((_, i) => viArr[i] ?? '')
    // If every entry is empty, drop the field
    if (bulletsVi.every((v) => !v.trim())) bulletsVi = undefined
  }

  return {
    type,
    title: s.title ?? type,
    titleVi: s.titleVi,
    copy: s.copy ?? '',
    layoutGuide: s.layoutGuide ?? '',
    viTranslation: s.viTranslation,
    imageAspectRatio: lockedRatio,
    headline: s.headline,
    subheadline: s.subheadline,
    cta: s.cta,
    offerStrip: s.offerStrip,
    urgencyText: s.urgencyText,
    bullets,
    faqs: Array.isArray(s.faqs) ? s.faqs : undefined,
    reviews: Array.isArray(s.reviews) ? s.reviews : undefined,
    imagePrompts,
    imageSizeHint: s.imageSizeHint,
    // ── Z10: per-field VN translations ────────────────────────────────
    headlineVi:     s.headlineVi,
    subheadlineVi:  s.subheadlineVi,
    ctaVi:          s.ctaVi,
    offerStripVi:   s.offerStripVi,
    urgencyTextVi:  s.urgencyTextVi,
    bulletsVi,
  }
}

// ─────────────────────────────────────────────────────────────────────
// Post-processing: inject exact price into ecommerce screenshot prompts.
// Runs after normalizeSection so we catch prompts Gemini hallucinated
// wrong prices into.
// ─────────────────────────────────────────────────────────────────────
function injectPriceIntoPrompts(sections: LandingSection[], priceTag: string | null): void {
  if (!priceTag) return
  const ecommerceKeywords = ['tiktok', 'shopee', 'promo', 'banner', 'offer', 'cta hero']
  sections.forEach((section) => {
    section.imagePrompts.forEach((ip) => {
      const lower = ip.style.toLowerCase()
      if (!ecommerceKeywords.some((k) => lower.includes(k))) return
      if (!ip.prompt.toLowerCase().includes('rm')) {
        ip.prompt += ` Price shown must be exactly "${priceTag}" — do NOT display any other price.`
      } else {
        // Replace any hallucinated RM price with the correct one
        ip.prompt = ip.prompt.replace(/RM\s*\d+(?:\.\d{1,2})?/gi, priceTag)
        if (!ip.prompt.includes('do NOT display any other price')) {
          ip.prompt += ` (show only ${priceTag})`
        }
      }
    })
  })
}

// ─────────────────────────────────────────────────────────────────────

export async function generateLandingPack(params: LandingGenParams): Promise<LandingPagePack> {
  const apiKey = getGeminiKey()
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm — chọn lại từ Project')

  const userPrompt = buildUserPrompt(params)
  const priceTag = extractPriceTag(product.offer ?? '')

  const raw = await directGeminiVision({
    apiKey,
    parts: [{ text: userPrompt }],
    systemInstruction: SYSTEM_PROMPT,
    // 17 sections × rich content + viTranslation + image prompts
    maxOutputTokens: 32768,
    responseMimeType: 'application/json',
  })

  let parsed: RawPack
  try {
    parsed = JSON.parse(extractJson(raw)) as RawPack
  } catch {
    console.error('[LandingPageAI] JSON parse failed. Raw:', raw.slice(0, 500))
    throw new Error('Gemini trả về JSON không hợp lệ — thử lại')
  }

  if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    throw new Error('Gemini không trả về section nào — thử lại')
  }

  const sections: LandingSection[] = []
  for (const ord of SECTION_ORDER) {
    const found = parsed.sections.find((s) => s.type === ord)
    if (found) {
      const norm = normalizeSection(found)
      if (norm) sections.push(norm)
    }
  }

  if (sections.length === 0) {
    throw new Error('Không có section nào hợp lệ trong JSON Gemini trả về')
  }

  // ── Post-processing: lock price in ecommerce screenshot prompts ──────
  injectPriceIntoPrompts(sections, priceTag)

  return {
    productId: params.productId,
    productName: product.productName,
    language: (parsed.language as LandingLanguage) ?? params.language,
    sections,
    visualMemory: params.visualMemory ?? [],
    generatedAt: Date.now(),
  }
}
