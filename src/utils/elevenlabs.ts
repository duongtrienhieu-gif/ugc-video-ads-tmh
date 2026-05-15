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
    if (res.status === 401) throw new Error('API key không hợp lệ')
    if (res.status === 402 || res.status === 403) throw new Error('Gói ElevenLabs của bạn không hỗ trợ Voice Cloning. Cần Starter ($5/mo) trở lên.')
    if (res.status === 422) throw new Error(`File không hợp lệ: ${err.slice(0, 150)}`)
    throw new Error(`Clone giọng thất bại (${res.status}): ${err.slice(0, 150)}`)
  }

  const data = (await res.json()) as { voice_id: string }
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
  stability?: number       // 0-1, default 0.5 (lower = more variable/expressive)
  similarity?: number      // 0-1, default 0.75 (how close to original voice)
  style?: number           // 0-1, default 0 (style exaggeration)
  useSpeakerBoost?: boolean
  modelId?: string         // default eleven_multilingual_v2
}): Promise<ArrayBuffer> {
  const body = {
    text: params.text,
    model_id: params.modelId ?? 'eleven_multilingual_v2',
    voice_settings: {
      stability: params.stability ?? 0.5,
      similarity_boost: params.similarity ?? 0.75,
      style: params.style ?? 0,
      use_speaker_boost: params.useSpeakerBoost ?? true,
    },
  }

  const res = await fetch(`${EL_BASE}/text-to-speech/${params.voiceId}?output_format=mp3_44100_128`, {
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
    if (res.status === 401) throw new Error('API key không hợp lệ hoặc hết credit')
    if (res.status === 422) throw new Error(`Yêu cầu không hợp lệ: ${err.slice(0, 150)}`)
    throw new Error(`ElevenLabs TTS lỗi (${res.status}): ${err.slice(0, 150)}`)
  }

  return res.arrayBuffer()
}

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
