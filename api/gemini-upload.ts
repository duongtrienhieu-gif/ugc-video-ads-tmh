// ── Vercel serverless — tải video (né CORS) + upload lên Gemini Files API ─────
// Client POST { url, apiKey } → server tải MP4 từ TikTok CDN (server-side không dính
// CORS) → resumable upload lên Gemini Files API → trả { fileUri, fileName, mimeType, state }.
// KHÔNG poll ở server (giữ < 10s timeout Vercel Hobby) — client tự poll tới ACTIVE rồi
// gọi generateContent. KHÔNG trả bytes video về client (né luôn giới hạn 4.5MB response).
import type { VercelRequest, VercelResponse } from '@vercel/node'

const GEMINI_FILES_UPLOAD = 'https://generativelanguage.googleapis.com/upload/v1beta/files'

type Inline = { inlineData: { mimeType: string; data: string } }
async function fetchInline(url: string): Promise<Inline | null> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' } })
    if (!r.ok) return null
    const mime = r.headers.get('content-type') || 'image/jpeg'
    if (!/image\//i.test(mime)) return null
    const b = Buffer.from(await r.arrayBuffer())
    if (!b.length || b.length > 3_500_000) return null
    return { inlineData: { mimeType: mime, data: b.toString('base64') } }
  } catch { return null }
}

// action=matchads — so ẢNH SP vs cover quảng cáo → ad nào ĐÚNG SP (chống drift).
// Server fetch ảnh (né CORS cover TikTok/FB) + 1 Gemini vision call batch ≤8 cover.
async function handleMatchAds(req: VercelRequest, res: VercelResponse) {
  const body = (req.body || {}) as { apiKey?: string; productImageUrl?: string; covers?: { id?: string; url?: string }[] }
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey : ''
  const productImageUrl = typeof body.productImageUrl === 'string' ? body.productImageUrl : ''
  const covers = (Array.isArray(body.covers) ? body.covers : []).filter((c) => c?.url).slice(0, 8)
  if (!apiKey || !productImageUrl || !covers.length) return res.status(400).json({ error: 'Thiếu apiKey/productImageUrl/covers' })

  const prod = await fetchInline(productImageUrl)
  if (!prod) return res.status(502).json({ error: 'Không tải được ảnh SP' })

  const parts: unknown[] = [{ text: 'ẢNH GỐC — sản phẩm cần khớp:' }, prod]
  const idMap: string[] = []
  for (const c of covers) {
    const inl = await fetchInline(String(c.url))
    if (!inl) continue
    parts.push({ text: `Ảnh quảng cáo #${idMap.length}:` })
    parts.push(inl)
    idMap.push(String(c.id ?? idMap.length))
  }
  if (!idMap.length) return res.status(200).json({ matches: [] })
  parts.push({ text: `Mỗi "Ảnh quảng cáo #i": nó quảng cáo CHÍNH XÁC sản phẩm trong ẢNH GỐC không (cùng bao bì/chai/hộp/nhãn — KHÔNG phải SP khác cùng loại/cùng ngách)? Trả JSON {"results":[{"i":0,"match":true,"score":85}]} (score 0-100).` })

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens: 1024 } }),
    })
    const d = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const text = d?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    let results: { i?: number; match?: boolean; score?: number }[] = []
    try { results = (JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()) as { results?: typeof results }).results ?? [] } catch { results = [] }
    const matches = results
      .map((x) => ({ id: idMap[Number(x.i)], match: !!x.match, score: Number(x.score) || 0 }))
      .filter((m) => m.id)
    return res.status(200).json({ matches })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if ((req.body as { action?: string })?.action === 'matchads') return handleMatchAds(req, res)
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
