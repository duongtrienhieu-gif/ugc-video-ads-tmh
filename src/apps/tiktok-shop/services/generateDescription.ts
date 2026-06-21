// Description text generation — produces the 11-block ListingDescription
// using kie.ai's chat/completions endpoint (Gemini Flash via OpenAI-compat).
//
// Returns structured DescriptionBlock[] parsed from JSON. Fall back to mock
// description if parse fails so the UI doesn't crash.

import type { ResolvedBrandKit, Market } from '../../../types/brandKit'
import type { Product } from '../../../stores/types'
import type { DescriptionBlock, ListingDescription, SlotTexts, TiktokShopProductBrief } from '../types'
import { directGeminiText } from '../../../utils/gemini'
import { MOCK_DESCRIPTION_BLOCKS } from '../constants'
// Shared MS PRINT-register block (negative rules + e-commerce code-switch ONLY — no spoken slang).
import { buildMsPrintRegisterBlock } from '../../video-builder/v3/services/bodyPatternsMs'

export interface GenerateDescriptionParams {
  /** Google AI Studio API key (NOT kie.ai — text gen routes via Gemini direct
   *  because kie.ai's /chat/completions returns "Operation not found" for our
   *  text models). */
  geminiApiKey: string
  brandKit: ResolvedBrandKit
  product: Product
  language: Market
  /** Phase 10 — Vision-extracted brief. When present, AI gets pre-analyzed
   *  product understanding as READ-ONLY context and just fills the JSON shape.
   *  When absent (Vision failed), AI falls back to deriving from product fields. */
  brief?: TiktokShopProductBrief
}

export async function generateDescription(
  params: GenerateDescriptionParams,
): Promise<ListingDescription> {
  if (!params.geminiApiKey?.trim()) {
    throw new Error('Cần Gemini API key trong Cài đặt để generate mô tả')
  }
  const prompt = buildDescriptionPrompt(params)
  const systemInstruction = buildSystemInstruction(params)

  // Gemini direct with responseMimeType: 'application/json' → guaranteed JSON.
  // Bypasses kie.ai which currently returns empty for chat/completions.
  const raw = await directGeminiText({
    apiKey: params.geminiApiKey,
    prompt,
    systemInstruction,
    responseMimeType: 'application/json',
    maxOutputTokens: 8192,  // Phase 10.2 — was 4096; full blocks + slotTexts JSON needs ~5-6K tokens; old limit was truncating slotTexts
    temperature: 0.7,
  })
  const { blocks, slotTexts } = parseOrFallback(raw)
  const fullText = assembleFullText(blocks, params.language)
  return { blocks, fullText, slotTexts }
}

/** Compact, plain-text rendering of the brief — easier for models to parse
 *  than a 1KB nested JSON.stringify. Each line is one fact. */
function buildCompactBriefBlock(brief: TiktokShopProductBrief): string {
  const ings = brief.visibleIngredients.length > 0 ? brief.visibleIngredients.join(', ') : '(none visible on label)'
  const safe = brief.nicheSafeClaims.slice(0, 5).join(', ')
  const forbidden = brief.forbiddenClaims.slice(0, 5).join(', ')
  const keyFeats = brief.keyFeatures.length > 0
    ? brief.keyFeatures.map((f) => `${f.name}${f.detail ? ` (${f.detail})` : ''}`).join(' | ')
    : '(none extracted)'
  return `
--- PRODUCT BRIEF (already analyzed; READ-ONLY ground truth) ---
- Name: ${brief.productNameExact}
- Category: ${brief.productCategory} (${brief.productSubtype})
- Target customer: ${brief.targetCustomer.ageRange} ${brief.targetCustomer.primaryGender} · ${brief.targetCustomer.dailyContext}
- Core pains: ${brief.corePains.join(' | ')}
- Transformation promise: ${brief.transformationPromise}
- Specific metric: ${brief.specificMetric}
- Key differentiator: ${brief.keyDifferentiator}
- Usage context: ${brief.usageContext}
- Application — body zone: ${brief.applicationDetails.bodyZone}
- Application — how used: ${brief.applicationDetails.howApplied}
- Common objections: ${brief.commonObjections.join(' | ')}
- Visible ingredients: ${ings}
- Key features (UNIVERSAL — use for slot 4 + specs block): ${keyFeats}
- Safe claims toolkit: ${safe}
- Forbidden claims (avoid): ${forbidden}
--- END BRIEF ---
`
}

function buildSystemInstruction(params: GenerateDescriptionParams): string {
  const lang = params.language === 'ms' ? 'Bahasa Malaysia' : 'Vietnamese'
  const briefBlock = params.brief ? buildCompactBriefBlock(params.brief) : ''
  // MS only — natural Malaysian listing register (negative rules + e-commerce code-switch, NO slang).
  const msRegister = params.language === 'ms' ? `\n${buildMsPrintRegisterBlock()}` : ''

  return `You are a TikTok Shop conversion copywriter for the Malaysia/Vietnam market. ${params.brief ? 'The PRODUCT BRIEF below has already been extracted — use it as ground truth.' : 'Read PRODUCT DATA carefully and write conversion copy that fits THIS specific product.'} The product can be ANY niche — never assume.
${briefBlock}
LANGUAGE LOCK: every string value in your JSON must be in ${lang}${params.language === 'ms' ? ' — EXCEPT the short list of English e-commerce terms in the register block below, which Malaysians keep in English' : ''}. Even if product name/ingredients/refs contain other languages, output is ${lang} ONLY.${msRegister}

OUTPUT FORMAT: a single strict JSON object. No markdown fences, no preamble, no text after the closing brace.

COPYWRITING RULES:
• Pain bullets: customer-voice self-question ending '?', max 10 words. Feeling, not clinical label. Use brief.corePains as anchor.
• Usage steps: SPECIFIC verb + object + amount/duration, max 12 words each.
• Testimonials: before→after with concrete time marker. Use brief.targetCustomer + brief.transformationPromise.
• Comparison points: measurable or observable differentiators. Use brief.keyDifferentiator. Never vague quality claims.
• Slot 1 headline: 4-6 words ALL CAPS, derived from brief.transformationPromise.
• Slot 3 metric: must equal brief.specificMetric (already specific & measurable).
• Slot 4 ingredients: must equal brief.visibleIngredients exactly. If brief.visibleIngredients is [], slot4.ingredients MUST be [] (do NOT invent).
• Slot 5 conversation (WhatsApp 2-way chat): EXACTLY 4 alternating bubbles in this order — customer, customer, shop, customer. Each bubble ≤ 16 words, casual chat tone, may include 1 emoji.
   - Bubble 1 (customer): pain context, mention the specific body zone from brief.applicationDetails.bodyZone naturally (e.g., "trước em bị đau ở đầu gối" for a knee product, "mũi em hay nghẹt suốt" for a nasal spray).
   - Bubble 2 (customer): result after using the product, mention product name (brief.productNameExact). Cite the transformation specifically.
   - Bubble 3 (SHOP — reply): warm thank-you + ONE concrete instruction/dặn dò derived from brief.applicationDetails.howApplied (e.g., "Nhớ đeo đều mỗi ngày khi đi bộ để duy trì hiệu quả nha"). MUST sound like a real shop owner, NOT generic "thank you for purchasing".
   - Bubble 4 (customer): short acknowledgement / will-order-again. ≤ 10 words.
• Slot 8 signs (qualifying checklist): 5 short concrete symptoms/situations from brief.corePains + brief.targetCustomer.dailyContext. Each ≤ 9 words, statement form (NOT a question, NO '?'). NO sales language, NO product mention, NO benefit talk — JUST the pain/situation the customer would recognize.
• Slot 9 reasons (brand story bar): EXACTLY 3 reasons. ANTI-GENERIC HARD RULE:
   - reason 1 headline MUST contain at least one specific noun extracted from brief.keyDifferentiator (mechanism, technology, ingredient, country, timeframe).
   - reason 2 headline MUST reference brief.visibleIngredients (if non-empty) or brief.packagingDescription specifics.
   - reason 3 headline MUST reference brief.targetCustomer.dailyContext or brief.usageContext or brief.nicheSafeClaims — who/where the product is for.
   - Each headline ≤ 7 words. Each detail ≤ 14 words.
   - BANNED phrases (do NOT use ANY of these as a headline or core wording — they are too generic to differentiate):
     Vietnamese: "chất lượng cao", "uy tín", "an toàn", "hiệu quả nhanh", "tin cậy", "đáng tin", "tốt nhất", "số 1", "hàng đầu", "chuyên nghiệp"
     Malay: "kualiti tinggi", "dipercayai", "selamat", "berkesan cepat", "berkualiti", "nombor 1", "terbaik", "profesional"
   - If you cannot make a reason specific from the brief, leave the slot9.reasons array shorter (2 or even 1 specific reason) — NEVER pad with generic content.

DATA INTEGRITY: anchor everything to the brief. If a field isn't covered by the brief, derive from PRODUCT DATA. NEVER fabricate ingredient names, cert claims, lab numbers, or clinical specifics.

LEGAL: respect brief.forbiddenClaims. Use brief.nicheSafeClaims as the safe-language toolkit. No cert claims (Halal JAKIM/KKM/GMP/FDA/BYT/ISO). Soft language only: "membantu/menyokong/hỗ trợ", never "rawat/sembuh/cure/treat".`
}

function buildDescriptionPrompt(params: GenerateDescriptionParams): string {
  const { product, brandKit, language, brief } = params
  const voiceTone = brandKit.voice.tone ?? 'friendly + premium'
  const voiceSamples = brandKit.voice.samplePhrases?.length
    ? brandKit.voice.samplePhrases.join(' / ')
    : 'N/A'
  const langName = language === 'ms' ? 'Bahasa Malaysia' : 'Vietnamese'
  // Slot 4 source priority: brief.keyFeatures (universal, Vision-typed) > brief.visibleIngredients > seller ingredients > [].
  // keyFeatures is the universal fallback that works for any product type — Vision
  // populates it with materials/components for accessories, ingredients for TPCN, etc.
  const briefHasFeatures = (brief?.keyFeatures?.length ?? 0) > 0
  const visibleIngs = brief?.visibleIngredients ?? []
  const sellerIngs = (product.ingredients?.trim() ?? '').length > 0
  const hasSlot4Source = briefHasFeatures || visibleIngs.length > 0 || sellerIngs
  const slot4IngShape = hasSlot4Source
    ? `[{"name": "<feature/material/ingredient name — PRIORITY: brief.keyFeatures[*].name first; else brief.visibleIngredients; else seller ingredients>", "pct": "<% / measurement / spec if known (from brief.keyFeatures[*].detail), else omit>"}]`
    : `[]`
  const reviewerNameHint = language === 'ms'
    ? 'MY-market names: Aisyah, Siti, Faridah, Hanim, Nurliyana + city KL / JB / Penang / Shah Alam'
    : 'VN-market names: Linh, Mai, Thu, Hương, Ngọc + thành phố Việt Nam'
  const checklistTitle = language === 'ms' ? 'SIAPA PERLU GUNA?' : 'AI NÊN DÙNG?'
  const brandStoryTitle = language === 'ms' ? 'KENAPA PILIH KAMI' : 'VÌ SAO CHỌN CHÚNG TÔI'
  const qualifierExample = language === 'ms' ? 'Ada 2/5 tanda? Produk ni untuk anda' : 'Có 2/5 dấu hiệu? Đây là sản phẩm cho bạn'
  const beforeLabel = language === 'ms' ? 'SEBELUM' : 'TRƯỚC'
  const afterLabel = language === 'ms' ? 'SELEPAS' : 'SAU'
  // Slot 4 source priority: keyFeatures (Vision, universal) > visibleIngredients (TPCN) > seller > []
  const ingredientsGuard = briefHasFeatures
    ? `SLOT 4 RULE: Use ONLY items from brief.keyFeatures (Vision-extracted, type-appropriate — could be materials/components for accessories OR ingredients for supplements). Render names + details (% or measurement) EXACTLY as provided. DO NOT invent extras, DO NOT mix with ingredient names from other product categories. specs block also uses these.`
    : visibleIngs.length > 0
      ? `SLOT 4 RULE: brief.keyFeatures was empty but brief.visibleIngredients has data — use those for slot4.ingredients. These are real label readings. Do not add extras.`
      : sellerIngs
        ? `SLOT 4 RULE: brief has no Vision-extracted features/ingredients — fall back to seller-provided Ingredients field in PRODUCT DATA below. Use ONLY those names.`
        : `SLOT 4 RULE: No feature/ingredient data from Vision or seller. slot4.ingredients MUST be [] in your output. Do NOT invent any names (NO generic "natural extracts", NO ingredients from other product categories like "Grape Seed Extract", "Bamboo Charcoal"). Slot 4 will render a clean USP panel without chips.`

  // ALWAYS include all product fields, even when brief exists. Brief is the
  // authoritative analysis layer; product fields are the raw seller-provided
  // data that MUST remain visible (especially Ingredients — when Vision can't
  // read them off the label, the seller-typed list is the source of truth).
  const productDataBlock = `PRODUCT DATA (raw seller-provided fields${brief ? ' — Brief above is the analyzed layer; use both' : ''}):
- Name: ${product.productName}
${product.productDescription ? `- Description: ${product.productDescription}` : ''}
${product.painPoints ? `- Customer pain points: ${product.painPoints}` : ''}
${product.usps ? `- USPs / key differentiators: ${product.usps}` : ''}
${product.benefits ? `- Benefits: ${product.benefits}` : ''}
- Ingredients (seller-typed): ${product.ingredients || '[NOT PROVIDED]'}
${product.offer ? `- Pricing / Offer: ${product.offer}` : ''}`

  return `Generate the JSON object below for this product.

${productDataBlock}

BRAND:
- Tone: ${voiceTone}
- Sample phrases: ${voiceSamples}
- Store: ${brandKit.storeName}

${ingredientsGuard}
REVIEWER NAMES: ${reviewerNameHint}

JSON SHAPE (return EXACTLY this structure — single JSON object, all string values in ${langName}):
{
  "blocks": [
    {"kind": "hook", "text": "<emoji + opener using ${brief ? 'brief.transformationPromise' : "product's main benefit"}; **bold** strongest claim; max 130 chars>"},
    {"kind": "pain", "bullets": ["<${brief ? 'use brief.corePains' : 'customer self-question'}, max 10 words>", "<related pain question>", "<related pain question>"]},
    {"kind": "solution", "text": "<introduce product as answer to pain; **bold** product name + ${brief ? 'brief.keyDifferentiator' : 'main mechanism'}; max 160 chars>"},
    {"kind": "benefits", "bullets": ["<concrete outcome tied to ${brief ? 'brief.transformationPromise' : 'promise'} — number or timeframe, max 15 words>", "<benefit>", "<benefit>", "<benefit>", "<benefit>"]},
    {"kind": "specs", "rows": [["<feature/ingredient/material from ${brief ? 'brief.keyFeatures or brief.visibleIngredients' : 'PRODUCT DATA'} only>", "<brief function — what does this feature/ingredient do for the customer>"]]},
    {"kind": "reviews", "quotes": [{"text": "<before→after story with time marker, max 100 chars>", "author": "<Name, City>"}, {"text": "<second review with time marker>", "author": "<Name, City>"}]},
    {"kind": "usage", "steps": ["<SPECIFIC verb + object + amount/duration, max 12 words>", "<step>", "<step>"]},
    {"kind": "faq", "items": [{"q": "<${brief ? 'from brief.commonObjections' : 'safety/ingredients question'}>", "a": "<answer>"}, {"q": "<results timing>", "a": "<specific timeframe>"}, {"q": "<return or refund>", "a": "<answer>"}]},
    {"kind": "promise", "bullets": ["<service promise — shipping/return/packaging ONLY, max 10 words>", "<promise>", "<promise>"]},
    {"kind": "cta", "text": "<**bold** action verb; mild urgency; max 80 chars>"}
  ],
  "slotTexts": {
    "slot1": {"headline": "<4-6 word ALL CAPS — ${brief ? 'derived from brief.transformationPromise' : "product's single strongest promise"}>", "tagline": "<8-12 words expanding headline — specific mechanism>"},
    "slot2": {"question": "<${brief ? 'use brief.corePains[0]' : 'core pain as self-question'}, max 10 words ends '?'>", "painBullets": ["<self-question max 8 words ends '?'>", "<question>", "<question>"]},
    "slot3": {"beforeLabel": "${beforeLabel}", "afterLabel": "${afterLabel}", "metric": "<${brief ? 'must equal brief.specificMetric' : 'SPECIFIC number+unit ALL CAPS max 4 words'}>", "metricSubtitle": "<context max 5 words>", "disclaimer": "<results-may-vary, max 8 words>"},
    "slot4": {"title": "<formula panel title ALL CAPS>", "ingredients": ${slot4IngShape}, "tagline": "<safety/natural claim, max 8 words>"},
    "slot5": {"contactName": "<short reviewer first name only — ${reviewerNameHint}>", "conversation": [{"from": "customer", "text": "<1st bubble — pain context, mention specific body zone from ${brief ? 'brief.applicationDetails.bodyZone' : 'product.painPoints'}, casual chat tone, max 16 words, may include 1 emoji>"}, {"from": "customer", "text": "<2nd bubble — result after using, mention product name, ${brief ? 'anchor to brief.transformationPromise' : 'use product benefit'}, max 16 words, may include 1 emoji>"}, {"from": "shop", "text": "<3rd bubble — SHOP reply: warm thank-you + ONE concrete instruction derived from ${brief ? 'brief.applicationDetails.howApplied' : 'product usage'}. Must sound like real shop owner, NOT generic. Max 18 words, may include 1 emoji>"}, {"from": "customer", "text": "<4th bubble — short acknowledgement / will-order-again, max 10 words>"}], "verifiedNote": "<verified-review label>"},
    "slot6": {"title": "<how-to-use title with step count>", "steps": ["<SPECIFIC action verb + object + amount/duration, max 10 words>", "<step>", "<step>"], "timing": "<usage timing e.g. '🌅 Pagi • 🌙 Malam'>"},
    "slot7": {"title": "<comparison title>", "usLabel": "<our product label>", "themLabel": "<generic alternative label>", "points": [["<${brief ? 'must reflect brief.keyDifferentiator' : 'specific measurable differentiator'}>", "<generic equivalent>"], ["<specific>", "<generic>"], ["<specific>", "<generic>"], ["<specific>", "<generic>"]]},
    "slot8": {"title": "${checklistTitle}", "signs": ["<concrete symptom/situation statement (NOT a question, NO '?'), max 9 words, ${brief ? 'derived from brief.corePains and brief.targetCustomer.dailyContext' : 'derived from product.painPoints'}>", "<sign>", "<sign>", "<sign>", "<sign>"], "qualifier": "<bottom callout matching pattern '${qualifierExample}'>"},
    "slot9": {"title": "${brandStoryTitle}", "reasons": [{"headline": "<reason 1 — MUST cite concrete noun from ${brief ? 'brief.keyDifferentiator' : 'product.usps'} (mechanism / ingredient / country / timeframe). NO generic adjectives. Max 7 words.>", "detail": "<one specific line expanding the headline, max 14 words>"}, {"headline": "<reason 2 — MUST reference ${brief ? 'brief.visibleIngredients or brief.packagingDescription' : 'product.ingredients'} specifics. Max 7 words.>", "detail": "<one specific line, max 14 words>"}, {"headline": "<reason 3 — MUST reference ${brief ? 'brief.targetCustomer.dailyContext or brief.usageContext or brief.nicheSafeClaims' : 'product.benefits'} — who/where it fits. Max 7 words.>", "detail": "<one specific line, max 14 words>"}]}
  }
}

EXAMPLES of BAD generic slot9 reasons (do NOT produce these or anything like them):
  ❌ {"headline": "Chất lượng cao", "detail": "Sản phẩm uy tín được khách hàng tin dùng"}
  ❌ {"headline": "An toàn hiệu quả", "detail": "Phù hợp cho mọi đối tượng khách hàng"}
  ❌ {"headline": "Thương hiệu uy tín", "detail": "Được nhiều người tin tưởng lựa chọn"}
EXAMPLES of GOOD specific slot9 reasons (concrete nouns, no generic praise):
  ✓ {"headline": "Công nghệ phun sương Nano", "detail": "Hạt sương 10 micron thẩm thấu sâu khoang mũi"}
  ✓ {"headline": "Muối Himalaya nguyên chất", "detail": "Khai thác trực tiếp từ vùng núi 250 triệu năm tuổi"}
  ✓ {"headline": "Hợp dân văn phòng máy lạnh", "detail": "Cấp ẩm tức thì khi niêm mạc khô do điều hòa"}

BOLD: use **markdown bold** for 1-2 emphasis points per block (result claim, product name, action verb, price). Never bold filler.

Return ONLY this JSON object. No preamble, no markdown fences, no text after the closing brace.`
}

// ── Parsing ──────────────────────────────────────────────────────────────

interface RawPayload {
  blocks?: unknown
  slotTexts?: unknown
}

function parseOrFallback(raw: string): { blocks: DescriptionBlock[]; slotTexts: SlotTexts | undefined } {
  const json = extractJsonObject(raw)
  if (!json) {
    console.warn('[generateDescription] could not extract JSON from response — using placeholder. Raw response first 500 chars:', raw.slice(0, 500))
    return { blocks: MOCK_DESCRIPTION_BLOCKS, slotTexts: undefined }
  }
  try {
    const payload = JSON.parse(json) as RawPayload
    const rawBlocks = payload.blocks
    if (!Array.isArray(rawBlocks) || rawBlocks.length === 0) {
      console.warn('[generateDescription] JSON has no blocks array — using placeholder. Payload keys:', Object.keys(payload))
      return { blocks: MOCK_DESCRIPTION_BLOCKS, slotTexts: undefined }
    }
    const validated = rawBlocks
      .map(validateBlock)
      .filter((b): b is DescriptionBlock => b !== null)
    // Lowered threshold from 5 → 3. Even a partial 3-block description is
    // more useful (and more product-specific) than the generic placeholder.
    if (validated.length < 3) {
      console.warn('[generateDescription] too few valid blocks — using placeholder', { validCount: validated.length, totalCount: rawBlocks.length })
      return { blocks: MOCK_DESCRIPTION_BLOCKS, slotTexts: undefined }
    }
    const slotTexts = validateSlotTexts(payload.slotTexts)
    console.log(`[generateDescription] ✓ parsed ${validated.length}/${rawBlocks.length} blocks, slotTexts=${slotTexts ? 'present' : 'missing'}`)
    return { blocks: validated, slotTexts }
  } catch (err) {
    console.warn('[generateDescription] JSON parse failed — using placeholder', err, 'json snippet:', json.slice(0, 300))
    return { blocks: MOCK_DESCRIPTION_BLOCKS, slotTexts: undefined }
  }
}

// Validate slotTexts loosely — if the AI returned anything matching the
// expected shape we keep it, otherwise drop the field entirely so image
// prompts fall back to product-field derivation instead of bad data.
function validateSlotTexts(raw: unknown): SlotTexts | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const out: SlotTexts = {}

  const s1 = r.slot1 as { headline?: unknown; tagline?: unknown } | undefined
  if (s1 && typeof s1.headline === 'string' && typeof s1.tagline === 'string') {
    out.slot1 = { headline: s1.headline, tagline: s1.tagline }
  }

  const s2 = r.slot2 as { question?: unknown; painBullets?: unknown } | undefined
  if (s2 && typeof s2.question === 'string' && Array.isArray(s2.painBullets)) {
    const bullets = (s2.painBullets as unknown[]).filter((b): b is string => typeof b === 'string')
    if (bullets.length > 0) out.slot2 = { question: s2.question, painBullets: bullets }
  }

  const s3 = r.slot3 as { beforeLabel?: unknown; afterLabel?: unknown; metric?: unknown; metricSubtitle?: unknown; disclaimer?: unknown } | undefined
  if (s3 && typeof s3.metric === 'string') {
    out.slot3 = {
      beforeLabel:    typeof s3.beforeLabel === 'string' ? s3.beforeLabel : 'SEBELUM',
      afterLabel:     typeof s3.afterLabel === 'string' ? s3.afterLabel : 'SELEPAS',
      metric:         s3.metric,
      metricSubtitle: typeof s3.metricSubtitle === 'string' ? s3.metricSubtitle : '',
      disclaimer:     typeof s3.disclaimer === 'string' ? s3.disclaimer : '*Results may vary',
    }
  }

  const s4 = r.slot4 as { title?: unknown; ingredients?: unknown; tagline?: unknown } | undefined
  if (s4 && typeof s4.title === 'string' && Array.isArray(s4.ingredients)) {
    const ings = (s4.ingredients as unknown[])
      .map((x) => x as Record<string, unknown>)
      .filter((x) => typeof x.name === 'string')
      .map((x) => ({ name: x.name as string, pct: typeof x.pct === 'string' ? x.pct : undefined }))
    // Accept empty ingredients array — AI returns [] when product has no ingredients listed.
    // Don't drop slot4 in that case; let promptBuilder use derived fallback instead of fake data.
    out.slot4 = {
      title: s4.title,
      ingredients: ings,
      tagline: typeof s4.tagline === 'string' ? s4.tagline : '',
    }
  }

  const s5 = r.slot5 as { contactName?: unknown; conversation?: unknown; verifiedNote?: unknown } | undefined
  if (s5 && typeof s5.contactName === 'string' && Array.isArray(s5.conversation)) {
    const conversation = (s5.conversation as unknown[])
      .map((x) => x as Record<string, unknown>)
      .filter((x) => (x.from === 'customer' || x.from === 'shop') && typeof x.text === 'string' && (x.text as string).trim().length > 0)
      .map((x) => ({ from: x.from as 'customer' | 'shop', text: (x.text as string).trim() }))
    if (conversation.length >= 2) {
      out.slot5 = {
        contactName:  s5.contactName,
        conversation: conversation.slice(0, 5),
        verifiedNote: typeof s5.verifiedNote === 'string' ? s5.verifiedNote : '',
      }
    }
  }

  const s6 = r.slot6 as { title?: unknown; steps?: unknown; timing?: unknown } | undefined
  if (s6 && typeof s6.title === 'string' && Array.isArray(s6.steps)) {
    const steps = (s6.steps as unknown[]).filter((x): x is string => typeof x === 'string')
    if (steps.length > 0) {
      out.slot6 = {
        title:  s6.title,
        steps,
        timing: typeof s6.timing === 'string' ? s6.timing : '',
      }
    }
  }

  const s7 = r.slot7 as { title?: unknown; usLabel?: unknown; themLabel?: unknown; points?: unknown } | undefined
  if (s7 && typeof s7.title === 'string' && Array.isArray(s7.points)) {
    const points = (s7.points as unknown[])
      .filter((p): p is [string, string] => Array.isArray(p) && p.length === 2 && typeof p[0] === 'string' && typeof p[1] === 'string')
    if (points.length > 0) {
      out.slot7 = {
        title:     s7.title,
        usLabel:   typeof s7.usLabel === 'string' ? s7.usLabel : 'Lựa chọn của chúng tôi',
        themLabel: typeof s7.themLabel === 'string' ? s7.themLabel : 'Đối thủ',
        points,
      }
    }
  }

  const s8 = r.slot8 as { title?: unknown; signs?: unknown; qualifier?: unknown } | undefined
  if (s8 && typeof s8.title === 'string' && Array.isArray(s8.signs)) {
    const signs = (s8.signs as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    if (signs.length >= 3) {
      out.slot8 = {
        title:     s8.title,
        signs:     signs.slice(0, 5),
        qualifier: typeof s8.qualifier === 'string' ? s8.qualifier : '',
      }
    }
  }

  const s9 = r.slot9 as { title?: unknown; reasons?: unknown } | undefined
  if (s9 && typeof s9.title === 'string' && Array.isArray(s9.reasons)) {
    const reasons = (s9.reasons as unknown[])
      .map((x) => x as Record<string, unknown>)
      .filter((x) => typeof x.headline === 'string' && typeof x.detail === 'string')
      .map((x) => ({ headline: (x.headline as string).trim(), detail: (x.detail as string).trim() }))
      .filter((r) => r.headline.length > 0 && r.detail.length > 0)
    if (reasons.length > 0) {
      out.slot9 = { title: s9.title, reasons: reasons.slice(0, 3) }
    }
  }

  return Object.keys(out).length > 0 ? out : undefined
}

// Models occasionally wrap JSON in ```json fences or add commentary.
// Extract the first balanced JSON object from the response — defensively
// handles string literals (braces inside quoted values must not affect
// depth counting) and escape characters.
function extractJsonObject(raw: string): string | null {
  // Strip code fences anywhere in the string (not just start/end). Some
  // models put preamble text before the opening fence.
  const cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escapeNext = false

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i]

    if (escapeNext) { escapeNext = false; continue }
    if (ch === '\\') { escapeNext = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue

    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return cleaned.slice(start, i + 1)
    }
  }
  return null
}

function validateBlock(raw: unknown): DescriptionBlock | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Record<string, unknown>
  switch (b.kind) {
    case 'hook':
    case 'solution':
    case 'cta':
      if (typeof b.text === 'string' && b.text.trim()) return { kind: b.kind, text: b.text.trim() }
      return null
    case 'pain':
    case 'benefits':
    case 'promise':
      if (Array.isArray(b.bullets) && b.bullets.every((x: unknown) => typeof x === 'string')) {
        return { kind: b.kind, bullets: b.bullets as string[] }
      }
      return null
    case 'specs':
      if (Array.isArray(b.rows)) {
        const rows = (b.rows as unknown[]).filter(
          (r): r is [string, string] =>
            Array.isArray(r) && r.length === 2 && typeof r[0] === 'string' && typeof r[1] === 'string',
        )
        return { kind: 'specs', rows }
      }
      return null
    case 'reviews':
      if (Array.isArray(b.quotes)) {
        const quotes = (b.quotes as unknown[])
          .map((q) => q as Record<string, unknown>)
          .filter((q) => typeof q.text === 'string' && typeof q.author === 'string')
          .map((q) => ({ text: q.text as string, author: q.author as string }))
        return { kind: 'reviews', quotes }
      }
      return null
    case 'usage':
      if (Array.isArray(b.steps) && b.steps.every((x: unknown) => typeof x === 'string')) {
        return { kind: 'usage', steps: b.steps as string[] }
      }
      return null
    case 'faq':
      if (Array.isArray(b.items)) {
        const items = (b.items as unknown[])
          .map((q) => q as Record<string, unknown>)
          .filter((q) => typeof q.q === 'string' && typeof q.a === 'string')
          .map((q) => ({ q: q.q as string, a: q.a as string }))
        return { kind: 'faq', items }
      }
      return null
    default:
      return null
  }
}

// ── Assembly to copy-pasteable text ──────────────────────────────────────

const BLOCK_ICON: Record<DescriptionBlock['kind'], string> = {
  hook: '🎯', pain: '😣', solution: '✨', benefits: '🔥', specs: '📦',
  reviews: '👥', usage: '🎬', faq: '❓', promise: '🛡️', cta: '📲',
}

// Phase 10.3 — language-aware block headings. Previously hardcoded BM which
// leaked into VN listings when user clicked Sao chép. Now map per market so
// MS listing → BM headers, VI listing → VN headers.

const BLOCK_HEADING_MS: Record<DescriptionBlock['kind'], string> = {
  hook: '', pain: 'ANDA SEDANG', solution: '', benefits: 'KENAPA PILIH KAMI',
  specs: 'BAHAN AKTIF', reviews: 'KATA PENGGUNA', usage: 'CARA GUNA',
  faq: 'SOALAN LAZIM', promise: 'JANJI KAMI', cta: '',
}

const BLOCK_HEADING_VI: Record<DescriptionBlock['kind'], string> = {
  hook: '', pain: 'BẠN ĐANG GẶP', solution: '', benefits: 'VÌ SAO CHỌN CHÚNG TÔI',
  specs: 'THÀNH PHẦN CHÍNH', reviews: 'KHÁCH HÀNG NÓI', usage: 'CÁCH DÙNG',
  faq: 'CÂU HỎI THƯỜNG GẶP', promise: 'CAM KẾT CỦA CHÚNG TÔI', cta: '',
}

function getBlockHeading(kind: DescriptionBlock['kind'], market?: Market): string {
  const table = market === 'vi' ? BLOCK_HEADING_VI : BLOCK_HEADING_MS
  return table[kind]
}

export function assembleFullText(blocks: DescriptionBlock[], market?: Market): string {
  const parts: string[] = []
  for (const b of blocks) {
    const icon = BLOCK_ICON[b.kind]
    const heading = getBlockHeading(b.kind, market)
    switch (b.kind) {
      case 'hook':
      case 'solution':
      case 'cta':
        parts.push(`${icon} ${b.text}`)
        break
      case 'pain':
      case 'benefits':
      case 'promise':
        parts.push(`${icon} ${heading}\n` + b.bullets.map((x) => `• ${x}`).join('\n'))
        break
      case 'specs':
        parts.push(`${icon} ${heading}\n` + b.rows.map(([k, v]) => `• ${k}: ${v}`).join('\n'))
        break
      case 'reviews':
        parts.push(`${icon} ${heading}\n` + b.quotes.map((q) => `⭐⭐⭐⭐⭐ "${q.text}" — ${q.author}`).join('\n'))
        break
      case 'usage':
        parts.push(`${icon} ${heading}\n` + b.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'))
        break
      case 'faq':
        parts.push(`${icon} ${heading}\n` + b.items.map((it) => `Q: ${it.q}\nA: ${it.a}`).join('\n\n'))
        break
    }
  }
  return parts.join('\n\n')
}
