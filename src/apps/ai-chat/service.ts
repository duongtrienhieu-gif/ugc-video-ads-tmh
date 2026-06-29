// ── Trợ lý AI — service: chat Gemini + GPT (one-shot, đa lượt) + tạo ảnh (kie) ──
// Gemini: gọi REST generateContent từ client (key trả phí của chủ). Ảnh + video gửi INLINE
//   base64 (không cần Files API/endpoint) — đủ cho ảnh và video NGẮN (< ~15MB).
// GPT: gọi api.openai.com/chat/completions trực tiếp (CORS OK). Nhận ẢNH (vision), KHÔNG video.
// Tạo ảnh: kie.ai generateImage + pollImageUntilDone (như các app khác).
import { generateImage, pollImageUntilDone, IMAGE_MODELS } from '../../utils/kieai'

export interface Attachment { kind: 'image' | 'video'; mime: string; dataUrl: string; name: string }
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  atts: Attachment[]        // file đính kèm (ảnh/video) — dataUrl rỗng nếu đã khôi phục từ lịch sử
  imageUrls: string[]       // ảnh AI tạo (URL remote)
  model?: 'gemini' | 'gpt'
  error?: boolean
}

function dataUrlParts(dataUrl: string): { mime: string; data: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  return m ? { mime: m[1], data: m[2] } : null
}

// ── Gemini (đa lượt, ảnh + video inline) ──
export async function geminiChat(apiKey: string, history: ChatMessage[]): Promise<string> {
  type Part = { text: string } | { inlineData: { mimeType: string; data: string } }
  const contents = history.map((m) => {
    const parts: Part[] = []
    for (const a of m.atts) {
      const p = dataUrlParts(a.dataUrl)
      if (p) parts.push({ inlineData: { mimeType: p.mime, data: p.data } })
    }
    if (m.text.trim()) parts.push({ text: m.text })
    if (!parts.length) parts.push({ text: '...' })
    return { role: m.role === 'assistant' ? 'model' : 'user', parts }
  })
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash']
  let lastErr = ''
  for (const model of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 4096 } }),
      })
      if (r.ok) {
        const d = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
        const txt = (d.candidates?.[0]?.content?.parts ?? []).map((p) => p.text).filter(Boolean).join('').trim()
        if (txt) return txt
        lastErr = 'Gemini trả phản hồi rỗng'
        continue
      }
      lastErr = `Gemini ${r.status}: ${(await r.text().catch(() => '')).slice(0, 160)}`
      if (r.status === 400 || r.status === 401 || r.status === 403) break
    } catch (e) { lastErr = (e as Error).message }
  }
  throw new Error(lastErr || 'Gemini lỗi không rõ')
}

// ── GPT (OpenAI chat completions — nhận ảnh, KHÔNG video) ──
export async function openaiChat(apiKey: string, history: ChatMessage[]): Promise<string> {
  type TextPart = { type: 'text'; text: string }
  type ImgPart = { type: 'image_url'; image_url: { url: string } }
  const messages = history.map((m) => {
    const imgs = m.atts.filter((a) => a.kind === 'image' && a.dataUrl.startsWith('data:'))
    if (m.role === 'user' && imgs.length) {
      const content: (TextPart | ImgPart)[] = []
      if (m.text.trim()) content.push({ type: 'text', text: m.text })
      for (const a of imgs) content.push({ type: 'image_url', image_url: { url: a.dataUrl } })
      return { role: m.role, content }
    }
    return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text || '...' }
  })
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o', messages, temperature: 0.7, max_tokens: 2048 }),
  })
  if (!r.ok) {
    const t = (await r.text().catch(() => '')).slice(0, 200)
    if (r.status === 401) throw new Error('OpenAI API key sai/hết hạn — kiểm tra lại (key API, KHÔNG phải gói ChatGPT Go)')
    if (r.status === 429) throw new Error('OpenAI hết credit/giới hạn — nạp tiền tại platform.openai.com')
    throw new Error(`OpenAI ${r.status}: ${t}`)
  }
  const d = (await r.json()) as { choices?: { message?: { content?: string } }[] }
  return d.choices?.[0]?.message?.content?.trim() ?? '(không có nội dung)'
}

// ── Tạo ảnh (kie.ai) ──
export async function genImage(kieApiKey: string, prompt: string, aspectRatio = '1:1'): Promise<string> {
  const model = IMAGE_MODELS[0].id   // Nano Banana 2 — mặc định ổn định
  const { taskId } = await generateImage({ apiKey: kieApiKey, model, prompt, resolution: '1K', aspectRatio })
  return pollImageUntilDone({ apiKey: kieApiKey, taskId, timeoutMs: 3 * 60 * 1000 })
}
