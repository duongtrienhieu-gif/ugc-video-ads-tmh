// ──────────────────────────────────────────────────────────────────────────
// Z7 — Inline Creative Pipeline service.
// Generates a creative asset (full script / hook variants / CTA variants /
// storyboard / landing outline / product scene briefs) IN-PLACE inside the
// Ad Analysis app. No cross-app redirect required for generation.
// ──────────────────────────────────────────────────────────────────────────

import type {
  GeneratedScript, ScriptGenParams, PipelineMode, ScriptGenLanguage, ScriptGenTone,
} from '../types'
import { SCRIPT_TONE_LABEL_VI, PIPELINE_MODE_LABEL_VI } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useBankStore } from '../../../stores/bankStore'
import { directGeminiText } from '../../../utils/gemini'

// ── Language descriptors ───────────────────────────────────────────────────
const LANG_NAME: Record<ScriptGenLanguage, string> = {
  'ms': 'Bahasa Melayu (Malaysia)',
  'vi': 'Tiếng Việt (Vietnamese)',
  'en': 'English',
}

// ── Tone descriptors fed to Gemini ─────────────────────────────────────────
const TONE_INSTRUCTION: Record<ScriptGenTone, string> = {
  'original':    'Mirror the ORIGINAL ad tone — same energy, pacing, and emotional register as the source transcript.',
  'emotional':   'Lean heavily on emotional storytelling — vulnerability, hope, before/after feelings. Personal narrative.',
  'hard-sell':   'Maximum urgency, scarcity, multiple CTAs, direct sales pressure. COD-style.',
  'testimonial': 'First-person customer voice — "I tried this, here is what happened" narrative angle.',
  'soft-sell':   'Gentle, advisory, educational — feels like a friend recommendation, not a sales pitch.',
  'scientific':  'Authority + clinical data + mechanism explanation. Expert credibility tone.',
}

// ── Per-mode instruction blocks ────────────────────────────────────────────
interface ModeSpec {
  /** Short human label in Vietnamese (used in UI / metadata). */
  vnLabel: string
  /** What the user-prompt tells Gemini to produce. */
  taskInstruction: string
  /** Which output fields are expected (the others may be omitted). */
  expectedFields: Array<keyof Omit<GeneratedScript, 'id' | 'mode' | 'language' | 'tone' | 'productId' | 'productName' | 'sourceFileName' | 'generatedAt' | 'rawText' | 'viTranslation'>>
}

const MODE_SPEC: Record<PipelineMode, ModeSpec> = {
  'script-similar': {
    vnLabel: 'Script tương tự',
    taskInstruction:
      'Write a brand-new ~30-second short-form ad script for OUR product that follows the SAME story arc, pacing and persuasion structure as the source ad. Replace the original product references with our product.',
    expectedFields: ['hook', 'body', 'cta', 'sceneSuggestion', 'brollSuggestion', 'emotionNote', 'voiceTone'],
  },
  'transcript-similar': {
    vnLabel: 'Script từ lời thoại',
    taskInstruction:
      'Using the source ad transcript as a structural template (hook, pacing, CTA, storytelling flow), rewrite a full ~30-second script for OUR product. Preserve what made the original work; swap the product context.',
    expectedFields: ['hook', 'body', 'cta', 'sceneSuggestion', 'brollSuggestion', 'emotionNote', 'voiceTone'],
  },
  'variation-script': {
    vnLabel: 'Script từ variation',
    taskInstruction:
      'Take the supplied variation tone/angle and expand it into a full ~30-second ad script for OUR product. Keep the variation\'s tone/angle as the dominant voice. Output Hook/Body/CTA + production notes.',
    expectedFields: ['hook', 'body', 'cta', 'sceneSuggestion', 'brollSuggestion', 'emotionNote', 'voiceTone'],
  },
  'hook-variants': {
    vnLabel: 'Hook variants',
    taskInstruction:
      'Write 5 NEW hook lines (1 sentence each) for OUR product, inspired by the technique used in the source ad. Number them 1-5. Each hook should use a different angle (curiosity / urgency / authority / emotion / pattern-interrupt).',
    expectedFields: ['body'],
  },
  'cta-variants': {
    vnLabel: 'CTA variants',
    taskInstruction:
      'Write 5 Facebook primary-text CTA variants for OUR product. Number them 1-5. Mix angles: urgency / scarcity / soft question / direct / value-stack. Each CTA = 2-4 short lines (FB ad copy length).',
    expectedFields: ['body'],
  },
  'storyboard': {
    vnLabel: 'Storyboard',
    taskInstruction:
      'Produce a shot-by-shot storyboard for a ~30-second ad of OUR product, using the structure of the source ad. List 6-10 shots: SHOT N (TIMESTAMP) — visual description | dialogue/VO | on-screen text. Plain text, mobile-vertical.',
    expectedFields: ['body', 'brollSuggestion'],
  },
  'landing-page': {
    vnLabel: 'Landing page outline',
    taskInstruction:
      'Write a concise text outline for a Malaysian Facebook landing page advertorial built around OUR product, inspired by the angles/levers in the source ad. List the sections in order with a 1-2 line description each (Hero / Pain / Discovery / Ingredients / Benefits / Social proof / Offer / CTA).',
    expectedFields: ['body'],
  },
  'product-scenes': {
    vnLabel: 'Product AI scenes',
    taskInstruction:
      'Write 4 short scene briefs (each 2-4 sentences) for product AI image generation, inspired by the visual playbook of the source ad. Each brief = ONE concrete lifestyle/UGC photo showing OUR product in use. Number them 1-4.',
    expectedFields: ['body'],
  },
}

// ── System prompt — universal for all modes ───────────────────────────────
const SYSTEM_PROMPT = `You are an elite Malaysian DTC short-form ad copywriter. You rewrite winning ad creatives for NEW products while preserving what made the original work.

You must return a SINGLE STRICT JSON object — no markdown fences, no commentary — with the following shape:
{
  "hook": "string (optional, only when the mode produces a single hook line)",
  "body": "string (main asset content — script body / numbered list / storyboard / outline)",
  "cta": "string (optional, only for full-script modes)",
  "sceneSuggestion": "string (optional, full-script modes)",
  "brollSuggestion": "string (optional, full-script modes)",
  "emotionNote": "string (optional, full-script modes — Vietnamese 1-2 lines on emotional beats)",
  "voiceTone": "string (optional, full-script modes — Vietnamese 1-2 lines on desired voice tone)",
  "viTranslation": "string — ALWAYS REQUIRED — a Vietnamese translation of hook+body+cta combined (single block)."
}

ABSOLUTE RULES:
• OUTPUT LANGUAGE is set by the user prompt — every text field except viTranslation/emotionNote/voiceTone MUST be in that language only, no mixing.
• viTranslation is ALWAYS in Vietnamese, regardless of output language.
• emotionNote and voiceTone are ALWAYS in Vietnamese (they are director notes for the user).
• NEVER invent product facts, prices, or ingredients — use only what the product brief provides.
• Tone instruction MUST be respected throughout the asset.
• When in doubt, lean MOBILE-FIRST and short.`

// ── Helpers ───────────────────────────────────────────────────────────────

function extractJson(raw: string): string {
  let s = raw.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]+?)```/)
  if (fence) s = fence[1].trim()
  const first = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (first >= 0 && last > first) s = s.slice(first, last + 1)
  return s
}

function getGeminiKey(): string {
  const s = useSettingsStore.getState()
  if (!s.hasGeminiKey()) {
    throw new Error('Chưa có Google Gemini API key. Vào Cài đặt → nhập key từ aistudio.google.com')
  }
  return s.getGeminiApiKey()
}

function buildUserPrompt(params: ScriptGenParams): string {
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm trong PROJECT')

  const spec = MODE_SPEC[params.mode]
  const langName = LANG_NAME[params.language]
  const toneInstruction = TONE_INSTRUCTION[params.tone]

  const lines: string[] = []
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('PRODUCT BRIEF (use only these facts — never invent)')
  lines.push('═══════════════════════════════════════════════════════════════')
  if (product.productName)        lines.push(`Name: ${product.productName}`)
  if (product.productDescription) lines.push(`Description: ${product.productDescription}`)
  if (product.targetMarket)       lines.push(`Target market: ${product.targetMarket}`)
  if (product.painPoints)         lines.push(`Pain points: ${product.painPoints}`)
  if (product.usps)               lines.push(`USPs: ${product.usps}`)
  if (product.benefits)           lines.push(`Benefits: ${product.benefits}`)
  if (product.offer)              lines.push(`Offer: ${product.offer}`)
  if (product.ingredients)        lines.push(`Ingredients: ${product.ingredients}`)

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`OUTPUT LANGUAGE LOCK: ${langName}`)
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`Every text field (hook, body, cta, sceneSuggestion, brollSuggestion) MUST be 100% ${langName}.`)
  lines.push('viTranslation → always Vietnamese. emotionNote + voiceTone → always Vietnamese (director notes).')

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`TONE: ${SCRIPT_TONE_LABEL_VI[params.tone]}`)
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(toneInstruction)

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`MODE: ${spec.vnLabel}`)
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(spec.taskInstruction)
  lines.push(`Required output fields: ${spec.expectedFields.join(', ')}, viTranslation`)

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('SOURCE AD REFERENCE (do NOT copy verbatim — learn structure / angle / pacing)')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(params.sourceContext.slice(0, 6000))   // hard cap to avoid blowing context

  lines.push('')
  lines.push('Return ONE STRICT JSON object — no markdown, no commentary.')

  return lines.join('\n')
}

interface RawGen {
  hook?: string
  body?: string
  cta?: string
  sceneSuggestion?: string
  brollSuggestion?: string
  emotionNote?: string
  voiceTone?: string
  viTranslation?: string
}

// ── Public API ────────────────────────────────────────────────────────────

export async function generateScriptFromAd(params: ScriptGenParams): Promise<GeneratedScript> {
  const apiKey = getGeminiKey()
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm — chọn lại từ PROJECT')

  const userPrompt = buildUserPrompt(params)

  let raw: string
  try {
    raw = await directGeminiText({
      apiKey,
      prompt: userPrompt,
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 4096,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Gemini lỗi: ${msg}`)
  }

  // Try to parse strict JSON; if it fails fall back to using the raw text
  // as the body. Better UX than throwing.
  let parsed: RawGen | null = null
  try {
    parsed = JSON.parse(extractJson(raw)) as RawGen
  } catch {
    parsed = null
  }

  const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `gen-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  if (!parsed) {
    return {
      id,
      mode: params.mode,
      language: params.language,
      tone: params.tone,
      productId: params.productId,
      productName: product.productName,
      sourceFileName: params.sourceFileName,
      rawText: raw,
      body: raw,
      generatedAt: Date.now(),
    }
  }

  return {
    id,
    mode: params.mode,
    language: params.language,
    tone: params.tone,
    productId: params.productId,
    productName: product.productName,
    sourceFileName: params.sourceFileName,
    hook: parsed.hook?.trim() || undefined,
    body: parsed.body?.trim() || undefined,
    cta: parsed.cta?.trim() || undefined,
    sceneSuggestion: parsed.sceneSuggestion?.trim() || undefined,
    brollSuggestion: parsed.brollSuggestion?.trim() || undefined,
    emotionNote: parsed.emotionNote?.trim() || undefined,
    voiceTone: parsed.voiceTone?.trim() || undefined,
    viTranslation: parsed.viTranslation?.trim() || undefined,
    generatedAt: Date.now(),
  }
}

// ── Metadata header for "save to PROJECT > Kịch bản" ──────────────────────
// The bankStore Script schema is intentionally minimal (title/scriptText/
// linkedProductId/source) — to preserve traceability we embed a metadata
// header at the top of scriptText. Recovers source ad, tone, language,
// hook type, generated date.

export function buildSaveableScriptText(script: GeneratedScript): string {
  const lines: string[] = []
  lines.push('━━━ Generated from Ads Analysis ━━━')
  if (script.sourceFileName) lines.push(`Source ad: ${script.sourceFileName}`)
  lines.push(`Mode: ${PIPELINE_MODE_LABEL_VI[script.mode]}`)
  lines.push(`Tone: ${SCRIPT_TONE_LABEL_VI[script.tone]}`)
  lines.push(`Language: ${script.language.toUpperCase()}`)
  lines.push(`Linked product: ${script.productName}`)
  if (script.hook) lines.push(`Hook type: ${script.hook.slice(0, 80)}${script.hook.length > 80 ? '…' : ''}`)
  lines.push(`Generated: ${new Date(script.generatedAt).toLocaleString('vi-VN')}`)
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('')

  if (script.hook)             { lines.push('## HOOK');        lines.push(script.hook);             lines.push('') }
  if (script.body)             { lines.push('## BODY');        lines.push(script.body);             lines.push('') }
  if (script.cta)              { lines.push('## CTA');         lines.push(script.cta);              lines.push('') }
  if (script.sceneSuggestion)  { lines.push('## SCENE');       lines.push(script.sceneSuggestion);  lines.push('') }
  if (script.brollSuggestion)  { lines.push('## B-ROLL');      lines.push(script.brollSuggestion);  lines.push('') }
  if (script.emotionNote)      { lines.push('## EMOTION');     lines.push(script.emotionNote);      lines.push('') }
  if (script.voiceTone)        { lines.push('## VOICE TONE');  lines.push(script.voiceTone);        lines.push('') }

  if (script.viTranslation) {
    lines.push('━━━ Bản dịch tiếng Việt ━━━')
    lines.push(script.viTranslation)
  }

  // Fallback for parse-failures
  if (!script.body && !script.hook && script.rawText) {
    lines.push(script.rawText)
  }

  return lines.join('\n').trim()
}

/** Pure-text dump used for clipboard / "send to Voice/UGC" payloads. */
export function buildPlainScriptText(script: GeneratedScript): string {
  const parts: string[] = []
  if (script.hook) parts.push(script.hook)
  if (script.body) parts.push(script.body)
  if (script.cta)  parts.push(script.cta)
  if (parts.length === 0 && script.rawText) parts.push(script.rawText)
  return parts.join('\n\n').trim()
}
