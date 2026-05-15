// gemini.ts — Compatibility wrapper: routes most calls through kie.ai.
// Vision functions (geminiAnalyzeImage) call Google Gemini REST API directly,
// because kie.ai's vision endpoint consistently returns empty responses.

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

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
}): Promise<string> {
  const modelsToTry = params.model ? [params.model] : GEMINI_MODELS
  const errors: string[] = []

  for (const model of modelsToTry) {
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${params.apiKey}`

    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: params.parts }],
      generationConfig: { temperature: 0.4, maxOutputTokens: params.maxOutputTokens ?? 4096 },
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
