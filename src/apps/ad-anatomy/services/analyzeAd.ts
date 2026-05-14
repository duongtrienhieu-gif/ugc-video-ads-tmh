import type { AnalysisResult } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { blobToSmallBase64 } from '../../../utils/kieai'
import { directGeminiVision } from '../../../utils/gemini'

const SYSTEM_INSTRUCTION = `You are a creative strategist specializing in short-form video advertising. Your job is to analyze video ad frames and return structured creative insights as JSON.

Output ONLY a valid JSON object — no markdown, no code fences, no explanation. Use this exact structure:

{
  "scorecard": {
    "scores": [
      { "label": "Hook Strength", "score": 6 },
      { "label": "Structure Clarity", "score": 6 },
      { "label": "Visual Variety", "score": 5 },
      { "label": "Persuasion Depth", "score": 5 },
      { "label": "Overall Execution", "score": 6 }
    ],
    "analystNote": "2-3 sentence creative summary. Be honest, not flattering."
  },
  "transcript": [
    { "timestamp": "0:00", "text": "inferred spoken line or on-screen text" }
  ],
  "hookBreakdown": {
    "hookText": "opening hook text",
    "technique": "hook technique name",
    "whyItWorks": "brief explanation",
    "adaptableTemplate": "fill-in-the-blank version"
  },
  "structureMap": {
    "runtime": "0:30",
    "pacing": "pacing description",
    "beats": [
      { "timestamp": "0:00–0:05", "beat": "Hook", "description": "what happens", "duration": "5s" }
    ]
  },
  "psychology": {
    "primaryLevers": ["lever 1", "lever 2"],
    "targetingSignals": ["signal 1", "signal 2"]
  },
  "visualPlaybook": [
    { "timestamp": "0:00–0:05", "description": "what is shown on screen", "prompt": "image generation prompt to replicate this visual" }
  ],
  "improvements": [
    { "weakness": "identified weakness", "fix": "actionable fix" }
  ],
  "reconstructionPrompt": "A detailed prompt that describes this ad's full creative structure so it could be recreated for any product."
}

Scores use integers 1-10. Most ads score 4-7. Reserve 9-10 for exceptional work only.`

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
    const scale = Math.min(1, 640 / (video.videoWidth || 640))
    canvas.width = Math.round((video.videoWidth || 640) * scale)
    canvas.height = Math.round((video.videoHeight || 480) * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) { reject(new Error('canvas')); return }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('toBlob failed'))
    }, 'image/jpeg', 0.75)
  })
}

async function extractFrames(videoFile: File, maxFrames = 6): Promise<Blob[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(videoFile)
    video.muted = true
    video.preload = 'auto'

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration || 10
        const count = Math.min(maxFrames, Math.max(1, Math.ceil(duration / 3)))
        const blobs: Blob[] = []
        for (let i = 0; i < count; i++) {
          const t = i === 0 ? 0.5 : Math.min((duration / count) * i, duration - 0.2)
          await seekVideo(video, t)
          blobs.push(await captureFrameBlob(video))
        }
        URL.revokeObjectURL(url)
        resolve(blobs)
      } catch (e) {
        URL.revokeObjectURL(url)
        reject(e)
      }
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Không thể tải video. Hãy thử file MP4 khác.'))
    }

    video.src = url
    video.load()
  })
}

export async function analyzeAd(videoFile: File): Promise<AnalysisResult> {
  const geminiKey = useSettingsStore.getState().getGeminiApiKey()

  // 1. Extract up to 4 key frames spread across the video
  const frameBlobs = await extractFrames(videoFile, 4)

  // 2. Compress each frame to 400px JPEG base64
  const base64Frames = await Promise.all(
    frameBlobs.map((blob) => blobToSmallBase64(blob, 400))
  )

  // 3. Call Gemini directly with all frames as inlineData parts
  const imageParts = base64Frames.map((b64) => ({
    inlineData: { mimeType: 'image/jpeg', data: b64 },
  }))
  const textPart = {
    text: `These are ${base64Frames.length} frames taken at equal intervals from a short-form video advertisement. Study all frames carefully to understand the full video, then return the JSON analysis described in your instructions.`,
  }

  const responseText = await directGeminiVision({
    apiKey: geminiKey,
    parts: [...imageParts, textPart],
    systemInstruction: SYSTEM_INSTRUCTION,
  })

  if (!responseText?.trim()) throw new Error('Không có phản hồi từ AI. Vui lòng thử lại.')

  // 4. Parse JSON
  let cleaned = responseText.trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) cleaned = jsonMatch[0]
  else cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  return JSON.parse(cleaned) as AnalysisResult
}
