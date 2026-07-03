// ── ExportPhase ──────────────────────────────────────────────────────────────
// Z35 Phase 6 UI — the "ad factory" final layer.
//
// Layout:
//   1. Format picker (6 platforms) — TikTok / Reels / Shorts / Square / Story / 4:5
//   2. Quality picker (3 modes) — TEST 480 / STANDARD 720 / FINAL 1080
//   3. Hook variation panel — pick from Phase 2 hookVariants + re-roll
//   4. CTA variation panel — generate + pick from 5 styles
//   5. Thumbnail style picker
//   6. Build Export Package button + package preview
//   7. Download bundle (SRT / TXT / thumbnail / MP4 fallback)
//   8. Project Library — save current + load saved + duplicate + remix
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState, useEffect } from 'react'
import {
  Loader2, Sparkles, AlertCircle, Download, FileText, Image as ImageIcon,
  Save, Library, Copy, Trash2, Star, StarOff, Video, Subtitles,
} from 'lucide-react'
import { useAppStore } from '../../../../stores/appStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useAssetUrl } from '../../../../hooks/useAssetUrl'
import { useAdsVideoStore } from '../stores/adsVideoStore'
import type {
  ExportFormatId, ExportQualityId, SavedProject,
  HookStyle, AiThumbnail,
} from '../types'
import { HOOK_STYLE_LABEL_VI, SCRIPT_LANG_GEMINI_NAME } from '../types'
import { EXPORT_FORMATS } from '../services/exportFormats'
import { EXPORT_QUALITIES } from '../services/exportQuality'
import {
  THUMBNAIL_ARCHETYPES, THUMBNAIL_ARCHETYPE_ORDER,
  generateThumbnailHooks, generateAiThumbnail,
} from '../services/thumbnailEngine'
import {
  buildExportPackage, downloadSrt, downloadPlainTextScript, downloadAssetAs,
} from '../services/exportPackageBuilder'
import {
  getAllProjects, saveCurrentAsProject, deleteProject, toggleWinner,
  duplicateProject, hydrateProjectAsState,
} from '../services/projectLibrary'
// Z36 Phase 7 — real MP4 assembly
import {
  assembleFinalVideo, estimateExportSize, preflightCheckAssets,
} from '../services/finalVideoAssembler'
import { warmUpFFmpeg, isFFmpegLoaded } from '../services/ffmpegLoader'
import { EXPORT_RENDER_STAGE_LABEL_VI } from '../types'

export default function ExportPhase() {
  const state = useAdsVideoStore((s) => s.state)
  const pickHookForExport = useAdsVideoStore((s) => s.pickHookForExport)
  const setExportPackage  = useAdsVideoStore((s) => s.setExportPackage)
  // Z89 — AI thumbnail actions
  const setAiThumbnails   = useAdsVideoStore((s) => s.setAiThumbnails)
  const patchAiThumbnail  = useAdsVideoStore((s) => s.patchAiThumbnail)
  const pickThumbnail     = useAdsVideoStore((s) => s.pickThumbnail)
  const setIsGeneratingThumbnails = useAdsVideoStore((s) => s.setIsGeneratingThumbnails)
  const setIsBuildingPackage = useAdsVideoStore((s) => s.setIsBuildingPackage)
  const setExportError    = useAdsVideoStore((s) => s.setExportError)
  const hydrateFromSnapshot = useAdsVideoStore((s) => s.hydrateFromSnapshot)
  // Z36 Phase 7 store hooks
  const setExportStage       = useAdsVideoStore((s) => s.setExportStage)
  const setExportProgress    = useAdsVideoStore((s) => s.setExportProgress)
  const setExportPreset      = useAdsVideoStore((s) => s.setExportPreset)
  const setAssembledVideoRef = useAdsVideoStore((s) => s.setAssembledVideoRef)
  const setFailedClipIds     = useAdsVideoStore((s) => s.setFailedClipIds)

  const geminiKey = useSettingsStore((s) => s.geminiApiKey)
  const kieApiKey = useSettingsStore((s) => s.kieApiKey)
  const addToast = useAppStore((s) => s.addToast)

  const ev = state.exportVariation
  const plan = state.autoEdit.plan

  const [libraryOpen, setLibraryOpen] = useState(false)
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([])

  useEffect(() => {
    if (libraryOpen) setSavedProjects(getAllProjects())
  }, [libraryOpen])

  // Z36 — eager warm-up of ffmpeg.wasm so it's cached by the time the
  // user clicks Preview Export. Runs once when ExportPhase mounts.
  useEffect(() => {
    if (!isFFmpegLoaded()) warmUpFFmpeg()
  }, [])

  // ── Pre-flight ──────────────────────────────────────────────────────────
  const canBuildPackage = !!plan && !!state.scriptBrain.script
  const hasHooks = state.scriptBrain.hookVariants.length > 0

  // Effective hook + CTA text (preview the active picks)
  const effectiveHookText = useMemo(() => {
    if (ev.pickedHookIdxForExport >= 0 && state.scriptBrain.hookVariants[ev.pickedHookIdxForExport]) {
      return state.scriptBrain.hookVariants[ev.pickedHookIdxForExport].text
    }
    return state.scriptBrain.script?.blocks.find((b) => b.id === 'hook')?.text ?? ''
  }, [ev.pickedHookIdxForExport, state.scriptBrain.hookVariants, state.scriptBrain.script])

  const effectiveCtaText = useMemo(() => {
    if (ev.pickedCtaIdx >= 0 && ev.ctaVariations[ev.pickedCtaIdx]) {
      return ev.ctaVariations[ev.pickedCtaIdx].text
    }
    return state.scriptBrain.script?.blocks.find((b) => b.id === 'cta')?.text ?? ''
  }, [ev.pickedCtaIdx, ev.ctaVariations, state.scriptBrain.script])

  // ── Handlers ────────────────────────────────────────────────────────────

  // Z89 — generate 4 AI thumbnail archetypes (Director writes 4 curiosity hooks,
  // GPT-4o renders each archetype with avatar + product). Each card updates as
  // it finishes; failures are marked per-card and don't block the others.
  const handleGenerateThumbnails = async () => {
    if (!kieApiKey) { addToast('Thiếu KIE API key trong Settings', 'error'); return }
    if (!state.scriptBrain.script) { addToast('Chưa có script (bước 2)', 'error'); return }
    setIsGeneratingThumbnails(true)
    setExportError(null)
    try {
      const lang = state.scriptBrain.outputLang
      const langName = SCRIPT_LANG_GEMINI_NAME[lang]
      const hooks = await generateThumbnailHooks({
        geminiKey, script: state.scriptBrain.script, product: state.inputs.product, lang,
      })
      const seeds: AiThumbnail[] = THUMBNAIL_ARCHETYPE_ORDER.map((id, i) => ({
        archetypeId: id, hook: hooks[i] ?? '', imageRef: null,
        status: 'rendering', generatedAt: Date.now(),
      }))
      setAiThumbnails(seeds)
      await Promise.all(THUMBNAIL_ARCHETYPE_ORDER.map(async (id, i) => {
        try {
          const imageRef = await generateAiThumbnail({
            kieApiKey, archetypeId: id, hook: hooks[i] ?? '', langName,
            avatar: state.inputs.avatar, product: state.inputs.product,
          })
          patchAiThumbnail(i, { imageRef, status: 'completed' })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          patchAiThumbnail(i, { status: 'failed', error: msg.slice(0, 160) })
        }
      }))
      addToast('✓ Đã tạo thumbnail — chọn 1 cái', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setExportError(msg.slice(0, 240))
      addToast(`Tạo thumbnail lỗi: ${msg}`, 'error')
    } finally {
      setIsGeneratingThumbnails(false)
    }
  }

  const handleBuildPackage = async () => {
    if (!canBuildPackage || !plan || !state.scriptBrain.script) return
    setIsBuildingPackage(true)
    setExportError(null)
    try {
      const pkg = await buildExportPackage({
        formatId: ev.formatId,
        qualityId: ev.qualityId,
        plan,
        script: state.scriptBrain.script,
        hookVariants: state.scriptBrain.hookVariants,
        pickedHookIdx: ev.pickedHookIdxForExport,
        ctaVariations: ev.ctaVariations,
        pickedCtaIdx: ev.pickedCtaIdx,
        thumbnailSourceRef: state.creatorVideo?.keyframeRef ?? null,
        thumbnailStyleId: ev.thumbnailStyleId,
        pickedThumbnailRef: ev.pickedThumbnailRef,  // Z89 — AI thumbnail if picked
        creatorVideoRef: state.creatorVideo?.videoRef ?? null,
      })
      setExportPackage(pkg)
      addToast('✓ Export package sẵn sàng — bấm Download', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setExportError(msg.slice(0, 240))
      addToast(`Build package lỗi: ${msg}`, 'error')
    } finally {
      setIsBuildingPackage(false)
    }
  }

  const handleSaveCurrent = () => {
    const saved = saveCurrentAsProject(state)
    addToast(`✓ Đã lưu "${saved.name}"`, 'success')
    setSavedProjects(getAllProjects())
  }

  // Z36 Phase 7 — REAL MP4 assembly via ffmpeg.wasm
  const handleAssembleFinalVideo = async (preset: 'preview' | 'final') => {
    if (!plan) return
    setExportPreset(preset)
    setExportProgress(0)
    setFailedClipIds([])
    setExportError(null)

    // Preflight — surface missing assets early
    try {
      const preflight = await preflightCheckAssets(plan)
      if (preflight.resolvedSegments === 0) {
        addToast('Không có segment nào resolve được — không có clip để assemble', 'error')
        setExportStage('failed')
        return
      }
      if (preflight.missingClipIds.length > 0) {
        addToast(`⚠ ${preflight.missingClipIds.length} insert thiếu — sẽ skip`, 'info')
      }
    } catch (err) {
      console.warn('[EXPORT] preflight failed', err)
    }

    try {
      const result = await assembleFinalVideo({
        plan,
        formatId: ev.formatId,
        qualityId: ev.qualityId,
        preset,
        voiceRef: state.creatorVideo?.voiceRef ?? null,
        onStage: (stage) => setExportStage(stage),
        onProgress: (ratio) => setExportProgress(ratio),
      })
      setAssembledVideoRef(result.videoRef)
      setFailedClipIds(result.failedClipIds)
      setExportStage('done')
      setExportProgress(1)
      addToast(
        `✓ MP4 ${preset} export xong (${(result.encodeMs / 1000).toFixed(1)}s` +
        `${result.failedClipIds.length > 0 ? `, ${result.failedClipIds.length} clip skipped` : ''})`,
        'success',
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setExportError(msg.slice(0, 240))
      setExportStage('failed')
      setExportProgress(0)
      addToast(`Assemble lỗi: ${msg}`, 'error')
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (!canBuildPackage) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <Download className="h-10 w-10 text-gray-300" />
        <h3 className="text-lg font-bold text-gray-900">Chưa đủ data để export</h3>
        <ul className="text-[12px] text-gray-500">
          {!plan && <li>• Cần auto-edit plan (bước 7)</li>}
          {!state.scriptBrain.script && <li>• Cần script (bước 2)</li>}
        </ul>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Bước 5 — Export + Variations</h2>
            <p className="text-[12px] text-gray-500">
              Build export bundle (SRT + script + thumbnail + MP4 fallback). Generate hook/CTA variations
              cho ad testing. Save winning projects vào library.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setLibraryOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-[12px] font-semibold text-violet-700 hover:bg-violet-100"
            >
              <Library className="h-3.5 w-3.5" /> Library ({savedProjects.length || getAllProjects().length})
            </button>
            <button
              onClick={handleSaveCurrent}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5 text-[12px] font-bold text-white hover:from-emerald-600 hover:to-teal-600"
            >
              <Save className="h-3.5 w-3.5" /> Save current
            </button>
          </div>
        </div>

        {/* ── Z85 — format + quality auto-decided (TikTok 9:16 · FINAL 1080).
            The Director ships the standard ad spec; user no longer picks. ── */}
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-[12px] text-violet-900">
          <Video className="h-4 w-4 shrink-0 text-violet-600" />
          <span>
            Xuất chuẩn: <b>{EXPORT_FORMATS[ev.formatId].labelVi} · {EXPORT_QUALITIES[ev.qualityId].labelVi}</b> (đạo diễn tự chọn — định dạng phổ biến nhất cho quảng cáo).
          </span>
        </div>

        {/* ── Hook variation panel ──────────────────────────────────────── */}
        {hasHooks && (
          <div className="mb-4 rounded-xl border border-black/10 bg-white p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Hook variations ({state.scriptBrain.hookVariants.length}) — Phase 2 đã tạo
            </p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {state.scriptBrain.hookVariants.map((hv, i) => {
                const isActive = ev.pickedHookIdxForExport === i
                return (
                  <button
                    key={i}
                    onClick={() => pickHookForExport(i)}
                    className={`rounded-xl border p-2.5 text-left text-[11px] transition-all ${
                      isActive ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200' : 'border-gray-200 bg-white hover:bg-violet-50/40'
                    }`}
                  >
                    <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-700">
                      {HOOK_STYLE_LABEL_VI[hv.style as HookStyle]}
                    </span>
                    <p className="mt-1 leading-snug text-gray-800">{hv.text}</p>
                    <p className="mt-1 text-[9px] text-gray-400">~{hv.estDurationSec.toFixed(1)}s</p>
                  </button>
                )
              })}
              <button
                onClick={() => pickHookForExport(-1)}
                className={`rounded-xl border p-2.5 text-left text-[11px] transition-all ${
                  ev.pickedHookIdxForExport === -1 ? 'border-gray-400 bg-gray-100 ring-2 ring-gray-300' : 'border-dashed border-gray-200 bg-white text-gray-500'
                }`}
              >
                <span className="font-bold">↺ Dùng hook gốc</span>
                <p className="mt-1 text-gray-500">Không override — dùng HOOK block trong script.</p>
              </button>
            </div>
          </div>
        )}

        {/* Z89 — CTA variations panel removed (Gemini JSON kept erroring + the
            ad uses the script's own CTA). The package still passes ctaVariations
            (empty) → falls back to the script CTA block. */}

        {/* ── Z89 — AI thumbnail (4 archetypes) ──────────────────────────── */}
        <div className="mb-4 rounded-xl border border-black/10 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <ImageIcon className="mr-1 inline h-3.5 w-3.5" /> Thumbnail (AI · 4 kiểu)
            </p>
            <button
              onClick={handleGenerateThumbnails}
              disabled={ev.isGeneratingThumbnails}
              className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all hover:from-violet-700 hover:to-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {ev.isGeneratingThumbnails
                ? <><Loader2 className="h-3 w-3 animate-spin" /> Đang tạo 4 thumbnail...</>
                : <><Sparkles className="h-3 w-3" /> {ev.aiThumbnails.length ? 'Tạo lại 4 thumbnail' : 'Tạo 4 thumbnail'} (~32cr)</>}
            </button>
          </div>
          {ev.aiThumbnails.length === 0 ? (
            <p className="text-[11px] text-gray-400">
              AI viết 4 hook tò mò + dựng 4 kiểu thumbnail (mặt phản ứng / before-after / sản phẩm + ưu đãi / câu hỏi) kèm avatar + sản phẩm. Chọn 1 cái cho ad.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {ev.aiThumbnails.map((t, i) => (
                <AiThumbCard
                  key={i}
                  thumb={t}
                  picked={!!t.imageRef && ev.pickedThumbnailRef === t.imageRef}
                  onPick={() => t.imageRef && pickThumbnail(t.imageRef)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Build button + error ──────────────────────────────────────── */}
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 p-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">
              {ev.lastPackage ? 'Package đã build — bấm Build lại nếu đổi format/quality' : 'Build export package'}
            </p>
            <p className="text-[11px] text-gray-500">
              {EXPORT_FORMATS[ev.formatId].labelVi} · {EXPORT_QUALITIES[ev.qualityId].labelVi} ·
              Hook: <strong>{effectiveHookText.slice(0, 30)}...</strong>
            </p>
          </div>
          <button
            onClick={handleBuildPackage}
            disabled={ev.isBuildingPackage}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:from-violet-700 hover:to-pink-700 disabled:opacity-50"
          >
            {ev.isBuildingPackage
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang build...</>
              : <><Sparkles className="h-4 w-4" /> Build package</>}
          </button>
        </div>

        {ev.error && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div><strong>Lỗi:</strong> {ev.error}</div>
          </div>
        )}

        {/* ── Package preview + downloads ───────────────────────────────── */}
        {ev.lastPackage && (
          <PackageDownloadPanel
            pkg={ev.lastPackage}
            hookText={effectiveHookText}
            ctaText={effectiveCtaText}
          />
        )}

        {/* ── Z36 Phase 7 — REAL MP4 ASSEMBLY ───────────────────────────── */}
        <RealMp4AssemblyPanel
          plan={plan!}
          formatId={ev.formatId}
          qualityId={ev.qualityId}
          stage={ev.exportStage}
          progress={ev.exportProgress}
          preset={ev.exportPreset}
          assembledVideoRef={ev.assembledVideoRef}
          failedClipIds={ev.failedClipIds}
          onAssemble={handleAssembleFinalVideo}
        />

        {/* ── Library modal ─────────────────────────────────────────────── */}
        {libraryOpen && (
          <LibraryModal
            projects={savedProjects}
            onClose={() => setLibraryOpen(false)}
            onLoad={(p) => {
              hydrateFromSnapshot(hydrateProjectAsState(p))
              addToast(`✓ Loaded "${p.name}"`, 'success')
              setLibraryOpen(false)
            }}
            onDuplicate={(p) => {
              const dup = duplicateProject(p.id, { resetCreatorVideo: true, resetAutoEdit: true })
              if (dup) {
                addToast(`✓ Duplicated "${p.name}" → reset creator + auto-edit`, 'success')
                setSavedProjects(getAllProjects())
              }
            }}
            onDelete={(p) => {
              deleteProject(p.id)
              addToast(`Đã xoá "${p.name}"`, 'info')
              setSavedProjects(getAllProjects())
            }}
            onToggleWinner={(p) => {
              toggleWinner(p.id)
              setSavedProjects(getAllProjects())
            }}
          />
        )}
      </div>
    </div>
  )
}

// ── Package download panel ────────────────────────────────────────────────

function PackageDownloadPanel({
  pkg, hookText, ctaText,
}: {
  pkg: import('../types').ExportPackage
  hookText: string
  ctaText: string
}) {
  const thumbUrl = useAssetUrl(pkg.thumbnail?.imageRef ?? undefined)
  const videoUrl = useAssetUrl(pkg.videoRef ?? undefined)

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
        Export package ({EXPORT_FORMATS[pkg.formatId].labelVi} · {EXPORT_QUALITIES[pkg.qualityId].labelVi})
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <button
            onClick={() => downloadSrt(pkg, `${EXPORT_FORMATS[pkg.formatId].labelVi.toLowerCase()}-subtitles.srt`)}
            className="flex w-full items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            <Subtitles className="h-4 w-4" /> Download SRT (subtitles)
            <span className="ml-auto text-[10px] opacity-70">{pkg.srtContent.length} chars</span>
          </button>
          <button
            onClick={() => downloadPlainTextScript(pkg, `${EXPORT_FORMATS[pkg.formatId].labelVi.toLowerCase()}-script.txt`)}
            className="flex w-full items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            <FileText className="h-4 w-4" /> Download script.txt
          </button>
          {pkg.thumbnail?.imageRef && thumbUrl && (
            <button
              onClick={() => downloadAssetAs(thumbUrl, `thumbnail-${pkg.thumbnail!.styleId}.png`)}
              className="flex w-full items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <ImageIcon className="h-4 w-4" /> Download thumbnail PNG
            </button>
          )}
          {pkg.videoRef && videoUrl && (
            <button
              onClick={() => downloadAssetAs(videoUrl, `ad-${EXPORT_FORMATS[pkg.formatId].labelVi}.mp4`)}
              className="flex w-full items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2 text-[12px] font-bold text-white hover:from-emerald-700 hover:to-teal-700"
            >
              <Video className="h-4 w-4" /> Download MP4 (creator fallback)
            </button>
          )}
          {!pkg.videoRef && (
            <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-2 text-[10px] text-amber-800">
              ⚠ MP4 final encode chưa wire — Phase 7 sẽ thêm ffmpeg.wasm.
              Hiện tại có thể download creator video trực tiếp (chưa có inserts overlay).
            </p>
          )}
        </div>

        {pkg.thumbnail?.imageRef && thumbUrl && (
          <div className="overflow-hidden rounded-lg border border-emerald-300 bg-white">
            <img src={thumbUrl} alt="Thumbnail" className="aspect-[9/16] w-full object-cover" />
            <p className="border-t border-emerald-200 p-1.5 text-center text-[10px] text-emerald-700">
              Thumbnail · {pkg.thumbnail.styleId}
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-1 rounded-lg border border-emerald-200 bg-white p-2 text-[11px]">
        <p><strong>HOOK:</strong> "{hookText.slice(0, 100)}{hookText.length > 100 ? '...' : ''}"</p>
        <p><strong>CTA:</strong> "{ctaText.slice(0, 100)}{ctaText.length > 100 ? '...' : ''}"</p>
        <p className="text-[10px] text-emerald-700">Duration: {pkg.durationSec.toFixed(1)}s</p>
      </div>
    </div>
  )
}

// ── Library modal ─────────────────────────────────────────────────────────

function LibraryModal({
  projects, onClose, onLoad, onDuplicate, onDelete, onToggleWinner,
}: {
  projects: SavedProject[]
  onClose: () => void
  onLoad: (p: SavedProject) => void
  onDuplicate: (p: SavedProject) => void
  onDelete: (p: SavedProject) => void
  onToggleWinner: (p: SavedProject) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">
            <Library className="mr-1 inline h-4 w-4" /> Project Library ({projects.length})
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {projects.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-[12px] text-gray-500">
            Chưa lưu project nào. Bấm <strong>Save current</strong> để bắt đầu library.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {projects.map((p) => (
              <div
                key={p.id}
                className={`flex items-start gap-2 rounded-lg border p-2.5 ${
                  p.isWinner ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'
                }`}
              >
                <button
                  onClick={() => onToggleWinner(p)}
                  className={`text-lg ${p.isWinner ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}`}
                  title={p.isWinner ? 'Bỏ winner' : 'Đánh dấu winner'}
                >
                  {p.isWinner ? <Star className="h-4 w-4 fill-amber-500" /> : <StarOff className="h-4 w-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[13px] font-bold text-gray-900">{p.name}</p>
                  <p className="text-[10px] text-gray-500">
                    {p.productName} · {p.avatarName} · {new Date(p.lastEditedAt).toLocaleDateString('vi-VN')}
                  </p>
                  {p.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.tags.map((t) => <span key={t} className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] text-violet-700">{t}</span>)}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => onLoad(p)}
                    className="rounded-md border border-violet-300 bg-white px-2 py-1 text-[10px] font-semibold text-violet-700 hover:bg-violet-50"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => onDuplicate(p)}
                    className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50"
                    title="Duplicate + reset creator video + auto-edit (giữ script + inserts)"
                  >
                    <Copy className="inline h-3 w-3" />
                  </button>
                  <button
                    onClick={() => onDelete(p)}
                    className="rounded-md border border-red-200 bg-white px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 rounded-lg border border-violet-200 bg-violet-50 p-2 text-[10px] text-violet-700">
          <strong>Z35 §9 Fast Duplicate:</strong> Duplicate giữ <strong>script + inserts</strong> nguyên,
          chỉ reset <strong>creator video + auto-edit</strong> — cho test creator energy / setting khác mà
          không cần re-generate script. Tiết kiệm credit Gemini.
        </p>
      </div>
    </div>
  )
}

// ── Z36 Phase 7 — Real MP4 Assembly Panel ────────────────────────────────

function RealMp4AssemblyPanel({
  plan, formatId, qualityId, stage, progress, preset,
  assembledVideoRef, failedClipIds, onAssemble,
}: {
  plan: import('../types').AutoEditPlan
  formatId: ExportFormatId
  qualityId: ExportQualityId
  stage: import('../types').ExportRenderStage
  progress: number
  preset: 'preview' | 'final'
  assembledVideoRef: string | null
  failedClipIds: number[]
  onAssemble: (preset: 'preview' | 'final') => void
}) {
  const isBusy = stage !== 'idle' && stage !== 'done' && stage !== 'failed'
  const isDone = stage === 'done' && !!assembledVideoRef
  const isFailed = stage === 'failed'

  const previewSize = estimateExportSize(plan, 'test_480')
  const finalSize = estimateExportSize(plan, qualityId)

  const resolvedAssembled = useAssetUrl(assembledVideoRef ?? undefined)
  const assembledUrl = assembledVideoRef?.startsWith('http')
    ? assembledVideoRef
    : resolvedAssembled

  return (
    <div className="mt-4 rounded-xl border border-pink-300 bg-gradient-to-r from-pink-50 via-rose-50 to-violet-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">
            🎬 Real MP4 Assembly <span className="rounded-full bg-pink-100 px-1.5 py-0.5 text-[9px] font-bold text-pink-700">PHASE 7</span>
          </p>
          <p className="mt-0.5 text-[11px] text-gray-600">
            Encode MP4 thật từ edit plan via <strong>ffmpeg.wasm</strong> — local browser, không tốn server.
            Subtitle burn-in + segment concat + audio mux. Re-run cùng plan miễn phí.
          </p>
        </div>
      </div>

      {/* Action buttons + status */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => onAssemble('preview')}
          disabled={isBusy}
          title={`Fast preview — 480p · ~${previewSize.mb}MB`}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-[12px] font-bold text-white shadow-sm hover:from-amber-600 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBusy && preset === 'preview'
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Encoding...</>
            : <><Sparkles className="h-3.5 w-3.5" /> Preview Export (480p · ~{previewSize.mb}MB)</>}
        </button>
        <button
          onClick={() => onAssemble('final')}
          disabled={isBusy}
          title={`Final quality — ${EXPORT_QUALITIES[qualityId].resolutionPx}p · ~${finalSize.mb}MB`}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-2 text-[12px] font-bold text-white shadow-md hover:from-violet-700 hover:to-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBusy && preset === 'final'
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Encoding...</>
            : <><Video className="h-3.5 w-3.5" /> Final Export ({EXPORT_QUALITIES[qualityId].labelVi} · ~{finalSize.mb}MB)</>}
        </button>
        <span className="text-[10px] text-gray-500">
          {plan.segments.length} segments · {plan.captions.length} captions · {EXPORT_FORMATS[formatId].labelVi}
        </span>
      </div>

      {/* Stage progress */}
      {isBusy && (
        <div className="mt-3 rounded-lg border border-pink-200 bg-white p-2.5">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-pink-600" />
            <span>{EXPORT_RENDER_STAGE_LABEL_VI[stage]}</span>
            <span className="ml-auto tabular-nums text-pink-700">{Math.round(progress * 100)}%</span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-pink-100">
            <div
              className="h-full bg-gradient-to-r from-pink-500 to-violet-600 transition-all"
              style={{ width: `${Math.max(2, Math.round(progress * 100))}%` }}
            />
          </div>
        </div>
      )}

      {isFailed && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-[11px] text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Assembly thất bại — xem console / toast để biết chi tiết. ffmpeg.wasm cần Cross-Origin Isolation (CORS) headers ở dev server.</span>
        </div>
      )}

      {failedClipIds.length > 0 && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-800">
          <strong>{failedClipIds.length} clip skipped</strong> (asset fetch failed): cut IDs {failedClipIds.join(', ')}.
          Video vẫn export với các segment còn lại.
        </div>
      )}

      {isDone && assembledUrl && (
        <div className="mt-3 rounded-lg border border-emerald-300 bg-white p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <video
              src={assembledUrl}
              controls
              playsInline
              className="aspect-[9/16] w-full max-w-[200px] rounded-lg bg-black"
            />
            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-bold text-emerald-900">
                ✓ MP4 đã render ({preset} · {plan.totalDurationSec.toFixed(1)}s)
              </p>
              <button
                onClick={() => downloadAssetAs(
                  assembledUrl,
                  `ad-${EXPORT_FORMATS[formatId].labelVi.toLowerCase()}-${preset}.mp4`,
                )}
                className="flex items-center gap-1.5 self-start rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-[12px] font-bold text-white hover:from-emerald-700 hover:to-teal-700"
              >
                <Download className="h-3.5 w-3.5" /> Download MP4
              </button>
              <p className="text-[10px] text-emerald-700">
                Subtitle đã burn-in trực tiếp vào video. Audio = voice + SFX + BGM (mix tự động; SFX/BGM nào chưa có file sẽ tự bỏ qua).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Z89 — AI thumbnail card (one archetype). Uses useAssetUrl for its image. ──
function AiThumbCard({ thumb, picked, onPick }: {
  thumb: AiThumbnail
  picked: boolean
  onPick: () => void
}) {
  const cfg = THUMBNAIL_ARCHETYPES[thumb.archetypeId]
  const url = useAssetUrl(thumb.imageRef ?? undefined)
  return (
    <div className={`overflow-hidden rounded-lg border transition-all ${picked ? 'border-violet-500 ring-2 ring-violet-300' : 'border-gray-200'}`}>
      <button
        onClick={onPick}
        disabled={thumb.status !== 'completed'}
        className="block aspect-[9/16] w-full bg-gray-100"
      >
        {thumb.status === 'rendering' && (
          <span className="flex h-full items-center justify-center text-[10px] text-gray-400">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Đang tạo...
          </span>
        )}
        {thumb.status === 'failed' && (
          <span className="flex h-full items-center justify-center px-1 text-center text-[9px] text-rose-500">
            Lỗi: {thumb.error?.slice(0, 40)}
          </span>
        )}
        {thumb.status === 'completed' && url && (
          <img src={url} alt={cfg.labelVi} className="h-full w-full object-cover" />
        )}
      </button>
      <div className="p-1.5">
        <p className="text-[10px] font-bold text-gray-800">{cfg.emoji} {cfg.labelVi}{picked && ' ✓'}</p>
        <p className="mt-0.5 line-clamp-3 text-[8px] leading-tight text-gray-500">{cfg.popupVi}</p>
        {thumb.hook && <p className="mt-0.5 truncate text-[9px] font-semibold text-violet-700">"{thumb.hook}"</p>}
      </div>
    </div>
  )
}
