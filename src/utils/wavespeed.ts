// ── WaveSpeedAI lip-sync client (InfiniteTalk-Fast) ──────────────────────────
// Thay KIE khi KIE `infinitalk/from-audio` nghẽn dài (đã hỏng >7 ngày). CÙNG model
// InfiniteTalk, khác hạ tầng, cùng giá ~$0.015/s (min 5s). Ảnh + audio → video mp4.
// Cơ chế: POST submit → nhận id → poll /predictions/{id}/result → outputs[0] = URL.
// ─────────────────────────────────────────────────────────────────────────────

const WS_BASE = 'https://api.wavespeed.ai/api/v3'

export interface WavespeedSubmitResult { requestId: string }

/** Submit 1 job lip-sync (ảnh + audio) → { requestId }. Đã trả tiền khi submit thành công. */
export async function submitInfiniteTalkFast(p: {
  apiKey: string
  imageUrl: string
  audioUrl: string
  prompt?: string
  seed?: number
  signal?: AbortSignal
}): Promise<WavespeedSubmitResult> {
  const body: Record<string, unknown> = { image: p.imageUrl, audio: p.audioUrl, seed: p.seed ?? -1 }
  if (p.prompt && p.prompt.trim()) body.prompt = p.prompt.trim()
  const res = await fetch(`${WS_BASE}/wavespeed-ai/infinitetalk-fast`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${p.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: p.signal,
  })
  const text = await res.text()
  if (res.status === 401 || res.status === 403) throw new Error('WaveSpeed API key không hợp lệ')
  if (res.status === 402) throw new Error('WaveSpeed hết credit — nạp thêm tại wavespeed.ai/billing')
  if (!res.ok) throw new Error(`WaveSpeed submit lỗi (${res.status}): ${text.slice(0, 300)}`)
  let data: { data?: { id?: string } }
  try { data = JSON.parse(text) } catch { throw new Error(`WaveSpeed trả về không parse được: ${text.slice(0, 200)}`) }
  const requestId = data?.data?.id
  if (!requestId) throw new Error(`WaveSpeed không trả về id: ${text.slice(0, 200)}`)
  return { requestId }
}

/** Poll tới khi xong → URL video mp4 (outputs[0]). Throw khi failed/timeout. */
export async function pollWavespeedVideoUrl(p: {
  apiKey: string
  requestId: string
  timeoutMs?: number
  onStatus?: (status: string) => void
  signal?: AbortSignal
}): Promise<string> {
  const t0 = Date.now()
  const timeout = p.timeoutMs ?? 15 * 60 * 1000
  let last = ''
  while (Date.now() - t0 < timeout) {
    if (p.signal?.aborted) throw new Error('CANCELLED — user hủy')
    const res = await fetch(`${WS_BASE}/predictions/${encodeURIComponent(p.requestId)}/result`, {
      headers: { Authorization: `Bearer ${p.apiKey}` },
    })
    if (!res.ok) {
      const t = await res.text().catch(() => res.statusText)
      throw new Error(`WaveSpeed poll lỗi (${res.status}): ${t.slice(0, 200)}`)
    }
    const data = await res.json().catch(() => ({} as { data?: unknown }))
    const rec = (data as { data?: { status?: string; outputs?: string[]; error?: string } }).data ?? {}
    const status = String(rec.status ?? '').toLowerCase()
    if (status !== last) { p.onStatus?.(status); last = status }
    if (status === 'completed') {
      const url = Array.isArray(rec.outputs) ? rec.outputs[0] : undefined
      if (!url) throw new Error('WaveSpeed hoàn tất nhưng không có video URL')
      return url
    }
    if (status === 'failed') throw new Error(`WaveSpeed render thất bại: ${rec.error ?? 'không rõ'}`)
    await new Promise((r) => setTimeout(r, 5000))
  }
  throw new Error('WaveSpeed timeout (15 phút)')
}
