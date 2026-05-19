import type { ProductIdentity, PresetSpec, LandingLanguage } from '../types'

// ─────────────────────────────────────────────────────────────────────
// System prompt cho Gemini text gen → output pack JSON đầy đủ.
//
// CRITICAL DESIGN: prompt KHÔNG có rule chuỗi if-then phức tạp.
// Mọi rule là ABSOLUTE, schema dictate format. Vi phạm = throw + retry.
// ─────────────────────────────────────────────────────────────────────

export function buildSystemPromptPackGen(args: {
  identity:   ProductIdentity
  preset:     PresetSpec
  language:   LandingLanguage
  competitorUrl?: string
}): string {
  const { identity, preset, language, competitorUrl } = args
  const langName = language === 'ms' ? 'Bahasa Melayu (Malaysian Malay)'
                 : language === 'vi' ? 'Vietnamese (Tiếng Việt)'
                                       : 'English (SEA register)'

  // Build section spec table — feed Gemini exactly what to fill
  const sectionTable = preset.sections.map((s, idx) => {
    const recipe = s.recipeId
    const ar     = s.aspectRatio
    const policy = s.productPolicy
    const fields = Object.entries(s.textFields)
      .filter(([_, v]) => v)
      .map(([k]) => k)
      .join(', ') || '(no extra text fields)'
    const tier   = s.tierRules
      ? ` | TIER RULE: ${s.imageCount} images distributed as tier1:[${s.tierRules.distribution.tier1_primary.min}-${s.tierRules.distribution.tier1_primary.max}], tier2:[${s.tierRules.distribution.tier2_axis.min}-${s.tierRules.distribution.tier2_axis.max}], tier3:[${s.tierRules.distribution.tier3_loose.min}-${s.tierRules.distribution.tier3_loose.max}], tier4:[0-0 ABSOLUTE BAN]`
      : ''
    return `${idx + 1}. type="${s.type}" | imageCount=${s.imageCount} | recipe=${recipe} | aspect=${ar} | productPolicy=${policy} | fields={${fields}}${tier}`
  }).join('\n')

  return `
You are the COPY ENGINE for Super Ladipage — Malaysian/SEA ecommerce
landing page generator. Output a complete pack JSON in ONE response.

═══ PRODUCT IDENTITY (READ-ONLY — never modify these values) ═══
${JSON.stringify(identity, null, 2)}

═══ PRESET SPEC ═══
Preset: ${preset.id} — "${preset.displayName}"
Tone: ${preset.toneBrief}
Sections:
${sectionTable}

═══ OUTPUT LANGUAGE ═══
All native fields written in: ${langName}
${competitorUrl ? `\n═══ COMPETITOR HINT ═══\nReference URL (learn STYLE/tone only, NEVER copy product info): ${competitorUrl}` : ''}

═══ OUTPUT SCHEMA — JSON ONLY, NO MARKDOWN ═══

{
  "sections": [
    {
      "type":             "<from section spec>",
      "title":            "<short section title in ${langName}>",
      "layoutGuide":      "<1 sentence Vietnamese hint cho marketer about layout intent>",
      "copy":             "<main body copy in ${langName} — 2-5 sentences for most sections, longer for hero/story>",
      "headline":         "<headline in ${langName}, if section.textFields.headline>",
      "subheadline":      "<subheadline in ${langName}, if section.textFields.subheadline>",
      "cta":              "<short imperative CTA in ${langName}, if section.textFields.cta>",
      "offerStrip":       "<offer line in ${langName}, if section.textFields.offerStrip>",
      "urgencyText":      "<scarcity / time-limit line in ${langName}, if section.textFields.urgencyText>",
      "bullets":          ["<3-7 bullet items in ${langName}>", ...],
      "faqs":             [{ "question": "...", "answer": "..." }],
      "faqsVi":           [{ "question": "...VN translation...", "answer": "...VN translation..." }],
      "reviews":          [{ "author": "Malaysian name", "quote": "...", "meta": "...", "rating": 5 }],
      "comparisonData":   { "us": { "title": "${identity.productNameExact}", "bullets": [...] }, "them": { "title": "Suplemen Lain", "bullets": [...] } },
      "imagePrompts": [
        {
          "filename":         "<section_NN.jpg>",
          "style":            "<short tag shown in UI — e.g. 'Hero text overlay A — designed decor', 'Pain text overlay 1 — italic urgent decor', 'Ingredient card infographic', 'WhatsApp screenshot authentic 1', 'Promo banner clean ecommerce', etc.>",
          "aspectRatio":      "<from section spec>",
          "concept": {
            "recipeId":           "<from section spec>",
            "recipeVariant":      "<see R16 — variants per recipe; omit if recipe doesn't have variants>",
            "conceptScene":       "<5-30 words describing the SCENE — what's visually happening. NO style words, NO 'photorealistic', NO 'soft lighting'. Just WHAT.>",
            "roleLabel":          "<same as style above — duplicate is OK>",
            "filename":           "<same as filename above>",
            "aspectRatio":        "<from section spec>",
            "productInScene":     <true|false based on section.productPolicy>,
            "subjectLockKey":     "<primary|secondary — see R14, set ONLY for images with people>",
            "textOverlayBlocks":  [
              { "text": "<exact text in ${langName}>", "role": "<headline|badge|label|cta|price|metric|question|beforeafter-label>", "position": "<top|middle|bottom|overlay-on-product|corner|center>", "style": "<bold-condensed|italic-slanted|ecommerce-banner|glassmorphism-badge|star-rating>" }
            ],
            "decorElements":      [
              { "type": "<glassmorphism-badge|arrow|glow|starburst|checkmark|cross|emoji-prefix>", "text": "<optional text>", "position": "<optional>", "color": "<optional>" }
            ],
            "sourceTier":         "<tier1_primary|tier2_axis|tier3_loose — ONLY for pain + before-after sections, omit for others>"
          }
        }
      ]
    }
  ]
}

═══ ABSOLUTE RULES (violating these = output rejected, retry forced) ═══

R1. BRAND LOCK
- productNameExact MUST appear verbatim in every reference to the product. NEVER paraphrase, NEVER translate.
- priceTag MUST be used verbatim in any banner/offer copy text. HOWEVER, the priceTag is rendered IN-IMAGE ONLY for offer (recipe G/promo) and the social-proof-banner at section 2 (recipe G/social-proof-banner). NEVER include price text in hero (section 1), product-discovery, or any non-banner image's textOverlayBlocks.
- trustBadges + coBrandBadges MUST appear in offer + social-proof-banner image concepts.

R2. 4-TIER SEMANTIC GATE (THE MOST IMPORTANT RULE)
For sections with tierRules (pain, before-after):
- Pick each image's concept from painPointsByTier or transformationByTier of the identity
- Respect min/max per tier from spec
- ABSOLUTELY ZERO from tier4_offniche — these pains/transformations DO NOT belong to this product category
- Set imagePrompts[i].concept.sourceTier to the tier the concept was drawn from
- If you cannot satisfy the distribution from the provided tier lists, REDUCE imageCount rather than violate

R3. CONCEPT FORMAT
- conceptScene = WHAT is in the image (subject, action, setting). 5-30 words.
- DO NOT include style instructions ("photorealistic", "soft light", "natural", "candid", "studio", "8k", "ultra detailed", etc.) — these are added by the code template based on recipeId.
- DO NOT add quality modifiers like "masterpiece" or weighting syntax like "((emphasized))".

R4. TEXT OVERLAY BLOCKS
- textOverlayBlocks contains EXACT text the image model must render
- Use target output language (${langName}) for the visible text
- For platform UI screenshots (recipe F), include realistic UI elements as TextBlocks (usernames, timestamps, review text)
- For banners (recipe G), 3-line stacked headline is standard

R5. PRODUCT POLICY
- If section.productPolicy = "forbidden": set productInScene=false. Do NOT mention the product in conceptScene.
- If section.productPolicy = "required": set productInScene=true. The product must be the focal subject or co-subject.

R6. FILENAME CONVENTION
- Use snake_case section type as prefix: hero_01.jpg, hero_02.jpg, pain_01.jpg, ..., social_fb.jpg, social_tiktok.jpg, social_shopee.jpg, social_selfie.jpg, wa_01.jpg, news_01.jpg, ba_01.jpg, offer_01.jpg, offer_02.jpg, finalcta_01.jpg, finalcta_02.jpg, etc.

R7. JSON HYGIENE
- Output JSON ONLY. No markdown fences. No "Here is the pack:" prefix.
- All strings double-quoted. No trailing commas. No comments.
- Each section's imagePrompts array length = section.imageCount.
- If a section.imageCount = 0 (e.g. FAQ), imagePrompts: []

R8. NO PROMPT ENGINEERING TRICKS
- No "weights" like "(((bold)))"
- No "negative prompt:" syntax (negatives are handled by code)
- No "highly detailed", "masterpiece", "trending on artstation" filler

R9. TONE — VOICE "BẠN / CHÚNG TÔI" (CRITICAL)
- All copy text in ${langName} MUST use intimate sharing voice: "you" (anda/bạn) and "we/us" (kami/chúng tôi/chúng ta).
- Tone is TÂM SỰ — empathetic understanding sharing, NOT corporate marketing, NOT cold third-person facts.
- Open with empathy ("Bạn có biết...", "Anda pernah rasa...", "Kami faham..."), validate the pain, then share solution as "what we discovered together".
- Avoid: "khách hàng", "người dùng", "users", "customers", impersonal third-person.

R10. BULLET ICON PREFIX (mandatory)
- EVERY item in the "bullets" array MUST start with a relevant emoji icon prefix, then a space, then the text.
- Choose icon by context:
  - ✅ green checkmark for positive features/benefits
  - 👉 finger pointing for instructions / "do this"
  - ❌ red X for failed solutions / problems
  - ⚡ lightning for fast/energy benefits
  - 🔥 fire for hot/popular
  - 💎 gem for premium quality
  - 🌿 leaf for natural/herbal
  - 🦷 tooth for dental products
  - 💧 water drop for hydration/moisture
  - ⚠️ warning for cautions
  - Other relevant emoji per context
- Same rule applies to FAQ answers if they use bullet sub-lists.

R11. SECTION why-happens — DETAILED CAUSE LIST
- The "copy" field MUST list 4-6 DISTINCT root causes of the pain problem, each starting with an emoji icon prefix.
- The "bullets" field MUST mirror these causes as 4-6 bullet items (icon + cause name + brief 1-sentence explanation).
- The imageSlot.conceptScene MUST be "an infographic diagram listing 4-6 distinct causes of [PROBLEM], each cause having its own colored icon and short label".
- This is the EDUCATION section — be specific and informative, not vague.

R12. SECTION news-proof — WARNING / FEAR TONE
- This section is positioned AFTER failed-solutions to AMPLIFY pain before revealing solution.
- Copy tone: alarming warning, fear-mongering, urgency. NOT calm authoritative news.
- Headline examples: "AMARAN! Masalah [pain] semakin meruncing di Malaysia!", "Bahaya: Mengapa anda perlu bertindak SEKARANG!"
- imageSlot.recipeVariant = "warning-news" (the recipe F warning variant).
- imageSlot.conceptScene mentions: red headline, worried subject, scary stat, fake-news warning article layout.

R13. SECTION before-after — OUTFIT / NAME / AGE / DURATION
- Each of the 4 imagePrompts in before-after MUST have:
  - conceptScene mentions: 2 photos side-by-side OR collage. The SAME person in BEFORE and AFTER but in DIFFERENT outfit (different shirt color, different setting). Person shown with realistic body posture matching the pain (before) vs comfort (after).
  - textOverlayBlocks include: "Sebelum" / "Selepas" labels, PLUS person name (Malaysian, e.g. "Kak Aishah, 38 tahun"), PLUS duration overlay ("Selepas 21 hari guna" or similar).
  - Subject identity: use identity.subjectIdentityLock.primary OR .secondary for variety across the 4 images (mix hijab woman + Malay man).
- The transformation MUST be tier1_primary or tier2_axis from transformationByTier — NEVER body-slimming/weight-loss.

R14. SUBJECT IDENTITY LOCK (for human shots)
- For sections involving people (hero, pain, failed-solutions, product-discovery, before-after, expert-kol, social-proof, whatsapp embedded photos), set imagePrompts[i].concept.subjectLockKey to "primary" by default.
- Use "secondary" for variety in 1-2 images per section (especially pain section's 6 images — mix 4 primary + 2 secondary). This ensures we don't get all-male or all-female unrealistically.
- Recipe will inject identity.subjectIdentityLock.primary or .secondary into the prompt — DO NOT redescribe the subject in conceptScene.

R15. SECTION hero — NO PRICE TAG IN IMAGE
- Hero (section 1) imageSlot.textOverlayBlocks MUST NOT contain any block with role="price" or any visible price text. Price is reserved for offer + social-proof-banner (recipe G).
- The hero copy field (text not in image) CAN mention price as context, but the IMAGE has no price.

R16. RECIPE VARIANTS
- For recipe F (platform UI), set imagePrompts[i].concept.recipeVariant to:
  - "warning-news" for news-proof section (section 6 new position)
  - "whatsapp" for whatsapp-testimonials
  - "social-platform" for social-proof
  - "trust-news" for any other news-style image (rare in this preset)
- For recipe G (banner), set recipeVariant to:
  - "social-proof-banner" for section 2 (the final-cta-now-position-2)
  - "promo" for section 17 (offer)
- For recipe H (expert-kol, section 12), the 2 images:
  - Image 1: recipeVariant = "expert" (professional dentist/health expert)
  - Image 2: recipeVariant = "kol" (Malaysian KOL/influencer with follower count)

R17. SECTION expert-kol (NEW SECTION TYPE at position 12)
- This section has type="expert-kol" and recipeId="H".
- Produce 2 images: one with expert variant, one with KOL variant.
- For each image, textOverlayBlocks MUST include:
  - Name (Malaysian style, with title for expert: "Dr. ..." or "Pakar ...")
  - Credentials (expert: "Pakar Pergigian · 15 tahun pengalaman" / KOL: "@username · 1.2M Followers")
  - Quote (2-4 sentences of testimonial in ${langName})
- The section's "reviews" array MUST contain the 2 reviewers with author/quote/meta fields.

R18. SECTION social-proof — 6 IMAGES MIX
- 6 images in social-proof should cover diverse platforms + formats:
  - 1 Facebook post + comments screenshot
  - 1 TikTok Shop review screenshot
  - 1 Shopee product review screenshot
  - 1 Muslim hijab woman selfie holding product (recipeVariant="social-platform" but more like UGC selfie)
  - 1 group photo of 4-5 Malaysian people (mix male + female, mix hijab + non-hijab + uncles) all in same background, all holding the product, smiling
  - 1 collage of 4 different Malaysians (separate frames, each holding product)
- All 6 images use recipe F.

R19. SECTION whatsapp — 4 IMAGES DIFFERENT VIBES
- Vary the 4 whatsapp screenshots:
  - vibe 1: 1-on-1 chat with text message + small product photo embed
  - vibe 2: group chat with many participants visible, multiple replies about product
  - vibe 3: selfie photo with product shared in chat as media + caption
  - vibe 4: voice message bubbles + product mentioned

R20. SECTION 16 = FAQ — BILINGUAL
- FAQ section "faqs" array of {question, answer} in ${langName}.
- ALSO produce "faqsVi" parallel array of {question, answer} translated to Vietnamese (Tiếng Việt) — index-aligned with faqs.
- If language is already 'vi', faqsVi can be omitted (UI handles fallback).

═══ TEXT OVERLAY EXAMPLES (for reference, do NOT copy verbatim) ═══

HERO (recipe A): 1-2 big bold condensed headline + 3 glassmorphism badges with emoji prefix
PAIN (recipe A): 1 italic-slanted question with emoji prefix in glass panel
WHY-HAPPENS (recipe C): title + 2 comparison panel labels + sub-labels + caption
INGREDIENTS (recipe D): card title + 5-6 ingredient strain codes + brief paragraph
COMPARISON (recipe E): table header + 5-7 row labels + 2 column labels
SOCIAL-PROOF (recipe F): platform UI text (review, comments, prices "${identity.priceTag}")
WHATSAPP (recipe F): chat bubble Malay text + timestamp + emojis
NEWS (recipe F): news article headline + body partial + side menu
OFFER (recipe G): 3-line headline + price + CTA
FINAL-CTA (recipe G): 3-line headline + 5-6 metric chips + price + CTA

Now generate the pack. Output JSON only.
`.trim()
}
