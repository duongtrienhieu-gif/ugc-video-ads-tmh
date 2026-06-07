import { useState } from 'react'
import { X, Check, AlertTriangle, XCircle, Plus } from 'lucide-react'
import type { ScoredProduct, SignalResult } from '../types'
import { VERDICT_META, NICHES } from '../constants'
import PricingCalculator from './PricingCalculator'

const STATUS_ICON: Record<SignalResult['status'], React.ReactNode> = {
  pass: <Check className="h-4 w-4 text-emerald-500" />,
  warn: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  fail: <XCircle className="h-4 w-4 text-red-400" />,
}

function Sparkline({ data }: { data?: number[] }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data), min = Math.min(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - ((v - min) / range) * 28}`).join(' ')
  return (
    <svg viewBox="0 0 100 30" className="h-10 w-full" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="#10b981" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export default function ProductDetail({ product, onClose }: { product: ScoredProduct; onClose: () => void }) {
  const [tab, setTab] = useState<'overview' | 'pricing'>('overview')
  const v = VERDICT_META[product.verdict]
  const niche = NICHES.find((n) => n.key === product.nicheKey)
  const passCount = product.signals.filter((s) => s.status === 'pass').length

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-black/10 p-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl">
            {niche?.emoji ?? '📦'}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold leading-snug text-slate-800">{product.title}</h2>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">⭐ {product.score}/100</span>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${v.bg} ${v.color}`}>{v.emoji} {v.label}</span>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-black/5"><X className="h-5 w-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-black/10 px-3">
          {([['overview', 'Tổng quan'], ['pricing', 'Setup giá']] as const).map(([k, label]) => (
            <button
              key={k} onClick={() => setTab(k)}
              className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === k ? 'border-violet-500 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'overview' ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-black/10 bg-slate-50 p-3">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>Xu hướng doanh thu</span>
                  <span className="font-semibold text-slate-700">RM{(product.revenue / 1000).toFixed(1)}k · {product.sale} đơn</span>
                </div>
                <Sparkline data={product.revenueTrend} />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700">Go / No-Go</h3>
                  <span className="text-xs font-semibold text-slate-500">{passCount}/{product.signals.length} tiêu chí đạt</span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {product.signals.map((s) => (
                    <li key={s.key} className="flex items-start gap-2 rounded-lg border border-black/10 px-3 py-2">
                      <span className="mt-0.5">{STATUS_ICON[s.status]}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700">{s.label}</span>
                          <span className="text-xs font-bold text-slate-600">{s.display}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">{s.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <button className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700">
                <Plus className="h-4 w-4" /> Đưa vào danh sách Test
              </button>
            </div>
          ) : (
            <PricingCalculator defaultPriceMyr={product.unitPrice} />
          )}
        </div>
      </aside>
    </>
  )
}
