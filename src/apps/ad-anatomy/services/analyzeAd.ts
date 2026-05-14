import type { AnalysisResult } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { saveAsset, getUrl, deleteAsset } from '../../../utils/assetStore'

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

// Seek video to a specific time and resolve when ready
function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = time
  })
}

// Capture current video frame as JPEG Blob
function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    // Scale down to reduce size — 640px wide is enough for analysis
    const scale = Math.min(1, 640 / (video.videoWidth || 640))
    canvas.width = Math.round((video.videoWidth || 640) * scale)
    canvas.height = Math.round((video.videoHeight || 480) * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) { reject(new Error('Canvas unavailable')); return }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('toBlob failed'))
    }, 'image/jpeg', 0.80)
  })
}

// Extract up to maxFrames evenly spread across the video
async function extractFrames(videoFile: File, maxFrames = 8): Promise<Blob[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(videoFile)
    video.muted = true
    video.preload = 'auto'

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration || 10
        const count = Math.min(maxFrames, Math.max(1, Math.ceil(duration / 2)))
        const blobs: Blob[] = []

        for (let i = 0; i < count; i++) {
          // Spread timestamps: 0.5s, then every (duration/count) seconds
          const t = i === 0 ? 0.5 : Math.min((duration / count) * i, duration - 0.2)
          await seekVideo(video, t)
          const blob = await captureFrame(video)
          blobs.push(blob)
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

  // 1. Extract multiple frames from the video
  const frameBlobs = await extractFrames(videoFile, 8)

  // 2. Upload all frames to Supabase Storage in parallel → get signed URLs
  const assetIds = await Promise.all(
    frameBlobs.map((blob) => saveAsset(blob, 'image/jpeg'))
  )
  const imageUrls = await Promise.all(
    assetIds.map(async (id) => {
      const u = await getUrl(id)
      if (!u) throw new Error('Không lấy được URL ảnh')
      return u
    })
  )

  // 3. Send all frame URLs to kie.ai vision in a single message
  const prompt = `I'm providing you with ${imageUrls.length} frames extracted at regular intervals from a UGC video ad.
Frame 1 = beginning, Frame ${imageUrls.length} = near the end.
Analyze the FULL video based on these frames: transcript, hook, structure beats, psychological levers, visual variety, and improvements.
Return the analysis as JSON.`

  let responseText: string
  try {
    const messages: Array<{ role: string; content: unknown }> = [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      {
        role: 'user',
        content: [
          ...imageUrls.map((u) => ({ type: 'image_url', image_url: { url: u } })),
          { type: 'text', text: prompt },
        ],
      },
    ]

    const res = await fetch('https://api.kie.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'gemini-2.5-flash', messages }),
    })

    if (res.status === 402) throw new Error('Không đủ Credit')
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`kie.ai error (${res.status}): ${text}`)
    }

    const data = await res.json() as { choices?: { message?: { content?: string } }[] }
    responseText = data.choices?.[0]?.message?.content ?? ''
    if (!responseText) throw new Error('AI không trả về kết quả phân tích')
  } finally {
    // 4. Clean up all temp assets
    assetIds.forEach((id) => deleteAsset(id).catch(() => {}))
  }

  // 5. Parse JSON from response
  let cleaned = responseText.trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) cleaned = jsonMatch[0]
  else cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  const result: AnalysisResult = JSON.parse(cleaned)
  return result
}
