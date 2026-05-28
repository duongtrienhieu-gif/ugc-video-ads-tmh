// Description text generation — produces the 11-block ListingDescription
// using kie.ai's chat/completions endpoint (Gemini Flash via OpenAI-compat).
//
// Returns structured DescriptionBlock[] parsed from JSON. Fall back to mock
// description if parse fails so the UI doesn't crash.

import type { ResolvedBrandKit, Market } from '../../../types/brandKit'
import type { Product } from '../../../stores/types'
import type { DescriptionBlock, ListingDescription } from '../types'
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
  const blocks = parseBlocksOrFallback(raw)
  const fullText = assembleFullText(blocks)
  return { blocks, fullText }
}

function buildSystemInstruction(params: GenerateDescriptionParams): string {
  const lang = params.language === 'ms' ? 'Bahasa Malaysia' : 'Vietnamese'
  return `You are a TikTok Shop listing copywriter for TPCN (health supplement) products in the Malaysia/Vietnam market.

OUTPUT LANGUAGE: ${lang} ONLY. NO English mixed in. NO Chinese, Japanese, Arabic, Thai characters.
OUTPUT FORMAT: strict JSON only — no markdown fences, no preamble, no commentary, no trailing text.

LEGAL CONSTRAINTS (per [[feedback-no-fake-certs]]):
- DO NOT mention any cert claims (Halal JAKIM, KKM, GMP, FDA, BYT, ISO) — user has not uploaded proof
- DO NOT use clinical claims like "rawat", "sembuh", "cure", "treat" — use softer "membantu", "menyokong", "hỗ trợ"
- DO NOT invent specific medical claims not supported by product data provided`
}

function buildDescriptionPrompt(params: GenerateDescriptionParams): string {
  const { product, brandKit, language } = params
  const voiceTone = brandKit.voice.tone ?? 'friendly + premium'
  const voiceSamples = brandKit.voice.samplePhrases?.length
    ? brandKit.voice.samplePhrases.join(' / ')
    : 'N/A'

  const langName = language === 'ms' ? 'Bahasa Malaysia' : 'Vietnamese'

  return `Generate a complete TikTok Shop product listing description as JSON with EXACTLY 11 blocks aligned to the conversion arc.

JSON SHAPE (return THIS structure exactly):
{
  "blocks": [
    {"kind": "hook", "text": "<emoji + 1-sentence attention-grabbing opener, must be visible in 2-3 lines>"},
    {"kind": "pain", "bullets": ["<3 pain bullets, each a question or statement of the user's frustration>", "...", "..."]},
    {"kind": "solution", "text": "<1-2 sentences introducing the product as the solution + key mechanism>"},
    {"kind": "benefits", "bullets": ["<4-5 benefit bullets — concrete outcomes>", "...", "...", "...", "..."]},
    {"kind": "specs", "rows": [["<ingredient/key>", "<value/%>"], ["...", "..."], ...]},
    {"kind": "reviews", "quotes": [{"text": "<realistic customer quote>", "author": "<Name, City>"}, {"text": "...", "author": "..."}]},
    {"kind": "usage", "steps": ["<step 1>", "<step 2>", "<step 3>"]},
    {"kind": "offer", "text": "<offer line with price discount + combo>"},
    {"kind": "faq", "items": [{"q": "<question>", "a": "<answer>"}, {"q": "...", "a": "..."}, {"q": "...", "a": "..."}]},
    {"kind": "promise", "bullets": ["<service promise like fast shipping/return>", "...", "..."]},
    {"kind": "cta", "text": "<final CTA with mild urgency>"}
  ]
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
- Wrap KEY TERMS, not full sentences. Examples:
  - benefits bullet: "Putihkan hingga **8 shade dalam 14 hari**" (bold the result claim)
  - benefits bullet: "**Selamat untuk enamel** — pH neutral, formula lembut" (bold the headline phrase)
  - usage step: "**Berus 2 minit**, 2x sehari (pagi & malam)" (bold the action)
  - faq question: keep plain (UI will style it bold separately)
  - hook: 1 key claim bolded e.g. "Senyum percaya diri **dalam 14 hari** — tanpa whitening klinik mahal!"
  - solution: bold product name + main mechanism — "**WHITEPRO Whitening Powder** — Serbuk pemutih gigi formula aktif dengan **Activated Charcoal + Hydroxyapatite**"
  - cta: bold the verb — "**Beli sekarang** — stok terhad hari ini!"
- DO NOT bold every word — that defeats the purpose. Pick 1-2 emphasis points per block.
- DO NOT bold inside specs rows (the row labels render bold automatically in UI).

Return the JSON object only.`
}

// ── Parsing ──────────────────────────────────────────────────────────────

interface RawBlocksPayload {
  blocks?: unknown
}

function parseBlocksOrFallback(raw: string): DescriptionBlock[] {
  const json = extractJsonObject(raw)
  if (!json) {
    console.warn('[generateDescription] could not extract JSON from response — using mock')
    return MOCK_DESCRIPTION_BLOCKS
  }
  try {
    const payload = JSON.parse(json) as RawBlocksPayload
    const blocks = payload.blocks
    if (!Array.isArray(blocks) || blocks.length === 0) {
      console.warn('[generateDescription] JSON has no blocks array — using mock')
      return MOCK_DESCRIPTION_BLOCKS
    }
    const validated = blocks
      .map(validateBlock)
      .filter((b): b is DescriptionBlock => b !== null)
    if (validated.length < 5) {
      console.warn('[generateDescription] too few valid blocks — using mock', validated.length)
      return MOCK_DESCRIPTION_BLOCKS
    }
    return validated
  } catch (err) {
    console.warn('[generateDescription] JSON parse failed — using mock', err)
    return MOCK_DESCRIPTION_BLOCKS
  }
}

// Models occasionally wrap JSON in ```json fences or add commentary.
// Extract the first balanced JSON object from the response.
function extractJsonObject(raw: string): string | null {
  // Strip code fences
  const withoutFences = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  // Find the first { and the matching closing }
  const start = withoutFences.indexOf('{')
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < withoutFences.length; i++) {
    if (withoutFences[i] === '{') depth++
    else if (withoutFences[i] === '}') {
      depth--
      if (depth === 0) return withoutFences.slice(start, i + 1)
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
