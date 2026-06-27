// ── Vercel serverless — SPY VIDEO ADS đối thủ (ScrapeCreators TikTok Ad Library) ──
// Frontend: /api/tiktok-ads?q=collagen&country=MY&cursor=<n>
// ⚠️ Spec TikTok Ad Library trên ScrapeCreators CHƯA verify chắc (rate-limit lúc build) →
// thử NHIỀU đường dẫn + parser phòng thủ. Nếu lỗi/khác field → chỉnh lại mapper sau khi verify docs.
// Lưu ý: TikTok Ad Library (commercial content library) có thể GIỚI HẠN vùng (EU mạnh hơn SEA).
import type { VercelRequest, VercelResponse } from '@vercel/node'

const VALID_COUNTRY = new Set(['MY', 'ID', 'TH', 'VN', 'PH', 'SG', 'ALL'])

type AnyObj = Record<string, unknown>
const str = (v: unknown) => (v == null ? '' : String(v))
const pick = (o: AnyObj, keys: string[]): unknown => {
  for (const k of keys) {
    if (k.includes('.')) {
      const parts = k.split('.')
      let cur: unknown = o
      for (const p of parts) cur = (cur as AnyObj | undefined)?.[p]
      if (cur != null && cur !== '') return cur
    } else if (o[k] != null && o[k] !== '') return o[k]
  }
  return undefined
}
function firstVideo(o: AnyObj): { url: string; cover: string } {
  // thử nhiều shape: video_url, videos[].video_url, snapshot.videos[].video_url, video.play_addr...
  const cands: unknown[] = [
    pick(o, ['video_url', 'video.url', 'video.play_url', 'video.download_url']),
  ]
  const arrays = [o.videos, (o.snapshot as AnyObj)?.videos, (o.materials as AnyObj[] | undefined)]
  for (const arr of arrays) {
    if (Array.isArray(arr) && arr.length) {
      const v = arr[0] as AnyObj
      cands.push(pick(v, ['video_url', 'video_hd_url', 'video_sd_url', 'url', 'play_addr', 'download_addr']))
    }
  }
  const url = str(cands.find((c) => typeof c === 'string' && c))
  const cover = str(pick(o, ['cover', 'cover_url', 'image_url', 'video.cover', 'video_preview_image_url', 'thumbnail']))
  return { url, cover }
}
function pickAds(d: AnyObj): AnyObj[] {
  for (const k of ['ads', 'results', 'data', 'searchResults', 'materials', 'list']) {
    if (Array.isArray(d[k])) return d[k] as AnyObj[]
  }
  if (Array.isArray(d)) return d as unknown as AnyObj[]
  for (const k in d) { const v = d[k]; if (Array.isArray(v) && v.length && typeof v[0] === 'object') return v as AnyObj[] }
  return []
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.SC_KEY
  if (!key) return res.status(500).json({ error: 'Server thiếu SC_KEY' })
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!q) return res.status(400).json({ error: 'Cần q (từ khóa / ngách)' })
  const cRaw = typeof req.query.country === 'string' ? req.query.country.toUpperCase() : 'MY'
  const country = VALID_COUNTRY.has(cRaw) ? cRaw : 'MY'
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : ''

  // Thử nhiều base URL (chưa verify path chính xác) — dùng cái đầu tiên trả ad.
  const qp = `query=${encodeURIComponent(q)}&country=${country}&region=${country}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
  const candidates = [
    `https://api.scrapecreators.com/v1/tiktok/ad-library/search?${qp}`,
    `https://api.scrapecreators.com/v1/tiktok/adLibrary/search/ads?${qp}`,
    `https://api.scrapecreators.com/v1/tiktok/ads/search?${qp}`,
  ]

  try {
    let d: AnyObj | null = null
    let used = ''
    for (const u of candidates) {
      try {
        const r = await fetch(u, { headers: { 'x-api-key': key } })
        if (!r.ok) continue
        const j = (await r.json()) as AnyObj
        if (pickAds(j).length || j.cursor != null) { d = j; used = u; break }
        if (!d) d = j  // giữ tạm để báo lỗi nếu tất cả rỗng
      } catch { /* thử path kế */ }
    }
    if (!d) return res.status(502).json({ error: 'Không gọi được TikTok Ad Library (mọi path thử đều lỗi)' })

    const raw = pickAds(d)
    const now = Date.now()
    const ads = raw
      .map((a) => {
        const { url: videoUrl, cover } = firstVideo(a)
        const id = str(pick(a, ['id', 'ad_id', 'ad_archive_id', 'adId', 'material_id']))
        const startRaw = pick(a, ['start_date', 'first_shown_date', 'first_shown', 'create_time', 'start_time'])
        let startMs = 0
        if (typeof startRaw === 'number') startMs = startRaw < 1e12 ? startRaw * 1000 : startRaw
        else if (typeof startRaw === 'string' && startRaw) { const t = Date.parse(startRaw); if (!isNaN(t)) startMs = t }
        return {
          id,
          page: str(pick(a, ['advertiser_name', 'brand_name', 'page_name', 'advertiser.name', 'brand.name', 'advertiser'])),
          text: str(pick(a, ['text', 'caption', 'title', 'ad_title', 'snapshot.body.text'])).slice(0, 300),
          videoUrl,
          cover,
          linkUrl: str(pick(a, ['link_url', 'landing_url', 'url'])),
          country,
          isActive: pick(a, ['is_active']) !== false,
          daysRunning: startMs ? Math.max(0, Math.floor((now - startMs) / 86400000)) : 0,
          advertiserAds: 1,
          libraryUrl: id ? `https://library.tiktok.com/ads?region=${country}&adv_biz_ids=&query=${encodeURIComponent(q)}` : '',
        }
      })
      .filter((a) => a.id && a.videoUrl)
      .sort((x, y) => (Number(y.isActive) - Number(x.isActive)) || (y.daysRunning - x.daysRunning))

    const nextCursor = (d.cursor as string | number | undefined) ?? null
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=900')
    return res.status(200).json({
      ads: ads.slice(0, 60),
      cursor: nextCursor,
      hasMore: nextCursor != null && raw.length > 0,
      rawCount: raw.length,
      usedEndpoint: used,
      credits: (d.credits_remaining as number | undefined) ?? null,
      note: ads.length ? undefined : ((d.error as string) || (d.message as string) || 'no tiktok video ads (có thể TikTok Ad Library không phủ vùng này)'),
    })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
