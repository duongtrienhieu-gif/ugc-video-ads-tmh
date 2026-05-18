// ── Asset-Type Picker (P14 — marketing-mindset library) ───────────────────
//
// Now grouped by 8 marketing categories (NOT 3 engine groups):
//   • Bằng chứng xã hội · Giải thích sản phẩm · Cảm xúc & Lối sống ·
//     Quảng cáo chuyển đổi · Giao diện mạng xã hội · Ảnh sản phẩm
//     chuyên nghiệp · UGC & Người thật · AI Visual Magic
//
// Each card shows:
//   • icon + Vietnamese marketing title + 1-line subtitle
//   • badges (Sản phẩm / Avatar AI / TikTok / Shopee / ...)
//   • hover tooltip (long-form: what + marketing goal + suitable platforms)

import { useState } from 'react'
import {
  Package, UserRound, LayoutGrid, ArrowRightLeft, Sun, Sparkles, Coffee,
  Video, MessageCircle, MessagesSquare, ShoppingBag, MessageSquare,
  BarChart3, Megaphone, Users, FlaskConical, Heart, Flame, Smartphone,
  Camera, Wand2,
} from 'lucide-react'
import type { AssetTypeId } from '../types/asset'
import type { AssetCatalogEntry, CategoryId, MarketingCategory } from './assetCatalog'
import {
  MARKETING_CATEGORIES,
  listCatalogByCategory,
  BADGE_META,
} from './assetCatalog'

const CARD_ICONS: Record<string, React.ElementType> = {
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

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  users:      Users,
  flask:      FlaskConical,
  heart:      Heart,
  flame:      Flame,
  smartphone: Smartphone,
  camera:     Camera,
  userRound:  UserRound,
  wand:       Wand2,
}

interface AssetTypePickerProps {
  selectedId: AssetTypeId | null
  onSelect: (id: AssetTypeId) => void
}

export default function AssetTypePicker({ selectedId, onSelect }: AssetTypePickerProps) {
  // Categories collapsible (default: all open)
  const [openCategories, setOpenCategories] = useState<Set<CategoryId>>(
    () => new Set(MARKETING_CATEGORIES.map((c) => c.id)),
  )
  const toggleCategory = (id: CategoryId) =>
    setOpenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  return (
    <div className="flex flex-col gap-4">
      {MARKETING_CATEGORIES.map((category) => {
        const entries = listCatalogByCategory(category.id)
        if (entries.length === 0) return (
          <CategorySection
            key={category.id}
            category={category}
            open={openCategories.has(category.id)}
            onToggle={() => toggleCategory(category.id)}
            empty
          />
        )
        return (
          <CategorySection
            key={category.id}
            category={category}
            open={openCategories.has(category.id)}
            onToggle={() => toggleCategory(category.id)}
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {entries.map((entry) => (
                <AssetCard
                  key={entry.id}
                  entry={entry}
                  categoryAccent={category.accentClass}
                  categoryBg={category.cardBgClass}
                  selected={selectedId === entry.id}
                  onSelect={() => onSelect(entry.id)}
                />
              ))}
            </div>
          </CategorySection>
        )
      })}
    </div>
  )
}

// ── Category section (collapsible) ─────────────────────────────────────

function CategorySection({
  category, open, onToggle, empty, children,
}: {
  category: MarketingCategory
  open: boolean
  onToggle: () => void
  empty?: boolean
  children?: React.ReactNode
}) {
  const Icon = CATEGORY_ICONS[category.iconKey] ?? Sparkles
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-black/[0.03]"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 text-gray-600" strokeWidth={1.8} />
          <h3 className="truncate text-xs font-bold uppercase tracking-wide text-gray-800">
            {category.title.vi}
          </h3>
        </div>
        <span className="shrink-0 text-[10px] text-gray-400">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <>
          <p className="mb-2 mt-0.5 pl-6 text-[10px] text-gray-500">{category.description.vi}</p>
          {empty ? (
            <p className="rounded-lg border border-dashed border-black/10 px-3 py-2 text-[10px] text-gray-400">
              Đang phát triển — sắp ra mắt
            </p>
          ) : children}
        </>
      )}
    </section>
  )
}

// ── Card ───────────────────────────────────────────────────────────────

interface AssetCardProps {
  entry: AssetCatalogEntry
  categoryAccent: string
  categoryBg: string
  selected: boolean
  /** Click selects the creative directly (no intermediate expand step). */
  onSelect: () => void
}

function AssetCard({ entry, categoryAccent, categoryBg, selected, onSelect }: AssetCardProps) {
  const Icon = CARD_ICONS[entry.iconKey] ?? Package

  // P21 — HOVER triggers inline explanation BELOW the card (not click).
  // Restores the snappier P14 hover UX, but positions the panel BELOW
  // the card (animated grow) instead of floating to the right. Click
  // directly selects (no "Chọn loại này" intermediate button).
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className={`overflow-hidden rounded-xl border transition-all ${
        selected
          ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200'
          : hovered
            ? 'border-gray-300 bg-white shadow-sm'
            : `${categoryAccent} ${categoryBg}`
      }`}
    >
      {/* Card head — click selects */}
      <button
        type="button"
        onClick={onSelect}
        className="group flex w-full flex-col items-start gap-1.5 p-2.5 text-left"
      >
        <div className="flex w-full items-center justify-between">
          <Icon
            className={`h-5 w-5 ${selected ? 'text-violet-600' : 'text-gray-600 group-hover:text-gray-900'}`}
            strokeWidth={1.6}
          />
          <span className="rounded-md bg-black/[0.06] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-gray-500">
            {entry.aspectRatio}
          </span>
        </div>
        <span className="text-[12px] font-semibold leading-tight text-gray-900">
          {entry.title.vi}
        </span>
        <span className="line-clamp-2 text-[10px] leading-snug text-gray-500">
          {entry.description.vi}
        </span>
        {/* Badges */}
        <div className="mt-1 flex flex-wrap gap-1">
          {entry.badges.map((b) => {
            const meta = BADGE_META[b]
            if (!meta) return null
            return (
              <span
                key={b}
                className={`rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide ${meta.className}`}
              >
                {meta.label}
              </span>
            )
          })}
        </div>
      </button>

      {/* Hover panel BELOW card — animated grow + fade.
          grid-template-rows: 0fr ↔ 1fr trick for smooth auto-height
          animation in modern browsers. Card grows downward; grid handles
          staggered heights naturally. */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-150 ease-out ${
          hovered ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-black/8 bg-white/80 p-3">
            <p className="text-[10px] leading-snug text-gray-700">
              {entry.tooltip.what}
            </p>

            <p className="mt-2.5 text-[9px] font-bold uppercase tracking-wide text-gray-400">
              Mục tiêu marketing
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-gray-600">
              {entry.tooltip.marketingGoal}
            </p>

            {entry.tooltip.suitableFor.length > 0 && (
              <>
                <p className="mt-2.5 text-[9px] font-bold uppercase tracking-wide text-gray-400">
                  Phù hợp
                </p>
                <ul className="mt-0.5 space-y-0.5">
                  {entry.tooltip.suitableFor.map((s) => (
                    <li key={s} className="flex gap-1 text-[10px] text-gray-600">
                      <span className="text-gray-400">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
