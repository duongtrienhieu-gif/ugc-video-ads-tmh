// Research — entry component (P1, data mẫu).
// Header (market + thời gian + preset) | FilterPanel | lưới thẻ cơ hội | drawer chi tiết.
import { useEffect, useState } from 'react'
import { Search, FlaskConical } from 'lucide-react'
import { useResearchStore } from './store'
import { MARKETS, PRESETS } from './constants'
import OpportunityCard from './components/OpportunityCard'
import FilterPanel from './components/FilterPanel'
import ProductDetail from './components/ProductDetail'
import ShopList from './components/ShopList'
import type { Market } from './types'

const segCls = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
    active ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:text-slate-700'
  }`

export default function Research() {
  const { market, setMarket, activePreset, applyPreset, getScored, selectedId, select, getSelected, hydrate, realProducts, syncedAt } = useResearchStore()
  const [view, setView] = useState<'products' | 'shops'>('products')
  useEffect(() => { void hydrate() }, [hydrate])
  const scored = getScored()
  const selected = getSelected()

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#EEEEF2]">
      {/* Header */}
      <header className="flex shrink-0 flex-col gap-3 border-b border-black/10 bg-white px-5 py-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
              <Search className="h-4 w-4 text-violet-600" />
            </div>
            <h1 className="text-base font-bold text-slate-800">Research</h1>
            {realProducts ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                ✓ Data thật{syncedAt ? ` · ${new Date(syncedAt).toLocaleDateString('vi-VN')}` : ''}
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                <FlaskConical className="h-3 w-3" /> Bản thử — data mẫu
              </span>
            )}
          </div>

          {/* Ô chọn đưa ra GIỮA để không bị badge Gemini/Credit (góc phải) che */}
          <div className="flex items-center justify-self-center gap-2">
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value as Market)}
              className="rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm font-medium"
            >
              {MARKETS.map((m) => (
                <option key={m.key} value={m.key}>{m.flag} {m.label}</option>
              ))}
            </select>
            <select className="rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm font-medium" defaultValue="30">
              <option value="7">7 ngày</option>
              <option value="30">30 ngày</option>
              <option value="90">90 ngày</option>
            </select>
          </div>

          <div aria-hidden />
        </div>

        {/* Preset chọn nhanh */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Chọn nhanh:</span>
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                activePreset === p.key
                  ? 'border-violet-300 bg-violet-50 text-violet-700'
                  : 'border-black/10 bg-white text-slate-600 hover:bg-black/[0.02]'
              }`}
            >
              {p.emoji} {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        <FilterPanel />

        <main className="flex-1 overflow-y-auto p-5">
          {/* Toggle: Sản phẩm / Shop đối thủ */}
          <div className="mb-3 flex items-center gap-3">
            <div className="inline-flex items-center gap-1 rounded-lg border border-black/10 bg-white p-0.5">
              <button onClick={() => setView('products')} className={segCls(view === 'products')}>🛍 Sản phẩm</button>
              <button onClick={() => setView('shops')} className={segCls(view === 'shops')}>🏪 Shop đối thủ</button>
            </div>
            {view === 'products' && (
              <span className="text-sm font-semibold text-slate-500">{scored.length} cơ hội</span>
            )}
          </div>

          {view === 'shops' ? (
            <ShopList />
          ) : scored.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/10 text-center text-slate-400">
              <Search className="h-8 w-8" />
              <p className="text-sm">Không có sản phẩm khớp bộ lọc.</p>
              <p className="text-xs">Thử nới bộ lọc hoặc đổi thị trường.</p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
              {scored.map((p) => (
                <OpportunityCard key={p.productId} product={p} onOpen={select} />
              ))}
            </div>
          )}
        </main>
      </div>

      {selected && selectedId && <ProductDetail product={selected} onClose={() => select(null)} />}
    </div>
  )
}
