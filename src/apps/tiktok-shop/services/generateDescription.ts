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
    maxOutputTokens: 4096,
    temperature: 0.7,
  })
  const { blocks, slotTexts } = parseOrFallback(raw)
  const fullText = assembleFullText(blocks)
  return { blocks, fullText, slotTexts }
}

/** Compact, plain-text rendering of the brief — easier for models to parse
 *  than a 1KB nested JSON.stringify. Each line is one fact. */
function buildCompactBriefBlock(brief: TiktokShopProductBrief): string {
  const ings = brief.visibleIngredients.length > 0 ? brief.visibleIngredients.join(', ') : '(none visible on label)'
  const safe = brief.nicheSafeClaims.slice(0, 5).join(', ')
  const forbidden = brief.forbiddenClaims.slice(0, 5).join(', ')
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
- Common objections: ${brief.commonObjections.join(' | ')}
- Visible ingredients: ${ings}
- Safe claims toolkit: ${safe}
- Forbidden claims (avoid): ${forbidden}
--- END BRIEF ---
`
}

function buildSystemInstruction(params: GenerateDescriptionParams): string {
  const lang = params.language === 'ms' ? 'Bahasa Malaysia' : 'Vietnamese'
  const briefBlock = params.brief ? buildCompactBriefBlock(params.brief) : ''

  return `You are a TikTok Shop conversion copywriter for the Malaysia/Vietnam market. ${params.brief ? 'The PRODUCT BRIEF below has already been extracted — use it as ground truth.' : 'Read PRODUCT DATA carefully and write conversion copy that fits THIS specific product.'} The product can be ANY niche — never assume.
${briefBlock}
LANGUAGE LOCK: every string value in your JSON must be in ${lang}. Even if product name/ingredients/refs contain other languages, output is ${lang} ONLY.

OUTPUT FORMAT: a single strict JSON object. No markdown fences, no preamble, no text after the closing brace.

COPYWRITING RULES:
• Pain bullets: customer-voice self-question ending '?', max 10 words. Feeling, not clinical label. Use brief.corePains as anchor.
• Usage steps: SPECIFIC verb + object + amount/duration, max 12 words each.
• Testimonials: before→after with concrete time marker. Use brief.targetCustomer + brief.transformationPromise.
• Comparison points: measurable or observable differentiators. Use brief.keyDifferentiator. Never vague quality claims.
• Slot 1 headline: 4-6 words ALL CAPS, derived from brief.transformationPromise.
• Slot 3 metric: must equal brief.specificMetric (already specific & measurable).
• Slot 4 ingredients: must equal brief.visibleIngredients exactly. If brief.visibleIngredients is [], slot4.ingredients MUST be [] (do NOT invent).

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
  // Ingredients source: brief (Vision-read from label) > product.ingredients (seller-typed) > none
  const visibleIngs = brief?.visibleIngredients ?? []
  const sellerIngs = (product.ingredients?.trim() ?? '').length > 0
  const hasIngredients = visibleIngs.length > 0 || sellerIngs
  const slot4IngShape = hasIngredients
    ? `[{"name": "<ingredient name — must come from brief.visibleIngredients or seller-provided list>", "pct": "<% if known, else omit pct>"}]`
    : `[]`
  const reviewerNameHint = language === 'ms'
    ? 'MY-market names: Aisyah, Siti, Faridah, Hanim, Nurliyana + city KL / JB / Penang / Shah Alam'
    : 'VN-market names: Linh, Mai, Thu, Hương, Ngọc + thành phố Việt Nam'
  const ctaDefault = language === 'ms' ? 'BELI SEKARANG' : 'MUA NGAY'
  const faqTitle = language === 'ms' ? 'SOALAN LAZIM' : 'CÂU HỎI THƯỜNG GẶP'
  const beforeLabel = language === 'ms' ? 'SEBELUM' : 'TRƯỚC'
  const afterLabel = language === 'ms' ? 'SELEPAS' : 'SAU'
  const ingredientsGuard = brief
    ? (visibleIngs.length > 0
        ? `SLOT 4 GUARD: Use ONLY ingredients from brief.visibleIngredients (Vision-read from label). Do not add extras.`
        : `SLOT 4 GUARD: brief.visibleIngredients is empty (no ingredients visible on label) — slot4.ingredients MUST be [] in your output. Do NOT invent any ingredient names.`)
    : (sellerIngs
        ? `SLOT 4 GUARD: Use ONLY the ingredients listed in PRODUCT DATA above. Do not add extras.`
        : `SLOT 4 GUARD: No ingredients were provided — slot4.ingredients MUST be [] in your output. Do NOT invent any ingredient names.`)

  const productDataBlock = brief
    ? `(See PRODUCT BRIEF in system prompt for the authoritative analysis. Below is seller-provided supplemental data — use it but the brief is ground truth.)
- Name: ${product.productName}${product.offer ? `\n- Pricing / Offer: ${product.offer}` : ''}`
    : `PRODUCT DATA (derive ALL copy ONLY from this):
- Name: ${product.productName}
${product.productDescription ? `- Description: ${product.productDescription}` : ''}
${product.painPoints ? `- Customer pain points: ${product.painPoints}` : ''}
${product.usps ? `- USPs / key differentiators: ${product.usps}` : ''}
${product.benefits ? `- Benefits: ${product.benefits}` : ''}
- Ingredients: ${product.ingredients || '[NOT PROVIDED]'}
${product.offer ? `- Pricing / Offer: ${product.offer}` : ''}`

  return `Generate the JSON object below for this product.

${productDataBlock}

BRAND:
- Tone: ${voiceTone}
- Sample phrases: ${voiceSamples}
- Store: ${brandKit.storeName}

INGREDIENTS RULE: ${ingredientsGuard}
REVIEWER NAMES: ${reviewerNameHint}

JSON SHAPE (return EXACTLY this structure — single JSON object, all string values in ${langName}):
{
  "blocks": [
    {"kind": "hook", "text": "<emoji + opener using ${brief ? 'brief.transformationPromise' : "product's main benefit"}; **bold** strongest claim; max 130 chars>"},
    {"kind": "pain", "bullets": ["<${brief ? 'use brief.corePains' : 'customer self-question'}, max 10 words>", "<related pain question>", "<related pain question>"]},
    {"kind": "solution", "text": "<introduce product as answer to pain; **bold** product name + ${brief ? 'brief.keyDifferentiator' : 'main mechanism'}; max 160 chars>"},
    {"kind": "benefits", "bullets": ["<concrete outcome tied to ${brief ? 'brief.transformationPromise' : 'promise'} — number or timeframe, max 15 words>", "<benefit>", "<benefit>", "<benefit>", "<benefit>"]},
    {"kind": "specs", "rows": [["<ingredient/spec from ${brief ? 'brief.visibleIngredients' : 'PRODUCT DATA'} only>", "<brief function>"]]},
    {"kind": "reviews", "quotes": [{"text": "<before→after story with time marker, max 100 chars>", "author": "<Name, City>"}, {"text": "<second review with time marker>", "author": "<Name, City>"}]},
    {"kind": "usage", "steps": ["<SPECIFIC verb + object + amount/duration, max 12 words>", "<step>", "<step>"]},
    {"kind": "offer", "text": "<offer; **bold** price or discount; max 100 chars>"},
    {"kind": "faq", "items": [{"q": "<${brief ? 'from brief.commonObjections' : 'safety/ingredients question'}>", "a": "<answer>"}, {"q": "<results timing>", "a": "<specific timeframe>"}, {"q": "<return or refund>", "a": "<answer>"}]},
    {"kind": "promise", "bullets": ["<service promise — shipping/return/packaging ONLY, max 10 words>", "<promise>", "<promise>"]},
    {"kind": "cta", "text": "<**bold** action verb; mild urgency; max 80 chars>"}
  ],
  "slotTexts": {
    "slot1": {"headline": "<4-6 word ALL CAPS — ${brief ? 'derived from brief.transformationPromise' : "product's single strongest promise"}>", "tagline": "<8-12 words expanding headline — specific mechanism>"},
    "slot2": {"question": "<${brief ? 'use brief.corePains[0]' : 'core pain as self-question'}, max 10 words ends '?'>", "painBullets": ["<self-question max 8 words ends '?'>", "<question>", "<question>"]},
    "slot3": {"beforeLabel": "${beforeLabel}", "afterLabel": "${afterLabel}", "metric": "<${brief ? 'must equal brief.specificMetric' : 'SPECIFIC number+unit ALL CAPS max 4 words'}>", "metricSubtitle": "<context max 5 words>", "disclaimer": "<results-may-vary, max 8 words>"},
    "slot4": {"title": "<formula panel title ALL CAPS>", "ingredients": ${slot4IngShape}, "tagline": "<safety/natural claim, max 8 words>"},
    "slot5": {"quote": "<before→after with time, anchor to ${brief ? 'brief.targetCustomer + brief.transformationPromise' : "customer transformation"}, max 100 chars>", "author": "<${reviewerNameHint}>", "verifiedNote": "<verified-review label>"},
    "slot6": {"title": "<how-to-use title with step count>", "steps": ["<SPECIFIC action verb + object + amount/duration, max 10 words>", "<step>", "<step>"], "timing": "<usage timing e.g. '🌅 Pagi • 🌙 Malam'>"},
    "slot7": {"title": "<comparison title>", "usLabel": "<our product label>", "themLabel": "<generic alternative label>", "points": [["<${brief ? 'must reflect brief.keyDifferentiator' : 'specific measurable differentiator'}>", "<generic equivalent>"], ["<specific>", "<generic>"], ["<specific>", "<generic>"], ["<specific>", "<generic>"]]},
    "slot8": {"originalPrice": "<original price if mentioned, else omit key>", "currentPrice": "<from product.offer or '(Harga)'>", "discount": "<if available, else omit>", "combo": "<combo line if applicable, else omit>", "cta": "${ctaDefault}", "urgency": "<urgency max 6 words>"},
    "slot9": {"title": "${faqTitle}", "items": [{"q": "<${brief ? 'from brief.commonObjections[0]' : 'main safety concern'}>", "a": "<answer>"}, {"q": "<results timing>", "a": "<specific timeframe>"}, {"q": "<return/refund>", "a": "<answer>"}]}
  }
}

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

  const s5 = r.slot5 as { quote?: unknown; author?: unknown; verifiedNote?: unknown } | undefined
  if (s5 && typeof s5.quote === 'string' && typeof s5.author === 'string') {
    out.slot5 = {
      quote:        s5.quote,
      author:       s5.author,
      verifiedNote: typeof s5.verifiedNote === 'string' ? s5.verifiedNote : '',
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

  const s8 = r.slot8 as { originalPrice?: unknown; currentPrice?: unknown; discount?: unknown; combo?: unknown; cta?: unknown; urgency?: unknown } | undefined
  if (s8 && typeof s8.currentPrice === 'string') {
    out.slot8 = {
      originalPrice: typeof s8.originalPrice === 'string' ? s8.originalPrice : undefined,
      currentPrice:  s8.currentPrice,
      discount:      typeof s8.discount === 'string' ? s8.discount : undefined,
      combo:         typeof s8.combo === 'string' ? s8.combo : undefined,
      cta:           typeof s8.cta === 'string' ? s8.cta : 'BELI SEKARANG',
      urgency:       typeof s8.urgency === 'string' ? s8.urgency : undefined,
    }
  }

  const s9 = r.slot9 as { title?: unknown; items?: unknown } | undefined
  if (s9 && typeof s9.title === 'string' && Array.isArray(s9.items)) {
    const items = (s9.items as unknown[])
      .map((x) => x as Record<string, unknown>)
      .filter((x) => typeof x.q === 'string' && typeof x.a === 'string')
      .map((x) => ({ q: x.q as string, a: x.a as string }))
    if (items.length > 0) {
      out.slot9 = { title: s9.title, items }
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
    case 'offer':
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
  reviews: '👥', usage: '🎬', offer: '🎁', faq: '❓', promise: '🛡️', cta: '📲',
}

const BLOCK_HEADING: Record<DescriptionBlock['kind'], string> = {
  hook: '', pain: 'ANDA SEDANG', solution: '', benefits: 'KENAPA PILIH KAMI',
  specs: 'BAHAN AKTIF', reviews: 'KATA PENGGUNA', usage: 'CARA GUNA',
  offer: '', faq: 'SOALAN LAZIM', promise: 'JANJI KAMI', cta: '',
}

export function assembleFullText(blocks: DescriptionBlock[]): string {
  const parts: string[] = []
  for (const b of blocks) {
    const icon = BLOCK_ICON[b.kind]
    const heading = BLOCK_HEADING[b.kind]
    switch (b.kind) {
      case 'hook':
      case 'solution':
      case 'offer':
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
