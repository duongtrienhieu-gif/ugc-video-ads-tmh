import { useState, useEffect } from 'react'
import { Loader2, LayoutTemplate, Save, Check, RotateCcw, Trash2, FolderOpen, ChevronDown, ImageIcon, Sparkles, AlertTriangle, Clock, Zap, RefreshCw, FilePlus, FileDown, Copy as CopyIcon, FolderInput } from 'lucide-react'
import type { LandingPagePack, SavedLandingPack } from '../types'
import type { ImageProgress } from '../LandingPageAI'
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
  /** Z8 progress: done / failed / total / retries / startedAt */
  imageProgress: ImageProgress | null
  isGeneratingImages: boolean
  // ── Project system (Canva-style) ─────────────────────────────────────
  /** Id of the currently-loaded saved project (null = fresh session). */
  loadedFromId?: string | null
  /** Display title of the loaded project (shown in top bar). */
  loadedProjectTitle?: string
  /** Click handler when user opens a saved project from the history list. */
  onLoadProject?: (id: string) => void
  /** "Lưu thành project" — creates a new saved project or syncs existing one. */
  onSaveAsProject?: (title?: string) => void
  /** "Project mới" — clears the loaded-project link + active pack. */
  onNewProject?: () => void
}

export default function OutputPanel({
  pack, isGenerating, onRegenerate,
  onGenerateAllImages, onGenerateRemaining, onRetryFailed,
  onRegenerateImage, onDeleteImage,
  imageProgress, isGeneratingImages,
  loadedFromId, loadedProjectTitle,
  onLoadProject, onSaveAsProject, onNewProject,
}: OutputPanelProps) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')

  const addToStore = useLandingPageStore((s) => s.add)
  const addToast = useAppStore((s) => s.addToast)

  // Prefer the project-system save handler if provided (Canva-style)
  const handleSave = () => {
    if (!pack || saving || saved) return
    setSaving(true)
    try {
      const t = title.trim() || `${pack.productName} — Landing Pack`
      if (onSaveAsProject) {
        onSaveAsProject(t)
      } else {
        addToStore(pack, t)
      }
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
            Output 17 sections — hoặc mở lại một project đã lưu bên dưới.
          </p>
        </div>
        <SavedHistorySection onLoadProject={onLoadProject} loadedFromId={loadedFromId} />
      </div>
    )
  }

  // ── Result state ──────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top action bar — 3-zone grid so the "Lưu LandingPage" button sits
          visibly in the CENTER on lg+ screens. The right zone is a fixed
          19rem spacer that reserves room for the global Gemini/KIE badges
          (which live in App.tsx at position absolute right-4 top-3 z-50)
          so they no longer cover the save button. Below lg the layout
          collapses to a single column. */}
      <div className="shrink-0 border-b border-black/8 bg-gradient-to-r from-violet-50/40 to-purple-50/30 px-5 py-3">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_auto_19rem] lg:items-center">
          {/* Zone 1 — title + sync badge + meta */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-sm font-bold text-gray-900">
                {pack.productName} — {pack.sections.length} sections
              </p>
              {loadedFromId && loadedProjectTitle && (
                <span
                  className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700"
                  title="Đang chỉnh sửa project — mọi thay đổi tự đồng bộ"
                >
                  <FolderInput className="h-2.5 w-2.5" />
                  {loadedProjectTitle}
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-400">
              Ngôn ngữ: {pack.language.toUpperCase()} · Tạo lúc {new Date(pack.generatedAt).toLocaleTimeString('vi-VN')}
              {loadedFromId && ' · ✓ Tự đồng bộ project'}
            </p>
          </div>

          {/* Zone 2 — action buttons (CENTERED on lg+) */}
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {!loadedFromId && (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`vd: "${pack.productName} v1"`}
                className="w-44 rounded-lg border border-black/10 bg-white px-2 py-1.5 text-[11px] outline-none focus:border-violet-500/40"
              />
            )}
            {loadedFromId && onNewProject && (
              <button
                onClick={onNewProject}
                title="Thoát project và bắt đầu mới"
                className="flex items-center gap-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-black/[0.04]"
              >
                <FilePlus className="h-3 w-3" /> Project mới
              </button>
            )}
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
              className={`flex items-center gap-1 rounded-full px-4 py-1.5 text-[11px] font-bold shadow-sm transition-colors ${
                saved
                  ? 'bg-emerald-500/15 text-emerald-700'
                  : loadedFromId
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-violet-600 text-white hover:bg-violet-700'
              }`}
            >
              {saved
                ? <><Check className="h-3 w-3" /> Đã lưu</>
                : loadedFromId
                  ? <><Save className="h-3 w-3" /> Lưu thay đổi</>
                  : <><Save className="h-3 w-3" /> Lưu LandingPage</>}
            </button>
          </div>

          {/* Zone 3 — spacer reserving room for the global Gemini/KIE badges
              (App.tsx absolute right-4 top-3 z-50). Only rendered on lg+
              since badges hide on smaller breakpoints. */}
          <div className="hidden lg:block" aria-hidden="true" />
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

        <SavedHistorySection onLoadProject={onLoadProject} loadedFromId={loadedFromId} />
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
  progress: ImageProgress | null
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
          <ProgressMeter progress={progress} />
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
// Z8 ProgressMeter — ETA + images/min + retry count.
// Shows live throughput so the user trusts the new fast pipeline.
// ─────────────────────────────────────────────────────────────────────
function ProgressMeter({ progress }: { progress: ImageProgress }) {
  // 1s tick — keeps elapsed/ETA fresh between completions.
  // `now` lives in state (instead of calling Date.now() in render) so the
  // component remains pure under React 19's strict purity rule.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const finished  = progress.done + progress.failed
  const remaining = Math.max(0, progress.total - finished)
  const elapsedMs = Math.max(1, now - progress.startedAt)
  const elapsedSec = elapsedMs / 1000

  // Throughput — images per minute (only after the first image lands)
  const imagesPerMin = finished > 0 ? (finished / elapsedSec) * 60 : 0

  // ETA — based on average time per finished image; shown after >=1 image done
  let etaText = '…'
  if (finished > 0 && remaining > 0) {
    const avgMs = elapsedMs / finished
    const etaSec = Math.round((remaining * avgMs) / 1000)
    etaText = etaSec >= 60
      ? `${Math.floor(etaSec / 60)}m ${etaSec % 60}s`
      : `${etaSec}s`
  } else if (remaining === 0) {
    etaText = 'xong'
  }

  const pct = Math.round((finished / Math.max(1, progress.total)) * 100)

  return (
    <div className="flex flex-col gap-1 min-w-[220px]">
      <div className="flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
        <span className="text-[11px] font-bold tabular-nums text-amber-800">
          {progress.done}/{progress.total} ảnh
        </span>
        {progress.failed > 0 && (
          <span className="text-[10px] font-bold text-red-600">· {progress.failed} lỗi</span>
        )}
        <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold tabular-nums text-amber-700">
          <Clock className="h-2.5 w-2.5" /> còn {etaText}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-100">
        <div
          className="h-full bg-amber-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center gap-3 text-[9px] text-amber-700/80">
        <span className="flex items-center gap-0.5">
          <Zap className="h-2.5 w-2.5" />
          {imagesPerMin > 0 ? `${imagesPerMin.toFixed(1)} ảnh/phút` : 'đang khởi động…'}
        </span>
        {progress.retries > 0 && (
          <span className="flex items-center gap-0.5">
            <RefreshCw className="h-2.5 w-2.5" />
            {progress.retries} lần retry
          </span>
        )}
        <span className="ml-auto tabular-nums">{Math.round(elapsedSec)}s đã chạy</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Saved history — Project → Landing Pages
// ─────────────────────────────────────────────────────────────────────

function SavedHistorySection({
  onLoadProject, loadedFromId,
}: {
  onLoadProject?: (id: string) => void
  loadedFromId?: string | null
}) {
  const items = useLandingPageStore((s) => s.items)
  const remove = useLandingPageStore((s) => s.remove)
  const duplicate = useLandingPageStore((s) => s.duplicate)
  const updateTitle = useLandingPageStore((s) => s.updateTitle)
  const addToast = useAppStore((s) => s.addToast)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (items.length === 0) return null

  return (
    <div className="mt-6 border-t border-black/8 pt-5">
      <h3 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
        <FolderOpen className="h-3.5 w-3.5" />
        Project → Landing Pages ({items.length})
      </h3>
      <p className="mb-3 text-[10px] text-gray-400">
        Click "Mở" để tiếp tục chỉnh sửa — mọi thay đổi tự lưu lại project.
      </p>
      <div className="space-y-2">
        {items.map((item) => (
          <SavedRow
            key={item.id}
            item={item}
            isOpen={expandedId === item.id}
            isLoaded={loadedFromId === item.id}
            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onRemove={() => remove(item.id)}
            onOpen={onLoadProject ? () => onLoadProject(item.id) : undefined}
            onDuplicate={() => {
              const copy = duplicate(item.id)
              if (copy) addToast(`✓ Đã nhân bản → "${copy.title}"`)
            }}
            onRename={(title) => updateTitle(item.id, title)}
            onExportJson={() => {
              const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `${item.title.replace(/[^\w\d-]+/g, '_')}.json`
              a.click()
              setTimeout(() => URL.revokeObjectURL(url), 1000)
              addToast('✓ Đã xuất JSON')
            }}
          />
        ))}
      </div>
    </div>
  )
}

function SavedRow({
  item, isOpen, isLoaded, onToggle, onRemove, onOpen, onDuplicate, onRename, onExportJson,
}: {
  item: SavedLandingPack
  isOpen: boolean
  isLoaded?: boolean
  onToggle: () => void
  onRemove: () => void
  onOpen?: () => void
  onDuplicate?: () => void
  onRename?: (title: string) => void
  onExportJson?: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [titleDraft, setTitleDraft] = useState(item.title)

  const commitRename = () => {
    const t = titleDraft.trim()
    if (t && t !== item.title && onRename) onRename(t)
    setRenaming(false)
  }

  return (
    <div className={`rounded-xl border bg-white overflow-hidden transition-colors ${
      isLoaded ? 'border-violet-400 ring-2 ring-violet-200/60' : 'border-black/10'
    }`}>
      <div className="flex w-full items-center gap-2 px-3 py-2 hover:bg-black/[0.02]">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-2 text-left min-w-0"
        >
          <LayoutTemplate className={`h-4 w-4 shrink-0 ${isLoaded ? 'text-violet-700' : 'text-violet-500'}`} />
          <div className="min-w-0 flex-1">
            {renaming ? (
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') { setTitleDraft(item.title); setRenaming(false) }
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className="w-full rounded border border-violet-300 bg-white px-1.5 py-0.5 text-xs font-semibold text-gray-800 outline-none"
              />
            ) : (
              <p className="truncate text-xs font-semibold text-gray-800">
                {item.title}
                {isLoaded && (
                  <span className="ml-1.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">
                    đang mở
                  </span>
                )}
              </p>
            )}
            <p className="truncate text-[10px] text-gray-400">
              {item.language.toUpperCase()} · {item.sections.length} sections · {new Date(item.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
          </div>
        </button>

        {/* Per-item actions */}
        <div className="flex shrink-0 items-center gap-0.5">
          {onOpen && !isLoaded && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpen() }}
              title="Tiếp tục chỉnh sửa"
              className="rounded-md bg-violet-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-violet-700"
            >
              Mở
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setRenaming((v) => !v) }}
            title="Đổi tên"
            className="rounded-md p-1 text-gray-400 hover:bg-black/5 hover:text-gray-700"
          >
            <FilePlus className="h-3.5 w-3.5" />
          </button>
          {onDuplicate && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDuplicate() }}
              title="Nhân bản"
              className="rounded-md p-1 text-gray-400 hover:bg-black/5 hover:text-gray-700"
            >
              <CopyIcon className="h-3.5 w-3.5" />
            </button>
          )}
          {onExportJson && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onExportJson() }}
              title="Xuất JSON"
              className="rounded-md p-1 text-gray-400 hover:bg-black/5 hover:text-gray-700"
            >
              <FileDown className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle() }}
            title={isOpen ? 'Thu gọn' : 'Xem trước'}
            className="rounded-md p-1 text-gray-400 hover:bg-black/5 hover:text-gray-700"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (confirm(`Xoá vĩnh viễn project "${item.title}"?`)) onRemove() }}
            title="Xoá"
            className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
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
