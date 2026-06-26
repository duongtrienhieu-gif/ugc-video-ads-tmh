// Danh sách Test — lưới SP đã ghim, có trạng thái (Mới/Đang test/Win/Bỏ), người phụ trách, ghi chú.
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { WatchItem, WatchStatus } from '../watchlistStore'
import { WATCH_STATUS_META } from '../watchlistStore'
import { MARKET_CURRENCY, MARKETS } from '../constants'

const STATUSES: WatchStatus[] = ['new', 'testing', 'win', 'killed']

export default function WatchlistPanel({ items, onOpen, onRemove, onUpdate }: {
  items: WatchItem[]
  onOpen: (productId: string) => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<Pick<WatchItem, 'status' | 'assignee' | 'note'>>) => void
}) {
  const [filter, setFilter] = useState<WatchStatus | 'all'>('all')
  const shown = filter === 'all' ? items : items.filter((i) => i.status === filter)

  if (items.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/10 text-center text-slate-400">
        <p className="text-sm">📌 Danh sách Test trống.</p>
        <p className="text-xs">Mở 1 sản phẩm → bấm <b>Đưa vào danh sách Test</b> để ghim lại đây.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Lọc theo trạng thái */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${filter === 'all' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-black/10'}`}
        >
          Tất cả ({items.length})
        </button>
        {STATUSES.map((s) => {
          const n = items.filter((i) => i.status === s).length
          const m = WATCH_STATUS_META[s]
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${filter === s ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-black/10'}`}
            >
              {m.emoji} {m.label} ({n})
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
        {shown.map((it) => {
          const p = it.product
          const cur = MARKET_CURRENCY[p.market] ?? ''
          const flag = MARKETS.find((m) => m.key === p.market)?.flag ?? ''
          const meta = WATCH_STATUS_META[it.status]
          return (
            <div key={it.id} className="group relative flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
              <button
                onClick={() => onRemove(it.id)}
                title="Bỏ khỏi Danh sách Test"
                className="absolute right-1.5 top-1.5 z-10 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity hover:bg-red-500 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <span className={`absolute left-1.5 top-1.5 z-10 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.cls}`}>
                {meta.emoji} {meta.label}
              </span>
              <button onClick={() => onOpen(p.productId)} className="flex flex-col text-left">
                <div className="aspect-square w-full bg-slate-100">
                  {p.imageUrl && (
                    <img src={p.imageUrl} alt="" className="h-full w-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                  )}
                </div>
                <div className="flex flex-col gap-1 p-2.5 pb-1.5">
                  <p className="line-clamp-2 text-xs font-semibold text-slate-700">{p.title}</p>
                  <div className="text-[11px] text-slate-500">
                    {flag} {p.sale.toLocaleString('vi-VN')} đã bán · {cur} {p.unitPrice.toLocaleString('vi-VN')}
                  </div>
                </div>
              </button>

              {/* Quản lý: trạng thái + người phụ trách + ghi chú */}
              <div className="flex flex-col gap-1.5 border-t border-black/5 p-2.5 pt-2">
                <select
                  value={it.status}
                  onChange={(e) => onUpdate(it.id, { status: e.target.value as WatchStatus })}
                  className="rounded-lg border border-black/10 bg-white px-2 py-1 text-[11px] font-medium"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{WATCH_STATUS_META[s].emoji} {WATCH_STATUS_META[s].label}</option>
                  ))}
                </select>
                <input
                  defaultValue={it.assignee}
                  onBlur={(e) => { if (e.target.value !== it.assignee) onUpdate(it.id, { assignee: e.target.value }) }}
                  placeholder="👤 Người phụ trách"
                  className="rounded-lg border border-black/10 bg-white px-2 py-1 text-[11px]"
                />
                <textarea
                  defaultValue={it.note}
                  onBlur={(e) => { if (e.target.value !== it.note) onUpdate(it.id, { note: e.target.value }) }}
                  placeholder="📝 Ghi chú test (CPA, kết quả…)"
                  rows={2}
                  className="resize-none rounded-lg border border-black/10 bg-white px-2 py-1 text-[11px]"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
