// Spy Ads — creative QUẢNG CÁO video đối thủ từ Facebook Ad Library (ScrapeCreators).
// Khác "Video win" (organic): đây là ad MKT đối thủ đang chạy → tải về dựng lại cho FB ads.
// Win signal: đang ACTIVE + chạy lâu + advertiser nhiều ad. AI dịch VO + bóc kịch bản cắt ghép.
import { useState } from 'react'
import { Megaphone, Search, Play, Download, ExternalLink, X, Sparkles } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { directGeminiVision } from '../../utils/gemini'

interface FbAd {
  id: string; page: string; text: string; videoUrl: string; cover: string
  linkUrl: string; country: string; isActive: boolean; daysRunning: number
  advertiserAds: number; libraryUrl: string
}
interface AdRead { transcript: string; structure: string; angle: string; howto: string }

const COUNTRIES = [
  { c: 'MY', f: '🇲🇾' }, { c: 'ID', f: '🇮🇩' }, { c: 'TH', f: '🇹🇭' },
  { c: 'VN', f: '🇻🇳' }, { c: 'PH', f: '🇵🇭' }, { c: 'SG', f: '🇸🇬' }, { c: 'ALL', f: '🌏' },
]

export default function SpyAds() {
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)

  const [q, setQ] = useState('')
  const [country, setCountry] = useState('MY')
  const [activeOnly, setActiveOnly] = useState(true)
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

  const buildUrl = (cur?: string) =>
    `/api/fb-ads?q=${encodeURIComponent(q.trim())}&country=${country}&status=${activeOnly ? 'ACTIVE' : 'ALL'}${cur ? `&cursor=${encodeURIComponent(cur)}` : ''}`

  const search = async () => {
    if (!q.trim()) { setError('Nhập từ khóa / ngách'); return }
    setLoading(true); setError(null); setAds(null); setCursor(null); setHasMore(false)
    try {
      const d = await fetch(buildUrl()).then((r) => r.json())
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
      const d = await fetch(buildUrl(cursor)).then((r) => r.json())
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

  const openAd = (a: FbAd) => { setReadResult(null); setReadErr(null); setPlayAd(a) }
  const closeAd = () => { setPlayAd(null); setReadResult(null); setReadErr(null); setReadBusy(false) }

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
      const prompt = `Bạn xem 1 VIDEO QUẢNG CÁO Facebook của đối thủ (bán COD ở ${playAd.country}, tiếng Malay/English). Người đọc là marketer Việt muốn DỰNG LẠI ad tương tự cho FB. Trả JSON tiếng Việt:
{"transcript":"toàn bộ lời voice + chữ trên màn hình, DỊCH sang tiếng Việt theo trình tự","structure":"cấu trúc dựng: hook → vấn đề → giải pháp/chứng minh → CTA, mỗi ý 1 dòng; ghi rõ kiểu cảnh/cắt ghép","angle":"góc bán & vì sao ad này chạy được lâu","howto":"cách tự dựng lại: cần quay/lấy source gì, voice nói gì, mỗi ý 1 dòng"}
Caption ad: ${playAd.text || '(không có)'}
CHỈ trả JSON.`
      const raw = await directGeminiVision({
        apiKey: geminiApiKey,
        parts: [{ fileData: { mimeType: mime, fileUri: uri } }, { text: prompt }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: { transcript: { type: 'string' }, structure: { type: 'string' }, angle: { type: 'string' }, howto: { type: 'string' } },
          required: ['transcript', 'structure', 'angle', 'howto'],
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

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#EEEEF2]">
      {/* Header + search */}
      <header className="flex shrink-0 flex-col gap-3 border-b border-black/10 bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100"><Megaphone className="h-4 w-4 text-rose-600" /></div>
          <div>
            <h1 className="text-base font-bold text-slate-800">Spy Ads — Quảng cáo đối thủ</h1>
            <p className="text-[11px] text-slate-400">Video ads đang chạy trên Facebook Ad Library → tải về dựng lại cho FB ads</p>
          </div>
          {credits != null && <span className="ml-auto text-xs text-slate-400">credit: {credits}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} /> Chỉ ad đang chạy
          </label>
          {error && <span className="text-xs text-red-500">{error}</span>}
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
        {loading && <div className="py-10 text-center text-sm text-slate-400">Đang quét Facebook Ad Library…</div>}
        {ads && ads.length > 0 && (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
              {ads.map((a) => (
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
                      <span>⏳ {a.daysRunning}d</span>
                      <span>📢 {a.advertiserAds} ad</span>
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
              <p className="mb-2 text-[11px] text-slate-400">⏳ chạy {playAd.daysRunning} ngày · 📢 {playAd.advertiserAds} ad · {playAd.country}</p>
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
                    { icon: '🎯', label: 'Góc bán & vì sao chạy lâu', text: readResult.angle },
                    { icon: '🛠', label: 'Cách dựng lại', text: readResult.howto },
                  ].map((b) => (
                    <div key={b.label} className="rounded-xl border border-black/10 bg-slate-50 p-3">
                      <div className="text-xs font-bold text-slate-700">{b.icon} {b.label}</div>
                      <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-slate-600">{b.text}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex gap-2">
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
