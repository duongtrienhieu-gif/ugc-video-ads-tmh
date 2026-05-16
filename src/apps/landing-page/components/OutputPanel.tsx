import { useState } from 'react'
import { Loader2, LayoutTemplate, Save, Check, RotateCcw, Trash2, FolderOpen, ChevronDown } from 'lucide-react'
import type { LandingPagePack, SavedLandingPack } from '../types'
import SectionCard from './SectionCard'
import { useLandingPageStore } from '../store'
import { useAppStore } from '../../../stores/appStore'

interface OutputPanelProps {
  pack: LandingPagePack | null
  isGenerating: boolean
  onRegenerate: () => void
}

export default function OutputPanel({ pack, isGenerating, onRegenerate }: OutputPanelProps) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')

  const addToStore = useLandingPageStore((s) => s.add)
  const addToast = useAppStore((s) => s.addToast)

  const handleSave = () => {
    if (!pack || saving || saved) return
    setSaving(true)
    try {
      const t = title.trim() || `${pack.productName} — Landing Pack`
      addToStore(pack, t)
      setSaved(true)
      setTitle('')
      setTimeout(() => setSaved(false), 2500)
      addToast(`✓ Đã lưu "${t}" vào Project → Landing Pages`)
    } finally {
      setSaving(false)
    }
  }

  // ── Loading state ─────────────────────────────────────────────────
  if (isGenerating && !pack) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        <p className="text-sm font-medium text-gray-700">Đang tạo 10-section advertorial pack...</p>
        <p className="text-xs text-gray-400 max-w-sm">
          Gemini đang viết hero / pain / mechanism / ingredient / social proof / before-after / benefits / offer / FAQ / final CTA + image prompts
        </p>
      </div>
    )
  }

  // ── Empty state ───────────────────────────────────────────────────
  if (!pack) {
    return (
      <div className="flex h-full flex-col overflow-y-auto p-6">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <LayoutTemplate className="h-10 w-10 text-gray-200" strokeWidth={1.5} />
          <p className="text-sm text-gray-400">Chọn sản phẩm + nhấn "Tạo Landing Pack"</p>
          <p className="text-xs text-gray-300 max-w-sm">
            Output 10 sections (hero, pain, mechanism, ingredients, social proof, before/after, benefits, offer, FAQ, final CTA) — copy từng section vào Ladipage.
          </p>
        </div>
        <SavedHistorySection />
      </div>
    )
  }

  // ── Result state ──────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top action bar */}
      <div className="shrink-0 border-b border-black/8 bg-gradient-to-r from-violet-50/40 to-purple-50/30 px-5 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900">
              {pack.productName} — {pack.sections.length} sections
            </p>
            <p className="text-[10px] text-gray-400">
              Ngôn ngữ: {pack.language.toUpperCase()} · Tạo lúc {new Date(pack.generatedAt).toLocaleTimeString('vi-VN')}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`vd: "${pack.productName} v1"`}
              className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-[11px] outline-none focus:border-violet-500/40"
            />
            <button
              onClick={onRegenerate}
              disabled={isGenerating}
              className="flex items-center gap-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-black/[0.04] disabled:opacity-40"
            >
              {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              Tạo lại
            </button>
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className={`flex items-center gap-1 rounded-full px-4 py-1.5 text-[11px] font-bold transition-colors ${
                saved
                  ? 'bg-emerald-500/15 text-emerald-700'
                  : 'bg-violet-600 text-white hover:bg-violet-700'
              }`}
            >
              {saved ? <><Check className="h-3 w-3" /> Đã lưu</> : <><Save className="h-3 w-3" /> Lưu vào Project</>}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Section cards */}
        <div className="space-y-3">
          {pack.sections.map((section, i) => (
            <SectionCard key={`${section.type}-${i}`} index={i} section={section} />
          ))}
        </div>

        <SavedHistorySection />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Saved history — Project → Landing Pages
// ─────────────────────────────────────────────────────────────────────

function SavedHistorySection() {
  const items = useLandingPageStore((s) => s.items)
  const remove = useLandingPageStore((s) => s.remove)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (items.length === 0) return null

  return (
    <div className="mt-6 border-t border-black/8 pt-5">
      <h3 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
        <FolderOpen className="h-3.5 w-3.5" />
        Project → Landing Pages ({items.length})
      </h3>
      <p className="mb-3 text-[10px] text-gray-400">
        Lưu local trong trình duyệt — sẽ sync sang database khi backend bật bảng landing_pages.
      </p>
      <div className="space-y-2">
        {items.map((item) => (
          <SavedRow
            key={item.id}
            item={item}
            isOpen={expandedId === item.id}
            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onRemove={() => remove(item.id)}
          />
        ))}
      </div>
    </div>
  )
}

function SavedRow({
  item, isOpen, onToggle, onRemove,
}: {
  item: SavedLandingPack
  isOpen: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-black/[0.02]"
      >
        <LayoutTemplate className="h-4 w-4 text-violet-500" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-gray-800">{item.title}</p>
          <p className="truncate text-[10px] text-gray-400">
            {item.language.toUpperCase()} · {item.sections.length} sections · {new Date(item.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (confirm('Xoá landing pack này?')) onRemove() }}
          className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
          aria-label="Xoá"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </button>
      {isOpen && (
        <div className="space-y-2 border-t border-black/8 bg-gray-50/40 p-3">
          {item.sections.map((s, i) => (
            <SectionCard key={`${s.type}-${i}`} index={i} section={s} />
          ))}
        </div>
      )}
    </div>
  )
}
