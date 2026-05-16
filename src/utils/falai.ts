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

async function readErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text()
    try {
      const json = JSON.parse(text) as { detail?: string; message?: string; error?: string }
      return json.detail ?? json.message ?? json.error ?? text.slice(0, 300)
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
