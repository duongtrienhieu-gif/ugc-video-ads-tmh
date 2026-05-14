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
}

export const VIDEO_MODELS: VideoModel[] = [
  { id: 'seedance_2_0',      name: 'Seedance 2.0',      provider: 'ByteDance',      credits: 205, starred: true, supportsDuration: true, durationOptions: [5, 8, 10, 12] },
  { id: 'seedance_2_0_fast', name: 'Seedance 2.0 Fast', provider: 'ByteDance',      credits: 165,               supportsDuration: true, durationOptions: [5, 8, 10, 12] },
  { id: 'kling_3_0',         name: 'Kling 3.0',         provider: 'Kling AI',       credits: 70,                supportsDuration: true, durationOptions: [5, 8, 10] },
  { id: 'veo3_fast',         name: 'Veo 3.1 Fast',      provider: 'Google',         credits: 60  },
  { id: 'veo3_lite',         name: 'Veo 3.1 Lite',      provider: 'Google',         credits: 30  },
  { id: 'veo3',              name: 'Veo 3.1 Quality',   provider: 'Google',         credits: 250 },
  { id: 'wan_2_7',           name: 'Wan 2.7',           provider: 'Alibaba Tongyi', credits: 80,                supportsDuration: true, durationOptions: [5, 8, 10, 12] },
  { id: 'sora_2',            name: 'Sora 2',            provider: 'OpenAI',         credits: 30  },
  { id: 'sora_2_pro',        name: 'Sora 2 Pro',        provider: 'OpenAI',         credits: 150 },
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
  duration?: number
  startFrameUrl?: string
  endFrameUrl?: string
  referenceImageUrls?: string[]
}): Promise<{ taskId: string }> {
  let generationType = 'TEXT_2_VIDEO'
  const imageUrls: string[] = []

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
    resolution: params.resolution,
    generationType,
  }
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

  const data = await res.json() as { data: { taskId: string } }
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

// ── Text Generation (kie.ai chat completions — OpenAI-compatible) ─────

export async function kieTextGenerate(
  apiKey: string,
  prompt: string,
  systemInstruction?: string,
): Promise<string> {
  const messages: { role: string; content: string }[] = []
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction })
  messages.push({ role: 'user', content: prompt })

  const res = await fetch('https://api.kie.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'gemini-2.5-flash', messages }),
  })
  if (res.status === 402) throw new Error('INSUFFICIENT_CREDITS')
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`kie.ai text error (${res.status}): ${text}`)
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Không có phản hồi từ kie.ai text')
  return content
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

  // gpt-4o-mini has reliable vision support through kie.ai OpenAI-compatible endpoint
  const res = await fetch('https://api.kie.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages }),
  })
  if (res.status === 402) throw new Error('INSUFFICIENT_CREDITS')
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`kie.ai vision error (${res.status}): ${text}`)
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Không có phản hồi từ kie.ai vision')
  return content
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
