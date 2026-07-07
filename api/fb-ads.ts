// ── Vercel serverless — SPY VIDEO ADS đối thủ (ScrapeCreators Facebook Ad Library) ──
// Frontend: /api/fb-ads?q=collagen&country=MY&status=ACTIVE&cursor=<n>
// Trả creative QUẢNG CÁO (video) đối thủ đang chạy. Win signal (FB không lộ chi tiêu):
// đang ACTIVE + chạy LÂU (start_date) + advertiser có NHIỀU ad (đang scale).
// Key SC_KEY server-side (cùng key TikTok). 1 credit/request.
import type { VercelRequest, VercelResponse } from '@vercel/node'

const VALID_COUNTRY = new Set(['MY', 'ID', 'TH', 'VN', 'PH', 'SG', 'ALL'])
// Chặn phim ngắn / ad cài app (mọi thị trường) — bắt theo tên page + nội dung + link đích.
const SPAM_RE = /short\s?(tv|max|drama)|drama\s?box|reel\s?short|good\s?short|net\s?short|flex\s?tv|mobo\s?reels|quick\s?short|shortty|shorttv|play\.google\.com|apps\.apple\.com|playstore|w2a\.|web2app|fbweb/i

interface Snapshot {
  body?: { text?: string }
  videos?: { video_url?: string; video_hd_url?: string; video_sd_url?: string; video_preview_image_url?: string }[]
  images?: { original_image_url?: string }[]
  link_url?: string
  page_name?: string
  cta_text?: string
  cta_type?: string
  title?: string
  caption?: string
  display_format?: string
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
  collation_count?: number
  total_active_time?: number
  publisher_platform?: string | string[]
  cta_text?: string
  cta_type?: string
  display_format?: string
  reach_estimate?: number | string
  spend?: number | string
  currency?: string
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

// ScrapeCreators hay 502/429/timeout ở trang sâu (load-more) → thử lại có backoff.
// Chỉ retry lỗi TẠM THỜI (429/5xx); lỗi cứng (400/401/403) trả ngay khỏi phí thời gian.
async function fetchSC(url: string, key: string, tries = 3): Promise<Response> {
  let last: Response | null = null
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: { 'x-api-key': key } })
    if (r.ok) return r
    last = r
    if (![429, 500, 502, 503, 504].includes(r.status)) return r
    if (i < tries - 1) await new Promise((res) => setTimeout(res, 500 * (i + 1)))
  }
  return last as Response
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.SC_KEY
  if (!key) return res.status(500).json({ error: 'Server thiếu SC_KEY' })

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const pageId = typeof req.query.pageId === 'string' ? req.query.pageId.trim() : ''  // chế độ "tất cả ad của 1 advertiser"
  if (!q && !pageId) return res.status(400).json({ error: 'Cần q (từ khóa) hoặc pageId (advertiser)' })
  const cRaw = typeof req.query.country === 'string' ? req.query.country.toUpperCase() : 'MY'
  const country = VALID_COUNTRY.has(cRaw) ? cRaw : 'MY'
  const status = req.query.status === 'ALL' ? 'ALL' : 'ACTIVE'   // mặc định chỉ ad đang chạy = winner
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : ''
  const searchType = req.query.exact === '1' ? 'keyword_exact_phrase' : 'keyword_unordered'
  // links=1 → chế độ TÌM SALEPAGE: lấy MỌI loại ad (kể cả ảnh/carousel) và giữ ad CÓ LINK ĐÍCH
  // (salepage/ladipage phần lớn ở ad ảnh — media_type=VIDEO mặc định bỏ sót gần hết).
  const linksMode = req.query.links === '1'
  // media=all → lấy CẢ ad ảnh/carousel (ngách nào đối thủ chạy ad ảnh, media_type=VIDEO bỏ sót hết).
  const allMedia = req.query.media === 'all'
  const mediaType = (linksMode || allMedia) ? 'ALL' : 'VIDEO'

  try {
    // 2 chế độ: pageId → company/ads (tất cả ad 1 advertiser) ; q → search/ads (theo từ khóa).
    const baseUrl = pageId
      ? `https://api.scrapecreators.com/v1/facebook/adLibrary/company/ads?pageId=${encodeURIComponent(pageId)}&country=${country}&status=${status}&media_type=${mediaType}`
      : `https://api.scrapecreators.com/v1/facebook/adLibrary/search/ads?query=${encodeURIComponent(q)}&country=${country}&status=${status}&media_type=${mediaType}&ad_type=all&search_type=${searchType}`
    // Mỗi trang SC chỉ trả ~5 ad → GOM nhiều trang/lần. Chế độ Tìm Salepage (links=1) dedup theo
    // domain nên 2-3 trang đã lộ gần hết salepage khác nhau → hạ trần 3 trang để tiết kiệm ~60% credit.
    // pages=N (1-7): giảm số trang/seed cho chế độ Radar (sweep nhiều từ khóa) → tiết kiệm credit.
    const pagesOv = Number(req.query.pages)
    // Hạ trần 7→4 trang/lần: ít call SC/lần bấm hơn → giảm timeout Vercel + rate-limit
    // (mỗi trang ~5 ad; 4 trang ~20 ad đủ 1 lượt, "Tải thêm" lấy tiếp từ cursor).
    const maxPages = Number.isFinite(pagesOv) && pagesOv >= 1 && pagesOv <= 7 ? Math.floor(pagesOv) : (linksMode ? 3 : 4)
    const maxAds = linksMode ? 18 : 40
    const allRaw: FbAd[] = []
    const seen = new Set<string>()
    let cur = cursor
    let credits: number | null = null
    let nextCursor: string | number | null = null
    let pages = 0
    while (pages < maxPages && allRaw.length < maxAds) {
      const u = baseUrl + (cur ? `&cursor=${encodeURIComponent(cur)}` : '')
      const r = await fetchSC(u, key)
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
        // Ngày chạy: ưu tiên total_active_time (chính xác), fallback start_date.
        const activeSec = Number(a.total_active_time ?? 0) || 0
        const daysRunning = activeSec > 0
          ? Math.floor(activeSec / 86400)
          : (startMs ? Math.max(0, Math.floor((now - startMs) / 86400000)) : 0)
        const page = String(a.page_name ?? snap.page_name ?? '')
        const platforms = Array.isArray(a.publisher_platform)
          ? a.publisher_platform.map(String)
          : (a.publisher_platform ? [String(a.publisher_platform)] : [])
        const cta = String(snap.cta_text ?? a.cta_text ?? snap.cta_type ?? a.cta_type ?? '').replace(/_/g, ' ').trim()
        return {
          id: String(a.ad_archive_id ?? ''),
          page,
          pageId: String(a.page_id ?? ''),
          text: (snap.body?.text ?? '').slice(0, 300),
          videoUrl,
          cover: vid.video_preview_image_url || (snap.images || [])[0]?.original_image_url || '',
          linkUrl: snap.link_url || '',
          country: a.country_iso_code || country,
          isActive: a.is_active !== false,
          daysRunning,
          startTs: startMs,                              // mốc bắt đầu THẬT → sort "Mới nhất" chuẩn
          advertiserAds: adCountByPage.get(page) || 1,
          variations: Number(a.collation_count ?? 0) || 0,
          cta,
          platforms,
          format: String(a.display_format ?? snap.display_format ?? '').replace(/_/g, ' ').trim(),
          reach: Number(a.reach_estimate ?? 0) || 0,
          spend: a.spend != null ? String(a.spend) : '',
          currency: a.currency || '',
          libraryUrl: a.ad_archive_id ? `https://www.facebook.com/ads/library/?id=${a.ad_archive_id}` : '',
        }
      })
      .filter((a) => a.id && (linksMode ? a.linkUrl : (allMedia ? (a.videoUrl || a.cover) : a.videoUrl)))   // links: có link đích · allMedia: có video HOẶC ảnh · thường: có video
      .filter((a) => !SPAM_RE.test(`${a.page} ${a.text} ${a.linkUrl}`) && !/\binstall\b/i.test(a.cta))   // chặn phim ngắn / cài app
      // WIN: active + chạy lâu + advertiser nhiều ad + nhiều biến thể (đang scale). Điểm xếp hạng.
      .map((a) => ({
        ...a,
        _score: (a.isActive ? 40 : 0) + Math.min(a.daysRunning, 180) * 0.4 + Math.log10(a.advertiserAds + 1) * 25 + Math.log10(a.variations + 1) * 20,
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
