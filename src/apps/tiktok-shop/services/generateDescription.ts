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
  return `You are a TikTok Shop listing copywriter for the Malaysia/Vietnam market. The product can be ANY niche (supplement, beauty, skincare, oral care, cough patch, mom-baby, household, etc.) — read the PRODUCT DATA below carefully and write copy that matches THAT specific product. Never assume the niche.

OUTPUT LANGUAGE: ${lang} ONLY. NO English mixed in. NO Chinese, Japanese, Arabic, Thai characters.
OUTPUT FORMAT: strict JSON only — no markdown fences, no preamble, no commentary, no trailing text.

LEGAL CONSTRAINTS (per [[feedback-no-fake-certs]]):
- DO NOT mention any cert claims (Halal JAKIM, KKM, GMP, FDA, BYT, ISO) — user has not uploaded proof
- DO NOT use strong clinical claims like "rawat", "sembuh", "cure", "treat" — use softer "membantu", "menyokong", "hỗ trợ"
- DO NOT invent specific medical claims not supported by product data provided`
}

function buildDescriptionPrompt(params: GenerateDescriptionParams): string {
  const { product, brandKit, language } = params
  const voiceTone = brandKit.voice.tone ?? 'friendly + premium'
  const voiceSamples = brandKit.voice.samplePhrases?.length
    ? brandKit.voice.samplePhrases.join(' / ')
    : 'N/A'

  const langName = language === 'ms' ? 'Bahasa Malaysia' : 'Vietnamese'

  return `Generate a complete TikTok Shop product listing description AND the per-slot text overlays for 9 images, all in one JSON response.

EVERYTHING you write must be SPECIFIC to the product below — NO generic "teeth whitening" copy, NO unrelated category content. Read product fields carefully and write copy that matches the actual product niche.

JSON SHAPE (return THIS structure exactly — no extra fields, no commentary):
{
  "blocks": [
    {"kind": "hook", "text": "<emoji + 1-sentence attention-grabbing opener; visible in 2-3 lines>"},
    {"kind": "pain", "bullets": ["<3 pain bullets specific to this product's target user>", "...", "..."]},
    {"kind": "solution", "text": "<1-2 sentences introducing the product as the solution + key mechanism>"},
    {"kind": "benefits", "bullets": ["<4-5 benefit bullets — concrete outcomes>", "...", "...", "...", "..."]},
    {"kind": "specs", "rows": [["<key>", "<value>"], ["...", "..."], ...]},
    {"kind": "reviews", "quotes": [{"text": "<realistic customer quote about THIS product>", "author": "<Name, City>"}, {"text": "...", "author": "..."}]},
    {"kind": "usage", "steps": ["<step 1>", "<step 2>", "<step 3>"]},
    {"kind": "offer", "text": "<offer line with price discount + combo>"},
    {"kind": "faq", "items": [{"q": "<question>", "a": "<answer>"}, {"q": "...", "a": "..."}, {"q": "...", "a": "..."}]},
    {"kind": "promise", "bullets": ["<service promise like fast shipping/return>", "...", "..."]},
    {"kind": "cta", "text": "<final CTA with mild urgency>"}
  ],
  "slotTexts": {
    "slot1": {"headline": "<BIG hero claim ~6 words, ALL CAPS, specific to product>", "tagline": "<sub-claim ~8 words>"},
    "slot2": {"question": "<pain question matching this product's user>", "painBullets": ["<short bullet 1>", "<bullet 2>", "<bullet 3>"]},
    "slot3": {"beforeLabel": "<e.g. SEBELUM / TRƯỚC>", "afterLabel": "<e.g. SELEPAS / SAU>", "metric": "<specific outcome metric, e.g. +8 SHADE, -5KG, 3X MORE>", "metricSubtitle": "<period e.g. DALAM 14 HARI / SAU 30 NGÀY>", "disclaimer": "<results-may-vary disclaimer>"},
    "slot4": {"title": "<formula/mechanism title, e.g. FORMULA AKTIF / CÔNG THỨC HOẠT TÍNH>", "ingredients": [{"name": "<ingredient1>", "pct": "<30%>"}, {"name": "<ing2>", "pct": "<25%>"}, {"name": "<ing3>", "pct": "<20%>"}, {"name": "<ing4>", "pct": "<15%>"}], "tagline": "<short safety/natural claim>"},
    "slot5": {"quote": "<realistic customer testimonial about THIS product>", "author": "<Name, City>", "verifiedNote": "<small verified-review note>"},
    "slot6": {"title": "<how-to-use title with step count>", "steps": ["<step1 verb phrase>", "<step2>", "<step3>"], "timing": "<usage timing line e.g. 🌅 Pagi • 🌙 Malam>"},
    "slot7": {"title": "<choose-the-good title>", "usLabel": "<our category label>", "themLabel": "<competitor category label>", "points": [["<our val>", "<their val>"], ["...", "..."], ["...", "..."], ["...", "..."]]},
    "slot8": {"originalPrice": "<orig price string e.g. RM 159 or empty>", "currentPrice": "<current price string e.g. RM 89>", "discount": "<e.g. -44% or empty>", "combo": "<combo/gift line e.g. + FREE Bonus Item>", "cta": "<BELI SEKARANG / MUA NGAY>", "urgency": "<short urgency line e.g. Stok terhad hari ini>"},
    "slot9": {"title": "<FAQ title e.g. SOALAN LAZIM / CÂU HỎI THƯỜNG GẶP>", "items": [{"q": "<short safety/quality question>", "a": "<short answer>"}, {"q": "<results timing question>", "a": "<answer>"}, {"q": "<return policy question>", "a": "<answer>"}]}
  }
}

PRODUCT DATA:
- Name: ${product.productName}
${product.productDescription ? `- Description: ${product.productDescription}` : ''}
${product.painPoints ? `- Pain points the user has: ${product.painPoints}` : ''}
${product.usps ? `- USPs: ${product.usps}` : ''}
${product.benefits ? `- Benefits: ${product.benefits}` : ''}
${product.ingredients ? `- Ingredients: ${product.ingredients}` : ''}
${product.offer ? `- Offer/Pricing context: ${product.offer}` : ''}

BRAND VOICE:
- Tone: ${voiceTone}
- Sample brand voice phrases: ${voiceSamples}
- Store name: ${brandKit.storeName}

WRITING RULES:
- Total output ~800-1500 characters
- Hook MUST fit in 2-3 lines and grab attention without using cert/clinical claims
- Use ${langName} naturally, like a real seller — NOT machine-translated
- Specs rows: use ACTUAL ingredients from product data; if missing, use generic placeholders
- Reviews: 2 quotes with realistic local names (${langName === 'Bahasa Malaysia' ? 'Aisyah, Faridah, Aminah, Siti + city like KL, JB, Penang' : 'Linh, Mai, Thu, Hương + thành phố Việt Nam'})
- FAQ: 3 common buyer concerns about safety, results timing, return policy
- Promise: only SAFE service claims (shipping speed, return window, discreet packaging) — NO cert claims

BOLD FORMATTING (use **markdown bold** strategically — TikTok Shop renders it):
- Wrap KEY TERMS, not full sentences. Generic pattern (DO NOT copy these example strings — they are illustrative only, your content must match the ACTUAL product):
  - benefits bullet: bold the result claim (e.g., "<verb> hingga **<concrete outcome with number>**")
  - benefits bullet: bold the headline phrase (e.g., "**<short feature label>** — <expansion>")
  - usage step: bold the action verb + duration (e.g., "**<verb> <duration>**, <frequency>")
  - faq question: keep plain (UI styles it bold separately)
  - hook: bold the strongest claim (e.g., "<context> **<key time/result claim>** <rest>")
  - solution: bold product name + main mechanism (e.g., "**<actual product name>** — <category> với **<main mechanism/ingredients>**")
  - cta: bold the verb (e.g., "**<Buy verb>** — <urgency>")
- DO NOT bold every word — pick 1-2 emphasis points per block.
- DO NOT bold inside specs rows (UI styles them).
- CRITICAL: derive all wording from the actual PRODUCT DATA at the bottom of this prompt. Do NOT copy any words from these examples ("verb", "outcome", "duration", etc. are placeholders, not real copy).

Return the JSON object only.`
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
    if (ings.length > 0) {
      out.slot4 = {
        title: s4.title,
        ingredients: ings,
        tagline: typeof s4.tagline === 'string' ? s4.tagline : '',
      }
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
