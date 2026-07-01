// ── MKT Agent — UI (video-first: quét → dò video đối thủ → xếp lên đầu → rip) ──
// Mục tiêu: SP CÓ VIDEO đối thủ sẵn = khởi đầu. Sau quét, tự dò video top-N (rẻ,
// 1 call/SP) → xếp SP-có-video lên đầu + reel Tải no-watermark ngay trên card.
// Phân tích sâu (ads/1688/Gemini) chỉ chạy khi chốt 1 SP. Xem MKT_AGENT_SPEC.md.
import { useState } from 'react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import { useMktAgentStore, type SpCandidate, type VidItem } from './store'
import { scanWinningProducts } from './services/researchStage'
import { classifyBranding } from './services/brandingFilter'
import { buildVerifyLinks, deepDive, searchKeyword } from './services/enrichStage'
import { judgeSp } from './services/judge'
import { computeWinScore } from './services/winScore'
import { checkProductVideos } from './services/checkVideos'
import { KEYWORD_GROUPS, toggleGroup, isGroupActive, parseNiches } from './keywords'
import { useBankStore } from '../../stores/bankStore'
import { directGeminiText, directGeminiVision } from '../../utils/gemini'

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))
const compact = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n)

type Tone = 'emerald' | 'amber' | 'rose' | 'zinc'
const TONE: Record<Tone, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/45',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/45',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-500/45',
  zinc: 'bg-zinc-700/40 text-zinc-300 border-zinc-600/45',
}
function judgeTone(verdict: string): Tone {
  const s = verdict.toUpperCase()
  if (s.includes('BỎ') || s.includes('BO ')) return 'rose'
  if (s.includes('CÂN NHẮC') || s.includes('CAN NHAC')) return 'amber'
  if (s.includes('TEST')) return 'emerald'
  return 'zinc'
}

function shipHint(s?: string): { label: string; cls: string } | null {
  if (!s) return null
  const local = /\b(MY|malaysia|kuala|selangor|johor)\b/i.test(s)
  return local
    ? { label: '📦 nội địa', cls: 'text-emerald-400' }
    : { label: '✈️ cross-border', cls: 'text-amber-400' }
}

// AI "Đọc video" trả về.
type VideoRead = { transcript: string; structure: string; angle: string; howto: string }

// Tải nhiều video 1 phát (anchor download, giãn nhịp để trình duyệt không chặn).
function downloadAll(urls: string[]): void {
  urls.filter(Boolean).forEach((u, i) => {
    setTimeout(() => {
      const a = document.createElement('a')
      a.href = u; a.target = '_blank'; a.rel = 'noopener'; a.download = ''
      document.body.appendChild(a); a.click(); a.remove()
    }, i * 400)
  })
}

// Pool chạy song song giới hạn n — dò video nhiều SP mà không spam API.
async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; await fn(items[idx]) }
  }))
}

export default function MktAgent() {
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const sendToApp = useAppStore((s) => s.sendToApp)
  const addProduct = useBankStore((s) => s.addProduct)
  const {
    niches, amount, scanning, classifying, error, candidates, onlyGeneric, selectedSp,
    watchlist, showWatchlist,
    setNiches, setAmount, setScanning, setClassifying, setError,
    setCandidates, setBranding, patchCandidate, setOnlyGeneric, selectSp, toggleWatch, setShowWatchlist,
  } = useMktAgentStore()
  const [videoDepth] = useState(40)
  const [vidScanning, setVidScanning] = useState(false)
  const [onlyWithVideo, setOnlyWithVideo] = useState(false)
  const [playVid, setPlayVid] = useState<VidItem | null>(null)
  const [readResult, setReadResult] = useState<VideoRead | null>(null)
  const [readBusy, setReadBusy] = useState(false)
  const [readErr, setReadErr] = useState<string | null>(null)

  // Dò video bán SP cho top-N (theo số bán) chưa dò → xếp SP-có-video lên đầu.
  const runVideoRank = async (list: SpCandidate[], depth: number) => {
    const targets = list
      .filter((c) => c.tier !== 'brand' && !c.vids && !c.videoChecking)
      .sort((a, b) => b.sale - a.sale)
      .slice(0, depth)
    if (!targets.length) return
    setVidScanning(true)
    await pool(targets, 6, async (c) => {
      patchCandidate(c.productId, { videoChecking: true })
      try {
        const v = await checkProductVideos(c)
        patchCandidate(c.productId, { vids: v, videoChecking: false })
      } catch {
        patchCandidate(c.productId, { vids: { count: 0, maxViews: 0, list: [] }, videoChecking: false })
      }
    })
    setVidScanning(false)
  }

  const scan = async () => {
    setScanning(true); setError(null); selectSp(null); setCandidates([]); setVidScanning(false)
    try {
      const res = await scanWinningProducts(niches.split(','), amount)
      setCandidates(res.candidates)
      if (!res.candidates.length) { setError('Không tìm thấy SP — thử đổi/thêm ngách.'); return }
      // Dò video chạy nền ngay (không chặn) — ưu tiên SP có video.
      void runVideoRank(res.candidates, videoDepth)
      if (!geminiApiKey) { setError('Có SP rồi — cần Gemini key (Cài đặt) để lọc branded.'); return }
      setClassifying(true)
      try {
        const map = await classifyBranding(geminiApiKey, res.candidates.map((c) => ({ id: c.productId, title: c.title })))
        setBranding(map)
      } catch {
        setError('Quét xong nhưng lọc branded lỗi (thử lại). Vẫn xem được danh sách.')
      } finally {
        setClassifying(false)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setScanning(false)
    }
  }

  // 1 NÚT phân tích sâu (chỉ khi chốt): soi sâu → giám khảo → đào spy FB.
  const analyzeSp = async (c: SpCandidate) => {
    if (!geminiApiKey) { setError('Cần Gemini key (Cài đặt) để phân tích sâu.'); return }
    if (!c.imageUrl) { patchCandidate(c.productId, { deepError: 'SP thiếu ảnh.' }); return }
    patchCandidate(c.productId, { diving: true, deepError: undefined })
    let deep = c.deep
    try {
      if (!deep) {
        deep = await deepDive(c, geminiApiKey)
        patchCandidate(c.productId, { deep, diving: false })
        try {
          const judge = await judgeSp(geminiApiKey, { ...c, deep })
          patchCandidate(c.productId, { judge })
        } catch { /* judge lỗi → vẫn giữ số */ }
      } else {
        patchCandidate(c.productId, { diving: false })
      }
    } catch (e) {
      patchCandidate(c.productId, { diving: false, deepError: (e as Error).message })
    }
  }

  // Thêm SP vào KHO (giống nút ở app Research): Gemini điền hồ sơ VN đầy đủ → addProduct.
  const addToBank = async (c: SpCandidate) => {
    if (c.bankAddedId || c.bankAdding) return
    if (!geminiApiKey) { setError('Cần Gemini key (Cài đặt) để AI điền hồ sơ SP.'); return }
    patchCandidate(c.productId, { bankAdding: true })
    try {
      const prompt = `Bạn là chuyên gia nghiên cứu sản phẩm COD/affiliate. Đọc 1 sản phẩm đang bán chạy trên TikTok Shop và SUY LUẬN viết hồ sơ ĐẦY ĐỦ bằng TIẾNG VIỆT để tạo content quảng cáo + landing page.
SẢN PHẨM:
- Tên gốc: ${c.title}
- Ngách: ${c.niche ?? '—'}
- Thị trường: Malaysia
- Giá: ${c.price ? 'RM' + c.price : '—'} · Đã bán: ${c.sale} · Đánh giá: ${c.rating || '—'}
Trả JSON đúng khóa (tiếng Việt, cụ thể, KHÔNG bịa chứng nhận y tế/giấy phép):
{"productName":"tên gọn rõ","productDescription":"2-3 câu SP là gì, cho ai","targetMarket":"ĐỐI TƯỢNG KHÁCH HÀNG MỤC TIÊU cụ thể — ai nên dùng (độ tuổi/giới tính/nghề/tình trạng), 1-2 dòng. TUYỆT ĐỐI KHÔNG ghi tên quốc gia/thị trường","painPoints":"nỗi đau khách, mỗi ý 1 dòng","usps":"điểm độc nhất của SP (đặc tính/lợi thế cạnh tranh), mỗi ý 1 dòng","benefits":"lợi ích chính, mỗi ý 1 dòng","offer":"gợi ý ưu đãi/combo (vd mua 2 tặng 1, freeship COD)","ingredients":"THÀNH PHẦN chính suy luận theo tên+ngách (ước đoán hợp lý, hedge 'thường chứa…' nếu không chắc, KHÔNG bịa hàm lượng/chứng nhận) + CƠ CHẾ HOẠT ĐỘNG ngắn gọn. Chỉ ghi 'Cập nhật từ NCC' khi HOÀN TOÀN không suy luận nổi","usageGuide":"cách dùng gợi ý"}
Suy luận hợp lý từ tên + ngách. TUYỆT ĐỐI KHÔNG đưa số lượt bán/đánh giá sao/thống kê thị trường vào usps/benefits hay bất kỳ field nào. CHỈ trả JSON.`
      const raw = await directGeminiText({ apiKey: geminiApiKey, prompt, responseMimeType: 'application/json', temperature: 0.5 })
      const d = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()) as Record<string, string>
      const created = await addProduct({
        productName: d.productName || c.title,
        productDescription: d.productDescription || '',
        targetMarket: d.targetMarket || '',
        painPoints: d.painPoints || '',
        usps: d.usps || '',
        benefits: d.benefits || '',
        offer: d.offer || '',
        ingredients: d.ingredients || '',
        usageGuide: d.usageGuide || '',
        productImage: c.imageUrl || '',
        productImages: c.imageUrl ? [c.imageUrl] : [],
      })
      if (!created) { patchCandidate(c.productId, { bankAdding: false }); return }  // addProduct đã toast lỗi
      patchCandidate(c.productId, { bankAdding: false, bankAddedId: created.id })
    } catch (e) {
      patchCandidate(c.productId, { bankAdding: false })
      setError('AI điền hồ sơ lỗi: ' + ((e as Error).message || '').slice(0, 80))
    }
  }

  // "Đọc video": Gemini xem MP4 đối thủ → kịch bản (dịch) + cấu trúc + góc bán + cách bắt chước.
  const openVid = (v: VidItem) => { setReadResult(null); setReadErr(null); setReadBusy(false); setPlayVid(v) }
  const closeVid = () => { setPlayVid(null); setReadResult(null); setReadErr(null); setReadBusy(false) }
  const readVideo = async () => {
    if (!playVid?.downloadUrl) return
    if (!geminiApiKey) { setReadErr('Cần Gemini key (Cài đặt)'); return }
    setReadBusy(true); setReadErr(null); setReadResult(null)
    try {
      const up = await fetch('/api/gemini-upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: playVid.downloadUrl, apiKey: geminiApiKey }),
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
      const prompt = `Bạn đang xem 1 video TikTok BÁN HÀNG ở Malaysia (tiếng Malay/English). Người đọc là seller Việt Nam muốn HỌC cách họ bán. Trả JSON tiếng Việt:
{"transcript":"toàn bộ lời thoại + chữ trên màn hình, DỊCH sang tiếng Việt theo trình tự","structure":"cấu trúc: hook → thân (chứng minh/cảm xúc) → CTA, mỗi ý 1 dòng","angle":"góc bán chính & vì sao video này chốt/viral","howto":"cách bắt chước cho SP của mình, mỗi ý 1 dòng cụ thể"}
Mô tả gốc: ${playVid.desc}
Nếu không có lời thoại thì đọc chữ trên màn hình + hình ảnh. CHỈ trả JSON.`
      const raw = await directGeminiVision({
        apiKey: geminiApiKey,
        parts: [{ fileData: { mimeType: mime, fileUri: uri } }, { text: prompt }],
        responseMimeType: 'application/json',
        responseSchema: { type: 'object', properties: { transcript: { type: 'string' }, structure: { type: 'string' }, angle: { type: 'string' }, howto: { type: 'string' } }, required: ['transcript', 'structure', 'angle', 'howto'] },
        temperature: 0.4, maxOutputTokens: 8192,
      })
      const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()) as VideoRead
      setReadResult(parsed)
    } catch (e) {
      setReadErr('Đọc video lỗi: ' + ((e as Error).message || '').slice(0, 110))
    } finally { setReadBusy(false) }
  }

  const watchedIds = new Set(watchlist.map((w) => w.productId))
  const source = showWatchlist ? watchlist : candidates
  const genericCount = source.filter((c) => c.tier === 'generic').length
  const oemCount = source.filter((c) => c.tier === 'oem').length
  const brandCount = source.filter((c) => c.tier === 'brand').length
  const withVideoCount = source.filter((c) => (c.vids?.count ?? 0) > 0).length

  let shown = onlyGeneric ? source.filter((c) => c.tier !== 'brand') : source
  if (onlyWithVideo) shown = shown.filter((c) => (c.vids?.count ?? 0) > 0)
  // Xếp: SP có video lên đầu → max view → số bán.
  shown = [...shown].sort((a, b) => {
    const aHas = (a.vids?.count ?? 0) > 0 ? 1 : 0
    const bHas = (b.vids?.count ?? 0) > 0 ? 1 : 0
    if (aHas !== bHas) return bHas - aHas
    if (aHas) { const d = (b.vids!.maxViews) - (a.vids!.maxViews); if (d) return d }
    return b.sale - a.sale
  })

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100 p-4 md:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-amber-400">🤖 MKT Agent</h1>
          <p className="text-[13px] text-zinc-400 mt-0.5">
            Quét SP COD → tự <b className="text-zinc-200">dò video đối thủ</b> → SP có video (rip-ready) lên đầu → Tải về chạy ads.
          </p>
        </div>
        <button onClick={() => setShowWatchlist(!showWatchlist)}
          className={`shrink-0 h-9 px-3 rounded-md text-[13px] font-semibold border ${showWatchlist ? 'bg-amber-400 text-zinc-950 border-amber-400' : 'bg-zinc-900 text-amber-300 border-amber-500/40 hover:bg-zinc-800'}`}>
          📌 Đã lưu ({watchlist.length}){showWatchlist ? ' · ← quét' : ''}
        </button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-amber-400 font-medium">Bước 1 · Quét SP win (Malaysia)</span>
          <span className="text-[11px] text-zinc-500">tự dò video · tự lọc branded</span>
        </div>

        {/* Nhóm ngách — bấm để thêm/bớt nhanh (đã loại thời trang/giày) */}
        <div className="mb-2">
          <p className="text-[11px] text-zinc-500 mb-1">Nhóm ngách (bấm thêm/bớt · đã tránh thời trang/giày nhiều biến thể)</p>
          <div className="flex flex-wrap gap-1.5">
            {KEYWORD_GROUPS.map((g) => {
              const active = isGroupActive(g, parseNiches(niches))
              return (
                <button key={g.label} onClick={() => setNiches(toggleGroup(g, niches))}
                  className={`px-2.5 py-1 rounded-full text-[12px] border transition-colors ${active ? 'bg-amber-400 text-zinc-950 border-amber-400 font-semibold' : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500'}`}>
                  {g.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
          <label className="text-[13px] text-zinc-400">
            Ngách (cách nhau dấu phẩy — tiếng Malay)
            <input value={niches} onChange={(e) => setNiches(e.target.value)}
              placeholder="minyak urut, jerawat, sakit gigi..."
              className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 text-sm" />
          </label>
          <label className="text-[13px] text-zinc-400">
            SP/ngách
            <input type="number" min={5} max={50} value={amount}
              onChange={(e) => setAmount(Math.max(5, Math.min(50, Number(e.target.value) || 30)))}
              className="mt-1 w-24 bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 text-sm" />
          </label>
          <button onClick={scan} disabled={scanning || classifying}
            className="h-[42px] px-5 rounded-md font-semibold bg-amber-400 text-zinc-950 hover:bg-amber-300 shadow-lg shadow-amber-400/40 disabled:opacity-60 disabled:cursor-wait">
            {scanning ? 'Đang quét…' : classifying ? 'Đang lọc…' : '⚡ Quét MY'}
          </button>
        </div>

        {error && (
          <div className="mt-3 text-[13px] text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">{error}</div>
        )}

        {source.length > 0 ? (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
              <p className="text-[12px] text-zinc-500">
                {candidates.length} SP · <span className="text-emerald-400">🎥 {withVideoCount} có video</span>
                {' · '}{classifying ? 'đang lọc…' : <><span className="text-emerald-400">{genericCount} generic</span> · <span className="text-amber-300">{oemCount} nhãn-xưởng</span> · <span className="text-rose-400">{brandCount} bảo hộ</span></>}
                {vidScanning && <span className="text-amber-300 animate-pulse"> · đang dò video…</span>}
              </p>
              <div className="flex items-center gap-2.5 flex-wrap">
                <label className="flex items-center gap-1.5 text-[12px] text-zinc-300 cursor-pointer">
                  <input type="checkbox" checked={onlyWithVideo} onChange={(e) => setOnlyWithVideo(e.target.checked)} />
                  Chỉ SP có video
                </label>
                <label className="flex items-center gap-1.5 text-[12px] text-zinc-300 cursor-pointer">
                  <input type="checkbox" checked={onlyGeneric} onChange={(e) => setOnlyGeneric(e.target.checked)} />
                  Ẩn brand bảo hộ
                </label>
                {!showWatchlist && candidates.some((c) => !c.vids) && (
                  <button onClick={() => runVideoRank(candidates, videoDepth)} disabled={vidScanning}
                    className="px-2.5 py-1 rounded-md text-[12px] bg-amber-400 text-zinc-950 font-semibold hover:bg-amber-300 shadow shadow-amber-400/30 disabled:opacity-50">
                    🎥 Dò video thêm {videoDepth}
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 items-start">
              {shown.map((p) => (
                <SpCard
                  key={p.productId}
                  p={p}
                  picked={selectedSp?.productId === p.productId}
                  hasKey={!!geminiApiKey}
                  onAnalyze={() => analyzeSp(p)}
                  onPick={() => selectSp(selectedSp?.productId === p.productId ? null : p)}
                  onSendToApp={sendToApp}
                  onPlay={openVid}
                  onAddBank={() => addToBank(p)}
                  isWatched={watchedIds.has(p.productId)}
                  onWatch={() => toggleWatch(p)}
                />
              ))}
            </div>
          </div>
        ) : showWatchlist ? (
          <p className="mt-4 text-[13px] text-zinc-500">Chưa ghim SP nào. Bấm 📌 trên card để lưu SP — giữ qua F5 và qua các lần quét.</p>
        ) : null}
      </div>

      {playVid && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-3" onClick={closeVid}>
          <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 sm:flex-row" onClick={(e) => e.stopPropagation()}>
            <button onClick={closeVid} className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80" title="Đóng">✕</button>
            <div className="flex shrink-0 items-center justify-center bg-black sm:w-[55%]">
              <video src={playVid.downloadUrl || playVid.url} controls autoPlay playsInline className="max-h-[50vh] w-full object-contain sm:max-h-[92vh]" />
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-4 overflow-y-auto">
              <p className="text-[12px] font-semibold text-zinc-100 line-clamp-3">{playVid.desc || '(video)'}</p>
              <p className="mt-1 text-[11px] text-zinc-400">{playVid.author ? `@${playVid.author} · ` : ''}👁 {compact(playVid.views)} · {playVid.durationSec}s</p>
              <div className="mt-3 flex gap-2">
                {playVid.downloadUrl && (
                  <a href={playVid.downloadUrl} target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-center rounded-lg border border-violet-400/40 bg-violet-500/20 py-2 text-[12px] font-semibold text-violet-200 hover:bg-violet-500/30">⬇ Tải (no-watermark)</a>
                )}
                {playVid.url && (
                  <a href={playVid.url} target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-center rounded-lg border border-zinc-700 bg-zinc-800 py-2 text-[12px] font-semibold text-zinc-200 hover:bg-zinc-700">↗ Mở gốc</a>
                )}
              </div>

              {playVid.downloadUrl && !readResult && (
                <button onClick={readVideo} disabled={readBusy}
                  className="mt-2 rounded-lg border border-amber-400/50 bg-amber-400/15 py-2 text-[12px] font-semibold text-amber-200 hover:bg-amber-400/25 disabled:opacity-50">
                  {readBusy ? '⏳ AI đang xem & bóc kịch bản…' : '📖 Đọc video (AI bóc kịch bản + dịch)'}
                </button>
              )}
              {readErr && <p className="mt-2 text-[11px] text-rose-400">{readErr}</p>}
              {readResult && (
                <div className="mt-3 space-y-2.5 text-[12px]">
                  <div><p className="font-semibold text-amber-300">📝 Kịch bản (dịch VN)</p><p className="text-zinc-300 whitespace-pre-wrap">{readResult.transcript}</p></div>
                  <div><p className="font-semibold text-amber-300">🧱 Cấu trúc</p><p className="text-zinc-300 whitespace-pre-wrap">{readResult.structure}</p></div>
                  <div><p className="font-semibold text-amber-300">🎯 Góc bán</p><p className="text-zinc-300 whitespace-pre-wrap">{readResult.angle}</p></div>
                  <div><p className="font-semibold text-amber-300">🛠 Cách bắt chước</p><p className="text-zinc-300 whitespace-pre-wrap">{readResult.howto}</p></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 1 card SP — video reel (rip-ready) trước, phân tích sâu sau ────────────────
function SpCard({ p, picked, hasKey, onAnalyze, onPick, onSendToApp, onPlay, onAddBank, isWatched, onWatch }: {
  p: SpCandidate
  picked: boolean
  hasKey: boolean
  onAnalyze: () => void
  onPick: () => void
  onSendToApp: (a: { targetApp: string; targetField: string; data: unknown }) => void
  onPlay: (v: VidItem) => void
  onAddBank: () => void
  isWatched: boolean
  onWatch: () => void
}) {
  const branded = p.tier === 'brand'
  const win = computeWinScore(p)
  const ship = shipHint(p.shipFrom)
  const d = p.deep
  const busy = p.diving || p.filtering
  const hasDeep = !!d
  const links = buildVerifyLinks(p)

  const verdictText = p.judge?.verdict || (win.tier === 'strong' ? 'NÊN TEST' : 'CÂN NHẮC')
  const tone: Tone = branded ? 'rose' : p.judge ? judgeTone(p.judge.verdict) : win.tier === 'strong' ? 'emerald' : win.tier === 'good' ? 'amber' : 'zinc'
  const reasons = p.judge?.reasons ?? []
  const risks = [...new Set([...(p.judge?.risks ?? []), ...win.risks])]
  const costRM = d?.cost1688 ? parseFloat(d.cost1688) * 0.65 : 0
  const marginPct = (p.price > 0 && costRM > 0) ? Math.round((p.price - costRM) / p.price * 100) : null

  return (
    <div className={`rounded-lg border bg-zinc-950 p-3 flex flex-col gap-2 ${picked ? 'border-amber-500' : branded ? 'border-rose-500/30 opacity-70' : (p.vids?.count ?? 0) > 0 ? 'border-emerald-500/30' : 'border-zinc-800'}`}>
      {/* Header */}
      <div className="flex gap-3">
        {p.imageUrl
          ? <img src={p.imageUrl} alt="" className="w-16 h-16 rounded-md object-cover bg-zinc-800 shrink-0" loading="lazy" />
          : <div className="w-16 h-16 rounded-md bg-zinc-800 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-zinc-100 line-clamp-2">{p.title}</p>
          <p className="text-[11px] text-zinc-500 mt-1 truncate">{p.seller || '—'}{p.brand ? ` · ${p.brand}` : ''}</p>
        </div>
        <button onClick={onWatch} title={isWatched ? 'Bỏ ghim' : 'Ghim vào kho đã lưu (giữ qua F5 + qua các lần quét)'}
          className={`shrink-0 text-[15px] leading-none ${isWatched ? 'text-amber-400' : 'text-zinc-600 hover:text-amber-300'}`}>📌</button>
      </div>

      {/* Metrics */}
      <div className="flex items-center justify-between text-[12px] text-zinc-400 flex-wrap gap-1">
        <span>{fmt(p.sale)} bán{p.rating ? ` · ⭐${p.rating.toFixed(1)}` : ''}</span>
        <span>{p.price > 0 ? `RM${fmt(p.price)}` : 'giá —'}{p.revenue > 0 ? ` · DT RM${fmt(p.revenue)}` : ''}</span>
      </div>
      {ship && <div className={`text-[11px] ${ship.cls}`}>{ship.label}</div>}
      {(p.tier === 'oem' || p.variantRisk === 'high') && (
        <div className="flex flex-wrap gap-1">
          {p.tier === 'oem' && <span className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">🏭 nhãn xưởng · nhập sẵn</span>}
          {p.variantRisk === 'high' && <span className="text-[10px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded px-1.5 py-0.5">⚠ nhiều biến thể</span>}
        </div>
      )}

      {/* 🎥 VIDEO REEL — rip-ready (ưu tiên #1) */}
      {p.videoChecking ? (
        <div className="text-[11px] text-amber-300 animate-pulse">⏳ Đang dò video bán SP…</div>
      ) : p.vids ? (
        p.vids.count > 0 ? (() => {
          const tkN = p.vids.list.filter((v) => v.platform !== 'fb').length
          const fbN = p.vids.list.filter((v) => v.platform === 'fb').length
          return (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2">
              <p className="text-[12px] font-semibold text-emerald-300">
                🎥 {tkN} TikTok đúng SP{fbN > 0 ? <span className="text-sky-300"> · 📣 {fbN} ad FB cùng ngách</span> : null}{p.vids.maxViews > 0 ? ` · ${compact(p.vids.maxViews)} view` : ''} <span className="font-normal text-emerald-400/80">— bấm xem / tải</span>
              </p>
              {tkN > 1 && (
                <button onClick={() => downloadAll(p.vids!.list.filter((v) => v.platform !== 'fb' && v.downloadUrl).map((v) => v.downloadUrl))}
                  className="mt-0.5 text-[10px] text-violet-300 hover:text-violet-200 underline">⬇ Tải tất cả {tkN} video TikTok</button>
              )}
              <div className="flex gap-1.5 mt-1.5 overflow-x-auto pb-1">
                {p.vids.list.map((v) => {
                  const isFb = v.platform === 'fb'
                  const inner = (
                    <>
                      {v.cover ? <img src={v.cover} alt="" className="w-full h-full object-cover" loading="lazy" /> : <span className="grid place-items-center w-full h-full text-[10px]">▶</span>}
                      {v.durationSec > 0 && <span className="absolute bottom-0.5 right-0.5 bg-black/70 px-1 rounded text-[8px]">{v.durationSec}s</span>}
                      {isFb && <span className="absolute top-0.5 left-0.5 bg-sky-600/90 px-1 rounded text-[7px] font-bold text-white">FB</span>}
                    </>
                  )
                  return (
                    <div key={v.id} className="shrink-0 w-16">
                      {isFb ? (
                        <a href={v.url} target="_blank" rel="noopener noreferrer"
                          className="block relative w-16 h-24 rounded overflow-hidden border border-sky-500/40 bg-zinc-800 hover:border-sky-400" title={`FB ad · chạy ${v.days}d — mở`}>{inner}</a>
                      ) : (
                        <button onClick={() => onPlay(v)}
                          className="block relative w-16 h-24 rounded overflow-hidden border border-emerald-500/40 bg-zinc-800 hover:border-emerald-400" title={`${compact(v.views)} view · ${v.durationSec}s — xem trong app`}>{inner}</button>
                      )}
                      <div className="flex items-center justify-between mt-0.5 px-0.5">
                        <span className="text-[9px] text-zinc-500">{isFb ? `${v.days}d` : compact(v.views)}</span>
                        {!isFb && v.downloadUrl && <a href={v.downloadUrl} target="_blank" rel="noopener noreferrer" title="Tải no-watermark" className="text-[10px] text-violet-300 hover:text-violet-200">⬇</a>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })() : (
          <div className="text-[11px] text-zinc-500">🎥 0 video bán SP — chưa có creative sẵn để rip</div>
        )
      ) : null}

      {/* Thêm SP vào KHO (AI điền hồ sơ) — giống app Research */}
      {!branded && (
        p.bankAddedId ? (
          <button onClick={() => onSendToApp({ targetApp: 'finder', targetField: 'activeBank', data: 'products' })}
            className="h-8 rounded-md text-[12px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25">
            ✅ Đã thêm vào kho · Mở kho SP →
          </button>
        ) : (
          <button onClick={onAddBank} disabled={p.bankAdding || !hasKey}
            className="h-8 rounded-md text-[12px] font-medium bg-zinc-800 text-zinc-100 border border-zinc-700 hover:bg-zinc-700 disabled:opacity-50">
            {p.bankAdding ? '⏳ AI đang điền hồ sơ…' : '➕ Thêm vào kho SP'}
          </button>
        )
      )}

      {branded ? (
        <span className={`px-2 py-0.5 rounded border text-[11px] self-start ${TONE.rose}`}>🔴 BRAND BẢO HỘ · bỏ (bán lậu bị gỡ){p.brand ? ` · ${p.brand}` : ''}</span>
      ) : !hasDeep ? (
        // Triage — WIN sơ bộ + nút Phân tích sâu (tùy chọn)
        <>
          <div className="flex items-center justify-between gap-2">
            <span className={`px-2 py-0.5 rounded border text-[11px] ${TONE.zinc}`}>WIN ~{win.score} · sơ bộ</span>
            <a href={links.googleLens} target="_blank" rel="noopener noreferrer"
              className="text-[10px] text-zinc-500 hover:text-zinc-300 underline" title="Google Lens — soi branding/1688">🔍 kiểm tay</a>
          </div>
          {busy ? (
            <div className="h-10 rounded-md text-[12px] bg-amber-500/10 border border-amber-400/40 text-amber-200 grid place-items-center animate-pulse">
              {p.diving ? '⏳ Đang soi sâu (ads · 1688)…' : '⏳ Đang đào spy FB…'}
            </div>
          ) : (
            <button onClick={onAnalyze} disabled={!hasKey}
              className="h-9 rounded-md text-[12px] font-medium bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700 disabled:opacity-40">
              🔬 Phân tích sâu (ads · 1688 · Gemini)
            </button>
          )}
          {p.deepError && <p className="text-[11px] text-rose-400">{p.deepError}</p>}
        </>
      ) : (
        // Verdict gộp + spy FB + quyết định
        <>
          <div className={`rounded-md border px-2.5 py-2 ${TONE[tone]}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold">{p.judge ? '🧠' : '📊'} {verdictText}</span>
              <span className="text-[11px] opacity-80">{p.judge?.score ? `Gemini ${p.judge.score} · ` : ''}WIN {win.score}</span>
            </div>
            <div className="text-[11px] text-zinc-300/90 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
              {d!.adCount > 0 && <span>📣 {d!.adCount} ads{d!.adTopDays > 0 ? ` · chạy ${d!.adTopDays}d` : ''}{d!.adTopScale > 1 ? ` · x${d!.adTopScale}` : ''}</span>}
              <span>{d!.on1688 ? `🏭 1688 ✓${d!.count1688}${d!.cost1688 ? ` · ¥${d!.cost1688}` : ''}` : '🏭 1688 ✗'}</span>
              {marginPct !== null && <span>💰 biên ~{marginPct}%</span>}
            </div>
            {reasons.slice(0, 3).map((r, i) => <div key={`r${i}`} className="text-[10px] text-emerald-300/90 mt-0.5">+ {r}</div>)}
            {risks.slice(0, 3).map((r, i) => <div key={`k${i}`} className="text-[10px] text-rose-300/90">⚠ {r}</div>)}
            {d!.on1688 && d!.link1688 && <a href={d!.link1688} target="_blank" rel="noopener noreferrer" className="text-[10px] text-sky-400 underline">xem nguồn 1688 →</a>}
          </div>

          {!busy && (
            <div className="flex flex-wrap gap-1.5 pt-0.5 border-t border-zinc-800 mt-0.5">
              <button onClick={onPick}
                className={`h-8 px-3 rounded-md text-[12px] font-medium ${picked ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'}`}>
                {picked ? '✅ Đã chốt test' : '✅ Chốt test SP này'}
              </button>
              <button title="Mở Tìm nguồn 1688 + tự điền ảnh SP"
                onClick={() => onSendToApp({ targetApp: 'research', targetField: 'source', data: { name: p.title, imageUrl: p.imageUrl } })}
                className="h-8 px-2.5 rounded-md bg-sky-500/15 hover:bg-sky-500/25 text-[12px] text-sky-300 border border-sky-500/40">🏭 Tìm nguồn</button>
              <button title="Mở Spy Ads + tự search ad đối thủ"
                onClick={() => onSendToApp({ targetApp: 'spy-ads', targetField: 'query', data: d!.terms?.[0] || searchKeyword(p) })}
                className="h-8 px-2.5 rounded-md bg-sky-500/15 hover:bg-sky-500/25 text-[12px] text-sky-300 border border-sky-500/40">📣 Spy thêm</button>
            </div>
          )}
          {picked && <p className="text-[10px] text-emerald-400/80">Đã chốt — bước sản xuất content ở bản sau.</p>}
        </>
      )}
    </div>
  )
}
