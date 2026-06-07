import { TrendingUp, TrendingDown, Users, Tag } from 'lucide-react'
import type { ScoredProduct } from '../types'
import { VERDICT_META, NICHES } from '../constants'
import { formatKMyr } from '../services/evidence'

interface Props {
  product: ScoredProduct
  onOpen: (id: string) => void
}

export default function OpportunityCard({ product: p, onOpen }: Props) {
  const v = VERDICT_META[p.verdict]
  const niche = NICHES.find((n) => n.key === p.nicheKey)
  const up = p.growthRate >= 0

  return (
    <button
      onClick={() => onOpen(p.productId)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* Ảnh: nếu có image_url thật thì hiện ảnh, không thì emoji */}
      <div className="relative flex h-28 items-center justify-center overflow-hidden bg-slate-100">
        {p.imageUrl ? (
          <img
            src={p.imageUrl}
            alt={p.title}
            className="h-full w-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <span className="text-4xl">{niche?.emoji ?? '📦'}</span>
        )}
        <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-slate-700 shadow-sm">
          ⭐ {p.score}
        </span>
        <span className={`absolute left-2 top-2 rounded-full border px-2 py-0.5 text-[11px] font-bold ${v.bg} ${v.color}`}>
          {v.emoji} {v.label}
        </span>
      </div>

      {/* Nội dung */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-slate-800">{p.title}</h3>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-bold text-slate-800">{formatKMyr(p.revenue)}</span>
          <span className="text-slate-400">· {p.sale} đơn</span>
        </div>

        <ul className="flex flex-col gap-0.5 text-xs text-slate-500">
          {p.reasons.map((r, i) => (
            <li key={i} className="line-clamp-1">• {r}</li>
          ))}
        </ul>

        <div className="mt-auto flex items-center gap-3 pt-1 text-xs font-medium text-slate-600">
          <span className={`flex items-center gap-1 ${up ? 'text-emerald-600' : 'text-red-500'}`}>
            {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {up ? '+' : ''}{Math.round(p.growthRate)}%
          </span>
          <span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" />RM{p.unitPrice}</span>
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{p.creatorNum}</span>
        </div>
      </div>
    </button>
  )
}
