import type {
  ScriptGenerationParams,
  ScriptGenerationResult,
  ScriptStructured,
  HookStrength,
  LengthSeconds,
  ToneModifier,
} from '../types'
import type { Product } from '../../../stores/types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useBankStore } from '../../../stores/bankStore'
import { directGeminiVision } from '../../../utils/gemini'
import { getPresetById, TONE_OPTIONS } from './presets'

// ─────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — written like a brief to an elite DTC copywriter, not a
// generic LLM assistant. The non-negotiable rules at the top exist because
// the most common failure mode is corporate marketing voice leaking back in.
// ─────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite DTC ecommerce copywriter who has written over a thousand winning UGC video ad scripts for TikTok and Meta. You specialize in Southeast Asian markets — primarily Malaysia and English-speaking ecommerce.

You write VOICE-OVER ONLY. Just the words a real creator says into their phone camera. No scene directions. No camera moves. No labels. No markdown. No emojis. No section headers.

═══════════════════════════════════════════════════════════════
NON-NEGOTIABLE RULES
═══════════════════════════════════════════════════════════════
1. Sound like a real human creator, not a brand
2. Short sentences. Spoken rhythm. Native cadence
3. The hook must stop the scroll inside the first 3 seconds
4. Every sentence earns the next sentence — no filler
5. Use the product's REAL ingredient names — never generic "powerful formula", never invent ingredients
6. Never claim to cure / treat / guarantee — keep the tone advertorial, not medical
7. BANNED words and phrases: "revolutionary", "unlock", "transform your life", "amazing", "game-changer", "ultimate", "the best [X] of all time", "absolutely incredible"
8. No emojis. No markdown. No bullet points. No section labels in the output. No "Hook:" / "Pain:" prefixes

═══════════════════════════════════════════════════════════════
MALAY VERSION RULES
═══════════════════════════════════════════════════════════════
Write in natural spoken Malaysian Bahasa Melayu — NOT textbook formal Malay.
- Conversational and colloquial, like a real Malaysian creator on TikTok
- Mix English words where it sounds natural ("memang worth it", "serius I tak sangka", "perut rasa ringan gila")
- Keep PRODUCT NAME and INGREDIENT NAMES in their original English (do not translate "Vitamin B12" or brand names)
- Same approximate length as the English version
- Same emotional arc as the English version

═══════════════════════════════════════════════════════════════
SCRIPT STRUCTURE
═══════════════════════════════════════════════════════════════
Default flow:
  Hook → Pain → Solution → Benefits → Proof/Demo → CTA

When EDUCATIONAL MODE is ON, expand to:
  Hook → Pain → Why this happens → Ingredient/mechanism → Why this product is different → Benefits → Proof/Demo → CTA

Educational explanations must sound CONVERSATIONAL, like a creator explaining to a friend — NOT like a medical textbook. Use analogies and plain-language framing (e.g. "inulin basically acts like food for the good bacteria in your gut").

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — exactly these markers, nothing else
═══════════════════════════════════════════════════════════════
<<<ENGLISH>>>
[plain spoken voice-over English — no labels, no markdown, no scene directions]
<<<MALAY>>>
[natural Malaysian Bahasa Melayu — colloquial, conversational]
<<<STRUCTURED>>>
{"hook":"...","pain":"...","whyItHappens":"...","ingredientMechanism":"...","solution":"...","benefits":"...","proof":"...","cta":"...","emotionalTone":"...","pacing":"...","audienceAngle":"..."}

(Omit "whyItHappens" and "ingredientMechanism" from the JSON if educational mode is OFF. The structured JSON is internal metadata — keep each value to one short sentence.)`

// ── Length → target word count (English ~150 wpm spoken) ─────────────────
const LENGTH_TARGETS: Record<LengthSeconds, { words: number; lines: number }> = {
  15: { words: 38,  lines: 3 },
  30: { words: 75,  lines: 5 },
  45: { words: 113, lines: 7 },
  60: { words: 150, lines: 9 },
}

// ── Hook strength briefing ──────────────────────────────────────────────
const HOOK_STRENGTH_BRIEF: Record<HookStrength, string> = {
  safe:       'Conservative hook tone — friendly, recognisable, no shock tactics. Suitable for risk-averse audiences and brand-safe placements.',
  balanced:   'Balanced hook — emotionally engaging without being provocative. The default for most campaigns.',
  aggressive: 'Aggressive hook — interruption-pattern, contrarian framing, provocative first line. Designed to stop the scroll at all costs while staying within platform policy.',
}

// ── Build the user-message portion of the prompt ────────────────────────
function buildUserPrompt(params: ScriptGenerationParams, product: Product): string {
  const preset = getPresetById(params.presetId)
  if (!preset) throw new Error(`Unknown preset: ${params.presetId}`)

  const target = LENGTH_TARGETS[params.lengthSec]
  const toneHints = TONE_OPTIONS
    .filter((t) => params.toneModifiers.includes(t.id))
    .map((t) => `- ${t.label}: ${t.promptHint}`)
    .join('\n')

  // Educational mode is implicit for any educational preset, explicit via toggle for classic presets.
  const educationalActive = params.educationalMode || preset.category === 'educational'

  const lines: string[] = []

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('PRODUCT CONTEXT (use the real fields — do not invent)')
  lines.push('═══════════════════════════════════════════════════════════════')
  if (product.productName)        lines.push(`Name: ${product.productName}`)
  if (product.productDescription) lines.push(`Description: ${product.productDescription}`)
  if (product.targetMarket)       lines.push(`Target market: ${product.targetMarket}`)
  if (product.painPoints)         lines.push(`Pain points: ${product.painPoints}`)
  if (product.usps)               lines.push(`USPs: ${product.usps}`)
  if (product.benefits)           lines.push(`Benefits: ${product.benefits}`)
  if (product.offer)              lines.push(`Offer: ${product.offer}`)
  if (product.ingredients)        lines.push(`★ Ingredients (name these specifically in the script — never generic): ${product.ingredients}`)

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`PRESET FRAMEWORK — ${preset.label} (${preset.category === 'educational' ? 'EDUCATIONAL' : 'classic'})`)
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`Hook formula: ${preset.hookFormula}`)
  lines.push(`Pacing: ${preset.pacingNote}`)
  lines.push(`Emotional angle: ${preset.emotionalAngle}`)
  lines.push(`CTA style: ${preset.ctaStyle}`)
  lines.push(`Proof style: ${preset.proofStyle}`)

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('LENGTH + INTENSITY')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`Target length: ${params.lengthSec} seconds (~${target.words} English words, ~${target.lines} spoken lines).`)
  lines.push(`Hook strength: ${params.hookStrength.toUpperCase()} — ${HOOK_STRENGTH_BRIEF[params.hookStrength]}`)

  if (toneHints) {
    lines.push('')
    lines.push('Tone modifiers (apply ALL of these):')
    lines.push(toneHints)
  }

  if (educationalActive) {
    lines.push('')
    lines.push('═══════════════════════════════════════════════════════════════')
    lines.push('EDUCATIONAL MODE — ON')
    lines.push('═══════════════════════════════════════════════════════════════')
    lines.push('The script MUST explain:')
    lines.push('- Why the problem actually happens (mechanism, not just "X is bad")')
    lines.push('- How one or two key ingredients work, named specifically')
    lines.push('- Why this product is different from the category default')
    lines.push('Explanations must sound conversational, like a creator explaining to a friend. Use analogies. NEVER use medical-textbook tone. NEVER claim to cure / treat / guarantee.')
  } else {
    lines.push('')
    lines.push('EDUCATIONAL MODE — OFF. Focus on emotional selling, fast hook, and direct conversion.')
  }

  lines.push('')
  lines.push('Generate the script following the preset framework above. Output BOTH the English voice-over AND the Malaysian Malay version, plus the structured JSON. Use the exact <<<ENGLISH>>> / <<<MALAY>>> / <<<STRUCTURED>>> markers.')

  return lines.join('\n')
}

// ── Parsing helpers ─────────────────────────────────────────────────────

function stripLabels(text: string): string {
  // Strip any leaked "Hook:" / "Pain:" / numbered section prefixes
  return text
    .split('\n')
    .map((line) =>
      line.replace(/^\s*[-*•]?\s*(?:Hook|Pain|Solution|Benefits|Proof|Demo|CTA|Cta|Section|Body|Intro|Outro|Script|Voice[- ]?over)\s*\d*\s*(?:\([^)]*\))?\s*:\s*/i, ''),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseStructured(raw: string): ScriptStructured | null {
  // Extract the JSON between <<<STRUCTURED>>> and end-of-string. Tolerant of
  // trailing whitespace, leading commentary, and ```json fences.
  const m = raw.match(/<<<STRUCTURED>>>\s*([\s\S]+?)\s*$/)
  if (!m) return null
  let body = m[1].trim()
  const fence = body.match(/```(?:json)?\s*([\s\S]+?)```/)
  if (fence) body = fence[1].trim()
  try {
    const parsed = JSON.parse(body) as ScriptStructured
    return parsed
  } catch {
    // Last resort: find the first {...} block
    const obj = body.match(/\{[\s\S]+\}/)
    if (!obj) return null
    try { return JSON.parse(obj[0]) as ScriptStructured } catch { return null }
  }
}

function parseResponse(raw: string): { english: string; malay: string; structured: ScriptStructured | null } {
  const englishMatch = raw.match(/<<<ENGLISH>>>([\s\S]*?)(?:<<<MALAY>>>|<<<STRUCTURED>>>|$)/)
  const malayMatch   = raw.match(/<<<MALAY>>>([\s\S]*?)(?:<<<STRUCTURED>>>|$)/)

  const english   = stripLabels(englishMatch?.[1]?.trim() ?? '')
  const malay     = stripLabels(malayMatch?.[1]?.trim() ?? '')
  const structured = parseStructured(raw)

  return { english, malay, structured }
}

function getGeminiKey(): string {
  const store = useSettingsStore.getState()
  if (!store.hasGeminiKey()) {
    throw new Error('Chưa có Google Gemini API key. Vào Cài đặt → Google Gemini → nhập key miễn phí từ aistudio.google.com')
  }
  return store.getGeminiApiKey()
}

// ── Main export ─────────────────────────────────────────────────────────

export async function generateUGCScript(params: ScriptGenerationParams): Promise<ScriptGenerationResult> {
  const apiKey = getGeminiKey()
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm — chọn lại từ Project')

  const preset = getPresetById(params.presetId)
  if (!preset) throw new Error(`Preset không hợp lệ: ${params.presetId}`)

  const userPrompt = buildUserPrompt(params, product)

  const raw = await directGeminiVision({
    apiKey,
    parts: [{ text: userPrompt }],
    systemInstruction: SYSTEM_PROMPT,
    maxOutputTokens: 4096,
  })

  const { english, malay, structured } = parseResponse(raw)

  if (!english || english.length < 30) {
    throw new Error('Gemini trả về kịch bản tiếng Anh quá ngắn — thử lại')
  }
  if (!malay || malay.length < 30) {
    throw new Error('Gemini không dịch được sang tiếng Malay — thử lại')
  }

  return {
    english,
    malay,
    structured,
    presetId: params.presetId,
    presetLabel: preset.label,
    lengthSec: params.lengthSec,
    hookStrength: params.hookStrength,
    toneModifiers: params.toneModifiers,
    educationalMode: params.educationalMode || preset.category === 'educational',
  }
}

// Re-export so call sites only need to import from this module.
export type { ScriptGenerationParams, ScriptGenerationResult, ToneModifier, HookStrength, LengthSeconds }
