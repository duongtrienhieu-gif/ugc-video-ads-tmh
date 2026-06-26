import { RotateCcw } from 'lucide-react'
import { useResearchStore } from '../store'
import { NICHES } from '../constants'

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
        on ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-black/10 bg-white text-slate-600 hover:bg-black/[0.02]'
      }`}
    >
      {label}
      <span className={`h-4 w-7 rounded-full p-0.5 transition-colors ${on ? 'bg-violet-500' : 'bg-slate-300'}`}>
        <span className={`block h-3 w-3 rounded-full bg-white transition-transform ${on ? 'translate-x-3' : ''}`} />
      </span>
    </button>
  )
}

export default function FilterPanel() {
  const { filters, setFilter, nicheFilter, setNiche, sortBy, setSort, clearPreset } = useResearchStore()
  const isLive = useResearchStore((s) => s.isLive)

  // Chế độ LIVE (TikTok Shop): chỉ có số bán/giá/rating → ẩn các lọc Kalodata,
  // chỉ giữ Sắp xếp (theo số bán) + Ẩn SKU nhiều biến thể.
  if (isLive) {
    return (
      <aside className="flex w-56 shrink-0 flex-col gap-3 overflow-y-auto border-r border-black/10 bg-[#FAFAFA] p-3">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Bộ lọc (live)</span>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Sắp xếp theo
          <select
            value={sortBy === 'sale' || sortBy === 'score' || sortBy === 'growth' ? sortBy : 'sale'}
            onChange={(e) => setSort(e.target.value as 'sale' | 'score' | 'growth')}
            className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs"
          >
            <option value="sale">Số đã bán</option>
            <option value="score">Điểm cơ hội</option>
            <option value="growth">📈 Tăng nhanh (momentum)</option>
          </select>
        </label>
        <Toggle on={filters.hideHighSku} onChange={(v) => setFilter('hideHighSku', v)} label="Ẩn SP nhiều biến thể" />
        <Toggle on={filters.hideTeaser} onChange={(v) => setFilter('hideTeaser', v)} label="Ẩn SP giá mồi (≈0)" />
        <p className="mt-1 rounded-lg bg-violet-50 px-2 py-1.5 text-[10px] text-violet-600">
          Đang xem data LIVE TikTok Shop — chấm điểm theo SỐ ĐÃ BÁN. "Tăng nhanh" cần quét lại sau vài ngày.
        </p>
      </aside>
    )
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-3 overflow-y-auto border-r border-black/10 bg-[#FAFAFA] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Bộ lọc</span>
        <button onClick={clearPreset} title="Đặt lại" className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600">
          <RotateCcw className="h-3 w-3" /> Đặt lại
        </button>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Ngách
        <select
          value={nicheFilter}
          onChange={(e) => setNiche(e.target.value as typeof nicheFilter)}
          className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs"
        >
          <option value="all">Tất cả ngách</option>
          {NICHES.map((n) => (
            <option key={n.key} value={n.key}>{n.emoji} {n.label}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Giá bán tối đa: <span className="font-bold text-slate-800">RM{filters.priceMaxMyr}</span>
        <input
          type="range" min={15} max={100} step={5} value={filters.priceMaxMyr}
          onChange={(e) => setFilter('priceMaxMyr', Number(e.target.value))}
          className="accent-violet-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Hoa hồng tối thiểu: <span className="font-bold text-slate-800">{filters.commissionMinPct}%</span>
        <input
          type="range" min={0} max={30} step={1} value={filters.commissionMinPct}
          onChange={(e) => setFilter('commissionMinPct', Number(e.target.value))}
          className="accent-violet-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Tăng trưởng tối thiểu
        <select
          value={filters.growthMinPct}
          onChange={(e) => setFilter('growthMinPct', Number(e.target.value))}
          className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs"
        >
          <option value={-100}>Tất cả</option>
          <option value={0}>{'> 0% (đang tăng)'}</option>
          <option value={50}>{'> 50%'}</option>
          <option value={100}>{'> 100%'}</option>
        </select>
      </label>

      <Toggle on={filters.lowSaturationOnly} onChange={(v) => setFilter('lowSaturationOnly', v)} label="Ít shop (chưa bão hòa)" />
      <Toggle on={filters.hasCreatorOnly} onChange={(v) => setFilter('hasCreatorOnly', v)} label="Có creator sẵn" />
      <Toggle on={filters.hideHighSku} onChange={(v) => setFilter('hideHighSku', v)} label="Ẩn ngách nhiều SKU" />

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Sắp xếp theo
        <select
          value={sortBy}
          onChange={(e) => setSort(e.target.value as 'score' | 'revenue' | 'growth' | 'commission')}
          className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs"
        >
          <option value="score">Điểm cơ hội</option>
          <option value="revenue">Doanh thu</option>
          <option value="growth">Tăng trưởng</option>
          <option value="commission">Hoa hồng</option>
        </select>
      </label>
    </aside>
  )
}
