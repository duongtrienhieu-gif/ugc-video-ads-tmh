// Smart-condense voice-only pipeline.
//
// Replaces ElevenLabs Dubbing's auto-compress-to-fit behaviour, which causes
// audible 1.3-1.5x speedup and end-of-content cuts. Instead we:
//   1. Extract audio from the source video via ffmpeg.wasm
//   2. Ask Gemini to transcribe it (we already know the source language)
//   3. Ask Gemini to translate + CONDENSE the text so it fits the original
//      video duration when read at natural speed — preserves brand, numbers,
//      CTA, casual UGC tone; drops filler words
//   4. Synthesize the condensed text via ElevenLabs TTS with the user-picked
//      voice — natural speed, no auto-fitting
//   5. Caller muxes that audio into the source video, extending video with
//      a held last frame if the audio is still slightly longer.

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

// ── Step 2: Gemini transcribe source audio ──────────────────────────────────

export async function transcribeAudio(params: {
  apiKey: string
  audioBlob: Blob
  sourceLang: string  // ISO-639-1 — we tell Gemini what language to expect
}): Promise<string> {
  const base64 = await blobToBase64(params.audioBlob)
  const langLabel = getLangLabel(params.sourceLang)
  const prompt =
    `Transcribe this audio in ${langLabel} verbatim. ` +
    `Include every word the speaker says, including filler words ("uh", "you know", "like"). ` +
    `Do NOT translate. Do NOT summarize. Do NOT add commentary or timestamps. ` +
    `Output the transcript text only.`

  const text = await directGeminiVision({
    apiKey: params.apiKey,
    parts: [
      { inlineData: { mimeType: 'audio/mpeg', data: base64 } },
      { text: prompt },
    ],
    maxOutputTokens: 2048,
  })
  return text.trim()
}

// ── Step 3: Gemini translate + condense to fit duration ─────────────────────

export interface TranslateCondenseResult {
  text: string
  estimatedSeconds: number   // Gemini's own estimate of read-out length
}

const SPEAKING_WPM: Record<string, number> = {
  // Average natural-speech words-per-minute by language. Conservative —
  // TTS at default speed lands close to these.
  en: 150, ms: 140, id: 140, vi: 150, zh: 170, ja: 160, ko: 160,
  es: 155, fr: 155, de: 145, pt: 150, ru: 140, ar: 130, hi: 140,
}

export async function translateAndCondense(params: {
  apiKey: string
  sourceText: string
  sourceLang: string
  targetLang: string
  targetDurationSec: number
  level: CondenseLevel
}): Promise<TranslateCondenseResult> {
  const sourceLabel = getLangLabel(params.sourceLang)
  const targetLabel = getLangLabel(params.targetLang)
  const wpm = SPEAKING_WPM[params.targetLang] ?? 145
  const targetWords = Math.round((params.targetDurationSec / 60) * wpm)

  const condenseInstruction =
    params.level === 'verbatim'
      ? `Do NOT condense. Translate every word faithfully. The output may be longer than the source — that is acceptable.`
      : params.level === 'aggressive'
      ? `CONDENSE AGGRESSIVELY to fit ${params.targetDurationSec} seconds at natural ${targetLabel} speaking speed. ` +
        `Target word count: ~${targetWords} words. Drop ALL filler. Merge short sentences. Use the shortest possible synonyms. ` +
        `If needed, drop secondary points but ALWAYS keep: numbers, brand names, prices, percentages, CTAs (links, codes), key promises.`
      : // light (default)
        `CONDENSE LIGHTLY to fit ~${params.targetDurationSec} seconds at natural ${targetLabel} speaking speed. ` +
        `Target word count: ~${targetWords} words. Drop filler ("uh", "you know", "basically", "literally", "honestly"). ` +
        `Merge short adjacent sentences where natural. Keep the casual UGC tone, first-person POV, exclamations. ` +
        `MUST keep: numbers, brand names, prices, percentages, CTAs, key value propositions.`

  const systemInstruction =
    `You are a UGC ad-script translator. You translate spoken ad scripts from ${sourceLabel} to ${targetLabel} ` +
    `for video voice-over use. You preserve the casual, personal, energetic tone of the original speaker. ` +
    `You output ONLY the translated script text — no quotes, no headings, no explanation, no JSON. ` +
    `Just the words that will be spoken.`

  const prompt =
    `Source transcript (${sourceLabel}):\n${params.sourceText}\n\n` +
    `Task: Translate to ${targetLabel}. ${condenseInstruction}\n\n` +
    `Output: only the ${targetLabel} script text.`

  const raw = await directGeminiText({
    apiKey: params.apiKey,
    prompt,
    systemInstruction,
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
  retried: boolean       // true if we re-condensed once because output was way too long
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
  onStatus?: (s: 'extracting' | 'transcribing' | 'translating' | 'synthesizing') => void
}): Promise<CondensedPipelineResult> {
  params.onStatus?.('extracting')
  const audioForGemini = await extractAudioFromVideo(params.videoBlob)

  params.onStatus?.('transcribing')
  const sourceText = await transcribeAudio({
    apiKey: params.geminiApiKey,
    audioBlob: audioForGemini,
    sourceLang: params.sourceLang,
  })
  if (!sourceText) throw new Error('Gemini không transcribe được — audio không rõ tiếng hoặc quá ngắn')

  params.onStatus?.('translating')
  let { text: translated, estimatedSeconds } = await translateAndCondense({
    apiKey: params.geminiApiKey,
    sourceText,
    sourceLang: params.sourceLang,
    targetLang: params.targetLang,
    targetDurationSec: params.targetDurationSec,
    level: params.level,
  })

  // Auto-retry once if estimate badly overshoots — bump to next condense level
  let retried = false
  const overshoot = estimatedSeconds / params.targetDurationSec
  if (overshoot > 1.30 && params.level !== 'aggressive') {
    console.warn(`[condensedPipeline] estimate ${estimatedSeconds.toFixed(1)}s > target ${params.targetDurationSec}s by ${((overshoot - 1) * 100).toFixed(0)}% — re-condense aggressively`)
    const nextLevel: CondenseLevel = params.level === 'verbatim' ? 'light' : 'aggressive'
    const retry = await translateAndCondense({
      apiKey: params.geminiApiKey,
      sourceText,
      sourceLang: params.sourceLang,
      targetLang: params.targetLang,
      targetDurationSec: params.targetDurationSec,
      level: nextLevel,
    })
    translated = retry.text
    retried = true
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
