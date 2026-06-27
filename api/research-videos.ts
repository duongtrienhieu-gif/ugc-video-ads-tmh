// ── Vercel serverless — Video LIÊN QUAN 1 SP (ScrapeCreators keyword search) ──
// Frontend gọi: /api/research-videos?market=MY&q=<tên SP>&minSec=20&terms=brand,token2..&cursor=<n>
// Mục tiêu: video CHỨA chính SP đó (lọc theo brand/từ khóa cốt lõi → bỏ news/drift),
// đủ dài cho FB ads. API keyword KHÔNG trả product_id/giỏ-hàng nên không lọc cart được;
// thay bằng chấm điểm liên quan trên desc (terms[0]=brand +3, token khác +1, bỏ score 0).
// Xếp theo điểm liên quan rồi độ dài. Có cursor để "Tải thêm". Key SC_KEY server-side, 1 credit/req.

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
  // Lọc thời lượng: >minSec (clip ngắn vô dụng) và ≤maxSec (video quá dài = vlog/news, không hợp FB ads).
  const minSec = Math.max(0, parseInt(typeof req.query.minSec === 'string' ? req.query.minSec : '20', 10) || 0)
  const maxSec = Math.max(minSec + 1, parseInt(typeof req.query.maxSec === 'string' ? req.query.maxSec : '90', 10) || 90)
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : ''
  // terms[0] ~ brand (trọng số cao nhất), còn lại = danh từ cốt lõi của SP.
  // Video phải chứa ≥1 token trong desc → bỏ news/drift sang SP khác.
  const terms = (typeof req.query.terms === 'string' ? req.query.terms : '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 6)
  if (!q) return res.status(400).json({ error: 'Cần q (tên SP / từ khóa)' })

  try {
    let u = `https://api.scrapecreators.com/v1/tiktok/search/keyword?query=${encodeURIComponent(q)}&region=${region}&sort_by=most-liked`
    if (cursor) u += `&cursor=${encodeURIComponent(cursor)}`
    const r = await fetch(u, { headers: { 'x-api-key': key } })
    const d = (await r.json()) as KwResp
    const list = Array.isArray(d.search_item_list) ? d.search_item_list : []
    const mapped = list
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
      // Trong khoảng phù hợp FB ads: đủ dài (>minSec) nhưng không quá dài (≤maxSec).
      .filter((v) => v.durationSec > minSec && v.durationSec <= maxSec)

    // Chấm điểm LIÊN QUAN: video phải nhắc tới SP trong desc. Khớp token[0] (brand) = +3,
    // mỗi token khác = +1. Bỏ video score 0 (news/drift). Nếu KHÔNG có terms thì giữ tất cả.
    const scoredAll = mapped.map((v) => {
      const desc = v.desc.toLowerCase()
      let score = 0
      terms.forEach((t, i) => { if (desc.includes(t)) score += i === 0 ? 3 : 1 })
      return { v, score }
    })
    let chosen: typeof scoredAll
    if (terms.length === 0) {
      chosen = scoredAll
    } else {
      const hits = scoredAll.filter((s) => s.score > 0)
      // Đủ video khớp token → giữ strict. Quá ít (<5) → BÙ bằng video còn lại (query đã sạch
      // nên vẫn đúng ngách) để KHÔNG bị trống. Hits luôn xếp trên nhờ điểm cao hơn.
      chosen = hits.length >= 5 ? hits : hits.concat(scoredAll.filter((s) => s.score === 0))
    }
    // Liên quan nhất trước; cùng điểm thì video DÀI hơn (giàu cảnh/kịch bản) trước.
    chosen.sort((a, b) => b.score - a.score || b.v.durationSec - a.v.durationSec)
    const videos = chosen.slice(0, 40).map((s) => s.v)

    // has_more: ưu tiên field của API; nếu thiếu thì suy từ việc còn cursor + còn item thô.
    const hasMore = d.has_more != null ? !!d.has_more : (!!d.cursor && list.length > 0)
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=900')
    return res.status(200).json({
      videos,
      cursor: d.cursor ?? null,
      hasMore,
      rawCount: list.length,
      credits: d.credits_remaining ?? null,
      note: videos.length ? undefined : (d.error || d.message || `no relevant videos >${minSec}s`),
    })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
