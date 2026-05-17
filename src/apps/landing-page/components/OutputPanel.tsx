import { useState } from 'react'
import { Loader2, LayoutTemplate, Save, Check, RotateCcw, Trash2, FolderOpen, ChevronDown, ImageIcon, Sparkles, AlertTriangle } from 'lucide-react'
import type { LandingPagePack, SavedLandingPack } from '../types'
import SectionCard from './SectionCard'
import { useLandingPageStore } from '../store'
import { useAppStore } from '../../../stores/appStore'

/** KIE GPT-image-1 ~ 6 credits per call. Drives all cost hints in this module. */
const CREDIT_PER_IMAGE = 6

interface OutputPanelProps {
  pack: LandingPagePack | null
  isGenerating: boolean
  onRegenerate: () => void
  /** Trigger the image queue for ALL image prompts in the pack. */
  onGenerateAllImages: () => void
  /** Generate only images that are idle/empty (skip already-done images). */
  onGenerateRemaining: () => void
  /** Re-generate ONLY the images that failed last time. */
  onRetryFailed: () => void
  /** Regenerate a single image inside the pack. */
  onRegenerateImage: (sectionIdx: number, imageIdx: number) => void
  /** Delete a single image inside the pack (clears generated ref + resets status). */
  onDeleteImage: (sectionIdx: number, imageIdx: number) => void
  /** Total / done / failed counts for the image batch. */
  imageProgress: { done: number; failed: number; total: number } | null
  isGeneratingImages: boolean
}

export default function OutputPanel({
  pack, isGenerating, onRegenerate,
  onGenerateAllImages, onGenerateRemaining, onRetryFailed,
  onRegenerateImage, onDeleteImage,
  imageProgress, isGeneratingImages,
}: OutputPanelProps) {
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
        <p className="text-sm font-medium text-gray-700">Đang tạo 17-section advertorial pack...</p>
        <p className="text-xs text-gray-400 max-w-sm">
          Gemini đang viết hero / pain / mechanism / ingredient / social proof / comparison / news-proof / before-after / benefits / offer / FAQ / final CTA + image prompts
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
            Output 17 sections (hero, pain, mechanism, ingredients, social proof, comparison, news, before/after, benefits, offer, FAQ, final CTA) — copy từng section vào Ladipage.
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

      {/* Image generation bar — between meta header and sections */}
      <div className="shrink-0 border-b border-black/8 bg-amber-50/30 px-5 py-2.5">
        <ImageGenerationBar
          pack={pack}
          onGenerateAll={onGenerateAllImages}
          onGenerateRemaining={onGenerateRemaining}
          onRetryFailed={onRetryFailed}
          progress={imageProgress}
          isGenerating={isGeneratingImages}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Section cards */}
        <div className="space-y-3">
          {pack.sections.map((section, i) => (
            <SectionCard
              key={`${section.type}-${i}`}
              index={i}
              section={section}
              onRegenerateImage={onRegenerateImage}
              onDeleteImage={onDeleteImage}
            />
          ))}
        </div>

        <SavedHistorySection />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Image generation action bar — shows the "Sinh tất cả ảnh" CTA,
// progress while running, and an estimated-cost preview before running.
// ─────────────────────────────────────────────────────────────────────
function ImageGenerationBar({
  pack, onGenerateAll, onGenerateRemaining, onRetryFailed, progress, isGenerating,
}: {
  pack: LandingPagePack
  onGenerateAll: () => void
  onGenerateRemaining: () => void
  onRetryFailed: () => void
  progress: { done: number; failed: number; total: number } | null
  isGenerating: boolean
}) {
  const totalImages = pack.sections.reduce((acc, s) => acc + (s.imagePrompts?.length ?? 0), 0)
  const generated = pack.sections.reduce(
    (acc, s) => acc + (s.imagePrompts?.filter((p) => p.status === 'done').length ?? 0),
    0,
  )
  const failedCount = pack.sections.reduce(
    (acc, s) => acc + (s.imagePrompts?.filter((p) => p.status === 'failed').length ?? 0),
    0,
  )
  const remaining = totalImages - generated
  const estCreditsAll       = totalImages * CREDIT_PER_IMAGE
  const estCreditsRemaining = remaining * CREDIT_PER_IMAGE
  const estCreditsFailed    = failedCount * CREDIT_PER_IMAGE

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
          <ImageIcon className="h-3.5 w-3.5 text-amber-600" />
          Sinh ảnh thật cho landing pack
        </p>
        <p className="text-[10px] text-gray-500">
          {generated}/{totalImages} ảnh đã sinh
          {failedCount > 0 && <span className="text-red-600"> · {failedCount} lỗi</span>}
          {' '}· <span className="font-medium text-amber-700">1 ảnh ≈ {CREDIT_PER_IMAGE} credit</span>
          {pack.visualMemory.length > 0 && ` · ${pack.visualMemory.length} ảnh tham chiếu`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {isGenerating && progress && (
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
            <span className="text-[11px] font-medium text-amber-700">
              {progress.done}/{progress.total} {progress.failed > 0 && `· ${progress.failed} lỗi`}
            </span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-amber-100">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${Math.round(((progress.done + progress.failed) / Math.max(1, progress.total)) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Retry failed only — appears whenever there are failed images */}
        {failedCount > 0 && !isGenerating && (
          <button
            onClick={onRetryFailed}
            title={`Chỉ tạo lại ${failedCount} ảnh lỗi (~${estCreditsFailed} credit)`}
            className="flex items-center gap-1 rounded-full border border-red-200 bg-white px-3 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-50"
          >
            <AlertTriangle className="h-3 w-3" /> Tạo lại {failedCount} ảnh lỗi (~{estCreditsFailed} credit)
          </button>
        )}

        {/* Generate only remaining — appears when some images are still empty */}
        {remaining > 0 && remaining < totalImages && !isGenerating && (
          <button
            onClick={onGenerateRemaining}
            title={`Chỉ tạo ${remaining} ảnh còn thiếu (~${estCreditsRemaining} credit)`}
            className="flex items-center gap-1 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-[11px] font-bold text-violet-700 hover:bg-violet-50"
          >
            <Sparkles className="h-3 w-3" /> Tạo {remaining} ảnh còn thiếu (~{estCreditsRemaining} credit)
          </button>
        )}

        {/* Bulk gen-all — bold primary CTA */}
        <button
          onClick={onGenerateAll}
          disabled={isGenerating || totalImages === 0}
          title={`Sinh toàn bộ ${totalImages} ảnh (~${estCreditsAll} credit)`}
          className="flex items-center gap-1.5 rounded-full bg-amber-600 px-4 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {isGenerating
            ? 'Đang sinh…'
            : generated > 0
              ? `Sinh lại tất cả ${totalImages} ảnh (~${estCreditsAll} credit)`
              : `Sinh tất cả ${totalImages} ảnh (~${estCreditsAll} credit)`}
        </button>
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
