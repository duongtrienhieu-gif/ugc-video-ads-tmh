import { ExternalLink, TrendingUp, TrendingDown, Package } from 'lucide-react'
import { useResearchStore } from '../store'
import { NICHES } from '../constants'
import { getShops, kalodataShopUrl, formatKMyr } from '../services/evidence'
import type { NicheKey } from '../types'

export default function ShopList() {
  const market = useResearchStore((s) => s.market)
  const nicheFilter = useResearchStore((s) => s.nicheFilter)
  const niches: NicheKey[] = nicheFilter === 'all' ? NICHES.map((n) => n.key) : [nicheFilter]
  const shops = getShops(market, niches)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-500">
        🏪 Shop đối thủ trong ngách — bấm <b>"Xem shop"</b> để vào spy: họ bán gì, set giá thế nào, ảnh ra sao, chiến lược gì.
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {shops.map((s) => {
          const niche = NICHES.find((n) => n.key === s.nicheKey)
          const up = s.growthRate >= 0
          return (
            <div key={s.id} className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white p-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg">{niche?.emoji ?? '🏪'}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-800">{s.name}</div>
                  <div className="truncate text-[11px] text-slate-400">{s.sellerType} · {niche?.label}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
                <span className="font-bold text-slate-800">{formatKMyr(s.revenue)}</span>
                <span className={`flex items-center gap-0.5 ${up ? 'text-emerald-600' : 'text-red-500'}`}>
                  {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {up ? '+' : ''}{s.growthRate}%
                </span>
                <span className="flex items-center gap-1"><Package className="h-3 w-3" />{s.productCount} SP</span>
              </div>
              <a
                href={kalodataShopUrl(s.id, s.market)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Xem shop (spy)
              </a>
            </div>
          )
        })}
      </div>
    </div>
  )
}
