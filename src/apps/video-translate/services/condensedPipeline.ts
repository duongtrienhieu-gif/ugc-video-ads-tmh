// Smart-condense voice-only pipeline.
//
// Replaces ElevenLabs Dubbing's auto-compress-to-fit behaviour, which causes
// audible 1.3-1.5x speedup and end-of-content cuts. Instead we:
//   1. Extract audio from the source video via ffmpeg.wasm
//   2. Ask Gemini in ONE multimodal call to listen to the audio AND directly
//      output the translated + condensed target-language script. We don't
//      need the intermediate transcript — halving Gemini quota usage vs the
//      old two-call (transcribe → translate) flow, which mattered when users
//      on free tier started hitting daily rate limits.
//   3. Synthesize the condensed text via ElevenLabs TTS with the user-picked
//      voice — natural speed, no auto-fitting
//   4. Caller muxes that audio into the source video, padding either the
//      video tail (audio longer) or the audio tail (audio shorter) so no
//      content is lost from either stream.

import { directGeminiVision, directGeminiText } from '../../../utils/gemini'
import { textToSpeech } from '../../../utils/elevenlabs'
import { getFFmpeg } from '../../video-builder/v3/services/ffmpegLoader'
import { fetchFile } from '@ffmpeg/util'
import { getLangLabel } from '../langLabels'
import type { CondenseLevel } from '../types'

// ── Audio extraction via ffmpeg.wasm ────────────────────────────────────────

export async function extractAudioFromVideo(videoBlob: Blob): Promise<Blob> {
  const ffmpeg = await getFFmpeg()
  const inputExt = videoBlob.type.includes('webm') ? 'webm'
                 : videoBlob.type.includes('mov') || videoBlob.type.includes('quicktime') ? 'mov'
                 : 'mp4'
  const input  = `src.${inputExt}`
  const output = 'src.mp3'

  await ffmpeg.writeFile(input, await fetchFile(videoBlob))
  // -vn = drop video. libmp3lame is bundled in @ffmpeg/core@0.12.6.
  // -ac 1 mono, -ar 16000 = small file for Gemini upload (~120 KB / 45s).
  await ffmpeg.exec(['-i', input, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', '-y', output])
  const data = await ffmpeg.readFile(output)
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data
  await ffmpeg.deleteFile(input).catch(() => {})
  await ffmpeg.deleteFile(output).catch(() => {})
  return new Blob([buf as BlobPart], { type: 'audio/mpeg' })
}

// ── Blob → base64 (for Gemini inlineData) ───────────────────────────────────

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// ── Single combined Gemini call: audio → translated condensed target text ───

export interface TranslateCondenseResult {
  text: string
  estimatedSeconds: number   // word-count-based estimate of read-out length
}

const SPEAKING_WPM: Record<string, number> = {
  // Average natural-speech words-per-minute by language. Conservative —
  // TTS at default speed lands close to these.
  en: 150, ms: 140, id: 140, vi: 150, zh: 170, ja: 160, ko: 160,
  es: 155, fr: 155, de: 145, pt: 150, ru: 140, ar: 130, hi: 140,
}

function buildCondenseInstruction(targetLabel: string, targetDurationSec: number, targetWords: number, level: CondenseLevel): string {
  if (level === 'verbatim') {
    return `Do NOT condense. Translate every word faithfully. The output may exceed ${targetDurationSec} seconds when spoken — that is acceptable.`
  }
  if (level === 'aggressive') {
    return `CONDENSE AGGRESSIVELY to fit ${targetDurationSec} seconds at natural ${targetLabel} speaking speed. ` +
           `Target word count: ~${targetWords} words. Drop ALL filler. Merge short sentences. Use the shortest possible synonyms. ` +
           `If needed drop secondary points but ALWAYS keep: numbers, brand names, prices, percentages, CTAs (links/codes), key promises.`
  }
  // light (default)
  return `CONDENSE LIGHTLY to fit ~${targetDurationSec} seconds at natural ${targetLabel} speaking speed. ` +
         `Target word count: ~${targetWords} words. Drop filler ("uh", "you know", "basically", "literally", "honestly"). ` +
         `Merge short adjacent sentences where natural. Keep the casual UGC tone, first-person POV, exclamations. ` +
         `MUST keep: numbers, brand names, prices, percentages, CTAs, key value propositions.`
}

/** Combined transcribe + translate + condense in a single Gemini multimodal
 *  call. Saves one full call vs the previous two-step flow. */
export async function transcribeTranslateCondense(params: {
  apiKey: string
  audioBlob: Blob
  sourceLang: string
  targetLang: string
  targetDurationSec: number
  level: CondenseLevel
}): Promise<TranslateCondenseResult> {
  const base64       = await blobToBase64(params.audioBlob)
  const sourceLabel  = getLangLabel(params.sourceLang)
  const targetLabel  = getLangLabel(params.targetLang)
  const wpm          = SPEAKING_WPM[params.targetLang] ?? 145
  const targetWords  = Math.round((params.targetDurationSec / 60) * wpm)
  const condenseRule = buildCondenseInstruction(targetLabel, params.targetDurationSec, targetWords, params.level)

  const systemInstruction =
    `You are a UGC ad-script translator. The user gives you spoken ${sourceLabel} audio. ` +
    `You output ONLY the ${targetLabel} script that a voice-over artist will read — no quotes, ` +
    `no headings, no preamble, no transcript, no explanation, no JSON. Just the words to be spoken. ` +
    `You preserve the casual, personal, energetic tone of the original speaker.`

  const prompt =
    `Listen to this ${sourceLabel} audio. Translate it directly to ${targetLabel} for voice-over use.\n\n` +
    `${condenseRule}\n\n` +
    `Output: only the ${targetLabel} script text, ready to be read aloud.`

  const raw = await directGeminiVision({
    apiKey: params.apiKey,
    parts: [
      { inlineData: { mimeType: 'audio/mpeg', data: base64 } },
      { text: prompt },
    ],
    systemInstruction,
    maxOutputTokens: 2048,
  })
  const cleaned = raw.trim().replace(/^["']|["']$/g, '')
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length
  const estimatedSeconds = (wordCount / wpm) * 60
  return { text: cleaned, estimatedSeconds }
}

/** Text-only retry: tighten an already-translated script if its estimated
 *  read-out time still overshoots the target by >30%. Cheap fallback that
 *  doesn't re-upload the audio. */
async function tightenCondense(params: {
  apiKey: string
  currentText: string
  targetLang: string
  targetDurationSec: number
}): Promise<TranslateCondenseResult> {
  const targetLabel = getLangLabel(params.targetLang)
  const wpm         = SPEAKING_WPM[params.targetLang] ?? 145
  const targetWords = Math.round((params.targetDurationSec / 60) * wpm)
  const prompt =
    `Below is a ${targetLabel} voice-over script that is too long. ` +
    `Rewrite it to be SHORTER (~${targetWords} words, fitting ${params.targetDurationSec} seconds at natural speaking speed). ` +
    `Keep numbers, brand names, prices, percentages, CTAs intact. Keep the same casual UGC tone. ` +
    `Drop secondary points and filler. Output: only the rewritten ${targetLabel} script — no quotes, no preamble.\n\n` +
    `Script to shorten:\n${params.currentText}`
  const raw = await directGeminiText({
    apiKey: params.apiKey,
    prompt,
    maxOutputTokens: 2048,
  })
  const cleaned = raw.trim().replace(/^["']|["']$/g, '')
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length
  const estimatedSeconds = (wordCount / wpm) * 60
  return { text: cleaned, estimatedSeconds }
}

// ── Step 4: ElevenLabs TTS at natural speed ─────────────────────────────────

export async function synthesizeTTS(params: {
  apiKey: string
  voiceId: string
  text: string
}): Promise<Blob> {
  const buffer = await textToSpeech({
    apiKey: params.apiKey,
    voiceId: params.voiceId,
    text: params.text,
    stability: 0.55,           // a bit looser for natural-sounding UGC delivery
    similarity: 0.75,
    style: 0.15,                // small style nudge for personality
    useSpeakerBoost: true,
    speed: 1.0,                 // natural speed
    modelId: 'eleven_multilingual_v2',
  })
  return new Blob([buffer as BlobPart], { type: 'audio/mpeg' })
}

// ── Measure final audio duration so caller can plan video extension ─────────

export function measureAudioDuration(audioBlob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(audioBlob)
    const a = new Audio(url)
    a.preload = 'metadata'
    a.onloadedmetadata = () => { resolve(a.duration); URL.revokeObjectURL(url) }
    a.onerror = () => { reject(new Error('Không đo được độ dài audio')); URL.revokeObjectURL(url) }
  })
}

// ── Top-level orchestration ─────────────────────────────────────────────────

export interface CondensedPipelineResult {
  translatedText: string
  audioBlob: Blob
  audioDurationSec: number
  retried: boolean       // true if we tightened the script after a bad overshoot
}

export async function generateCondensedAudio(params: {
  geminiApiKey: string
  elevenLabsApiKey: string
  videoBlob: Blob
  sourceLang: string
  targetLang: string
  targetDurationSec: number   // original video duration — what we aim to fit
  voiceId: string
  level: CondenseLevel
  onStatus?: (s: 'extracting' | 'translating' | 'synthesizing') => void
}): Promise<CondensedPipelineResult> {
  params.onStatus?.('extracting')
  const audioForGemini = await extractAudioFromVideo(params.videoBlob)

  params.onStatus?.('translating')
  let { text: translated, estimatedSeconds } = await transcribeTranslateCondense({
    apiKey: params.geminiApiKey,
    audioBlob: audioForGemini,
    sourceLang: params.sourceLang,
    targetLang: params.targetLang,
    targetDurationSec: params.targetDurationSec,
    level: params.level,
  })
  if (!translated) {
    throw new Error('Gemini không dịch được — audio không rõ tiếng hoặc quá ngắn')
  }

  // Text-only retry if the first pass overshoots by >30%. Cheap — doesn't
  // re-upload audio. Skipped for verbatim (user opted into full length).
  let retried = false
  const overshoot = estimatedSeconds / params.targetDurationSec
  if (overshoot > 1.30 && params.level !== 'verbatim') {
    console.warn(`[condensedPipeline] est ${estimatedSeconds.toFixed(1)}s > target ${params.targetDurationSec}s by ${((overshoot - 1) * 100).toFixed(0)}% — tightening`)
    try {
      const tighter = await tightenCondense({
        apiKey: params.geminiApiKey,
        currentText: translated,
        targetLang: params.targetLang,
        targetDurationSec: params.targetDurationSec,
      })
      translated = tighter.text
      retried = true
    } catch (err) {
      // If the tighten call itself fails (quota etc.), fall back to first-pass
      // translation rather than killing the whole job.
      console.warn('[condensedPipeline] tighten failed, using first-pass:', err)
    }
  }

  params.onStatus?.('synthesizing')
  const audioBlob = await synthesizeTTS({
    apiKey: params.elevenLabsApiKey,
    voiceId: params.voiceId,
    text: translated,
  })
  const audioDurationSec = await measureAudioDuration(audioBlob).catch(() => estimatedSeconds)

  return { translatedText: translated, audioBlob, audioDurationSec, retried }
}
