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
 * Edit/transform an image using OpenAI gpt-image-1 via the /v1/images/edits endpoint.
 * Pass one or more reference images — the model will preserve identity from them
 * while applying the prompt transformation. Stronger identity-lock than text-only.
 *
 * Use cases:
 *   - Generate face angle variants (pass avatar photo, prompt new angle)
 *   - Place a specific product into a scene (pass product photo)
 *
 * Returns base64 data URL — save to asset store for persistent URL.
 */
export async function editImageWithReferenceGPT(params: {
  apiKey: string
  prompt: string
  /** Reference images as Blobs (will be uploaded as multipart). First is primary. */
  referenceImages: Blob[]
  quality?: 'low' | 'medium' | 'high'
  size?: '1024x1024' | '1024x1536' | '1536x1024'
}): Promise<string> {
  const formData = new FormData()
  formData.append('model', 'gpt-image-1')
  formData.append('prompt', params.prompt)
  formData.append('n', '1')
  formData.append('size', params.size ?? '1024x1536')
  formData.append('quality', params.quality ?? 'medium')

  // Multiple reference images: gpt-image-1 supports up to 16 via image[] field
  for (let i = 0; i < params.referenceImages.length; i++) {
    const blob = params.referenceImages[i]
    const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
    formData.append('image[]', blob, `ref-${i}.${ext}`)
  }

  const res = await fetch(`${OPENAI_BASE}/images/edits`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      // Do NOT set Content-Type — browser fills boundary automatically
    },
    body: formData,
  })

  if (res.status === 401 || res.status === 403) {
    throw new Error('OpenAI API key không hợp lệ — kiểm tra Cài đặt')
  }
  if (res.status === 402) {
    throw new Error('Tài khoản OpenAI hết quota — nạp tại platform.openai.com/account/billing')
  }
  if (res.status === 429) {
    throw new Error('OpenAI rate limit — chờ vài giây rồi thử lại')
  }
  if (!res.ok) {
    const detail = await readOpenAIError(res)
    throw new Error(`OpenAI edits lỗi (${res.status}): ${detail}`)
  }

  const data = await res.json() as OpenAIImageResponse
  const b64 = data.data?.[0]?.b64_json
  const url = data.data?.[0]?.url
  if (b64) return `data:image/png;base64,${b64}`
  if (url) return url
  throw new Error('OpenAI edits không trả về ảnh — thử lại')
}

/**
 * Helper to fetch an image URL (data: / https: / blob:) and return a Blob.
 * Useful for converting reference image URLs into multipart-uploadable Blobs.
 */
export async function fetchImageAsBlob(url: string): Promise<Blob> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Không tải được ảnh tham chiếu (${res.status})`)
  return await res.blob()
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
