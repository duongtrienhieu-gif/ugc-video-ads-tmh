// ── Vercel serverless — Video LIÊN QUAN 1 SP (ScrapeCreators keyword search) ──
// Frontend gọi: /api/research-videos?market=MY&q=<tên SP>&minSec=20&terms=brand,token2..&cursor=<n>
// Mục tiêu: video CHỨA chính SP đó. API keyword KHÔNG trả product_id/giỏ-hàng nên không lọc
// cart được → chấm điểm liên quan trên desc: BRAND (token đặc trưng đầu, không phải từ chung) +3,
// token riêng +1.5, từ ngách-chung +0.3 (khớp theo ranh giới từ). Đủ ≥4 video đúng brand → chỉ giữ
// brand (zero drift); ít quá thì bù tối đa 12 video. Lọc 20-90s. Cursor để "Tải thêm". 1 credit/req.

import type { VercelRequest, VercelResponse } from '@vercel/node'

const VALID_REGIONS = new Set(['MY', 'TH', 'ID', 'VN', 'PH'])

// Từ NGÁCH-CHUNG: khớp = tín hiệu yếu (chấm rất nhẹ) để brand/tên-riêng nổi lên, bớt drift.
const GENERIC_TERMS = new Set([
  'probiotic', 'probiotik', 'prebiotic', 'prebiotik', 'fiber', 'serat', 'enzyme', 'collagen', 'kolagen',
  'glutathione', 'vitamin', 'multivitamin', 'suplemen', 'supplement', 'serum', 'detox', 'slim', 'slimming',
  'kurus', 'whitening', 'drink', 'minuman', 'gummies', 'gummy', 'mask', 'oil', 'minyak', 'cream', 'krim',
  'skincare', 'health', 'sihat', 'beauty', 'acne', 'jerawat', 'hair', 'rambut', 'sleep', 'tidur', 'joint',
  'sendi', 'eye', 'mata', 'gastrik', 'lutein', 'magnesium', 'omega', 'zinc', 'tongkat', 'men', 'women',
  'lelaki', 'wanita', 'kids', 'baby', 'energy', 'daily', 'wellness', 'complex', 'powder', 'gel', 'spray',
  'patch', 'kuat', 'cantik', 'glow', 'original', 'gummy', 'capsule', 'natural',
])
// Khớp theo RANH GIỚI TỪ (tránh "men" lọt vào "women/complement").
function descHas(desc: string, t: string): boolean {
  const e = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${e}([^a-z0-9]|$)`).test(desc)
}

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
    dynamic_cover?: UrlList
    origin_cover?: UrlList
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
// Profile videos (mode=profile): TẤT CẢ video 1 KÊNH (creator). Shape aweme_list[].
interface ProfileResp {
  aweme_list?: Aweme[]
  max_cursor?: number | string
  has_more?: boolean | number
  credits_remaining?: number
  error?: string
  message?: string
}

// ── mode=profile — video của 1 KÊNH creator (thay Radar SP win) ──────────────
// /api/research-videos?mode=profile&handle=<@user>&user_id=<id>&sort_by=latest|popular&region=MY&cursor=<max_cursor>
// Trả video CDN mp4 (không logo) → phát + tải được trên PC dù video dính TikTok Shop.
async function handleProfile(req: VercelRequest, res: VercelResponse, key: string) {
  const marketRaw = typeof req.query.market === 'string' ? req.query.market.toUpperCase()
    : typeof req.query.region === 'string' ? req.query.region.toUpperCase() : 'MY'
  const region = VALID_REGIONS.has(marketRaw) ? marketRaw : 'MY'
  const handle = (typeof req.query.handle === 'string' ? req.query.handle : '').trim().replace(/^@/, '')
  const userId = (typeof req.query.user_id === 'string' ? req.query.user_id : '').trim()
  const sortBy = req.query.sort_by === 'popular' ? 'popular' : 'latest'
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : ''
  if (!handle && !userId) return res.status(400).json({ error: 'Cần handle (tên kênh) hoặc user_id' })

  try {
    let u = `https://api.scrapecreators.com/v3/tiktok/profile/videos?sort_by=${sortBy}&region=${region}`
    if (handle) u += `&handle=${encodeURIComponent(handle)}`
    if (userId) u += `&user_id=${encodeURIComponent(userId)}`
    if (cursor) u += `&max_cursor=${encodeURIComponent(cursor)}`
    const r = await fetch(u, { headers: { 'x-api-key': key } })
    const d = (await r.json()) as ProfileResp
    const list = Array.isArray(d.aweme_list) ? d.aweme_list : []
    const videos = list
      .filter((a): a is Aweme => !!a && !!a.aweme_id)
      .map((a) => ({
        id: String(a.aweme_id),
        desc: (a.desc ?? '').slice(0, 140),
        author: a.author?.nickname ?? a.author?.unique_id ?? '',
        handle: a.author?.unique_id ?? handle,
        views: Number(a.statistics?.play_count ?? 0) || 0,
        likes: Number(a.statistics?.digg_count ?? 0) || 0,
        cover:
          a.video?.dynamic_cover?.url_list?.[0] ??
          a.video?.cover?.url_list?.[0] ??
          a.video?.origin_cover?.url_list?.[0] ??
          '',
        downloadUrl:
          a.video?.download_no_watermark_addr?.url_list?.[0] ??
          a.video?.download_addr?.url_list?.[0] ??
          a.video?.play_addr?.url_list?.[0] ??
          '',
        url: a.share_url ?? a.url ?? '',
        durationSec: a.video?.duration ? Math.round(a.video.duration / 1000) : 0,
      }))
      .filter((v) => v.downloadUrl)
    const nextCursor = d.max_cursor ?? null
    const hasMore = d.has_more != null ? !!d.has_more : (nextCursor != null && list.length > 0)
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=600')
    return res.status(200).json({
      videos, cursor: nextCursor, hasMore, credits: d.credits_remaining ?? null,
      note: videos.length ? undefined : (d.error || d.message || 'Kênh không có video — kiểm tra tên kênh / @handle'),
    })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.SC_KEY
  if (!key) return res.status(500).json({ error: 'Server thiếu SC_KEY' })

  // Nhánh mới: video của 1 KÊNH creator (thay Radar SP win).
  if (req.query.mode === 'profile') return handleProfile(req, res, key)

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

    // Chấm điểm LIÊN QUAN. BRAND = token đặc trưng đầu tiên (KHÔNG phải từ chung) — khớp = +3.
    // Token riêng khác +1.5; từ ngách-chung chỉ +0.3 (để video đúng SP nổi lên, video chung chìm).
    const brand = terms.find((t) => !GENERIC_TERMS.has(t)) || ''
    const scoredAll = mapped.map((v) => {
      const desc = v.desc.toLowerCase()
      let score = 0, brandHit = false
      for (const t of terms) {
        if (!descHas(desc, t)) continue
        if (t === brand) { score += 3; brandHit = true }
        else score += GENERIC_TERMS.has(t) ? 0.3 : 1.5
      }
      return { v, score, brandHit }
    })
    let chosen: typeof scoredAll
    if (terms.length === 0) {
      chosen = scoredAll
    } else {
      const brandHits = scoredAll.filter((s) => s.brandHit)
      if (brand && brandHits.length >= 4) {
        chosen = brandHits                      // đủ video đúng BRAND → chỉ giữ brand (zero drift)
      } else {
        const hits = scoredAll.filter((s) => s.score > 0)
        // Quá ít → BÙ tối đa 12 video query (đã sạch) để không trống, nhưng không làm loãng.
        const fill = hits.length >= 5 ? [] : scoredAll.filter((s) => s.score === 0).slice(0, 12)
        chosen = hits.concat(fill)
      }
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
