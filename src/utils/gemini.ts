// gemini.ts — Compatibility wrapper: routes most calls through kie.ai.
// Vision functions (geminiAnalyzeImage) call Google Gemini REST API directly,
// because kie.ai's vision endpoint consistently returns empty responses.

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const GEMINI_FILES_BASE = 'https://generativelanguage.googleapis.com/v1beta/files'
const GEMINI_FILES_UPLOAD = 'https://generativelanguage.googleapis.com/upload/v1beta/files'

/**
 * Upload a file to Gemini Files API via the RESUMABLE upload protocol.
 * More reliable than multipart for large files (up to 2GB). Used for video
 * inputs that exceed the 20MB inline-data limit.
 *
 * Two-step protocol:
 *  1) POST init request with metadata JSON + X-Goog-Upload-Protocol: resumable
 *     → Google returns an upload URL in the X-Goog-Upload-URL header
 *  2) POST file bytes to that URL with X-Goog-Upload-Command: upload, finalize
 *     → Google returns the file resource (with state usually PROCESSING)
 *  3) Poll the file's GET endpoint until state === ACTIVE (video transcoding
 *     takes 5-30s on Google's side)
 *
 * Files auto-expire after 48 hours.
 */
export async function uploadFileToGemini(params: {
  apiKey: string
  file: Blob
  displayName?: string
  onProgress?: (status: 'uploading' | 'processing' | 'active') => void
  timeoutMs?: number
}): Promise<{ fileUri: string; mimeType: string }> {
  const { apiKey, file, displayName, onProgress } = params
  const timeoutMs = params.timeoutMs ?? 5 * 60 * 1000
  const mimeType = file.type || 'application/octet-stream'

  onProgress?.('uploading')

  // ── Step 1a: Initiate resumable upload session ─────────────────────
  const initRes = await fetch(`${GEMINI_FILES_UPLOAD}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol':            'resumable',
      'X-Goog-Upload-Command':             'start',
      'X-Goog-Upload-Header-Content-Length': String(file.size),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type':                      'application/json',
    },
    body: JSON.stringify({ file: { display_name: displayName ?? 'upload' } }),
  })
  if (!initRes.ok) {
    const err = await initRes.text().catch(() => initRes.statusText)
    throw new Error(`Files API init thất bại (${initRes.status}): ${err.slice(0, 200)}`)
  }
  const uploadUrl = initRes.headers.get('X-Goog-Upload-URL') || initRes.headers.get('x-goog-upload-url')
  if (!uploadUrl) {
    throw new Error('Files API không trả về upload URL trong header')
  }

  // ── Step 1b: Upload binary to the returned URL ─────────────────────
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Offset':  '0',
      'X-Goog-Upload-Command': 'upload, finalize',
      'Content-Type':          mimeType,
    },
    body: file,
  })
  if (!uploadRes.ok) {
    const err = await uploadRes.text().catch(() => uploadRes.statusText)
    throw new Error(`Files API upload thất bại (${uploadRes.status}): ${err.slice(0, 200)}`)
  }
  const uploadData = await uploadRes.json() as {
    file?: { name?: string; uri?: string; state?: string; mimeType?: string }
  }
  if (!uploadData.file?.name || !uploadData.file?.uri) {
    throw new Error('Files API không trả về file URI sau upload')
  }
  const fileName = uploadData.file.name              // e.g. "files/abc123"
  const fileUri  = uploadData.file.uri
  const fileMime = uploadData.file.mimeType ?? mimeType

  // If already ACTIVE (small files / images), return immediately
  if (uploadData.file.state === 'ACTIVE') {
    onProgress?.('active')
    return { fileUri, mimeType: fileMime }
  }

  // ── Step 2: Poll until state === ACTIVE ────────────────────────────
  onProgress?.('processing')
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 3000))
    const statusRes = await fetch(`${GEMINI_FILES_BASE}/${fileName.replace(/^files\//, '')}?key=${apiKey}`)
    if (!statusRes.ok) continue
    const statusData = await statusRes.json() as { state?: string; uri?: string; mimeType?: string }
    if (statusData.state === 'ACTIVE') {
      onProgress?.('active')
      return { fileUri: statusData.uri ?? fileUri, mimeType: statusData.mimeType ?? fileMime }
    }
    if (statusData.state === 'FAILED') {
      throw new Error('Files API processing FAILED — file có thể corrupt hoặc format không support')
    }
  }
  throw new Error('Files API timeout — file vẫn đang processing sau 5 phút')
}

/**
 * Direct Google Gemini vision call.
 * Sends one or more base64 images and returns the model's text response.
 */
// Models tried in order — newest first, more fallbacks for high-load periods
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function directGeminiVision(params: {
  apiKey: string
  parts: Array<{ inlineData: { mimeType: string; data: string } } | { fileData: { mimeType: string; fileUri: string } } | { text: string }>
  systemInstruction?: string
  model?: string
  maxOutputTokens?: number
  responseMimeType?: 'application/json' | 'text/plain'
  responseSchema?: Record<string, unknown>
}): Promise<string> {
  const modelsToTry = params.model ? [params.model] : GEMINI_MODELS
  const errors: string[] = []

  for (const model of modelsToTry) {
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${params.apiKey}`

    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: params.parts }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: params.maxOutputTokens ?? 4096,
        ...(params.responseMimeType && { responseMimeType: params.responseMimeType }),
        ...(params.responseSchema  && { responseSchema:  params.responseSchema  }),
      },
    }
    if (params.systemInstruction) {
      body.systemInstruction = { parts: [{ text: params.systemInstruction }] }
    }

    // Retry same model up to 2 times on 503 overload
    let res: Response | null = null
    let attempts = 0
    while (attempts < 2) {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status !== 503 || attempts === 1) break
      attempts++
      await sleep(3000) // back off before retrying overloaded model
    }
    if (!res) continue

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText)
      if (res.status === 404) {
        errors.push(`${model}: không khả dụng`)
        continue
      }
      if (res.status === 429 || res.status === 503) {
        errors.push(`${model}: ${res.status === 503 ? 'quá tải' : 'rate limit'}`)
        await sleep(1500) // brief pause before trying next model
        continue
      }
      throw new Error(`Gemini API lỗi (${res.status}): ${err.slice(0, 200)}`)
    }

    const data = await res.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
      error?: { message?: string }
    }

    if (data.error?.message) { errors.push(`${model}: ${data.error.message}`); continue }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
    if (!text) { errors.push(`${model}: phản hồi rỗng`); continue }
    return text
  }

  throw new Error(errors.length ? errors.join(' | ') : 'Gemini: không có model khả dụng')
}

/**
 * Direct Google Gemini text-only call — bypasses kie.ai routing.
 * Use this when kie.ai models return empty responses for complex JSON tasks.
 */
export async function directGeminiText(params: {
  apiKey: string
  prompt: string
  systemInstruction?: string
  maxOutputTokens?: number
}): Promise<string> {
  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']
  const errors: string[] = []

  for (const model of modelsToTry) {
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${params.apiKey}`
    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: params.prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: params.maxOutputTokens ?? 8192 },
    }
    if (params.systemInstruction) {
      body.systemInstruction = { parts: [{ text: params.systemInstruction }] }
    }

    let res: Response | null = null
    let attempts = 0
    while (attempts < 2) {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status !== 503 || attempts === 1) break
      attempts++
      await sleep(3000)
    }
    if (!res) continue

    if (!res.ok) {
      const err = await res.text().catch(() => res!.statusText)
      if (res.status === 404) { errors.push(`${model}: không khả dụng`); continue }
      if (res.status === 429 || res.status === 503) {
        errors.push(`${model}: ${res.status === 503 ? 'quá tải' : 'rate limit'}`)
        await sleep(1500)
        continue
      }
      throw new Error(`Gemini text API lỗi (${res.status}): ${err.slice(0, 200)}`)
    }

    const data = await res.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
    if (!text) { errors.push(`${model}: phản hồi rỗng`); continue }
    return text
  }

  throw new Error(errors.length ? errors.join(' | ') : 'Gemini text: không có model khả dụng')
}

import {
  kieTextGenerate,
  kieAnalyzeImage,
  kieTTS,
  generateImage as kieGenerateImage,
  pollImageUntilDone as kiePollImage,
  generateVideo as kieGenerateVideo,
  pollVideoUntilDone as kiePollVideo,
} from './kieai'

// ── Text Generation ───────────────────────────────────────────────────

export async function geminiTextGenerate(
  apiKey: string,
  prompt: string,
  systemInstruction?: string,
): Promise<string> {
  return kieTextGenerate(apiKey, prompt, systemInstruction)
}

// ── Image Analysis ────────────────────────────────────────────────────

export async function geminiAnalyzeImage(
  apiKey: string,
  prompt: string,
  imageBase64: string,
  imageMimeType: string,
  systemInstruction?: string,
): Promise<string> {
  return kieAnalyzeImage(apiKey, imageBase64, imageMimeType, prompt, systemInstruction)
}

// ── Text-to-Speech ────────────────────────────────────────────────────

export interface TTSResult {
  audioBase64: string
  mimeType: string
}

export async function geminiTTS(
  apiKey: string,
  text: string,
  voiceName: string,
): Promise<TTSResult> {
  const buffer = await kieTTS({ apiKey, text, voiceId: voiceName.toLowerCase() })
  const uint8 = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i])
  return { audioBase64: btoa(binary), mimeType: 'audio/mpeg' }
}

// ── Image Generation ──────────────────────────────────────────────────

export interface GeneratedImageResult {
  base64: string
  mimeType: string
}

export async function geminiImageGenerate(
  apiKey: string,
  prompt: string,
  aspectRatio: string = '9:16',
  _referenceImages?: Array<{ base64: string; mimeType: string }>,
): Promise<GeneratedImageResult> {
  const aspect = (aspectRatio === '9:16' || aspectRatio === '16:9') ? aspectRatio : '9:16'
  const { taskId } = await kieGenerateImage({
    apiKey,
    model: 'nano-banana-2',
    prompt,
    resolution: '1K',
    aspectRatio: aspect,
  })
  const remoteUrl = await kiePollImage({ apiKey, taskId, timeoutMs: 3 * 60 * 1000 })
  const res = await fetch(remoteUrl)
  const blob = await res.blob()
  const buffer = await blob.arrayBuffer()
  const uint8 = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i])
  return { base64: btoa(binary), mimeType: blob.type || 'image/jpeg' }
}

// ── Video Generation ──────────────────────────────────────────────────

export async function geminiVideoGenerate(
  apiKey: string,
  prompt: string,
  _imageBase64: string,
  _imageMimeType: string,
  aspectRatio: string = '9:16',
): Promise<Blob> {
  const aspect = (aspectRatio === '9:16' || aspectRatio === '16:9')
    ? (aspectRatio as '9:16' | '16:9')
    : '9:16'
  const { taskId } = await kieGenerateVideo({
    apiKey,
    model: 'seedance_2_0_fast',
    prompt,
    aspectRatio: aspect,
    resolution: '720p',
  })
  const videoUrl = await kiePollVideo({ apiKey, taskId, timeoutMs: 5 * 60 * 1000 })
  const res = await fetch(videoUrl)
  return res.blob()
}

// ── Utility ───────────────────────────────────────────────────────────

export function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve({ base64, mimeType: file.type })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
