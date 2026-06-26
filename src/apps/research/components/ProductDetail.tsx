import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Check, AlertTriangle, XCircle, Plus, Play, TrendingUp, TrendingDown, ExternalLink, Sparkles, Info, Download } from 'lucide-react'
import type { Market, ScoredProduct, SignalResult } from '../types'
import { VERDICT_META, NICHES, MARKETS, MARKET_CURRENCY, NICHE_PRESETS, nicheLabel } from '../constants'
import { useBankStore } from '../../../stores/bankStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { directGeminiText, directGeminiVision } from '../../../utils/gemini'
import { formatMyr } from '../services/pricing'
import { getVideosFor, getCreatorsFor, getCrossMarketFor, analyzeVideo, formatCount, formatKMyr } from '../services/evidence'
import { useResearchStore, type DbVideo, type DbCreator } from '../store'
import { useWatchlistStore } from '../watchlistStore'
import { useAppStore } from '../../../stores/appStore'
import PricingCalculator from './PricingCalculator'

type Tab = 'overview' | 'analysis' | 'video' | 'creator' | 'market' | 'pricing'

// Kết quả AI "đọc" 1 video bán hàng → tiếng Việt (cho seller VN bán ở MY).
interface VideoRead {
  transcript: string   // lời thoại/chữ trên màn hình → dịch VN theo trình tự
  structure: string    // hook → thân → CTA
  angle: string        // góc bán & vì sao viral
  howto: string        // cách bắt chước cho SP của mình
}

// Kết quả AI mổ xẻ SP (live) — vì sao win + khách + góc ads + giá + rủi ro.
interface AiVerdict {
  whyWin: string
  audience: string
  angles: string[]
  priceSuggest: string
  risk: string
}

const KALODATA_CURRENCY: Record<Market, string> = { MY: 'MYR', TH: 'THB', ID: 'IDR', VN: 'VND', PH: 'PHP' }
function kalodataUrl(productId: string, market: Market): string {
  // demo: bỏ hậu tố thị trường (-th/-id/-vn) đã thêm cho data mẫu;
  // data thật: product_id chính là id Kalodata nên link trỏ đúng sản phẩm.
  const id = productId.replace(/-(th|id|vn)$/i, '')
  // URL Kalodata cập nhật 2026-06: PHẢI có dateRange + cateValue, không trang trống.
  // dateRange 90 ngày để bắt được cả sản phẩm peak sớm hơn (30 ngày quá hẹp gây "Không có kết quả").
  const end = new Date(); const start = new Date(end.getTime() - 90 * 86400000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const dateRange = encodeURIComponent(JSON.stringify([fmt(start), fmt(end)]))
  const cateValue = encodeURIComponent('[]')
  return `https://www.kalodata.com/product/detail?id=${encodeURIComponent(id)}&language=vi-VN&currency=${KALODATA_CURRENCY[market]}&region=${market}&dateRange=${dateRange}&cateValue=${cateValue}`
}

// TikTok blockquote-embed (CHÍNH THỨC). Re-inject embed.js mỗi lần videoId đổi
// để force script rescan DOM. Sau 5s nếu chưa có iframe → fallback "Mở TikTok".
function TikTokEmbedPlayer({ videoId, handle }: { videoId: string; handle?: string }) {
  const [failed, setFailed] = useState(false)
  const cite = handle
    ? `https://www.tiktok.com/@${handle}/video/${videoId}`
    : `https://www.tiktok.com/embed/v2/${videoId}`
  useEffect(() => {
    setFailed(false)
    // 1) Xóa script cũ để force fresh load
    document.querySelectorAll('script[src*="tiktok.com/embed.js"]').forEach((s) => s.remove())
    // 2) Inject lại
    const script = document.createElement('script')
    script.src = 'https://www.tiktok.com/embed.js'
    script.async = true
    document.body.appendChild(script)
    // 3) Timeout: sau 5s nếu blockquote chưa được thay bằng iframe → coi là fail
    const timer = window.setTimeout(() => {
      const bq = document.querySelector(`blockquote.tiktok-embed[data-video-id="${videoId}"]`) as HTMLElement | null
      if (bq && !bq.querySelector('iframe')) setFailed(true)
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [videoId])

  if (failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center">
        <Play className="h-12 w-12 text-slate-300" />
        <p className="text-sm text-slate-500">
          TikTok không cho phép xem video này trong app.<br/>
          Bấm nút bên dưới để xem trong tab mới.
        </p>
        <a
          href={cite}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          <ExternalLink className="h-4 w-4" /> Mở trên TikTok
        </a>
      </div>
    )
  }
  return (
    <div className="flex h-full w-full items-center justify-center overflow-auto p-2">
      <blockquote
        className="tiktok-embed"
        cite={cite}
        data-video-id={videoId}
        style={{ maxWidth: 605, minWidth: 325 }}
      >
        <section />
      </blockquote>
    </div>
  )
}

// Trích token cốt lõi từ tên SP (brand + danh từ chính) để lọc video ĐÚNG SP, bỏ news/drift.
// Bỏ bracket + từ marketing + đơn vị; token[0] ~ brand → server chấm trọng số cao nhất.
const TERM_STOP = new Set([
  'new', 'promo', 'sale', 'hot', 'big', 'free', 'buy', 'beli', 'murah', 'viral', 'original', 'ori', 'ready', 'stock',
  'pek', 'pcs', 'pc', 'pack', 'set', 'box', 'botol', 'bottle', 'tablet', 'tablets', 'kapsul', 'capsule', 'gummies', 'sachet',
  'untuk', 'dengan', 'dan', 'yang', 'the', 'for', 'and', 'plus', 'best', 'seller', 'halal', 'tiktok', 'shop', 'exclusive',
  'combo', 'bundle', 'isi', 'satu', 'dua', 'ml', 'gm', 'gram', 'mg', 'kg', 'official', 'store',
])
function coreTerms(title: string): string[] {
  const cleaned = title
    .replace(/【[^】]*】/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^A-Za-z0-9À-ɏ ]+/g, ' ')
  const out: string[] = []
  for (const raw of cleaned.split(/\s+/)) {
    const low = raw.trim().toLowerCase()
    if (low.length < 3 || TERM_STOP.has(low) || /^\d+$/.test(low) || out.includes(low)) continue
    out.push(low)
    if (out.length >= 6) break
  }
  return out
}

const STATUS_ICON: Record<SignalResult['status'], React.ReactNode> = {
  pass: <Check className="h-4 w-4 text-emerald-500" />,
  warn: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  fail: <XCircle className="h-4 w-4 text-red-400" />,
}

function Sparkline({ data }: { data?: number[] }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data), min = Math.min(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - ((v - min) / range) * 28}`).join(' ')
  return (
    <svg viewBox="0 0 100 30" className="h-12 w-full" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="#10b981" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export default function ProductDetail({ product, onClose }: { product: ScoredProduct; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('overview')
  const [analyzeId, setAnalyzeId] = useState<string | null>(null)
  const [embedVideo, setEmbedVideo] = useState<{ id: string; handle?: string } | null>(null)
  const [playVid, setPlayVid] = useState<LiveVid | null>(null)   // video đang xem trong popup
  const [readBusy, setReadBusy] = useState(false)
  const [readErr, setReadErr] = useState<string | null>(null)
  const [readResult, setReadResult] = useState<VideoRead | null>(null)
  const v = VERDICT_META[product.verdict]
  const niche = NICHES.find((n) => n.key === product.nicheKey)
  const passCount = product.signals.filter((s) => s.status === 'pass').length

  const realVideos = useResearchStore((s) => s.realVideos)
  const realCreators = useResearchStore((s) => s.realCreators)
  const getVideosForProduct = useResearchStore((s) => s.getVideosForProduct)
  const getCreatorsForProduct = useResearchStore((s) => s.getCreatorsForProduct)
  const isLive = useResearchStore((s) => s.isLive)
  const sendToApp = useAppStore((s) => s.sendToApp)
  const addToast = useAppStore((s) => s.addToast)
  const addProduct = useBankStore((s) => s.addProduct)
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const [aiBusy, setAiBusy] = useState(false)
  const [bankProductId, setBankProductId] = useState<string | null>(null)
  const addWatch = useWatchlistStore((s) => s.add)
  const inWatch = useWatchlistStore((s) => s.items.some((i) => i.productId === product.productId))
  const [verdict, setVerdict] = useState<AiVerdict | null>(null)
  const [verdictBusy, setVerdictBusy] = useState(false)
  const [verdictErr, setVerdictErr] = useState<string | null>(null)

  // LIVE: video BÁN thật của SP (ScrapeCreators keyword search) — chỉ khi quét live
  interface LiveVid { id: string; desc: string; author: string; nickname: string; views: number; cover: string; downloadUrl: string; url: string; durationSec: number }
  const MIN_SEC = 20   // >20s: đủ dài cho FB ads
  const MAX_SEC = 90   // ≤90s: bỏ vlog/news quá dài
  const [liveVideos, setLiveVideos] = useState<LiveVid[] | null>(null)
  const [liveVidLoading, setLiveVidLoading] = useState(false)
  const [liveCursor, setLiveCursor] = useState<string | null>(null)
  const [liveHasMore, setLiveHasMore] = useState(false)
  const [liveMoreLoading, setLiveMoreLoading] = useState(false)
  const liveFetchedFor = useRef<string | null>(null)

  // Tên SP trước dấu phân tách (| - [ ( ) → tìm video ĐÚNG SP hơn, không chung chung.
  const liveQuery = useMemo(
    () => (product.title.split(/[|\-–—[\](]/)[0] || product.title).trim().split(/\s+/).slice(0, 8).join(' '),
    [product.title],
  )
  // Token cốt lõi của SP → server lọc video phải chứa (bỏ news/drift sang SP khác).
  const liveTerms = useMemo(() => coreTerms(product.title), [product.title])
  const termsParam = useMemo(() => encodeURIComponent(liveTerms.join(',')), [liveTerms])

  const loadMoreVideos = useCallback(async () => {
    if (!liveCursor || liveMoreLoading) return
    setLiveMoreLoading(true)
    try {
      const d = await fetch(`/api/research-videos?market=${product.market}&q=${encodeURIComponent(liveQuery)}&minSec=${MIN_SEC}&maxSec=${MAX_SEC}&terms=${termsParam}&cursor=${encodeURIComponent(liveCursor)}`).then((r) => r.json())
      const more: LiveVid[] = Array.isArray(d.videos) ? d.videos : []
      setLiveVideos((prev) => {
        const seen = new Set((prev || []).map((v) => v.id))
        return [...(prev || []), ...more.filter((v) => !seen.has(v.id))].sort((a, b) => b.durationSec - a.durationSec)
      })
      setLiveCursor(d.cursor != null ? String(d.cursor) : null)
      setLiveHasMore(!!d.hasMore && d.cursor != null)
    } catch { /* bỏ qua */ } finally {
      setLiveMoreLoading(false)
    }
  }, [liveCursor, liveMoreLoading, product.market, liveQuery, termsParam])

  useEffect(() => {
    if (!isLive || (tab !== 'video' && tab !== 'creator')) return
    if (liveFetchedFor.current === product.productId) return
    liveFetchedFor.current = product.productId
    let cancelled = false
    setLiveVidLoading(true); setLiveVideos(null); setLiveCursor(null); setLiveHasMore(false)
    fetch(`/api/research-videos?market=${product.market}&q=${encodeURIComponent(liveQuery)}&minSec=${MIN_SEC}&maxSec=${MAX_SEC}&terms=${termsParam}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        setLiveVideos(Array.isArray(d.videos) ? d.videos : [])
        setLiveCursor(d.cursor != null ? String(d.cursor) : null)
        setLiveHasMore(!!d.hasMore && d.cursor != null)
      })
      .catch(() => { if (!cancelled) setLiveVideos([]) })
      .finally(() => { if (!cancelled) setLiveVidLoading(false) })
    return () => { cancelled = true }
  }, [isLive, tab, product.productId, product.market, liveQuery, termsParam])

  // Creator (live) = tác giả của các video đang BÁN sản phẩm → người đang đẩy SP
  const liveCreators = useMemo(() => {
    if (!liveVideos) return []
    const m = new Map<string, { author: string; videos: number; views: number }>()
    for (const v of liveVideos) {
      if (!v.author) continue
      const e = m.get(v.author) || { author: v.author, videos: 0, views: 0 }
      e.videos += 1; e.views += v.views
      m.set(v.author, e)
    }
    return [...m.values()].sort((a, b) => b.views - a.views)
  }, [liveVideos])

  // Video: nếu DB ĐÃ hydrate (kể cả empty), CHỈ dùng real — không lừa anh bằng sample.
  const videos = useMemo(() => {
    if (realVideos !== null) {
      const real = getVideosForProduct(product.productId, product.nicheKey, product.market)
      return real.map((v: DbVideo) => ({
        id: v.videoId, caption: v.description.slice(0, 80) || '(video)', handle: v.handle ? '@' + v.handle : '@unknown',
        views: v.views, gmv: v.gmv, adRoas: v.adRoas || 1, durationSec: v.duration,
      }))
    }
    return getVideosFor(product) // chỉ khi DB chưa hydrate (offline / chưa tạo bảng)
  }, [product, realVideos, getVideosForProduct])

  // Creator: tương tự — DB hydrate → chỉ dùng real, kể cả trống.
  const creators = useMemo(() => {
    if (realCreators !== null) {
      const real = getCreatorsForProduct(product.productId, product.nicheKey, product.market)
      return real.map((c: DbCreator) => ({
        id: c.creatorId, handle: '@' + c.handle, nickname: c.nickname || c.handle,
        followers: c.followers, gmv: c.gmv,
        engagementPct: Math.round((c.engagementPct || 0) * 10) / 10,
      }))
    }
    return getCreatorsFor(product)
  }, [product, realCreators, getCreatorsForProduct])

  const crossMarket = useMemo(() => getCrossMarketFor(product), [product])

  const cur = MARKET_CURRENCY[product.market] ?? ''
  const marketLabel = MARKETS.find((m) => m.key === product.market)?.label ?? product.market
  // Ngách hiển thị: ưu tiên nhãn user đã pick lúc quét (scanNiche) thay vì classify từ tên (hay ra 'other').
  const nicheText = product.scanNiche || nicheLabel(product.nicheKey)
  const nicheEmoji = NICHE_PRESETS.find((n) => n.label === product.scanNiche)?.emoji ?? niche?.emoji ?? '📦'

  // AI đọc SP research → suy luận → điền ĐẦY ĐỦ field → tạo SP THẬT vào Bank, trả id thật.
  // Dedup trong phiên: tạo 1 lần, các nút sau tái dùng id (không tạo trùng).
  const ensureInBank = async (): Promise<string | null> => {
    if (bankProductId) return bankProductId
    if (!geminiApiKey) { addToast('Cần Gemini API key trong Cài đặt để AI điền', 'error'); return null }
    const prompt = `Bạn là chuyên gia nghiên cứu sản phẩm COD/affiliate. Đọc 1 sản phẩm đang bán chạy trên TikTok Shop và SUY LUẬN viết hồ sơ ĐẦY ĐỦ bằng TIẾNG VIỆT để tạo content quảng cáo + landing page.
SẢN PHẨM:
- Tên gốc: ${product.title}
- Ngách: ${nicheText}
- Thị trường: ${marketLabel}
- Giá: ${cur} ${product.unitPrice} · Đã bán: ${product.sale} · Đánh giá: ${product.rating || '—'}
Trả JSON đúng khóa (tiếng Việt, cụ thể, KHÔNG bịa chứng nhận y tế/giấy phép):
{"productName":"tên gọn rõ","productDescription":"2-3 câu SP là gì, cho ai","painPoints":"nỗi đau khách, mỗi ý 1 dòng","usps":"điểm độc nhất, mỗi ý 1 dòng","benefits":"lợi ích chính, mỗi ý 1 dòng","offer":"gợi ý ưu đãi/combo (vd mua 2 tặng 1, freeship COD)","ingredients":"thành phần/chất liệu nếu suy luận được, không thì 'Cập nhật từ NCC'","usageGuide":"cách dùng gợi ý"}
Suy luận hợp lý từ tên + ngách. CHỈ trả JSON.`
    const raw = await directGeminiText({ apiKey: geminiApiKey, prompt, responseMimeType: 'application/json', temperature: 0.5 })
    const d = JSON.parse(raw) as Record<string, string>
    const created = await addProduct({
      productName: d.productName || product.title,
      productDescription: d.productDescription || '',
      targetMarket: marketLabel,
      painPoints: d.painPoints || '',
      usps: d.usps || '',
      benefits: d.benefits || '',
      offer: d.offer || '',
      ingredients: d.ingredients || '',
      usageGuide: d.usageGuide || '',
      productImage: product.imageUrl || '',
      productImages: product.imageUrl ? [product.imageUrl] : [],
    })
    if (!created) return null   // addProduct đã toast lỗi (vd chưa đăng nhập)
    setBankProductId(created.id)
    return created.id
  }

  // Cross-market arbitrage: SP đang win ở nước khác → AI viết hồ sơ BÁN TẠI MALAYSIA (bản địa hóa).
  const aiBringToMY = async () => {
    if (product.market === 'MY') return
    if (!geminiApiKey) { addToast('Cần Gemini API key trong Cài đặt', 'error'); return }
    setAiBusy(true)
    try {
      const prompt = `Bạn là chuyên gia COD đem SP win từ nước khác về MALAYSIA bán. SP này đang BÁN CHẠY ở ${marketLabel} trên TikTok Shop — hãy viết hồ sơ ĐẦY ĐỦ bằng TIẾNG VIỆT để BÁN TẠI MALAYSIA, BẢN ĐỊA HÓA theo văn hóa/khẩu vị/ngôn ngữ Malaysia (KHÔNG bê nguyên si nước nguồn, KHÔNG bịa chứng nhận).
SẢN PHẨM (nguồn ${marketLabel}):
- Tên gốc: ${product.title}
- Ngách: ${nicheText}
- Giá nguồn: ${cur} ${product.unitPrice} · Đã bán: ${product.sale}
Trả JSON đúng khóa: {"productName":"tên cho thị trường MY","productDescription":"2-3 câu","painPoints":"nỗi đau khách MY, mỗi ý 1 dòng","usps":"điểm độc nhất, mỗi ý 1 dòng","benefits":"lợi ích, mỗi ý 1 dòng","offer":"ưu đãi/combo hợp MY (RM, COD)","ingredients":"thành phần/chất liệu hoặc 'Cập nhật từ NCC'","usageGuide":"cách dùng"}
CHỈ trả JSON.`
      const raw = await directGeminiText({ apiKey: geminiApiKey, prompt, responseMimeType: 'application/json', temperature: 0.6 })
      const d = JSON.parse(raw) as Record<string, string>
      const created = await addProduct({
        productName: d.productName || product.title,
        productDescription: d.productDescription || '',
        targetMarket: 'Malaysia',
        painPoints: d.painPoints || '', usps: d.usps || '', benefits: d.benefits || '',
        offer: d.offer || '', ingredients: d.ingredients || '', usageGuide: d.usageGuide || '',
        productImage: product.imageUrl || '',
        productImages: product.imageUrl ? [product.imageUrl] : [],
      })
      if (!created) return
      addToast(`✅ Đã đem SP từ ${marketLabel} về MY (AI bản địa hóa) → vào Bank`, 'success')
      sendToApp({ targetApp: 'finder', targetField: 'activeBank', data: 'products' })
    } catch (e) {
      addToast('AI lỗi: ' + ((e as Error).message || '').slice(0, 70), 'error')
    } finally {
      setAiBusy(false)
    }
  }

  // 1 chạm: tạo SP THẬT vào Bank (nếu chưa) → mở app đích bằng productId THẬT (generate chạy được).
  const aiFillAndGo = async (target?: { app: string; label: string }) => {
    setAiBusy(true)
    try {
      const id = await ensureInBank()
      if (!id) return
      if (target) {
        sendToApp({ targetApp: target.app, targetField: 'productId', data: id })
        addToast(`✅ Đã tạo SP + mở ${target.label}`, 'success')
      } else {
        addToast('✅ AI đã tạo SP vào Bank (điền đủ). Vào Thư viện → tải thêm 3 ảnh để dùng app ảnh.', 'success')
        sendToApp({ targetApp: 'finder', targetField: 'activeBank', data: 'products' })
      }
    } catch (e) {
      addToast('AI lỗi: ' + ((e as Error).message || '').slice(0, 70), 'error')
    } finally {
      setAiBusy(false)
    }
  }
  // AI mổ xẻ SP win: vì sao win / khách MY / 3 góc ads / giá đề xuất / rủi ro.
  const aiAnalyze = async () => {
    if (!geminiApiKey) { setVerdictErr('Cần Gemini API key trong Cài đặt'); return }
    setVerdictBusy(true); setVerdictErr(null)
    try {
      const prompt = `Bạn là chuyên gia bán hàng COD/affiliate đưa SP win từ ${marketLabel} về MALAYSIA bán. Đọc SP đang bán chạy trên TikTok Shop và phân tích sắc bén bằng TIẾNG VIỆT.
SẢN PHẨM:
- Tên: ${product.title}
- Ngách: ${nicheText}
- Thị trường nguồn: ${marketLabel}
- Giá: ${cur} ${product.unitPrice} · Đã bán: ${product.sale} · Đánh giá: ${product.rating || '—'}
Trả JSON đúng khóa:
{"whyWin":"2-3 câu vì sao SP này win (nhu cầu, tâm lý mua, tính viral)","audience":"chân dung khách MUA ở Malaysia: tuổi/giới/nỗi đau cụ thể","angles":["góc ads 1 (1 câu)","góc ads 2","góc ads 3"],"priceSuggest":"gợi ý giá bán + combo ở Malaysia (RM), suy luận từ giá nguồn","risk":"rủi ro chính khi bán (cạnh tranh, hoàn, kiểm duyệt) + cách né, 1-2 câu"}
Cụ thể, thực chiến, KHÔNG bịa chứng nhận. CHỈ trả JSON.`
      const raw = await directGeminiText({ apiKey: geminiApiKey, prompt, responseMimeType: 'application/json', temperature: 0.6 })
      const d = JSON.parse(raw) as Partial<AiVerdict>
      setVerdict({
        whyWin: d.whyWin || '—',
        audience: d.audience || '—',
        angles: Array.isArray(d.angles) ? d.angles : [],
        priceSuggest: d.priceSuggest || '—',
        risk: d.risk || '—',
      })
    } catch (e) {
      setVerdictErr('AI lỗi: ' + ((e as Error).message || '').slice(0, 70))
    } finally {
      setVerdictBusy(false)
    }
  }

  // ── "Đọc video": Gemini xem MP4 → kịch bản + dịch VN + mổ xẻ góc bán (cho seller VN bán MY) ──
  const closeVid = () => { setPlayVid(null); setReadResult(null); setReadErr(null); setReadBusy(false) }
  const readVideo = async () => {
    if (!playVid) return
    if (!geminiApiKey) { setReadErr('Cần Gemini API key trong Cài đặt'); return }
    setReadBusy(true); setReadErr(null); setReadResult(null)
    try {
      // 1) Server tải video (né CORS) + upload lên Gemini Files API → fileUri.
      const up = await fetch('/api/gemini-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: playVid.downloadUrl, apiKey: geminiApiKey }),
      }).then((r) => r.json())
      if (up.error || !up.fileUri) throw new Error(up.error || 'tải/upload video thất bại')

      // 2) Chờ Gemini xử lý video (PROCESSING → ACTIVE), poll client-side (né timeout Vercel).
      let state: string = up.state
      let uri: string = up.fileUri
      let mime: string = up.mimeType || 'video/mp4'
      const fileName: string = up.fileName
      const t0 = Date.now()
      while (state !== 'ACTIVE' && Date.now() - t0 < 90000) {
        await new Promise((r) => setTimeout(r, 3000))
        const st = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${geminiApiKey}`)
          .then((r) => r.json()).catch(() => null)
        if (st?.state) { state = st.state; uri = st.uri || uri; mime = st.mimeType || mime }
        if (state === 'FAILED') throw new Error('Gemini xử lý video thất bại (format không hỗ trợ?)')
      }
      if (state !== 'ACTIVE') throw new Error('Gemini xử lý video quá lâu — thử lại')

      // 3) Gemini "xem" video → kịch bản + dịch + góc bán (tiếng Việt).
      const prompt = `Bạn đang xem 1 video TikTok BÁN HÀNG ở Malaysia (tiếng Malay/English). Người đọc là seller Việt Nam muốn HỌC cách họ bán. Trả JSON tiếng Việt:
{"transcript":"toàn bộ lời thoại + chữ trên màn hình, DỊCH sang tiếng Việt theo trình tự, tự nhiên dễ hiểu","structure":"cấu trúc video: hook mở đầu → thân (chứng minh/cảm xúc) → CTA, mỗi ý 1 dòng","angle":"góc bán chính & vì sao video này chốt/viral","howto":"cách bắt chước cho sản phẩm của mình, mỗi ý 1 dòng cụ thể"}
Mô tả gốc của video: ${playVid.desc}
Nếu video không có lời thoại thì đọc chữ trên màn hình + hình ảnh. CHỈ trả JSON.`
      const raw = await directGeminiVision({ apiKey: geminiApiKey, parts: [{ fileData: { mimeType: mime, fileUri: uri } }, { text: prompt }], responseMimeType: 'application/json', temperature: 0.4, maxOutputTokens: 4096 })
      setReadResult(JSON.parse(raw) as VideoRead)
    } catch (e) {
      setReadErr('Đọc video lỗi: ' + ((e as Error).message || '').slice(0, 140))
    } finally {
      setReadBusy(false)
    }
  }

  const compactCur = (n: number) => n >= 1000 ? `${cur} ${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : `${cur} ${n.toLocaleString('vi-VN')}`
  const metrics: { label: string; value: string }[] = isLive
    ? [
        { label: 'Đã bán', value: product.sale.toLocaleString('vi-VN') },
        { label: 'Doanh thu ~', value: compactCur(product.revenue) },
        { label: 'Đơn giá', value: `${cur} ${product.unitPrice.toLocaleString('vi-VN')}` },
        { label: 'Đánh giá', value: product.rating ? `${product.rating.toFixed(1)}★` : '—' },
        { label: 'Nơi gửi', value: product.shipFrom || '—' },
        { label: 'Thị trường', value: product.market },
      ]
    : [
        { label: 'Doanh thu', value: formatKMyr(product.revenue) },
        { label: 'Lượt bán', value: `${product.sale} đơn` },
        { label: 'Đơn giá', value: `RM${product.unitPrice}` },
        { label: 'DT từ video', value: formatKMyr(product.videoRevenue ?? 0) },
        { label: 'Hoa hồng', value: `${Math.round(product.commissionRate)}%` },
        { label: 'Số creator', value: `${product.creatorNum}` },
        { label: 'Số shop bán', value: `${product.competitionShops}` },
        { label: 'Đánh giá', value: `${product.rating.toFixed(1)}★` },
      ]

  const TABS: [Tab, string][] = isLive
    ? [['overview', 'Tổng quan'], ['analysis', '🧠 Phân tích AI'], ['video', 'Video win'], ['creator', 'Creator'], ['pricing', 'Giá']]
    : [['overview', 'Tổng quan'], ['video', 'Video win'], ['creator', 'Creator'], ['market', 'Thị trường'], ['pricing', 'Giá']]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-black/10 p-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-2xl">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.title} className="h-full w-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
            ) : (
              <span>{nicheEmoji}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold leading-snug text-slate-800">{product.title}</h2>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">⭐ {product.score}/100</span>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${v.bg} ${v.color}`}>{v.emoji} {v.label}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              {isLive ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                  {MARKETS.find((m) => m.key === product.market)?.flag} {MARKETS.find((m) => m.key === product.market)?.label} · TikTok Shop
                </span>
              ) : (
                <>
                  <a
                    href={kalodataUrl(product.productId, product.market)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:underline"
                    title="Nếu trang Kalodata trống → sản phẩm này hết data trong 90 ngày gần nhất (vấn đề từ Kalodata, không phải bug app)"
                  >
                    <ExternalLink className="h-3 w-3" /> Xem trên Kalodata
                  </a>
                  <a
                    href={`https://www.kalodata.com/product?searchKey=${encodeURIComponent(product.title.slice(0, 40))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:underline"
                    title="Tìm sản phẩm theo tên (fallback)"
                  >
                    Tìm theo tên
                  </a>
                </>
              )}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-black/5"><X className="h-5 w-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-black/10 px-3">
          {TABS.map(([k, label]) => (
            <button
              key={k} onClick={() => setTab(k)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === k ? 'border-violet-500 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* ── TỔNG QUAN ── */}
          {tab === 'overview' && (
            <div className="flex flex-col gap-4">
              {isLive ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-700">💰 Doanh thu ước tính</span>
                    <span className="text-base font-bold text-emerald-700">{compactCur(product.revenue)}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-emerald-600/80">
                    {product.sale.toLocaleString('vi-VN')} đã bán × {cur} {product.unitPrice.toLocaleString('vi-VN')} (số tích lũy).
                    {product.isTracked && product.growthRate > 0 && <span className="font-bold"> · 📈 +{product.growthRate}%/ngày (so mốc trước)</span>}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-black/10 bg-slate-50 p-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>Xu hướng doanh thu</span>
                    <span className="font-semibold text-slate-700">{formatKMyr(product.revenue)} · {product.sale} đơn</span>
                  </div>
                  <Sparkline data={product.revenueTrend} />
                </div>
              )}

              <div className={`grid ${isLive ? 'grid-cols-3' : 'grid-cols-4'} gap-2`}>
                {metrics.map((m) => (
                  <div key={m.label} className="rounded-lg border border-black/10 bg-white p-2 text-center">
                    <div className="text-sm font-bold text-slate-800">{m.value}</div>
                    <div className="text-[10px] text-slate-400">{m.label}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700">Go / No-Go</h3>
                  <span className="text-xs font-semibold text-slate-500">{passCount}/{product.signals.length} tiêu chí đạt</span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {product.signals.map((s) => (
                    <li key={s.key} className="flex items-start gap-2 rounded-lg border border-black/10 px-3 py-2">
                      <span className="mt-0.5">{STATUS_ICON[s.status]}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700">{s.label}</span>
                          <span className="text-xs font-bold text-slate-600">{s.display}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">{s.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => { if (!inWatch) void addWatch(product) }}
                disabled={inWatch}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  inWatch
                    ? 'cursor-default border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'bg-violet-600 text-white hover:bg-violet-700'
                }`}
              >
                {inWatch ? <><Check className="h-4 w-4" /> Đã trong Danh sách Test</> : <><Plus className="h-4 w-4" /> Đưa vào danh sách Test</>}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => void aiFillAndGo({ app: 'ads-content', label: 'Ads Content' })}
                  disabled={aiBusy}
                  className="flex items-center justify-center gap-2 rounded-xl border border-violet-300 bg-white py-2.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" /> AI điền + Viết content
                </button>
                <button
                  onClick={() => void aiFillAndGo({ app: 'super-ladipage', label: 'Dựng Ladi' })}
                  disabled={aiBusy}
                  className="flex items-center justify-center gap-2 rounded-xl border border-violet-300 bg-white py-2.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" /> AI điền + Dựng Ladi
                </button>
              </div>
              <button
                onClick={() => void aiFillAndGo()}
                disabled={aiBusy}
                className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
              >
                {aiBusy ? '🤖 AI đang xử lý…' : bankProductId ? '✓ Đã tạo trong Bank — mở lại Thư viện' : '🤖 AI điền đủ → Tạo SP vào Bank'}
              </button>
              <p className="text-center text-[10px] text-slate-400">AI đọc SP → điền đủ field → tạo SP thật vào Bank. Ảnh: tự tải 4 ảnh sạch ở Thư viện để dùng app ảnh.</p>
              {product.market !== 'MY' && (
                <button
                  onClick={() => void aiBringToMY()}
                  disabled={aiBusy}
                  className="flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 py-2.5 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
                >
                  🇲🇾 {aiBusy ? 'Đang xử lý…' : `Đem SP từ ${marketLabel} về MY bán (AI bản địa hóa)`}
                </button>
              )}
            </div>
          )}

          {/* ── PHÂN TÍCH AI (live) ── */}
          {tab === 'analysis' && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-500">🧠 AI đọc SP win ở <b>{marketLabel}</b> → mổ xẻ vì sao win, khách Malaysia, góc ads, giá đề xuất, rủi ro.</p>
              {!verdict && (
                <button
                  onClick={() => void aiAnalyze()}
                  disabled={verdictBusy}
                  className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" /> {verdictBusy ? 'AI đang phân tích…' : 'Phân tích SP này'}
                </button>
              )}
              {verdictErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{verdictErr}</p>}
              {verdict && (
                <div className="flex flex-col gap-3">
                  {[
                    { icon: '🏆', label: 'Vì sao win', text: verdict.whyWin },
                    { icon: '🎯', label: 'Khách Malaysia', text: verdict.audience },
                    { icon: '💵', label: 'Giá & combo đề xuất (MY)', text: verdict.priceSuggest },
                    { icon: '⚠️', label: 'Rủi ro & cách né', text: verdict.risk },
                  ].map((b) => (
                    <div key={b.label} className="rounded-xl border border-black/10 bg-slate-50 p-3">
                      <div className="text-xs font-bold text-slate-700">{b.icon} {b.label}</div>
                      <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-slate-600">{b.text}</p>
                    </div>
                  ))}
                  {verdict.angles.length > 0 && (
                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                      <div className="text-xs font-bold text-violet-700">🎬 3 góc ads gợi ý</div>
                      <ul className="mt-1.5 flex flex-col gap-1.5">
                        {verdict.angles.map((a, i) => (
                          <li key={i} className="flex gap-2 text-[11px] leading-relaxed text-slate-700">
                            <span className="font-bold text-violet-500">{i + 1}.</span><span>{a}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => void aiAnalyze()}
                      disabled={verdictBusy}
                      className="rounded-xl border border-violet-300 bg-white py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                    >
                      {verdictBusy ? 'Đang…' : '↻ Phân tích lại'}
                    </button>
                    <button
                      onClick={() => void aiFillAndGo({ app: 'ads-content', label: 'Ads Content' })}
                      disabled={aiBusy}
                      className="rounded-xl bg-violet-600 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      AI điền + Viết content
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── VIDEO WIN (LIVE — TikTok Shop thật) ── */}
          {tab === 'video' && isLive && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-500">🎥 Video <b>liên quan SP này</b> (lọc theo brand/từ khóa cốt lõi → bỏ news/drift), <b>20–90s</b> hợp <b>FB ads</b>. Bấm <b>⬇ Tải</b> lấy video không logo.</p>
              {liveVidLoading && (
                <div className="rounded-xl border border-dashed border-black/10 p-6 text-center text-xs text-slate-400">Đang tìm video liên quan…</div>
              )}
              {!liveVidLoading && liveVideos && liveVideos.length === 0 && (
                <div className="rounded-xl border border-dashed border-black/10 p-4 text-center text-xs text-slate-400">
                  Chưa thấy video liên quan SP này (20–90s).<br/>Bấm <b>Tải thêm</b> để quét tiếp, hoặc đổi từ khóa.
                  {liveHasMore && (
                    <button onClick={() => void loadMoreVideos()} disabled={liveMoreLoading}
                      className="mt-3 block w-full rounded-lg border border-violet-300 bg-white py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50">
                      {liveMoreLoading ? 'Đang tải…' : '↻ Tải thêm video'}
                    </button>
                  )}
                </div>
              )}
              {liveVideos && liveVideos.map((vid) => (
                <div key={vid.id} className="rounded-xl border border-black/10 p-2.5">
                  <div className="flex gap-3">
                    <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-200">
                      {vid.cover
                        ? <img src={vid.cover} alt="" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                        : <Play className="absolute inset-0 m-auto h-5 w-5 text-slate-500" />}
                      {vid.durationSec ? <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[9px] font-bold text-white">{vid.durationSec}s</span> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-xs font-semibold text-slate-700">{vid.desc || '(video)'}</p>
                      <p className="text-[11px] text-slate-400">@{vid.author}</p>
                      <div className="mt-1 text-[11px] font-medium text-slate-600">👁 {formatCount(vid.views)} view</div>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => { if (vid.downloadUrl) { setReadResult(null); setReadErr(null); setPlayVid(vid) } else if (vid.url) window.open(vid.url, '_blank') }}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                    >
                      <Play className="h-3.5 w-3.5" /> Xem
                    </button>
                    {vid.downloadUrl && (
                      <a href={vid.downloadUrl} target="_blank" rel="noopener noreferrer"
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100">
                        <Download className="h-3.5 w-3.5" /> Tải
                      </a>
                    )}
                    {vid.url && (
                      <a href={vid.url} target="_blank" rel="noopener noreferrer"
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-black/10 bg-slate-50 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100">
                        <ExternalLink className="h-3.5 w-3.5" /> TikTok
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {liveVideos && liveVideos.length > 0 && liveHasMore && (
                <button onClick={() => void loadMoreVideos()} disabled={liveMoreLoading}
                  className="rounded-xl border border-violet-300 bg-white py-2.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-50">
                  {liveMoreLoading ? 'Đang tải…' : '↻ Tải thêm video'}
                </button>
              )}
              {liveVideos && liveVideos.length > 0 && !liveHasMore && (
                <p className="py-1 text-center text-[11px] text-slate-400">— Hết video liên quan cho từ khóa này —</p>
              )}
            </div>
          )}

          {/* ── VIDEO WIN (Kalodata — data cũ, chỉ khi KHÔNG live) ── */}
          {tab === 'video' && !isLive && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-500">🎥 Video đang bán tốt sản phẩm này (thị trường <b>{product.market}</b>). Bấm <b>▶ Phát video</b> để xem ngay trong app.</p>
              {videos.some((v) => /\.(vn|id|th)\b/i.test(v.handle) || /[ăâđêôơưĐ]/.test(v.caption)) && (
                <div className="flex items-start gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>Một số video tiếng Việt là creator gốc VN làm content cho TikTok Shop {product.market} — đây là DATA THẬT từ Kalodata thị trường {product.market}, KHÔNG phải lẫn data.</span>
                </div>
              )}
              {videos.length === 0 && (
                <div className="rounded-xl border border-dashed border-black/10 p-4 text-center text-xs text-slate-400">
                  Chưa có data video cho thị trường <b>{product.market}</b>.<br/>
                  Vào Kalodata → mục <b>Video & Quảng cáo</b> → bấm <b>"Crawl Full"</b> trên extension.
                </div>
              )}
              {videos.map((vid) => {
                const open = analyzeId === vid.id
                const analysis = open ? analyzeVideo(vid.caption) : null
                const cleanHandle = vid.handle.replace(/^@/, '').trim()
                const looksLikeId = /^\d{15,}$/.test(vid.id)
                const canEmbed = looksLikeId
                return (
                  <div key={vid.id} className="rounded-xl border border-black/10 p-2.5">
                    <div className="flex gap-3">
                      <div className="relative flex h-16 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-200">
                        <Play className="h-5 w-5 text-slate-500" />
                        <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[9px] font-bold text-white">{vid.durationSec}s</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-xs font-semibold text-slate-700">{vid.caption}</p>
                        <p className="text-[11px] text-slate-400">{vid.handle}</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-medium text-slate-600">
                          <span>👁 {formatCount(vid.views)} view</span>
                          <span className="text-emerald-600">{formatMyr(vid.gmv)} GMV</span>
                          <span className="text-violet-600">ROAS {vid.adRoas}x</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex gap-2">
                      {canEmbed ? (
                        <button
                          onClick={() => setEmbedVideo({ id: vid.id, handle: cleanHandle || undefined })}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                        >
                          <Play className="h-3.5 w-3.5" /> Phát video
                        </button>
                      ) : cleanHandle ? (
                        <a
                          href={`https://www.tiktok.com/@${cleanHandle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-black/10 bg-slate-50 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Kênh TikTok
                        </a>
                      ) : null}
                      <button
                        onClick={() => setAnalyzeId(open ? null : vid.id)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> {open ? 'Ẩn AI' : 'Phân tích AI'}
                      </button>
                    </div>

                    {analysis && (
                      <div className="mt-2 flex flex-col gap-2 rounded-lg bg-slate-50 p-3">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-600">
                          <Sparkles className="h-3 w-3" /> AI mổ xẻ video win
                          <span className="ml-auto rounded-full bg-amber-50 px-1.5 text-[10px] font-normal text-amber-600">demo</span>
                        </div>
                        {analysis.sections.map((s) => (
                          <div key={s.label}>
                            <div className="text-[11px] font-bold text-slate-700">{s.label}</div>
                            <div className="text-[11px] text-slate-500">{s.text}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── CREATOR (LIVE — lấy từ tác giả video bán) ── */}
          {tab === 'creator' && isLive && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-500">👤 Creator đang <b>ĐẨY</b> sản phẩm này (lấy từ video bán) — bấm <b>TikTok</b> xem kênh để tuyển.</p>
              {liveVidLoading && <div className="rounded-xl border border-dashed border-black/10 p-6 text-center text-xs text-slate-400">Đang tải…</div>}
              {!liveVidLoading && liveCreators.length === 0 && (
                <div className="rounded-xl border border-dashed border-black/10 p-4 text-center text-xs text-slate-400">Chưa có creator — thử mở tab Video win để quét trước.</div>
              )}
              {liveCreators.map((c) => (
                <div key={c.author} className="flex items-center gap-3 rounded-xl border border-black/10 p-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-pink-400 text-sm font-bold text-white">{c.author.charAt(0).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-700">@{c.author}</p>
                    <div className="mt-0.5 flex gap-3 text-[11px] text-slate-600"><span>{c.videos} video bán</span><span>👁 {formatCount(c.views)} view</span></div>
                  </div>
                  <a href={`https://www.tiktok.com/@${c.author}`} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1 rounded-lg border border-black/10 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-100">
                    <ExternalLink className="h-3 w-3" /> TikTok
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* ── CREATOR (Kalodata — ẩn khi live) ── */}
          {tab === 'creator' && !isLive && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-500">👤 Creator đang đẩy sản phẩm (thị trường <b>{product.market}</b>) — bấm <b>"TikTok"</b> để xem kênh, đánh giá rồi tuyển.</p>
              {creators.some((c) => /[ăâđêôơưĐ]/.test(c.nickname)) && (
                <div className="flex items-start gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>Một số creator tên tiếng Việt là người Việt làm content cho TikTok Shop {product.market} — họ có handle Việt nhưng bán hàng MY. Cơ hội tuyển dễ vì cùng ngôn ngữ.</span>
                </div>
              )}
              {creators.length === 0 && (
                <div className="rounded-xl border border-dashed border-black/10 p-4 text-center text-xs text-slate-400">
                  Chưa có data creator cho thị trường <b>{product.market}</b>.<br/>
                  Vào Kalodata → mục <b>Nhà sáng tạo</b> → bấm <b>"Crawl Full"</b> trên extension.
                </div>
              )}
              {creators.map((c) => {
                const cleanHandle = c.handle.replace(/^@/, '').trim()
                // Handle phải đúng định dạng TikTok (chữ/số/dấu chấm/gạch dưới, ≥2 ký tự).
                const handleOk = /^[A-Za-z0-9._-]{2,}$/.test(cleanHandle)
                const tiktokUrl = handleOk ? `https://www.tiktok.com/@${cleanHandle}` : null
                return (
                  <div key={c.id} className="rounded-xl border border-black/10 p-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-pink-400 text-sm font-bold text-white">
                        {(c.nickname || cleanHandle || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-700">{c.nickname || cleanHandle} <span className="font-normal text-slate-400">{c.handle}</span></p>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] font-medium text-slate-600">
                          <span>{formatCount(c.followers)} follow</span>
                          <span className="text-emerald-600">{formatMyr(c.gmv)} GMV</span>
                          <span>tương tác {c.engagementPct}%</span>
                        </div>
                      </div>
                      {tiktokUrl ? (
                        <a
                          href={tiktokUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex shrink-0 items-center gap-1 rounded-lg border border-black/10 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                          title={`Xem kênh TikTok của ${c.nickname || cleanHandle}`}
                        >
                          <ExternalLink className="h-3 w-3" /> TikTok
                        </a>
                      ) : (
                        <span className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-700" title="Chưa có handle TikTok hợp lệ">
                          Chưa có handle
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── THỊ TRƯỜNG (Kalodata cross-market — ẩn khi live, dùng nút "So 5 nước") ── */}
          {tab === 'market' && !isLive && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-500">🌏 So sánh sản phẩm/ngách giữa các thị trường — bằng chứng cho cơ hội cross-market.</p>
              <div className="overflow-hidden rounded-xl border border-black/10">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Thị trường</th>
                      <th className="px-2 py-2 text-right font-semibold">Doanh thu</th>
                      <th className="px-2 py-2 text-right font-semibold">Tăng trưởng</th>
                      <th className="px-2 py-2 text-right font-semibold">Số shop</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crossMarket.map((r) => {
                      const meta = MARKETS.find((m) => m.key === r.market)
                      const up = r.growthRate >= 0
                      return (
                        <tr key={r.market} className={`border-t border-black/5 ${r.isCurrent ? 'bg-violet-50' : ''}`}>
                          <td className="px-3 py-2 font-semibold text-slate-700">
                            {meta?.flag} {meta?.label}{r.isCurrent && <span className="ml-1 text-[10px] text-violet-600">(đang xem)</span>}
                          </td>
                          <td className="px-2 py-2 text-right text-slate-700">{formatKMyr(r.revenue)}</td>
                          <td className={`px-2 py-2 text-right font-semibold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
                            <span className="inline-flex items-center gap-0.5">
                              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {up ? '+' : ''}{r.growthRate}%
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right text-slate-600">{r.shops}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                💡 Thị trường nào tăng mạnh + nhiều shop = đang nổ ở đó. Nếu MY còn ít shop → cơ hội vào sớm.
              </p>
            </div>
          )}

          {/* ── GIÁ ── */}
          {tab === 'pricing' && <PricingCalculator defaultPriceMyr={product.unitPrice} />}
        </div>
      </aside>

      {/* ── TikTok video embed modal (CHÍNH THỨC qua blockquote + embed.js) ── */}
      {embedVideo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => setEmbedVideo(null)}>
          <div className="relative flex h-[85vh] max-h-[820px] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-black/10 px-4 py-2">
              <span className="text-xs font-semibold text-slate-600">▶ TikTok video</span>
              <div className="flex items-center gap-2">
                {embedVideo.handle && (
                  <a
                    href={`https://www.tiktok.com/@${embedVideo.handle}/video/${embedVideo.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                    title="Mở thẳng trên TikTok (nếu embed lỗi)"
                  >
                    <ExternalLink className="h-3 w-3" /> Mở TikTok
                  </a>
                )}
                <button
                  onClick={() => setEmbedVideo(null)}
                  className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
                  title="Đóng"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-50">
              <TikTokEmbedPlayer videoId={embedVideo.id} handle={embedVideo.handle} />
            </div>
          </div>
        </div>
      )}

      {/* ── Player MP4 + "Đọc video" (kịch bản + dịch VN) — vừa xem vừa đối chiếu ── */}
      {playVid && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 sm:p-4" onClick={closeVid}>
          <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white lg:flex-row" onClick={(e) => e.stopPropagation()}>
            <button onClick={closeVid} className="absolute right-2 top-2 z-10 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70" title="Đóng"><X className="h-5 w-5" /></button>

            {/* Video */}
            <div className="flex shrink-0 items-center justify-center bg-black lg:w-[44%]">
              <video src={playVid.downloadUrl} controls autoPlay playsInline className="max-h-[40vh] w-full object-contain lg:max-h-[92vh]" />
            </div>

            {/* Kịch bản tiếng Việt */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
              <p className="mb-1 line-clamp-2 text-xs font-semibold text-slate-700">{playVid.desc || '(video)'}</p>
              <p className="mb-3 text-[11px] text-slate-400">@{playVid.author} · 👁 {formatCount(playVid.views)} · {playVid.durationSec}s</p>

              {!readResult && !readBusy && (
                <button
                  onClick={() => void readVideo()}
                  className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
                >
                  <Sparkles className="h-4 w-4" /> 🇻🇳 Đọc video (kịch bản + dịch)
                </button>
              )}
              {readBusy && (
                <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50 p-4 text-center text-xs text-violet-600">
                  🤖 AI đang xem & dịch video… (~15–40 giây)
                </div>
              )}
              {readErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{readErr}</p>}

              {readResult && (
                <div className="flex flex-col gap-3">
                  {[
                    { icon: '💬', label: 'Lời thoại / kịch bản (dịch VN)', text: readResult.transcript },
                    { icon: '🎬', label: 'Cấu trúc', text: readResult.structure },
                    { icon: '🎯', label: 'Góc bán & vì sao chốt', text: readResult.angle },
                    { icon: '♻️', label: 'Cách bắt chước cho SP mình', text: readResult.howto },
                  ].map((b) => (
                    <div key={b.label} className="rounded-xl border border-black/10 bg-slate-50 p-3">
                      <div className="text-xs font-bold text-slate-700">{b.icon} {b.label}</div>
                      <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-slate-600">{b.text}</p>
                    </div>
                  ))}
                  <button
                    onClick={() => void readVideo()}
                    disabled={readBusy}
                    className="rounded-xl border border-violet-300 bg-white py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                  >
                    ↻ Đọc lại
                  </button>
                </div>
              )}

              {/* Tải / TikTok */}
              <div className="mt-3 flex gap-2">
                <a href={playVid.downloadUrl} target="_blank" rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100">
                  <Download className="h-3.5 w-3.5" /> Tải
                </a>
                {playVid.url && (
                  <a href={playVid.url} target="_blank" rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-black/10 bg-slate-50 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                    <ExternalLink className="h-3.5 w-3.5" /> TikTok
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
