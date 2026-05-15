import type { GenerateScriptInput, GeneratedVariants } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { blobToSmallBase64 } from '../../../utils/kieai'

// Short system prompt — fewer tokens = faster response
const SYSTEM = `You write UGC video scripts for social media ads.
Output exactly 2 scripts using this format (nothing else):

---SCRIPT 1---
Hook: <one strong opening sentence>
<script body, one sentence per line>

---SCRIPT 2---
Hook: <different hook angle>
<script body, one sentence per line>

Rules: English only. Conversational, authentic tone. No stage directions, no brackets. Start immediately with ---SCRIPT 1---.`

// Minimal direct call — gpt-4o-mini first (fastest), then gpt-4o fallback
async function callKie(apiKey: string, messages: { role: string; content: unknown }[]): Promise<string> {
  const models = ['gpt-4o-mini', 'gpt-4o']
  const TIMEOUT = 35_000
  const errors: string[] = []

  for (const model of models) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT)
    try {
      const res = await fetch('https://api.kie.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages }),
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (res.status === 402) throw new Error('INSUFFICIENT_CREDITS')
      if (!res.ok) { errors.push(`${model}: HTTP ${res.status}`); continue }

      const data = await res.json() as { choices?: { message?: { content?: string | null } }[] }
      const content = data.choices?.[0]?.message?.content?.trim() ?? ''
      if (content) { console.log(`[script] ${model} OK`); return content }
      errors.push(`${model}: empty response`)
    } catch (e) {
      clearTimeout(timer)
      if (e instanceof Error && e.message === 'INSUFFICIENT_CREDITS') throw e
      const msg = e instanceof Error && e.name === 'AbortError' ? `timeout ${TIMEOUT / 1000}s` : String(e)
      errors.push(`${model}: ${msg}`)
      console.warn(`[script] ${model} failed:`, msg)
    }
  }

  throw new Error(`Kie.ai không phản hồi: ${errors.join(' | ')}`)
}

function buildMessages(input: GenerateScriptInput): { role: string; content: unknown }[] {
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

  const userText = lines.join('\n')

  const system = { role: 'system', content: SYSTEM }

  if (input.attachedImage) {
    return [
      system,
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${input.attachedImage.mimeType};base64,${input.attachedImage.base64}` } },
          { type: 'text', text: userText },
        ],
      },
    ]
  }

  return [system, { role: 'user', content: userText }]
}

function parseScripts(raw: string): string[] {
  const text = raw.trim()

  // Primary: split on ---SCRIPT N--- separators
  const parts = text.split(/---\s*SCRIPT\s*\d+\s*---/i).map((p) => p.trim()).filter((p) => p.length > 20)
  if (parts.length >= 1) {
    return parts.slice(0, 2).map((part) => {
      const hookMatch = part.match(/^Hook:\s*(.+)/im)
      const hook = hookMatch?.[1]?.trim() ?? ''
      const body = part.replace(/^Hook:\s*.+\n?/im, '').trim()
      if (hook && body) return `Hook:\n${hook}\n\nScript:\n${body}`
      return part
    })
  }

  // Fallback: if AI ignored the separator, split on blank lines into 2 chunks
  const chunks = text.split(/\n{2,}/).filter((c) => c.trim().length > 30)
  if (chunks.length >= 2) return chunks.slice(0, 2)
  if (chunks.length === 1) return [chunks[0]]

  // Last resort: return the whole response as one script
  if (text.length > 30) return [text]
  return []
}

export async function generateScript(input: GenerateScriptInput): Promise<GeneratedVariants> {
  const kieKey = useSettingsStore.getState().getApiKey()
  const messages = buildMessages(input)
  const responseText = await callKie(kieKey, messages)
  const variants = parseScripts(responseText)
  if (variants.length === 0) {
    console.error('[generateScript] parse failed, raw:', responseText)
    throw new Error('AI không trả về kịch bản hợp lệ. Vui lòng thử lại.')
  }
  return { variants }
}

export async function translateToMalay(scriptText: string): Promise<string> {
  const kieKey = useSettingsStore.getState().getApiKey()
  const messages = [
    {
      role: 'user',
      content: `Translate this UGC ad script to natural Malaysian Malay (Bahasa Malaysia). Colloquial, authentic — like a real Malaysian speaking on camera. Keep "Hook:" / "Script:" labels in English, translate everything else. Return ONLY the translation.\n\n${scriptText}`,
    },
  ]
  const result = await callKie(kieKey, messages)
  return result
}

// Re-export blobToSmallBase64 so InputPanel can still import it from here if needed
export { blobToSmallBase64 }
