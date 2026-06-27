// Spy Ads — creative QUẢNG CÁO video đối thủ từ Facebook Ad Library (ScrapeCreators).
// Khác "Video win" (organic): đây là ad MKT đối thủ đang chạy → tải về dựng lại cho FB ads.
// Win signal: đang ACTIVE + chạy lâu + advertiser nhiều ad. AI dịch VO + bóc kịch bản cắt ghép.
import { useState } from 'react'
import { Megaphone, Search, Play, Download, ExternalLink, X, Sparkles, Link2, FileText, PenLine } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useBankStore } from '../../stores/bankStore'
import { useAppStore } from '../../stores/appStore'
import { directGeminiVision, directGeminiText } from '../../utils/gemini'

interface FbAd {
  id: string; page: string; text: string; videoUrl: string; cover: string
  linkUrl: string; country: string; isActive: boolean; daysRunning: number
  advertiserAds: number; libraryUrl: string; likes?: number; ctr?: string
}
const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(n))
interface AdRead { transcript: string; structure: string }
interface LadiRead { headline: string; offer: string; structure: string; cta: string; steal: string }
interface AdaptScript { hook: string; script: string; shots: string; caption: string }

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

  const [platform, setPlatform] = useState<'fb' | 'tiktok'>('fb')
  const [q, setQ] = useState('')
  const [country, setCountry] = useState('MY')
  const [activeOnly, setActiveOnly] = useState(true)
  const [ladiOnly, setLadiOnly] = useState(false)   // chỉ ad dẫn về web/ladipage (bỏ chat/sàn)
  const [ads, setAds] = useState<FbAd[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [moreLoading, setMoreLoading] = useState(false)
  const [credits, setCredits] = useState<number | null>(null)

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

  const buildUrl = (query: string, cur?: string) => {
    const base = platform === 'fb' ? '/api/fb-ads' : '/api/tiktok-ads'
    const st = platform === 'fb' ? `&status=${activeOnly ? 'ACTIVE' : 'ALL'}` : ''
    return `${base}?q=${encodeURIComponent(query.trim())}&country=${country}${st}${cur ? `&cursor=${encodeURIComponent(cur)}` : ''}`
  }

  const search = async (term?: string) => {
    const query = (term ?? q).trim()
    if (!query) { setError('Nhập từ khóa / ngách'); return }
    if (term != null) setQ(term)
    setLoading(true); setError(null); setAds(null); setCursor(null); setHasMore(false)
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

  const loadMore = async () => {
    if (!cursor || moreLoading) return
    setMoreLoading(true)
    try {
      const d = await fetch(buildUrl(q, cursor)).then((r) => r.json())
      const more: FbAd[] = Array.isArray(d.ads) ? d.ads : []
      setAds((prev) => {
        const seen = new Set((prev || []).map((a) => a.id))
        return [...(prev || []), ...more.filter((a) => !seen.has(a.id))]
      })
      setCursor(d.cursor != null ? String(d.cursor) : null)
      setHasMore(!!d.hasMore && d.cursor != null)
      setCredits(d.credits ?? credits)
    } catch { /* bỏ qua */ } finally { setMoreLoading(false) }
  }

  const resetAd = () => {
    setReadResult(null); setReadErr(null); setReadBusy(false)
    setLadiResult(null); setLadiErr(null); setLadiBusy(false)
    setAdaptResult(null); setAdaptErr(null); setAdaptBusy(false); setAdaptProductId(''); setAdaptName('')
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

  // Lọc "chỉ ad có ladipage/sale page" (web, bỏ WhatsApp/Messenger/Shopee/Lazada/TikTok).
  const shownAds = (ads || []).filter(
    (a) => !(ladiOnly && platform === 'fb') || (!!a.linkUrl && linkKind(cleanLink(a.linkUrl)).web),
  )

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#EEEEF2]">
      {/* Header + search */}
      <header className="flex shrink-0 flex-col gap-3 border-b border-black/10 bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100"><Megaphone className="h-4 w-4 text-rose-600" /></div>
          <div>
            <h1 className="text-base font-bold text-slate-800">Spy Ads — Quảng cáo đối thủ</h1>
            <p className="text-[11px] text-slate-400">{platform === 'fb' ? 'Video ads đang chạy trên Facebook Ad Library' : 'Top video ads TikTok (Creative Center)'} → tải về dựng lại cho FB ads</p>
          </div>
          {credits != null && <span className="ml-auto text-xs text-slate-400">credit: {credits}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-0.5 rounded-lg border border-black/10 bg-white p-0.5">
            <button onClick={() => { setPlatform('fb'); setAds(null) }}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${platform === 'fb' ? 'bg-rose-100 text-rose-700' : 'text-slate-500'}`}>👍 Facebook</button>
            <button onClick={() => { setPlatform('tiktok'); setAds(null) }}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${platform === 'tiktok' ? 'bg-rose-100 text-rose-700' : 'text-slate-500'}`}>🎵 TikTok</button>
          </div>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm font-medium">
            {COUNTRIES.map((x) => <option key={x.c} value={x.c}>{x.f} {x.c}</option>)}
          </select>
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
        {/* Chip từ khóa COD chung — bấm là quét rộng */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-400">Từ khóa COD:</span>
          {COD_CHIPS.map((c) => (
            <button key={c} onClick={() => void search(c)} disabled={loading}
              className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50">
              {c}
            </button>
          ))}
        </div>
      </header>

      {/* Results */}
      <main className="flex-1 overflow-y-auto p-5">
        {!ads && !loading && (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/10 text-center text-slate-400">
            <Megaphone className="h-8 w-8" />
            <p className="text-sm">Nhập ngách/từ khóa + chọn nước → <b>Tìm ad</b>.</p>
            <p className="text-xs">Ad <b>đang chạy + lâu + advertiser nhiều bản</b> = winner (đốt tiền lâu chứng tỏ có lời).</p>
          </div>
        )}
        {loading && <div className="py-10 text-center text-sm text-slate-400">{platform === 'fb' ? 'Đang quét Facebook Ad Library…' : 'Đang quét TikTok Top Ads…'}</div>}
        {ads && ads.length > 0 && (
          <>
            <div className="mb-2 text-xs font-semibold text-slate-500">
              {shownAds.length} ad{ladiOnly && platform === 'fb' ? ' có Ladipage/Sale page' : ''}
            </div>
            {ladiOnly && platform === 'fb' && shownAds.length === 0 && (
              <p className="rounded-xl border border-dashed border-black/10 p-4 text-center text-xs text-slate-400">
                Lượt này không có ad nào dẫn về web/ladipage (đa số đi WhatsApp/Shopee). Bỏ tick lọc hoặc bấm "Tải thêm".
              </p>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
              {shownAds.map((a) => (
                <div key={a.id} className="flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
                  <button onClick={() => openAd(a)} className="relative flex aspect-[3/4] items-center justify-center bg-slate-900">
                    {a.cover ? <img src={a.cover} alt="" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} /> : null}
                    <Play className="absolute h-10 w-10 text-white/90 drop-shadow" />
                    {a.isActive && <span className="absolute left-1.5 top-1.5 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">● ĐANG CHẠY</span>}
                  </button>
                  <div className="flex flex-1 flex-col gap-1 p-2.5">
                    <p className="line-clamp-1 text-xs font-semibold text-slate-700">{a.page || '(advertiser)'}</p>
                    <p className="line-clamp-2 text-[11px] text-slate-500">{a.text}</p>
                    <div className="mt-auto flex flex-wrap gap-x-2 gap-y-0.5 pt-1 text-[10px] font-medium text-slate-500">
                      {a.daysRunning > 0 && <span>⏳ {a.daysRunning}d</span>}
                      {a.advertiserAds > 1 && <span>📢 {a.advertiserAds} ad</span>}
                      {a.likes ? <span>❤️ {fmtK(a.likes)}</span> : null}
                      {a.ctr ? <span>CTR {a.ctr}</span> : null}
                      <span>{COUNTRIES.find((c) => c.c === a.country)?.f ?? ''}{a.country}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {hasMore && (
              <button onClick={() => void loadMore()} disabled={moreLoading}
                className="mt-4 w-full rounded-xl border border-rose-300 bg-white py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                {moreLoading ? 'Đang tải…' : '↻ Tải thêm ad'}
              </button>
            )}
          </>
        )}
      </main>

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
                {playAd.likes ? `❤️ ${fmtK(playAd.likes)} · ` : ''}
                {playAd.ctr ? `CTR ${playAd.ctr} · ` : ''}
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
                      <button onClick={() => { navigator.clipboard?.writeText(dest); addToast('Đã copy link', 'success') }}
                        className="mt-1 rounded-md border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100">📋 Copy link</button>
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
                <a href={playAd.videoUrl} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100">
                  <Download className="h-3.5 w-3.5" /> Tải video
                </a>
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
