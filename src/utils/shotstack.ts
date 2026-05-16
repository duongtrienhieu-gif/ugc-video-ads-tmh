// ── Shotstack API client ──────────────────────────────────────────────────────
// Video composition: multi-layer assembly (B-roll + avatar overlay + captions)
// Docs: https://shotstack.io/docs/api/

const SHOTSTACK_BASE = 'https://api.shotstack.io/edit/v1'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShotstackVideoAsset {
  type: 'video'
  src: string
  trim?: number       // start trim in seconds
  volume?: number
  volumeEffect?: 'fadeIn' | 'fadeOut' | 'fadeInFadeOut'
}

interface ShotstackHtmlAsset {
  type: 'html'
  html: string
  css?: string
  width?: number
  height?: number
  background?: string
  position?: string
}

type ShotstackAsset = ShotstackVideoAsset | ShotstackHtmlAsset

interface ShotstackClip {
  asset: ShotstackAsset
  start: number
  length: number
  fit?: 'cover' | 'contain' | 'crop' | 'none'
  scale?: number
  position?: 'topLeft' | 'topCenter' | 'topRight' | 'left' | 'center' | 'right' | 'bottomLeft' | 'bottomCenter' | 'bottomRight'
  offset?: { x: number; y: number }
  transition?: { in?: string; out?: string }
  effect?: string
  opacity?: number
}

interface ShotstackTrack {
  clips: ShotstackClip[]
}

interface ShotstackTimeline {
  soundtrack?: {
    src: string
    effect?: 'fadeIn' | 'fadeOut' | 'fadeInFadeOut'
    volume?: number
  }
  background?: string
  tracks: ShotstackTrack[]
}

interface ShotstackOutput {
  format: 'mp4' | 'gif' | 'jpg' | 'png'
  resolution?: '270' | '360' | '540' | 'sd' | '720' | 'hd' | '1080' | '2160'
  aspectRatio?: '1:1' | '4:3' | '16:9' | '9:16' | '2:3'
  fps?: number
  quality?: 'low' | 'medium' | 'high'
}

interface ShotstackRenderBody {
  timeline: ShotstackTimeline
  output: ShotstackOutput
}

interface ShotstackRenderResponse {
  success: boolean
  message: string
  response: { message: string; id: string }
}

interface ShotstackStatusResponse {
  success: boolean
  message: string
  response: {
    id: string
    owner: string
    plan: string
    status: 'queued' | 'fetching' | 'rendering' | 'saving' | 'done' | 'failed'
    error?: string
    duration?: number
    render_time?: number
    url?: string
    poster?: string
    created?: string
    updated?: string
  }
}

// ── Submit render ─────────────────────────────────────────────────────────────

export async function submitRender(params: {
  apiKey: string
  body: ShotstackRenderBody
}): Promise<string> {
  const res = await fetch(`${SHOTSTACK_BASE}/render`, {
    method: 'POST',
    headers: {
      'x-api-key': params.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params.body),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    if (res.status === 401) throw new Error('Shotstack API key không hợp lệ — kiểm tra trong Cài đặt')
    if (res.status === 402) throw new Error('Tài khoản Shotstack hết render credits')
    throw new Error(`Shotstack lỗi (${res.status}): ${err.slice(0, 200)}`)
  }

  const data = await res.json() as ShotstackRenderResponse
  if (!data.response?.id) throw new Error('Shotstack không trả về render ID')
  return data.response.id
}

// ── Get render status ─────────────────────────────────────────────────────────

export async function getRenderStatus(params: {
  apiKey: string
  renderId: string
}): Promise<{ status: string; url?: string; error?: string }> {
  const res = await fetch(`${SHOTSTACK_BASE}/render/${params.renderId}`, {
    headers: { 'x-api-key': params.apiKey },
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Kiểm tra trạng thái Shotstack thất bại (${res.status}): ${err.slice(0, 150)}`)
  }

  const data = await res.json() as ShotstackStatusResponse
  return {
    status: data.response.status,
    url: data.response.url,
    error: data.response.error,
  }
}

// ── Poll until done ───────────────────────────────────────────────────────────

export async function pollRenderUntilDone(params: {
  apiKey: string
  renderId: string
  onStatusChange?: (status: string) => void
  timeoutMs?: number
  intervalMs?: number
}): Promise<string> {
  const timeout = params.timeoutMs ?? 15 * 60 * 1000  // 15 min
  const interval = params.intervalMs ?? 8000           // 8s

  const start = Date.now()
  let lastStatus = ''

  while (Date.now() - start < timeout) {
    const { status, url, error } = await getRenderStatus({
      apiKey: params.apiKey,
      renderId: params.renderId,
    })

    if (status !== lastStatus) {
      lastStatus = status
      params.onStatusChange?.(status)
    }

    if (status === 'done') {
      if (!url) throw new Error('Shotstack render done nhưng không có URL')
      return url
    }
    if (status === 'failed') {
      throw new Error(`Shotstack render thất bại: ${error ?? 'unknown error'}`)
    }

    await new Promise((r) => setTimeout(r, interval))
  }

  throw new Error('TIMEOUT')
}

// ── Build timeline helpers ────────────────────────────────────────────────────

/** Caption style for the video */
const CAPTION_CSS = `
  p {
    color: #ffffff;
    background: rgba(0, 0, 0, 0.72);
    padding: 10px 24px;
    border-radius: 10px;
    font-size: 38px;
    font-weight: 700;
    font-family: 'Plus Jakarta Sans', sans-serif;
    text-align: center;
    line-height: 1.3;
    max-width: 900px;
    word-break: break-word;
  }
`

export interface SegmentTiming {
  text: string
  startSec: number
  durationSec: number
  brollUrl: string | null
  avatarPosition: 'left' | 'right'
}

/** Build and submit the full 3-layer Shotstack render */
export async function buildUGCVideo(params: {
  apiKey: string
  voiceUrl: string           // ElevenLabs audio URL
  avatarVideoUrl: string     // KIE.ai avatar (with bg removed)
  totalDuration: number      // seconds
  segments: SegmentTiming[]
}): Promise<string> {  // returns renderId
  const { voiceUrl, avatarVideoUrl, totalDuration, segments } = params

  // ── Layer 1: B-roll clips (background) ─────────────────────────────────────
  const brollClips: ShotstackClip[] = []
  let cursor = 0

  for (const seg of segments) {
    const clipLen = seg.durationSec
    if (seg.brollUrl) {
      brollClips.push({
        asset: { type: 'video', src: seg.brollUrl, volume: 0 },
        start: cursor,
        length: clipLen,
        fit: 'cover',
      })
    } else {
      // No B-roll for this segment — use a black gap (already background)
    }
    cursor += clipLen
  }

  // If total B-roll shorter than audio, pad last clip
  if (cursor < totalDuration && brollClips.length > 0) {
    const last = brollClips[brollClips.length - 1]
    last.length += (totalDuration - cursor)
  }

  // ── Layer 2: Avatar overlay (full duration, corner) ────────────────────────
  const avatarClip: ShotstackClip = {
    asset: { type: 'video', src: avatarVideoUrl, volume: 0 },
    start: 0,
    length: totalDuration,
    scale: 0.42,
    position: 'bottomRight',
    offset: { x: -0.02, y: 0.02 },
  }

  // ── Layer 3: Caption clips ─────────────────────────────────────────────────
  const captionClips: ShotstackClip[] = segments.map((seg) => ({
    asset: {
      type: 'html',
      html: `<p>${seg.text.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`,
      css: CAPTION_CSS,
      width: 960,
      height: 260,
      background: 'transparent',
    },
    start: seg.startSec,
    length: seg.durationSec,
    position: 'bottomCenter',
    offset: { x: 0, y: 0.12 },
  } as ShotstackClip))

  // ── Assemble timeline ──────────────────────────────────────────────────────
  const body: ShotstackRenderBody = {
    timeline: {
      soundtrack: { src: voiceUrl, effect: 'fadeOut', volume: 1 },
      background: '#0a0a0a',
      tracks: [
        { clips: captionClips },        // Track 0 = top (captions)
        { clips: [avatarClip] },         // Track 1 = avatar overlay
        { clips: brollClips },           // Track 2 = background B-roll
      ],
    },
    output: {
      format: 'mp4',
      resolution: '1080',
      aspectRatio: '9:16',
      fps: 25,
      quality: 'high',
    },
  }

  return submitRender({ apiKey: params.apiKey, body })
}
