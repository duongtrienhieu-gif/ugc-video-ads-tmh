// analyzeAd.ts
// Primary path: upload the full video to Gemini Files API so Gemini can hear the
// actual audio and produce a verbatim transcript with accurate timestamps.
// Fallback path: extract frames and send as images (no audio — transcript will be
// inferred from visual/on-screen text only).
//
// Z21 — REAL DURATION. The browser measures the video file's true duration with
// HTMLVideoElement.duration BEFORE the Gemini call. That number gets injected
// into the user prompt and then HARD-OVERRIDES structureMap.runtime + reformats
// retentionTimeline segments on the parsed result. AI is no longer trusted to
// guess "0:30" when the video is actually 0:57.

import type { AnalysisResult, StructureBeat, RetentionSegment, Improvement } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { blobToSmallBase64 } from '../../../utils/kieai'
import { directGeminiVision } from '../../../utils/gemini'

// ── Real-duration helpers ────────────────────────────────────────────────────

/** Measure the true playback duration of a video file in the browser. Returns
 *  null when the metadata can't be read (corrupt file etc.). Resolves under
 *  ~1s for any reasonable mp4/mov/webm — we just need `loadedmetadata`. */
export function measureVideoDurationSec(videoFile: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(videoFile)
    let resolved = false
    const cleanup = (val: number | null) => {
      if (resolved) return
      resolved = true
      URL.revokeObjectURL(url)
      resolve(val)
    }
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () => {
      const d = video.duration
      cleanup(isFinite(d) && d > 0 ? d : null)
    }
    video.onerror = () => cleanup(null)
    // Safety timeout — never hang the analyze flow
    setTimeout(() => cleanup(null), 8000)
    video.src = url
    video.load()
  })
}

/** Format seconds as "M:SS" — used everywhere the AI expected a runtime string. */
function fmtMSS(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${String(ss).padStart(2, '0')}`
}

const GEMINI_UPLOAD_BASE = 'https://generativelanguage.googleapis.com/upload/v1beta'
const GEMINI_API_BASE    = 'https://generativelanguage.googleapis.com/v1beta'
// 2026-07-01: gemini-1.5-flash + preview-05-20 retired → alias -latest LIVE.
const GEMINI_MODELS      = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest']

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
  realDurationSec: number | null,
): Promise<string> {
  const errors: string[] = []

  // Z21 — inject the measured runtime into the user prompt so Gemini stops
  // hardcoding "0:30" from the schema example. We also tell it the exact
  // number of segments to produce in retentionTimeline + the timestamp
  // format to use for transcript lines.
  const durationDirective = realDurationSec && realDurationSec > 0
    ? `\n\nVIDEO RUNTIME — CHÍNH XÁC: ${realDurationSec.toFixed(1)} giây (= ${fmtMSS(realDurationSec)}).
   • structureMap.runtime PHẢI là "${fmtMSS(realDurationSec)}" — KHÔNG được dùng 0:30 trong ví dụ schema.
   • structureMap.beats: chia đều khắp toàn bộ ${fmtMSS(realDurationSec)} — beat cuối phải kết thúc đúng tại ${fmtMSS(realDurationSec)}, KHÔNG dừng sớm ở 0:30.
   • retentionTimeline.segments: tạo ${Math.max(5, Math.min(10, Math.ceil(realDurationSec / 5)))} segment phủ kín 0:00 → ${fmtMSS(realDurationSec)}.
   • transcript.timestamp: dùng định dạng "M:SS" theo audio THỰC — không chia đều mỗi 5s, lấy đúng thời điểm câu nói bắt đầu trong audio.`
    : ''

  for (const model of GEMINI_MODELS) {
    const url  = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`
    const body = {
      contents: [{
        role: 'user',
        parts: [
          { fileData: { mimeType, fileUri } },
          {
            text: 'Phân tích video quảng cáo này.\n\n'
              + 'TRANSCRIPT: Lắng nghe audio và chép lại ĐÚNG TỪNG TỪ lời người nói — bất kể ngôn ngữ Malay/Anh/Việt. KHÔNG chép chữ trên màn hình, subtitle, caption. Chỉ lời người thật nói. Mỗi dòng transcript dùng timestamp THỰC tại thời điểm câu nói BẮT ĐẦU trong audio (M:SS), không chia đều cứng 5s/dòng.\n\n'
              + 'NGÔN NGỮ OUTPUT: TOÀN BỘ nội dung phân tích (analystNote, technique, whyItWorks, adaptableTemplate, pacing, beat descriptions, description, primaryLevers, targetingSignals, weakness, fix, reconstructionPrompt) PHẢI viết bằng TIẾNG VIỆT. Chỉ trường transcript giữ nguyên ngôn ngữ gốc, và visualPlaybook.prompt giữ tiếng Anh.\n\n'
              + 'BẮT BUỘC: improvements PHẢI có ít nhất 3 mục cụ thể với weakness + fix tiếng Việt rõ ràng. reconstructionPrompt PHẢI là một đoạn directive đầy đủ (50-200 từ) mô tả cách tái tạo concept này cho sản phẩm khác.'
              + durationDirective
              + '\n\nTrả về JSON đầy đủ.',
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

  // Z21 — measure the real duration in PARALLEL with the video upload so the
  // total flow doesn't get slower. Both finish within seconds; we await both
  // before kicking off the actual Gemini analysis call that needs the number.
  const durationPromise = measureVideoDurationSec(videoFile)

  // ── Primary: upload video so Gemini can hear the audio ───────────────────
  try {
    const mimeType               = videoFile.type || 'video/mp4'
    const { fileUri, fileName }  = await uploadVideoToGemini(geminiKey, videoFile)
    uploadedFileName             = fileName

    await waitForFileActive(geminiKey, fileName)
    const realDurationSec = await durationPromise
    responseText = await analyzeWithVideoFile(geminiKey, fileUri, mimeType, realDurationSec)

    if (!responseText.trim()) throw new Error('Không có phản hồi từ AI. Vui lòng thử lại.')
    const parsed = parseAnalysisJson(responseText)
    return normalizeAnalysisResult(parsed, realDurationSec)
  } catch (uploadErr) {
    console.warn('[analyzeAd] Video upload path failed, falling back to frames:', uploadErr)

    // ── Fallback: frames only (no audio — transcript will be visual-only) ──
    const frameBlobs    = await extractFrames(videoFile, 4)
    const base64Frames  = await Promise.all(frameBlobs.map((b) => blobToSmallBase64(b, 400)))
    const imageParts    = base64Frames.map((b64) => ({
      inlineData: { mimeType: 'image/jpeg', data: b64 },
    }))
    const realDurationSec = await durationPromise
    const durationLine = realDurationSec && realDurationSec > 0
      ? `Video dài chính xác ${realDurationSec.toFixed(1)} giây (${fmtMSS(realDurationSec)}). structureMap.runtime PHẢI là "${fmtMSS(realDurationSec)}". `
      : ''
    const textPart = {
      text: `Đây là ${base64Frames.length} frame từ video quảng cáo (chế độ không có audio). `
        + durationLine
        + 'Transcript: chỉ chép chữ text overlay thực sự hiển thị trên màn hình, không bịa lời thoại. '
        + 'NGÔN NGỮ OUTPUT: TOÀN BỘ phân tích PHẢI viết bằng TIẾNG VIỆT — analystNote, technique, whyItWorks, adaptableTemplate, pacing, descriptions, primaryLevers, targetingSignals, weakness, fix, reconstructionPrompt đều bằng tiếng Việt. Chỉ visualPlaybook.prompt giữ tiếng Anh. '
        + 'BẮT BUỘC: improvements ≥ 3 mục cụ thể (weakness + fix). reconstructionPrompt là directive 50-200 từ.\n'
        + 'Trả về JSON đầy đủ.',
    }

    responseText = await directGeminiVision({
      apiKey: geminiKey,
      parts: [...imageParts, textPart],
      systemInstruction: SYSTEM_INSTRUCTION,
    })

    if (!responseText.trim()) throw new Error('Không có phản hồi từ AI. Vui lòng thử lại.')
    const parsed = parseAnalysisJson(responseText)
    return normalizeAnalysisResult(parsed, realDurationSec)
  } finally {
    // Always clean up the uploaded file (non-blocking)
    if (uploadedFileName) deleteGeminiFile(geminiKey, uploadedFileName)
  }
}

// ── Z21 — post-processing: real-duration override + fallback fillers ────────

/** Generic fallback improvements when Gemini returns an empty array. */
function buildFallbackImprovements(): Improvement[] {
  return [
    { weakness: 'Hook 3 giây đầu chưa đủ mạnh — chưa có pattern interrupt rõ ràng', fix: 'Bắt đầu bằng một câu shock hoặc visual đối lập trong 1 giây đầu (vd. zoom mạnh / cận cảnh pain point)' },
    { weakness: 'CTA xuất hiện hơi muộn so với attention span trung bình', fix: 'Chèn 1 micro-CTA quanh giây 8-12 (text overlay "Lawati kedai" hoặc swipe arrow) trước khi đi sâu vào benefit' },
    { weakness: 'Visual chưa tập trung đủ vào pain point cụ thể của target', fix: 'Thay 1-2 cut by-product bằng cận cảnh body part đau / triệu chứng để audience tự nhận ra mình' },
    { weakness: 'Thiếu social proof rõ ràng (review chip / số người dùng / badge KKM)', fix: 'Overlay 1 chip "20,000+ pengguna" hoặc "★ 4.8/5" trong 2-3s đoạn giữa để build trust' },
  ]
}

/** Fallback Creative Blueprint when Gemini reconstructionPrompt is empty. */
function buildFallbackBlueprint(realDurationSec: number | null): string {
  const dur = realDurationSec && realDurationSec > 0 ? fmtMSS(realDurationSec) : '0:30'
  return (
    `DIRECTIVE TÁI TẠO (fallback — AI không trả về blueprint, dùng template chuẩn):\n\n`
    + `Quay 1 video UGC ${dur} cho sản phẩm bất kỳ với cấu trúc:\n`
    + `1) Hook 0:00-0:03 — pattern interrupt + claim mạnh về kết quả nhanh\n`
    + `2) Pain 0:03-0:08 — cận cảnh triệu chứng / hậu quả audience đang chịu\n`
    + `3) Authority 0:08-0:15 — bác sĩ / chuyên gia / chứng nhận giới thiệu sản phẩm\n`
    + `4) Benefit 0:15-0:22 — hình ảnh lifestyle sau khi dùng + 3-4 benefit chips\n`
    + `5) CTA 0:22-${dur} — ưu đãi cụ thể + urgency + nút mua\n\n`
    + `Giọng UGC tự nhiên, không cinematic. Mọi text overlay bằng ngôn ngữ target market.`
  )
}

/** Override AI-guessed runtime + reformat beats/segments to fit the real duration. */
function normalizeAnalysisResult(
  raw: AnalysisResult,
  realDurationSec: number | null,
): AnalysisResult {
  const r: AnalysisResult = { ...raw }
  let usedFallback = false

  // Improvements fallback
  if (!Array.isArray(r.improvements) || r.improvements.length === 0) {
    r.improvements = buildFallbackImprovements()
    usedFallback = true
  }

  // Blueprint fallback
  if (!r.reconstructionPrompt || r.reconstructionPrompt.trim().length < 20) {
    r.reconstructionPrompt = buildFallbackBlueprint(realDurationSec)
    usedFallback = true
  }

  // Real-duration override
  if (realDurationSec && realDurationSec > 0) {
    r.realDurationSec = realDurationSec
    const realRuntime = fmtMSS(realDurationSec)

    // structureMap.runtime override (don't trust AI's "0:30" placeholder)
    r.structureMap = {
      ...r.structureMap,
      runtime: realRuntime,
      beats: rescaleBeats(r.structureMap?.beats ?? [], realDurationSec),
    }

    // Retention timeline — rescale segments to cover the real runtime
    if (r.retentionTimeline) {
      r.retentionTimeline = {
        ...r.retentionTimeline,
        segments: rescaleRetentionSegments(r.retentionTimeline.segments ?? [], realDurationSec),
      }
    }
  }

  r.usedFallback = usedFallback
  return r
}

/** Stretch beat timestamps proportionally so they cover the entire real
 *  duration instead of stopping at 0:30. Parses "0:05-0:10" ranges and the
 *  duration string, scales by realDur / inferredDur. */
function rescaleBeats(beats: StructureBeat[], realDurationSec: number): StructureBeat[] {
  if (beats.length === 0) return beats
  // Infer what duration the AI used by reading the END of the last beat
  const lastEnd = parseSecondFromRange(beats[beats.length - 1].timestamp, 'end')
  if (lastEnd <= 0 || Math.abs(lastEnd - realDurationSec) < 1) return beats
  const scale = realDurationSec / lastEnd
  return beats.map((b) => {
    const start = parseSecondFromRange(b.timestamp, 'start') * scale
    const end   = parseSecondFromRange(b.timestamp, 'end')   * scale
    const dur   = Math.max(1, Math.round(end - start))
    return {
      ...b,
      timestamp: `${fmtMSS(start)}-${fmtMSS(end)}`,
      duration:  `${dur}s`,
    }
  })
}

function rescaleRetentionSegments(segs: RetentionSegment[], realDurationSec: number): RetentionSegment[] {
  if (segs.length === 0) return segs
  const lastEnd = parseSecondFromRange(segs[segs.length - 1].timestamp, 'end')
  if (lastEnd <= 0 || Math.abs(lastEnd - realDurationSec) < 1) return segs
  const scale = realDurationSec / lastEnd
  return segs.map((s) => {
    const start = parseSecondFromRange(s.timestamp, 'start') * scale
    const end   = parseSecondFromRange(s.timestamp, 'end')   * scale
    return { ...s, timestamp: `${fmtMSS(start)}-${fmtMSS(end)}` }
  })
}

/** "0:05-0:10" → 5 (start) or 10 (end). Tolerant of "0:05–0:10" with en-dash too. */
function parseSecondFromRange(ts: string, which: 'start' | 'end'): number {
  if (!ts) return 0
  const parts = ts.split(/[-–]/).map((p) => p.trim())
  const target = which === 'start' ? parts[0] : (parts[1] ?? parts[0])
  const m = target.match(/^(\d+):(\d+)$/)
  if (!m) return 0
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
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
