// ── Asset-Type Picker (P22 — floating popup, no layout shift) ──────────
//
// Per spec — explanation appears as FLOATING ABSOLUTE LAYER (not
// inline below the card). Positioned via portal so:
//   • Grid layout never shifts when popup appears
//   • Card heights stay uniform
//   • Popup auto-flips left if it would overflow the right edge
//   • Desktop only — mobile (< md) skips popup; card click still works
//
// Style reference: Notion AI hover preview / Script Architect preview
// (dark rounded card, subtle shadow, max-width 340px, fade+slide
// animation 150-200ms).

import { useState, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
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
  onSelect: () => void
}

function AssetCard({ entry, categoryAccent, categoryBg, selected, onSelect }: AssetCardProps) {
  const Icon = CARD_ICONS[entry.iconKey] ?? Package
  const cardRef = useRef<HTMLButtonElement>(null)
  const [popupOpen, setPopupOpen] = useState(false)

  return (
    <>
      <button
        ref={cardRef}
        type="button"
        onClick={onSelect}
        onMouseEnter={() => setPopupOpen(true)}
        onMouseLeave={() => setPopupOpen(false)}
        onFocus={() => setPopupOpen(true)}
        onBlur={() => setPopupOpen(false)}
        className={`group flex w-full flex-col items-start gap-1.5 rounded-xl border p-2.5 text-left transition-all ${
          selected
            ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200'
            : `${categoryAccent} ${categoryBg}`
        }`}
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

      {/* Floating preview popup — portal-rendered, NEVER shifts grid */}
      {popupOpen && <FloatingPreview entry={entry} anchorRef={cardRef} />}
    </>
  )
}

// ── Floating preview popup (P22) ──────────────────────────────────────
// Renders via portal to document.body — guarantees:
//   • Card grid never shifts
//   • z-index always sits above other UI
//   • Auto-flips left when card is near right viewport edge
//   • Desktop only (md+); mobile hover events don't fire so this is
//     effectively gated to non-touch devices

const POPUP_WIDTH = 340
const POPUP_GAP = 12

interface FloatingPreviewProps {
  entry: AssetCatalogEntry
  anchorRef: React.RefObject<HTMLButtonElement | null>
}

function FloatingPreview({ entry, anchorRef }: FloatingPreviewProps) {
  const [style, setStyle] = useState<{ top: number; left: number; placement: 'right' | 'left' } | null>(null)

  useLayoutEffect(() => {
    const el = anchorRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const wouldOverflowRight = rect.right + POPUP_GAP + POPUP_WIDTH > window.innerWidth - 16
    const placement: 'right' | 'left' = wouldOverflowRight ? 'left' : 'right'
    const left = placement === 'right'
      ? rect.right + POPUP_GAP
      : Math.max(16, rect.left - POPUP_GAP - POPUP_WIDTH)
    // Vertically align top of popup with top of card, clamped to viewport
    const maxTop = Math.max(16, window.innerHeight - 16 - 380)
    const top = Math.max(16, Math.min(maxTop, rect.top))
    setStyle({ top, left, placement })
  }, [anchorRef])

  if (!style) return null

  // Skip popup rendering on small viewports — hover doesn't fire on
  // touch devices anyway, but this is an extra safety net for fold/
  // small-window edge cases.
  if (typeof window !== 'undefined' && window.innerWidth < 768) return null

  const Icon = CARD_ICONS[entry.iconKey] ?? Package

  return createPortal(
    <div
      style={{ top: style.top, left: style.left, width: POPUP_WIDTH }}
      className="pointer-events-none fixed z-[60] animate-[fade-slide_180ms_ease-out] rounded-xl border border-white/10 bg-gray-900/95 p-4 text-white shadow-2xl backdrop-blur-sm"
    >
      {/* Header: icon + title */}
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10">
          <Icon className="h-4 w-4 text-white" strokeWidth={1.8} />
        </span>
        <h4 className="text-sm font-bold tracking-tight text-white">
          {entry.title.vi}
        </h4>
      </div>

      {/* WHAT */}
      <p className="mt-3 text-[11px] leading-relaxed text-gray-200">
        {entry.tooltip.what}
      </p>

      {/* MỤC TIÊU MARKETING */}
      <p className="mt-3 text-[9px] font-bold uppercase tracking-widest text-gray-400">
        Mục tiêu marketing
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-gray-300">
        {entry.tooltip.marketingGoal}
      </p>

      {/* PHÙ HỢP */}
      {entry.tooltip.suitableFor.length > 0 && (
        <>
          <p className="mt-3 text-[9px] font-bold uppercase tracking-widest text-gray-400">
            Phù hợp
          </p>
          <ul className="mt-1 space-y-0.5">
            {entry.tooltip.suitableFor.map((s) => (
              <li key={s} className="flex gap-1.5 text-[11px] text-gray-300">
                <span className="text-gray-500">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Badges (compact) */}
      <div className="mt-3 flex flex-wrap gap-1">
        {entry.badges.map((b) => {
          const meta = BADGE_META[b]
          if (!meta) return null
          return (
            <span
              key={b}
              className="rounded bg-white/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-gray-200"
            >
              {meta.label}
            </span>
          )
        })}
      </div>
    </div>,
    document.body,
  )
}
