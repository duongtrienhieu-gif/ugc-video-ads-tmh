// ── Vercel serverless — Video BÁN của 1 SP (ScrapeCreators keyword search) ────
// Frontend gọi: /api/research-videos?market=MY&q=<tên SP / từ khóa>&limit=12
// Trả video đang bán SP đó (sắp theo view) + link tải KHÔNG logo, để làm ladi.
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
  error?: string
  message?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.SC_KEY
  if (!key) return res.status(500).json({ error: 'Server thiếu SC_KEY' })

  const marketRaw = typeof req.query.market === 'string' ? req.query.market.toUpperCase() : 'MY'
  const region = VALID_REGIONS.has(marketRaw) ? marketRaw : 'MY'
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const limit = Math.min(parseInt(typeof req.query.limit === 'string' ? req.query.limit : '12', 10) || 12, 30)
  if (!q) return res.status(400).json({ error: 'Cần q (tên SP / từ khóa)' })

  try {
    const u = `https://api.scrapecreators.com/v1/tiktok/search/keyword?query=${encodeURIComponent(q)}&region=${region}&sort_by=most-liked`
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
      .sort((x, y) => y.views - x.views)
      .slice(0, limit)

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=900')
    return res.status(200).json({ videos, credits: d.credits_remaining ?? null, note: videos.length ? undefined : (d.error || d.message || 'no videos') })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
