// ── MKT Agent — UI (P1, Mô hình A) ───────────────────────────────────────────
// Giai đoạn 0: Research tìm SP win (MY). Các stage sau (Spy → content → Drive)
// build dần theo checkpoint cheap→expensive. Xem BaoCao/MKT_AGENT_SPEC.md.
import { useMktAgentStore, type CheckpointMode } from './store'
import { scanWinningProducts } from './services/researchStage'
import type { Verdict } from '../research/types'

const VERDICT_STYLE: Record<Verdict, { label: string; cls: string }> = {
  go:       { label: '🟢 GO',       cls: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40' },
  consider: { label: '🟡 CÂN NHẮC', cls: 'bg-amber-500/15 text-amber-300 border border-amber-500/40' },
  avoid:    { label: '🔴 BỎ',       cls: 'bg-rose-500/15 text-rose-300 border border-rose-500/40' },
}

const MODE_OPTS: { key: CheckpointMode; label: string }[] = [
  { key: 'every', label: '🔴 Duyệt mọi bước (debug)' },
  { key: 'key',   label: '🟡 Duyệt 3 chốt chính' },
  { key: 'auto',  label: '🟢 Tự động' },
]

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))

export default function MktAgent() {
  const {
    checkpointMode, niches, amount, scanning, error, candidates, selectedSp,
    setCheckpointMode, setNiches, setAmount, setScanning, setError, setCandidates, selectSp,
  } = useMktAgentStore()

  const scan = async () => {
    setScanning(true); setError(null); selectSp(null); setCandidates([])
    try {
      const res = await scanWinningProducts(niches.split(','), amount)
      setCandidates(res.products)
      if (!res.products.length) setError('Không tìm thấy SP nào — thử đổi/ thêm ngách.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100 p-5 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-medium text-amber-400">🤖 MKT Agent</h1>
          <p className="text-[13px] text-zinc-400 mt-0.5">
            Nhân viên Marketing AI — bắt đầu từ <b className="text-zinc-200">tìm sản phẩm win (MY)</b>. Duyệt từng bước, rẻ trước đắt sau.
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

      {/* Stage rail */}
      <div className="flex items-center gap-2 text-[12px] mb-5 overflow-x-auto">
        <Step n="0" label="Research" active />
        <Sep /><Step n="1" label="Spy" />
        <Sep /><Step n="2" label="Kịch bản" />
        <Sep /><Step n="3" label="Video" />
        <Sep /><Step n="4" label="Landing" />
        <Sep /><Step n="5" label="Xả Drive" />
      </div>

      {/* Stage 0 — Research */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-amber-400 font-medium">Giai đoạn 0 · Quét SP win (Malaysia)</span>
          <span className="text-[11px] text-zinc-500">~rẻ · tín hiệu cầu, không bảo chứng thắng</span>
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
            disabled={scanning}
            className="h-[42px] px-5 rounded-md font-medium bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {scanning ? 'Đang quét…' : '⚡ Quét MY'}
          </button>
        </div>

        {error && (
          <div className="mt-3 text-[13px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {/* Kết quả */}
        {candidates.length > 0 && (
          <div className="mt-4">
            <p className="text-[12px] text-zinc-500 mb-2">{candidates.length} SP · sắp theo điểm cầu cao → thấp. Chọn 1 SP để qua giai đoạn sau.</p>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {candidates.map((p) => {
                const v = VERDICT_STYLE[p.verdict] ?? VERDICT_STYLE.avoid
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
                        <p className="text-[11px] text-zinc-500 mt-1 truncate">{p.seller || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className={`px-2 py-0.5 rounded ${v.cls}`}>{v.label} · {Math.round(p.score)}đ</span>
                      <span className="text-zinc-400">{fmt(p.sale)} bán · RM{fmt(p.unitPrice)}</span>
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

      {/* SP đã chọn → cầu nối stage sau (đang xây) */}
      {selectedSp && (
        <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <p className="text-[13px] text-amber-300">
            ✅ Đã chọn: <b>{selectedSp.title}</b> ({Math.round(selectedSp.score)}đ)
          </p>
          <p className="text-[12px] text-zinc-400 mt-1">
            Giai đoạn kế (Spy đối thủ → Brief → Kịch bản → Video → Landing → Drive) đang được xây theo checkpoint. Stage 0 đã chạy thật — tới đây để bạn kiểm độ chính xác trước khi tốn credit.
          </p>
        </div>
      )}
    </div>
  )
}

function Step({ n, label, active }: { n: string; label: string; active?: boolean }) {
  return (
    <span className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${active ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40' : 'text-zinc-500'}`}>
      <span className={`w-4 h-4 rounded-full text-[10px] grid place-items-center ${active ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400'}`}>{n}</span>
      {label}
    </span>
  )
}
function Sep() { return <span className="shrink-0 text-zinc-700">→</span> }
