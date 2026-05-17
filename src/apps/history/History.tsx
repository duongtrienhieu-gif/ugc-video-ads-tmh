// ─────────────────────────────────────────────────────────────────────
// History — chronological feed of completed creative outputs across all
// modules. Sibling to the Drafts panel (in-flight) and Finder (per-bank
// browser). History is the unified "what have I made" timeline.
//
// Card click → open the source module + hand off productId so the
// module's interAppPayload listener can auto-load the right product.
// ─────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { History as HistoryIcon, Search, FolderOpen } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import { useHistoryItems, type HistoryItem, type HistoryType } from './useHistoryItems'

interface FilterChip {
  id: HistoryType | 'all'
  label: string
  icon: string
}

const FILTERS: FilterChip[] = [
  { id: 'all',          label: 'Tất cả',         icon: '📂' },
  { id: 'lab-content',  label: 'Lab Content',    icon: '🧠' },
  { id: 'landing-page', label: 'Landing Page',   icon: '📄' },
  { id: 'ads-content',  label: 'Ads Content',    icon: '📣' },
  { id: 'script',       label: 'Kịch bản',       icon: '✍️' },
  { id: 'broll',        label: 'Product AI',     icon: '🛍️' },
  { id: 'model',        label: 'Avatar AI',      icon: '🧑‍🎤' },
]

// Tailwind accent → class map. Kept inline so Tailwind's static analyser
// doesn't tree-shake the colour classes.
const ACCENT_BG: Record<HistoryItem['typeAccent'], string> = {
  violet:  'bg-violet-100 text-violet-700',
  pink:    'bg-pink-100 text-pink-700',
  blue:    'bg-blue-100 text-blue-700',
  orange:  'bg-orange-100 text-orange-700',
  sky:     'bg-sky-100 text-sky-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  purple:  'bg-purple-100 text-purple-700',
}

export default function History() {
  const items = useHistoryItems()
  const [filter, setFilter] = useState<HistoryType | 'all'>('all')
  const [query, setQuery] = useState('')

  const openApp = useAppStore((s) => s.openApp)
  const sendToApp = useAppStore((s) => s.sendToApp)

  // Filter + search
  const visible = items.filter((it) => {
    if (filter !== 'all' && it.type !== filter) return false
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      const hay = `${it.title} ${it.productName ?? ''} ${it.typeLabel} ${it.previewText ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const handleOpenItem = (item: HistoryItem) => {
    // Hand off productId if the source module supports it — most modules
    // listen for { targetField: 'productId' } and auto-load the product.
    if (item.sourceProductId) {
      sendToApp({
        targetApp: item.sourceAppId,
        targetField: 'productId',
        data: item.sourceProductId,
      })
    }
    openApp(item.sourceAppId)
  }

  // Per-filter counts for the chip badges
  const countFor = (t: HistoryType | 'all') =>
    t === 'all' ? items.length : items.filter((it) => it.type === t).length

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-black/8 bg-gradient-to-r from-violet-50/50 to-pink-50/40 px-6 py-4">
        <div className="flex items-center gap-2">
          <HistoryIcon className="h-5 w-5 text-violet-500" />
          <div>
            <h1 className="text-base font-bold text-gray-900">📂 History</h1>
            <p className="text-[11px] text-gray-500">
              Lịch sử các creative đã sinh xong — click 1 item để mở lại module gốc với product đã chọn sẵn.
            </p>
          </div>
        </div>

        {/* Search + filter chips */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên / sản phẩm / nội dung..."
              className="w-full rounded-lg border border-black/10 bg-white py-2 pl-9 pr-3 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-violet-500/40"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => {
              const isActive = filter === f.id
              const count = countFor(f.id)
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    isActive
                      ? 'border-violet-400 bg-violet-50 text-violet-700'
                      : 'border-black/10 bg-white text-gray-600 hover:bg-black/[0.03]'
                  }`}
                >
                  <span>{f.icon}</span>
                  <span>{f.label}</span>
                  <span className={`rounded-full px-1.5 py-px text-[9px] tabular-nums ${
                    isActive ? 'bg-violet-200 text-violet-800' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Empty state OR grid */}
      <div className="flex-1 overflow-y-auto p-5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <FolderOpen className="h-12 w-12 text-gray-200" strokeWidth={1.5} />
            <p className="text-sm text-gray-400">Chưa có creative nào được lưu</p>
            <p className="text-xs text-gray-300 max-w-sm">
              Sau khi sinh script / landing page / ads content / product AI / avatar, nhấn "Lưu vào Project" để xuất hiện tại đây.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <p className="py-20 text-center text-xs text-gray-400">
            Không có item nào khớp với "{query}"
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((item) => (
              <HistoryCard key={item.id} item={item} onClick={() => handleOpenItem(item)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────

function HistoryCard({ item, onClick }: { item: HistoryItem; onClick: () => void }) {
  const thumbUrl = useAssetUrl(item.thumbnail ?? undefined)
  const accentCls = ACCENT_BG[item.typeAccent]

  // Format relative time — capture `now` once at mount via lazy useState init
  // because React 19's purity lint forbids Date.now() inside render.
  const [now] = useState(() => Date.now())
  const ago = formatAgo(item.createdAt, now)

  return (
    <button
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white text-left shadow-sm transition-all hover:border-violet-300 hover:shadow-md"
    >
      {/* Thumbnail area */}
      <div className="relative aspect-video w-full bg-gray-100">
        {thumbUrl ? (
          <img src={thumbUrl} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl opacity-40">
            {item.typeIcon}
          </div>
        )}
        {/* Type badge top-left */}
        <span className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${accentCls}`}>
          <span>{item.typeIcon}</span>
          <span>{item.typeLabel}</span>
        </span>
        {/* Language badge top-right when present */}
        {item.language && (
          <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            {item.language.toUpperCase()}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-xs font-semibold text-gray-900 group-hover:text-violet-700">
          {item.title}
        </h3>
        {item.productName && (
          <p className="truncate text-[11px] text-gray-500">{item.productName}</p>
        )}
        {item.previewText && (
          <p className="line-clamp-2 text-[10px] text-gray-400">{item.previewText}</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-[10px] text-gray-400">
          <span>{ago}</span>
          {item.countLabel && <span className="truncate">{item.countLabel}</span>}
        </div>
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────

function formatAgo(ts: number, now: number): string {
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000))
  if (diffSec < 60)        return `${diffSec}s trước`
  const m = Math.floor(diffSec / 60)
  if (m < 60)              return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24)              return `${h} giờ trước`
  const d = Math.floor(h / 24)
  if (d < 7)               return `${d} ngày trước`
  return new Date(ts).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })
}
