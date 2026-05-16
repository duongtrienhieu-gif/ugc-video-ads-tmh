// ── OpenAI Image Generation (gpt-image-1) ────────────────────────────────────
// Model: gpt-image-1 — state-of-the-art photorealistic image generation
// Powers ChatGPT image creation. Far more realistic than FLUX/PuLID for UGC.
//
// Key advantages over fal.ai FLUX Ultra:
//   - Zero "plastic/AI" artifacts — renders like a real photo
//   - Follows complex scene + action prompts precisely
//   - No reference image needed — character described fully in text
//   - Product accuracy: describe product and it renders it correctly
//
// Pricing: ~$0.04/image (low) · $0.07/image (medium) · $0.19/image (high)
// API: POST https://api.openai.com/v1/images/generations

const OPENAI_BASE = 'https://api.openai.com/v1'

interface OpenAIErrorBody {
  error?: { message?: string; code?: string; type?: string }
}

interface OpenAIImageResponse {
  data?: Array<{
    b64_json?: string
    url?: string
    revised_prompt?: string
  }>
  error?: { message: string; code: string }
}

async function readOpenAIError(res: Response): Promise<string> {
  try {
    const text = await res.text()
    try {
      const json = JSON.parse(text) as OpenAIErrorBody
      return (json.error?.message ?? text).slice(0, 300)
    } catch {
      return text.slice(0, 300)
    }
  } catch {
    return res.statusText
  }
}

/**
 * Generate a B-roll image using OpenAI gpt-image-1.
 *
 * Returns either:
 *   - data:image/png;base64,... (when response is b64_json)
 *   - https://... CDN URL (when response is url)
 *
 * Callers should save the result to IndexedDB for persistence.
 */
export async function generateBrollImageGPT(params: {
  apiKey: string
  prompt: string
  quality?: 'low' | 'medium' | 'high'
  size?: '1024x1024' | '1024x1536' | '1536x1024'
}): Promise<string> {
  const res = await fetch(`${OPENAI_BASE}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model:   'gpt-image-1',
      prompt:  params.prompt,
      n:       1,
      size:    params.size    ?? '1024x1536',  // portrait ~2:3, closest to 9:16
      quality: params.quality ?? 'medium',      // medium = best quality/cost ratio
    }),
  })

  if (res.status === 401 || res.status === 403) {
    throw new Error('OpenAI API key không hợp lệ — kiểm tra Cài đặt')
  }
  if (res.status === 402) {
    throw new Error('Tài khoản OpenAI hết quota — nạp thêm tại platform.openai.com')
  }
  if (res.status === 429) {
    throw new Error('OpenAI rate limit — chờ vài giây rồi thử lại')
  }
  if (!res.ok) {
    const detail = await readOpenAIError(res)
    throw new Error(`OpenAI lỗi (${res.status}): ${detail}`)
  }

  const data = await res.json() as OpenAIImageResponse

  // Handle both b64_json and url response formats
  const b64 = data.data?.[0]?.b64_json
  const url = data.data?.[0]?.url

  if (b64) return `data:image/png;base64,${b64}`
  if (url) return url
  throw new Error('OpenAI không trả về ảnh — thử lại')
}

/**
 * Quick connectivity test — sends a tiny 1024x1024 low-quality generation.
 * Returns credits/quota info if available.
 */
export async function testOpenAIConnection(apiKey: string): Promise<string> {
  const res = await fetch(`${OPENAI_BASE}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (res.status === 401 || res.status === 403) {
    throw new Error('API key không hợp lệ hoặc không có quyền truy cập')
  }
  if (!res.ok) {
    const detail = await readOpenAIError(res)
    throw new Error(`Lỗi kết nối (${res.status}): ${detail}`)
  }
  return 'Kết nối thành công — API key hợp lệ'
}
