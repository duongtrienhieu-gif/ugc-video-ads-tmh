// ── MKT Agent — UI (P1, Mô hình A) ───────────────────────────────────────────
// Stage 0: Research tìm SP win GENERIC sourceable (MY). Lọc branded/generic
// (Gemini). 1688-verify + nguồn FB ads = increment tiếp. Xem MKT_AGENT_SPEC.md.
import { useSettingsStore } from '../../stores/settingsStore'
import { useMktAgentStore, type CheckpointMode, type SpCandidate } from './store'
import { scanWinningProducts } from './services/researchStage'
import { classifyBranding } from './services/brandingFilter'

const MODE_OPTS: { key: CheckpointMode; label: string }[] = [
  { key: 'every', label: '🔴 Duyệt mọi bước (debug)' },
  { key: 'key',   label: '🟡 Duyệt 3 chốt chính' },
  { key: 'auto',  label: '🟢 Tự động' },
]

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))

function verdictOf(c: SpCandidate): { label: string; cls: string } {
  if (c.isBranded === true) return { label: '🔴 BRANDED · bỏ', cls: 'bg-rose-500/15 text-rose-300 border border-rose-500/40' }
  if (c.isBranded === false) {
    if (c.sale >= 50000) return { label: '🟢 TEST ĐƯỢC', cls: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40' }
    if (c.sale >= 5000)  return { label: '🟡 TEST · cầu vừa', cls: 'bg-amber-500/15 text-amber-300 border border-amber-500/40' }
    return { label: '⚪ generic · cầu yếu', cls: 'bg-zinc-700/40 text-zinc-300 border border-zinc-600/40' }
  }
  return { label: '⚪ chưa lọc', cls: 'bg-zinc-700/40 text-zinc-400 border border-zinc-600/40' }
}

function shipHint(s?: string): { label: string; cls: string } | null {
  if (!s) return null
  const local = /\b(MY|malaysia|kuala|selangor|johor)\b/i.test(s)
  return local
    ? { label: '📦 nội địa', cls: 'text-emerald-400' }
    : { label: '✈️ cross-border (hoàn cao)', cls: 'text-amber-400' }
}

export default function MktAgent() {
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const {
    checkpointMode, niches, amount, scanning, classifying, error, candidates, onlyGeneric, selectedSp,
    setCheckpointMode, setNiches, setAmount, setScanning, setClassifying, setError,
    setCandidates, setBranding, setOnlyGeneric, selectSp,
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

  const genericCount = candidates.filter((c) => c.isBranded === false).length
  const brandedCount = candidates.filter((c) => c.isBranded === true).length
  const shown = onlyGeneric ? candidates.filter((c) => c.isBranded !== true) : candidates

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100 p-5 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-medium text-amber-400">🤖 MKT Agent</h1>
          <p className="text-[13px] text-zinc-400 mt-0.5">
            Bắt đầu từ <b className="text-zinc-200">tìm SP win GENERIC</b> (clone-test được, sẵn trên 1688) — không phải hàng branded.
          </p>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-zinc-400">
          Chế độ duyệt
          <select
            value={checkpointMode}
            onChange={(e) => setCheckpointMode(e.target.value as CheckpointMode)}
            className="bg-zinc-900 border border-zinc-700 rounded-md px-2.5 py-1.5 text-zinc-100 text-[13px]"
          >
            {MODE_OPTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
      </div>

      {/* Stage 0 */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-amber-400 font-medium">Giai đoạn 0 · Quét SP win (Malaysia)</span>
          <span className="text-[11px] text-zinc-500">lọc branded/generic bằng AI · 1688-verify + nguồn FB = bước tới</span>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
          <label className="text-[13px] text-zinc-400">
            Ngách (cách nhau dấu phẩy — tiếng Malay)
            <input
              value={niches}
              onChange={(e) => setNiches(e.target.value)}
              placeholder="minyak urut, sakit sendi, jerawat..."
              className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 text-sm"
            />
          </label>
          <label className="text-[13px] text-zinc-400">
            SP/ngách
            <input
              type="number" min={5} max={50} value={amount}
              onChange={(e) => setAmount(Math.max(5, Math.min(50, Number(e.target.value) || 30)))}
              className="mt-1 w-24 bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 text-sm"
            />
          </label>
          <button
            onClick={scan}
            disabled={scanning || classifying}
            className="h-[42px] px-5 rounded-md font-medium bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {scanning ? 'Đang quét…' : classifying ? 'Đang lọc…' : '⚡ Quét MY'}
          </button>
        </div>

        {error && (
          <div className="mt-3 text-[13px] text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
            {error}
          </div>
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

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((p) => {
                const v = verdictOf(p)
                const ship = shipHint(p.shipFrom)
                const picked = selectedSp?.productId === p.productId
                return (
                  <div
                    key={p.productId}
                    className={`rounded-lg border bg-zinc-950 p-3 flex flex-col gap-2 ${picked ? 'border-amber-500' : 'border-zinc-800'}`}
                  >
                    <div className="flex gap-3">
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt="" className="w-16 h-16 rounded-md object-cover bg-zinc-800 shrink-0" loading="lazy" />
                        : <div className="w-16 h-16 rounded-md bg-zinc-800 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-[13px] text-zinc-100 line-clamp-2">{p.title}</p>
                        <p className="text-[11px] text-zinc-500 mt-1 truncate">
                          {p.seller || '—'}{p.brand ? ` · brand: ${p.brand}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className={`px-2 py-0.5 rounded ${v.cls}`}>{v.label}</span>
                      {ship && <span className={`text-[11px] ${ship.cls}`}>{ship.label}</span>}
                    </div>
                    <div className="flex items-center justify-between text-[12px] text-zinc-400">
                      <span>{fmt(p.sale)} bán</span>
                      <span>{p.price > 0 ? `RM${fmt(p.price)}` : 'giá —'}{p.revenue > 0 ? ` · DT RM${fmt(p.revenue)}` : ''}</span>
                    </div>
                    <button
                      onClick={() => selectSp(picked ? null : p)}
                      className={`mt-1 h-8 rounded-md text-[13px] font-medium ${picked ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'}`}
                    >
                      {picked ? '✓ Đã chọn' : 'Chọn SP này'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {selectedSp && (
        <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <p className="text-[13px] text-amber-300">✅ Đã chọn: <b>{selectedSp.title}</b></p>
          <p className="text-[12px] text-zinc-400 mt-1">
            Bước tới: verify SP có trên 1688 (ready-ship) + soi ads đối thủ → rồi mới Brief/Kịch bản/Video. Đang xây theo checkpoint cheap→expensive.
          </p>
        </div>
      )}
    </div>
  )
}
