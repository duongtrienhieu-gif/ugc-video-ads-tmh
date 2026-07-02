// Spy Ads — creative QUẢNG CÁO video đối thủ từ Facebook Ad Library (ScrapeCreators).
// Khác "Video win" (organic): đây là ad MKT đối thủ đang chạy → tải về dựng lại cho FB ads.
// Win signal: đang ACTIVE + chạy lâu + advertiser nhiều ad. AI dịch VO + bóc kịch bản cắt ghép.
import { useState, useRef, useEffect } from 'react'
import { Megaphone, Search, Play, Download, ExternalLink, X, Sparkles, Link2, FileText, PenLine, Radio } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useBankStore } from '../../stores/bankStore'
import { useAppStore } from '../../stores/appStore'
import { directGeminiVision, directGeminiText } from '../../utils/gemini'

interface FbAd {
  id: string; page: string; pageId?: string; text: string; videoUrl: string; cover: string
  linkUrl: string; country: string; isActive: boolean; daysRunning: number
  advertiserAds: number; libraryUrl: string; likes?: number; ctr?: string
  variations?: number; cta?: string; platforms?: string[]; format?: string
  reach?: number; spend?: string; currency?: string; durationSec?: number
  views?: number   // video kênh (mode channel): lượt xem
  hasCart?: boolean; productUrl?: string   // video gắn giỏ TikTok Shop
}
// Tách @handle / user_id từ ô nhập tự do (tên kênh · link tiktok · id số).
function parseHandle(raw: string): { handle: string; userId: string } {
  const s = raw.trim()
  const at = s.match(/@[\w.]+/)                       // @user (kể cả trong link tiktok.com/@user/video/..)
  if (at) return { handle: at[0].replace(/^@/, ''), userId: '' }
  if (/^\d{6,}$/.test(s)) return { handle: '', userId: s }   // id số thuần
  const bare = s.replace(/^https?:\/\/[^/]+\//i, '').split(/[/?#]/)[0]
  return { handle: bare.replace(/^@/, ''), userId: '' }
}
const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(n))
const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
const MAX_AD_SEC = 180   // CẤM video dài: chỉ giữ ad < 3 phút

// Chặn bọn phim ngắn / ad cài app (mọi thị trường) — bắt theo tên page + link đích.
// Cách 1: chỉ chặn ad CÀI APP (link store/web2app + CTA Install), KHÔNG giết chữ "app" trong text COD.
const SPAM_RE = /short\s?(tv|max|drama)|drama\s?box|reel\s?short|good\s?short|net\s?short|flex\s?tv|mobo\s?reels|quick\s?short|shortty|shorttv|play\.google\.com|apps\.apple\.com|playstore|w2a\.|web2app|fbweb/i
function isSpamAd(a: { page?: string; text?: string; linkUrl?: string; cta?: string }): boolean {
  if (SPAM_RE.test(`${a.page || ''} ${a.text || ''} ${a.linkUrl || ''}`)) return true
  if (/\binstall\b/i.test(a.cta || '')) return true   // CTA cài app
  return false
}
interface AdRead { transcript: string; structure: string }
interface LadiRead { headline: string; offer: string; structure: string; cta: string; steal: string }
interface AdaptScript { hook: string; script: string; shots: string; caption: string }
// 🔗 Link salepage/ladipage bóc từ ad (tab Tìm Salepage).
interface FoundLink {
  url: string; domain: string; kindLabel: string; kindEmoji: string; web: boolean
  page: string; adText: string; platform: 'fb' | 'tiktok'
  cms?: string; contains?: boolean | null; verifying?: boolean
  matchSku?: boolean | null; matchBusy?: boolean   // đối chiếu ảnh: cùng mã hàng không
}

// Rút LÕI từ khóa từ tên SP (bỏ [..], (..), đơn vị, từ marketing) để mồi ô tìm ad sạch.
const MKT_RE = /\b(beli|percuma|free|gift|cod|promosi|diskaun|sale|offer|ready|stock|stok|terhad|viral|terlaris|original|ori|new|hot|murah|jimat|harga|runtuh|borong|set|pack|pcs|pc|tawaran|hebat|bundle|combo|pengar|pengiriman|gratis|terbaru|berkualiti)\b/gi
function coreTerms(title: string): string {
  const core = title
    .replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/【[^】]*】/g, ' ')
    .replace(/\b\d+\s*(ml|mg|g|kg|gram|pcs|pc|set|pack|x|tablet|kapsul|sachet|botol)\b/gi, ' ')
    .replace(MKT_RE, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/).filter((w) => w.length > 1).slice(0, 6).join(' ').trim()
  if (core.length >= 2) return core
  return title.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 5).join(' ').trim()
}

// ── Tìm Salepage: sinh TỪ KHÓA ĐA GÓC (brand + đặc điểm/lợi ích/dạng) để bắt cả
//    đối thủ rebrand cùng 1 mã hàng dưới brand khác. Output JSON {brand, angles[]}. ──
const ANGLE_VISION_PROMPT = `Đây là ảnh 1 sản phẩm COD. Tạo TỪ KHÓA để tìm quảng cáo Facebook tại Malaysia bán CHÍNH sản phẩm này — kể cả khi các seller đặt TÊN BRAND KHÁC NHAU cho cùng 1 mã hàng. Trả JSON:
{"brand":"tên thương hiệu IN TRÊN BAO BÌ nếu đọc rõ, không thì rỗng","angles":["4-6 từ khóa NGẮN tiếng Malay mô tả LOẠI sản phẩm + công năng + bộ phận/đối tượng + dạng — KHÔNG phải tên brand, để bắt mọi seller rebrand; mỗi cái 1-4 từ"]}
CHỈ JSON.`
const ANGLE_TEXT_PROMPT = (ctx: string): string => `Sản phẩm COD (mô tả tiếng Việt):
${ctx}
Tạo TỪ KHÓA tìm quảng cáo Facebook tại Malaysia bán sản phẩm này — kể cả khi seller đặt TÊN BRAND KHÁC cho cùng mã hàng. Trả JSON:
{"brand":"tên thương hiệu rút từ tên SP nếu có, không thì rỗng","angles":["4-6 từ khóa NGẮN tiếng Malay: loại SP + công năng + bộ phận/đối tượng + dạng — KHÔNG phải brand; mỗi cái 1-4 từ"]}
CHỈ JSON.`
function parseAngles(raw: string): string[] {
  let obj: { brand?: string; angles?: string[] } = {}
  try { obj = JSON.parse(raw) } catch {
    const m = raw.match(/\{[\s\S]*\}/)
    if (m) { try { obj = JSON.parse(m[0]) } catch { /* giữ {} */ } }
  }
  const out: string[] = []
  const push = (s?: string) => {
    const v = (s || '').replace(/["\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40)
    if (v && !out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v)
  }
  push(obj.brand)
  for (const a of Array.isArray(obj.angles) ? obj.angles : []) push(a)
  return out.slice(0, 6)
}
// FB hay bọc link đích trong l.facebook.com/l.php?u=... → gỡ ra link thật.
function cleanLink(u: string): string {
  try {
    if (/l\.facebook\.com\/l\.php/i.test(u)) {
      const m = u.match(/[?&]u=([^&]+)/)
      if (m) return decodeURIComponent(m[1])
    }
  } catch { /* giữ nguyên */ }
  return u
}
// Domain gọn (bỏ www) — dùng làm khoá dedup (1 salepage / seller) cho danh sách link.
function domainOf(u: string): string { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u } }
// Nhận loại link đích — nhiều ad COD MY đẩy về WhatsApp/Shopee chứ không phải ladipage.
function linkKind(u: string): { label: string; emoji: string; web: boolean } {
  const s = u.toLowerCase()
  if (/wa\.me|whatsapp|wasap/.test(s)) return { label: 'WhatsApp (chat chốt đơn)', emoji: '💬', web: false }
  if (/m\.me|messenger|fb\.me|facebook\.com|fb\.com|fb\.watch/.test(s)) return { label: 'Facebook/Messenger', emoji: '💬', web: false }
  if (/play\.google\.com|apps\.apple\.com|itunes\.apple|app store/.test(s)) return { label: 'App Store (tải app)', emoji: '📱', web: false }
  if (/t\.me|telegram/.test(s)) return { label: 'Telegram', emoji: '💬', web: false }
  if (/zalo\./.test(s)) return { label: 'Zalo', emoji: '💬', web: false }
  if (/line\.me/.test(s)) return { label: 'Line', emoji: '💬', web: false }
  if (/shopee/.test(s)) return { label: 'Shopee', emoji: '🛒', web: false }
  if (/lazada/.test(s)) return { label: 'Lazada', emoji: '🛒', web: false }
  if (/tiktok/.test(s)) return { label: 'TikTok Shop', emoji: '🛒', web: false }
  if (/instagram/.test(s)) return { label: 'Instagram', emoji: '📷', web: false }
  if (/linktr\.ee|lnk\.bio|beacons\.ai|bio\.link|linkin\.bio|linkinbio|carrd\.co|taplink/.test(s)) return { label: 'Link-in-bio', emoji: '🔗', web: false }
  return { label: 'Web / Ladipage', emoji: '🔗', web: true }
}

// Từ khóa CHUNG (tín hiệu ad COD, mọi ngách) — bấm là quét rộng rồi lọc mắt.
const COD_CHIPS = [
  'percuma', 'free gift', 'beli', 'beli sekarang', 'cod', 'bayar bila terima', 'promosi',
  'diskaun', 'tawaran hebat', 'jimat', 'harga runtuh', 'stok terhad', 'ready stock',
  'terlaris', 'viral', 'beli 1 percuma 1', 'beli 2 percuma 1',
]

const COUNTRIES = [
  { c: 'MY', f: '🇲🇾' }, { c: 'ID', f: '🇮🇩' }, { c: 'TH', f: '🇹🇭' },
  { c: 'VN', f: '🇻🇳' }, { c: 'PH', f: '🇵🇭' }, { c: 'SG', f: '🇸🇬' }, { c: 'ALL', f: '🌏' },
]

export default function SpyAds() {
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const products = useBankStore((s) => s.products)
  const sendToApp = useAppStore((s) => s.sendToApp)
  const addToast = useAppStore((s) => s.addToast)

  const [mode, setMode] = useState<'channel' | 'ads' | 'links'>('channel') // 📺 Video theo kênh | 🔍 tìm ad | 🔗 tìm salepage
  // Mobile: ẩn bộ chip gợi ý từ khóa (ngách/COD) cho đỡ chiếm chỗ che output;
  // bấm "Gợi ý" để bung. Desktop (lg+) luôn hiện nên không ảnh hưởng.
  const [chipsOpen, setChipsOpen] = useState(false)
  const [platform, setPlatform] = useState<'fb' | 'tiktok'>('fb')
  const [q, setQ] = useState('')
  // 📺 Video theo kênh — dán tên kênh/link/id → tải TẤT CẢ video kênh (kể cả video dính giỏ TikTok Shop).
  const [chInput, setChInput] = useState('')
  const [chSort, setChSort] = useState<'latest' | 'popular'>('latest') // latest = khớp thứ tự tiktok.com
  const [chCartOnly, setChCartOnly] = useState(false)                   // 🛒 chỉ video gắn giỏ hàng
  const [chLinkInput, setChLinkInput] = useState('')                    // dán link 1 video lẻ
  const [chVids, setChVids] = useState<FbAd[] | null>(null)     // dùng FbAd để tái dùng modal/tải
  const [chLoading, setChLoading] = useState(false)
  const [chErr, setChErr] = useState<string | null>(null)
  const [chCursor, setChCursor] = useState<string | null>(null)
  const [chHasMore, setChHasMore] = useState(false)
  const [chMoreLoading, setChMoreLoading] = useState(false)
  const [chTitle, setChTitle] = useState<string>('')           // tên kênh hiển thị
  // Phase 2a — xem tất cả ad của 1 advertiser
  const [viewPageId, setViewPageId] = useState<string | null>(null)
  const [viewPageName, setViewPageName] = useState<string | null>(null)
  // Phase 2b — nhận diện nền tảng trang đích
  const [cms, setCms] = useState<string | null>(null)
  const [cmsBusy, setCmsBusy] = useState(false)
  const [country, setCountry] = useState('MY')
  const [activeOnly, setActiveOnly] = useState(true)
  const [ladiOnly, setLadiOnly] = useState(false)   // chỉ ad dẫn về web/ladipage (bỏ chat/sàn)
  const [groupView, setGroupView] = useState(false) // gom theo advertiser/SP thay vì lưới phẳng
  const [selected, setSelected] = useState<Set<string>>(new Set()) // ad đã chọn để tải hàng loạt
  // Bộ lọc nâng cao (Phase 1 — khai thác field FB Ad Library)
  const [showFilters, setShowFilters] = useState(false)
  const [sortMode, setSortMode] = useState<'win' | 'days' | 'variations' | 'new'>('win')
  const [minDays, setMinDays] = useState(0)
  const [platformFilter, setPlatformFilter] = useState('')   // '', FACEBOOK, INSTAGRAM, MESSENGER
  const [ctaFilter, setCtaFilter] = useState('')
  const [exact, setExact] = useState(false)                  // tìm chính xác cụm (server param)
  const [ads, setAds] = useState<FbAd[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [moreLoading, setMoreLoading] = useState(false)
  const [credits, setCredits] = useState<number | null>(null)
  const [durMap, setDurMap] = useState<Record<string, number>>({}) // thời lượng FB đo ở client (id→giây)

  const [playAd, setPlayAd] = useState<FbAd | null>(null)
  const [readBusy, setReadBusy] = useState(false)
  const [readErr, setReadErr] = useState<string | null>(null)
  const [readResult, setReadResult] = useState<AdRead | null>(null)
  // Đọc ladipage đối thủ
  const [ladiBusy, setLadiBusy] = useState(false)
  const [ladiErr, setLadiErr] = useState<string | null>(null)
  const [ladiResult, setLadiResult] = useState<LadiRead | null>(null)
  // Bê kịch bản về SP của mình
  const [adaptProductId, setAdaptProductId] = useState('')
  const [adaptName, setAdaptName] = useState('')
  const [adaptBusy, setAdaptBusy] = useState(false)
  const [adaptErr, setAdaptErr] = useState<string | null>(null)
  const [adaptResult, setAdaptResult] = useState<AdaptScript | null>(null)
  // 🔗 Link Finder (tab Tìm Salepage)
  const [linkQ, setLinkQ] = useState('')
  const [linkBankId, setLinkBankId] = useState('')
  const [linkImg, setLinkImg] = useState('')
  const [linkPlat, setLinkPlat] = useState<'fb' | 'tiktok' | 'both'>('fb')
  const [links, setLinks] = useState<FoundLink[] | null>(null)
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkErr, setLinkErr] = useState<string | null>(null)
  const [onlyWeb, setOnlyWeb] = useState(true)
  const [onlyMatched, setOnlyMatched] = useState(true)   // ẩn link xác minh KHÔNG khớp (mặc định BẬT cho sạch)
  const [onlySku, setOnlySku] = useState(false)          // chỉ link "cùng SP" (theo đối chiếu ảnh)
  const [imgMatch, setImgMatch] = useState(true)         // chạy đối chiếu ảnh khi có ảnh SP
  const [linkAngles, setLinkAngles] = useState<string[]>([])   // từ khóa đa-góc AI đã dùng (hiển thị)
  const [linkHasMore, setLinkHasMore] = useState(false)
  const [linkMoreBusy, setLinkMoreBusy] = useState(false)
  // Phân trang theo từng NGUỒN (góc từ khóa × nền tảng): cursor undefined=chưa bắt đầu, string=kế, null=hết.
  const linkSourcesRef = useRef<{ q: string; plat: 'fb' | 'tiktok'; cursor: string | null | undefined }[]>([])
  const linkSeenRef = useRef<Set<string>>(new Set())   // dedup theo DOMAIN xuyên các lần "tải thêm"
  const linkQueryRef = useRef('')                       // chuỗi từ khóa (để verify contains)

  // Cache kết quả RIÊNG theo platform → đổi tab FB↔TikTok không mất kết quả cũ.
  type AdCache = { ads: FbAd[] | null; cursor: string | null; hasMore: boolean; q: string }
  const adCache = useRef<Record<'fb' | 'tiktok', AdCache>>({
    fb: { ads: null, cursor: null, hasMore: false, q: '' },
    tiktok: { ads: null, cursor: null, hasMore: false, q: '' },
  })
  const switchPlatform = (p: 'fb' | 'tiktok') => {
    if (p === platform) return
    adCache.current[platform] = { ads, cursor, hasMore, q }   // lưu tab hiện tại
    const c = adCache.current[p]                               // nạp tab đích
    setPlatform(p)
    setAds(c.ads); setCursor(c.cursor); setHasMore(c.hasMore); setQ(c.q)
    setSelected(new Set()); setError(null)
    setViewPageId(null); setViewPageName(null)                 // advertiser view là FB-only
  }

  const buildUrl = (query: string, cur?: string, pageId?: string) => {
    const st = platform === 'fb' ? `&status=${activeOnly ? 'ACTIVE' : 'ALL'}` : ''
    const curP = cur ? `&cursor=${encodeURIComponent(cur)}` : ''
    if (platform === 'fb' && pageId) return `/api/fb-ads?pageId=${encodeURIComponent(pageId)}&country=${country}${st}${curP}`
    const base = platform === 'fb' ? '/api/fb-ads' : '/api/tiktok-ads'
    const ex = platform === 'fb' && exact ? '&exact=1' : ''
    return `${base}?q=${encodeURIComponent(query.trim())}&country=${country}${st}${ex}${curP}`
  }

  const search = async (term?: string) => {
    const query = (term ?? q).trim()
    if (!query) { setError('Nhập từ khóa / ngách'); return }
    if (term != null) setQ(term)
    setViewPageId(null); setViewPageName(null)   // tìm từ khóa = thoát chế độ xem advertiser
    setLoading(true); setError(null); setAds(null); setCursor(null); setHasMore(false); setSelected(new Set())
    try {
      const d = await fetch(buildUrl(query)).then((r) => r.json())
      if (d.error) { setError(d.error); setLoading(false); return }
      setAds(Array.isArray(d.ads) ? d.ads : [])
      setCursor(d.cursor != null ? String(d.cursor) : null)
      setHasMore(!!d.hasMore && d.cursor != null)
      setCredits(d.credits ?? null)
      if (!d.ads?.length) setError(d.note ? `Không có ad video (${d.note})` : 'Không tìm thấy ad video — đổi từ khóa/nước')
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }

  // Nhận SP từ MKT Agent → tự chuyển chế độ "tìm ad" (FB) + search keyword.
  const interAppPayload = useAppStore((s) => s.interAppPayload)
  const consumePayload = useAppStore((s) => s.consumePayload)
  useEffect(() => {
    if (!interAppPayload || interAppPayload.targetApp !== 'spy-ads') return
    if (interAppPayload.targetField === 'query' && typeof interAppPayload.data === 'string') {
      setMode('ads'); setPlatform('fb')
      void search(interAppPayload.data)
    }
    consumePayload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interAppPayload])

  const loadMore = async () => {
    if (!cursor || moreLoading) return
    setMoreLoading(true)
    const existing = new Set((ads || []).map((a) => a.id))
    const collected: FbAd[] = []
    let cur: string | null = cursor
    let added = 0
    let lastCredits = credits
    try {
      // Server + filter hao nên 1 cụm hay ra 0 ad mới → tự kéo tối đa 3 cụm
      // đến khi có ad mới HOẶC cursor thật sự hết. KHÔNG tắt nút khi gặp lỗi tạm thời.
      for (let i = 0; i < 3; i++) {
        if (!cur) break
        const resp = await fetch(buildUrl(q, cur, viewPageId || undefined))
        const d = (await resp.json()) as { error?: string; ads?: FbAd[]; cursor?: string | number | null; hasMore?: boolean; credits?: number | null }
        // Lỗi tạm thời (SC 502 / rate-limit / timeout): GIỮ nguyên cursor + hasMore,
        // báo nhẹ rồi dừng — để người dùng bấm lại, nút KHÔNG biến mất.
        if (d?.error) { addToast('Tải thêm gặp lỗi tạm thời — bấm lại nhé', 'error'); return }
        const more: FbAd[] = Array.isArray(d.ads) ? d.ads : []
        for (const a of more) {
          if (a?.id && !existing.has(a.id)) { existing.add(a.id); collected.push(a); added++ }
        }
        lastCredits = d.credits ?? lastCredits
        cur = d.cursor != null && d.hasMore ? String(d.cursor) : null
        if (added > 0) break   // đã có ad mới → dừng, khỏi kéo thừa
      }
      if (collected.length) setAds((prev) => [...(prev || []), ...collected])
      setCursor(cur)
      setHasMore(cur != null)
      setCredits(lastCredits)
      if (!added && cur == null) addToast('Đã hết ad cho từ khóa này', 'success')
    } catch {
      // Lỗi mạng/parse: KHÔNG tắt nút (giữ nguyên cursor/hasMore cũ) để bấm lại.
      addToast('Tải thêm gặp lỗi mạng — bấm lại nhé', 'error')
    } finally { setMoreLoading(false) }
  }

  // 📺 Video theo kênh: dán tên kênh/link/id → /api/research-videos?mode=profile → TẤT CẢ video kênh.
  // Map về FbAd để tái dùng modal xem + tải + tải hàng loạt. Video CDN mp4 → PC phát được dù dính giỏ.
  interface ChVid { id: string; desc: string; author: string; handle: string; views: number; likes: number; cover: string; downloadUrl: string; url: string; durationSec: number; hasCart?: boolean; productUrl?: string }
  const toFbAd = (v: ChVid, handle: string): FbAd => ({
    id: v.id, page: v.author || (v.handle ? '@' + v.handle : handle ? '@' + handle : '(kênh)'), pageId: '',
    text: v.desc || '', videoUrl: v.downloadUrl, cover: v.cover, linkUrl: '', country,
    isActive: false, daysRunning: 0, advertiserAds: 0, libraryUrl: v.url || '',
    likes: v.likes, views: v.views, durationSec: v.durationSec, hasCart: v.hasCart, productUrl: v.productUrl,
  })
  const fetchChannel = async (more = false) => {
    const { handle, userId } = parseHandle(chInput)
    if (!handle && !userId) { setChErr('Dán tên kênh / link TikTok / ID kênh'); return }
    if (more) { if (!chCursor || chMoreLoading) return; setChMoreLoading(true) }
    else { setChLoading(true); setChErr(null); setChVids(null); setChCursor(null); setChHasMore(false); setSelected(new Set()); setChTitle(handle ? '@' + handle : userId) }
    try {
      let u = `/api/research-videos?mode=profile&region=${country}&sort_by=${chSort}`
      if (handle) u += `&handle=${encodeURIComponent(handle)}`
      if (userId) u += `&user_id=${encodeURIComponent(userId)}`
      if (more && chCursor) u += `&cursor=${encodeURIComponent(chCursor)}`
      const d = await fetch(u).then((r) => r.json())
      if (d.error) { setChErr(d.error); return }
      const vids: ChVid[] = Array.isArray(d.videos) ? d.videos : []
      const mapped = vids.map((v) => toFbAd(v, handle))
      if (mapped[0]?.page && !more) setChTitle(mapped[0].page)
      setChVids((prev) => (more ? [...(prev || []), ...mapped] : mapped))
      setChCursor(d.cursor != null ? String(d.cursor) : null)
      setChHasMore(!!d.hasMore && d.cursor != null)
      setCredits(d.credits ?? credits)
      if (!more && !mapped.length) setChErr(d.note || 'Kênh không có video — kiểm tra tên kênh')
    } catch (e) { setChErr((e as Error).message) } finally { setChLoading(false); setChMoreLoading(false) }
  }
  // Dán LINK 1 video → hiện riêng video đó (kể cả video dính giỏ tiktok.com ẩn trên PC).
  const fetchVideo = async () => {
    const link = chLinkInput.trim()
    if (!/^https?:\/\//i.test(link)) { setChErr('Dán link video TikTok hợp lệ (https://…)'); return }
    setChLoading(true); setChErr(null); setChVids(null); setChCursor(null); setChHasMore(false); setSelected(new Set()); setChTitle('1 video theo link')
    try {
      const d = await fetch(`/api/research-videos?mode=video&url=${encodeURIComponent(link)}`).then((r) => r.json())
      if (d.error) { setChErr(d.error); return }
      const vids: ChVid[] = Array.isArray(d.videos) ? d.videos : []
      const mapped = vids.map((v) => toFbAd(v, ''))
      setChVids(mapped)
      setCredits(d.credits ?? credits)
      if (!mapped.length) setChErr(d.note || 'Không đọc được video — kiểm tra link')
      else openAd(mapped[0])   // mở luôn cho xem
    } catch (e) { setChErr((e as Error).message) } finally { setChLoading(false) }
  }

  // Đổi quốc gia → BẮT BUỘC trả đúng nước đó: xoá cache 2 tab + tự tìm lại theo nước mới.
  const firstCountry = useRef(true)
  useEffect(() => {
    if (firstCountry.current) { firstCountry.current = false; return }
    adCache.current = { fb: { ads: null, cursor: null, hasMore: false, q: '' }, tiktok: { ads: null, cursor: null, hasMore: false, q: '' } }
    if (mode === 'ads' && q.trim()) void search()
    else if (mode === 'channel' && chInput.trim()) void fetchChannel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country])

  // Phase 2a — xem TẤT CẢ ad đang chạy của 1 advertiser (company/ads theo pageId).
  const viewAdvertiser = async (pageId?: string, name?: string) => {
    if (!pageId) { addToast('Ad này thiếu pageId — không xem được advertiser', 'error'); return }
    setMode('ads'); setPlayAd(null)
    setViewPageId(pageId); setViewPageName(name || '(advertiser)')
    setLoading(true); setError(null); setAds(null); setCursor(null); setHasMore(false); setSelected(new Set())
    try {
      const d = await fetch(buildUrl('', undefined, pageId)).then((r) => r.json())
      if (d.error) { setError(d.error); setLoading(false); return }
      setAds(Array.isArray(d.ads) ? d.ads : [])
      setCursor(d.cursor != null ? String(d.cursor) : null)
      setHasMore(!!d.hasMore && d.cursor != null)
      setCredits(d.credits ?? credits)
      if (!d.ads?.length) setError('Advertiser này không có video ad đang chạy (đổi "Chỉ ad đang chạy" sang tất cả)')
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }
  const exitAdvertiser = () => { setViewPageId(null); setViewPageName(null); setAds(null); setError(null) }

  // Phase 2b — nhận diện nền tảng trang đích (LadiPage/Shopify/Woo…).
  const detectCms = async (url: string) => {
    setCmsBusy(true); setCms(null)
    try {
      const d = await fetch(`/api/detect-cms?url=${encodeURIComponent(url)}`).then((r) => r.json())
      setCms(d.cms || 'Khác')
    } catch { setCms('Khác') } finally { setCmsBusy(false) }
  }

  const resetAd = () => {
    setReadResult(null); setReadErr(null); setReadBusy(false)
    setLadiResult(null); setLadiErr(null); setLadiBusy(false)
    setAdaptResult(null); setAdaptErr(null); setAdaptBusy(false); setAdaptProductId(''); setAdaptName('')
    setCms(null); setCmsBusy(false)
  }
  const openAd = (a: FbAd) => { resetAd(); setPlayAd(a) }
  const closeAd = () => { resetAd(); setPlayAd(null) }

  // AI đọc ad: server tải video → Gemini Files → dịch VO + bóc kịch bản cắt ghép (tiếng Việt).
  const readAd = async () => {
    if (!playAd) return
    if (!geminiApiKey) { setReadErr('Cần Gemini API key trong Cài đặt'); return }
    setReadBusy(true); setReadErr(null); setReadResult(null)
    try {
      const up = await fetch('/api/gemini-upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: playAd.videoUrl, apiKey: geminiApiKey }),
      }).then((r) => r.json())
      if (up.error || !up.fileUri) throw new Error(up.error || 'tải/upload video thất bại')
      let state: string = up.state, uri: string = up.fileUri, mime: string = up.mimeType || 'video/mp4'
      const fileName: string = up.fileName
      const t0 = Date.now()
      while (state !== 'ACTIVE' && Date.now() - t0 < 90000) {
        await new Promise((r) => setTimeout(r, 3000))
        const st = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${geminiApiKey}`).then((r) => r.json()).catch(() => null)
        if (st?.state) { state = st.state; uri = st.uri || uri; mime = st.mimeType || mime }
        if (state === 'FAILED') throw new Error('Gemini xử lý video thất bại')
      }
      if (state !== 'ACTIVE') throw new Error('Gemini xử lý video quá lâu — thử lại')
      const prompt = `Bạn xem 1 VIDEO QUẢNG CÁO Facebook của đối thủ (bán COD ở ${playAd.country}, tiếng Malay/English). Người đọc là marketer Việt. Trả JSON tiếng Việt:
{"transcript":"toàn bộ lời voice + chữ trên màn hình, DỊCH sang tiếng Việt theo trình tự","structure":"cấu trúc dựng + cách cắt ghép: hook → vấn đề → giải pháp/chứng minh → CTA, mỗi ý 1 dòng, ghi rõ kiểu cảnh"}
Caption ad: ${playAd.text || '(không có)'}
CHỈ trả JSON.`
      const raw = await directGeminiVision({
        apiKey: geminiApiKey,
        parts: [{ fileData: { mimeType: mime, fileUri: uri } }, { text: prompt }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: { transcript: { type: 'string' }, structure: { type: 'string' } },
          required: ['transcript', 'structure'],
        },
        temperature: 0.4, maxOutputTokens: 8192,
      })
      let parsed: AdRead
      try { parsed = JSON.parse(raw) as AdRead } catch { parsed = JSON.parse(raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()) as AdRead }
      setReadResult(parsed)
    } catch (e) {
      setReadErr('Đọc ad lỗi: ' + ((e as Error).message || '').slice(0, 140))
    } finally { setReadBusy(false) }
  }

  // Đọc LADIPAGE đối thủ: lấy nội dung trang đích (jina) → AI tóm tắt cấu trúc/offer/CTA.
  const readLadipage = async () => {
    if (!playAd?.linkUrl) { setLadiErr('Ad này không có link ladipage'); return }
    const dest = cleanLink(playAd.linkUrl)
    if (!linkKind(dest).web) { setLadiErr('Link đích là WhatsApp/Shopee/Chat — không phải trang web để đọc'); return }
    if (!geminiApiKey) { setLadiErr('Cần Gemini API key trong Cài đặt'); return }
    setLadiBusy(true); setLadiErr(null); setLadiResult(null)
    try {
      const md = await fetch(`https://r.jina.ai/${dest}`).then((r) => r.text())
      if (!md || md.length < 50) throw new Error('Không đọc được trang đích')
      const prompt = `Đây là nội dung trang đích (ladipage) của 1 ad COD đối thủ ở ${playAd.country}. Tóm tắt cho marketer Việt. Trả JSON tiếng Việt:
{"headline":"tiêu đề/hook chính của trang","offer":"ưu đãi/giá/combo (vd mua 2 tặng 1, freeship COD)","structure":"các khối trang theo thứ tự, mỗi ý 1 dòng","cta":"cách kêu gọi đặt hàng (form/nút/WhatsApp)","steal":"điểm hay đáng học/áp dụng, mỗi ý 1 dòng"}
NỘI DUNG TRANG:
${md.slice(0, 12000)}
CHỈ trả JSON.`
      const raw = await directGeminiText({
        apiKey: geminiApiKey, prompt, responseMimeType: 'application/json',
        responseSchema: { type: 'object', properties: { headline: { type: 'string' }, offer: { type: 'string' }, structure: { type: 'string' }, cta: { type: 'string' }, steal: { type: 'string' } }, required: ['headline', 'offer', 'structure', 'cta', 'steal'] },
        temperature: 0.4, maxOutputTokens: 4096,
      })
      let parsed: LadiRead
      try { parsed = JSON.parse(raw) as LadiRead } catch { parsed = JSON.parse(raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()) as LadiRead }
      setLadiResult(parsed)
    } catch (e) {
      setLadiErr('Đọc ladipage lỗi: ' + ((e as Error).message || '').slice(0, 120))
    } finally { setLadiBusy(false) }
  }

  // Bê kịch bản ad winner về SP CỦA MÌNH (song ngữ MY//VN), giữ công thức.
  const adaptScript = async () => {
    if (!readResult) { setAdaptErr('Bấm "Đọc ad" trước để có kịch bản gốc'); return }
    const prod = adaptProductId ? products.find((p) => p.id === adaptProductId) : null
    const prodName = prod?.productName || adaptName.trim()
    if (!prodName) { setAdaptErr('Chọn SP từ Kho hoặc gõ tên SP của mình'); return }
    if (!geminiApiKey) { setAdaptErr('Cần Gemini API key trong Cài đặt'); return }
    setAdaptBusy(true); setAdaptErr(null); setAdaptResult(null)
    try {
      const prodInfo = prod
        ? `${prod.productName}. ${prod.productDescription || ''} USP: ${prod.usps || ''}. Lợi ích: ${prod.benefits || ''}. Ưu đãi: ${prod.offer || ''}`
        : prodName
      const prompt = `Bạn là copywriter ad COD bán ở Malaysia. Dưới đây là kịch bản 1 ad WINNER của đối thủ. VIẾT LẠI thành kịch bản ad MỚI cho SẢN PHẨM CỦA TÔI, GIỮ đúng công thức/cấu trúc winner nhưng nội dung của SP tôi. Voice tiếng MALAY (để quay/đọc), kèm dịch VN trong ngoặc sau mỗi câu.
KỊCH BẢN ĐỐI THỦ (đã dịch VN): ${readResult.transcript}
CẤU TRÚC: ${readResult.structure}
SẢN PHẨM CỦA TÔI: ${prodInfo}
Trả JSON: {"hook":"câu mở đầu (MY // VN)","script":"toàn bộ lời voice tiếng MALAY, mỗi câu 1 dòng, kèm (VN) sau mỗi câu","shots":"gợi ý cảnh quay theo từng đoạn, mỗi ý 1 dòng","caption":"caption đăng FB (tiếng Malay)"}
CHỈ trả JSON.`
      const raw = await directGeminiText({
        apiKey: geminiApiKey, prompt, responseMimeType: 'application/json',
        responseSchema: { type: 'object', properties: { hook: { type: 'string' }, script: { type: 'string' }, shots: { type: 'string' }, caption: { type: 'string' } }, required: ['hook', 'script', 'shots', 'caption'] },
        temperature: 0.6, maxOutputTokens: 8192,
      })
      let parsed: AdaptScript
      try { parsed = JSON.parse(raw) as AdaptScript } catch { parsed = JSON.parse(raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()) as AdaptScript }
      setAdaptResult(parsed)
    } catch (e) {
      setAdaptErr('Viết kịch bản lỗi: ' + ((e as Error).message || '').slice(0, 120))
    } finally { setAdaptBusy(false) }
  }

  // Lọc + sắp xếp: ladipage + bộ lọc nâng cao (ngày chạy / nền tảng / CTA) + sort.
  const shownAds = (() => {
    let r = ads || []
    // Chặn phim ngắn / ad cài app (mọi nước, luôn bật).
    r = r.filter((a) => !isSpamAd(a))
    // CẤM video dài: bỏ ad >3 phút CHỈ theo durationSec server (TikTok, biết ngay lúc fetch).
    // KHÔNG dùng durMap (FB đo async ở client): nếu đo xong mới loại → ad đã hiện BIẾN MẤT DẦN
    // + layout nhảy → nút "Tải thêm" bị đẩy đi, bấm trượt. durMap chỉ dùng cho badge thời lượng.
    r = r.filter((a) => { const d = a.durationSec; return d == null || d <= MAX_AD_SEC })
    // Ép đúng quốc gia đã chọn (≠ALL): chỉ giữ ad đúng nước.
    if (country !== 'ALL') r = r.filter((a) => !a.country || a.country.toUpperCase() === country)
    if (ladiOnly && platform === 'fb') r = r.filter((a) => !!a.linkUrl && linkKind(cleanLink(a.linkUrl)).web)
    if (platform === 'fb') {
      if (minDays > 0) r = r.filter((a) => (a.daysRunning || 0) >= minDays)
      if (platformFilter) r = r.filter((a) => (a.platforms || []).some((p) => p.toUpperCase().includes(platformFilter)))
      if (ctaFilter) r = r.filter((a) => (a.cta || '').toLowerCase() === ctaFilter.toLowerCase())
    }
    const s = [...r]
    if (sortMode === 'days') s.sort((x, y) => (y.daysRunning || 0) - (x.daysRunning || 0))
    else if (sortMode === 'new') s.sort((x, y) => (x.daysRunning || 0) - (y.daysRunning || 0))
    else if (sortMode === 'variations') s.sort((x, y) => (y.variations || 0) - (x.variations || 0))
    return s   // 'win' = giữ thứ tự server (đã chấm điểm)
  })()
  // Danh sách CTA có trong kết quả → đổ vào dropdown lọc.
  const ctaOptions = [...new Set((ads || []).map((a) => (a.cta || '').trim()).filter(Boolean))].sort()
  // Video kênh: lọc "chỉ gắn giỏ" nếu bật; đếm số video gắn giỏ để hiện.
  const chCartCount = (chVids || []).filter((v) => v.hasCart).length
  const shownChVids = chCartOnly ? (chVids || []).filter((v) => v.hasCart) : (chVids || [])

  // Gom theo SP/advertiser: 1 brand chạy NHIỀU ad + chạy LÂU = đang scale = winner.
  const groups = (() => {
    const m = new Map<string, { key: string; page: string; ads: FbAd[]; totalLikes: number; maxDays: number; active: boolean; score: number }>()
    for (const a of shownAds) {
      const page = a.page || '(không rõ advertiser)'
      const key = page.toLowerCase()
      let g = m.get(key)
      if (!g) { g = { key, page, ads: [], totalLikes: 0, maxDays: 0, active: false, score: 0 }; m.set(key, g) }
      g.ads.push(a)
      g.totalLikes += a.likes || 0
      g.maxDays = Math.max(g.maxDays, a.daysRunning || 0)
      if (a.isActive) g.active = true
    }
    const arr = [...m.values()]
    for (const g of arr) {
      g.score = (g.active ? 40 : 0) + Math.min(g.maxDays, 180) * 0.4 + Math.log10(g.ads.length + 1) * 40 + Math.log10(g.totalLikes + 1) * 8
    }
    return arr.sort((x, y) => y.score - x.score)
  })()

  // ── Chọn + tải hàng loạt ──
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectMany = (list: FbAd[]) => setSelected((s) => { const n = new Set(s); list.forEach((a) => n.add(a.id)); return n })
  const dlName = (a: FbAd, i: number) => `${(a.page || 'ad').replace(/[^\w]+/g, '-').slice(0, 30)}-${i + 1}-${a.id}.mp4`
  const downloadOne = (a: FbAd, i = 0) => {
    if (!a.videoUrl) return
    const href = `/api/dl-video?url=${encodeURIComponent(a.videoUrl)}&name=${encodeURIComponent(dlName(a, i))}`
    const el = document.createElement('a'); el.href = href; el.download = dlName(a, i)
    document.body.appendChild(el); el.click(); el.remove()
  }
  const downloadSelected = async () => {
    const list = [...(ads || []), ...(chVids || [])].filter((a) => selected.has(a.id) && a.videoUrl)
    if (!list.length) return
    addToast(`Đang tải ${list.length} video… (cho phép tải nhiều file nếu trình duyệt hỏi)`, 'success')
    for (let i = 0; i < list.length; i++) { downloadOne(list[i], i); await new Promise((r) => setTimeout(r, 900)) }
  }

  // ── 🔗 Link Finder — bóc link salepage/ladipage từ ad theo từ khóa / SP Kho / ảnh ──
  const onLinkImg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const rd = new FileReader(); rd.onload = () => setLinkImg(String(rd.result || '')); rd.readAsDataURL(f)
  }
  // Từ khóa NGẮN suy heuristic từ tên SP khi AI lỗi/không có key (brand + cụm 2-3 từ đầu),
  // KHÔNG dùng nguyên tên dài (FB keyword_unordered đòi đủ mọi từ → 0 kết quả).
  const heuristicAngles = (name: string): string[] => {
    const toks = (coreTerms(name) || name).split(/\s+/).filter(Boolean)
    const out: string[] = []
    const push = (s: string) => { const v = s.trim(); if (v && !out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v) }
    if (toks[0]) push(toks[0])                       // brand / token đặc thù
    if (toks.length >= 2) push(toks.slice(0, 2).join(' '))
    if (toks.length >= 3) push(toks.slice(0, 3).join(' '))
    if (!out.length && name.trim()) push(name.trim().slice(0, 40))
    return out.slice(0, 4)
  }
  // Sinh từ khóa đa-góc từ: ảnh SP (vision) | SP Kho (mô tả) | keyword tay.
  // thinkingBudget:0 + token 512 → tránh 2.5-flash tiêu token vào "thinking" rồi trả RỖNG.
  // Trả kèm err để hiện nguyên nhân (vd hết quota Gemini) thay vì im lặng.
  const genAngles = async (): Promise<{ angles: string[]; err?: string }> => {
    const bankProduct = linkBankId ? products.find((x) => x.id === linkBankId) : null
    if (!geminiApiKey) {
      if (linkImg) return { angles: [], err: 'Cần Gemini API key trong Cài đặt để đọc ảnh ra từ khóa' }
      if (bankProduct) return { angles: heuristicAngles(bankProduct.productName) }
      return { angles: linkQ.trim() ? [linkQ.trim()] : [] }
    }
    try {
      let raw = ''
      if (linkImg) {
        const m = linkImg.match(/^data:([^;]+);base64,(.+)$/)
        if (!m) return { angles: [], err: 'Ảnh không hợp lệ — thử ảnh khác' }
        raw = await directGeminiVision({
          apiKey: geminiApiKey,
          parts: [{ inlineData: { mimeType: m[1], data: m[2] } }, { text: ANGLE_VISION_PROMPT }],
          responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 512, thinkingBudget: 0,
        })
      } else {
        const ctx = bankProduct
          ? `Tên: ${bankProduct.productName}. Mô tả: ${bankProduct.productDescription || ''}. Lợi ích: ${bankProduct.benefits || ''}. Nỗi đau: ${bankProduct.painPoints || ''}`
          : `Từ khóa: ${linkQ.trim()}`
        raw = await directGeminiText({ apiKey: geminiApiKey, prompt: ANGLE_TEXT_PROMPT(ctx), responseMimeType: 'application/json', temperature: 0.4, maxOutputTokens: 512, thinkingBudget: 0 })
      }
      const a = parseAngles(raw)
      if (a.length) return { angles: a }
      // AI trả rỗng → fallback ngắn (bank/keyword); ảnh thì báo lỗi rõ.
      if (bankProduct) return { angles: heuristicAngles(bankProduct.productName), err: 'AI trả rỗng — đang dùng từ khóa rút gọn' }
      if (linkQ.trim()) return { angles: [linkQ.trim()] }
      return { angles: [], err: 'AI không tạo được từ khóa từ ảnh — thử ảnh rõ hơn hoặc nhập tay' }
    } catch (e) {
      const msg = ((e as Error).message || 'lỗi').slice(0, 120)
      if (bankProduct) return { angles: heuristicAngles(bankProduct.productName), err: `AI lỗi (${msg}) — dùng từ khóa rút gọn` }
      if (linkQ.trim()) return { angles: [linkQ.trim()], err: `AI lỗi (${msg})` }
      return { angles: [], err: `AI lỗi: ${msg}` }
    }
  }
  const verifyLinks = async (list: FoundLink[]) => {
    const q = linkQueryRef.current
    const queue = list.filter((l) => l.web)
    const worker = async () => {
      for (;;) {
        const l = queue.shift(); if (!l) break
        setLinks((prev) => (prev || []).map((x) => x.url === l.url ? { ...x, verifying: true } : x))
        try {
          const d = (await fetch(`/api/detect-cms?url=${encodeURIComponent(l.url)}&q=${encodeURIComponent(q)}`).then((r) => r.json())) as { cms?: string; contains?: boolean | null }
          setLinks((prev) => (prev || []).map((x) => x.url === l.url ? { ...x, verifying: false, cms: d.cms, contains: d.contains ?? null } : x))
        } catch {
          setLinks((prev) => (prev || []).map((x) => x.url === l.url ? { ...x, verifying: false, contains: null } : x))
        }
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()])
  }
  // Đối chiếu ẢNH: server fetch ảnh hero salepage (jina-html) → Gemini so với ảnh SP user upload.
  const verifyImageMatch = async (list: FoundLink[]) => {
    if (!linkImg || !geminiApiKey) return
    const q = linkQueryRef.current
    const queue = list.filter((l) => l.web)
    const worker = async () => {
      for (;;) {
        const l = queue.shift(); if (!l) break
        setLinks((prev) => (prev || []).map((x) => x.url === l.url ? { ...x, matchBusy: true } : x))
        try {
          const d = (await fetch('/api/detect-cms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: l.url, refImage: linkImg, apiKey: geminiApiKey, q }) }).then((r) => r.json())) as { match?: boolean | null; cms?: string; contains?: boolean | null }
          setLinks((prev) => (prev || []).map((x) => x.url === l.url ? { ...x, matchBusy: false, matchSku: d.match ?? null, cms: x.cms ?? d.cms, contains: x.contains ?? (d.contains ?? null) } : x))
        } catch {
          setLinks((prev) => (prev || []).map((x) => x.url === l.url ? { ...x, matchBusy: false, matchSku: null } : x))
        }
      }
    }
    await Promise.all([worker(), worker()])
  }
  // Gom ≥10 link MỚI (hoặc hết) qua TẤT CẢ nguồn (góc từ khóa × nền tảng). Cursor + dedup ở ref
  // nên "Tải thêm" tiếp đúng chỗ. Dedup theo DOMAIN: 1 salepage / seller. Ưu tiên linkUrl (CTA).
  const fetchLinkBatch = async (): Promise<FoundLink[]> => {
    const batch: FoundLink[] = []
    let rounds = 0
    const srcs = linkSourcesRef.current
    while (batch.length < 10 && rounds < 16) {
      rounds++
      let progressed = false
      for (const s of srcs) {
        if (s.cursor === null) continue   // nguồn này đã hết
        progressed = true
        const base = s.plat === 'fb' ? '/api/fb-ads' : '/api/tiktok-ads'
        const st = s.plat === 'fb' ? '&status=ALL&links=1' : ''   // links=1: lấy cả ad ảnh/carousel có link đích
        const curP = (typeof s.cursor === 'string' && s.cursor) ? `&cursor=${encodeURIComponent(s.cursor)}` : ''
        try {
          const d = (await fetch(`${base}?q=${encodeURIComponent(s.q)}&country=${country}${st}${curP}`).then((r) => r.json())) as { error?: string; ads?: FbAd[]; cursor?: string | number | null; hasMore?: boolean; credits?: number | null }
          if (d.error) { s.cursor = null; continue }
          const adsArr: FbAd[] = Array.isArray(d.ads) ? d.ads : []
          for (const a of adsArr) {
            const cands: string[] = []
            if (a.linkUrl) cands.push(a.linkUrl)                                                  // ưu tiên link đích (CTA)
            else cands.push(...(String(a.text || '').match(/https?:\/\/[^\s)"']+/gi) || []))       // không có → quét caption
            for (const rawu of cands) {
              const dest = cleanLink(rawu)
              if (!/^https?:\/\//i.test(dest)) continue
              const dom = domainOf(dest)
              if (linkSeenRef.current.has(dom)) continue   // dedup theo DOMAIN
              linkSeenRef.current.add(dom)
              const k = linkKind(dest)
              batch.push({ url: dest, domain: dom, kindLabel: k.label, kindEmoji: k.emoji, web: k.web, page: a.page || '', adText: a.text || '', platform: s.plat })
            }
          }
          if (d.credits != null) setCredits(d.credits)
          s.cursor = d.cursor != null && d.hasMore ? String(d.cursor) : null
        } catch { s.cursor = null }
        if (batch.length >= 10) break
      }
      if (!progressed) break   // mọi nguồn đã hết
    }
    return batch
  }
  const linkHasMoreNow = () => linkSourcesRef.current.some((s) => s.cursor !== null)
  const runLinkFinder = async () => {
    if (!linkBankId && !linkImg && !linkQ.trim()) { setLinkErr('Nhập từ khóa, chọn SP từ Kho, hoặc tải ảnh SP'); return }
    setLinkBusy(true); setLinks([]); setLinkHasMore(false); setLinkAngles([])
    setLinkErr(linkImg ? '🔍 AI đang đọc ảnh + tạo từ khóa…' : '🧠 AI đang tạo từ khóa đa góc…')
    const { angles, err } = await genAngles()
    if (!angles.length) { setLinkBusy(false); setLinkErr(err || 'Không tạo được từ khóa — thử nhập tay'); return }
    setLinkAngles(angles); setLinkErr(err ?? null)   // err có thể là cảnh báo non-fatal (fallback)
    linkSeenRef.current = new Set()
    linkQueryRef.current = angles.join(' ')
    const plats: ('fb' | 'tiktok')[] = linkPlat === 'both' ? ['fb', 'tiktok'] : [linkPlat]
    linkSourcesRef.current = angles.flatMap((q) => plats.map((plat) => ({ q, plat, cursor: undefined as string | null | undefined })))
    try {
      const batch = await fetchLinkBatch()
      setLinks(batch)
      setLinkHasMore(linkHasMoreNow())
      if (!batch.length) { setLinkErr('Không tìm thấy link salepage — thử SP/ảnh/nước khác (FB là nguồn chính)' + (err ? ` · ${err}` : '')); return }
      void verifyLinks(batch)
      if (imgMatch && linkImg) void verifyImageMatch(batch)
    } catch (e) { setLinkErr((e as Error).message) } finally { setLinkBusy(false) }
  }
  const loadMoreLinks = async () => {
    if (linkMoreBusy || linkBusy) return
    setLinkMoreBusy(true)
    try {
      const batch = await fetchLinkBatch()
      if (batch.length) setLinks((prev) => [...(prev || []), ...batch])
      setLinkHasMore(linkHasMoreNow())
      if (!batch.length) addToast('Đã hết trang cho các từ khóa này', 'success')
      else { void verifyLinks(batch); if (imgMatch && linkImg) void verifyImageMatch(batch) }
    } catch (e) { addToast('Tải thêm lỗi: ' + ((e as Error).message || '').slice(0, 60), 'error') } finally { setLinkMoreBusy(false) }
  }
  // onlyMatched: ẩn link xác minh KHÔNG khớp (giữ chưa xác minh để khỏi trống lúc đang verify).
  // onlySku: chỉ giữ link "cùng SP" theo đối chiếu ảnh (ẩn cái đã xác nhận khác).
  const shownLinks = (links || []).filter((l) =>
    (!onlyWeb || l.web) && (!onlyMatched || l.contains !== false) && (!onlySku || l.matchSku !== false),
  )

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#EEEEF2]">
      {/* Header + search */}
      <header className="flex shrink-0 flex-col gap-3 border-b border-black/10 bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100"><Megaphone className="h-4 w-4 text-rose-600" /></div>
          <div>
            <h1 className="text-base font-bold text-slate-800">Spy Ads — Quảng cáo đối thủ</h1>
            <p className="text-[11px] text-slate-400">{mode === 'channel' ? 'Dán tên kênh / link / ID → xem + tải TẤT CẢ video kênh (kể cả video dính giỏ TikTok Shop, PC xem được)' : (platform === 'fb' ? 'Video ads đang chạy trên Facebook Ad Library' : 'Top video ads TikTok (Creative Center)') + ' → tải về dựng lại cho FB ads'}</p>
          </div>
          {credits != null && <span className="ml-auto text-xs text-slate-400">credit: {credits}</span>}
        </div>
        {/* Mode + nước (dùng chung 2 mode) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-0.5 rounded-lg border border-black/10 bg-white p-0.5">
            <button onClick={() => setMode('channel')}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${mode === 'channel' ? 'bg-rose-600 text-white' : 'text-slate-500'}`}>📺 Video theo kênh</button>
            <button onClick={() => setMode('ads')}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${mode === 'ads' ? 'bg-rose-600 text-white' : 'text-slate-500'}`}>🔍 Tìm ad theo từ khóa</button>
            <button onClick={() => setMode('links')}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${mode === 'links' ? 'bg-rose-600 text-white' : 'text-slate-500'}`}>🔗 Tìm Salepage</button>
          </div>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm font-medium">
            {COUNTRIES.map((x) => <option key={x.c} value={x.c}>{x.f} {x.c}</option>)}
          </select>
        </div>

        {/* MODE: Video theo kênh — dán tên kênh/link/id → tất cả video kênh */}
        {mode === 'channel' && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={chInput} onChange={(e) => setChInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void fetchChannel() }}
                placeholder="tên kênh (@user) · link TikTok (tiktok.com/@user) · ID kênh → xem tất cả video"
                className="min-w-[260px] flex-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm"
              />
              <div className="inline-flex items-center gap-0.5 rounded-lg border border-black/10 bg-white p-0.5">
                <button onClick={() => { setChSort('popular'); if (chInput.trim()) void fetchChannel() }}
                  className={`rounded-md px-3 py-1 text-xs font-semibold ${chSort === 'popular' ? 'bg-rose-100 text-rose-700' : 'text-slate-500'}`}>🔥 Nổi bật</button>
                <button onClick={() => { setChSort('latest'); if (chInput.trim()) void fetchChannel() }}
                  className={`rounded-md px-3 py-1 text-xs font-semibold ${chSort === 'latest' ? 'bg-rose-100 text-rose-700' : 'text-slate-500'}`}>🆕 Mới nhất</button>
              </div>
              <button onClick={() => void fetchChannel()} disabled={chLoading}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                <Radio className="h-4 w-4" /> {chLoading ? 'Đang tải…' : 'Xem video kênh'}
              </button>
              {chErr && <span className="text-xs text-red-500">{chErr}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={chLinkInput} onChange={(e) => setChLinkInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void fetchVideo() }}
                placeholder="…hoặc dán LINK 1 video (kể cả video gắn giỏ tiktok.com ẩn trên PC) → xem riêng video đó"
                className="min-w-[260px] flex-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm"
              />
              <button onClick={() => void fetchVideo()} disabled={chLoading}
                className="flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-4 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                <Play className="h-4 w-4" /> Xem video lẻ
              </button>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
                <input type="checkbox" checked={chCartOnly} onChange={(e) => setChCartOnly(e.target.checked)} /> 🛒 Chỉ video gắn giỏ hàng
              </label>
            </div>
            <p className="text-[11px] text-slate-400">💡 Video dính giỏ TikTok Shop trên PC không xem được ở tiktok.com — ở đây phát + tải bình thường (file gốc, không logo). Dán <b>kênh creator</b> (không phải link gian hàng shop), hoặc <b>link 1 video</b> để xem riêng.</p>
          </>
        )}

        {/* MODE: Tìm ad theo từ khóa (luồng cũ) */}
        {mode === 'ads' && (
          <>
            {viewPageName && (
              <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700">
                <span>📢 Tất cả ad của advertiser: <b>{viewPageName}</b></span>
                <button onClick={exitAdvertiser}
                  className="ml-auto rounded-md border border-indigo-200 bg-white px-2 py-0.5 font-semibold hover:bg-indigo-100">← Thoát</button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-0.5 rounded-lg border border-black/10 bg-white p-0.5">
                <button onClick={() => switchPlatform('fb')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold ${platform === 'fb' ? 'bg-rose-100 text-rose-700' : 'text-slate-500'}`}>👍 Facebook</button>
                <button onClick={() => switchPlatform('tiktok')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold ${platform === 'tiktok' ? 'bg-rose-100 text-rose-700' : 'text-slate-500'}`}>🎵 TikTok</button>
              </div>
              <input
                value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void search() }}
                placeholder="từ khóa / ngách (vd: collagen, sakit lutut, kurus...)"
                className="min-w-[220px] flex-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm"
              />
              <button onClick={() => void search()} disabled={loading}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                <Search className="h-4 w-4" /> {loading ? 'Đang tìm…' : 'Tìm ad'}
              </button>
              {platform === 'fb' && (
                <>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} /> Chỉ ad đang chạy
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <input type="checkbox" checked={ladiOnly} onChange={(e) => setLadiOnly(e.target.checked)} /> 🔗 Chỉ ad có Ladipage/Sale page
                  </label>
                </>
              )}
              {error && <span className="text-xs text-red-500">{error}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-400">Từ khóa COD:</span>
              <button onClick={() => setChipsOpen((v) => !v)}
                className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600 lg:hidden">
                Gợi ý {chipsOpen ? '▴' : '▾'}
              </button>
              <div className={`${chipsOpen ? 'contents' : 'hidden'} lg:contents`}>
                {COD_CHIPS.map((c) => (
                  <button key={c} onClick={() => void search(c)} disabled={loading}
                    className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50">
                    {c}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2">
                {ads && ads.length > 0 && (
                  <>
                    <button onClick={() => selectMany(shownAds)}
                      className="rounded-md border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50">✓ Chọn tất cả</button>
                    <div className="inline-flex items-center gap-0.5 rounded-lg border border-black/10 bg-white p-0.5">
                      <button onClick={() => setGroupView(false)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${!groupView ? 'bg-rose-100 text-rose-700' : 'text-slate-500'}`}>▦ Lưới</button>
                      <button onClick={() => setGroupView(true)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${groupView ? 'bg-rose-100 text-rose-700' : 'text-slate-500'}`}>📦 Gom theo SP</button>
                    </div>
                  </>
                )}
                <button onClick={() => setShowFilters((v) => !v)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${showFilters ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-black/10 bg-white text-slate-600 hover:bg-slate-50'}`}>
                  ⚙ Bộ lọc nâng cao {showFilters ? '▲' : '▼'}
                </button>
              </div>
            </div>
            {showFilters && (
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2 rounded-xl border border-black/10 bg-slate-50 p-3">
                <label className="flex flex-col gap-0.5 text-[10px] font-semibold text-slate-500">Sắp xếp
                  <select value={sortMode} onChange={(e) => setSortMode(e.target.value as typeof sortMode)} className="rounded-lg border border-black/10 bg-white px-2 py-1 text-xs font-medium text-slate-700">
                    <option value="win">🏆 Winner (mặc định)</option>
                    <option value="days">⏳ Chạy lâu nhất</option>
                    <option value="variations">📑 Nhiều biến thể</option>
                    <option value="new">🆕 Mới nhất</option>
                  </select>
                </label>
                {platform === 'fb' && (
                  <>
                    <label className="flex flex-col gap-0.5 text-[10px] font-semibold text-slate-500">Chạy tối thiểu
                      <select value={minDays} onChange={(e) => setMinDays(Number(e.target.value))} className="rounded-lg border border-black/10 bg-white px-2 py-1 text-xs font-medium text-slate-700">
                        <option value={0}>Tất cả</option>
                        <option value={7}>≥ 7 ngày</option>
                        <option value={14}>≥ 14 ngày</option>
                        <option value={30}>≥ 30 ngày (đã proven)</option>
                        <option value={60}>≥ 60 ngày</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-0.5 text-[10px] font-semibold text-slate-500">Nền tảng
                      <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="rounded-lg border border-black/10 bg-white px-2 py-1 text-xs font-medium text-slate-700">
                        <option value="">Tất cả</option>
                        <option value="FACEBOOK">Facebook</option>
                        <option value="INSTAGRAM">Instagram</option>
                        <option value="MESSENGER">Messenger</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-0.5 text-[10px] font-semibold text-slate-500">Nút CTA
                      <select value={ctaFilter} onChange={(e) => setCtaFilter(e.target.value)} className="rounded-lg border border-black/10 bg-white px-2 py-1 text-xs font-medium text-slate-700">
                        <option value="">Tất cả</option>
                        {ctaOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5 self-center pt-3 text-[11px] font-medium text-slate-600">
                      <input type="checkbox" checked={exact} onChange={(e) => setExact(e.target.checked)} /> Tìm chính xác cụm <span className="text-slate-400">(tìm lại để áp dụng)</span>
                    </label>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* MODE: Tìm Salepage/Link — bóc link đích từ ad theo từ khóa / SP Kho / ảnh */}
        {mode === 'links' && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-0.5 rounded-lg border border-black/10 bg-white p-0.5">
                <button onClick={() => setLinkPlat('fb')} className={`rounded-md px-3 py-1 text-xs font-semibold ${linkPlat === 'fb' ? 'bg-rose-100 text-rose-700' : 'text-slate-500'}`}>👍 Facebook</button>
                <button onClick={() => setLinkPlat('tiktok')} className={`rounded-md px-3 py-1 text-xs font-semibold ${linkPlat === 'tiktok' ? 'bg-rose-100 text-rose-700' : 'text-slate-500'}`}>🎵 TikTok</button>
                <button onClick={() => setLinkPlat('both')} className={`rounded-md px-3 py-1 text-xs font-semibold ${linkPlat === 'both' ? 'bg-rose-100 text-rose-700' : 'text-slate-500'}`}>Cả 2</button>
              </div>
              <input
                value={linkQ} onChange={(e) => { setLinkQ(e.target.value); setLinkBankId(''); setLinkImg('') }} onKeyDown={(e) => { if (e.key === 'Enter') void runLinkFinder() }}
                placeholder="từ khóa SP (vd: collagen, sakit lutut, jam tangan…)"
                className="min-w-[200px] flex-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm" />
              <select value={linkBankId} onChange={(e) => { setLinkBankId(e.target.value); if (e.target.value) { setLinkImg(''); setLinkQ('') } }}
                className="max-w-[180px] rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs">
                <option value="">— SP từ Kho —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.productName}</option>)}
              </select>
              {linkImg && <img src={linkImg} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-black/10 object-cover" />}
              <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50" title="Tìm link bằng ảnh SP">
                🖼️ {linkImg ? 'Đổi ảnh' : 'Ảnh SP'}<input type="file" accept="image/*" className="hidden" onChange={onLinkImg} />
              </label>
              <button onClick={() => void runLinkFinder()} disabled={linkBusy}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                <Link2 className="h-4 w-4" /> {linkBusy ? 'Đang tìm…' : 'Tìm link'}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600">
              <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={onlyWeb} onChange={(e) => setOnlyWeb(e.target.checked)} /> 🔗 Chỉ Web/Ladipage (bỏ sàn + chat)</label>
              <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={onlyMatched} onChange={(e) => setOnlyMatched(e.target.checked)} /> ✓ Ẩn link không khớp</label>
              {linkImg && <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={imgMatch} onChange={(e) => setImgMatch(e.target.checked)} /> 🖼️ Đối chiếu ảnh (cùng mã hàng)</label>}
              {linkImg && imgMatch && <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={onlySku} onChange={(e) => setOnlySku(e.target.checked)} /> ✅ Chỉ cùng SP</label>}
              {linkImg && <button onClick={() => setLinkImg('')} className="text-rose-500 underline">bỏ ảnh</button>}
              {linkErr && <span className="text-rose-500">{linkErr}</span>}
            </div>
            {linkAngles.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                <span className="font-semibold">Từ khóa AI:</span>
                {linkAngles.map((a) => <span key={a} className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{a}</span>)}
              </div>
            )}
          </>
        )}
      </header>

      {/* Results */}
      <main className="flex-1 overflow-y-auto p-5">
        {/* ── MODE VIDEO THEO KÊNH ── */}
        {mode === 'channel' && (
          <>
            {!chVids && !chLoading && (
              <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/10 text-center text-slate-400">
                <Radio className="h-8 w-8" />
                <p className="text-sm">Dán <b>tên kênh / link TikTok / ID</b> → <b>Xem video kênh</b>.</p>
                <p className="text-xs">Hiện <b>tất cả video</b> của kênh — kể cả video gắn giỏ TikTok Shop (PC xem được). Bấm để phát, tải lẻ hoặc tải hàng loạt.</p>
              </div>
            )}
            {chLoading && <div className="py-10 text-center text-sm text-slate-400">Đang tải video của kênh…</div>}
            {chVids && chVids.length > 0 && (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">📺 {chTitle} · {shownChVids.length}{chCartOnly ? `/${chVids.length}` : ''} video ({chSort === 'popular' ? '🔥 nổi bật' : '🆕 mới nhất'})</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">🛒 {chCartCount} gắn giỏ</span>
                  <button onClick={() => selectMany(shownChVids)}
                    className="ml-auto rounded-md border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50">✓ Chọn tất cả</button>
                </div>
                {chCartOnly && shownChVids.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-black/10 p-4 text-center text-xs text-slate-400">Không thấy video nào gắn giỏ (theo cờ TikTok Shop) — bỏ tick "🛒 Chỉ video gắn giỏ" để xem tất cả.</p>
                ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
                  {shownChVids.map((a) => (
                    <div key={a.id} className={`relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm ${selected.has(a.id) ? 'border-rose-400 ring-2 ring-rose-300' : 'border-black/10'}`}>
                      <button onClick={(e) => { e.stopPropagation(); toggleSel(a.id) }} title="Chọn để tải hàng loạt"
                        className={`absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-md border text-xs font-bold shadow ${selected.has(a.id) ? 'border-rose-500 bg-rose-500 text-white' : 'border-white/70 bg-black/40 text-white/80'}`}>
                        {selected.has(a.id) ? '✓' : ''}
                      </button>
                      <button onClick={() => openAd(a)} className="relative flex aspect-[3/4] items-center justify-center bg-slate-900">
                        {a.cover ? <img src={a.cover} alt="" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} /> : null}
                        <Play className="absolute h-10 w-10 text-white/90 drop-shadow" />
                        {a.hasCart && <span className="absolute left-1.5 top-1.5 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">🛒 giỏ</span>}
                        {a.durationSec ? <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white">⏱ {fmtDur(a.durationSec)}</span> : null}
                        {a.views ? <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">👁 {fmtK(a.views)}</span> : null}
                      </button>
                      <div className="flex flex-1 flex-col gap-1 p-2.5">
                        <p className="line-clamp-2 text-[11px] text-slate-600">{a.text || '(không mô tả)'}</p>
                        <div className="mt-auto flex items-center gap-2 pt-1">
                          <button onClick={() => downloadOne(a)}
                            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-violet-200 bg-violet-50 py-1.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-100">
                            <Download className="h-3 w-3" /> Tải
                          </button>
                          {a.productUrl && (
                            <a href={a.productUrl} target="_blank" rel="noopener noreferrer" title="Mở SP trên TikTok Shop"
                              className="flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-emerald-700 hover:bg-emerald-100"><ExternalLink className="h-3.5 w-3.5" /></a>
                          )}
                          {a.likes ? <span className="text-[10px] font-medium text-slate-400">❤️ {fmtK(a.likes)}</span> : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                )}
                {chHasMore && !chCartOnly && (
                  <button onClick={() => void fetchChannel(true)} disabled={chMoreLoading}
                    className="mt-4 w-full rounded-xl border border-rose-300 bg-white py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                    {chMoreLoading ? 'Đang tải…' : '↻ Tải thêm video'}
                  </button>
                )}
              </>
            )}
            {chVids && chVids.length === 0 && !chLoading && (
              <p className="rounded-xl border border-dashed border-black/10 p-4 text-center text-xs text-slate-400">{chErr || 'Kênh không có video.'}</p>
            )}
          </>
        )}

        {/* ── MODE TÌM AD ── */}
        {mode === 'ads' && !ads && !loading && (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/10 text-center text-slate-400">
            <Megaphone className="h-8 w-8" />
            <p className="text-sm">Nhập ngách/từ khóa + chọn nước → <b>Tìm ad</b>.</p>
            <p className="text-xs">Ad <b>đang chạy + lâu + advertiser nhiều bản</b> = winner (đốt tiền lâu chứng tỏ có lời).</p>
          </div>
        )}
        {mode === 'ads' && loading && <div className="py-10 text-center text-sm text-slate-400">{platform === 'fb' ? 'Đang quét Facebook Ad Library…' : 'Đang quét TikTok Top Ads…'}</div>}
        {mode === 'ads' && ads && ads.length > 0 && (
          <>
            <div className="mb-2 text-xs font-semibold text-slate-500">
              {shownAds.length} ad{ladiOnly && platform === 'fb' ? ' có Ladipage/Sale page' : ''}
              {groupView && shownAds.length > 0 ? ` · ${groups.length} SP/advertiser` : ''}
            </div>
            {ladiOnly && platform === 'fb' && shownAds.length === 0 && (
              <p className="rounded-xl border border-dashed border-black/10 p-4 text-center text-xs text-slate-400">
                Lượt này không có ad nào dẫn về web/ladipage (đa số đi WhatsApp/Shopee). Bỏ tick lọc hoặc bấm "Tải thêm".
              </p>
            )}
            {groupView ? (
              <div className="flex flex-col gap-3">
                <p className="text-[11px] text-slate-400">SP/brand chạy <b>nhiều video-ad + lâu</b> = đang scale = winner. Xếp trên cùng là mạnh nhất.</p>
                {groups.map((g, gi) => (
                  <div key={g.key} className="rounded-xl border border-black/10 bg-white p-3 shadow-sm">
                    <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      {gi === 0 && <span className="text-sm">🏆</span>}
                      <span className="text-sm font-bold text-slate-800">{g.page}</span>
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">📢 {g.ads.length} ad</span>
                      {g.maxDays > 0 && <span className="text-[11px] font-medium text-slate-500">⏳ lâu nhất {g.maxDays}d</span>}
                      {g.totalLikes > 0 && <span className="text-[11px] font-medium text-slate-500">❤️ {fmtK(g.totalLikes)}</span>}
                      {g.active && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">● đang chạy</span>}
                      <div className="ml-auto flex items-center gap-1.5">
                        {platform === 'fb' && g.ads[0]?.pageId && (
                          <button onClick={() => void viewAdvertiser(g.ads[0].pageId, g.page)}
                            className="rounded-md border border-indigo-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-indigo-600 hover:bg-indigo-50">
                            📢 Tất cả ad
                          </button>
                        )}
                        <button onClick={() => selectMany(g.ads)}
                          className="rounded-md border border-rose-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-rose-600 hover:bg-rose-50">
                          ✓ Chọn cả brand
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {g.ads.map((a) => (
                        <div key={a.id} className={`relative aspect-[3/4] w-[104px] shrink-0 overflow-hidden rounded-lg bg-slate-900 ${selected.has(a.id) ? 'ring-2 ring-rose-400' : ''}`}>
                          <button onClick={(e) => { e.stopPropagation(); toggleSel(a.id) }} title="Chọn để tải"
                            className={`absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded border text-[10px] font-bold ${selected.has(a.id) ? 'border-rose-500 bg-rose-500 text-white' : 'border-white/70 bg-black/40 text-white/80'}`}>
                            {selected.has(a.id) ? '✓' : ''}
                          </button>
                          <button onClick={() => openAd(a)} className="block h-full w-full">
                            {a.cover ? <img src={a.cover} alt="" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} /> : null}
                            <Play className="absolute inset-0 m-auto h-6 w-6 text-white/90 drop-shadow" />
                            {(a.daysRunning > 0 || a.likes) ? (
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-0.5 text-[9px] font-semibold text-white">
                                {a.daysRunning > 0 ? `⏳${a.daysRunning}d ` : ''}{a.likes ? `❤️${fmtK(a.likes)}` : ''}
                              </div>
                            ) : null}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
              {shownAds.map((a) => (
                <div key={a.id} className={`relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm ${selected.has(a.id) ? 'border-rose-400 ring-2 ring-rose-300' : 'border-black/10'}`}>
                  <button onClick={(e) => { e.stopPropagation(); toggleSel(a.id) }} title="Chọn để tải hàng loạt"
                    className={`absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-md border text-xs font-bold shadow ${selected.has(a.id) ? 'border-rose-500 bg-rose-500 text-white' : 'border-white/70 bg-black/40 text-white/80'}`}>
                    {selected.has(a.id) ? '✓' : ''}
                  </button>
                  <button onClick={() => openAd(a)} className="relative flex aspect-[3/4] items-center justify-center bg-slate-900">
                    {a.cover ? <img src={a.cover} alt="" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} /> : null}
                    <Play className="absolute h-10 w-10 text-white/90 drop-shadow" />
                    {a.isActive && <span className="absolute left-1.5 top-1.5 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">● ĐANG CHẠY</span>}
                    {(() => { const d = a.durationSec ?? durMap[a.id]; return d ? <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white">⏱ {fmtDur(d)}</span> : null })()}
                  </button>
                  {/* Probe đo thời lượng FB (API không trả) — ẩn, load metadata rồi tự rớt nếu >3 phút. */}
                  {platform === 'fb' && a.videoUrl && a.durationSec == null && durMap[a.id] == null && (
                    <video src={a.videoUrl} preload="metadata" muted className="pointer-events-none absolute h-px w-px opacity-0"
                      onLoadedMetadata={(e) => { const s = e.currentTarget.duration; if (isFinite(s) && s > 0) setDurMap((m) => ({ ...m, [a.id]: Math.round(s) })) }} />
                  )}
                  <div className="flex flex-1 flex-col gap-1 p-2.5">
                    <p className="line-clamp-1 text-xs font-semibold text-slate-700">{a.page || '(advertiser)'}</p>
                    <p className="line-clamp-2 text-[11px] text-slate-500">{a.text}</p>
                    <div className="mt-auto flex flex-wrap gap-x-2 gap-y-0.5 pt-1 text-[10px] font-medium text-slate-500">
                      {a.daysRunning > 0 && <span>⏳ {a.daysRunning}d</span>}
                      {a.advertiserAds > 1 && <span>📢 {a.advertiserAds} ad</span>}
                      {a.variations && a.variations > 1 ? <span>📑 {a.variations}</span> : null}
                      {a.likes ? <span>❤️ {fmtK(a.likes)}</span> : null}
                      {a.ctr ? <span>CTR {a.ctr}</span> : null}
                      {a.cta ? <span className="rounded bg-slate-100 px-1 text-slate-600">🔘 {a.cta}</span> : null}
                      <span>{COUNTRIES.find((c) => c.c === a.country)?.f ?? ''}{a.country}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
            {hasMore && (
              <button onClick={() => void loadMore()} disabled={moreLoading}
                className="mt-4 w-full rounded-xl border border-rose-300 bg-white py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                {moreLoading ? 'Đang tải…' : '↻ Tải thêm ad'}
              </button>
            )}
          </>
        )}

        {/* ── MODE TÌM SALEPAGE ── */}
        {mode === 'links' && (
          <>
            {!links && !linkBusy && (
              <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/10 text-center text-slate-400">
                <Link2 className="h-8 w-8" />
                <p className="text-sm">Nhập từ khóa / chọn SP từ Kho / tải ảnh → <b>Tìm link</b>.</p>
                <p className="text-xs">AI tạo <b>từ khóa đa góc</b> (brand + đặc điểm/lợi ích) để bắt cả đối thủ <b>rebrand cùng mã hàng</b>. Tải ảnh + bật "Đối chiếu ảnh" để lọc đúng <b>cùng SP</b>. FB là nguồn chính; TikTok ẩn link đích nên ít.</p>
              </div>
            )}
            {linkBusy && <div className="py-10 text-center text-sm text-slate-400">🔎 Đang quét ad + bóc link đích…</div>}
            {links && links.length > 0 && (
              <>
                <div className="mb-2 text-xs font-semibold text-slate-500">{shownLinks.length} link{onlyWeb ? ' Web/Ladipage' : ''} (tổng {links.length})</div>
                <div className="flex flex-col gap-2">
                  {shownLinks.map((l) => (
                    <div key={l.url} className="flex flex-col gap-1.5 rounded-xl border border-black/10 bg-white p-3 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm">{l.kindEmoji}</span>
                        <span className="text-xs font-bold text-slate-700">{l.domain}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{l.kindLabel}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{l.platform === 'fb' ? '👍 FB' : '🎵 TikTok'}</span>
                        {l.cms && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">🧱 {l.cms}</span>}
                        {l.verifying && <span className="text-[10px] text-slate-400">đang xác minh…</span>}
                        {l.contains === true && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">✓ khớp nội dung</span>}
                        {l.contains === false && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">? chưa thấy key</span>}
                        {l.matchBusy && <span className="text-[10px] text-slate-400">đối chiếu ảnh…</span>}
                        {l.matchSku === true && <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">✅ cùng SP</span>}
                        {l.matchSku === false && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500">✗ khác SP</span>}
                      </div>
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="block break-all text-[11px] text-blue-600 underline">{l.url}</a>
                      {l.page && <p className="line-clamp-1 text-[10px] text-slate-400">📢 {l.page}{l.adText ? ` · ${l.adText.slice(0, 90)}` : ''}</p>}
                      <div className="flex gap-1.5">
                        <button onClick={() => { navigator.clipboard?.writeText(l.url); addToast('Đã copy link', 'success') }}
                          className="rounded-md border border-rose-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50">📋 Copy</button>
                        <a href={l.url} target="_blank" rel="noopener noreferrer"
                          className="rounded-md border border-black/10 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">↗ Mở</a>
                      </div>
                    </div>
                  ))}
                </div>
                {shownLinks.length === 0 && (
                  <p className="rounded-xl border border-dashed border-black/10 p-4 text-center text-xs text-slate-400">
                    Tất cả link bị lọc — bỏ tick "Chỉ Web/Ladipage" hoặc "Chỉ link đã khớp" để xem thêm.
                  </p>
                )}
                {linkHasMore && (
                  <button onClick={() => void loadMoreLinks()} disabled={linkMoreBusy}
                    className="mt-3 w-full rounded-xl border border-rose-300 bg-white py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                    {linkMoreBusy ? 'Đang tải thêm trang…' : '↻ Tải thêm trang (≥10 link mới)'}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Thanh tải hàng loạt — hiện khi có ad được chọn */}
      {selected.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-2.5 shadow-xl">
            <span className="text-sm font-semibold text-slate-700">✓ Đã chọn {selected.size} video</span>
            <button onClick={() => void downloadSelected()}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-700">
              <Download className="h-4 w-4" /> Tải {selected.size} video
            </button>
            <button onClick={() => setSelected(new Set())}
              className="rounded-xl border border-black/10 px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-50">Bỏ chọn</button>
          </div>
        </div>
      )}

      {/* Modal: xem ad + AI đọc kịch bản */}
      {playAd && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 sm:p-4" onClick={closeAd}>
          <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white lg:flex-row" onClick={(e) => e.stopPropagation()}>
            <button onClick={closeAd} className="absolute right-2 top-2 z-10 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"><X className="h-5 w-5" /></button>
            <div className="flex shrink-0 items-center justify-center bg-black lg:w-[44%]">
              <video src={playAd.videoUrl} controls autoPlay playsInline className="max-h-[40vh] w-full object-contain lg:max-h-[92vh]" />
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
              <p className="text-xs font-semibold text-slate-700">{playAd.page}</p>
              <p className="mb-2 text-[11px] text-slate-400">
                {playAd.daysRunning > 0 ? `⏳ chạy ${playAd.daysRunning} ngày · ` : ''}
                {playAd.advertiserAds > 1 ? `📢 ${playAd.advertiserAds} ad · ` : ''}
                {playAd.variations && playAd.variations > 1 ? `📑 ${playAd.variations} biến thể · ` : ''}
                {playAd.likes ? `❤️ ${fmtK(playAd.likes)} · ` : ''}
                {playAd.ctr ? `CTR ${playAd.ctr} · ` : ''}
                {playAd.cta ? `🔘 ${playAd.cta} · ` : ''}
                {playAd.platforms && playAd.platforms.length ? `${playAd.platforms.join('/')} · ` : ''}
                {playAd.country}
              </p>
              {playAd.text && <p className="mb-3 whitespace-pre-line rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">{playAd.text}</p>}

              {!readResult && !readBusy && (
                <button onClick={() => void readAd()} className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
                  <Sparkles className="h-4 w-4" /> 🇻🇳 Đọc ad (dịch VO + bóc kịch bản)
                </button>
              )}
              {readBusy && <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50 p-4 text-center text-xs text-violet-600">🤖 AI đang xem & dịch ad… (~15–40 giây)</div>}
              {readErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{readErr}</p>}
              {readResult && (
                <div className="flex flex-col gap-3">
                  {[
                    { icon: '💬', label: 'Voice / chữ (dịch VN)', text: readResult.transcript },
                    { icon: '🎬', label: 'Cấu trúc & cắt ghép', text: readResult.structure },
                  ].map((b) => (
                    <div key={b.label} className="rounded-xl border border-black/10 bg-slate-50 p-3">
                      <div className="text-xs font-bold text-slate-700">{b.icon} {b.label}</div>
                      <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-slate-600">{b.text}</p>
                    </div>
                  ))}

                  {/* ✍️ Bê kịch bản về SP của mình */}
                  <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-violet-700"><PenLine className="h-3.5 w-3.5" /> Bê kịch bản về SP của mình</div>
                    <div className="flex flex-col gap-1.5">
                      <select value={adaptProductId} onChange={(e) => { setAdaptProductId(e.target.value); if (e.target.value) setAdaptName('') }}
                        className="rounded-lg border border-black/10 bg-white px-2 py-1 text-[11px]">
                        <option value="">— Chọn SP từ Kho —</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.productName}</option>)}
                      </select>
                      {!adaptProductId && (
                        <input value={adaptName} onChange={(e) => setAdaptName(e.target.value)} placeholder="…hoặc gõ tên SP của mình"
                          className="rounded-lg border border-black/10 bg-white px-2 py-1 text-[11px]" />
                      )}
                      <button onClick={() => void adaptScript()} disabled={adaptBusy}
                        className="rounded-lg bg-violet-600 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
                        {adaptBusy ? 'AI đang viết…' : '✍️ Viết kịch bản cho SP này'}
                      </button>
                      {adaptErr && <p className="text-[11px] text-red-600">{adaptErr}</p>}
                    </div>
                    {adaptResult && (
                      <div className="mt-2 flex flex-col gap-2">
                        {[
                          { label: '🪝 Hook', text: adaptResult.hook },
                          { label: '🎙 Lời voice (MY // VN)', text: adaptResult.script },
                          { label: '🎬 Cảnh quay', text: adaptResult.shots },
                          { label: '📝 Caption FB', text: adaptResult.caption },
                        ].map((b) => (
                          <div key={b.label} className="rounded-lg bg-white p-2">
                            <div className="text-[11px] font-bold text-slate-700">{b.label}</div>
                            <p className="mt-0.5 whitespace-pre-line text-[11px] leading-relaxed text-slate-600">{b.text}</p>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <button onClick={() => { navigator.clipboard?.writeText(`${adaptResult.hook}\n\n${adaptResult.script}\n\n${adaptResult.caption}`); addToast('Đã copy kịch bản', 'success') }}
                            className="flex-1 rounded-lg border border-violet-300 bg-white py-1.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-50">📋 Copy</button>
                          {adaptProductId && (
                            <button onClick={() => { sendToApp({ targetApp: 'ads-content', targetField: 'productId', data: adaptProductId }); addToast('Đã mở Ads Content với SP này', 'success') }}
                              className="flex-1 rounded-lg bg-violet-600 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-700">→ Ads Content</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 🔗 Link đích thật (hiện rõ để bấm/copy) + đọc ladipage nếu là web */}
              {playAd.linkUrl && (() => {
                const dest = cleanLink(playAd.linkUrl)
                const kind = linkKind(dest)
                return (
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5">
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-amber-700">
                        <Link2 className="h-3 w-3" /> Link đích: {kind.emoji} {kind.label}
                      </div>
                      <a href={dest} target="_blank" rel="noopener noreferrer" className="block break-all text-[11px] text-blue-600 underline">{dest}</a>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <button onClick={() => { navigator.clipboard?.writeText(dest); addToast('Đã copy link', 'success') }}
                          className="rounded-md border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100">📋 Copy link</button>
                        {kind.web && !cms && (
                          <button onClick={() => void detectCms(dest)} disabled={cmsBusy}
                            className="rounded-md border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50">
                            {cmsBusy ? 'Đang dò…' : '🔍 Nền tảng trang?'}
                          </button>
                        )}
                        {cms && <span className="rounded-md bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">🧱 {cms}</span>}
                      </div>
                      {!kind.web && <p className="mt-1 text-[10px] text-amber-700/80">Ad này chốt đơn qua {kind.label} — không có ladipage để bóc.</p>}
                    </div>
                    {kind.web && !ladiResult && (
                      <button onClick={() => void readLadipage()} disabled={ladiBusy}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50">
                        <FileText className="h-3.5 w-3.5" /> {ladiBusy ? 'Đang đọc trang…' : '📄 Đọc Ladipage đối thủ (AI)'}
                      </button>
                    )}
                    {ladiErr && <p className="text-[11px] text-red-600">{ladiErr}</p>}
                    {ladiResult && (
                      <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <div className="text-xs font-bold text-amber-700">📄 Ladipage đối thủ</div>
                        {[
                          { label: 'Headline', text: ladiResult.headline },
                          { label: 'Ưu đãi', text: ladiResult.offer },
                          { label: 'Cấu trúc trang', text: ladiResult.structure },
                          { label: 'CTA', text: ladiResult.cta },
                          { label: 'Điểm đáng học', text: ladiResult.steal },
                        ].map((b) => (
                          <div key={b.label}>
                            <div className="text-[11px] font-bold text-slate-700">{b.label}</div>
                            <p className="whitespace-pre-line text-[11px] text-slate-600">{b.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              <div className="mt-3 flex flex-wrap gap-2">
                {playAd.pageId && (
                  <button onClick={() => void viewAdvertiser(playAd.pageId, playAd.page)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                    📢 Xem tất cả ad của advertiser này
                  </button>
                )}
                <button onClick={() => downloadOne(playAd)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100">
                  <Download className="h-3.5 w-3.5" /> Tải video
                </button>
                {playAd.libraryUrl && (
                  <a href={playAd.libraryUrl} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-black/10 bg-slate-50 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                    <ExternalLink className="h-3.5 w-3.5" /> Ad Library
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
