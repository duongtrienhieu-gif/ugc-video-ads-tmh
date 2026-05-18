const KIE_BASE = 'https://api.kie.ai/api/v1'

// ── GPT-4o Image Generation (proper image-to-image editing) ──────────────────
// CRITICAL: /jobs/createTask + gpt-image-2-text-to-image is TEXT-ONLY — it
// silently ignores image_urls. For TRUE image editing with reference images,
// you MUST use this separate endpoint /gpt4o-image/generate with `filesUrl`.
// This endpoint internally calls OpenAI gpt-image-1's image-edit pipeline.

export type Gpt4oSize = '1:1' | '3:2' | '2:3'

/**
 * Submit a GPT-4o image generation task with up to 5 reference images.
 * Returns taskId — poll with pollGpt4oUntilDone() to get the final URL.
 *
 * @param filesUrl Up to 5 publicly accessible reference image URLs (avatar, product, etc.)
 * @param size    Aspect ratio: '1:1', '3:2', or '2:3' only
 */
export async function submitGpt4oImage(params: {
  apiKey: string
  prompt: string
  filesUrl?: string[]
  size: Gpt4oSize
  enableFallback?: boolean
}): Promise<{ taskId: string }> {
  const body: Record<string, unknown> = {
    prompt: params.prompt,
    size: params.size,
    enableFallback: params.enableFallback ?? true,
    fallbackModel: 'GPT_IMAGE_1',
  }
  if (params.filesUrl && params.filesUrl.length > 0) {
    body.filesUrl = params.filesUrl.slice(0, 5)
  }

  const res = await fetch(`${KIE_BASE}/gpt4o-image/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (res.status === 402) throw new Error('INSUFFICIENT_CREDITS')
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`KIE GPT-4o image submit lỗi (${res.status}): ${text.slice(0, 300)}`)
  }
  const data = await res.json() as { code?: number; msg?: string; message?: string; data?: { taskId?: string } | null }
  if (data?.code !== undefined && data.code !== 200) {
    throw new Error(data.msg ?? data.message ?? `KIE GPT-4o lỗi code ${data.code}`)
  }
  const taskId = data?.data?.taskId
  if (!taskId) throw new Error(`KIE GPT-4o không trả về taskId: ${JSON.stringify(data).slice(0, 200)}`)
  return { taskId }
}

/**
 * Get status of a GPT-4o image task. Status values:
 *  - GENERATING / WAITING / QUEUING → still running
 *  - SUCCESS → done, resultUrls available
 *  - CREATE_TASK_FAILED / GENERATE_FAILED → failed
 */
export async function getGpt4oImageStatus(params: {
  apiKey: string
  taskId: string
}): Promise<{ status: ImageStatus; imageUrl?: string; error?: string; progress?: number }> {
  const res = await fetch(
    `${KIE_BASE}/gpt4o-image/record-info?taskId=${encodeURIComponent(params.taskId)}`,
    { headers: { Authorization: `Bearer ${params.apiKey}` } },
  )
  if (!res.ok) throw new Error(`GPT-4o status check failed: ${res.status}`)

  const json = await res.json() as {
    data?: {
      status?: string
      progress?: number | string
      response?: { resultUrls?: string[] }
      errorMessage?: string
      errorCode?: number
    }
  }
  const record = json.data ?? {}
  // Z16: broaden status normalization. KIE documents SUCCESS/GENERATING/
  // QUEUING/WAITING/CREATE_TASK_FAILED/GENERATE_FAILED, but other providers
  // and KIE's future variants may emit COMPLETED/DONE/FINISHED/RUNNING/
  // PROCESSING/PENDING/ERROR/CANCELLED/TIMEOUT. Don't rely on one exact
  // string — group by intent.
  const rawStatus = String(record.status ?? '').toUpperCase().trim()
  const SUCCESS  = new Set(['SUCCESS', 'COMPLETED', 'DONE', 'FINISHED', 'COMPLETE'])
  const FAILED   = new Set(['CREATE_TASK_FAILED', 'GENERATE_FAILED', 'FAILED', 'ERROR', 'CANCELLED', 'TIMEOUT', 'ABORTED'])
  const RUNNING  = new Set(['GENERATING', 'QUEUING', 'QUEUED', 'WAITING', 'PROCESSING', 'PENDING', 'RUNNING'])

  let status: ImageStatus = 'pending'
  if (SUCCESS.has(rawStatus))      status = 'completed'
  else if (FAILED.has(rawStatus))  status = 'failed'
  else if (RUNNING.has(rawStatus)) status = 'processing'

  return {
    status,
    imageUrl: status === 'completed' ? record.response?.resultUrls?.[0] : undefined,
    error: status === 'failed' ? String(record.errorMessage ?? `Tạo ảnh thất bại (raw=${rawStatus || 'empty'})`) : undefined,
    progress: typeof record.progress === 'number' ? record.progress : undefined,
  }
}

/** Poll until the GPT-4o image task is done. Returns the result URL.
 *  Logs each status change to console for diagnostics on stuck generations. */
export async function pollGpt4oUntilDone(params: {
  apiKey: string
  taskId: string
  onStatusChange?: (status: ImageStatus, progress?: number) => void
  timeoutMs?: number
  /** Set this to true to abort the polling loop early (e.g. user clicked Cancel) */
  signal?: AbortSignal
}): Promise<string> {
  const timeout = params.timeoutMs ?? 4 * 60 * 1000
  const start = Date.now()
  let lastStatus = ''
  let sameStatusCount = 0  // Z18: stuck-status watchdog counter
  let pollCount = 0

  const taskTag = params.taskId.slice(0, 12)
  console.log(`[POLL_START] task=${taskTag} timeout=${Math.round(timeout / 1000)}s`)

  while (Date.now() - start < timeout) {
    if (params.signal?.aborted) {
      console.warn(`[POLL_FAIL] task=${taskTag} reason=ABORTED`)
      throw new Error('CANCELLED — user hủy task')
    }
    // Z16: faster polling cadence (3s → 2s) so completion detection lands
    // 1s sooner on average. Network cost is negligible.
    await new Promise<void>((r) => setTimeout(r, 2000))
    pollCount++
    const s = await getGpt4oImageStatus({ apiKey: params.apiKey, taskId: params.taskId })
    const elapsedSec = Math.round((Date.now() - start) / 1000)

    if (s.status !== lastStatus) {
      console.log(`[POLL_STATUS] task=${taskTag} +${elapsedSec}s status=${s.status} progress=${s.progress ?? '-'} (poll #${pollCount})`)
      lastStatus = s.status
      sameStatusCount = 0
      params.onStatusChange?.(s.status, s.progress)
    } else {
      sameStatusCount++
      // Z18: stuck-status watchdog — advisory warning at 12 polls (~24s)
      // of unchanged status. Useful diagnostic; the hard timeout still
      // owns the actual abort decision.
      if (sameStatusCount === 12) {
        console.warn(`[POLL_STUCK_WARN] task=${taskTag} +${elapsedSec}s status=${s.status} unchanged for ${sameStatusCount} polls (~24s) — KIE may be frozen`)
      }
      if (pollCount % 10 === 0) {
        // Heartbeat every ~20s even if status hasn't changed
        console.log(`[POLL_ELAPSED] task=${taskTag} +${elapsedSec}s still ${s.status} (poll #${pollCount}, same#${sameStatusCount})`)
      }
    }

    if (s.status === 'completed') {
      if (!s.imageUrl) throw new Error('GPT-4o completed nhưng không trả về imageUrl')
      console.log(`[POLL_COMPLETE] task=${taskTag} +${elapsedSec}s url=${s.imageUrl.slice(0, 80)}`)
      return s.imageUrl
    }
    if (s.status === 'failed') {
      console.error(`[POLL_FAIL] task=${taskTag} +${elapsedSec}s reason=${s.error}`)
      throw new Error(s.error ?? 'GPT-4o gen thất bại')
    }
  }
  console.error(`[POLL_FAIL] task=${taskTag} +${Math.round(timeout / 1000)}s reason=TIMEOUT (final status=${lastStatus} sameCount=${sameStatusCount})`)
  throw new Error(`TIMEOUT — KIE GPT-4o quá ${Math.round(timeout / 1000)}s chưa xong (task có thể bị stuck queue — retry tự động hoặc refresh + thử lại)`)
}

// ── gpt-image-2 (KIE /jobs/createTask) ──────────────────────────────────────
// Strongest image model on KIE — used for ALL landing-page image generation
// (replaces the older /gpt4o-image/generate path). Supports reference
// images via `image_urls` for product / identity lock, same way /gpt4o-image
// supported them via `filesUrl`.
//
// API shape:
//   POST /jobs/createTask  { model: 'gpt-image-2-text-to-image', input: { ... } }
//   Polling: /jobs/recordInfo?taskId=...  → state ∈ {success,fail,generating,queuing,waiting}

const GPT_IMAGE_2_MODEL = 'gpt-image-2-text-to-image'

/** Submit a gpt-image-2 task. Drop-in shape mirror of submitGpt4oImage so
 *  landing-page callers swap with minimal changes. */
export async function submitGptImage2(params: {
  apiKey: string
  prompt: string
  filesUrl?: string[]
  size: Gpt4oSize
  /** Resolution — defaults to '2K' for landing-page quality. */
  resolution?: '1K' | '2K' | '4K'
}): Promise<{ taskId: string }> {
  const input: Record<string, unknown> = {
    prompt: params.prompt,
    resolution: params.resolution ?? '2K',
    aspect_ratio: params.size,
  }
  if (params.filesUrl && params.filesUrl.length > 0) {
    input.image_urls = params.filesUrl.slice(0, 5)
  }

  const res = await fetch(`${KIE_BASE}/jobs/createTask`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: GPT_IMAGE_2_MODEL, input }),
  })

  if (res.status === 402) throw new Error('INSUFFICIENT_CREDITS')
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`KIE gpt-image-2 submit lỗi (${res.status}): ${text.slice(0, 300)}`)
  }
  const data = await res.json() as { code?: number; msg?: string; message?: string; data?: { taskId?: string } | null }
  if (data?.code !== undefined && data.code !== 200) {
    throw new Error(data.msg ?? data.message ?? `KIE gpt-image-2 lỗi code ${data.code}`)
  }
  const taskId = data?.data?.taskId
  if (!taskId) throw new Error(`KIE gpt-image-2 không trả về taskId: ${JSON.stringify(data).slice(0, 200)}`)
  return { taskId }
}

/** Status fetch for a gpt-image-2 job. Hits /jobs/recordInfo. */
export async function getGptImage2Status(params: {
  apiKey: string
  taskId: string
}): Promise<{ status: ImageStatus; imageUrl?: string; error?: string; progress?: number }> {
  const res = await fetch(
    `${KIE_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(params.taskId)}`,
    { headers: { Authorization: `Bearer ${params.apiKey}` } },
  )
  if (!res.ok) throw new Error(`gpt-image-2 status check failed: ${res.status}`)

  const data = await res.json() as {
    data?: {
      state?: string
      resultJson?: string
      failMsg?: string
    }
  }
  const record = data.data ?? {}
  const rawStatus = String(record.state ?? '').toLowerCase()

  let status: ImageStatus = 'pending'
  if (rawStatus === 'success') status = 'completed'
  else if (rawStatus === 'fail') status = 'failed'
  else if (rawStatus === 'generating' || rawStatus === 'queuing' || rawStatus === 'waiting') status = 'processing'

  let imageUrl: string | undefined
  if (status === 'completed' && record.resultJson) {
    try {
      const parsed = JSON.parse(record.resultJson) as { resultUrls?: string[] }
      imageUrl = parsed.resultUrls?.[0]
    } catch { /* ignore */ }
  }

  return {
    status,
    imageUrl,
    error: status === 'failed'
      ? String(record.failMsg ?? `Tạo ảnh thất bại (raw=${rawStatus || 'empty'})`)
      : undefined,
  }
}

/** Poll a gpt-image-2 task until done. Same diagnostic shape as pollGpt4oUntilDone. */
export async function pollGptImage2UntilDone(params: {
  apiKey: string
  taskId: string
  onStatusChange?: (status: ImageStatus, progress?: number) => void
  timeoutMs?: number
  signal?: AbortSignal
}): Promise<string> {
  const timeout = params.timeoutMs ?? 4 * 60 * 1000
  const start = Date.now()
  let lastStatus = ''
  let sameStatusCount = 0
  let pollCount = 0

  const taskTag = params.taskId.slice(0, 12)
  console.log(`[POLL_START gpt-image-2] task=${taskTag} timeout=${Math.round(timeout / 1000)}s`)

  while (Date.now() - start < timeout) {
    if (params.signal?.aborted) {
      console.warn(`[POLL_FAIL gpt-image-2] task=${taskTag} reason=ABORTED`)
      throw new Error('CANCELLED — user hủy task')
    }
    await new Promise<void>((r) => setTimeout(r, 2000))
    pollCount++
    const s = await getGptImage2Status({ apiKey: params.apiKey, taskId: params.taskId })
    const elapsedSec = Math.round((Date.now() - start) / 1000)

    if (s.status !== lastStatus) {
      console.log(`[POLL_STATUS gpt-image-2] task=${taskTag} +${elapsedSec}s status=${s.status} (poll #${pollCount})`)
      lastStatus = s.status
      sameStatusCount = 0
      params.onStatusChange?.(s.status, s.progress)
    } else {
      sameStatusCount++
      if (sameStatusCount === 12) {
        console.warn(`[POLL_STUCK_WARN gpt-image-2] task=${taskTag} +${elapsedSec}s status=${s.status} unchanged ~24s — KIE may be frozen`)
      }
      if (pollCount % 10 === 0) {
        console.log(`[POLL_ELAPSED gpt-image-2] task=${taskTag} +${elapsedSec}s still ${s.status} (poll #${pollCount}, same#${sameStatusCount})`)
      }
    }

    if (s.status === 'completed') {
      if (!s.imageUrl) throw new Error('gpt-image-2 completed nhưng không trả về imageUrl')
      console.log(`[POLL_COMPLETE gpt-image-2] task=${taskTag} +${elapsedSec}s url=${s.imageUrl.slice(0, 80)}`)
      return s.imageUrl
    }
    if (s.status === 'failed') {
      console.error(`[POLL_FAIL gpt-image-2] task=${taskTag} +${elapsedSec}s reason=${s.error}`)
      throw new Error(s.error ?? 'gpt-image-2 gen thất bại')
    }
  }
  console.error(`[POLL_FAIL gpt-image-2] task=${taskTag} +${Math.round(timeout / 1000)}s reason=TIMEOUT (final status=${lastStatus} sameCount=${sameStatusCount})`)
  throw new Error(`TIMEOUT — KIE gpt-image-2 quá ${Math.round(timeout / 1000)}s chưa xong (task có thể bị stuck queue — retry tự động hoặc refresh + thử lại)`)
}

/** All-in-one: submit + poll + return final image URL. */
export async function generateGpt4oImage(params: {
  apiKey: string
  prompt: string
  filesUrl?: string[]
  size: Gpt4oSize
  onStatusChange?: (status: ImageStatus, progress?: number) => void
  timeoutMs?: number
  signal?: AbortSignal
}): Promise<string> {
  console.log(`[gpt4o-gen] submit prompt=${params.prompt.length} chars · refs=${params.filesUrl?.length ?? 0} · size=${params.size}`)
  const { taskId } = await submitGpt4oImage({
    apiKey: params.apiKey,
    prompt: params.prompt,
    filesUrl: params.filesUrl,
    size: params.size,
  })
  return await pollGpt4oUntilDone({
    apiKey: params.apiKey,
    taskId,
    onStatusChange: params.onStatusChange,
    timeoutMs: params.timeoutMs,
    signal: params.signal,
  })
}

// ─────────────────────────────────────────────────────────────────────────
// Z16 — Fast-mode wrapper for time-sensitive use cases (Master Frame).
//
// Submit + short-timeout poll. On timeout, ABANDON the stuck task and
// submit a fresh one. This converts 5-minute hangs into ~120s worst case.
//
// Used by: masterFrameJobRunner.ts (replaces direct generateGpt4oImage).
// NOT used by: landing-page (long, batch-style, can tolerate longer waits).
//
// Per-attempt timeline:
//   attempt 1 → submit → poll up to attemptTimeoutMs (60s default)
//   if timeout/network-error → attempt 2 → fresh submit → poll up to 60s
//   if attempt 2 also fails → throw with consolidated error
//
// Hard failures (CANCELLED, INSUFFICIENT_CREDITS, content_policy) skip
// retry — no point burning a fresh credit on an unrecoverable error.
// ─────────────────────────────────────────────────────────────────────────
export async function generateGpt4oImageFast(params: {
  apiKey: string
  /** Z18: prompt can be a function of (attempt) so caller can simplify on
   *  retry. Static string still works — gets used for every attempt. */
  prompt: string | ((attempt: number) => string)
  filesUrl?: string[]
  size: Gpt4oSize
  /** Per-attempt KIE poll timeout. Defaults to 60s. */
  attemptTimeoutMs?: number
  /** Z18: soft timeout — logs [POLL_SOFT_TIMEOUT] warning at this mark
   *  but does NOT abort. Used to surface "running slow" diagnostic. */
  softTimeoutMs?: number
  /** Max fresh submissions. Defaults to 2 → total max ~120-130s. */
  maxAttempts?: number
  signal?: AbortSignal
  /** Fires when a new attempt starts — UI can refresh "trying attempt 2/2" hint */
  onAttemptChange?: (attempt: number, total: number) => void
  onStatusChange?: (status: ImageStatus, progress?: number) => void
}): Promise<string> {
  const attemptTimeout = params.attemptTimeoutMs ?? 60_000
  const softTimeout    = params.softTimeoutMs ?? 45_000
  const maxAttempts    = params.maxAttempts ?? 2
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (params.signal?.aborted) throw new Error('CANCELLED — user hủy task')
    params.onAttemptChange?.(attempt, maxAttempts)
    const currentPrompt = typeof params.prompt === 'function' ? params.prompt(attempt) : params.prompt
    console.log(`[FAST attempt ${attempt}/${maxAttempts}] timeout=${Math.round(attemptTimeout / 1000)}s soft=${Math.round(softTimeout / 1000)}s promptLen=${currentPrompt.length} submit...`)

    // Z18: soft timeout watcher — fires once at softTimeoutMs to log warning
    const softTimer = setTimeout(() => {
      console.warn(`[POLL_SOFT_TIMEOUT] attempt ${attempt}/${maxAttempts} — passed soft deadline ${Math.round(softTimeout / 1000)}s, will hard-timeout at ${Math.round(attemptTimeout / 1000)}s`)
    }, softTimeout)

    try {
      const { taskId } = await submitGpt4oImage({
        apiKey: params.apiKey,
        prompt: currentPrompt,
        filesUrl: params.filesUrl,
        size: params.size,
      })
      const url = await pollGpt4oUntilDone({
        apiKey: params.apiKey,
        taskId,
        timeoutMs: attemptTimeout,
        signal: params.signal,
        onStatusChange: params.onStatusChange,
      })
      console.log(`[FAST attempt ${attempt}/${maxAttempts}] DONE`)
      return url
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      lastError = err instanceof Error ? err : new Error(msg)

      // Hard failures — never retry
      if (
        msg.includes('CANCELLED') ||
        msg === 'INSUFFICIENT_CREDITS' ||
        msg.includes('content_policy') ||
        msg.includes('GENERATE_FAILED')
      ) {
        console.error(`[FAST attempt ${attempt}/${maxAttempts}] hard-fail (no retry): ${msg.slice(0, 120)}`)
        throw lastError
      }

      // Timeout / network — abandon this task and retry with a fresh submission
      console.warn(`[FAST attempt ${attempt}/${maxAttempts}] soft-fail: ${msg.slice(0, 120)} — ${attempt < maxAttempts ? 'submitting fresh task (will use simplified prompt if caller provided fn-form)' : 'no more attempts'}`)
    } finally {
      clearTimeout(softTimer)
    }
  }

  throw lastError ?? new Error('Hết lượt thử Fast mode — KIE backend có thể đang quá tải')
}

// ── Credits balance ───────────────────────────────────────────────────

export async function getKieCredits(apiKey: string): Promise<number> {
  const res = await fetch(`${KIE_BASE}/chat/credit`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`)
  const data = await res.json() as { code?: number; data?: number }
  if (data?.code !== 200 || data?.data === undefined) throw new Error('Invalid response')
  return Number(data.data)
}

// ── Image generation ──────────────────────────────────────────────────

export interface ImageModel {
  id: string
  name: string
  provider: string
  credits: Record<ImageResolution, number>
  starred?: boolean
}

export const IMAGE_MODELS: ImageModel[] = [
  { id: 'gpt-image-2-text-to-image', name: 'GPT Image 2',   provider: 'OpenAI', credits: { '1K': 6,  '2K': 10, '4K': 16 }, starred: true },
]

export type ImageResolution = '1K' | '2K' | '4K'
export type ImageStatus = 'pending' | 'processing' | 'completed' | 'failed'

export async function generateImage(params: {
  apiKey: string
  model: string
  prompt: string
  resolution: ImageResolution
  aspectRatio?: string
  /**
   * Reference images for identity / product lock. Nano Banana 2 + GPT Image 2
   * use these to maintain consistency across multi-shot generations
   * (e.g. same avatar face + same product packaging across 9 B-roll frames).
   */
  referenceImageUrls?: string[]
}): Promise<{ taskId: string }> {
  const input: Record<string, unknown> = {
    prompt: params.prompt,
    resolution: params.resolution,
    aspect_ratio: params.aspectRatio ?? '9:16',
  }
  if (params.referenceImageUrls?.length) {
    input.image_urls = params.referenceImageUrls
  }

  const res = await fetch(`${KIE_BASE}/jobs/createTask`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: params.model, input }),
  })
  if (res.status === 402) throw new Error('INSUFFICIENT_CREDITS')
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text)
  }
  const data = await res.json() as { code?: number; msg?: string; message?: string; data?: { taskId?: string } | null }
  if (data?.code !== undefined && data.code !== 200) {
    throw new Error(data.msg ?? data.message ?? `kie.ai lỗi code ${data.code}`)
  }
  const taskId = data?.data?.taskId
  if (!taskId) {
    const msg = data?.msg ?? data?.message ?? JSON.stringify(data)
    throw new Error(`kie.ai không trả về taskId: ${msg}`)
  }
  return { taskId }
}

export async function getImageStatus(params: {
  apiKey: string
  taskId: string
}): Promise<{ status: ImageStatus; imageUrl?: string; error?: string }> {
  const res = await fetch(
    `${KIE_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(params.taskId)}`,
    { headers: { Authorization: `Bearer ${params.apiKey}` } },
  )
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`)

  const data = await res.json() as {
    data: {
      state: string
      resultJson?: string
      failMsg?: string
    }
  }
  const record = data.data
  const rawStatus = String(record.state ?? '').toLowerCase()

  let status: ImageStatus = 'pending'
  if (rawStatus === 'success') status = 'completed'
  else if (rawStatus === 'fail') status = 'failed'
  else if (rawStatus === 'generating' || rawStatus === 'queuing' || rawStatus === 'waiting') status = 'processing'

  let imageUrl: string | undefined
  if (status === 'completed' && record.resultJson) {
    try {
      const parsed = JSON.parse(record.resultJson) as { resultUrls?: string[] }
      imageUrl = parsed.resultUrls?.[0]
    } catch { /* ignore */ }
  }

  return {
    status,
    imageUrl,
    error: status === 'failed' ? String(record.failMsg ?? 'Tạo ảnh thất bại') : undefined,
  }
}

export async function pollImageUntilDone(params: {
  apiKey: string
  taskId: string
  onStatusChange?: (status: ImageStatus) => void
  timeoutMs?: number
}): Promise<string> {
  const timeout = params.timeoutMs ?? 3 * 60 * 1000
  const start = Date.now()

  while (Date.now() - start < timeout) {
    await new Promise<void>((resolve) => setTimeout(resolve, 3000))

    const result = await getImageStatus({ apiKey: params.apiKey, taskId: params.taskId })
    params.onStatusChange?.(result.status)

    if (result.status === 'completed' && result.imageUrl) return result.imageUrl
    if (result.status === 'failed') throw new Error(result.error ?? 'Tạo ảnh thất bại')
  }

  throw new Error('TIMEOUT')
}

// ── Video generation ──────────────────────────────────────────────────

export interface VideoModel {
  id: string
  name: string
  provider: string
  credits: number
  starred?: boolean
  supportsDuration?: boolean
  durationOptions?: number[]
  supportsResolution?: boolean  // false = don't send resolution field to API
  useJobsApi?: boolean          // true = /jobs/createTask, false/undefined = /veo/generate
  jobModelId?: string           // actual model ID string for jobs API
}

export const VIDEO_MODELS: VideoModel[] = [
  { id: 'seedance_2_0',      name: 'Seedance 2.0',      provider: 'ByteDance',      credits: 205, starred: true, supportsDuration: true, durationOptions: [5, 8, 10, 12], supportsResolution: true,  useJobsApi: true, jobModelId: 'bytedance/seedance-2' },
  { id: 'seedance_2_0_fast', name: 'Seedance 2.0 Fast', provider: 'ByteDance',      credits: 165,               supportsDuration: true, durationOptions: [5, 8, 10, 12], supportsResolution: true,  useJobsApi: true, jobModelId: 'bytedance/seedance-2-fast' },
  { id: 'kling_3_0',         name: 'Kling 3.0',         provider: 'Kling AI',       credits: 70,                supportsDuration: true, durationOptions: [5, 8, 10],    supportsResolution: false, useJobsApi: true, jobModelId: 'kling-3.0/video' },
  { id: 'veo3_fast',         name: 'Veo 3.1 Fast',      provider: 'Google',         credits: 60,  supportsResolution: true },
  { id: 'veo3_lite',         name: 'Veo 3.1 Lite',      provider: 'Google',         credits: 30,  supportsResolution: true },
  { id: 'veo3',              name: 'Veo 3.1 Quality',   provider: 'Google',         credits: 250, supportsResolution: true },
  { id: 'wan_2_7',           name: 'Wan 2.7',           provider: 'Alibaba Tongyi', credits: 80,                supportsDuration: true, durationOptions: [5, 8, 10, 12], supportsResolution: true,  useJobsApi: true, jobModelId: 'wan/2-7-text-to-video' },
  { id: 'sora_2',            name: 'Sora 2',            provider: 'OpenAI',         credits: 30,  supportsResolution: false, useJobsApi: true, jobModelId: 'sora-2-text-to-video' },
  { id: 'sora_2_pro',        name: 'Sora 2 Pro',        provider: 'OpenAI',         credits: 150, supportsResolution: false, useJobsApi: true, jobModelId: 'sora-2-pro-text-to-video' },
]

export type AspectRatio = '16:9' | '9:16'
export type Resolution = '480p' | '720p' | '1080p' | '4k'
export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed'

export async function generateVideo(params: {
  apiKey: string
  model: string
  prompt: string
  aspectRatio: AspectRatio
  resolution: Resolution
  sendResolution?: boolean  // false = omit resolution field
  duration?: number
  startFrameUrl?: string
  endFrameUrl?: string
  referenceImageUrls?: string[]
}): Promise<{ taskId: string }> {
  const imageUrls: string[] = []
  let generationType: string | null = null

  if (params.startFrameUrl && params.endFrameUrl) {
    generationType = 'FIRST_AND_LAST_FRAMES_2_VIDEO'
    imageUrls.push(params.startFrameUrl, params.endFrameUrl)
  } else if (params.referenceImageUrls && params.referenceImageUrls.length > 0) {
    generationType = 'REFERENCE_2_VIDEO'
    imageUrls.push(...params.referenceImageUrls)
  }

  const body: Record<string, unknown> = {
    prompt: params.prompt,
    model: params.model,
    aspect_ratio: params.aspectRatio,
  }
  // Only send generationType when images are involved; omit for pure text-to-video
  if (generationType) body.generationType = generationType
  if (params.sendResolution !== false) body.resolution = params.resolution
  if (params.duration) body.duration = params.duration
  if (imageUrls.length > 0) body.imageUrls = imageUrls

  const res = await fetch(`${KIE_BASE}/veo/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (res.status === 402) throw new Error('INSUFFICIENT_CREDITS')
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text)
  }

  const data = await res.json() as { code?: number; message?: string; data: { taskId: string } | null }
  if (!data.data?.taskId) {
    throw new Error(data.message ?? `API trả về lỗi (code: ${data.code ?? 'unknown'})`)
  }
  return { taskId: data.data.taskId }
}

export async function getVideoStatus(params: {
  apiKey: string
  taskId: string
}): Promise<{ status: VideoStatus; videoUrl?: string; error?: string }> {
  const res = await fetch(
    `${KIE_BASE}/veo/record-info?taskId=${encodeURIComponent(params.taskId)}`,
    { headers: { Authorization: `Bearer ${params.apiKey}` } },
  )
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`)

  const data = await res.json() as {
    data: {
      successFlag?: number
      resultUrls?: string[] | string
      fullResultUrls?: string[]
    }
  }
  const record = data.data
  const flag = record.successFlag

  let status: VideoStatus = 'pending'
  if (flag === 1) status = 'completed'
  else if (flag === 2 || flag === 3) status = 'failed'
  else if (flag === 0) status = 'processing'

  let videoUrl: string | undefined
  if (status === 'completed') {
    const urls = record.fullResultUrls ?? (
      typeof record.resultUrls === 'string'
        ? (JSON.parse(record.resultUrls) as string[])
        : record.resultUrls
    )
    videoUrl = Array.isArray(urls) ? urls[0] : undefined
  }

  return {
    status,
    videoUrl,
    error: status === 'failed' ? 'Tạo video thất bại' : undefined,
  }
}

export async function pollVideoUntilDone(params: {
  apiKey: string
  taskId: string
  onStatusChange?: (status: VideoStatus) => void
  timeoutMs?: number
}): Promise<string> {
  const timeout = params.timeoutMs ?? 5 * 60 * 1000
  const start = Date.now()

  while (Date.now() - start < timeout) {
    await new Promise<void>((resolve) => setTimeout(resolve, 5000))

    const result = await getVideoStatus({ apiKey: params.apiKey, taskId: params.taskId })
    params.onStatusChange?.(result.status)

    if (result.status === 'completed' && result.videoUrl) return result.videoUrl
    if (result.status === 'failed') throw new Error(result.error ?? 'Tạo video thất bại')
  }

  throw new Error('TIMEOUT')
}

// ── Video generation via Jobs API (non-Veo models) ───────────────────

export async function generateVideoJob(params: {
  apiKey: string
  jobModelId: string
  prompt: string
  aspectRatio: AspectRatio
  resolution: Resolution
  duration?: number
  startFrameUrl?: string
  endFrameUrl?: string
  referenceImageUrls?: string[]
}): Promise<{ taskId: string }> {
  const input: Record<string, unknown> = { prompt: params.prompt }

  if (params.jobModelId.startsWith('bytedance/')) {
    // Seedance
    input.resolution = params.resolution
    input.aspect_ratio = params.aspectRatio
    if (params.duration) input.duration = params.duration
    if (params.startFrameUrl) input.first_frame_image_url = params.startFrameUrl
    if (params.endFrameUrl) input.last_frame_image_url = params.endFrameUrl
    if (params.referenceImageUrls?.length) {
      input.reference_images = params.referenceImageUrls.map((url) => ({ image_url: url }))
    }
  } else if (params.jobModelId.startsWith('kling')) {
    // Kling
    input.aspect_ratio = params.aspectRatio
    if (params.duration) input.duration = params.duration
    input.mode = 'std'
    if (params.referenceImageUrls?.length) input.image_urls = params.referenceImageUrls
  } else if (params.jobModelId.startsWith('wan/')) {
    // Wan uses `ratio` instead of `aspect_ratio`
    input.ratio = params.aspectRatio
    input.resolution = params.resolution
    if (params.duration) input.duration = params.duration
  } else if (params.jobModelId.startsWith('sora')) {
    // Sora uses portrait/landscape and n_frames instead of resolution/duration
    input.aspect_ratio = params.aspectRatio === '9:16' ? 'portrait' : 'landscape'
    input.n_frames = '15'
  }

  const res = await fetch(`${KIE_BASE}/jobs/createTask`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: params.jobModelId, input }),
  })

  if (res.status === 402) throw new Error('INSUFFICIENT_CREDITS')
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text)
  }
  const data = await res.json() as { code?: number; message?: string; data: { taskId: string } | null }
  if (!data.data?.taskId) {
    throw new Error(data.message ?? `API trả về lỗi (code: ${data.code ?? 'unknown'})`)
  }
  return { taskId: data.data.taskId }
}

export async function getVideoJobStatus(params: {
  apiKey: string
  taskId: string
}): Promise<{ status: VideoStatus; videoUrl?: string; error?: string }> {
  const res = await fetch(
    `${KIE_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(params.taskId)}`,
    { headers: { Authorization: `Bearer ${params.apiKey}` } },
  )
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`)

  const data = await res.json() as {
    data: { state: string; resultJson?: string; failMsg?: string }
  }
  const record = data.data
  const rawStatus = String(record.state ?? '').toLowerCase()

  let status: VideoStatus = 'pending'
  if (rawStatus === 'success') status = 'completed'
  else if (rawStatus === 'fail') status = 'failed'
  else if (rawStatus === 'generating' || rawStatus === 'queuing' || rawStatus === 'waiting') status = 'processing'

  let videoUrl: string | undefined
  if (status === 'completed' && record.resultJson) {
    try {
      const parsed = JSON.parse(record.resultJson) as { resultUrls?: string[] }
      videoUrl = parsed.resultUrls?.[0]
    } catch { /* ignore */ }
  }

  return {
    status,
    videoUrl,
    error: status === 'failed' ? String(record.failMsg ?? 'Tạo video thất bại') : undefined,
  }
}

export async function pollVideoJobUntilDone(params: {
  apiKey: string
  taskId: string
  onStatusChange?: (status: VideoStatus) => void
  timeoutMs?: number
}): Promise<string> {
  const timeout = params.timeoutMs ?? 5 * 60 * 1000
  const start = Date.now()

  while (Date.now() - start < timeout) {
    await new Promise<void>((resolve) => setTimeout(resolve, 5000))

    const result = await getVideoJobStatus({ apiKey: params.apiKey, taskId: params.taskId })
    params.onStatusChange?.(result.status)

    if (result.status === 'completed' && result.videoUrl) return result.videoUrl
    if (result.status === 'failed') throw new Error(result.error ?? 'Tạo video thất bại')
  }

  throw new Error('TIMEOUT')
}

// ── Text Generation (kie.ai chat completions — OpenAI-compatible) ─────

const TEXT_TIMEOUT_MS = 60_000 // 60s per model attempt

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function kieTextGenerate(
  apiKey: string,
  prompt: string,
  systemInstruction?: string,
): Promise<string> {
  const messages: { role: string; content: string }[] = []
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction })
  messages.push({ role: 'user', content: prompt })

  // gemini-2.5-flash first: usually 3-5x faster than gpt-4o for text
  const textModels = ['gemini-2.5-flash', 'gpt-4o-mini', 'gpt-4o']
  let lastError = ''

  for (const model of textModels) {
    const startedAt = Date.now()
    console.log(`[kieTextGenerate] trying ${model}...`)
    try {
      const res = await fetchWithTimeout('https://api.kie.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, messages }),
      }, TEXT_TIMEOUT_MS)

      if (res.status === 402) throw new Error('INSUFFICIENT_CREDITS')
      if (!res.ok) {
        lastError = `kie.ai text error (${res.status}): ${await res.text().catch(() => res.statusText)}`
        console.warn(`[kieTextGenerate] ${model} HTTP ${res.status}, trying next`)
        continue
      }
      const data = await res.json() as { choices?: { message?: { content?: string | null; refusal?: string } }[] }
      const msg = data.choices?.[0]?.message
      const content = typeof msg?.content === 'string' ? msg.content.trim() : ''
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
      if (content) {
        console.log(`[kieTextGenerate] ${model} OK in ${elapsed}s — ${content.length} chars`)
        return content
      }
      lastError = msg?.refusal ? `Model ${model} từ chối yêu cầu` : `Model ${model} trả về phản hồi rỗng`
      console.warn(`[kieTextGenerate] ${model} empty after ${elapsed}s, trying next`)
    } catch (e) {
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
      if (e instanceof Error && e.message === 'INSUFFICIENT_CREDITS') throw e
      const isAbort = e instanceof Error && e.name === 'AbortError'
      lastError = isAbort ? `Model ${model} timeout sau ${elapsed}s` : `Model ${model} lỗi: ${e instanceof Error ? e.message : String(e)}`
      console.warn(`[kieTextGenerate] ${lastError}, trying next`)
    }
  }

  throw new Error(lastError || 'Không có phản hồi từ kie.ai text')
}

// ── Image Analysis (kie.ai vision — gpt-4o-mini supports image_url) ──

// Compress a Blob to small JPEG base64 for sending to vision API
export async function blobToSmallBase64(blob: Blob, maxWidth = 768): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('canvas')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((b) => {
        if (!b) { reject(new Error('toBlob')); return }
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(b)
      }, 'image/jpeg', 0.75)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img load')) }
    img.src = url
  })
}

export async function kieAnalyzeImage(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  prompt: string,
  systemInstruction?: string,
  imageUrls?: string | string[],
): Promise<string> {
  const messages: Array<{ role: string; content: unknown }> = []
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction })

  // Build image content parts
  const urls = imageUrls
    ? (Array.isArray(imageUrls) ? imageUrls : [imageUrls])
    : [`data:${mimeType || 'image/jpeg'};base64,${imageBase64}`]

  messages.push({
    role: 'user',
    content: [
      ...urls.map((u) => ({ type: 'image_url', image_url: { url: u } })),
      { type: 'text', text: prompt },
    ],
  })

  // gemini-2.5-flash first: faster vision than gpt-4o on kie.ai
  const visionModels = ['gemini-2.5-flash', 'gpt-4o-mini', 'gpt-4o']
  const VISION_TIMEOUT_MS = 90_000 // 90s per model — vision is slower than text
  let lastError = ''

  for (const model of visionModels) {
    const startedAt = Date.now()
    console.log(`[kieAnalyzeImage] trying ${model}...`)
    try {
      const res = await fetchWithTimeout('https://api.kie.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, messages }),
      }, VISION_TIMEOUT_MS)

      if (res.status === 402) throw new Error('INSUFFICIENT_CREDITS')
      if (!res.ok) {
        lastError = `kie.ai vision error (${res.status}): ${await res.text().catch(() => res.statusText)}`
        console.warn(`[kieAnalyzeImage] ${model} HTTP ${res.status}, trying next`)
        continue
      }
      const data = await res.json() as { choices?: { message?: { content?: string | null; refusal?: string } }[] }
      const msg = data.choices?.[0]?.message
      const content = typeof msg?.content === 'string' ? msg.content.trim() : ''
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
      if (content) {
        console.log(`[kieAnalyzeImage] ${model} OK in ${elapsed}s — ${content.length} chars`)
        return content
      }
      lastError = msg?.refusal
        ? `Model ${model} từ chối: ${msg.refusal.slice(0, 80)}`
        : `Model ${model} trả về phản hồi rỗng`
      console.warn(`[kieAnalyzeImage] ${model} empty after ${elapsed}s, trying next`)
    } catch (e) {
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
      if (e instanceof Error && e.message === 'INSUFFICIENT_CREDITS') throw e
      const isAbort = e instanceof Error && e.name === 'AbortError'
      lastError = isAbort ? `Model ${model} timeout sau ${elapsed}s` : `Model ${model} lỗi: ${e instanceof Error ? e.message : String(e)}`
      console.warn(`[kieAnalyzeImage] ${lastError}, trying next`)
    }
  }

  throw new Error(lastError || 'Không có phản hồi từ kie.ai vision')
}

// ── TTS / Voice (kie.ai audio — OpenAI-compatible) ───────────────────

export async function kieTTS(params: {
  apiKey: string
  text: string
  voiceId?: string
  speed?: number
}): Promise<ArrayBuffer> {
  const res = await fetch('https://api.kie.ai/api/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: params.text,
      voice: params.voiceId ?? 'alloy',
      speed: params.speed ?? 1.0,
    }),
  })
  if (res.status === 402) throw new Error('INSUFFICIENT_CREDITS')
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`kie.ai TTS error (${res.status}): ${text}`)
  }
  return res.arrayBuffer()
}

// ── Lip-Sync (InfiniteTalk & Kling Avatar) ────────────────────────────

export interface LipSyncModel {
  id: string
  name: string
  modelId: string
  maxDuration: string
  resolution: string
  supportsResolution: boolean
  starred?: boolean
}

export const LIPSYNC_MODELS: LipSyncModel[] = [
  {
    id: 'kling-avatar-std',
    name: 'Kling Avatar Standard',
    modelId: 'kling/ai-avatar-standard',
    maxDuration: '5 phút',
    resolution: '720p',
    supportsResolution: false,
    starred: true,
  },
  {
    id: 'infinitalk',
    name: 'InfiniteTalk',
    modelId: 'infinitalk/from-audio',
    maxDuration: '15 giây',
    resolution: '480p / 720p',
    supportsResolution: true,
  },
]

export async function generateLipSync(params: {
  apiKey: string
  modelId: string
  imageUrl: string
  audioUrl: string
  prompt: string
  resolution?: '480p' | '720p'
}): Promise<{ taskId: string }> {
  const input: Record<string, unknown> = {
    image_url: params.imageUrl,
    audio_url: params.audioUrl,
    prompt: params.prompt,
  }
  if (params.resolution && params.modelId === 'infinitalk/from-audio') {
    input.resolution = params.resolution
  }

  const res = await fetch(`${KIE_BASE}/jobs/createTask`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: params.modelId, input }),
  })

  if (res.status === 402) throw new Error('INSUFFICIENT_CREDITS')
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text)
  }
  const data = await res.json() as { code?: number; msg?: string; message?: string; data?: { taskId?: string } | null }
  if (data?.code !== undefined && data.code !== 200) {
    throw new Error(data.msg ?? data.message ?? `kie.ai lỗi code ${data.code}`)
  }
  const taskId = data?.data?.taskId
  if (!taskId) {
    throw new Error(data?.msg ?? data?.message ?? 'kie.ai không trả về taskId')
  }
  return { taskId }
}

export async function pollLipSyncUntilDone(params: {
  apiKey: string
  taskId: string
  onStatusChange?: (status: VideoStatus) => void
  timeoutMs?: number
}): Promise<string> {
  // Lip-sync uses same jobs polling as video jobs
  return pollVideoJobUntilDone(params)
}
