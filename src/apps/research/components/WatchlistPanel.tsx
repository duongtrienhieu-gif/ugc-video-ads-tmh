// Danh sách Test — lưới SP đã ghim để test sau. Bấm card mở chi tiết, icon thùng rác để bỏ.
import { Trash2 } from 'lucide-react'
import type { WatchItem } from '../watchlistStore'
import { MARKET_CURRENCY, MARKETS } from '../constants'

export default function WatchlistPanel({ items, onOpen, onRemove }: {
  items: WatchItem[]
  onOpen: (productId: string) => void
  onRemove: (id: string) => void
}) {
  if (items.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/10 text-center text-slate-400">
        <p className="text-sm">📌 Danh sách Test trống.</p>
        <p className="text-xs">Mở 1 sản phẩm → bấm <b>Đưa vào danh sách Test</b> để ghim lại đây.</p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
      {items.map((it) => {
        const p = it.product
        const cur = MARKET_CURRENCY[p.market] ?? ''
        const flag = MARKETS.find((m) => m.key === p.market)?.flag ?? ''
        return (
          <div key={it.id} className="group relative flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
            <button
              onClick={() => onRemove(it.id)}
              title="Bỏ khỏi Danh sách Test"
              className="absolute right-1.5 top-1.5 z-10 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity hover:bg-red-500 group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onOpen(p.productId)} className="flex flex-1 flex-col text-left">
              <div className="aspect-square w-full bg-slate-100">
                {p.imageUrl && (
                  <img src={p.imageUrl} alt="" className="h-full w-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                )}
              </div>
              <div className="flex flex-col gap-1 p-2.5">
                <p className="line-clamp-2 text-xs font-semibold text-slate-700">{p.title}</p>
                <div className="text-[11px] text-slate-500">
                  {flag} {p.sale.toLocaleString('vi-VN')} đã bán · {cur} {p.unitPrice.toLocaleString('vi-VN')}
                </div>
              </div>
            </button>
          </div>
        )
      })}
    </div>
  )
}
