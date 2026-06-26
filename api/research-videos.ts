// ── Vercel serverless — Video BÁN của 1 SP (ScrapeCreators keyword search) ────
// Frontend gọi: /api/research-videos?market=MY&q=<tên SP / từ khóa>&minSec=30&cursor=<n>
// Mục tiêu: lấy video DÀI (giàu scene/kịch bản) để tái dùng cho FB ads — KHÁC nền tảng
// TikTok nên KHÔNG xếp theo view (clip 15s triệu view vô dụng cho FB). Lọc thời lượng,
// sắp theo ĐỘ DÀI (proxy cho giàu kịch bản). Có cursor để "Tải thêm".
// Key SC_KEY server-side (Vercel). 1 credit/request.

import type { VercelRequest, VercelResponse } from '@vercel/node'

const VALID_REGIONS = new Set(['MY', 'TH', 'ID', 'VN', 'PH'])

interface UrlList { url_list?: string[] }
interface Aweme {
  aweme_id?: string
  desc?: string
  share_url?: string
  url?: string
  statistics?: { play_count?: number; digg_count?: number }
  author?: { unique_id?: string; nickname?: string }
  video?: {
    cover?: UrlList
    download_no_watermark_addr?: UrlList
    download_addr?: UrlList
    play_addr?: UrlList
    duration?: number
  }
}
interface KwResp {
  search_item_list?: { aweme_info?: Aweme }[]
  credits_remaining?: number
  cursor?: number | string
  has_more?: boolean | number
  error?: string
  message?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.SC_KEY
  if (!key) return res.status(500).json({ error: 'Server thiếu SC_KEY' })

  const marketRaw = typeof req.query.market === 'string' ? req.query.market.toUpperCase() : 'MY'
  const region = VALID_REGIONS.has(marketRaw) ? marketRaw : 'MY'
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  // Lọc thời lượng tối thiểu (mặc định >30s — clip ngắn không hợp FB ads).
  const minSec = Math.max(0, parseInt(typeof req.query.minSec === 'string' ? req.query.minSec : '30', 10) || 0)
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : ''
  if (!q) return res.status(400).json({ error: 'Cần q (tên SP / từ khóa)' })

  try {
    let u = `https://api.scrapecreators.com/v1/tiktok/search/keyword?query=${encodeURIComponent(q)}&region=${region}&sort_by=most-liked`
    if (cursor) u += `&cursor=${encodeURIComponent(cursor)}`
    const r = await fetch(u, { headers: { 'x-api-key': key } })
    const d = (await r.json()) as KwResp
    const list = Array.isArray(d.search_item_list) ? d.search_item_list : []
    const videos = list
      .map((it) => it.aweme_info)
      .filter((a): a is Aweme => !!a && !!a.aweme_id)
      .map((a) => ({
        id: String(a.aweme_id),
        desc: (a.desc ?? '').slice(0, 140),
        author: a.author?.unique_id ?? '',
        nickname: a.author?.nickname ?? '',
        views: Number(a.statistics?.play_count ?? 0) || 0,
        cover: a.video?.cover?.url_list?.[0] ?? '',
        downloadUrl:
          a.video?.download_no_watermark_addr?.url_list?.[0] ??
          a.video?.download_addr?.url_list?.[0] ??
          a.video?.play_addr?.url_list?.[0] ??
          '',
        url: a.share_url ?? a.url ?? '',
        durationSec: a.video?.duration ? Math.round(a.video.duration / 1000) : 0,
      }))
      // Chỉ video DÀI hơn ngưỡng (giàu scene/kịch bản cho FB ads).
      .filter((v) => v.durationSec > minSec)
      // KHÔNG xếp theo view — xếp theo ĐỘ DÀI giảm dần (dài = nhiều cảnh/kịch bản hơn).
      .sort((x, y) => y.durationSec - x.durationSec)

    // has_more: ưu tiên field của API; nếu thiếu thì suy từ việc còn cursor + còn item thô.
    const hasMore = d.has_more != null ? !!d.has_more : (!!d.cursor && list.length > 0)
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=900')
    return res.status(200).json({
      videos,
      cursor: d.cursor ?? null,
      hasMore,
      rawCount: list.length,
      credits: d.credits_remaining ?? null,
      note: videos.length ? undefined : (d.error || d.message || `no videos >${minSec}s`),
    })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
