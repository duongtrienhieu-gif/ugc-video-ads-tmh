// ── fal.ai API client ────────────────────────────────────────────────────────
// Models used in UGC Lab:
//   fal-ai/latentsync  — video-to-video lip-sync (ByteDance LatentSync)
//   Preserves the original video, re-syncs lips to match new audio.
//   Pricing: $0.20 up to 40s, then $0.005/s.

const FAL_QUEUE_BASE = 'https://queue.fal.run'

export interface LatentSyncResult {
  videoUrl: string
  contentType: string
  fileSize: number
}

interface FalQueueSubmitResponse {
  request_id: string
}

interface FalQueueStatusResponse {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | string
  queue_position?: number
  logs?: Array<{ message: string; level?: string; timestamp?: string }>
  error?: string
}

interface FalLatentSyncResultResponse {
  video?: {
    url: string
    content_type?: string
    file_size?: number
    file_name?: string
  }
  error?: string
}

function authHeader(apiKey: string): Record<string, string> {
  return { Authorization: `Key ${apiKey}` }
}

/**
 * Parse fal.ai error response bodies. fal.ai returns multiple shapes:
 *   1. { detail: "string message" }
 *   2. { detail: [{ loc, msg, type }, ...] }   ← FastAPI validation 422 errors
 *   3. { message: "..." } or { error: "..." }
 *   4. Plain text
 * The old code stringified the array → "[object Object]" — useless.
 */
async function readErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text()
    try {
      const json = JSON.parse(text) as {
        detail?: string | Array<{ loc?: string[]; msg?: string; type?: string; message?: string }>
        message?: string
        error?: string
      }

      // Case 2: array of validation errors → flatten to readable string
      if (Array.isArray(json.detail)) {
        return json.detail
          .map((e) => {
            const field = Array.isArray(e.loc) ? e.loc.slice(-2).join('.') : ''
            const msg   = e.msg ?? e.message ?? e.type ?? 'invalid'
            return field ? `${field}: ${msg}` : msg
          })
          .join(' · ')
          .slice(0, 300)
      }

      // Case 1, 3: scalar string fields
      if (typeof json.detail === 'string')  return json.detail.slice(0, 300)
      if (typeof json.message === 'string') return json.message.slice(0, 300)
      if (typeof json.error === 'string')   return json.error.slice(0, 300)

      // Fallback: stringify the whole body so it's never "[object Object]"
      return JSON.stringify(json).slice(0, 300)
    } catch {
      return text.slice(0, 300)
    }
  } catch {
    return res.statusText
  }
}

/** Submit a LatentSync video-to-video lip sync job. Returns request_id. */
export async function submitLatentSync(params: {
  apiKey: string
  videoUrl: string
  audioUrl: string
  guidanceScale?: number
  loopMode?: 'loop' | 'pingpong' | 'bounce'
  seed?: number | null
}): Promise<{ requestId: string }> {
  const res = await fetch(`${FAL_QUEUE_BASE}/fal-ai/latentsync`, {
    method: 'POST',
    headers: {
      ...authHeader(params.apiKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      video_url:     params.videoUrl,
      audio_url:     params.audioUrl,
      guidance_scale: params.guidanceScale ?? 1,
      loop_mode:     params.loopMode ?? 'loop',
      seed:          params.seed ?? null,
    }),
  })

  if (res.status === 401 || res.status === 403) {
    const detail = await readErrorBody(res)
    throw new Error(`fal.ai từ chối xác thực (${res.status}): ${detail}`)
  }
  if (res.status === 402) {
    throw new Error('Tài khoản fal.ai hết credit — nạp thêm tại fal.ai/dashboard')
  }
  if (!res.ok) {
    const detail = await readErrorBody(res)
    throw new Error(`fal.ai lỗi (${res.status}): ${detail}`)
  }

  const data = await res.json() as FalQueueSubmitResponse
  if (!data.request_id) throw new Error('fal.ai không trả về request_id')
  return { requestId: data.request_id }
}

/** Get current status of a LatentSync job. */
export async function getLatentSyncStatus(
  apiKey: string,
  requestId: string,
): Promise<FalQueueStatusResponse> {
  const res = await fetch(
    `${FAL_QUEUE_BASE}/fal-ai/latentsync/requests/${requestId}/status`,
    { headers: authHeader(apiKey) },
  )
  if (!res.ok) {
    const detail = await readErrorBody(res)
    throw new Error(`Kiểm tra trạng thái fal.ai thất bại (${res.status}): ${detail}`)
  }
  return await res.json() as FalQueueStatusResponse
}

/** Fetch final result of a completed LatentSync job. */
export async function getLatentSyncResult(
  apiKey: string,
  requestId: string,
): Promise<LatentSyncResult> {
  const res = await fetch(
    `${FAL_QUEUE_BASE}/fal-ai/latentsync/requests/${requestId}`,
    { headers: authHeader(apiKey) },
  )
  if (!res.ok) {
    const detail = await readErrorBody(res)
    throw new Error(`Lấy kết quả fal.ai thất bại (${res.status}): ${detail}`)
  }
  const data = await res.json() as FalLatentSyncResultResponse
  if (!data.video?.url) {
    throw new Error(data.error ?? 'fal.ai trả về không có video URL')
  }
  return {
    videoUrl:    data.video.url,
    contentType: data.video.content_type ?? 'video/mp4',
    fileSize:    data.video.file_size ?? 0,
  }
}

/** Poll a LatentSync job until completed/failed, returning the final video. */
export async function pollLatentSyncUntilDone(params: {
  apiKey: string
  requestId: string
  onStatusChange?: (status: string, queuePosition?: number) => void
  timeoutMs?: number
  intervalMs?: number
}): Promise<LatentSyncResult> {
  const timeout = params.timeoutMs ?? 20 * 60 * 1000  // 20 min
  const interval = params.intervalMs ?? 5000          // 5s
  const start = Date.now()

  let lastStatus = ''
  while (Date.now() - start < timeout) {
    const s = await getLatentSyncStatus(params.apiKey, params.requestId)
    if (s.status !== lastStatus) {
      lastStatus = s.status
      params.onStatusChange?.(s.status, s.queue_position)
    }

    if (s.status === 'COMPLETED') {
      return await getLatentSyncResult(params.apiKey, params.requestId)
    }
    if (s.status === 'FAILED') {
      throw new Error(s.error ?? 'fal.ai LatentSync thất bại — thử lại')
    }

    await new Promise((r) => setTimeout(r, interval))
  }
  throw new Error('TIMEOUT')
}

// ── FLUX 1.1 Pro Ultra (photorealistic B-roll image generation) ───────────────
// fal-ai/flux-pro/v1.1-ultra: State-of-the-art photorealism (9/10).
// Uses avatar face photo as image_url reference (soft identity guidance ~0.2)
// combined with detailed scene prompt. raw: true = natural photo mode.
//
// Trade-off vs flux-pulid:
//   - flux-pulid: face lock ~85% but plastic/AI look
//   - flux-ultra: photorealism ~9/10, face guidance ~70% (uses image reference)
//
// Pricing: ~$0.06/image at 9:16.

interface FalImageResult {
  images?: Array<{ url: string; content_type?: string; width?: number; height?: number }>
  error?: string
}

interface FalFluxUltraResult {
  images?: Array<{ url: string; content_type?: string; width?: number; height?: number }>
  seed?: number
  error?: string
}

/**
 * Generate a photorealistic B-roll image using FLUX 1.1 Pro Ultra.
 * Passes avatar face photo as image_url (soft reference) + scene prompt.
 * raw: true enables natural photography mode (no AI-look).
 */
export async function generateInstantIDImage(params: {
  apiKey: string
  faceImageUrl: string          // avatar face reference for identity guidance
  prompt: string                // scene description (FIRST in prompt)
  negativePrompt?: string
  /** 0-1, default 0.15. How strongly to follow the reference image vs prompt. */
  identityStrength?: number
  /** Aspect ratio — flux-ultra uses enum string, not {width,height}. */
  imageSize?: { width: number; height: number }  // kept for API compat, ignored internally
  /** Optional callback for status updates during polling. */
  onStatusChange?: (status: string) => void
  timeoutMs?: number
}): Promise<string> {
  // ── Submit to FLUX 1.1 Pro Ultra queue ───────────────────────────────
  const requestBody: Record<string, unknown> = {
    prompt:                 params.prompt,
    image_url:              params.faceImageUrl,           // avatar as soft identity reference
    image_prompt_strength:  params.identityStrength ?? 0.15, // low = scene-driven, high = image-driven
    aspect_ratio:           '9:16',
    output_format:          'jpeg',
    num_images:             1,
    raw:                    true,   // natural photo mode — no AI artifacts
    safety_tolerance:       6,      // max tolerance for diverse content
  }

  const submitRes = await fetch(`${FAL_QUEUE_BASE}/fal-ai/flux-pro/v1.1-ultra`, {
    method: 'POST',
    headers: {
      ...authHeader(params.apiKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (submitRes.status === 401 || submitRes.status === 403) {
    throw new Error('fal.ai API key không hợp lệ — kiểm tra Cài đặt')
  }
  if (submitRes.status === 402) {
    throw new Error('Tài khoản fal.ai hết credit — nạp tại fal.ai/dashboard')
  }
  if (!submitRes.ok) {
    const detail = await readErrorBody(submitRes)
    throw new Error(`fal.ai FLUX Ultra submit lỗi (${submitRes.status}): ${detail}`)
  }
  const { request_id } = await submitRes.json() as FalQueueSubmitResponse
  if (!request_id) throw new Error('fal.ai không trả về request_id cho FLUX Ultra')

  // ── Poll for completion ────────────────────────────────────────────────
  const timeout  = params.timeoutMs ?? 4 * 60 * 1000
  const interval = 4000
  const start    = Date.now()
  let lastStatus = ''

  while (Date.now() - start < timeout) {
    const statusRes = await fetch(
      `${FAL_QUEUE_BASE}/fal-ai/flux-pro/v1.1-ultra/requests/${request_id}/status`,
      { headers: authHeader(params.apiKey) },
    )
    if (!statusRes.ok) {
      const detail = await readErrorBody(statusRes)
      throw new Error(`FLUX Ultra status lỗi (${statusRes.status}): ${detail}`)
    }
    const s = await statusRes.json() as FalQueueStatusResponse
    if (s.status !== lastStatus) {
      lastStatus = s.status
      params.onStatusChange?.(s.status)
    }

    if (s.status === 'COMPLETED') {
      const resultRes = await fetch(
        `${FAL_QUEUE_BASE}/fal-ai/flux-pro/v1.1-ultra/requests/${request_id}`,
        { headers: authHeader(params.apiKey) },
      )
      if (!resultRes.ok) {
        const detail = await readErrorBody(resultRes)
        throw new Error(`FLUX Ultra result lỗi (${resultRes.status}): ${detail}`)
      }
      const result = await resultRes.json() as FalFluxUltraResult
      const url = result.images?.[0]?.url
      if (!url) throw new Error(result.error ?? 'FLUX Ultra không trả về image URL')
      return url
    }
    if (s.status === 'FAILED') {
      throw new Error(s.error ?? 'FLUX Ultra FAILED — thử lại')
    }

    await new Promise((r) => setTimeout(r, interval))
  }

  throw new Error('FLUX Ultra TIMEOUT — quá 4 phút mà chưa xong')
}

// ── Video Background Removal (veed/video-background-removal) ──────────────────

interface FalBgRemoveSubmitResponse {
  request_id: string
}

interface FalBgRemoveResultResponse {
  video?: { url: string; content_type?: string; file_size?: number }
  error?: string
}

/** Remove background from a video. Returns URL of video with transparent/clean background. */
export async function removeVideoBackground(params: {
  apiKey: string
  videoUrl: string
  outputFormat?: 'mp4' | 'webm'  // webm = alpha channel transparency
}): Promise<string> {
  // Submit job
  const submitRes = await fetch(`${FAL_QUEUE_BASE}/veed/video-background-removal`, {
    method: 'POST',
    headers: {
      ...authHeader(params.apiKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      video_url: params.videoUrl,
      output_format: params.outputFormat ?? 'mp4',
    }),
  })

  if (submitRes.status === 401 || submitRes.status === 403) {
    throw new Error('fal.ai API key không hợp lệ — kiểm tra trong Cài đặt')
  }
  if (!submitRes.ok) {
    const detail = await readErrorBody(submitRes)
    throw new Error(`fal.ai background removal lỗi (${submitRes.status}): ${detail}`)
  }

  const submitData = await submitRes.json() as FalBgRemoveSubmitResponse
  if (!submitData.request_id) throw new Error('fal.ai không trả về request_id cho background removal')
  const requestId = submitData.request_id

  // Poll for result
  const timeout = 10 * 60 * 1000  // 10 min
  const interval = 5000
  const start = Date.now()

  while (Date.now() - start < timeout) {
    const statusRes = await fetch(
      `${FAL_QUEUE_BASE}/veed/video-background-removal/requests/${requestId}/status`,
      { headers: authHeader(params.apiKey) },
    )
    if (!statusRes.ok) {
      const detail = await readErrorBody(statusRes)
      throw new Error(`fal.ai background removal status lỗi (${statusRes.status}): ${detail}`)
    }
    const s = await statusRes.json() as FalQueueStatusResponse

    if (s.status === 'COMPLETED') {
      // Fetch result
      const resultRes = await fetch(
        `${FAL_QUEUE_BASE}/veed/video-background-removal/requests/${requestId}`,
        { headers: authHeader(params.apiKey) },
      )
      if (!resultRes.ok) {
        const detail = await readErrorBody(resultRes)
        throw new Error(`fal.ai background removal result lỗi (${resultRes.status}): ${detail}`)
      }
      const result = await resultRes.json() as FalBgRemoveResultResponse
      if (!result.video?.url) {
        throw new Error(result.error ?? 'fal.ai background removal không trả về video URL')
      }
      return result.video.url
    }

    if (s.status === 'FAILED') {
      throw new Error(s.error ?? 'fal.ai background removal thất bại — thử lại')
    }

    await new Promise((r) => setTimeout(r, interval))
  }

  throw new Error('TIMEOUT')
}
