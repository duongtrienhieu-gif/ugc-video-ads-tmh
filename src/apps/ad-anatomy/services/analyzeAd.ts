// analyzeAd.ts
// Primary path: upload the full video to Gemini Files API so Gemini can hear the
// actual audio and produce a verbatim transcript with accurate timestamps.
// Fallback path: extract frames and send as images (no audio — transcript will be
// inferred from visual/on-screen text only).

import type { AnalysisResult } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { blobToSmallBase64 } from '../../../utils/kieai'
import { directGeminiVision } from '../../../utils/gemini'

const GEMINI_UPLOAD_BASE = 'https://generativelanguage.googleapis.com/upload/v1beta'
const GEMINI_API_BASE    = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODELS      = ['gemini-2.5-flash', 'gemini-2.5-flash-preview-05-20', 'gemini-1.5-flash']

// ── System instruction ────────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `Bạn là chuyên gia phân tích quảng cáo video ngắn. Phân tích video quảng cáo và trả về JSON có cấu trúc.

NGÔN NGỮ OUTPUT: Viết TẤT CẢ nội dung phân tích bằng TIẾNG VIỆT — bao gồm analystNote, technique, whyItWorks, adaptableTemplate, pacing, beat descriptions, mô tả visual, weakness, fix, reconstructionPrompt. CHỈ giữ nguyên tiếng gốc cho trường "transcript" (chép lại lời thoại đúng ngôn ngữ nói trong video).

QUY TẮC TRANSCRIPT: Chép lại ĐÚNG TỪNG TỪ lời nói trong audio — bất kể ngôn ngữ là Tiếng Anh, Tiếng Malay, hay Tiếng Việt. KHÔNG bao gồm chữ hiển thị trên màn hình, subtitle, caption, hay text overlay. CHỈ chép lời người thật nói ra. KHÔNG dùng mô tả trong ngoặc như "[Creator nói về sản phẩm]". Timestamps phải chính xác (0:00, 0:03, 0:07, v.v.).

Output CHỈ là JSON hợp lệ — không markdown, không code fence, không giải thích:

{
  "scorecard": {
    "scores": [
      { "label": "Hook Strength", "score": 6 },
      { "label": "Structure Clarity", "score": 7 },
      { "label": "Visual Variety", "score": 5 },
      { "label": "Persuasion Depth", "score": 6 },
      { "label": "Overall Execution", "score": 6 }
    ],
    "analystNote": "Nhận xét 2-3 câu bằng tiếng Việt về chất lượng sáng tạo của quảng cáo."
  },
  "transcript": [
    { "timestamp": "0:00", "text": "lời thoại đúng ngôn ngữ gốc trong video" },
    { "timestamp": "0:05", "text": "câu tiếp theo đúng nguyên văn" }
  ],
  "hookBreakdown": {
    "hookText": "câu hook mở đầu nguyên văn",
    "technique": "tên kỹ thuật hook (tiếng Việt)",
    "whyItWorks": "giải thích tại sao hook này hiệu quả (tiếng Việt)",
    "adaptableTemplate": "mẫu có thể điền vào cho sản phẩm khác (tiếng Việt)"
  },
  "structureMap": {
    "runtime": "0:30",
    "pacing": "mô tả nhịp độ bằng tiếng Việt",
    "beats": [
      { "timestamp": "0:00–0:05", "beat": "Hook", "description": "mô tả đoạn này bằng tiếng Việt", "duration": "5s" }
    ]
  },
  "psychology": {
    "primaryLevers": ["đòn tâm lý 1 (tiếng Việt)", "đòn tâm lý 2"],
    "targetingSignals": ["nhóm khách hàng mục tiêu 1 (tiếng Việt)", "nhóm 2"]
  },
  "visualPlaybook": [
    { "timestamp": "0:00–0:05", "description": "mô tả hình ảnh bằng tiếng Việt", "prompt": "image prompt tiếng Anh để tái tạo cảnh này" }
  ],
  "improvements": [
    { "weakness": "điểm yếu của quảng cáo (tiếng Việt)", "fix": "cách khắc phục cụ thể (tiếng Việt)" }
  ],
  "reconstructionPrompt": "Prompt chi tiết bằng tiếng Anh mô tả toàn bộ cấu trúc sáng tạo của quảng cáo này để có thể tái tạo cho sản phẩm bất kỳ."
}

Điểm số dùng số nguyên 1-10. Hầu hết quảng cáo đạt 4-7. Chỉ cho 9-10 cho tác phẩm xuất sắc.`

// ── Gemini Files API helpers ──────────────────────────────────────────────────

/**
 * Upload a video file to Gemini Files API using multipart upload.
 * Returns { fileUri, fileName } on success.
 */
async function uploadVideoToGemini(
  apiKey: string,
  videoFile: File,
): Promise<{ fileUri: string; fileName: string }> {
  const mimeType  = videoFile.type || 'video/mp4'
  const boundary  = 'GeminiBoundary' + Date.now().toString(36)
  const metaJson  = JSON.stringify({ file: { display_name: videoFile.name || 'ad-video.mp4' } })

  // Build multipart/related body manually so we stay in a single fetch call
  const enc       = new TextEncoder()
  const metaPart  = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n${metaJson}\r\n`)
  const filePart  = enc.encode(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`)
  const closing   = enc.encode(`\r\n--${boundary}--`)
  const fileBytes = new Uint8Array(await videoFile.arrayBuffer())

  const body = new Uint8Array(metaPart.length + filePart.length + fileBytes.length + closing.length)
  body.set(metaPart,  0)
  body.set(filePart,  metaPart.length)
  body.set(fileBytes, metaPart.length + filePart.length)
  body.set(closing,   metaPart.length + filePart.length + fileBytes.length)

  const res = await fetch(
    `${GEMINI_UPLOAD_BASE}/files?uploadType=multipart&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    },
  )

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Upload video thất bại (${res.status}): ${err.slice(0, 200)}`)
  }

  const data = await res.json() as { file?: { uri?: string; name?: string } }
  const fileUri  = data.file?.uri
  const fileName = data.file?.name

  if (!fileUri || !fileName) throw new Error('Gemini Files API không trả về URI')
  return { fileUri, fileName }
}

/**
 * Poll file status until ACTIVE (ready for inference).
 */
async function waitForFileActive(
  apiKey: string,
  fileName: string,
  maxWaitMs = 120_000,
): Promise<void> {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    const res  = await fetch(`${GEMINI_API_BASE}/${fileName}?key=${apiKey}`)
    if (!res.ok) throw new Error('Không thể kiểm tra trạng thái file')
    const data = await res.json() as { state?: string }
    if (data.state === 'ACTIVE') return
    if (data.state === 'FAILED') throw new Error('Gemini không xử lý được video này')
    await new Promise((r) => setTimeout(r, 3000))
  }
  throw new Error('Xử lý video quá thời gian (>2 phút)')
}

/** Fire-and-forget file deletion — don't block the caller. */
function deleteGeminiFile(apiKey: string, fileName: string): void {
  fetch(`${GEMINI_API_BASE}/${fileName}?key=${apiKey}`, { method: 'DELETE' }).catch(() => {})
}

/**
 * Call generateContent with a Gemini Files API file URI so the model can
 * process both video and audio tracks.
 */
async function analyzeWithVideoFile(
  apiKey: string,
  fileUri: string,
  mimeType: string,
): Promise<string> {
  const errors: string[] = []

  for (const model of GEMINI_MODELS) {
    const url  = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`
    const body = {
      contents: [{
        role: 'user',
        parts: [
          { fileData: { mimeType, fileUri } },
          {
            text: 'Lắng nghe audio của video và chép lại ĐÚNG TỪNG TỪ lời nói — bất kể ngôn ngữ là Tiếng Anh, Tiếng Malay, hay Tiếng Việt. '
              + 'KHÔNG bao gồm chữ hiển thị trên màn hình, subtitle, caption. Chỉ lời người thật nói. '
              + 'Toàn bộ phân tích viết bằng Tiếng Việt (trừ transcript giữ nguyên ngôn ngữ gốc). '
              + 'Trả về JSON phân tích đầy đủ.',
          },
        ],
      }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 16384 },
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    }

    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText)
      if (res.status === 404 || res.status === 429 || res.status === 503) {
        errors.push(`${model}: ${res.status}`)
        continue
      }
      throw new Error(`Gemini API lỗi (${res.status}): ${err.slice(0, 200)}`)
    }

    const data = await res.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
    if (!text) { errors.push(`${model}: phản hồi rỗng`); continue }
    return text
  }

  throw new Error(errors.length ? errors.join(' | ') : 'Không có model khả dụng')
}

// ── Frame-extraction fallback ─────────────────────────────────────────────────

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve() }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = time
  })
}

function captureFrameBlob(video: HTMLVideoElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const scale  = Math.min(1, 640 / (video.videoWidth || 640))
    canvas.width  = Math.round((video.videoWidth  || 640) * scale)
    canvas.height = Math.round((video.videoHeight || 480) * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) { reject(new Error('canvas')); return }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => { if (blob) resolve(blob); else reject(new Error('toBlob failed')) },
      'image/jpeg', 0.75,
    )
  })
}

async function extractFrames(videoFile: File, maxFrames = 6): Promise<Blob[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url   = URL.createObjectURL(videoFile)
    video.muted   = true
    video.preload = 'auto'

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration || 10
        const count    = Math.min(maxFrames, Math.max(1, Math.ceil(duration / 3)))
        const blobs: Blob[] = []
        for (let i = 0; i < count; i++) {
          const t = i === 0 ? 0.5 : Math.min((duration / count) * i, duration - 0.2)
          await seekVideo(video, t)
          blobs.push(await captureFrameBlob(video))
        }
        URL.revokeObjectURL(url)
        resolve(blobs)
      } catch (e) { URL.revokeObjectURL(url); reject(e) }
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Không thể tải video. Hãy thử file MP4 khác.'))
    }

    video.src = url
    video.load()
  })
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function analyzeAd(videoFile: File): Promise<AnalysisResult> {
  const geminiKey = useSettingsStore.getState().getGeminiApiKey()
  let responseText = ''
  let uploadedFileName: string | null = null

  // ── Primary: upload video so Gemini can hear the audio ───────────────────
  try {
    const mimeType               = videoFile.type || 'video/mp4'
    const { fileUri, fileName }  = await uploadVideoToGemini(geminiKey, videoFile)
    uploadedFileName             = fileName

    await waitForFileActive(geminiKey, fileName)
    responseText = await analyzeWithVideoFile(geminiKey, fileUri, mimeType)
  } catch (uploadErr) {
    console.warn('[analyzeAd] Video upload path failed, falling back to frames:', uploadErr)

    // ── Fallback: frames only (no audio — transcript will be visual-only) ──
    const frameBlobs    = await extractFrames(videoFile, 4)
    const base64Frames  = await Promise.all(frameBlobs.map((b) => blobToSmallBase64(b, 400)))
    const imageParts    = base64Frames.map((b64) => ({
      inlineData: { mimeType: 'image/jpeg', data: b64 },
    }))
    const textPart = {
      text: `These are ${base64Frames.length} frames from a video ad (audio not available in this mode). `
        + 'For transcript, extract only what is visible as on-screen text overlays — do not invent dialogue. '
        + 'Return the full JSON analysis.',
    }

    responseText = await directGeminiVision({
      apiKey: geminiKey,
      parts: [...imageParts, textPart],
      systemInstruction: SYSTEM_INSTRUCTION,
    })
  } finally {
    // Always clean up the uploaded file (non-blocking)
    if (uploadedFileName) deleteGeminiFile(geminiKey, uploadedFileName)
  }

  if (!responseText.trim()) throw new Error('Không có phản hồi từ AI. Vui lòng thử lại.')

  return parseAnalysisJson(responseText)
}

// ── Robust JSON parsing for Gemini responses ──────────────────────────────────

function parseAnalysisJson(raw: string): AnalysisResult {
  let cleaned = raw.trim()

  // Strip markdown code fences if present
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim()

  // Extract outermost { ... } block (handles cases where Gemini adds prose around JSON)
  const firstBrace = cleaned.indexOf('{')
  const lastBrace  = cleaned.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1)
  }

  // First attempt: as-is
  try {
    return JSON.parse(cleaned) as AnalysisResult
  } catch { /* fall through to repair */ }

  // Second attempt: repair common Gemini JSON errors
  const repaired = repairJson(cleaned)
  try {
    return JSON.parse(repaired) as AnalysisResult
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    throw new Error(`AI trả về JSON không hợp lệ. ${err}. Vui lòng thử lại.`)
  }
}

/**
 * Repair common JSON issues from LLM responses:
 * - Trailing commas before } or ]
 * - Unescaped control chars inside strings
 * - Truncated JSON (response cut off mid-stream) — close open brackets/strings
 */
function repairJson(input: string): string {
  let s = input

  // Remove trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, '$1')

  // Walk through strings: escape raw control chars, track open brackets/strings
  let out = ''
  let inString = false
  let escape = false
  const stack: string[] = []   // tracks open { and [

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (escape) { out += ch; escape = false; continue }
    if (ch === '\\') { out += ch; escape = true; continue }
    if (ch === '"') {
      inString = !inString
      out += ch
      continue
    }
    if (inString) {
      const code = ch.charCodeAt(0)
      if      (ch === '\n') out += '\\n'
      else if (ch === '\r') out += '\\r'
      else if (ch === '\t') out += '\\t'
      else if (code < 0x20) out += '\\u' + code.toString(16).padStart(4, '0')
      else out += ch
    } else {
      if (ch === '{' || ch === '[') stack.push(ch)
      else if (ch === '}' || ch === ']') stack.pop()
      out += ch
    }
  }

  // If response was truncated mid-string, close the open string
  if (inString) out += '"'

  // Remove trailing comma before we close brackets
  out = out.replace(/,\s*$/, '')

  // Close any unclosed brackets in reverse order
  while (stack.length > 0) {
    const open = stack.pop()
    out += open === '{' ? '}' : ']'
  }

  return out
}
