// ── Vercel serverless — SPY VIDEO ADS TikTok (ScrapeCreators TikTok Ad Library / Top Ads) ──
// Frontend: /api/tiktok-ads?q=kurus&country=MY&cursor=<n>
// Đây CHÍNH LÀ TikTok Creative Center "Top Ads" (top ad theo region+period+keyword) → CÓ phủ MY.
// Schema (verify docs): { ads:[ { ad_title, brand_name, like, ctr, video_info:{ duration, cover,
//   video_url:{ "540p","720p",... } } } ], cursor, has_more }. Param: query, region (default US), period(7/30/180).
import type { VercelRequest, VercelResponse } from '@vercel/node'

const VALID_REGION = new Set(['MY', 'ID', 'TH', 'VN', 'PH', 'SG'])
type AnyObj = Record<string, unknown>

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.SC_KEY
  if (!key) return res.status(500).json({ error: 'Server thiếu SC_KEY' })
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!q) return res.status(400).json({ error: 'Cần q (từ khóa / ngách)' })
  const cRaw = typeof req.query.country === 'string' ? req.query.country.toUpperCase() : 'MY'
  const region = VALID_REGION.has(cRaw) ? cRaw : 'MY'   // 'ALL' → ép về MY (Creative Center cần 1 nước)
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : ''

  try {
    // period=30 (mặc định, nhẹ hơn 180 — giảm rủi ro 500); order_by=like (top theo thích).
    // KHÔNG set limit (API giới hạn max thấp → limit=50 gây 500 'Limit failed on max'); dùng mặc định.
    let u = `https://api.scrapecreators.com/v1/tiktok/ad-library/search?query=${encodeURIComponent(q)}&region=${region}&period=30&order_by=like`
    if (cursor) u += `&cursor=${encodeURIComponent(cursor)}`

    // Gọi + retry 1 lần nếu 5xx; BẮT lỗi thật (status + body) thay vì nuốt.
    let r: Response | null = null
    let body = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      r = await fetch(u, { headers: { 'x-api-key': key } })
      body = await r.text()
      if (r.ok) break
      if (attempt === 0 && r.status >= 500) { await new Promise((res) => setTimeout(res, 1500)); continue }
      break
    }
    if (!r || !r.ok) {
      return res.status(502).json({ error: `TikTok Ad Library lỗi ${r?.status ?? '?'}: ${body.slice(0, 200)}` })
    }
    let d: AnyObj
    try { d = JSON.parse(body) as AnyObj } catch { return res.status(502).json({ error: 'TikTok trả về không phải JSON: ' + body.slice(0, 150) }) }
    if (!Array.isArray(d.ads) && (d.error || d.message)) {
      return res.status(502).json({ error: 'TikTok Ad Library: ' + String(d.error || d.message).slice(0, 200) })
    }
    const raw = Array.isArray(d.ads) ? (d.ads as AnyObj[]) : []

    const ads = raw
      .map((a, i) => {
        const vi = (a.video_info as AnyObj) || {}
        const vurl = (vi.video_url as Record<string, string>) || {}
        const videoUrl = vurl['720p'] || vurl['540p'] || vurl['1080p'] || Object.values(vurl).find((v) => typeof v === 'string' && v) || ''
        const brand = String(a.brand_name ?? '')
        const id = String(a.id ?? a.ad_id ?? videoUrl ?? `${brand}-${i}`)
        return {
          id,
          page: brand,
          text: String(a.ad_title ?? '').slice(0, 300),
          videoUrl: String(videoUrl),
          cover: String(vi.cover ?? ''),
          linkUrl: '',                                   // Creative Center không có link đích
          country: region,
          isActive: true,
          daysRunning: 0,
          advertiserAds: 1,
          likes: Number(a.like ?? 0) || 0,
          ctr: a.ctr != null ? String(a.ctr) : '',
          libraryUrl: `https://library.tiktok.com/ads?region=${region}`,
        }
      })
      .filter((a) => a.id && a.videoUrl)
      .sort((x, y) => y.likes - x.likes)                 // top theo lượt thích = winner

    const nextCursor = (d.cursor as string | number | undefined) ?? null
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=900')
    return res.status(200).json({
      ads: ads.slice(0, 60),
      cursor: nextCursor,
      hasMore: d.has_more != null ? !!d.has_more : (nextCursor != null && raw.length > 0),
      rawCount: raw.length,
      credits: (d.credits_remaining as number | undefined) ?? null,
      note: ads.length ? undefined : ((d.error as string) || (d.message as string) || 'no tiktok video ads'),
    })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
