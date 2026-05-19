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
      "reviews":          [{ "author": "Malaysian name", "quote": "...", "meta": "...", "rating": 5 }],
      "comparisonData":   { "us": { "title": "${identity.productNameExact}", "bullets": [...] }, "them": { "title": "Suplemen Lain", "bullets": [...] } },
      "imagePrompts": [
        {
          "filename":         "<section_NN.jpg>",
          "style":            "<short tag shown in UI — e.g. 'Hero text overlay A — designed decor', 'Pain text overlay 1 — italic urgent decor', 'Ingredient card infographic', 'WhatsApp screenshot authentic 1', 'Promo banner clean ecommerce', etc.>",
          "aspectRatio":      "<from section spec>",
          "concept": {
            "recipeId":           "<from section spec>",
            "conceptScene":       "<5-30 words describing the SCENE — what's visually happening. NO style words, NO 'photorealistic', NO 'soft lighting'. Just WHAT.>",
            "roleLabel":          "<same as style above — duplicate is OK>",
            "filename":           "<same as filename above>",
            "aspectRatio":        "<from section spec>",
            "productInScene":     <true|false based on section.productPolicy>,
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
- priceTag MUST be used verbatim in any banner/offer/CTA copy.
- trustBadges + coBrandBadges MUST appear in offer + final-cta banner image concepts.

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
