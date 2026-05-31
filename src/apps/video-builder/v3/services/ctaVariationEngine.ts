// ── CTA Variation Engine ─────────────────────────────────────────────────────
// Z35 §5 — Generate 5 alternate CTAs for the active script. Reuses the
// Phase 2 Gemini wiring + JSON-mode response so output is parse-safe.
//
// Why a separate engine vs Phase 2's hookVariants?
//   • Phase 2 hookVariants run at script-GENERATION time (3 hooks come
//     bundled with the main script JSON).
//   • Phase 6 ctaVariations run AFTER the script is locked — user is
//     iterating on closer only, not re-rolling the whole script.
//   • Lets us tune the prompt with the existing script as context for
//     better continuity ("CTA must flow from the PAIN/BENEFIT blocks
//     the user already approved").
// ─────────────────────────────────────────────────────────────────────────────

import { directGeminiText } from '../../../../utils/gemini'
import type {
  GeneratedScript, CtaVariation, CtaVariantStyle, ScriptLang,
} from '../types'
import { SCRIPT_LANG_GEMINI_NAME, DEFAULT_SCRIPT_LANG } from '../types'
import { estimateReadDurationSec } from './voiceTimingEstimator'

const CTA_STYLES: CtaVariantStyle[] = [
  'soft', 'urgency', 'promo', 'emotional', 'testimonial',
]

const CTA_STYLE_LABEL_EN: Record<CtaVariantStyle, string> = {
  soft:        'soft inviting close — gentle, low-pressure',
  urgency:     'urgency / time-pressure close — "today only", "stock running out"',
  promo:       'promo / discount close — specific number, dollar saving, code',
  emotional:   'emotional close — about the LIFE change, not the product',
  testimonial: 'testimonial close — quotes a real-feeling user reaction',
}

export interface GenerateCtaVariationsParams {
  geminiKey: string
  script: GeneratedScript
  productName: string
  /** Optional creator vibe — keeps voice consistent with the rest of the ad */
  creatorDescription?: string
  /** Output language of the locked script — CTAs MUST be written 100% in this
   *  language (no cross-language leakage). Defaults to the app default lang. */
  outputLang?: ScriptLang
}

export async function generateCtaVariations(
  params: GenerateCtaVariationsParams,
): Promise<CtaVariation[]> {
  const lang = SCRIPT_LANG_GEMINI_NAME[params.outputLang ?? DEFAULT_SCRIPT_LANG]

  const systemInstruction =
    `You are a TikTok-native ad copywriter generating CTA ALTERNATIVES in ${lang}.\n\n` +
    `Output exactly 5 alternate closing lines for the script below. Each line is ` +
    `1-2 spoken sentences (5-15 words total, FAST punchy TikTok-native).\n\n` +
    `Style mapping (one variant per style, in this exact order):\n` +
    CTA_STYLES.map((s, i) => `  ${i + 1}. ${s} — ${CTA_STYLE_LABEL_EN[s]}`).join('\n') +
    `\n\nRules:\n` +
    `- Write spoken language, NOT marketing copy.\n` +
    `- NO corporate phrases ("learn more", "find out", "click below").\n` +
    `- Write in the casual, everyday spoken register of ${lang}, using the natural ` +
    `filler words and closing phrases (the equivalent of "trust me", "link below", ` +
    `"this changed mine") native to ${lang}. Write 100% in ${lang} only — do NOT ` +
    `borrow words or phrasing from any other language.\n` +
    `- Each variant should FEEL different — don't produce 5 close paraphrases.\n` +
    `- Reference the product naturally (or just imply it).\n\n` +
    `OUTPUT FORMAT — strict JSON, no markdown:\n` +
    `{\n  "variants": [\n` +
    CTA_STYLES.map((s) => `    { "style": "${s}", "text": "..." }`).join(',\n') +
    `\n  ]\n}`

  const userPrompt =
    `PRODUCT: ${params.productName}\n` +
    (params.creatorDescription ? `CREATOR: ${params.creatorDescription}\n` : '') +
    `\nSCRIPT CONTEXT (so the CTA flows from this):\n` +
    params.script.blocks.map((b) => `  [${b.id.toUpperCase()}] ${b.text}`).join('\n') +
    `\n\nGenerate the 5 CTA variants in JSON now.`

  const raw = await directGeminiText({
    apiKey: params.geminiKey,
    systemInstruction,
    prompt: userPrompt,
    maxOutputTokens: 1024,
    responseMimeType: 'application/json',
  })

  const parsed = parseAndValidate(raw)
  const now = Date.now()
  return parsed.variants.map((v) => ({
    style: v.style,
    text: v.text,
    estDurationSec: estimateReadDurationSec(v.text),
    generatedAt: now,
  }))
}

// ── Output validation ──────────────────────────────────────────────────

interface GeminiOutput {
  variants: Array<{ style: CtaVariantStyle; text: string }>
}

function parseAndValidate(raw: string): GeminiOutput {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()
    try {
      parsed = JSON.parse(cleaned)
    } catch (err) {
      throw new Error(
        `Gemini CTA variation output không phải JSON hợp lệ: ${err instanceof Error ? err.message : ''}`,
      )
    }
  }

  const obj = parsed as Partial<GeminiOutput>
  if (!obj?.variants || !Array.isArray(obj.variants)) {
    throw new Error('Gemini output thiếu mảng "variants".')
  }

  const valid = obj.variants
    .filter((v) =>
      v &&
      typeof v.text === 'string' &&
      typeof v.style === 'string' &&
      CTA_STYLES.includes(v.style as CtaVariantStyle),
    )
    .slice(0, 5) as Array<{ style: CtaVariantStyle; text: string }>

  if (valid.length === 0) {
    throw new Error('Gemini không trả về CTA variant hợp lệ.')
  }
  return { variants: valid }
}
