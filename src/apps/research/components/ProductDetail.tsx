import { useMemo, useState } from 'react'
import { X, Check, AlertTriangle, XCircle, Plus, Play, TrendingUp, TrendingDown, ExternalLink, Sparkles } from 'lucide-react'
import type { Market, ScoredProduct, SignalResult } from '../types'
import { VERDICT_META, NICHES, MARKETS } from '../constants'
import { formatMyr } from '../services/pricing'
import { getVideosFor, getCreatorsFor, getCrossMarketFor, analyzeVideo, formatCount, formatKMyr } from '../services/evidence'
import { useResearchStore, type DbVideo, type DbCreator } from '../store'
import PricingCalculator from './PricingCalculator'

type Tab = 'overview' | 'video' | 'creator' | 'market' | 'pricing'

const KALODATA_CURRENCY: Record<Market, string> = { MY: 'MYR', TH: 'THB', ID: 'IDR', VN: 'VND' }
function kalodataUrl(productId: string, market: Market): string {
  // demo: bỏ hậu tố thị trường (-th/-id/-vn) đã thêm cho data mẫu;
  // data thật: product_id chính là id Kalodata nên link trỏ đúng sản phẩm.
  const id = productId.replace(/-(th|id|vn)$/i, '')
  // URL Kalodata cập nhật 2026-06: PHẢI có dateRange + cateValue, không trang trống.
  const end = new Date(); const start = new Date(end.getTime() - 30 * 86400000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const dateRange = encodeURIComponent(JSON.stringify([fmt(start), fmt(end)]))
  const cateValue = encodeURIComponent('[]')
  return `https://www.kalodata.com/product/detail?id=${encodeURIComponent(id)}&language=vi-VN&currency=${KALODATA_CURRENCY[market]}&region=${market}&dateRange=${dateRange}&cateValue=${cateValue}`
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
  const [analyzeId, setAnalyzeId] = useState<string | null>(null)
  const v = VERDICT_META[product.verdict]
  const niche = NICHES.find((n) => n.key === product.nicheKey)
  const passCount = product.signals.filter((s) => s.status === 'pass').length

  const realVideos = useResearchStore((s) => s.realVideos)
  const realCreators = useResearchStore((s) => s.realCreators)
  const getVideosForProduct = useResearchStore((s) => s.getVideosForProduct)
  const getCreatorsForProduct = useResearchStore((s) => s.getCreatorsForProduct)

  // Video: ưu tiên DB; fallback sample.
  const videos = useMemo(() => {
    const real = (realVideos && realVideos.length) ? getVideosForProduct(product.productId, product.nicheKey) : []
    if (real.length) {
      return real.map((v: DbVideo) => ({
        id: v.videoId, caption: v.description.slice(0, 80) || '(video)', handle: v.handle ? '@' + v.handle : '@unknown',
        views: v.views, gmv: v.gmv, adRoas: v.adRoas || 1, durationSec: v.duration,
      }))
    }
    return getVideosFor(product)
  }, [product, realVideos, getVideosForProduct])

  // Creator: ưu tiên DB; fallback sample.
  const creators = useMemo(() => {
    const real = (realCreators && realCreators.length) ? getCreatorsForProduct(product.productId, product.nicheKey) : []
    if (real.length) {
      return real.map((c: DbCreator) => ({
        id: c.creatorId, handle: '@' + c.handle, nickname: c.nickname || c.handle,
        followers: c.followers, gmv: c.gmv,
        engagementPct: Math.round((c.engagementPct || 0) * 10) / 10,
      }))
    }
    return getCreatorsFor(product)
  }, [product, realCreators, getCreatorsForProduct])

  const crossMarket = useMemo(() => getCrossMarketFor(product), [product])

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
    ['overview', 'Tổng quan'], ['video', 'Video win'], ['creator', 'Creator'], ['market', 'Thị trường'], ['pricing', 'Giá'],
  ]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-black/10 p-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-2xl">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.title} className="h-full w-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
            ) : (
              <span>{niche?.emoji ?? '📦'}</span>
            )}
          </div>
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

          {/* ── VIDEO WIN ── */}
          {tab === 'video' && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-500">🎥 Video đang bán tốt — bấm <b>"Xem TikTok"</b> để xem video thật, bấm <b>"Phân tích AI"</b> để mổ xẻ góc content.</p>
              {videos.map((vid) => {
                const open = analyzeId === vid.id
                const analysis = open ? analyzeVideo(vid.caption) : null
                // TikTok video URL: thử /video/{id} trước, không có id thì link tới kênh.
                const cleanHandle = vid.handle.replace(/^@/, '').trim()
                const looksLikeId = /^\d{15,}$/.test(vid.id)
                const tiktokUrl = cleanHandle
                  ? (looksLikeId ? `https://www.tiktok.com/@${cleanHandle}/video/${vid.id}` : `https://www.tiktok.com/@${cleanHandle}`)
                  : null
                return (
                  <div key={vid.id} className="rounded-xl border border-black/10 p-2.5">
                    <div className="flex gap-3">
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

                    <div className="mt-2 flex gap-2">
                      {tiktokUrl && (
                        <a
                          href={tiktokUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-black/10 bg-slate-50 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                          title={looksLikeId ? 'Mở video TikTok' : 'Mở kênh TikTok (chưa khớp video id)'}
                        >
                          <Play className="h-3.5 w-3.5" /> {looksLikeId ? 'Xem TikTok' : 'Kênh TikTok'}
                        </a>
                      )}
                      <button
                        onClick={() => setAnalyzeId(open ? null : vid.id)}
                        className={`flex ${tiktokUrl ? 'flex-1' : 'w-full'} items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100`}
                      >
                        <Sparkles className="h-3.5 w-3.5" /> {open ? 'Ẩn AI' : 'Phân tích AI'}
                      </button>
                    </div>

                    {analysis && (
                      <div className="mt-2 flex flex-col gap-2 rounded-lg bg-slate-50 p-3">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-600">
                          <Sparkles className="h-3 w-3" /> AI mổ xẻ video win
                          <span className="ml-auto rounded-full bg-amber-50 px-1.5 text-[10px] font-normal text-amber-600">demo</span>
                        </div>
                        {analysis.sections.map((s) => (
                          <div key={s.label}>
                            <div className="text-[11px] font-bold text-slate-700">{s.label}</div>
                            <div className="text-[11px] text-slate-500">{s.text}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── CREATOR ── */}
          {tab === 'creator' && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-500">👤 Creator đang đẩy sản phẩm — bấm <b>"TikTok"</b> để xem kênh, đánh giá rồi tuyển.</p>
              {creators.map((c) => {
                const cleanHandle = c.handle.replace(/^@/, '').trim()
                // Handle phải đúng định dạng TikTok (chữ/số/dấu chấm/gạch dưới, ≥2 ký tự).
                const handleOk = /^[A-Za-z0-9._-]{2,}$/.test(cleanHandle)
                const tiktokUrl = handleOk ? `https://www.tiktok.com/@${cleanHandle}` : null
                return (
                  <div key={c.id} className="rounded-xl border border-black/10 p-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-pink-400 text-sm font-bold text-white">
                        {(c.nickname || cleanHandle || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-700">{c.nickname || cleanHandle} <span className="font-normal text-slate-400">{c.handle}</span></p>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] font-medium text-slate-600">
                          <span>{formatCount(c.followers)} follow</span>
                          <span className="text-emerald-600">{formatMyr(c.gmv)} GMV</span>
                          <span>tương tác {c.engagementPct}%</span>
                        </div>
                      </div>
                      {tiktokUrl ? (
                        <a
                          href={tiktokUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex shrink-0 items-center gap-1 rounded-lg border border-black/10 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                          title={`Xem kênh TikTok của ${c.nickname || cleanHandle}`}
                        >
                          <ExternalLink className="h-3 w-3" /> TikTok
                        </a>
                      ) : (
                        <span className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-700" title="Chưa có handle TikTok hợp lệ">
                          Chưa có handle
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
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
