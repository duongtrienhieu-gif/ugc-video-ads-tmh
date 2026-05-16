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

const SYSTEM_INSTRUCTION = `BẠN LÀ: AI CREATIVE DIRECTOR + MEDIA BUYER ASSISTANT (không phải chỉ "AI analyst").

NHIỆM VỤ: phân tích quảng cáo video ngắn theo góc nhìn người chạy ads thực thụ — đưa ra:
1. Điểm số có lý do + cách cải thiện
2. Decision Layer: verdict SCALE/TEST/ITERATE/KILL + recommended tests + DO-NOT-TEST
3. Ad angle + Market awareness + Funnel position + Scaling potential
4. Retention heatmap (timeline drop risk per 2-5s segment)

QUAN TRỌNG NHẤT — NGÔN NGỮ: Toàn bộ nội dung phân tích PHẢI viết bằng TIẾNG VIỆT. NGOẠI LỆ:
- "transcript" — chép nguyên văn lời nói trong video (Malay/Anh/Việt nguyên gốc)
- "visualPlaybook[].prompt" — prompt tạo ảnh AI (English vì feed image-gen)
- Các enum/key cố định: "scientific-authority", "problem-solution", "natural-healing", "social-proof", "transformation", "comparison", "testimonial", "curiosity-loop", "fear-loss", "lifestyle-aspiration" | "unaware", "problem-aware", "solution-aware", "product-aware", "most-aware" | "TOF-cold", "MOF-warm", "BOF-retarget" | "SCALE", "TEST_MORE", "ITERATE", "KILL" | "HIGH", "MEDIUM", "LOW"
Tất cả mô tả/reasoning/rationale/note/title PHẢI là tiếng Việt.

OUTPUT: CHỈ là JSON thuần, không markdown, không code fence. Cấu trúc:

{
  "scorecard": {
    "scores": [
      { "label": "Hook Strength", "score": 7.4, "reason": "TIẾNG VIỆT: 1 câu — vì sao điểm này", "howToImprove": "TIẾNG VIỆT: 1 câu — cách nâng điểm cụ thể" },
      { "label": "Structure Clarity", "score": 6.8, "reason": "...", "howToImprove": "..." },
      { "label": "Visual Variety", "score": 5.2, "reason": "...", "howToImprove": "..." },
      { "label": "Persuasion Depth", "score": 6.5, "reason": "...", "howToImprove": "..." },
      { "label": "Overall Execution", "score": 6.7, "reason": "...", "howToImprove": "..." }
    ],
    "analystNote": "TIẾNG VIỆT: nhận xét 2-3 câu tổng quan"
  },
  "transcript": [
    { "timestamp": "0:00", "text": "GIỮ NGUYÊN NGÔN NGỮ GỐC" }
  ],
  "hookBreakdown": {
    "hookText": "nguyên văn",
    "technique": "TIẾNG VIỆT",
    "whyItWorks": "TIẾNG VIỆT",
    "adaptableTemplate": "TIẾNG VIỆT"
  },
  "structureMap": {
    "runtime": "0:30",
    "pacing": "TIẾNG VIỆT",
    "beats": [
      { "timestamp": "0:00–0:05", "beat": "Hook", "description": "TIẾNG VIỆT", "duration": "5s" }
    ]
  },
  "psychology": {
    "primaryLevers": ["TIẾNG VIỆT"],
    "targetingSignals": ["TIẾNG VIỆT"]
  },
  "visualPlaybook": [
    { "timestamp": "0:00–0:05", "description": "TIẾNG VIỆT", "prompt": "ENGLISH ONLY" }
  ],
  "improvements": [
    { "weakness": "TIẾNG VIỆT", "fix": "TIẾNG VIỆT" }
  ],
  "reconstructionPrompt": "TIẾNG VIỆT: directive đầy đủ để tái tạo",

  "decisionLayer": {
    "verdict": "SCALE" | "TEST_MORE" | "ITERATE" | "KILL",
    "scaleAction": "TIẾNG VIỆT: 1 câu — hành động cụ thể nên làm NGAY",
    "recommendedTests": ["TIẾNG VIỆT: variant 1 nên test", "variant 2", "variant 3"],
    "doNotTest": ["TIẾNG VIỆT: variant nên TRÁNH test (lãng phí ngân sách)"],
    "fixPriority": [
      { "rank": 1, "title": "TIẾNG VIỆT: tên fix ngắn", "expectedImpact": "TIẾNG VIỆT: CTR +15% / Retention +20% / Trust +1 điểm" },
      { "rank": 2, "title": "...", "expectedImpact": "..." },
      { "rank": 3, "title": "...", "expectedImpact": "..." }
    ]
  },

  "adAngle": {
    "primary": "scientific-authority",
    "secondary": "problem-solution",
    "supporting": "natural-healing",
    "rationale": "TIẾNG VIỆT: 1-2 câu vì sao gọi angle này là primary"
  },

  "marketAwareness": {
    "level": "problem-aware",
    "rationale": "TIẾNG VIỆT: 1 câu",
    "recommendation": "TIẾNG VIỆT: ad này phù hợp / cần đổi gì để đánh đúng audience"
  },

  "funnelPosition": {
    "bestFor": "TOF-cold",
    "weakFor": ["BOF-retarget"],
    "reasoning": "TIẾNG VIỆT: 1-2 câu"
  },

  "scalingPotential": {
    "tier": "HIGH" | "MEDIUM" | "LOW",
    "score": 8.2,
    "scalingFactors": ["TIẾNG VIỆT: lý do dễ scale 1", "lý do 2", "lý do 3"],
    "blockers": ["TIẾNG VIỆT: chặn scale 1 (vd. cần educate audience nhiều)", "chặn 2"]
  },

  "retentionTimeline": {
    "segments": [
      { "timestamp": "0:00-0:03", "retentionScore": 92, "risk": "LOW", "note": "TIẾNG VIỆT: pattern interrupt mạnh, hook tốt" },
      { "timestamp": "0:03-0:08", "retentionScore": 80, "risk": "LOW", "note": "..." },
      { "timestamp": "0:08-0:14", "retentionScore": 55, "risk": "MEDIUM", "note": "TIẾNG VIỆT: pacing chậm — pain quá dài" },
      { "timestamp": "0:14-0:22", "retentionScore": 70, "risk": "LOW", "note": "..." },
      { "timestamp": "0:22-0:30", "retentionScore": 60, "risk": "MEDIUM", "note": "TIẾNG VIỆT: CTA fatigue risk" }
    ],
    "overallDiagnosis": "TIẾNG VIỆT: 1-2 câu — pacing chung",
    "criticalDrops": ["0:08-0:14", "0:22-0:30"]
  }
}

QUY TẮC ĐIỂM SỐ:
- Số THẬP PHÂN 1 chữ số sau dấu chấm (vd: 7.4, 6.8), KHÔNG round về số nguyên
- Phần lớn quảng cáo: 4.0-7.5. Chỉ cho >8.5 khi thực sự xuất sắc
- KHÔNG cho tất cả 5 điểm giống nhau (chứng tỏ chưa phân tích thật)

QUY TẮC RETENTION TIMELINE:
- 5-10 segments tuỳ độ dài video (video 30s → ~5-6 segments mỗi 5s)
- retentionScore là ƯỚC LƯỢNG (0-100) dựa trên hook strength + pacing + visual variety của segment đó
- HIGH risk = score < 50, MEDIUM = 50-70, LOW = >70

QUY TẮC DECISION LAYER:
- recommendedTests: ưu tiên các test có TÁC ĐỘNG CAO (vd. "tăng pace 2s đầu", "đổi CTA thành urgency", "test female testimonial variant")
- doNotTest: liệt kê các test KHÔNG nên làm (vd. "không test intro dài hơn", "không test technical medical explanation")
- fixPriority: ĐÚNG 3 mục, rank 1-2-3 theo impact giảm dần`

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
            text: 'Phân tích video quảng cáo này.\n\n'
              + 'TRANSCRIPT: Lắng nghe audio và chép lại ĐÚNG TỪNG TỪ lời người nói — bất kể ngôn ngữ Malay/Anh/Việt. KHÔNG chép chữ trên màn hình, subtitle, caption. Chỉ lời người thật nói.\n\n'
              + 'NGÔN NGỮ OUTPUT: TOÀN BỘ nội dung phân tích (analystNote, technique, whyItWorks, adaptableTemplate, pacing, beat descriptions, description, primaryLevers, targetingSignals, weakness, fix, reconstructionPrompt) PHẢI viết bằng TIẾNG VIỆT. Chỉ trường transcript giữ nguyên ngôn ngữ gốc, và visualPlaybook.prompt giữ tiếng Anh.\n\n'
              + 'Trả về JSON đầy đủ.',
          },
        ],
      }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 24576 },
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
      text: `Đây là ${base64Frames.length} frame từ video quảng cáo (chế độ không có audio). `
        + 'Transcript: chỉ chép chữ text overlay thực sự hiển thị trên màn hình, không bịa lời thoại. '
        + 'NGÔN NGỮ OUTPUT: TOÀN BỘ phân tích PHẢI viết bằng TIẾNG VIỆT — analystNote, technique, whyItWorks, adaptableTemplate, pacing, descriptions, primaryLevers, targetingSignals, weakness, fix, reconstructionPrompt đều bằng tiếng Việt. Chỉ visualPlaybook.prompt giữ tiếng Anh. '
        + 'Trả về JSON đầy đủ.',
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
