import type { EditableProductContext, AdaptScriptResult } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { directGeminiVision } from '../../../utils/gemini'

// ── System instruction ────────────────────────────────────────────────────────

const ADAPT_SYSTEM = `You are a UGC script adapter and translator.
Your job: take the template script, rewrite it for a new product (English), then translate that result to Malaysian Malay.

Rules for adaptation:
- Keep the EXACT same structure, line count, and format
- REMOVE any "Hook:" / "Script:" / section labels from the template — output plain content only, no labels, no markers
- Keep the same sentence rhythm and conversational tone
- Replace ALL product-specific content (name, features, pain points, benefits, offer, CTA) with the new product's info
- Sound natural and authentic — like a real person speaking on camera

Rules for translation:
- Translate to natural Malaysian Malay (Bahasa Malaysia), colloquial and authentic — like a real Malaysian speaking on camera
- Do NOT include any "Hook:" / "Script:" / section labels in the output
- Preserve the same line breaks and structure as the English version

Output format — use EXACTLY these two markers, nothing else:
<<<ENGLISH>>>
[full adapted English script here]
<<<MALAY>>>
[full Malaysian Malay translation here]`

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(template: string, context: EditableProductContext): string {
  const lines: string[] = []
  lines.push(`TEMPLATE SCRIPT (keep this exact structure and line count):\n${template}`)
  lines.push(`\nNEW PRODUCT INFO:`)
  if (context.productDescription) lines.push(`Product: ${context.productDescription}`)
  if (context.targetMarket) lines.push(`Audience: ${context.targetMarket}`)
  if (context.painPoints) lines.push(`Pain points: ${context.painPoints}`)
  if (context.usps) lines.push(`USPs: ${context.usps}`)
  if (context.benefits) lines.push(`Benefits: ${context.benefits}`)
  if (context.offer) lines.push(`Offer: ${context.offer}`)
  if (context.cta) lines.push(`CTA: ${context.cta}`)
  lines.push(`\nAdapt the template for this product in English, then translate to Malaysian Malay. Follow the output format exactly.`)
  return lines.join('\n')
}

// ── Key helper ────────────────────────────────────────────────────────────────

function getGeminiKey(): string {
  const store = useSettingsStore.getState()
  if (!store.hasGeminiKey()) {
    throw new Error('Chưa có Google Gemini API key. Vào Cài đặt → Google Gemini → nhập key miễn phí từ aistudio.google.com')
  }
  return store.getGeminiApiKey()
}

// ── Parse response ────────────────────────────────────────────────────────────

/**
 * Strip "Hook:" / "Script:" / "Section:" / numbered labels from any line.
 * Belt-and-suspenders cleanup in case Gemini ignores the system instruction.
 */
function stripSectionLabels(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      // Remove labels like "Hook:", "Script:", "Hook 1:", "Script (intro):"
      // Match optional bullet/dash/number prefix, then label, then colon
      return line.replace(/^\s*[-*•]?\s*(?:Hook|Script|Section|Body|Intro|Outro|CTA|Cta)\s*\d*\s*(?:\([^)]*\))?\s*:\s*/i, '')
    })
    .join('\n')
    // Collapse 3+ consecutive blank lines into 2
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseResponse(raw: string): { english: string; malay: string } {
  const englishMatch = raw.match(/<<<ENGLISH>>>([\s\S]*?)(?:<<<MALAY>>>|$)/)
  const malayMatch   = raw.match(/<<<MALAY>>>([\s\S]*)$/)

  let english = (englishMatch?.[1] ?? '').trim()
  let malay   = (malayMatch?.[1]  ?? '').trim()

  // Fallback: if markers not found, try splitting on blank line heuristic
  if (!english && !malay) {
    const lines = raw.split('\n')
    const half  = Math.floor(lines.length / 2)
    english = lines.slice(0, half).join('\n').trim()
    malay   = lines.slice(half).join('\n').trim()
  }

  // Strip Hook:/Script: labels post-hoc (Gemini sometimes ignores instruction)
  english = stripSectionLabels(english)
  malay   = stripSectionLabels(malay)

  return { english, malay }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Single Gemini call: adapt template script for new product (English)
 * + translate to Malaysian Malay simultaneously.
 * Using maxOutputTokens: 16384 to prevent truncation on long scripts.
 */
export async function adaptAndTranslate(
  template: string,
  context: EditableProductContext,
): Promise<AdaptScriptResult> {
  const apiKey = getGeminiKey()

  const raw = await directGeminiVision({
    apiKey,
    parts: [{ text: buildPrompt(template, context) }],
    systemInstruction: ADAPT_SYSTEM,
    maxOutputTokens: 16384,   // was 2048 — prevents mid-script cutoff
  })

  const { english, malay } = parseResponse(raw)

  // Validate we got something meaningful back
  if (!english || english.length < 50) {
    throw new Error('Gemini trả về kịch bản quá ngắn — thử lại hoặc rút gọn kịch bản mẫu')
  }
  if (!malay || malay.length < 50) {
    throw new Error('Gemini không dịch được sang tiếng Malay — thử lại')
  }

  return { vietnamese: english, malay }
}
