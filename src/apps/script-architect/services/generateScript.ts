import type { GenerateScriptInput, GeneratedVariants } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { directGeminiVision } from '../../../utils/gemini'
import { blobToSmallBase64 } from '../../../utils/kieai'

const SYSTEM = `You write UGC video scripts for social media ads.
Output exactly 2 scripts using this format:

---SCRIPT 1---
Hook: <one strong opening sentence>
<script body, one sentence per line>

---SCRIPT 2---
Hook: <different hook angle>
<script body, one sentence per line>

Rules: English only. Conversational, authentic tone. No stage directions, no brackets. Start immediately with ---SCRIPT 1---.`

function buildUserPrompt(input: GenerateScriptInput): string {
  const lines: string[] = []
  if (input.winningTranscript) {
    lines.push(`Reference script (use as style inspiration):\n${input.winningTranscript}`)
  }
  if (input.productContext) {
    const p = input.productContext
    if (p.productDescription) lines.push(`Product: ${p.productDescription}`)
    if (p.targetMarket) lines.push(`Audience: ${p.targetMarket}`)
    if (p.painPoints) lines.push(`Pain points: ${p.painPoints}`)
    if (p.usps) lines.push(`USPs: ${p.usps}`)
    if (p.benefits) lines.push(`Benefits: ${p.benefits}`)
    if (p.offer) lines.push(`Offer: ${p.offer}`)
    if (p.cta) lines.push(`CTA: ${p.cta}`)
  }
  lines.push('Write 2 UGC scripts now.')
  return lines.join('\n')
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }

function buildParts(input: GenerateScriptInput): GeminiPart[] {
  const parts: GeminiPart[] = []
  if (input.attachedImage) {
    parts.push({ inlineData: { mimeType: input.attachedImage.mimeType, data: input.attachedImage.base64 } })
  }
  parts.push({ text: buildUserPrompt(input) })
  return parts
}

function parseScripts(raw: string): string[] {
  const text = raw.trim()

  // Primary: ---SCRIPT N--- separators
  const parts = text.split(/---\s*SCRIPT\s*\d+\s*---/i).map((p) => p.trim()).filter((p) => p.length > 20)
  if (parts.length >= 1) {
    return parts.slice(0, 2).map((part) => {
      const hookMatch = part.match(/^Hook:\s*(.+)/im)
      const hook = hookMatch?.[1]?.trim() ?? ''
      const body = part.replace(/^Hook:\s*.+\n?/im, '').trim()
      return hook && body ? `Hook:\n${hook}\n\nScript:\n${body}` : part
    })
  }

  // Fallback: split on double blank lines
  const chunks = text.split(/\n{2,}/).filter((c) => c.trim().length > 30)
  if (chunks.length >= 2) return chunks.slice(0, 2)
  if (text.length > 30) return [text]
  return []
}

export async function generateScript(input: GenerateScriptInput): Promise<GeneratedVariants> {
  const store = useSettingsStore.getState()
  if (!store.hasGeminiKey()) {
    throw new Error('Chưa có Google Gemini API key. Vào Cài đặt → Google Gemini → nhập key miễn phí từ aistudio.google.com')
  }
  const geminiKey = store.getGeminiApiKey()
  const parts = buildParts(input)
  const responseText = await directGeminiVision({ apiKey: geminiKey, parts, systemInstruction: SYSTEM, maxOutputTokens: 2048 })
  const variants = parseScripts(responseText)
  if (variants.length === 0) {
    console.error('[generateScript] parse failed, raw:', responseText)
    throw new Error('AI không trả về kịch bản hợp lệ. Vui lòng thử lại.')
  }
  return { variants }
}

export async function translateToMalay(scriptText: string): Promise<string> {
  const store = useSettingsStore.getState()
  if (!store.hasGeminiKey()) throw new Error('Cần Google Gemini API key để dịch')
  const geminiKey = store.getGeminiApiKey()
  return directGeminiVision({
    apiKey: geminiKey,
    parts: [{
      text: `Translate this UGC ad script to natural Malaysian Malay (Bahasa Malaysia). Colloquial, authentic — like a real Malaysian speaking on camera. Keep "Hook:" / "Script:" labels in English, translate everything else. Return ONLY the translation.\n\n${scriptText}`,
    }],
  })
}

export { blobToSmallBase64 }
