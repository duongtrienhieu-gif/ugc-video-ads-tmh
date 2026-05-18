// ── Asset-Type Picker (P11) ─────────────────────────────────────────────────
//
// Grouped grid picker — 3 engine groups, each with their own visual
// identity (rose for photographic / indigo for ui-native / amber for
// designed-graphic). Replaces the legacy scene/style chip UX entirely.

import {
  Package, UserRound, LayoutGrid, ArrowRightLeft, Sun, Sparkles, Coffee,
  Video, MessageCircle, MessagesSquare, ShoppingBag, MessageSquare,
  BarChart3, Megaphone,
} from 'lucide-react'
import type { AssetTypeId } from '../types/asset'
import type { AssetCatalogEntry } from './assetCatalog'
import { GROUP_META, listCatalogByGroup } from './assetCatalog'

const ICONS: Record<string, React.ElementType> = {
  package: Package,
  userRound: UserRound,
  layoutGrid: LayoutGrid,
  arrowRightLeft: ArrowRightLeft,
  sun: Sun,
  sparkles: Sparkles,
  coffee: Coffee,
  video: Video,
  messageCircle: MessageCircle,
  messagesSquare: MessagesSquare,
  shoppingBag: ShoppingBag,
  messageSquare: MessageSquare,
  barChart3: BarChart3,
  megaphone: Megaphone,
}

interface AssetTypePickerProps {
  selectedId: AssetTypeId | null
  onSelect: (id: AssetTypeId) => void
}

export default function AssetTypePicker({ selectedId, onSelect }: AssetTypePickerProps) {
  return (
    <div className="flex flex-col gap-3 md:gap-5">
      {GROUP_META.map((group) => {
        const entries = listCatalogByGroup(group.group)
        if (entries.length === 0) return null
        return (
          <section key={group.group} className="flex flex-col gap-1.5 md:gap-2">
            <div className="flex items-baseline justify-between">
              <h3 className="text-xs md:text-sm font-bold tracking-tight text-gray-800">
                {group.title.vi}
              </h3>
              <p className="text-[10px] uppercase tracking-widest text-gray-400">
                {entries.length} loại
              </p>
            </div>
            {/* Long group description hidden on mobile — group title +
                card grid below already convey intent. */}
            <p className="hidden md:block text-[11px] text-gray-500">{group.description.vi}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {entries.map((entry) => (
                <AssetCard
                  key={entry.id}
                  entry={entry}
                  groupAccentClass={group.accentClass}
                  groupCardBgClass={group.cardBgClass}
                  selected={selectedId === entry.id}
                  onSelect={() => onSelect(entry.id)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

interface AssetCardProps {
  entry: AssetCatalogEntry
  groupAccentClass: string
  groupCardBgClass: string
  selected: boolean
  onSelect: () => void
}

function AssetCard({ entry, groupAccentClass, groupCardBgClass, selected, onSelect }: AssetCardProps) {
  const Icon = ICONS[entry.iconKey] ?? Package
  return (
    <button
      type="button"
      onClick={onSelect}
      title={entry.description.vi}
      className={`group flex flex-col items-start gap-1 md:gap-1.5 rounded-xl border px-2.5 py-2.5 md:px-3 md:py-3 text-left transition-all ${
        selected
          ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200'
          : `${groupAccentClass} ${groupCardBgClass}`
      }`}
    >
      <div className="flex w-full items-center justify-between">
        <Icon className={`h-4 w-4 md:h-5 md:w-5 ${selected ? 'text-violet-600' : 'text-gray-500 group-hover:text-gray-800'}`} strokeWidth={1.6} />
        <span className="rounded-md bg-black/[0.06] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-gray-500">
          {entry.aspectRatio}
        </span>
      </div>
      <span className="text-[11px] md:text-[12px] font-semibold leading-tight text-gray-900">
        {entry.title.vi}
      </span>
      {/* Description hidden on mobile to keep cards compact — title +
          icon + platform badge already convey the asset type clearly.
          Long-press shows the description via `title` attribute on the
          parent button. Wrapped in `hidden md:block` so the inner
          line-clamp utility (which sets display: -webkit-box) doesn't
          conflict with the mobile hide. */}
      <div className="hidden md:block w-full">
        <span className="line-clamp-2 text-[10px] leading-snug text-gray-500">
          {entry.description.vi}
        </span>
      </div>
      <span className={`mt-0.5 md:mt-1 inline-flex rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
        selected ? 'bg-violet-200 text-violet-800' : 'bg-white/80 text-gray-600'
      }`}>
        {entry.platformBadge}
      </span>
    </button>
  )
}
