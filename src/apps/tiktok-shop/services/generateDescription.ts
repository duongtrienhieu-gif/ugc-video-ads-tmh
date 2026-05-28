// Description text generation — produces the 11-block ListingDescription
// using kie.ai's chat/completions endpoint (Gemini Flash via OpenAI-compat).
//
// Returns structured DescriptionBlock[] parsed from JSON. Fall back to mock
// description if parse fails so the UI doesn't crash.

import type { ResolvedBrandKit, Market } from '../../../types/brandKit'
import type { Product } from '../../../stores/types'
import type { DescriptionBlock, ListingDescription, SlotTexts } from '../types'
import { kieTextGenerate } from '../../../utils/kieai'
import { MOCK_DESCRIPTION_BLOCKS } from '../constants'

export interface GenerateDescriptionParams {
  apiKey: string
  brandKit: ResolvedBrandKit
  product: Product
  language: Market
}

export async function generateDescription(
  params: GenerateDescriptionParams,
): Promise<ListingDescription> {
  const prompt = buildDescriptionPrompt(params)
  const systemInstruction = buildSystemInstruction(params)

  const raw = await kieTextGenerate(params.apiKey, prompt, systemInstruction)
  const { blocks, slotTexts } = parseOrFallback(raw)
  const fullText = assembleFullText(blocks)
  return { blocks, fullText, slotTexts }
}

function buildSystemInstruction(params: GenerateDescriptionParams): string {
  const lang = params.language === 'ms' ? 'Bahasa Malaysia' : 'Vietnamese'
  return `You are a TikTok Shop conversion copywriter for the Malaysia/Vietnam market. Your FIRST job is to UNDERSTAND the product from PRODUCT DATA, reason about the target customer and their core pain, then write conversion copy that fits THIS specific product. The product can be ANY niche — never assume or copy from prior examples.

LANGUAGE LOCK — three rules, zero exceptions:
1. Every string value in your JSON output must be written in ${lang}.
2. Even if the product name, ingredient list, or image refs contain English, Chinese, or any other language — your JSON output is ${lang} only.
3. If you cannot find a natural ${lang} word, transliterate or use an equivalent. Do not fall back to English anywhere in the output.

OUTPUT FORMAT: strict JSON object only. No markdown fences, no preamble text, no commentary after the closing brace.

CONVERSION COPYWRITING RULES (universal — applies to all niches, all product types):
• Pain bullets: write as the customer's OWN internal voice — a self-question they ask themselves daily. Ends with "?", max 10 words. Write the FEELING, not the clinical label.
  — GOOD pattern: "[Feeling/situation they experience]?" (customer-voice question)
  — BAD pattern: "[Clinical or medical description of symptom]" (third-person description)
• Usage steps: SPECIFIC physical action + object + amount or duration. Max 12 words per step.
  — GOOD pattern: "[Verb] [specific object] [amount/duration/frequency]"
  — BAD pattern: "Use as directed" / "Apply to affected area" (generic non-instruction)
• Testimonials: concrete before→after story with a TIME MARKER. Must include something specific that changed.
  — GOOD pattern: "After [N days/weeks], [specific observable change]"
  — BAD pattern: "Very satisfied with this product" (no specifics, no timeline)
• Comparison points: measurable or observable differentiators. NOT vague quality claims.
  — GOOD: "[Specific metric e.g. time, %, measurement, mechanism]" vs "[generic equivalent]"
  — BAD: "High quality" vs "Normal quality"
• Slot 1 headline: the product's SINGLE strongest transformation in 4-6 words ALL CAPS. Ask yourself: what is the customer's life like after Day 14 of using this product?
• Slot 3 metric: a SPECIFIC measurable outcome tied to this product's mechanism. ALL CAPS, max 4 words. Numbers + units preferred.
  — GOOD: "3× LEBIH LANCAR" / "DALAM 7 HARI" / "−2KG SEBULAN"
  — BAD: "HASIL TERBAIK" / "SANGAT BERKESAN" (vague superlatives)

DATA INTEGRITY — never fabricate beyond what is given:
• Derive all copy from the PRODUCT DATA provided. If a product field is empty, infer from context in other fields, or use a safe generic label.
• slot4.ingredients: if product.ingredients is absent or empty in PRODUCT DATA → output "ingredients": [] (empty array). NEVER invent ingredient names not explicitly mentioned in PRODUCT DATA.
• Do not add clinical studies, certificates, specific brand claims, or ingredient names that are not stated in PRODUCT DATA.

LEGAL:
• No cert claims (Halal JAKIM, KKM, GMP, FDA, BYT, ISO) — not verified by user.
• Soft claim language only: "membantu", "menyokong", "hỗ trợ" — never "rawat", "sembuh", "cure", "treat".`
}

function buildDescriptionPrompt(params: GenerateDescriptionParams): string {
  const { product, brandKit, language } = params
  const voiceTone = brandKit.voice.tone ?? 'friendly + premium'
  const voiceSamples = brandKit.voice.samplePhrases?.length
    ? brandKit.voice.samplePhrases.join(' / ')
    : 'N/A'
  const langName = language === 'ms' ? 'Bahasa Malaysia' : 'Vietnamese'
  const hasIngredients = !!(product.ingredients?.trim())
  const ingredientsList = hasIngredients ? product.ingredients : '[NOT PROVIDED]'
  const slot4IngShape = hasIngredients
    ? `[{"name": "<ingredient name from PRODUCT DATA list only>", "pct": "<% if stated, else omit pct>"}]`
    : `[]`
  const reviewerNameHint = language === 'ms'
    ? 'MY-market names: Aisyah, Siti, Faridah, Hanim, Nurliyana + city KL / JB / Penang / Shah Alam'
    : 'VN-market names: Linh, Mai, Thu, Hương, Ngọc + thành phố Việt Nam'
  const ctaDefault = language === 'ms' ? 'BELI SEKARANG' : 'MUA NGAY'
  const faqTitle = language === 'ms' ? 'SOALAN LAZIM' : 'CÂU HỎI THƯỜNG GẶP'
  const beforeLabel = language === 'ms' ? 'SEBELUM' : 'TRƯỚC'
  const afterLabel = language === 'ms' ? 'SELEPAS' : 'SAU'
  const ingredientsGuard = hasIngredients
    ? `SLOT 4 GUARD: Use ONLY the ingredients listed in PRODUCT DATA above. Do not add extras.`
    : `SLOT 4 GUARD: No ingredients were provided — slot4.ingredients MUST be [] in your output. Do NOT invent any ingredient names.`

  return `Generate a TikTok Shop listing description + per-slot image text. Return a single JSON object only.

PRODUCT DATA (read carefully — ALL copy must derive ONLY from this):
- Name: ${product.productName}
${product.productDescription ? `- Description: ${product.productDescription}` : ''}
${product.painPoints ? `- Customer pain points: ${product.painPoints}` : ''}
${product.usps ? `- USPs / key differentiators: ${product.usps}` : ''}
${product.benefits ? `- Benefits: ${product.benefits}` : ''}
- Ingredients: ${ingredientsList}
${product.offer ? `- Pricing / Offer: ${product.offer}` : ''}

BRAND:
- Tone: ${voiceTone}
- Sample phrases: ${voiceSamples}
- Store: ${brandKit.storeName}

REASONING STEP (mental only — do NOT include in output):
Before writing a single word of copy, identify these 4 things from PRODUCT DATA above:
(a) TARGET CUSTOMER — who is living this problem? Age range, gender, daily context?
(b) CORE PAIN FEELING — the emotion/discomfort they experience daily. Not the clinical name, the FEELING.
(c) #1 TRANSFORMATION PROMISE — what specifically changes for them after using this product? Be concrete.
(d) KEY DIFFERENTIATOR — what makes this product different from the generic category alternative?
Your answers to (a)–(d) must inform every field below. If you cannot answer (c) or (d) from PRODUCT DATA, derive the closest reasonable inference — do NOT invent clinical claims.

JSON SHAPE (return exactly this structure — all values in ${langName}):
{
  "blocks": [
    {"kind": "hook", "text": "<emoji + 1-sentence opener; **bold** the strongest result/claim; max 130 chars>"},
    {"kind": "pain", "bullets": [
      "<customer self-question from reasoning (b), ending '?', max 10 words>",
      "<another pain self-question, max 10 words>",
      "<another pain self-question, max 10 words>"
    ]},
    {"kind": "solution", "text": "<introduce product as the answer to pain; **bold** product name + main mechanism; max 160 chars>"},
    {"kind": "benefits", "bullets": [
      "<concrete outcome with number or timeframe from reasoning (c), max 15 words>",
      "<benefit>", "<benefit>", "<benefit>", "<benefit>"
    ]},
    {"kind": "specs", "rows": [
      ["<ingredient or key spec — ONLY from PRODUCT DATA; if none use generic feature>", "<brief function or benefit>"]
    ]},
    {"kind": "reviews", "quotes": [
      {"text": "<before→after story with time marker, max 100 chars>", "author": "<Name, City — see REVIEWER NAMES below>"},
      {"text": "<second review with time marker>", "author": "<Name, City>"}
    ]},
    {"kind": "usage", "steps": [
      "<SPECIFIC action verb + object + amount/duration, max 12 words>",
      "<step>",
      "<step>"
    ]},
    {"kind": "offer", "text": "<offer line; **bold** price or discount amount; max 100 chars>"},
    {"kind": "faq", "items": [
      {"q": "<safety or ingredients question>", "a": "<answer>"},
      {"q": "<results timing question>", "a": "<specific timeframe answer>"},
      {"q": "<return or refund question>", "a": "<answer>"}
    ]},
    {"kind": "promise", "bullets": [
      "<service promise — shipping/return/packaging ONLY, max 10 words>",
      "<promise>", "<promise>"
    ]},
    {"kind": "cta", "text": "<**bold** the action verb; mild urgency; max 80 chars>"}
  ],
  "slotTexts": {
    "slot1": {
      "headline": "<4–6 words ALL CAPS — the #1 transformation from reasoning (c), derived from USPs/benefits>",
      "tagline": "<8–12 words — specific mechanism or target customer outcome, NOT generic>"
    },
    "slot2": {
      "question": "<core pain from reasoning (b) as a customer self-question, max 10 words, ends '?'>",
      "painBullets": [
        "<customer-voice self-question max 8 words ends '?'>",
        "<question ends '?'>",
        "<question ends '?'>"
      ]
    },
    "slot3": {
      "beforeLabel": "${beforeLabel}",
      "afterLabel": "${afterLabel}",
      "metric": "<SPECIFIC measurable outcome ALL CAPS max 4 words — number + unit or timeframe — from reasoning (c)>",
      "metricSubtitle": "<supporting context e.g. 'DALAM 14 HARI', max 5 words>",
      "disclaimer": "<results-may-vary disclaimer, max 8 words>"
    },
    "slot4": {
      "title": "<formula / active ingredients panel title ALL CAPS>",
      "ingredients": ${slot4IngShape},
      "tagline": "<short safety or natural-formula claim derived from product data, max 8 words>"
    },
    "slot5": {
      "quote": "<concrete before→after story with time marker, max 100 chars>",
      "author": "<${reviewerNameHint}>",
      "verifiedNote": "<verified-review label>"
    },
    "slot6": {
      "title": "<how-to-use title with step count e.g. '3 LANGKAH MUDAH' or '3 BƯỚC ĐƠN GIẢN'>",
      "steps": [
        "<SPECIFIC action verb + exact object + amount/duration, max 10 words>",
        "<step>",
        "<step>"
      ],
      "timing": "<usage timing e.g. '🌅 Pagi • 🌙 Malam'>"
    },
    "slot7": {
      "title": "<comparison section title>",
      "usLabel": "<our product short label>",
      "themLabel": "<generic or competitor short label>",
      "points": [
        ["<our SPECIFIC differentiator from reasoning (d) — number/material/time/mechanism>", "<their generic equivalent>"],
        ["<specific>", "<generic>"],
        ["<specific>", "<generic>"],
        ["<specific>", "<generic>"]
      ]
    },
    "slot8": {
      "originalPrice": "<original price from pricing data if mentioned, else omit this key>",
      "currentPrice": "<current sale price from product.offer; use '(Harga)' if not provided>",
      "discount": "<discount amount or % if available, else omit>",
      "combo": "<combo or bonus line if applicable, else omit>",
      "cta": "${ctaDefault}",
      "urgency": "<urgency line max 6 words>"
    },
    "slot9": {
      "title": "${faqTitle}",
      "items": [
        {"q": "<safety or ingredients concern>", "a": "<answer>"},
        {"q": "<results timing question>", "a": "<specific timeframe>"},
        {"q": "<return or refund question>", "a": "<answer>"}
      ]
    }
  }
}

${ingredientsGuard}

BOLD FORMATTING (use **markdown bold** — TikTok Shop renders it):
- Pick 1–2 emphasis points per block: the result claim, product name, action verb, price/discount.
- Never bold filler words or full sentences. Never bold inside specs rows (UI styles them).
- ALL wording must derive from PRODUCT DATA above. Do not copy placeholder words from this template.

REVIEWER NAMES: ${reviewerNameHint}

OUTPUT: JSON object only. Every string value in ${langName}. Zero preamble or text after closing brace.`
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
