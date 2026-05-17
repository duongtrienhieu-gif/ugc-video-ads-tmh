import { useState, useEffect } from 'react'
import { Loader2, LayoutTemplate, Save, Check, RotateCcw, Trash2, FolderOpen, ChevronDown, ImageIcon, Sparkles, AlertTriangle, Clock, Zap, RefreshCw, FilePlus, FileDown, Copy as CopyIcon, FolderInput, Cpu, LayoutGrid, Cloud, CloudOff, CloudCog, ScanSearch, ShieldAlert } from 'lucide-react'
import type { LandingPagePack, SavedLandingPack } from '../types'
import type { ImageProgress } from '../LandingPageAI'
import SectionCard from './SectionCard'
import { useLandingPageStore } from '../store'
import { useAppStore } from '../../../stores/appStore'
import { isHybridRenderEnabled } from '../lib/featureFlags'
import { planRenderPack } from '../services/renderPlanner'
import { scanSection, type SectionScanReport } from '../services/fakeSimilarityQC'

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
      {/* Top action bar — 3-zone layout to avoid the global API badges that
          live in App.tsx at right-4 top-3 z-50 (Gemini chip + KIE credit).
          Zone 1 (left): title meta block — flex-grow but capped.
          Zone 2 (center): save / regen action buttons — visually centered.
          Zone 3 (right): empty spacer ~19rem wide reserving space for the
                          global badges so they never overlap our buttons. */}
      <div className="shrink-0 border-b border-black/8 bg-gradient-to-r from-violet-50/40 to-purple-50/30 px-5 py-3">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_auto_19rem] lg:items-center lg:gap-3">
          {/* Zone 1 — Title + sync badge */}
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
              <CloudSyncBadge />
            </div>
            <p className="text-[10px] text-gray-400">
              Ngôn ngữ: {pack.language.toUpperCase()} · Tạo lúc {new Date(pack.generatedAt).toLocaleTimeString('vi-VN')}
              {loadedFromId && ' · ✓ Tự đồng bộ project'}
            </p>
          </div>

          {/* Zone 2 — Action buttons centered, away from global API badges */}
          <div className="flex flex-wrap items-center justify-start gap-1.5 lg:justify-center">
            {!loadedFromId && (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`vd: "${pack.productName} v1"`}
                className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-[11px] outline-none focus:border-violet-500/40 w-44"
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

          {/* Zone 3 — Spacer matching the App-level badge column width.
              Hidden on smaller screens (badges hide too via responsive design
              upstream). Marked aria-hidden because it carries no semantic. */}
          <div aria-hidden className="hidden lg:block" />
        </div>
      </div>

      {/* Image generation bar — STICKY when generating so progress always visible while user scrolls sections */}
      <div className={`shrink-0 border-b border-black/8 bg-amber-50/30 px-5 py-2.5 ${
        isGeneratingImages ? 'sticky top-0 z-20 shadow-md bg-amber-50/95 backdrop-blur-sm' : ''
      }`}>
        <ImageGenerationBar
          pack={pack}
          onGenerateAll={onGenerateAllImages}
          onGenerateRemaining={onGenerateRemaining}
          onRetryFailed={onRetryFailed}
          progress={imageProgress}
          isGenerating={isGeneratingImages}
        />
        {/* H3: Fake similarity scanner — surfaces clone-look risks across sections */}
        <SimilarityScanPanel pack={pack} />
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
// SimilarityScanPanel — H3 Phase
// On-demand "Quét tương đồng" scanner. Compares consecutive AI-rendered
// images within multi-image sections to detect AI-clone look. Surfaces
// flagged pairs as warning chips so user can decide whether to regenerate.
// Never auto-regenerates (avoids burning credit on false positives).
// ─────────────────────────────────────────────────────────────────────
function SimilarityScanPanel({ pack }: { pack: LandingPagePack }) {
  const [reports, setReports] = useState<SectionScanReport[]>([])
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const addToast = useAppStore((s) => s.addToast)

  // Eligible sections: at least 2 AI-rendered images (excluding template-composed)
  const eligibleSections = pack.sections
    .map((s, idx) => ({ section: s, idx }))
    .filter(({ section }) => {
      const aiDone = section.imagePrompts.filter(
        (p) => p.status === 'done'
          && p.generatedAssetRef
          && (p.renderStrategy === 'ai_full_render' || p.renderStrategy === 'reusable_render' || !p.renderStrategy),
      )
      return aiDone.length >= 2
    })

  if (eligibleSections.length === 0) return null

  const totalPairs = eligibleSections.reduce(
    (acc, { section }) => acc + Math.max(0, section.imagePrompts.filter((p) => p.status === 'done').length - 1),
    0,
  )

  const handleScan = async (): Promise<void> => {
    setScanning(true)
    setReports([])
    setProgress({ done: 0, total: totalPairs })
    let done = 0
    const newReports: SectionScanReport[] = []
    try {
      for (const { section, idx } of eligibleSections) {
        const imageRefs = section.imagePrompts
          .map((p, i) => ({ ref: p.generatedAssetRef ?? '', idx: i, status: p.status }))
          .filter((x) => x.ref && x.status === 'done')
        if (imageRefs.length < 2) continue
        const report = await scanSection(
          section.type, idx,
          imageRefs.map((x) => ({ ref: x.ref, idx: x.idx })),
          () => {
            done++
            setProgress({ done, total: totalPairs })
          },
        )
        newReports.push(report)
      }
      setReports(newReports)
      const flaggedCount = newReports.reduce((acc, r) => acc + r.flaggedImageIdx.length, 0)
      if (flaggedCount > 0) {
        addToast(`⚠ Phát hiện ${flaggedCount} ảnh có dấu hiệu trùng — xem chi tiết ở panel scanner`, 'info')
      } else {
        addToast('✓ Không thấy ảnh nào bị clone — pack OK', 'success')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Quét tương đồng lỗi: ${msg}`, 'error')
    } finally {
      setScanning(false)
      setProgress(null)
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50/40 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <ScanSearch className="h-3.5 w-3.5 text-cyan-700" />
          <span className="text-[11px] font-semibold text-cyan-900">
            Fake Detector QC
          </span>
          <span className="text-[10px] text-cyan-700">
            {scanning && progress
              ? `Đang quét... ${progress.done}/${progress.total} pair`
              : reports.length > 0
                ? `Đã quét ${reports.reduce((a, r) => a + r.pairs.length, 0)} pair`
                : `Sẵn sàng quét ${totalPairs} pair · ~${Math.ceil(totalPairs * 0.001 * 100) / 100}$ Gemini`}
          </span>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning || totalPairs === 0}
          className="flex items-center gap-1 rounded-full bg-cyan-600 px-3 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {scanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <ScanSearch className="h-3 w-3" />}
          {scanning ? 'Đang quét...' : reports.length > 0 ? 'Quét lại' : 'Quét tương đồng'}
        </button>
      </div>

      {reports.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {reports.map((report) => {
            const section = pack.sections[report.sectionIdx]
            const sev = report.maxSimilarity >= 85 ? 'red' : report.maxSimilarity >= 70 ? 'amber' : 'emerald'
            const sevColors = {
              red:     'border-red-300 bg-red-50 text-red-900',
              amber:   'border-amber-300 bg-amber-50 text-amber-900',
              emerald: 'border-emerald-300 bg-emerald-50 text-emerald-900',
            }[sev]
            const sevIcon = sev === 'emerald' ? <Check className="h-3 w-3 text-emerald-600" /> : <ShieldAlert className="h-3 w-3" />
            const sevLabel = sev === 'red'
              ? 'CAO — cần regen'
              : sev === 'amber'
                ? 'Trung bình — cân nhắc regen'
                : 'OK'
            return (
              <details key={report.sectionIdx} className={`rounded-md border ${sevColors} px-2 py-1.5`}>
                <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold">
                  {sevIcon}
                  Section #{report.sectionIdx + 1} ({section?.type ?? '?'}) — {report.maxSimilarity}% similarity · {sevLabel}
                  {report.flaggedImageIdx.length > 0 && (
                    <span className="ml-auto rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold">
                      ⚠ {report.flaggedImageIdx.length} ảnh
                    </span>
                  )}
                </summary>
                <div className="mt-2 space-y-1">
                  {report.pairs.map((pair, pi) => (
                    <div key={pi} className="rounded bg-white/60 px-2 py-1 text-[10px]">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">
                          Pair {pi + 1}–{pi + 2}: {pair.result.overall}%
                        </span>
                        <span className="flex gap-1.5 text-[9px]">
                          <span title="Composition">📐 {pair.result.axes.composition}</span>
                          <span title="Body pose">🤚 {pair.result.axes.bodyPose}</span>
                          <span title="Background">🏠 {pair.result.axes.background}</span>
                          <span title="Lighting">💡 {pair.result.axes.lighting}</span>
                          <span title="Product">📦 {pair.result.axes.productPlacement}</span>
                        </span>
                      </div>
                      {pair.result.summaryVi && (
                        <p className="mt-0.5 text-[10px] italic opacity-80">{pair.result.summaryVi}</p>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )
          })}
        </div>
      )}
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

  // ── Cost estimate — hybrid mode aware ────────────────────────────────
  // When hybrid render is ON, only AI-required calls (ai_full_render +
  // reusable_render) cost credit. template/derived assets cost 0. This
  // makes the primary CTA reflect the ACTUAL cost user will be charged.
  const hybridOn = isHybridRenderEnabled()
  const plan = hybridOn ? planRenderPack(pack) : null

  // Per-strategy cost: count how many of the listed prompts are AI-renders
  function costForPrompts(predicate: (p: import('../types').ImagePrompt) => boolean): number {
    if (!hybridOn || !plan) {
      // Legacy: every prompt costs CREDIT_PER_IMAGE
      let count = 0
      pack.sections.forEach((s) => s.imagePrompts?.forEach((p) => { if (predicate(p)) count++ }))
      return count * CREDIT_PER_IMAGE
    }
    // Hybrid: only ai_full_render + reusable_render cost credit
    let kieCalls = 0
    pack.sections.forEach((section, sIdx) => {
      section.imagePrompts?.forEach((p, iIdx) => {
        if (!predicate(p)) return
        const asset = plan.assets.find((a) => a.sectionIdx === sIdx && a.imageIdx === iIdx)
        if (asset && (asset.strategy === 'ai_full_render' || asset.strategy === 'reusable_render')) {
          kieCalls++
        }
      })
    })
    return kieCalls * CREDIT_PER_IMAGE
  }

  const estCreditsAll       = costForPrompts(() => true)
  const estCreditsRemaining = costForPrompts((p) => p.status !== 'done' && p.status !== 'generating' && p.status !== 'queued')
  const estCreditsFailed    = costForPrompts((p) => p.status === 'failed')

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
          {' '}·{' '}
          {hybridOn ? (
            <span className="font-medium text-emerald-700">
              ⚡ Hybrid mode bật — chỉ tính credit cho {plan?.stats.kieCallsRequired ?? '?'} ảnh AI thật
            </span>
          ) : (
            <span className="font-medium text-amber-700">1 ảnh ≈ {CREDIT_PER_IMAGE} credit</span>
          )}
          {pack.visualMemory.length > 0 && ` · ${pack.visualMemory.length} ảnh tham chiếu`}
        </p>
        <HybridRenderMetrics pack={pack} />
        {!hybridOn && totalImages >= 20 && (
          <p className="mt-1 text-[10px] text-emerald-700">
            💡 Bật hybrid mode để tiết kiệm ~60% credit:{' '}
            <code className="rounded bg-emerald-50 px-1 py-px font-mono text-[10px] text-emerald-800">
              __setHybridRender(true)
            </code>
            {' '}rồi reload
          </p>
        )}
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
          title={hybridOn
            ? `Sinh ${totalImages} ảnh (~${estCreditsAll} credit hybrid)`
            : `Sinh toàn bộ ${totalImages} ảnh (~${estCreditsAll} credit)`}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40 ${
            hybridOn ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
          }`}
        >
          {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {isGenerating
            ? 'Đang sinh…'
            : hybridOn
              ? `⚡ Sinh ${totalImages} ảnh — chỉ ~${estCreditsAll} credit`
              : generated > 0
                ? `Sinh lại tất cả ${totalImages} ảnh (~${estCreditsAll} credit)`
                : `Sinh tất cả ${totalImages} ảnh (~${estCreditsAll} credit)`}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// CloudSyncBadge — Phase H2
// Tiny pill showing Supabase sync state. Hidden when sync is in 'idle'
// (initial mount before first attempt). Shown next to the project title.
// ─────────────────────────────────────────────────────────────────────
function CloudSyncBadge() {
  const status = useLandingPageStore((s) => s.syncStatus)
  const lastSyncedAt = useLandingPageStore((s) => s.lastSyncedAt)
  const error = useLandingPageStore((s) => s.syncError)

  if (status === 'idle') return null

  const config: Record<'syncing' | 'synced' | 'error' | 'offline', { icon: typeof Cloud; bg: string; text: string; label: string; title: string }> = {
    'syncing': { icon: CloudCog, bg: 'bg-cyan-100',    text: 'text-cyan-700',    label: 'Đang đồng bộ',     title: 'Đang push thay đổi lên Supabase…' },
    'synced':  { icon: Cloud,    bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Đã đồng bộ ☁',     title: lastSyncedAt ? `Đồng bộ thành công ${new Date(lastSyncedAt).toLocaleTimeString('vi-VN')}` : '' },
    'error':   { icon: CloudOff, bg: 'bg-red-100',     text: 'text-red-700',     label: 'Sync lỗi',          title: error ?? 'Không sync được — sẽ thử lại khi edit tiếp' },
    'offline': { icon: CloudOff, bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Local-only',        title: 'Chưa setup Supabase table — chạy SUPABASE_LANDING_PROJECTS_MIGRATION.md để bật cross-device sync' },
  }
  const c = config[status]
  if (!c) return null
  const Icon = c.icon

  return (
    <span
      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.bg} ${c.text}`}
      title={c.title}
    >
      <Icon className={`h-2.5 w-2.5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
      {c.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────
// HybridRenderMetrics — Phase 8 chip
// Shows AI render count vs template-composed vs derived for this pack
// when the hybrid render flag is on. Off → renders nothing.
// ─────────────────────────────────────────────────────────────────────
function HybridRenderMetrics({ pack }: { pack: LandingPagePack }) {
  if (!isHybridRenderEnabled()) return null
  const plan = planRenderPack(pack)
  const { stats } = plan
  const aiOnlyCost = stats.total * CREDIT_PER_IMAGE
  const hybridCost = stats.kieCallsRequired * CREDIT_PER_IMAGE
  const saved = aiOnlyCost - hybridCost
  const savedPct = aiOnlyCost > 0 ? Math.round((saved / aiOnlyCost) * 100) : 0

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px]">
      <span className="flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-semibold text-violet-700">
        <Cpu className="h-2.5 w-2.5" />
        Hybrid mode
      </span>
      <span className="text-amber-700">
        <strong>{stats.aiFullCount}</strong> AI render
      </span>
      <span className="text-cyan-700">
        + <strong>{stats.reusableCount}</strong> reusable
      </span>
      <span className="text-emerald-700 flex items-center gap-0.5">
        <LayoutGrid className="h-2.5 w-2.5" />
        <strong>{stats.templateComposedCount}</strong> template
      </span>
      <span className="text-pink-700">
        <strong>{stats.derivedCount}</strong> derived
      </span>
      <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 border border-emerald-200">
        💰 Tiết kiệm ~{saved} credit (-{savedPct}%)
      </span>
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
