import { useMemo, useState } from 'react'
import { X, Check, AlertTriangle, XCircle, Plus, Play, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react'
import type { Market, ScoredProduct, SignalResult } from '../types'
import { VERDICT_META, NICHES, MARKETS } from '../constants'
import { formatMyr } from '../services/pricing'
import { getVideosFor, getCreatorsFor, getCrossMarketFor, formatCount, formatKMyr } from '../services/evidence'
import PricingCalculator from './PricingCalculator'

type Tab = 'overview' | 'video' | 'creator' | 'market' | 'pricing'

const KALODATA_CURRENCY: Record<Market, string> = { MY: 'MYR', TH: 'THB', ID: 'IDR', VN: 'VND' }
function kalodataUrl(productId: string, market: Market): string {
  // demo: bỏ hậu tố thị trường (-th/-id/-vn) đã thêm cho data mẫu;
  // data thật: product_id chính là id Kalodata nên link trỏ đúng sản phẩm.
  const id = productId.replace(/-(th|id|vn)$/i, '')
  return `https://www.kalodata.com/product/detail?id=${encodeURIComponent(id)}&language=vi-VN&currency=${KALODATA_CURRENCY[market]}&region=${market}`
}

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
    <svg viewBox="0 0 100 30" className="h-12 w-full" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="#10b981" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export default function ProductDetail({ product, onClose }: { product: ScoredProduct; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('overview')
  const v = VERDICT_META[product.verdict]
  const niche = NICHES.find((n) => n.key === product.nicheKey)
  const passCount = product.signals.filter((s) => s.status === 'pass').length

  const videos = useMemo(() => getVideosFor(product), [product.productId])
  const creators = useMemo(() => getCreatorsFor(product), [product.productId])
  const crossMarket = useMemo(() => getCrossMarketFor(product), [product.productId])

  const metrics: { label: string; value: string }[] = [
    { label: 'Doanh thu', value: formatKMyr(product.revenue) },
    { label: 'Lượt bán', value: `${product.sale} đơn` },
    { label: 'Đơn giá', value: `RM${product.unitPrice}` },
    { label: 'DT từ video', value: formatKMyr(product.videoRevenue ?? 0) },
    { label: 'Hoa hồng', value: `${Math.round(product.commissionRate)}%` },
    { label: 'Số creator', value: `${product.creatorNum}` },
    { label: 'Số shop bán', value: `${product.competitionShops}` },
    { label: 'Đánh giá', value: `${product.rating.toFixed(1)}★` },
  ]

  const TABS: [Tab, string][] = [
    ['overview', 'Tổng quan'], ['video', 'Video thắng'], ['creator', 'Creator'], ['market', 'Thị trường'], ['pricing', 'Giá'],
  ]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-black/10 p-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl">{niche?.emoji ?? '📦'}</div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold leading-snug text-slate-800">{product.title}</h2>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">⭐ {product.score}/100</span>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${v.bg} ${v.color}`}>{v.emoji} {v.label}</span>
            </div>
            <a
              href={kalodataUrl(product.productId, product.market)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Xem trên Kalodata
            </a>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-black/5"><X className="h-5 w-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-black/10 px-3">
          {TABS.map(([k, label]) => (
            <button
              key={k} onClick={() => setTab(k)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === k ? 'border-violet-500 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* ── TỔNG QUAN ── */}
          {tab === 'overview' && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-black/10 bg-slate-50 p-3">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>Xu hướng doanh thu</span>
                  <span className="font-semibold text-slate-700">{formatKMyr(product.revenue)} · {product.sale} đơn</span>
                </div>
                <Sparkline data={product.revenueTrend} />
              </div>

              <div className="grid grid-cols-4 gap-2">
                {metrics.map((m) => (
                  <div key={m.label} className="rounded-lg border border-black/10 bg-white p-2 text-center">
                    <div className="text-sm font-bold text-slate-800">{m.value}</div>
                    <div className="text-[10px] text-slate-400">{m.label}</div>
                  </div>
                ))}
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
          )}

          {/* ── VIDEO THẮNG ── */}
          {tab === 'video' && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-500">🎥 Video đang bán tốt sản phẩm này — học góc content thắng để brief creator.</p>
              {videos.map((vid) => (
                <div key={vid.id} className="flex gap-3 rounded-xl border border-black/10 p-2.5">
                  <div className="relative flex h-16 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-200">
                    <Play className="h-5 w-5 text-slate-500" />
                    <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[9px] font-bold text-white">{vid.durationSec}s</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-xs font-semibold text-slate-700">{vid.caption}</p>
                    <p className="text-[11px] text-slate-400">{vid.handle}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-medium text-slate-600">
                      <span>👁 {formatCount(vid.views)} view</span>
                      <span className="text-emerald-600">{formatMyr(vid.gmv)} GMV</span>
                      <span className="text-violet-600">ROAS {vid.adRoas}x</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── CREATOR ── */}
          {tab === 'creator' && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-500">👤 Creator đang đẩy sản phẩm — đã có cầu nên dễ tuyển hơn làm từ đầu.</p>
              {creators.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border border-black/10 p-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-pink-400 text-sm font-bold text-white">
                    {c.nickname.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-700">{c.nickname} <span className="font-normal text-slate-400">{c.handle}</span></p>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] font-medium text-slate-600">
                      <span>{formatCount(c.followers)} follow</span>
                      <span className="text-emerald-600">{formatMyr(c.gmv)} GMV</span>
                      <span>tương tác {c.engagementPct}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── THỊ TRƯỜNG (cross-market) ── */}
          {tab === 'market' && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-500">🌏 So sánh sản phẩm/ngách giữa các thị trường — bằng chứng cho cơ hội cross-market.</p>
              <div className="overflow-hidden rounded-xl border border-black/10">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Thị trường</th>
                      <th className="px-2 py-2 text-right font-semibold">Doanh thu</th>
                      <th className="px-2 py-2 text-right font-semibold">Tăng trưởng</th>
                      <th className="px-2 py-2 text-right font-semibold">Số shop</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crossMarket.map((r) => {
                      const meta = MARKETS.find((m) => m.key === r.market)
                      const up = r.growthRate >= 0
                      return (
                        <tr key={r.market} className={`border-t border-black/5 ${r.isCurrent ? 'bg-violet-50' : ''}`}>
                          <td className="px-3 py-2 font-semibold text-slate-700">
                            {meta?.flag} {meta?.label}{r.isCurrent && <span className="ml-1 text-[10px] text-violet-600">(đang xem)</span>}
                          </td>
                          <td className="px-2 py-2 text-right text-slate-700">{formatKMyr(r.revenue)}</td>
                          <td className={`px-2 py-2 text-right font-semibold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
                            <span className="inline-flex items-center gap-0.5">
                              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {up ? '+' : ''}{r.growthRate}%
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right text-slate-600">{r.shops}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                💡 Thị trường nào tăng mạnh + nhiều shop = đang nổ ở đó. Nếu MY còn ít shop → cơ hội vào sớm.
              </p>
            </div>
          )}

          {/* ── GIÁ ── */}
          {tab === 'pricing' && <PricingCalculator defaultPriceMyr={product.unitPrice} />}
        </div>
      </aside>
    </>
  )
}
