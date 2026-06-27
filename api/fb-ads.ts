// ── Vercel serverless — SPY VIDEO ADS đối thủ (ScrapeCreators Facebook Ad Library) ──
// Frontend: /api/fb-ads?q=collagen&country=MY&status=ACTIVE&cursor=<n>
// Trả creative QUẢNG CÁO (video) đối thủ đang chạy. Win signal (FB không lộ chi tiêu):
// đang ACTIVE + chạy LÂU (start_date) + advertiser có NHIỀU ad (đang scale).
// Key SC_KEY server-side (cùng key TikTok). 1 credit/request.
import type { VercelRequest, VercelResponse } from '@vercel/node'

const VALID_COUNTRY = new Set(['MY', 'ID', 'TH', 'VN', 'PH', 'SG', 'ALL'])

interface Snapshot {
  body?: { text?: string }
  videos?: { video_url?: string; video_hd_url?: string; video_sd_url?: string; video_preview_image_url?: string }[]
  images?: { original_image_url?: string }[]
  link_url?: string
  page_name?: string
}
interface FbAd {
  ad_archive_id?: string | number
  page_name?: string
  page_id?: string | number
  start_date?: number
  end_date?: number
  is_active?: boolean
  country_iso_code?: string
  snapshot?: Snapshot
}

// Tìm mảng ads trong response (wrapper key có thể khác nhau).
function pickAds(d: Record<string, unknown>): FbAd[] {
  const cands = ['results', 'searchResults', 'ads', 'data']
  for (const k of cands) if (Array.isArray(d[k])) return d[k] as FbAd[]
  if (Array.isArray(d)) return d as unknown as FbAd[]
  for (const k in d) {
    const v = d[k]
    if (Array.isArray(v) && v.length && (v[0] as FbAd)?.ad_archive_id != null) return v as FbAd[]
  }
  return []
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.SC_KEY
  if (!key) return res.status(500).json({ error: 'Server thiếu SC_KEY' })

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!q) return res.status(400).json({ error: 'Cần q (từ khóa / ngách)' })
  const cRaw = typeof req.query.country === 'string' ? req.query.country.toUpperCase() : 'MY'
  const country = VALID_COUNTRY.has(cRaw) ? cRaw : 'MY'
  const status = req.query.status === 'ALL' ? 'ALL' : 'ACTIVE'   // mặc định chỉ ad đang chạy = winner
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : ''

  try {
    const baseUrl = `https://api.scrapecreators.com/v1/facebook/adLibrary/search/ads?query=${encodeURIComponent(q)}&country=${country}&status=${status}&media_type=VIDEO&ad_type=all`
    // Mỗi trang SC chỉ trả ~5 ad → GOM tới 5 trang/lần để trả ~24 ad, đỡ bấm "Tải thêm" nhiều.
    const allRaw: FbAd[] = []
    const seen = new Set<string>()
    let cur = cursor
    let credits: number | null = null
    let nextCursor: string | number | null = null
    let pages = 0
    while (pages < 7 && allRaw.length < 40) {
      const u = baseUrl + (cur ? `&cursor=${encodeURIComponent(cur)}` : '')
      const r = await fetch(u, { headers: { 'x-api-key': key } })
      if (!r.ok) {
        if (pages === 0) { const b = await r.text().catch(() => ''); return res.status(502).json({ error: `FB Ad Library lỗi ${r.status}: ${b.slice(0, 180)}` }) }
        break
      }
      const d = (await r.json()) as Record<string, unknown>
      credits = (d.credits_remaining as number | undefined) ?? credits
      for (const a of pickAds(d)) {
        const id = String(a.ad_archive_id ?? '')
        if (id && !seen.has(id)) { seen.add(id); allRaw.push(a) }
      }
      nextCursor = (d.cursor as string | number | undefined) ?? null
      pages++
      if (nextCursor == null) break
      cur = String(nextCursor)
    }

    // Đếm số ad theo advertiser (page) → tín hiệu "đang scale".
    const adCountByPage = new Map<string, number>()
    for (const a of allRaw) {
      const p = String(a.page_name ?? a.page_id ?? '')
      if (p) adCountByPage.set(p, (adCountByPage.get(p) || 0) + 1)
    }

    const now = Date.now()
    const ads = allRaw
      .map((a) => {
        const snap = a.snapshot || {}
        const vid = (snap.videos || [])[0] || {}
        const videoUrl = vid.video_hd_url || vid.video_url || vid.video_sd_url || ''
        const startMs = a.start_date ? a.start_date * 1000 : 0
        const daysRunning = startMs ? Math.max(0, Math.floor((now - startMs) / 86400000)) : 0
        const page = String(a.page_name ?? snap.page_name ?? '')
        return {
          id: String(a.ad_archive_id ?? ''),
          page,
          text: (snap.body?.text ?? '').slice(0, 300),
          videoUrl,
          cover: vid.video_preview_image_url || (snap.images || [])[0]?.original_image_url || '',
          linkUrl: snap.link_url || '',
          country: a.country_iso_code || country,
          isActive: a.is_active !== false,
          daysRunning,
          advertiserAds: adCountByPage.get(page) || 1,
          libraryUrl: a.ad_archive_id ? `https://www.facebook.com/ads/library/?id=${a.ad_archive_id}` : '',
        }
      })
      .filter((a) => a.id && a.videoUrl)   // chỉ giữ AD CÓ VIDEO
      // WIN: active + chạy lâu + advertiser nhiều ad. Điểm để xếp hạng.
      .map((a) => ({
        ...a,
        _score: (a.isActive ? 40 : 0) + Math.min(a.daysRunning, 180) * 0.4 + Math.log10(a.advertiserAds + 1) * 25,
      }))
      .sort((x, y) => y._score - x._score)
      .map(({ _score, ...a }) => { void _score; return a })

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=900')
    return res.status(200).json({
      ads: ads.slice(0, 60),
      cursor: nextCursor,
      hasMore: nextCursor != null,
      rawCount: allRaw.length,
      credits,
      note: ads.length ? undefined : 'no video ads',
    })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
