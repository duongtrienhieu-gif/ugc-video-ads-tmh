// ElevenLabs API client — voice cloning, listing, and TTS

const EL_BASE = 'https://api.elevenlabs.io/v1'

export interface ElevenLabsVoice {
  voice_id: string
  name: string
  category: 'cloned' | 'premade' | 'generated' | 'professional'
  labels?: Record<string, string>  // includes 'gender', 'accent', etc.
  preview_url?: string
  description?: string
}

interface ListVoicesResponse {
  voices: ElevenLabsVoice[]
}

interface SubscriptionResponse {
  tier: string
  character_count: number
  character_limit: number
  next_character_count_reset_unix: number
}

/** List all voices accessible by this API key (cloned + library) */
export async function listVoices(apiKey: string): Promise<ElevenLabsVoice[]> {
  const res = await fetch(`${EL_BASE}/voices`, {
    headers: { 'xi-api-key': apiKey },
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`ElevenLabs voices lỗi (${res.status}): ${err.slice(0, 150)}`)
  }
  const data = (await res.json()) as ListVoicesResponse
  return data.voices ?? []
}

/** Clone a voice from an uploaded audio file. Returns the new voice_id. */
export async function cloneVoice(params: {
  apiKey: string
  name: string
  file: File
  description?: string
}): Promise<string> {
  if (!params.apiKey) throw new Error('Vui lòng nhập ElevenLabs API key trong Cài đặt')

  const form = new FormData()
  form.append('name', params.name)
  if (params.description) form.append('description', params.description)
  form.append('files', params.file, params.file.name)

  const res = await fetch(`${EL_BASE}/voices/add`, {
    method: 'POST',
    headers: { 'xi-api-key': params.apiKey },
    body: form,
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)

    // Parse ElevenLabs error body for clearer message (same as textToSpeech)
    let detail = err
    try {
      const parsed = JSON.parse(err) as { detail?: { status?: string; message?: string } | string }
      if (typeof parsed.detail === 'object' && parsed.detail) {
        detail = `${parsed.detail.status ?? ''} ${parsed.detail.message ?? ''}`.trim()
      } else if (typeof parsed.detail === 'string') {
        detail = parsed.detail
      }
    } catch {/* keep raw */}

    if (res.status === 401) {
      const lower = detail.toLowerCase()
      if (lower.includes('detected_unusual_activity') || lower.includes('free_tier_usage_disabled') || lower.includes('free tier')) {
        throw new Error('Key bị ElevenLabs khóa (anti-abuse). Key này được tạo hàng loạt — không dùng được. Cần: (1) đổi key mới từ shop, hoặc (2) đăng ký Starter $5/mo tại elevenlabs.io.')
      }
      if (lower.includes('quota') || lower.includes('limit')) throw new Error('Đã hết credit ElevenLabs — đợi reset tháng sau hoặc upgrade gói.')
      throw new Error(`API key ElevenLabs không hợp lệ — kiểm tra lại key trong Cài đặt. (${detail.slice(0, 120)})`)
    }
    if (res.status === 402 || res.status === 403) throw new Error('Gói ElevenLabs không hỗ trợ Voice Cloning. Cần Starter ($5/mo) trở lên. Chi tiết: ' + detail.slice(0, 100))
    if (res.status === 422) throw new Error(`File audio không hợp lệ: ${detail.slice(0, 150)}`)
    throw new Error(`Clone giọng thất bại (${res.status}): ${detail.slice(0, 150)}`)
  }

  const data = (await res.json()) as { voice_id: string }
  if (!data.voice_id) throw new Error('ElevenLabs không trả về voice_id — thử lại.')
  return data.voice_id
}

// ─── Voice Library (shared voices) ─────────────────────────────────────

export interface SharedVoice {
  public_owner_id: string
  voice_id: string
  name: string
  category: string
  language: string
  accent?: string
  gender?: string
  age?: string
  preview_url?: string
  description?: string
  use_case?: string
  descriptive?: string
  cloned_by_count?: number
  free_users_allowed?: boolean
}

interface SharedVoicesResponse {
  voices: SharedVoice[]
  has_more: boolean
}

/** Browse the public Voice Library (shared voices). Free tier can add these. */
export async function listSharedVoices(params: {
  apiKey: string
  language?: string         // 'ms', 'en', etc.
  accent?: string           // 'malaysian', 'american', etc.
  gender?: 'male' | 'female'
  search?: string
  category?: string         // 'professional', 'high_quality', 'famous'
  sort?: 'cloned_by_count' | 'created_at_unix'
  pageSize?: number
}): Promise<SharedVoice[]> {
  const q = new URLSearchParams()
  if (params.language) q.set('language', params.language)
  if (params.accent) q.set('accent', params.accent)
  if (params.gender) q.set('gender', params.gender)
  if (params.search) q.set('search', params.search)
  if (params.category) q.set('category', params.category)
  q.set('sort', params.sort ?? 'cloned_by_count')
  q.set('page_size', String(params.pageSize ?? 30))

  const res = await fetch(`${EL_BASE}/shared-voices?${q.toString()}`, {
    headers: { 'xi-api-key': params.apiKey },
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Voice Library lỗi (${res.status}): ${err.slice(0, 150)}`)
  }
  const data = (await res.json()) as SharedVoicesResponse
  return data.voices ?? []
}

/** Add a shared voice from Voice Library to "My Voices". Free tier OK. */
export async function addSharedVoice(params: {
  apiKey: string
  publicOwnerId: string
  voiceId: string
  newName: string
}): Promise<string> {
  if (!params.apiKey) throw new Error('Vui lòng nhập ElevenLabs API key trong Cài đặt')
  if (!params.publicOwnerId) throw new Error('Thiếu publicOwnerId — thử tải lại danh sách giọng')

  const res = await fetch(`${EL_BASE}/voices/add/${params.publicOwnerId}/${params.voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': params.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ new_name: params.newName }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)

    // Parse ElevenLabs JSON error body for specific message
    let detail = err
    try {
      const parsed = JSON.parse(err) as { detail?: { status?: string; message?: string } | string }
      if (typeof parsed.detail === 'object' && parsed.detail) {
        detail = `${parsed.detail.status ?? ''} ${parsed.detail.message ?? ''}`.trim()
      } else if (typeof parsed.detail === 'string') {
        detail = parsed.detail
      }
    } catch {/* keep raw */}

    if (res.status === 401) {
      const lower = detail.toLowerCase()
      if (lower.includes('detected_unusual_activity') || lower.includes('free_tier_usage_disabled') || lower.includes('free tier')) {
        throw new Error('Key ElevenLabs bị khóa (anti-abuse). Key mua từ shop không dùng được cho thao tác này. Cần key cá nhân hoặc đăng ký Starter $5/mo tại elevenlabs.io.')
      }
      if (lower.includes('quota') || lower.includes('limit')) throw new Error('Đã hết credit ElevenLabs — đợi reset tháng sau hoặc upgrade gói.')
      throw new Error(`API key ElevenLabs không hợp lệ — kiểm tra lại key trong Cài đặt. (${detail.slice(0, 100)})`)
    }
    if (res.status === 402 || res.status === 403) {
      throw new Error('Đã đạt giới hạn số giọng cho gói hiện tại. Xóa bớt giọng cũ hoặc upgrade gói ElevenLabs.')
    }
    if (res.status === 404) throw new Error('Giọng không tồn tại hoặc đã bị xóa khỏi thư viện')
    throw new Error(`Thêm giọng thất bại (${res.status}): ${detail.slice(0, 150)}`)
  }

  const data = (await res.json()) as { voice_id?: string }
  if (!data.voice_id) throw new Error('ElevenLabs không trả về voice_id — thử lại')
  return data.voice_id
}

/** Delete a cloned voice */
export async function deleteVoice(apiKey: string, voiceId: string): Promise<void> {
  const res = await fetch(`${EL_BASE}/voices/${voiceId}`, {
    method: 'DELETE',
    headers: { 'xi-api-key': apiKey },
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Xóa giọng thất bại: ${err.slice(0, 150)}`)
  }
}

/** Generate speech and return MP3 ArrayBuffer */
export async function textToSpeech(params: {
  apiKey: string
  voiceId: string
  text: string
  stability?: number       // 0-1, default 0.75 (higher = more consistent on long text)
  similarity?: number      // 0-1, default 0.75 (how close to original voice)
  style?: number           // 0-1, default 0 (style exaggeration)
  speed?: number           // 0.7 - 1.2, default 1.0 (playback speed)
  useSpeakerBoost?: boolean
  modelId?: string         // default eleven_multilingual_v2
  /** Text that came before this chunk (for prosody continuity in chunked generation) */
  previousText?: string
  /** Text that comes after this chunk (for prosody continuity) */
  nextText?: string
  /** MP3 quality. Default mp3_44100_192 (Creator+ plans); falls back to 128 on free/Starter. */
  outputFormat?: 'mp3_44100_128' | 'mp3_44100_192' | 'mp3_44100_64' | 'pcm_44100'
  /** Z53 — fires with the model that ACTUALLY produced the audio (after any
   *  eleven_v3 → v2 fallback). Lets callers report "v3 worked" vs "fell back
   *  to v2" to the user. */
  onModelUsed?: (model: string) => void
}): Promise<ArrayBuffer> {
  const body: Record<string, unknown> = {
    text: params.text,
    model_id: params.modelId ?? 'eleven_multilingual_v2',
    voice_settings: {
      stability: params.stability ?? 0.75,         // raised from 0.5 — better long-text consistency
      similarity_boost: params.similarity ?? 0.75,
      style: params.style ?? 0,
      use_speaker_boost: params.useSpeakerBoost ?? true,
      speed: params.speed ?? 1.0,
    },
  }
  if (params.previousText) body.previous_text = params.previousText
  if (params.nextText)     body.next_text     = params.nextText

  const format = params.outputFormat ?? 'mp3_44100_192'
  const res = await fetch(`${EL_BASE}/text-to-speech/${params.voiceId}?output_format=${format}`, {
    method: 'POST',
    headers: {
      'xi-api-key': params.apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    // Parse ElevenLabs error body for clearer message
    let detail = err
    try {
      const parsed = JSON.parse(err) as { detail?: { status?: string; message?: string } | string }
      if (typeof parsed.detail === 'object' && parsed.detail) {
        detail = `${parsed.detail.status ?? ''} ${parsed.detail.message ?? ''}`.trim()
      } else if (typeof parsed.detail === 'string') {
        detail = parsed.detail
      }
    } catch {/* keep raw */}

    if (res.status === 401) {
      const lower = detail.toLowerCase()
      if (lower.includes('detected_unusual_activity') || lower.includes('free tier usage disabled')) {
        throw new Error('Key bị ElevenLabs khóa Free Tier (anti-abuse). Đây là key bulk tạo bằng tool — không generate được. Cần: (1) đổi key khác từ shop, hoặc (2) đăng ký Starter $5/mo trực tiếp tại elevenlabs.io.')
      }
      if (lower.includes('quota') || lower.includes('limit')) throw new Error('Đã hết credit ElevenLabs — đợi reset tháng sau hoặc upgrade gói.')
      if (lower.includes('invalid')) throw new Error('API key ElevenLabs không hợp lệ — kiểm tra lại key trong Cài đặt.')
      throw new Error(`Không xác thực được: ${detail.slice(0, 200)}`)
    }
    // 192kbps requires Creator+ plan — auto-retry at 128kbps if forbidden
    if (res.status === 403 && format === 'mp3_44100_192') {
      return textToSpeech({ ...params, outputFormat: 'mp3_44100_128' })
    }
    // eleven_v3 may not be available for all plans / voices — fallback to v2
    if (params.modelId === 'eleven_v3' && (res.status === 422 || res.status === 404 || res.status === 400)) {
      console.warn('[textToSpeech] eleven_v3 unavailable, falling back to multilingual_v2')
      return textToSpeech({ ...params, modelId: 'eleven_multilingual_v2' })
    }
    if (res.status === 422) throw new Error(`Tham số không hợp lệ: ${detail.slice(0, 200)}`)
    throw new Error(`ElevenLabs TTS lỗi (${res.status}): ${detail.slice(0, 200)}`)
  }

  // Z53 — report the model that actually rendered (after any v3→v2 fallback).
  params.onModelUsed?.(String(body.model_id))
  return res.arrayBuffer()
}

// ── Z98 (#6) — TTS WITH per-character timestamps ───────────────────────────
// Same synthesis as textToSpeech but hits the `/with-timestamps` endpoint, which
// returns the audio (base64) PLUS character-level spoken timing. Used by the ads
// creator engine to anchor cuts/inserts to the EXACT second a line is read,
// instead of a WPM estimate. The endpoint guarantees timing on
// eleven_multilingual_v2; on newer models (eleven_v3) it MAY return audio with no
// alignment — in that case `alignment` is null and the caller can retry on v2.

/** Raw ElevenLabs alignment payload (character-level). */
export interface TtsTimestamps {
  characters: string[]
  characterStartTimesSeconds: number[]
  characterEndTimesSeconds: number[]
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export async function textToSpeechWithTimestamps(params: {
  apiKey: string
  voiceId: string
  text: string
  stability?: number
  similarity?: number
  style?: number
  speed?: number
  useSpeakerBoost?: boolean
  modelId?: string         // default eleven_multilingual_v2 (guaranteed timing)
  outputFormat?: 'mp3_44100_128' | 'mp3_44100_192'
  onModelUsed?: (model: string) => void
}): Promise<{ buffer: ArrayBuffer; alignment: TtsTimestamps | null }> {
  const body: Record<string, unknown> = {
    text: params.text,
    model_id: params.modelId ?? 'eleven_multilingual_v2',
    voice_settings: {
      stability: params.stability ?? 0.75,
      similarity_boost: params.similarity ?? 0.75,
      style: params.style ?? 0,
      use_speaker_boost: params.useSpeakerBoost ?? true,
      speed: params.speed ?? 1.0,
    },
  }

  const format = params.outputFormat ?? 'mp3_44100_128'
  const res = await fetch(`${EL_BASE}/text-to-speech/${params.voiceId}/with-timestamps?output_format=${format}`, {
    method: 'POST',
    headers: {
      'xi-api-key': params.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    // 192kbps requires Creator+ — auto-retry at 128kbps (mirrors textToSpeech).
    if (res.status === 403 && format === 'mp3_44100_192') {
      return textToSpeechWithTimestamps({ ...params, outputFormat: 'mp3_44100_128' })
    }
    // Throw with the raw status so the caller's hybrid loop can decide whether
    // to try another model or fall back to plain (timing-less) TTS. We do NOT
    // translate to a user-facing message here — this path is always wrapped in a
    // try/catch that degrades gracefully, never surfacing directly to the user.
    throw new Error(`tts-with-timestamps ${res.status}: ${err.slice(0, 160)}`)
  }

  params.onModelUsed?.(String(body.model_id))
  const data = (await res.json()) as {
    audio_base64?: string
    alignment?: {
      characters?: string[]
      character_start_times_seconds?: number[]
      character_end_times_seconds?: number[]
    } | null
  }
  if (!data.audio_base64) throw new Error('tts-with-timestamps: missing audio_base64')

  const buffer = base64ToArrayBuffer(data.audio_base64)
  const a = data.alignment
  const alignment: TtsTimestamps | null =
    a && Array.isArray(a.characters) && a.characters.length > 0 &&
    Array.isArray(a.character_start_times_seconds) && a.character_start_times_seconds.length > 0
      ? {
          characters: a.characters,
          characterStartTimesSeconds: a.character_start_times_seconds,
          characterEndTimesSeconds: a.character_end_times_seconds ?? [],
        }
      : null

  return { buffer, alignment }
}

// ── Audio concatenation via Web Audio API ─────────────────────────────────
// Concatenating MP3s at the binary level produces audible pops/static at the
// chunk boundaries (frame headers misalign, ID3 tags interrupt sample flow).
// That noise also breaks downstream lip-sync models like Kling Avatar — they
// lose phoneme tracking once they hit a pop. The fix: decode each MP3 to
// raw PCM samples via Web Audio API, concatenate samples (no boundaries),
// re-encode as a single seamless WAV file.

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}

function float32ToWav(samples: Float32Array, numChannels: number, sampleRate: number): ArrayBuffer {
  const dataSize = samples.length * 2  // 16-bit PCM
  const totalSize = 44 + dataSize
  const ab = new ArrayBuffer(totalSize)
  const view = new DataView(ab)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, totalSize - 8, true)
  writeString(view, 8, 'WAVE')
  // fmt chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)                              // chunk size
  view.setUint16(20, 1, true)                               // PCM format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * 2, true)    // byte rate
  view.setUint16(32, numChannels * 2, true)                 // block align
  view.setUint16(34, 16, true)                              // bits per sample
  // data chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // Samples (clamp to [-1, 1], convert to int16)
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }
  return ab
}

async function concatMp3sToWav(mp3Buffers: ArrayBuffer[]): Promise<ArrayBuffer> {
  if (mp3Buffers.length === 0) throw new Error('No audio buffers to concat')

  // Browsers may not honor sampleRate option exactly; we'll use whatever
  // decodeAudioData gives us (usually 44100 from ElevenLabs MP3 output)
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const audioCtx = new AudioCtx()

  try {
    // Decode each MP3 chunk into AudioBuffer (PCM samples in float32)
    const audioBuffers: AudioBuffer[] = []
    for (const mp3 of mp3Buffers) {
      // slice(0) creates a copy so the original ArrayBuffer isn't detached
      const decoded = await audioCtx.decodeAudioData(mp3.slice(0))
      audioBuffers.push(decoded)
    }

    // All chunks should share the same sample rate + channel count since
    // ElevenLabs returns consistent output for the same voice settings
    const numChannels = audioBuffers[0].numberOfChannels
    const sampleRate  = audioBuffers[0].sampleRate
    const totalSamples = audioBuffers.reduce((sum, b) => sum + b.length, 0)

    // Build interleaved sample array (left, right, left, right, ...)
    const output = new Float32Array(totalSamples * numChannels)
    let writeIndex = 0
    for (const buf of audioBuffers) {
      const channels: Float32Array[] = []
      for (let ch = 0; ch < numChannels; ch++) channels.push(buf.getChannelData(ch))
      for (let i = 0; i < buf.length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
          output[writeIndex++] = channels[ch][i]
        }
      }
    }

    return float32ToWav(output, numChannels, sampleRate)
  } finally {
    await audioCtx.close().catch(() => {})
  }
}

/**
 * Generate smooth, consistent TTS for long scripts by chunking on sentence
 * boundaries and passing previous_text/next_text for prosody continuity.
 *
 * Why: eleven_multilingual_v2 has known quality drift on inputs > ~500 chars.
 * Chunking with context keeps each chunk short enough that the model stays
 * stable, while previous_text/next_text ensures pitch/pace continuity.
 *
 * The returned audio is a single seamless WAV file: each MP3 chunk is decoded
 * to PCM via Web Audio API, samples concatenated, then re-encoded as WAV.
 * No binary-level MP3 concatenation = no pops/static at chunk boundaries.
 */
export async function textToSpeechSmooth(params: {
  apiKey: string
  voiceId: string
  text: string
  modelId?: string
  stability?: number
  similarity?: number
  style?: number
  /** Playback speed: 0.7 - 1.2, default 1.0. ElevenLabs hard-caps at 1.2. */
  speed?: number
  useSpeakerBoost?: boolean
  outputFormat?: 'mp3_44100_128' | 'mp3_44100_192'
  /** Target chars per chunk. Default 400 — sweet spot for v2 stability. */
  chunkSize?: number
  /** Called after each chunk completes (for progress UI) */
  onProgress?: (done: number, total: number) => void
}): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  const text = params.text.trim()
  const chunkSize = params.chunkSize ?? 400

  // Single call for short text — no chunking benefit, return raw MP3
  if (text.length <= chunkSize) {
    const buf = await textToSpeech({
      apiKey: params.apiKey,
      voiceId: params.voiceId,
      text,
      modelId: params.modelId,
      stability: params.stability,
      similarity: params.similarity,
      style: params.style,
      speed: params.speed,
      useSpeakerBoost: params.useSpeakerBoost,
      outputFormat: params.outputFormat,
    })
    return { buffer: buf, mimeType: 'audio/mpeg' }
  }

  // Split into sentences then regroup into ~chunkSize-char chunks
  const sentences = text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?。！？])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let buf = ''
  for (const sent of sentences) {
    const combined = buf ? `${buf} ${sent}` : sent
    if (combined.length > chunkSize && buf.length > 0) {
      chunks.push(buf)
      buf = sent
    } else {
      buf = combined
    }
  }
  if (buf.trim()) chunks.push(buf)

  // Edge case: a single sentence is longer than chunkSize → still send as one
  if (chunks.length === 0) chunks.push(text)

  // Generate each chunk in sequence (parallel risks rate limits + breaks order)
  const buffers: ArrayBuffer[] = []
  for (let i = 0; i < chunks.length; i++) {
    // Context windows: trailing ~200 chars of prior chunks, leading ~200 of next
    const previousText = i > 0                  ? chunks.slice(0, i).join(' ').slice(-200) : undefined
    const nextText     = i < chunks.length - 1  ? chunks.slice(i + 1).join(' ').slice(0, 200) : undefined

    const buf = await textToSpeech({
      apiKey: params.apiKey,
      voiceId: params.voiceId,
      text: chunks[i],
      modelId: params.modelId,
      stability: params.stability,
      similarity: params.similarity,
      style: params.style,
      speed: params.speed,
      useSpeakerBoost: params.useSpeakerBoost,
      outputFormat: params.outputFormat,
      previousText,
      nextText,
    })
    buffers.push(buf)
    params.onProgress?.(i + 1, chunks.length)
  }

  // Decode each MP3 → PCM samples → concatenate samples (no boundary pops)
  // → re-encode as a single WAV file. Result: seamless audio that downstream
  // models (Kling Avatar) can lip-sync without losing track at chunk seams.
  const wavBuffer = await concatMp3sToWav(buffers)
  return { buffer: wavBuffer, mimeType: 'audio/wav' }
}

// ─── Video Dubbing (ElevenLabs Dubbing API) ─────────────────────────────────

export interface DubbingProject {
  dubbingId: string
  name: string
  status: 'pending' | 'processing' | 'dubbed' | 'failed'
  targetLanguages: string[]
  sourceLanguage?: string
  createdAt: string
  error?: string
}

/**
 * Create a dubbing project. Pass either `file` (upload) or `sourceUrl` (remote URL).
 * Returns dubbingId to poll with getDubbingStatus.
 * Requires ElevenLabs Creator plan or higher.
 */
export async function createDubbing(params: {
  apiKey: string
  file?: File
  sourceUrl?: string
  targetLang: string
  sourceLang?: string   // 'auto' by default
  name?: string
  numSpeakers?: number  // 0 = auto-detect
  highestResolution?: boolean
  /**
   * If true, skip voice cloning and use a SIMILAR voice from the ElevenLabs
   * Voice Library — native accent for target language. Default false (clone
   * original speaker, foreigner accent). Note: counts toward workspace's
   * custom voices limit; requires 'add_voice_from_voice_library' permission.
   */
  disableVoiceCloning?: boolean
}): Promise<{ dubbingId: string; expectedDurationSec: number }> {
  if (!params.apiKey) throw new Error('Vui lòng nhập ElevenLabs API key trong Cài đặt')
  if (!params.file && !params.sourceUrl) throw new Error('Cần file video hoặc URL video')

  const form = new FormData()
  if (params.name)           form.append('name', params.name)
  if (params.file)           form.append('file', params.file, params.file.name)
  if (params.sourceUrl)      form.append('source_url', params.sourceUrl)
  form.append('source_lang', params.sourceLang ?? 'auto')
  form.append('target_lang', params.targetLang)
  form.append('num_speakers', String(params.numSpeakers ?? 0))
  form.append('watermark', 'false')
  if (params.highestResolution) form.append('highest_resolution', 'true')
  if (params.disableVoiceCloning) form.append('disable_voice_cloning', 'true')

  const res = await fetch(`${EL_BASE}/dubbing`, {
    method: 'POST',
    headers: { 'xi-api-key': params.apiKey },
    body: form,
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    let detail = err
    try {
      const parsed = JSON.parse(err) as { detail?: { status?: string; message?: string } | string }
      if (typeof parsed.detail === 'object' && parsed.detail) {
        detail = `${parsed.detail.status ?? ''} ${parsed.detail.message ?? ''}`.trim()
      } else if (typeof parsed.detail === 'string') {
        detail = parsed.detail
      }
    } catch {/* keep raw */}

    // Phase 3: log full raw body for diagnostics — no truncation here
    console.error('[elevenlabs.createDubbing] failed', {
      httpStatus: res.status,
      rawBody: err,
      parsedDetail: detail,
      sentParams: {
        sourceLang: params.sourceLang,
        targetLang: params.targetLang,
        numSpeakers: params.numSpeakers,
        hasFile: !!params.file,
        hasSourceUrl: !!params.sourceUrl,
      },
    })

    if (res.status === 401) {
      const lower = detail.toLowerCase()
      if (lower.includes('detected_unusual_activity') || lower.includes('free_tier')) {
        throw new Error('Key ElevenLabs bị khóa (anti-abuse). Cần key cá nhân hợp lệ tại elevenlabs.io.')
      }
      throw new Error(`API key ElevenLabs không hợp lệ — kiểm tra lại trong Cài đặt. (${detail})`)
    }
    if (res.status === 402 || res.status === 403) {
      throw new Error(`Tính năng Dubbing yêu cầu gói Creator ($22/mo) trở lên tại elevenlabs.io. Raw: ${detail}`)
    }
    if (res.status === 422) {
      // Phase 4: 422 usually means invalid language pair or unsupported codec.
      // Surface FULL error so user knows exactly which param is wrong.
      throw new Error(`Dữ liệu không hợp lệ (422): ${detail}`)
    }
    // Phase 4: untruncated — full ElevenLabs response goes to UI
    throw new Error(`Tạo dubbing thất bại (HTTP ${res.status}): ${detail}`)
  }

  const data = await res.json() as { dubbing_id?: string; expected_duration_sec?: number }
  if (!data.dubbing_id) throw new Error('ElevenLabs không trả về dubbing_id — thử lại')
  return { dubbingId: data.dubbing_id, expectedDurationSec: data.expected_duration_sec ?? 0 }
}

/** Get current status of a dubbing project */
export async function getDubbingStatus(apiKey: string, dubbingId: string): Promise<DubbingProject> {
  const res = await fetch(`${EL_BASE}/dubbing/${dubbingId}`, {
    headers: { 'xi-api-key': apiKey },
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Kiểm tra trạng thái dubbing thất bại (${res.status}): ${err.slice(0, 100)}`)
  }
  const data = await res.json() as {
    dubbing_id: string
    name: string
    status: string
    target_languages?: string[]
    source_language?: string
    created_at?: string
    error?: string
  }

  let status: DubbingProject['status'] = 'pending'
  const raw = (data.status ?? '').toLowerCase()
  if (raw === 'dubbed') status = 'dubbed'
  else if (raw === 'failed' || raw === 'error') status = 'failed'
  else if (raw === 'processing' || raw === 'in_progress' || raw === 'running') status = 'processing'

  return {
    dubbingId: data.dubbing_id,
    name: data.name ?? '',
    status,
    targetLanguages: data.target_languages ?? [],
    sourceLanguage: data.source_language,
    createdAt: data.created_at ?? new Date().toISOString(),
    error: data.error,
  }
}

/** Download the dubbed media from ElevenLabs. Two flavors:
 *  - 'audio' (default) → just the dubbed audio track, used when feeding
 *    into fal.ai LatentSync for full lip-sync pipeline.
 *  - 'video' → the original video with dubbed audio mixed in (no lip-sync).
 *    Used for voice-only mode (faster, no fal.ai needed). */
export async function getDubbedMedia(
  apiKey: string,
  dubbingId: string,
  languageCode: string,
  mediaType: 'audio' | 'video' = 'audio',
): Promise<Blob> {
  const res = await fetch(`${EL_BASE}/dubbing/${dubbingId}/${mediaType}/${languageCode}`, {
    headers: { 'xi-api-key': apiKey },
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Tải ${mediaType} đã dịch thất bại (${res.status}): ${err.slice(0, 100)}`)
  }
  return res.blob()
}

/** Delete a dubbing project */
export async function deleteDubbing(apiKey: string, dubbingId: string): Promise<void> {
  await fetch(`${EL_BASE}/dubbing/${dubbingId}`, {
    method: 'DELETE',
    headers: { 'xi-api-key': apiKey },
  })
}

/** Poll until dubbing is complete (dubbed or failed). Calls onStatusChange on each tick. */
export async function pollDubbingUntilDone(params: {
  apiKey: string
  dubbingId: string
  onStatusChange?: (status: DubbingProject['status']) => void
  timeoutMs?: number
}): Promise<DubbingProject> {
  const timeout = params.timeoutMs ?? 20 * 60 * 1000  // 20 min max
  const start   = Date.now()
  let tickIdx = 0

  while (Date.now() - start < timeout) {
    await new Promise<void>((r) => setTimeout(r, 6000))  // poll every 6s

    const project = await getDubbingStatus(params.apiKey, params.dubbingId)
    // Phase 3: log every poll tick so we can see exactly when/why dubbing stalls
    tickIdx++
    console.info(`[elevenlabs.poll] tick #${tickIdx} dubbingId=${params.dubbingId} status=${project.status}${project.error ? ` error=${project.error}` : ''}`)
    params.onStatusChange?.(project.status)

    if (project.status === 'dubbed' || project.status === 'failed') {
      return project
    }
  }

  throw new Error('TIMEOUT')
}

// ─────────────────────────────────────────────────────────────────────────────

/** Get remaining credits/character count */
export async function getSubscription(apiKey: string): Promise<{ used: number; limit: number; remaining: number; tier: string }> {
  const res = await fetch(`${EL_BASE}/user/subscription`, {
    headers: { 'xi-api-key': apiKey },
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Subscription lỗi (${res.status}): ${err.slice(0, 150)}`)
  }
  const data = (await res.json()) as SubscriptionResponse
  return {
    used: data.character_count,
    limit: data.character_limit,
    remaining: Math.max(0, data.character_limit - data.character_count),
    tier: data.tier,
  }
}
