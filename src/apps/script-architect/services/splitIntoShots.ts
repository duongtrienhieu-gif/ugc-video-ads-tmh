import type { Product } from '../../../stores/types'
import type {
  ScriptGenerationResult, Shot, ShotPlan, ScriptLanguage, ShotBlock, ShotFill, ShotMatchMode,
} from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { directGeminiText } from '../../../utils/gemini'

// ─────────────────────────────────────────────────────────────────────────
// Phase B / B1 — split a finished COD script into VISUAL BEATS (shots).
// A shot is NOT a sentence. It's one coherent on-screen idea, long enough to
// be a watchable clip. Rules (frozen with the operator):
//  • Merge consecutive lines that show the SAME thing (even 3-4 short clauses).
//  • Split when the visual subject changes — even if each piece is short.
//  • A long line carrying TWO visual ideas may split into two shots.
//  • Duration: spoken ~2.5 words/sec; floor ~3s, ceiling ~6s (soft — one long
//    single-idea line may exceed the ceiling rather than be split artificially).
//  • Query/render off the visualIdea (what to SHOW), never the raw dialogue.
//  • MY is the primary market: split on the MY script, keep an aligned VN gloss.
//  • fill: source-broad (problem/emotion/lifestyle/3D/mechanism — no product
//    match needed) | source-product (product/ingredient/demo — exact Douyin/RED
//    clip) | ai-render (the CTA shot ONLY).
// ─────────────────────────────────────────────────────────────────────────

const WORDS_PER_SEC = 2.5
export const FLOOR_SEC = 3
export const CEILING_SEC = 6

const VALID_BLOCKS: ShotBlock[] = [
  'van-de', 'noi-dau', 'san-pham', 'loi-ich-sp', 'thanh-phan', 'co-che', 'loi-ich-kh', 'proof', 'cta',
]
const VALID_FILL: ShotFill[] = ['source-broad', 'source-product', 'ai-render']
const VALID_MATCH: ShotMatchMode[] = ['broad', 'product-exact']

// Default fill per block when the model is unsure / sends an illegal value.
// Exported so the co-pilot UI snaps fill→sane default when the block changes.
export const DEFAULT_FILL_BY_BLOCK: Record<ShotBlock, ShotFill> = {
  'van-de': 'source-broad',
  'noi-dau': 'source-broad',
  'san-pham': 'source-product',
  'loi-ich-sp': 'source-product',
  'thanh-phan': 'source-product',
  'co-che': 'source-broad',
  'loi-ich-kh': 'source-broad',
  'proof': 'source-broad',
  'cta': 'ai-render',
}

interface RawShot {
  my?: unknown
  vi?: unknown
  block?: unknown
  visualIdea?: unknown
  zhQuery?: unknown
  durationSec?: unknown
  fill?: unknown
  matchMode?: unknown
}

const RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    shots: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          my: { type: 'string' },
          vi: { type: 'string' },
          block: { type: 'string', enum: VALID_BLOCKS },
          visualIdea: { type: 'string' },
          zhQuery: { type: 'string' },
          durationSec: { type: 'number' },
          fill: { type: 'string', enum: VALID_FILL },
          matchMode: { type: 'string', enum: VALID_MATCH },
        },
        required: ['my', 'vi', 'block', 'visualIdea', 'fill'],
      },
    },
  },
  required: ['shots'],
}

const SYSTEM_PROMPT = `You are a COD direct-response VIDEO DIRECTOR. You take a finished voice-over ad script and break it into SHOTS for an editor to fill with footage.

A SHOT is a VISUAL BEAT — one coherent thing shown on screen — NOT a sentence. Follow these rules exactly:

SEGMENTATION
- Merge consecutive lines that show the SAME visual into ONE shot (e.g. three short clauses all describing bad skin = one shot of a problem face).
- Split when the on-screen subject changes, even if each piece is short (bloated stomach ≠ a gut animation ≠ the product).
- A long line that carries TWO different visual ideas MAY be split into two shots.
- DURATION: spoken pace ≈ 2.5 words/second. Aim each shot ~3-6 seconds. A shot shorter than ~3s should be merged with the nearest same-visual neighbour; if none exists, attach it to the adjacent beat in the sell-arc. One long single-visual line may run past 6s rather than be split artificially.

BLOCK (the sell-arc beat this shot belongs to): one of
  van-de (problem) | noi-dau (pain) | san-pham (product intro) | loi-ich-sp (product benefit) | thanh-phan (ingredients) | co-che (mechanism) | loi-ich-kh (customer benefit) | proof | cta

VISUAL IDEA — the single most important field. Describe WHAT TO SHOW on screen for this shot (the footage brief), NOT the words spoken. e.g. line "Inulin xử lý từ gốc" → visualIdea "close-up of supplement capsules + simple gut/probiotic animation". This is what the editor will search or render against.

CHINESE SEARCH KEYWORD ("zhQuery") — the footage is sourced from Douyin / RED (小红书) / Kuaishou, which are CHINESE platforms. So give a SHORT Chinese search phrase (2-6 words/characters) that finds the visualIdea on those platforms — in 简体中文 (Simplified Chinese), NOT Malay, NOT English.
- For source-broad shots: describe ONLY the situation / emotion / action / setting. NEVER include the product, brand, or product name (those won't exist as generic stock there). e.g. visualIdea "bloated stomach discomfort" → zhQuery "肚子胀气 不舒服".
- For source-product shots: describe the GENERIC product CATEGORY in Chinese (a Malay brand name won't exist on Chinese platforms), e.g. "益生菌 胶囊 特写" / "膝盖护具 佩戴".
- For ai-render shots (CTA): leave zhQuery as an empty string "" — that shot is generated, not searched.

FILL — how this shot gets footage:
- source-broad: problem, pain, emotion, everyday life, 3D/mechanism illustration — generic stock/UGC clips, NO need to match the exact product.
- source-product: product shots, ingredient close-ups, product demos — must find the EXACT product clip (sourced from Douyin/RED).
- ai-render: RESERVED FOR THE CTA SHOT ONLY. The cta block is always ai-render. No other block may use ai-render.

MATCH MODE (ignored for ai-render): broad (loose) for source-broad shots; product-exact for source-product shots.

LANGUAGE — Malaysian Malay is the PRIMARY market. Segment on the MALAY script. For each shot output BOTH the Malay line ("my") and an aligned Vietnamese gloss ("vi") of the SAME beat — they must line up one-to-one. Keep product names and ingredient names as-is. Do not invent or rewrite the dialogue; only segment and group the existing lines.

Output the shots in playback order.`

function getGeminiKey(): string {
  const store = useSettingsStore.getState()
  if (!store.hasGeminiKey()) {
    throw new Error('Chưa có Google Gemini API key. Vào Cài đặt → Google Gemini để nhập key.')
  }
  return store.getGeminiApiKey()
}

function asStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function countWords(s: string): number {
  return s.split(/\s+/).filter(Boolean).length
}

// Exported so the co-pilot UI recomputes duration when an operator edits a line.
export function estimateDuration(primaryText: string): number {
  const secs = countWords(primaryText) / WORDS_PER_SEC
  return Math.max(1, Math.round(secs))
}

function normalizeBlock(v: unknown): ShotBlock {
  const s = asStr(v) as ShotBlock
  return VALID_BLOCKS.includes(s) ? s : 'loi-ich-kh'
}

/** Enforce the operator's hard rules: CTA is ALWAYS ai-render; ai-render is
 *  ALLOWED ONLY on the CTA block. Everything else falls back to a sane
 *  per-block default if the model returns something illegal. */
function normalizeFill(rawFill: unknown, block: ShotBlock): ShotFill {
  if (block === 'cta') return 'ai-render'
  const s = asStr(rawFill) as ShotFill
  if (s === 'ai-render') return DEFAULT_FILL_BY_BLOCK[block] // ai-render not allowed off CTA
  return VALID_FILL.includes(s) ? s : DEFAULT_FILL_BY_BLOCK[block]
}

function normalizeMatch(rawMatch: unknown, fill: ShotFill): ShotMatchMode {
  if (fill === 'source-product') return 'product-exact'
  if (fill === 'ai-render') return 'broad' // n/a, kept stable
  const s = asStr(rawMatch) as ShotMatchMode
  return VALID_MATCH.includes(s) ? s : 'broad'
}

function buildUserPrompt(result: ScriptGenerationResult, product: Product, primaryLang: ScriptLanguage): string {
  const lines: string[] = []
  lines.push('PRODUCT (for grounding visualIdea / fill — do not invent fields):')
  if (product.productName) lines.push(`- Name: ${product.productName}`)
  if (product.ingredients) lines.push(`- Ingredients: ${product.ingredients}`)
  if (product.offer)       lines.push(`- Offer: ${product.offer}`)
  lines.push('')
  lines.push(`PRIMARY MARKET / MAIN LINE LANGUAGE: ${primaryLang === 'my' ? 'Malaysian Malay (my)' : 'Vietnamese (vi)'}`)
  lines.push('')
  lines.push('=== MALAY SCRIPT (my) ===')
  lines.push(result.malay || '(empty)')
  lines.push('')
  lines.push('=== VIETNAMESE SCRIPT (vi) ===')
  lines.push(result.vietnamese || '(empty)')
  lines.push('')
  lines.push('Segment the script into shots per the rules. Return JSON: {"shots":[{"my","vi","block","visualIdea","zhQuery","durationSec","fill","matchMode"}]}.')
  return lines.join('\n')
}

export async function splitScriptIntoShots(args: {
  result: ScriptGenerationResult
  product: Product
  /** Which language is the MAIN line. Defaults to MY (primary market). */
  primaryLang?: ScriptLanguage
}): Promise<ShotPlan> {
  const { result, product } = args
  const primaryLang: ScriptLanguage = args.primaryLang ?? 'my'
  const apiKey = getGeminiKey()

  const raw = await directGeminiText({
    apiKey,
    prompt: buildUserPrompt(result, product, primaryLang),
    systemInstruction: SYSTEM_PROMPT,
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA,
    thinkingBudget: 0,
    maxOutputTokens: 8192,
    temperature: 0.4,
  })

  let parsed: { shots?: RawShot[] }
  try {
    parsed = JSON.parse(raw) as { shots?: RawShot[] }
  } catch {
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('Không tách được cảnh — Gemini trả về không phải JSON. Thử lại.')
    parsed = JSON.parse(m[0]) as { shots?: RawShot[] }
  }

  const rawShots = Array.isArray(parsed.shots) ? parsed.shots : []
  const shots: Shot[] = rawShots
    .map((r, i): Shot | null => {
      const my = asStr(r.my)
      const vi = asStr(r.vi)
      // A shot needs at least the primary-language line.
      const primaryText = primaryLang === 'my' ? my : vi
      if (!primaryText) return null
      const block = normalizeBlock(r.block)
      const fill = normalizeFill(r.fill, block)
      const matchMode = normalizeMatch(r.matchMode, fill)
      const durationSec = estimateDuration(primaryText)
      // ai-render (CTA) is generated, not sourced → no Chinese search keyword.
      const zhQuery = fill === 'ai-render' ? '' : asStr(r.zhQuery)
      return {
        id: `shot_${i}`,
        my,
        vi,
        block,
        visualIdea: asStr(r.visualIdea) || primaryText,
        zhQuery,
        durationSec,
        fill,
        matchMode,
      }
    })
    .filter((s): s is Shot => s !== null)

  if (shots.length === 0) {
    throw new Error('Không tách được cảnh nào từ kịch bản — thử lại hoặc tạo lại kịch bản.')
  }

  const totalDurationSec = shots.reduce((sum, s) => sum + s.durationSec, 0)
  return { language: primaryLang, shots, totalDurationSec }
}
