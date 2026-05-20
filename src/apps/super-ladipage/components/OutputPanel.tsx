import { useState, useEffect } from 'react'
import { Loader2, LayoutTemplate, Save, Check, RotateCcw, Trash2, FolderOpen, ChevronDown, ImageIcon, Sparkles, AlertTriangle, Clock, Zap, RefreshCw, FilePlus, FileDown, Copy as CopyIcon, FolderInput, X } from 'lucide-react'
import type { LandingPagePack, SavedLandingPack } from '../types'
import type { ImageProgress } from '../SuperLadipage'
import SectionCard from './SectionCard'
import { useSuperLadipageStore } from '../store'
import { useAppStore } from '../../../stores/appStore'

/** KIE gpt-image-2 @ 1K resolution ~ 6 credits per call. */
const CREDIT_PER_IMAGE = 6

interface OutputPanelProps {
  pack: LandingPagePack | null
  isGenerating: boolean
  onRegenerate: () => void
  onGenerateAllImages: () => void
  onGenerateRemaining: () => void
  onRetryFailed: () => void
  onRegenerateImage: (sectionIdx: number, imageIdx: number) => void
  onDeleteImage: (sectionIdx: number, imageIdx: number) => void
  imageProgress: ImageProgress | null
  isGeneratingImages: boolean
  loadedFromId?: string | null
  loadedProjectTitle?: string
  onLoadProject?: (id: string) => void
  onSaveAsProject?: (title?: string) => void
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

  const addToStore = useSuperLadipageStore((s) => s.add)
  const addToast = useAppStore((s) => s.addToast)

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
      addToast(`✓ Đã lưu "${t}" vào Landing Page đã lưu`)
    } finally {
      setSaving(false)
    }
  }

  if (isGenerating && !pack) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        <p className="text-sm font-medium text-gray-700">AI đang tạo landing page...</p>
        <p className="text-xs text-gray-400 max-w-sm">
          Đang viết copy + bố cục section + image prompts theo kiểu landing page bạn đã chọn
        </p>
      </div>
    )
  }

  if (!pack) {
    return (
      <div className="flex h-full flex-col overflow-y-auto p-6">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <LayoutTemplate className="h-10 w-10 text-gray-200" strokeWidth={1.5} />
          <p className="text-sm text-gray-400">Chọn sản phẩm + nhấn "Tạo Landing Pack"</p>
          <p className="text-xs text-gray-300 max-w-sm">
            Output landing page theo kiểu đã chọn — hoặc mở lại một landing page đã lưu bên dưới.
          </p>
        </div>
        <SavedHistorySection onLoadProject={onLoadProject} loadedFromId={loadedFromId} />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-black/8 bg-gradient-to-r from-violet-50/40 to-purple-50/30 px-3 md:px-5 py-2 md:py-3">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_auto_19rem] lg:items-center">
          <div className="min-w-0 pr-20 md:pr-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-xs md:text-sm font-bold text-gray-900">
                {pack.productName} <span className="text-gray-400 font-medium">— {pack.sections.length} sections</span>
              </p>
              {loadedFromId && loadedProjectTitle && (
                <span
                  className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700"
                  title="Đang chỉnh sửa project — mọi thay đổi tự đồng bộ"
                >
                  <FolderInput className="h-2.5 w-2.5" />
                  <span className="truncate max-w-[120px] md:max-w-none">{loadedProjectTitle}</span>
                </span>
              )}
            </div>
            <p className="hidden md:block text-[10px] text-gray-400">
              Ngôn ngữ: {pack.language.toUpperCase()} · Tạo lúc {new Date(pack.generatedAt).toLocaleTimeString('vi-VN')}
              {loadedFromId && ' · ✓ Tự đồng bộ project'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-start lg:justify-center gap-1.5">
            {!loadedFromId && (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`vd: "${pack.productName} v1"`}
                className="w-28 md:w-44 rounded-lg border border-black/10 bg-white px-2 py-1.5 text-[11px] outline-none focus:border-violet-500/40"
              />
            )}
            {loadedFromId && onNewProject && (
              <button
                onClick={onNewProject}
                title="Thoát project và bắt đầu mới"
                className="flex items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 md:px-3 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-black/[0.04]"
              >
                <FilePlus className="h-3 w-3" /> <span className="hidden md:inline">Project mới</span><span className="md:hidden">Mới</span>
              </button>
            )}
            <button
              onClick={onRegenerate}
              disabled={isGenerating}
              title="Tạo lại landing pack"
              className="flex items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 md:px-3 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-black/[0.04] disabled:opacity-40"
            >
              {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              <span className="hidden md:inline">Tạo lại</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saving || saved}
              title={loadedFromId ? 'Lưu thay đổi vào project' : 'Lưu landing page'}
              className={`flex items-center gap-1 rounded-full px-3 md:px-4 py-1.5 text-[11px] font-bold shadow-sm transition-colors ${
                saved
                  ? 'bg-emerald-500/15 text-emerald-700'
                  : loadedFromId
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-violet-600 text-white hover:bg-violet-700'
              }`}
            >
              {saved
                ? <><Check className="h-3 w-3" /> <span className="hidden md:inline">Đã lưu</span><span className="md:hidden">✓</span></>
                : loadedFromId
                  ? <><Save className="h-3 w-3" /> <span className="hidden md:inline">Lưu thay đổi</span><span className="md:hidden">Lưu</span></>
                  : <><Save className="h-3 w-3" /> <span className="hidden md:inline">Lưu LandingPage</span><span className="md:hidden">Lưu</span></>}
            </button>
          </div>

          <div className="hidden lg:block" aria-hidden="true" />
        </div>
      </div>

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

      <SavedHistorySection
        onLoadProject={onLoadProject}
        loadedFromId={loadedFromId}
        variant="collapsible"
      />

      <div className="flex-1 overflow-y-auto p-2 md:p-4 pb-20 md:pb-4">
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
      </div>
    </div>
  )
}

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

  // Status chips dùng counter derive từ pack.sections — auto-update kể cả
  // khi gen từng ảnh thủ công (regenerateSingleImage cũng patch pack state).
  const notStarted = Math.max(0, totalImages - generated - failedCount)

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
          <ImageIcon className="h-3.5 w-3.5 text-amber-600" />
          Sinh ảnh thật cho landing pack
        </p>
        {/* Status chips — visible trong red-box area, auto-update từ pack state */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span
            className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
            title={`${generated} ảnh đã render thành công`}
          >
            <Check className="h-2.5 w-2.5" />
            Thành công: {generated}/{totalImages}
          </span>
          {failedCount > 0 && (
            <span
              className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700"
              title={`${failedCount} ảnh fail — bấm "Tạo lại N ảnh lỗi" để retry`}
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              Thất bại: {failedCount}
            </span>
          )}
          {notStarted > 0 && (
            <span
              className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600"
              title={`${notStarted} ảnh chưa được tạo`}
            >
              <Clock className="h-2.5 w-2.5" />
              Chưa làm: {notStarted}
            </span>
          )}
          <span className="text-[10px] text-gray-400">
            · <span className="font-medium text-amber-700">1 ảnh ≈ {CREDIT_PER_IMAGE} credit</span>
            {pack.visualMemory.length > 0 && ` · ${pack.visualMemory.length} ảnh tham chiếu`}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {isGenerating && progress && (
          <ProgressMeter progress={progress} />
        )}

        {failedCount > 0 && !isGenerating && (
          <button
            onClick={onRetryFailed}
            title={`Chỉ tạo lại ${failedCount} ảnh lỗi (~${estCreditsFailed} credit)`}
            className="flex items-center gap-1 rounded-full border border-red-200 bg-white px-2.5 md:px-3 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-50"
          >
            <AlertTriangle className="h-3 w-3" />
            <span className="md:hidden">Lỗi {failedCount}</span>
            <span className="hidden md:inline">Tạo lại {failedCount} ảnh lỗi (~{estCreditsFailed} credit)</span>
          </button>
        )}

        {remaining > 0 && remaining < totalImages && !isGenerating && (
          <button
            onClick={onGenerateRemaining}
            title={`Chỉ tạo ${remaining} ảnh còn thiếu (~${estCreditsRemaining} credit)`}
            className="flex items-center gap-1 rounded-full border border-violet-200 bg-white px-2.5 md:px-3 py-1.5 text-[11px] font-bold text-violet-700 hover:bg-violet-50"
          >
            <Sparkles className="h-3 w-3" />
            <span className="md:hidden">Còn {remaining}</span>
            <span className="hidden md:inline">Tạo {remaining} ảnh còn thiếu (~{estCreditsRemaining} credit)</span>
          </button>
        )}

        <button
          onClick={onGenerateAll}
          disabled={isGenerating || totalImages === 0}
          title={`Sinh toàn bộ ${totalImages} ảnh (~${estCreditsAll} credit)`}
          className="flex items-center gap-1.5 rounded-full bg-amber-600 px-3 md:px-4 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {isGenerating ? (
            <span>Đang sinh…</span>
          ) : (
            <>
              <span className="md:hidden">
                {generated > 0 ? `Sinh lại ${totalImages}` : `Sinh ${totalImages} ảnh`}
              </span>
              <span className="hidden md:inline">
                {generated > 0
                  ? `Sinh lại tất cả ${totalImages} ảnh (~${estCreditsAll} credit)`
                  : `Sinh tất cả ${totalImages} ảnh (~${estCreditsAll} credit)`}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────

function ProgressMeter({ progress }: { progress: ImageProgress }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const finished  = progress.done + progress.failed
  const remaining = Math.max(0, progress.total - finished)
  const elapsedMs = Math.max(1, now - progress.startedAt)
  const elapsedSec = elapsedMs / 1000

  const imagesPerMin = finished > 0 ? (finished / elapsedSec) * 60 : 0

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
// Saved history — Landing Page đã lưu
// ─────────────────────────────────────────────────────────────────────

function SavedHistorySection({
  onLoadProject, loadedFromId, variant = 'expanded',
}: {
  onLoadProject?: (id: string) => void
  loadedFromId?: string | null
  variant?: 'expanded' | 'collapsible'
}) {
  const items = useSuperLadipageStore((s) => s.items)
  const remove = useSuperLadipageStore((s) => s.remove)
  const duplicate = useSuperLadipageStore((s) => s.duplicate)
  const updateTitle = useSuperLadipageStore((s) => s.updateTitle)
  const addToast = useAppStore((s) => s.addToast)
  const [previewPack, setPreviewPack] = useState<SavedLandingPack | null>(null)
  const [panelOpen, setPanelOpen] = useState(variant === 'expanded')
  const [search, setSearch] = useState('')

  if (items.length === 0) return null

  const sortedItems = [...items].sort((a, b) => {
    if (a.id === loadedFromId) return -1
    if (b.id === loadedFromId) return 1
    return 0
  })
  const filteredItems = search.trim()
    ? sortedItems.filter((x) => x.title.toLowerCase().includes(search.trim().toLowerCase()))
    : sortedItems

  const handleExportJson = (item: SavedLandingPack) => {
    const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${item.title.replace(/[^\w\d-]+/g, '_')}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    addToast('✓ Đã xuất JSON')
  }

  const rows = (
    <div className={variant === 'collapsible' ? 'max-h-64 space-y-2 overflow-y-auto pr-1' : 'space-y-2'}>
      {filteredItems.map((item) => (
        <SavedRow
          key={item.id}
          item={item}
          isLoaded={loadedFromId === item.id}
          onPreview={() => setPreviewPack(item)}
          onRemove={() => remove(item.id)}
          onOpen={onLoadProject ? () => onLoadProject(item.id) : undefined}
          onDuplicate={() => {
            const copy = duplicate(item.id)
            if (copy) addToast(`✓ Đã nhân bản → "${copy.title}"`)
          }}
          onRename={(title) => updateTitle(item.id, title)}
          onExportJson={() => handleExportJson(item)}
        />
      ))}
      {filteredItems.length === 0 && (
        <p className="px-2 py-3 text-center text-[11px] text-gray-400">
          Không có project nào khớp "{search}"
        </p>
      )}
    </div>
  )

  const drawer = previewPack ? (
    <SavedPackDrawer
      pack={previewPack}
      onClose={() => setPreviewPack(null)}
      onOpen={onLoadProject ? () => { onLoadProject(previewPack.id); setPreviewPack(null) } : undefined}
      onDuplicate={() => {
        const copy = duplicate(previewPack.id)
        if (copy) {
          addToast(`✓ Đã nhân bản → "${copy.title}"`)
          setPreviewPack(null)
        }
      }}
      onExportJson={() => handleExportJson(previewPack)}
      onRemove={() => {
        if (confirm(`Xoá vĩnh viễn project "${previewPack.title}"?`)) {
          remove(previewPack.id)
          setPreviewPack(null)
        }
      }}
    />
  ) : null

  if (variant === 'expanded') {
    return (
      <>
        <div className="mt-6 border-t border-black/8 pt-5">
          <h3 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
            <FolderOpen className="h-3.5 w-3.5" />
            Landing Page đã lưu ({items.length})
          </h3>
          <p className="mb-3 text-[10px] text-gray-400">
            Click vào landing page để xem nhanh. Bấm "Mở" để tiếp tục chỉnh sửa.
          </p>
          {rows}
        </div>
        {drawer}
      </>
    )
  }

  return (
    <>
      <div className="shrink-0 border-b border-black/8 bg-violet-50/30 px-5 py-2">
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className="flex w-full items-center gap-2 text-left"
        >
          <FolderOpen className="h-3.5 w-3.5 text-violet-600" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-700">
            Landing Page đã lưu
          </span>
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
            {items.length}
          </span>
          {loadedFromId && (
            <span className="hidden sm:inline text-[10px] text-violet-600/70">
              · đang chỉnh: {items.find((x) => x.id === loadedFromId)?.title ?? '?'}
            </span>
          )}
          <ChevronDown className={`ml-auto h-3.5 w-3.5 text-gray-400 transition-transform ${panelOpen ? 'rotate-180' : ''}`} />
        </button>

        {panelOpen && (
          <div className="mt-2 space-y-2">
            {items.length > 4 && (
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên landing page..."
                className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[11px] outline-none focus:border-violet-500/40"
              />
            )}
            {rows}
          </div>
        )}
      </div>
      {drawer}
    </>
  )
}

function SavedRow({
  item, isLoaded, onPreview, onRemove, onOpen, onDuplicate, onRename, onExportJson,
}: {
  item: SavedLandingPack
  isLoaded?: boolean
  onPreview: () => void
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
          onClick={onPreview}
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
            onClick={(e) => { e.stopPropagation(); onPreview() }}
            title="Xem trước"
            className="rounded-md p-1 text-gray-400 hover:bg-black/5 hover:text-gray-700"
          >
            <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
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
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────

function SavedPackDrawer({
  pack, onClose, onOpen, onDuplicate, onExportJson, onRemove,
}: {
  pack: SavedLandingPack
  onClose: () => void
  onOpen?: () => void
  onDuplicate: () => void
  onExportJson: () => void
  onRemove: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Xem trước ${pack.title}`}
    >
      <button
        type="button"
        aria-label="Đóng"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm animate-in fade-in"
      />

      <div className="relative flex h-full w-full flex-col bg-white shadow-2xl animate-in slide-in-from-right md:w-[75vw] md:max-w-[1100px]">
        <div className="shrink-0 border-b border-black/8 bg-white px-5 py-3">
          <div className="flex items-center gap-3">
            <LayoutTemplate className="h-5 w-5 shrink-0 text-violet-500" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-bold text-gray-900">{pack.title}</h2>
              <p className="text-[11px] text-gray-400">
                {pack.language.toUpperCase()} · {pack.sections.length} sections · Tạo lúc {new Date(pack.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="rounded-full p-1.5 text-gray-400 hover:bg-black/5 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {onOpen && (
              <button
                type="button"
                onClick={onOpen}
                className="flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-violet-700"
              >
                <FolderInput className="h-3 w-3" /> Mở chỉnh sửa
              </button>
            )}
            <button
              type="button"
              onClick={onDuplicate}
              className="flex items-center gap-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-black/[0.04]"
            >
              <CopyIcon className="h-3 w-3" /> Nhân bản
            </button>
            <button
              type="button"
              onClick={onExportJson}
              className="flex items-center gap-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-black/[0.04]"
            >
              <FileDown className="h-3 w-3" /> Xuất JSON
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="ml-auto flex items-center gap-1 rounded-full border border-red-200 bg-white px-3 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3 w-3" /> Xoá
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50/40 px-5 py-4">
          <div className="space-y-3">
            {pack.sections.map((s, i) => (
              <SectionCard key={`${s.type}-${i}`} index={i} section={s} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
