// ── Trợ lý AI — service: chat Gemini + GPT (STREAMING) + tạo ảnh (kie) ──
// Gemini: REST streamGenerateContent (SSE) từ client. Ảnh + video gửi INLINE base64
//   (ảnh + video NGẮN < ~15MB). GPT: api.openai.com chat/completions stream (CORS OK),
//   nhận ẢNH (vision), KHÔNG video; chọn gpt-4o (đỉnh) hoặc gpt-4o-mini (rẻ).
// Tạo ảnh: kie.ai generateImage + pollImageUntilDone.
import { generateImage, pollImageUntilDone, IMAGE_MODELS } from '../../utils/kieai'
import { APP_HANDBOOK } from './handbook'

export type GptModel = 'gpt-4o' | 'gpt-4o-mini'
export interface Attachment { kind: 'image' | 'video'; mime: string; dataUrl: string; name: string }
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  atts: Attachment[]
  imageUrls: string[]
  model?: 'gemini' | 'gpt'
  error?: boolean
}

// Quy tắc CHỐNG CHAT SAI: chỉ trả lời về app dựa trên cẩm nang; không có → nói không biết.
const GROUNDING = `

QUAN TRỌNG — BẠN LÀ TRỢ LÝ ĐA NĂNG: trả lời MỌI chủ đề (đời sống, kiến thức, viết lách, dịch, lập trình, tâm sự…) tự nhiên và đầy đủ như Gemini/ChatGPT thông thường. Cẩm nang app UGC Lab bên dưới CHỈ LÀ KIẾN THỨC BỔ SUNG — chỉ dùng khi câu hỏi LIÊN QUAN tới app. TUYỆT ĐỐI KHÔNG ép mọi câu hỏi về app, KHÔNG từ chối câu hỏi ngoài app, KHÔNG nhắc tới cẩm nang khi không cần.

═══ CẨM NANG APP UGC LAB (chỉ dùng khi hỏi về app) ═══
Khi hỏi về APP/tính năng UGC Lab (làm việc X thì vào app nào, cách dùng, các bước, tên nút, cần key gì), CHỈ trả lời dựa trên cẩm nang dưới đây. Nếu cẩm nang KHÔNG có thông tin → nói thẳng "Mình chưa có thông tin chính xác về cái đó, bạn hỏi quản lý nhé" — KHÔNG bịa bước/tính năng/tên nút/giá.

${APP_HANDBOOK}`
const GEMINI_SYS = `Bạn là Trợ lý AI chạy trên Google Gemini, hỗ trợ nhân viên team marketing & bán hàng của TMH GROUP. Trả lời bằng tiếng Việt, ngắn gọn, chính xác, hữu ích. Khi được hỏi bạn là ai/model gì, nói rõ bạn là Gemini (Google) — KHÔNG nhận mình là GPT dù lịch sử có nhắc tới.${GROUNDING}`
const GPT_SYS = `Bạn là Trợ lý AI chạy trên OpenAI GPT, hỗ trợ nhân viên team marketing & bán hàng của TMH GROUP. Trả lời bằng tiếng Việt, ngắn gọn, chính xác, hữu ích. Khi được hỏi bạn là ai/model gì, nói rõ bạn là GPT (OpenAI) — KHÔNG nhận mình là Gemini dù lịch sử có nhắc tới.${GROUNDING}`

function dataUrlParts(dataUrl: string): { mime: string; data: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  return m ? { mime: m[1], data: m[2] } : null
}

// ── Payload builders (dùng chung stream) ──
type GPart = { text: string } | { inlineData: { mimeType: string; data: string } }
function buildGeminiContents(history: ChatMessage[]) {
  return history.map((m) => {
    const parts: GPart[] = []
    for (const a of m.atts) { const p = dataUrlParts(a.dataUrl); if (p) parts.push({ inlineData: { mimeType: p.mime, data: p.data } }) }
    if (m.text.trim()) parts.push({ text: m.text })
    if (!parts.length) parts.push({ text: '...' })
    return { role: m.role === 'assistant' ? 'model' : 'user', parts }
  })
}
type OTextPart = { type: 'text'; text: string }
type OImgPart = { type: 'image_url'; image_url: { url: string } }
function buildOpenAiMessages(history: ChatMessage[]) {
  return history.map((m) => {
    const imgs = m.atts.filter((a) => a.kind === 'image' && a.dataUrl.startsWith('data:'))
    if (m.role === 'user' && imgs.length) {
      const content: (OTextPart | OImgPart)[] = []
      if (m.text.trim()) content.push({ type: 'text', text: m.text })
      for (const a of imgs) content.push({ type: 'image_url', image_url: { url: a.dataUrl } })
      return { role: 'user', content }
    }
    return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text || '...' }
  })
}

// ── Đọc SSE: gom 'data:' lines → trích mẩu chữ → onDelta + cộng dồn ──
async function readSSE(res: Response, extract: (j: unknown) => string, onDelta: (s: string) => void): Promise<string> {
  if (!res.body) throw new Error('Không mở được luồng phản hồi')
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''; let full = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      const t = line.trim()
      if (!t.startsWith('data:')) continue
      const p = t.slice(5).trim()
      if (!p || p === '[DONE]') continue
      try { const piece = extract(JSON.parse(p)); if (piece) { full += piece; onDelta(piece) } } catch { /* mẩu chưa đủ — bỏ qua */ }
    }
  }
  return full
}
const extractGemini = (j: unknown): string =>
  ((j as { candidates?: { content?: { parts?: { text?: string }[] } }[] }).candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text).filter(Boolean).join('')
const extractOpenAi = (j: unknown): string =>
  (j as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content ?? ''

// ── Gemini streaming (đa lượt, ảnh + video) ──
export async function geminiChatStream(apiKey: string, history: ChatMessage[], onDelta: (s: string) => void): Promise<string> {
  const contents = buildGeminiContents(history)
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash']
  let lastErr = ''
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, systemInstruction: { parts: [{ text: GEMINI_SYS }] }, generationConfig: { temperature: 0.7, maxOutputTokens: 4096 } }),
      })
      if (!res.ok) {
        lastErr = `Gemini ${res.status}: ${(await res.text().catch(() => '')).slice(0, 150)}`
        if (res.status === 400 || res.status === 401 || res.status === 403) break
        continue
      }
      const full = await readSSE(res, extractGemini, onDelta)
      if (full.trim()) return full
      lastErr = 'Gemini phản hồi rỗng'
    } catch (e) { lastErr = (e as Error).message }
  }
  throw new Error(lastErr || 'Gemini lỗi không rõ')
}

// ── GPT streaming (nhận ảnh, KHÔNG video) ──
export async function openaiChatStream(apiKey: string, model: GptModel, history: ChatMessage[], onDelta: (s: string) => void): Promise<string> {
  const messages = [{ role: 'system', content: GPT_SYS }, ...buildOpenAiMessages(history)]
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 2048, stream: true }),
  })
  if (!res.ok) {
    const t = (await res.text().catch(() => '')).slice(0, 200)
    if (res.status === 401) throw new Error('OpenAI API key sai/hết hạn (key API ở platform.openai.com, KHÔNG phải gói ChatGPT Go)')
    if (res.status === 429) throw new Error('OpenAI hết credit/giới hạn — nạp tiền tại platform.openai.com → Billing')
    throw new Error(`OpenAI ${res.status}: ${t}`)
  }
  return readSSE(res, extractOpenAi, onDelta)
}

// ── Tạo ảnh (kie.ai) ──
export async function genImage(kieApiKey: string, prompt: string, aspectRatio = '1:1'): Promise<string> {
  const model = IMAGE_MODELS[0].id
  const { taskId } = await generateImage({ apiKey: kieApiKey, model, prompt, resolution: '1K', aspectRatio })
  return pollImageUntilDone({ apiKey: kieApiKey, taskId, timeoutMs: 3 * 60 * 1000 })
}
