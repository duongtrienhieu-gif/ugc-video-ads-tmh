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
    if (res.status === 401) throw new Error('API key không hợp lệ')
    if (res.status === 402 || res.status === 403) throw new Error('Đã đạt giới hạn số giọng. Xóa bớt giọng cũ hoặc upgrade gói.')
    throw new Error(`Thêm giọng thất bại (${res.status}): ${err.slice(0, 150)}`)
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
  speed?: number           // 0.7 - 1.2, default 1.0 (playback speed)
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
      speed: params.speed ?? 1.0,
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
      if (detail.toLowerCase().includes('quota')) throw new Error('Đã hết credit ElevenLabs — đợi reset tháng sau hoặc upgrade gói')
      if (detail.toLowerCase().includes('invalid')) throw new Error('API key ElevenLabs không hợp lệ — kiểm tra lại key trong Cài đặt')
      throw new Error(`Không xác thực được: ${detail.slice(0, 200)}`)
    }
    if (res.status === 422) throw new Error(`Tham số không hợp lệ: ${detail.slice(0, 200)}`)
    throw new Error(`ElevenLabs TTS lỗi (${res.status}): ${detail.slice(0, 200)}`)
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
