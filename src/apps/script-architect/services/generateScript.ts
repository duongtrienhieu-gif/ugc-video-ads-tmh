import type { EditableProductContext, AdaptScriptResult } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { directGeminiVision } from '../../../utils/gemini'

const ADAPT_SYSTEM = `You are a UGC script adapter.
Your job: take the template script and rewrite it for a new product.

Rules:
- Keep the EXACT same structure, line count, and format (including Hook:/Script: labels if present)
- Keep the same sentence rhythm and conversational tone
- Replace ALL product-specific content (name, features, pain points, benefits, offer, CTA) with the new product's info
- Sound natural and authentic — like a real person speaking on camera
- Output ONLY the adapted script. No explanation, no extra text.`

function buildAdaptPrompt(template: string, context: EditableProductContext): string {
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
  lines.push(`\nNow adapt the template for this product. Output only the script.`)
  return lines.join('\n')
}

function getGeminiKey(): string {
  const store = useSettingsStore.getState()
  if (!store.hasGeminiKey()) {
    throw new Error('Chưa có Google Gemini API key. Vào Cài đặt → Google Gemini → nhập key miễn phí từ aistudio.google.com')
  }
  return store.getGeminiApiKey()
}

async function adaptScript(template: string, context: EditableProductContext): Promise<string> {
  const apiKey = getGeminiKey()
  const text = await directGeminiVision({
    apiKey,
    parts: [{ text: buildAdaptPrompt(template, context) }],
    systemInstruction: ADAPT_SYSTEM,
    maxOutputTokens: 2048,
  })
  return text.trim()
}

async function translateToMalay(scriptText: string): Promise<string> {
  const apiKey = getGeminiKey()
  return directGeminiVision({
    apiKey,
    parts: [{
      text: `Translate this UGC ad script to natural Malaysian Malay (Bahasa Malaysia). Colloquial, authentic — like a real Malaysian speaking on camera. Keep "Hook:" / "Script:" labels in English, translate everything else. Return ONLY the translation.\n\n${scriptText}`,
    }],
  })
}

export async function adaptAndTranslate(
  template: string,
  context: EditableProductContext,
): Promise<AdaptScriptResult> {
  const vietnamese = await adaptScript(template, context)
  const malay = await translateToMalay(vietnamese)
  return { vietnamese, malay }
}
