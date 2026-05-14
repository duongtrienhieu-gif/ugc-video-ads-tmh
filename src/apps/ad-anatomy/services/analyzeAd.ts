import type { AnalysisResult } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { geminiAnalyzeImage } from '../../../utils/gemini'

const SYSTEM_INSTRUCTION = `You are an elite UGC ad analyst. You dissect social media video ads and extract actionable insights for creators and brands.

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

async function extractFirstFrame(videoFile: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(videoFile)
    video.muted = true
    video.preload = 'auto'
    video.crossOrigin = 'anonymous'

    const drawFrame = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas context unavailable')
        ctx.drawImage(video, 0, 0)
        URL.revokeObjectURL(url)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' })
      } catch (e) {
        URL.revokeObjectURL(url)
        reject(e)
      }
    }

    video.onloadedmetadata = () => {
      video.currentTime = 0.5
    }

    video.onseeked = () => {
      drawFrame()
    }

    // Fallback: if seeked doesn't fire
    video.onloadeddata = () => {
      if (video.readyState >= 3) {
        setTimeout(drawFrame, 100)
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
  const { base64, mimeType } = await extractFirstFrame(videoFile)

  const prompt = `Analyze this UGC ad video/image thoroughly. Extract every detail: transcript with timestamps, hook technique, structure beats, psychological persuasion levers, visual playbook with image generation prompts, and improvement suggestions. Return the analysis as JSON.`

  const responseText = await geminiAnalyzeImage(apiKey, prompt, base64, mimeType, SYSTEM_INSTRUCTION)

  // Strip markdown fences and extract JSON
  let cleaned = responseText.trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) cleaned = jsonMatch[0]
  else cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  const result: AnalysisResult = JSON.parse(cleaned)
  return result
}
