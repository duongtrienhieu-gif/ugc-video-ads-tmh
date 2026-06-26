// Cross-market Heat-Map — so 1 từ khóa giữa 5 nước (theo TỔNG SỐ BÁN top 30).
// Mục tiêu: thấy ngách nổ ở đâu, MY đã có chưa → cơ hội đem về MY bán sớm.
import { X, Flame } from 'lucide-react'
import { MARKETS } from '../constants'
import { formatCount } from '../services/evidence'
import type { CrossRow } from '../store'

export default function CrossMarketPanel({
  rows, query, loading, onClose,
}: { rows: CrossRow[] | null; query: string; loading: boolean; onClose: () => void }) {
  const sorted = (rows ?? []).slice().sort((a, b) => b.totalSold - a.totalSold)
  const max = Math.max(1, ...sorted.map((r) => r.totalSold))
  const my = sorted.find((r) => r.market === 'MY')
  const topMkt = sorted[0]
  const myRank = my ? sorted.findIndex((r) => r.market === 'MY') + 1 : 0

  // Câu chốt cơ hội
  let insight = ''
  if (topMkt && my) {
    const mlabel = (k: string) => MARKETS.find((m) => m.key === k)?.label ?? k
    if (topMkt.market !== 'MY' && topMkt.totalSold > my.totalSold * 1.5) {
      insight = `🔥 "${query}" đang NỔ ở ${mlabel(topMkt.market)} (${formatCount(topMkt.totalSold)} bán) — gấp ${(topMkt.totalSold / Math.max(1, my.totalSold)).toFixed(1)}× Malaysia. Cơ hội đem về MY bán sớm!`
    } else if (topMkt.market === 'MY') {
      insight = `🇲🇾 "${query}" mạnh nhất ở chính Malaysia — sân nhà, cạnh tranh cao.`
    } else {
      insight = `"${query}": MY đang xếp #${myRank}/5. Chênh lệch không lớn — cân nhắc.`
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-violet-800">
          🌏 Cross-market: <span className="rounded bg-white px-2 py-0.5 text-violet-700">{query}</span>
        </h3>
        <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-black/5"><X className="h-4 w-4" /></button>
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-slate-400">Đang quét 5 thị trường…</div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {sorted.map((r) => {
              const meta = MARKETS.find((m) => m.key === r.market)
              const pct = Math.round((r.totalSold / max) * 100)
              const isMy = r.market === 'MY'
              const isTop = r === topMkt && r.totalSold > 0
              return (
                <div key={r.market} className={`rounded-xl border p-2.5 ${isMy ? 'border-violet-300 bg-white' : 'border-black/5 bg-white/70'}`}>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-28 shrink-0 font-semibold text-slate-700">
                      {meta?.flag} {meta?.label}{isMy && <span className="ml-1 text-[10px] text-violet-600">(của mình)</span>}
                    </span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${isTop ? 'bg-orange-500' : isMy ? 'bg-violet-500' : 'bg-slate-300'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-24 shrink-0 text-right font-bold text-slate-700">
                      {isTop && <Flame className="mr-0.5 inline h-3 w-3 text-orange-500" />}{formatCount(r.totalSold)} bán
                    </span>
                  </div>
                  {r.topTitle && (
                    <div className="mt-1 flex items-center gap-2 pl-28 text-[11px] text-slate-400">
                      {r.topImage && <img src={r.topImage} alt="" className="h-5 w-5 rounded object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />}
                      <span className="line-clamp-1">Top: {r.topTitle} ({formatCount(r.topSold)} bán) · {r.count} SP</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {insight && (
            <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-700">{insight}</p>
          )}
        </>
      )}
    </div>
  )
}
