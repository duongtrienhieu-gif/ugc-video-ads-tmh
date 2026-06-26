// ── Vercel serverless — tải video (né CORS) + upload lên Gemini Files API ─────
// Client POST { url, apiKey } → server tải MP4 từ TikTok CDN (server-side không dính
// CORS) → resumable upload lên Gemini Files API → trả { fileUri, fileName, mimeType, state }.
// KHÔNG poll ở server (giữ < 10s timeout Vercel Hobby) — client tự poll tới ACTIVE rồi
// gọi generateContent. KHÔNG trả bytes video về client (né luôn giới hạn 4.5MB response).
import type { VercelRequest, VercelResponse } from '@vercel/node'

const GEMINI_FILES_UPLOAD = 'https://generativelanguage.googleapis.com/upload/v1beta/files'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const body = (req.body || {}) as { url?: string; apiKey?: string }
  const url = typeof body.url === 'string' ? body.url : ''
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey : ''
  if (!url || !/^https?:\/\//.test(url)) return res.status(400).json({ error: 'Thiếu/không hợp lệ url video' })
  if (!apiKey) return res.status(400).json({ error: 'Thiếu Gemini apiKey' })

  try {
    // 1) Tải video từ CDN (header giả lập để TikTok CDN chịu trả file).
    const vidRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        'Referer': 'https://www.tiktok.com/',
      },
    })
    if (!vidRes.ok) return res.status(502).json({ error: `Tải video lỗi (${vidRes.status})` })
    const mime = vidRes.headers.get('content-type') || 'video/mp4'
    const buf = Buffer.from(await vidRes.arrayBuffer())
    if (!buf.length) return res.status(502).json({ error: 'Video rỗng' })

    // 2a) Init resumable upload session lên Gemini Files API.
    const initRes = await fetch(`${GEMINI_FILES_UPLOAD}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(buf.length),
        'X-Goog-Upload-Header-Content-Type': mime,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: 'tt-video' } }),
    })
    const uploadUrl = initRes.headers.get('x-goog-upload-url') || initRes.headers.get('X-Goog-Upload-URL')
    if (!uploadUrl) {
      const e = await initRes.text().catch(() => initRes.statusText)
      return res.status(502).json({ error: `Gemini init upload lỗi: ${e.slice(0, 150)}` })
    }

    // 2b) Upload bytes + finalize.
    const upRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize', 'Content-Type': mime },
      body: buf,
    })
    const upData = (await upRes.json()) as { file?: { name?: string; uri?: string; state?: string; mimeType?: string } }
    const f = upData.file
    if (!f?.uri || !f?.name) {
      return res.status(502).json({ error: 'Gemini upload không trả fileUri' })
    }
    return res.status(200).json({
      fileUri: f.uri,
      fileName: f.name,           // dạng "files/abc123" — client dùng để poll
      mimeType: f.mimeType || mime,
      state: f.state || 'PROCESSING',
    })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
