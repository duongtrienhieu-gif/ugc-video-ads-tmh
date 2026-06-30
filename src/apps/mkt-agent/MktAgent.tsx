// ── MKT Agent — UI (1-logic: Triage → Phân tích → Quyết định) ────────────────
// Giai đoạn 0: Quét SP win GENERIC sourceable (MY). Mỗi SP đi đúng 1 mạch:
//   1) Triage (số bán + WIN sơ bộ)  →  2) 1 nút "Phân tích" (soi sâu + đào spy)
//   →  3) Verdict gộp (Gemini + WIN) + video spy đối thủ → ra quyết định.
// Gộp 3 hệ chấm điểm cũ làm 1, ẩn nút thừa, lộ dần theo bước. Xem MKT_AGENT_SPEC.md.
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import { useMktAgentStore, type SpCandidate } from './store'
import { scanWinningProducts } from './services/researchStage'
import { classifyBranding } from './services/brandingFilter'
import { buildVerifyLinks, deepDive, searchKeyword } from './services/enrichStage'
import { judgeSp } from './services/judge'
import { harvestExactSpy } from './services/harvestSpy'
import { computeWinScore } from './services/winScore'

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))
const compact = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n)

// Gộp verdict: ưu tiên Gemini (lập luận), WIN số làm điểm phụ.
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

export default function MktAgent() {
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const sendToApp = useAppStore((s) => s.sendToApp)
  const {
    niches, amount, scanning, classifying, error, candidates, onlyGeneric, selectedSp,
    setNiches, setAmount, setScanning, setClassifying, setError,
    setCandidates, setBranding, patchCandidate, setOnlyGeneric, selectSp,
  } = useMktAgentStore()

  const scan = async () => {
    setScanning(true); setError(null); selectSp(null); setCandidates([])
    try {
      const res = await scanWinningProducts(niches.split(','), amount)
      setCandidates(res.candidates)
      if (!res.candidates.length) { setError('Không tìm thấy SP — thử đổi/thêm ngách.'); return }
      if (!geminiApiKey) { setError('Có SP rồi — nhưng cần Gemini key (Cài đặt) để lọc branded/generic.'); return }
      setClassifying(true)
      try {
        const map = await classifyBranding(geminiApiKey, res.candidates.map((c) => ({ id: c.productId, title: c.title })))
        setBranding(map)
      } catch {
        setError('Quét xong nhưng lọc branded lỗi (thử lại). Vẫn xem được danh sách thô.')
      } finally {
        setClassifying(false)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setScanning(false)
    }
  }

  // 1 NÚT = cả mạch: soi sâu (video/ads/1688) → giám khảo Gemini → đào spy đúng SP.
  const analyzeSp = async (c: SpCandidate) => {
    if (!geminiApiKey) { setError('Cần Gemini key (Cài đặt) để phân tích.'); return }
    if (!c.imageUrl) { patchCandidate(c.productId, { deepError: 'SP thiếu ảnh — không phân tích được.' }); return }
    patchCandidate(c.productId, { diving: true, deepError: undefined })
    let deep = c.deep
    try {
      if (!deep) {
        deep = await deepDive(c, geminiApiKey)
        patchCandidate(c.productId, { deep, diving: false })
        try {
          const judge = await judgeSp(geminiApiKey, { ...c, deep })
          patchCandidate(c.productId, { judge })
        } catch { /* giám khảo lỗi → vẫn giữ số Soi sâu */ }
      } else {
        patchCandidate(c.productId, { diving: false })
      }
    } catch (e) {
      patchCandidate(c.productId, { diving: false, deepError: (e as Error).message })
      return
    }
    // Đào spy đối thủ đúng SP (nếu có ad ứng viên + chưa đào).
    if (deep && !deep.exactChecked && deep.rawAds?.length) {
      patchCandidate(c.productId, { filtering: true })
      try {
        const exact = await harvestExactSpy(geminiApiKey, c.imageUrl, deep.rawAds, 5)
        patchCandidate(c.productId, { filtering: false, deep: { ...deep, exactCount: exact.length, exactChecked: true, exactAds: exact.slice(0, 10) } })
      } catch {
        patchCandidate(c.productId, { filtering: false })
      }
    }
  }

  const genericCount = candidates.filter((c) => c.isBranded === false).length
  const brandedCount = candidates.filter((c) => c.isBranded === true).length
  const shown = onlyGeneric ? candidates.filter((c) => c.isBranded !== true) : candidates

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100 p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-medium text-amber-400">🤖 MKT Agent</h1>
        <p className="text-[13px] text-zinc-400 mt-0.5">
          Quét <b className="text-zinc-200">SP win GENERIC</b> (clone-test được, sẵn 1688) → <b className="text-zinc-200">Phân tích 1 chạm</b> → xem spy đối thủ → quyết định.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-amber-400 font-medium">Bước 1 · Quét SP win (Malaysia)</span>
          <span className="text-[11px] text-zinc-500">tự lọc branded · sort theo số bán</span>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
          <label className="text-[13px] text-zinc-400">
            Ngách (cách nhau dấu phẩy — tiếng Malay)
            <input value={niches} onChange={(e) => setNiches(e.target.value)}
              placeholder="minyak urut, sakit sendi, jerawat..."
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

        {candidates.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
              <p className="text-[12px] text-zinc-500">
                {candidates.length} SP · {classifying ? 'đang lọc branded…' : <><span className="text-emerald-400">{genericCount} generic</span> · <span className="text-rose-400">{brandedCount} branded</span></>} · sort theo số bán
              </p>
              <label className="flex items-center gap-1.5 text-[12px] text-zinc-300 cursor-pointer">
                <input type="checkbox" checked={onlyGeneric} onChange={(e) => setOnlyGeneric(e.target.checked)} />
                Chỉ hiện generic (ẩn branded)
              </label>
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
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 1 card SP — 3 trạng thái: triage → đang phân tích → verdict + spy ─────────
function SpCard({ p, picked, hasKey, onAnalyze, onPick, onSendToApp }: {
  p: SpCandidate
  picked: boolean
  hasKey: boolean
  onAnalyze: () => void
  onPick: () => void
  onSendToApp: (a: { targetApp: string; targetField: string; data: unknown }) => void
}) {
  const branded = p.isBranded === true
  const win = computeWinScore(p)
  const ship = shipHint(p.shipFrom)
  const d = p.deep
  const busy = p.diving || p.filtering
  const hasDeep = !!d
  const links = buildVerifyLinks(p)

  // Verdict gộp (sau phân tích): Gemini headline + WIN số phụ + lý do/rủi ro.
  const verdictText = p.judge?.verdict || (win.tier === 'strong' ? 'NÊN TEST' : win.tier === 'weak' ? 'CÂN NHẮC' : 'CÂN NHẮC')
  const tone: Tone = branded ? 'rose' : p.judge ? judgeTone(p.judge.verdict) : win.tier === 'strong' ? 'emerald' : win.tier === 'good' ? 'amber' : 'zinc'
  const reasons = p.judge?.reasons ?? []
  const risks = [...new Set([...(p.judge?.risks ?? []), ...win.risks])]
  const costRM = d?.cost1688 ? parseFloat(d.cost1688) * 0.65 : 0
  const marginPct = (p.price > 0 && costRM > 0) ? Math.round((p.price - costRM) / p.price * 100) : null

  return (
    <div className={`rounded-lg border bg-zinc-950 p-3 flex flex-col gap-2 ${picked ? 'border-amber-500' : branded ? 'border-rose-500/30 opacity-70' : 'border-zinc-800'}`}>
      {/* Header */}
      <div className="flex gap-3">
        {p.imageUrl
          ? <img src={p.imageUrl} alt="" className="w-16 h-16 rounded-md object-cover bg-zinc-800 shrink-0" loading="lazy" />
          : <div className="w-16 h-16 rounded-md bg-zinc-800 shrink-0" />}
        <div className="min-w-0">
          <p className="text-[13px] text-zinc-100 line-clamp-2">{p.title}</p>
          <p className="text-[11px] text-zinc-500 mt-1 truncate">{p.seller || '—'}{p.brand ? ` · ${p.brand}` : ''}</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="flex items-center justify-between text-[12px] text-zinc-400 flex-wrap gap-1">
        <span>{fmt(p.sale)} bán{p.rating ? ` · ⭐${p.rating.toFixed(1)}` : ''}</span>
        <span>{p.price > 0 ? `RM${fmt(p.price)}` : 'giá —'}{p.revenue > 0 ? ` · DT RM${fmt(p.revenue)}` : ''}</span>
      </div>
      {ship && <div className={`text-[11px] ${ship.cls}`}>{ship.label}</div>}

      {branded ? (
        <span className={`px-2 py-0.5 rounded border text-[11px] self-start ${TONE.rose}`}>🔴 BRANDED · bỏ (không clone được)</span>
      ) : !hasDeep ? (
        // ── TRẠNG THÁI 1: TRIAGE — 1 chip WIN sơ bộ + 1 nút Phân tích ──
        <>
          <div className="flex items-center justify-between gap-2">
            <span className={`px-2 py-0.5 rounded border text-[11px] ${TONE.zinc}`} title="Điểm sơ bộ (chỉ theo số bán). Bấm Phân tích để chấm đủ.">
              WIN ~{win.score} · sơ bộ
            </span>
            <a href={links.googleLens} target="_blank" rel="noopener noreferrer"
              className="text-[10px] text-zinc-500 hover:text-zinc-300 underline" title="Google Lens — soi branding/1688 bằng mắt (tùy chọn)">🔍 kiểm tay</a>
          </div>
          {busy ? (
            <div className="h-10 rounded-md text-[12px] bg-amber-500/10 border border-amber-400/40 text-amber-200 grid place-items-center animate-pulse">
              {p.diving ? '⏳ Đang soi sâu (video · ads · 1688)…' : '⏳ Đang đào spy đối thủ…'}
            </div>
          ) : (
            <button onClick={onAnalyze} disabled={!hasKey}
              className="h-10 rounded-md text-[13px] font-semibold bg-amber-400 text-zinc-950 hover:bg-amber-300 shadow-lg shadow-amber-400/40 disabled:opacity-40 disabled:shadow-none">
              🔬 Phân tích SP này
            </button>
          )}
          <p className="text-[10px] text-zinc-600 -mt-0.5">{hasKey ? 'Soi sâu + đào spy đối thủ · dùng quota API ngoài' : 'Cần Gemini key (Cài đặt)'}</p>
          {p.deepError && <p className="text-[11px] text-rose-400">{p.deepError}</p>}
        </>
      ) : (
        // ── TRẠNG THÁI 2/3: VERDICT GỘP + SPY + QUYẾT ĐỊNH ──
        <>
          {/* Verdict gộp 1 khối */}
          <div className={`rounded-md border px-2.5 py-2 ${TONE[tone]}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold">{p.judge ? '🧠' : '📊'} {verdictText}</span>
              <span className="text-[11px] opacity-80">{p.judge?.score ? `Gemini ${p.judge.score}` : ''}{p.judge?.score ? ' · ' : ''}WIN {win.score}</span>
            </div>
            {/* Bằng chứng 1 dòng */}
            <div className="text-[11px] text-zinc-300/90 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
              {d!.videoCount > 0 && <span>🎬 {d!.videoCount} video{d!.maxViews > 0 ? ` · ${compact(d!.maxViews)} view` : ''}</span>}
              {d!.adCount > 0 && <span>📣 {d!.adCount} ads{d!.adTopDays > 0 ? ` · chạy ${d!.adTopDays}d` : ''}{d!.adTopScale > 1 ? ` · x${d!.adTopScale}` : ''}</span>}
              <span>{d!.on1688 ? `🏭 1688 ✓${d!.count1688}${d!.cost1688 ? ` · ¥${d!.cost1688}` : ''}` : '🏭 1688 ✗'}</span>
              {marginPct !== null && <span>💰 biên ~{marginPct}%</span>}
            </div>
            {reasons.slice(0, 3).map((r, i) => <div key={`r${i}`} className="text-[10px] text-emerald-300/90 mt-0.5">+ {r}</div>)}
            {risks.slice(0, 3).map((r, i) => <div key={`k${i}`} className="text-[10px] text-rose-300/90">⚠ {r}</div>)}
            {d!.on1688 && d!.link1688 && <a href={d!.link1688} target="_blank" rel="noopener noreferrer" className="text-[10px] text-sky-400 underline">xem nguồn 1688 →</a>}
          </div>

          {/* SPY đối thủ — payload để quyết định */}
          {p.filtering ? (
            <div className="h-10 rounded-md text-[12px] bg-amber-500/10 border border-amber-400/40 text-amber-200 grid place-items-center animate-pulse">⏳ Đang đào spy đối thủ…</div>
          ) : d!.exactChecked ? (
            <div>
              <p className={`text-[12px] font-medium ${(d!.exactCount ?? 0) >= 5 ? 'text-emerald-300' : 'text-amber-300'}`}>
                🎯 {d!.exactCount} video spy ĐÚNG SP {(d!.exactCount ?? 0) >= 5 ? '✓ đủ 5' : (d!.exactCount ?? 0) === 0 ? '— gần như không có đối thủ COD (cân nhắc bỏ)' : '— chưa đủ 5'}
              </p>
              {d!.exactAds && d!.exactAds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {d!.exactAds.slice(0, 10).map((a) => (
                    <a key={a.id} href={a.videoUrl} target="_blank" rel="noopener noreferrer" title={`${a.platform} · chạy ${a.days}d — mở video`}
                      className="block w-11 h-11 rounded overflow-hidden border border-emerald-500/40 bg-zinc-800 hover:border-emerald-400">
                      {a.cover ? <img src={a.cover} alt="" className="w-full h-full object-cover" loading="lazy" /> : <span className="text-[9px] grid place-items-center w-full h-full">▶</span>}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-zinc-500">Không tìm thấy ad đối thủ để đào (keyword nông / SP ít cầu paid).</p>
          )}

          {/* Quyết định + bước tiếp */}
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
          {picked && <p className="text-[10px] text-emerald-400/80">Đã chốt — bước sản xuất content (Brief→kịch bản→video) ở bản sau.</p>}
        </>
      )}
    </div>
  )
}
