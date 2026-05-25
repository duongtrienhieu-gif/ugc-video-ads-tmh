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
  /** P12-fix: opt-in strict JSON mode. When set to 'application/json',
   *  Gemini's generationConfig.responseMimeType forces valid JSON
   *  output — eliminates ~90% of "Unexpected end / Unterminated string"
   *  parse failures at the source. */
  responseMimeType?: 'application/json' | 'text/plain'
  /** Z31-fix: schema-constrained decoding. When provided alongside
   *  responseMimeType='application/json', Gemini guarantees the output
   *  conforms to the schema — eliminates the remaining ~10% of malformed
   *  JSON (unescaped newlines/quotes inside string values). */
  responseSchema?: Record<string, unknown>
  temperature?: number
}): Promise<string> {
  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']
  const errors: string[] = []

  for (const model of modelsToTry) {
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${params.apiKey}`
    const generationConfig: Record<string, unknown> = {
      temperature: params.temperature ?? 0.3,
      maxOutputTokens: params.maxOutputTokens ?? 8192,
    }
    if (params.responseMimeType) generationConfig.responseMimeType = params.responseMimeType
    if (params.responseSchema)   generationConfig.responseSchema   = params.responseSchema
    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: params.prompt }] }],
      generationConfig,
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

/**
 * Batched embedding via text-embedding-004. Free tier ≈ 1500 RPM (vs 10 RPM
 * for Gemini Flash), so semantic similarity scoring runs on a separate budget
 * from generation. Use `taskType` to optimise asymmetric retrieval —
 * 'RETRIEVAL_QUERY' for the search intent, 'RETRIEVAL_DOCUMENT' for the items
 * being ranked.
 */
export async function geminiEmbedBatch(params: {
  apiKey: string
  texts: string[]
  taskType?: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' | 'SEMANTIC_SIMILARITY'
  signal?: AbortSignal
}): Promise<number[][]> {
  if (params.texts.length === 0) return []
  const url = `${GEMINI_BASE}/text-embedding-004:batchEmbedContents?key=${params.apiKey}`
  const taskType = params.taskType ?? 'SEMANTIC_SIMILARITY'
  const body = {
    requests: params.texts.map(text => ({
      model: 'models/text-embedding-004',
      content: { parts: [{ text }] },
      taskType,
    })),
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: params.signal,
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    if (res.status === 429) {
      const { isDailyExhausted } = classifyGemini429(err)
      const e = new Error(`Embedding ${res.status}: ${err.slice(0, 200)}`) as Error & { code?: string }
      e.code = isDailyExhausted ? 'QUOTA_DAILY' : 'RATE_LIMIT'
      throw e
    }
    throw new Error(`Embedding lỗi (${res.status}): ${err.slice(0, 200)}`)
  }
  const data = await res.json() as { embeddings?: Array<{ values: number[] }> }
  return (data.embeddings || []).map(e => e.values)
}

/** Cosine similarity of two equal-length numeric vectors. Returns 0 for empty. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

/**
 * Classify a 429 response body from Gemini. Exported because both
 * `searchWithGrounding` (here) and the app-level callGemini wrapper need
 * the SAME taxonomy so per-minute rate-limits don't get mistakenly surfaced
 * as "daily quota exhausted" banners.
 *
 * Gemini's 429 has TWO distinct meanings:
 *   • Per-minute rate-limit (free tier ~10 RPM) — RECOVERABLE; response
 *     carries QuotaFailure.violations[].quotaId="*PerMinute*" + RetryInfo.
 *   • Per-day token / request quota — NOT recoverable until midnight PT;
 *     quotaId contains "PerDay" or "input_token_count" markers.
 */
export function classifyGemini429(rawBody: string): {
  isDailyExhausted: boolean
  retryDelayMs: number | null
} {
  let isDailyExhausted = false
  let retryDelayMs: number | null = null
  try {
    const parsed = JSON.parse(rawBody) as { error?: { details?: Array<{ '@type'?: string; violations?: Array<{ quotaId?: string; quotaMetric?: string }>; retryDelay?: string }> } }
    const details = parsed.error?.details || []
    for (const d of details) {
      if (d['@type']?.includes('QuotaFailure')) {
        for (const v of d.violations || []) {
          // The PerDay/PerMinute discriminator lives ONLY in quotaId (e.g.
          // "GenerateContentRequestsPerDayPerProjectPerTier-FreeTier" vs
          // "...PerMinute..."). quotaMetric only says WHICH resource (requests
          // vs token_count) and matching on its substrings (e.g.
          // "input_token_count") wrongly flagged per-minute token limits as
          // daily exhaustion — earlier false-positive bug.
          if (/PerDay/i.test(v.quotaId || '')) isDailyExhausted = true
        }
      }
      if (d['@type']?.includes('RetryInfo') && d.retryDelay) {
        const m = String(d.retryDelay).match(/^(\d+(?:\.\d+)?)s/)
        if (m) retryDelayMs = Math.ceil(parseFloat(m[1]) * 1000)
      }
    }
  } catch { /* unparseable body — fall through with defaults */ }
  return { isDailyExhausted, retryDelayMs }
}

/**
 * Gemini text call with Google Search grounding enabled.
 * Returns the model's narrative + the grounding chunks (web search results).
 *
 * Throws plain Error with `.code` field — caller maps to its own error
 * taxonomy. Codes: `QUOTA_DAILY` (per-day exhausted, fatal) | `ABORTED`
 * (signal cancelled) | undefined (other failure, retry exhausted or non-429).
 *
 * Separate from `directGeminiText` because grounding response has a
 * different shape (groundingMetadata) and is incompatible with responseSchema.
 */
export async function searchWithGrounding(params: {
  apiKey: string
  prompt: string
  signal?: AbortSignal
}): Promise<{ narrative: string; chunks: Array<{ uri: string; title?: string }> }> {
  const url = `${GEMINI_BASE}/gemini-2.5-flash:generateContent?key=${params.apiKey}`
  const MAX_ATTEMPTS = 6
  const BASE_DELAY_MS = 2000
  const FACTOR = 1.7
  let lastErr = ''
  for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
    if (params.signal?.aborted) {
      const e = new Error('Đã hủy') as Error & { code?: string }
      e.code = 'ABORTED'
      throw e
    }
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: params.prompt }] }],
          tools: [{ googleSearch: {} }],
        }),
        signal: params.signal,
      })
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        const e = new Error('Đã hủy') as Error & { code?: string }
        e.code = 'ABORTED'
        throw e
      }
      throw err
    }
    if (res.ok) {
      const data = await res.json() as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> }
          groundingMetadata?: { groundingChunks?: Array<{ web?: { uri: string; title?: string } }> }
        }>
      }
      const candidate = data.candidates?.[0]
      const narrative = (candidate?.content?.parts || []).map(p => p.text).filter(Boolean).join('\n').trim()
      const chunks = (candidate?.groundingMetadata?.groundingChunks || []).map(c => c.web).filter((w): w is { uri: string; title?: string } => !!w?.uri)
      return { narrative, chunks }
    }
    lastErr = await res.text().catch(() => '')
    if (res.status === 429) {
      const { isDailyExhausted, retryDelayMs } = classifyGemini429(lastErr)
      if (isDailyExhausted) {
        const e = new Error('Gemini quota daily exhausted') as Error & { code?: string }
        e.code = 'QUOTA_DAILY'
        throw e
      }
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(`Gemini grounding rate-limit kéo dài (đã thử ${MAX_ATTEMPTS + 1} lần)`)
      }
      const delay = retryDelayMs ?? (BASE_DELAY_MS * Math.pow(FACTOR, attempt) + Math.random() * 1000)
      await new Promise(r => setTimeout(r, delay))
      continue
    }
    const retryable = [500, 502, 503, 504].includes(res.status)
    if (!retryable || attempt === MAX_ATTEMPTS) {
      throw new Error(`Gemini grounding lỗi (${res.status}): ${lastErr.slice(0, 200)}`)
    }
    const delay = BASE_DELAY_MS * Math.pow(FACTOR, attempt) + Math.random() * 1000
    await new Promise(r => setTimeout(r, delay))
  }
  throw new Error(`Gemini grounding failed after ${MAX_ATTEMPTS + 1} attempts`)
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
