import type { AnalysisResult } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { kieAnalyzeImage, blobToSmallBase64 } from '../../../utils/kieai'

const SYSTEM_INSTRUCTION = `You are an elite UGC ad analyst. You dissect social media video ads and extract actionable insights for creators and brands.

You will receive multiple frames extracted at regular intervals from the video. Use ALL frames to understand the full video: its pacing, scene changes, visual variety, hook, and structure.

You must respond with ONLY valid JSON matching this exact structure (no markdown, no code fences):

SCORECARD RULE: Be brutally honest. Do not inflate scores. Most ads are average (5/10). If a hook is boring, give it a 2 or 3. If the visuals are static, penalize it. A 9/10 or 10/10 should be reserved for big direct to consumer brands level.

{
  "scorecard": {
    "scores": [
      { "label": "Hook Strength", "score": <1-10> },
      { "label": "Structure Clarity", "score": <1-10> },
      { "label": "Visual Variety", "score": <1-10> },
      { "label": "Persuasion Depth", "score": <1-10> },
      { "label": "Overall Execution", "score": <1-10> }
    ],
    "analystNote": "<2-3 sentence analyst summary>"
  },
  "transcript": [
    { "timestamp": "<MM:SS>", "text": "<line>" }
  ],
  "hookBreakdown": {
    "hookText": "<exact hook text>",
    "technique": "<technique name>",
    "whyItWorks": "<explanation>",
    "adaptableTemplate": "<fill-in-the-blank template>"
  },
  "structureMap": {
    "runtime": "<M:SS>",
    "pacing": "<pacing description>",
    "beats": [
      { "timestamp": "<range>", "beat": "<beat name>", "description": "<what happens>", "duration": "<Xs>" }
    ]
  },
  "psychology": {
    "primaryLevers": ["<lever 1>", "<lever 2>"],
    "targetingSignals": ["<signal 1>", "<signal 2>"]
  },
  "visualPlaybook": [
    { "timestamp": "<range>", "description": "<what's shown>", "prompt": "<image generation prompt>" }
  ],
  "improvements": [
    { "weakness": "<problem>", "fix": "<solution>" }
  ],
  "reconstructionPrompt": "<full prompt that could recreate this ad's structure for any product>"
}`

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
  const apiKey = useSettingsStore.getState().getApiKey()

  // 1. Extract 3 key frames: start, middle, end
  const frameBlobs = await extractFrames(videoFile, 3)

  // 2. Compress each frame to 480px JPEG base64 (keep payload small)
  const base64Frames = await Promise.all(
    frameBlobs.map((blob) => blobToSmallBase64(blob, 480))
  )

  // 3. Try multi-image first; fall back to single representative frame
  let responseText: string
  try {
    const imageUrls = base64Frames.map((b64) => `data:image/jpeg;base64,${b64}`)
    const prompt = `I'm providing ${imageUrls.length} frames from a UGC video ad (start, middle, end). Analyze the FULL video: transcript, hook, structure beats, psychological levers, visual variety, improvements. Return JSON only.`
    responseText = await kieAnalyzeImage(apiKey, '', '', prompt, SYSTEM_INSTRUCTION, imageUrls)
  } catch {
    // Fallback: send only the first frame if multi-image fails
    const singlePrompt = `Analyze this UGC video ad frame and infer the full ad structure: transcript, hook, structure beats, psychological levers, visual variety, improvements. Return JSON only.`
    responseText = await kieAnalyzeImage(apiKey, base64Frames[0], 'image/jpeg', singlePrompt, SYSTEM_INSTRUCTION)
  }

  if (!responseText?.trim()) throw new Error('Không có phản hồi từ AI. Vui lòng thử lại.')

  // 4. Parse JSON
  let cleaned = responseText.trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) cleaned = jsonMatch[0]
  else cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  return JSON.parse(cleaned) as AnalysisResult
}
