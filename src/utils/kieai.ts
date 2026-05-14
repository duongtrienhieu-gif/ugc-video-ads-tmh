const KIE_BASE = 'https://api.kie.ai/api/v1'

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
  { id: 'nano-banana-2-text-to-image', name: 'Nano Banana 2',   provider: 'Google',           credits: { '1K': 8,   '2K': 12, '4K': 16 } },
  { id: 'flux-2-pro-text-to-image',   name: 'Flux 2 Pro',      provider: 'Black Forest Labs', credits: { '1K': 14,  '2K': 20, '4K': 28 } },
  { id: 'seedream-5-lite-t2i',        name: 'Seedream 5 Lite', provider: 'ByteDance',        credits: { '1K': 5.5, '2K': 8,  '4K': 12 } },
  { id: 'gpt-image-2-text-to-image',  name: 'GPT Image 2',     provider: 'OpenAI',           credits: { '1K': 6,   '2K': 10, '4K': 16 }, starred: true },
]

export type ImageResolution = '1K' | '2K' | '4K'
export type ImageStatus = 'pending' | 'processing' | 'completed' | 'failed'

export async function generateImage(params: {
  apiKey: string
  model: string
  prompt: string
  resolution: ImageResolution
  aspectRatio?: string
}): Promise<{ taskId: string }> {
  const res = await fetch(`${KIE_BASE}/jobs/createTask`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
      input: {
        prompt: params.prompt,
        resolution: params.resolution,
        aspect_ratio: params.aspectRatio ?? '9:16',
      },
    }),
  })
  if (res.status === 402) throw new Error('INSUFFICIENT_CREDITS')
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text)
  }
  const data = await res.json() as { code: number; data: { taskId: string } }
  return { taskId: data.data.taskId }
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
export type Resolution = '720p' | '1080p' | '4k'
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

export async function kieTextGenerate(
  apiKey: string,
  prompt: string,
  systemInstruction?: string,
): Promise<string> {
  const messages: { role: string; content: string }[] = []
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction })
  messages.push({ role: 'user', content: prompt })

  const textModels = ['gpt-4o', 'gemini-2.5-flash', 'gpt-4o-mini']
  let lastError = ''

  for (const model of textModels) {
    const res = await fetch('https://api.kie.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages }),
    })
    if (res.status === 402) throw new Error('INSUFFICIENT_CREDITS')
    if (!res.ok) {
      lastError = `kie.ai text error (${res.status}): ${await res.text().catch(() => res.statusText)}`
      continue
    }
    const data = await res.json() as { choices?: { message?: { content?: string | null; refusal?: string } }[] }
    const msg = data.choices?.[0]?.message
    const content = typeof msg?.content === 'string' ? msg.content.trim() : ''
    if (content) return content
    lastError = msg?.refusal ? `Model ${model} từ chối yêu cầu` : `Model ${model} trả về phản hồi rỗng`
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

  const visionModels = ['gpt-4o', 'gpt-4o-mini']
  let lastError = ''

  for (const model of visionModels) {
    const res = await fetch('https://api.kie.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages }),
    })
    if (res.status === 402) throw new Error('INSUFFICIENT_CREDITS')
    if (!res.ok) {
      lastError = `kie.ai vision error (${res.status}): ${await res.text().catch(() => res.statusText)}`
      continue
    }
    const data = await res.json() as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content
    if (content) return content
    lastError = `Model ${model} trả về phản hồi rỗng`
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
