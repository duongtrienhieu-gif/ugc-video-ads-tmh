import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import type { Product } from '../../stores/types'
import type { LandingGenParams, LandingPagePack, ImagePrompt } from './types'
import { generateLandingPack } from './services/generateLandingPack'
import { generatePackImages, regenerateSingleImage } from './services/generateImages'
import { useSessionPersist } from '../../services/sessionPersistence'
import AutoSaveIndicator from '../../components/AutoSaveIndicator'
import InputPanel from './components/InputPanel'
import OutputPanel from './components/OutputPanel'
import { useLandingPageStore } from './store'
// Phase 4 — side-effect import: registers full composer registry + DevTools
// test helpers (window.__testShopeeComposer / __testTiktokComposer /
// __testFbComposer / __testNewsComposer / __testPromoComposer /
// __testBeforeAfterComposer / __testInfographicComposer / __testAllComposers).
// Phase 6 will wire these into generateImages.ts behind ENABLE_HYBRID_RENDER.
import './services/composers'

// ── Session-persistence snapshot shape ─────────────────────────────────────
// Phase R3 pilot. Persisted across F5 / refresh / browser-close. Stores only
// lightweight refs (asset URLs / IDs) — actual image blobs live in Supabase
// via utils/assetStore.ts. Generation-in-flight is NOT auto-resumed (KIE
// task IDs aren't currently kept here in R3) — but UI state + outputs are.
interface LandingPageSnapshot {
  selectedProductId: string | null
  pack: LandingPagePack | null
  imageProgress: ImageProgress | null
  lastParams: Omit<LandingGenParams, 'productId'> | null
  /** Canva-style: when set, edits auto-sync back to the saved project with this id. */
  loadedFromId?: string | null
}

/** Z8: extended progress shape — drives the ETA / images-per-minute UI. */
export interface ImageProgress {
  done: number
  failed: number
  total: number
  /** Accumulated retry count across all jobs (informational). */
  retries: number
  /** Epoch ms when the batch started — used for ETA + throughput. */
  startedAt: number
}

export default function LandingPageAI() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [pack, setPack] = useState<LandingPagePack | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingImages, setIsGeneratingImages] = useState(false)
  const [imageProgress, setImageProgress] = useState<ImageProgress | null>(null)
  /** When non-null, edits to `pack` auto-sync back to the project with this id. */
  const [loadedFromId, setLoadedFromId] = useState<string | null>(null)

  // Remember last params so "Tạo lại" reuses language / niche / visualMemory.
  const lastParamsRef = useRef<Omit<LandingGenParams, 'productId'> | null>(null)

  const interAppPayload = useAppStore((s) => s.interAppPayload)
  const consumePayload  = useAppStore((s) => s.consumePayload)
  const activeApp       = useAppStore((s) => s.activeApp)
  const addToast        = useAppStore((s) => s.addToast)
  const getProductById  = useBankStore((s) => s.getProductById)
  const lpGetById      = useLandingPageStore((s) => s.getById)
  const lpAdd          = useLandingPageStore((s) => s.add)
  const lpUpdate       = useLandingPageStore((s) => s.update)
  const lpItems        = useLandingPageStore((s) => s.items)
  const lpSyncFromCloud = useLandingPageStore((s) => s.syncFromCloud)
  const loadedProject  = loadedFromId ? lpItems.find((x) => x.id === loadedFromId) : null

  // ── H2: pull projects from Supabase on mount (idempotent + safe) ────
  // Runs once per app load. If Supabase table missing / offline / not
  // logged in, the call is a no-op — localStorage stays the source of truth.
  const cloudSyncedRef = useRef(false)
  useEffect(() => {
    if (cloudSyncedRef.current) return
    cloudSyncedRef.current = true
    void lpSyncFromCloud()
  }, [lpSyncFromCloud])

  // ── Load a saved project into the active editor (Canva-style "open") ──
  const handleLoadProject = useCallback((id: string) => {
    const saved = lpGetById(id)
    if (!saved) {
      addToast('Không tìm thấy project', 'error')
      return
    }
    setLoadedFromId(saved.id)
    setPack({
      productId:    saved.productId,
      productName:  saved.productName,
      language:     saved.language,
      sections:     saved.sections,
      visualMemory: saved.visualMemory,
      generatedAt:  saved.generatedAt,
    })
    if (saved.productId) {
      const p = getProductById(saved.productId)
      if (p) setSelectedProduct(p)
    }
    setImageProgress(null)
    setIsGenerating(false)
    setIsGeneratingImages(false)
    addToast(`✓ Đã mở "${saved.title}" — chỉnh sửa tự đồng bộ`, 'success')
  }, [lpGetById, getProductById, addToast])

  // ── Session persistence (Phase R3 pilot) ──────────────────────────────
  // Counts how many sections + images are complete — drives the modal preview.
  const computeProgress = () => {
    if (!pack) return undefined
    const totalSections = pack.sections.length
    const totalImages = pack.sections.reduce((sum, s) => sum + s.imagePrompts.length, 0)
    const doneImages = pack.sections.reduce(
      (sum, s) => sum + s.imagePrompts.filter((p) => p.generatedAssetRef).length,
      0,
    )
    if (totalImages === 0) {
      return `${totalSections} section · chưa render ảnh`
    }
    return `${totalSections} section · ${doneImages}/${totalImages} ảnh đã render`
  }

  const sessionApi = useSessionPersist<LandingPageSnapshot>({
    moduleId: 'landing-page',
    moduleNameVi: 'LandingPage AI',
    version: 1,
    snapshot: () => ({
      selectedProductId: selectedProduct?.id ?? null,
      pack,
      imageProgress,
      lastParams: lastParamsRef.current,
      loadedFromId,
    }),
    hydrate: (data) => {
      if (data.selectedProductId) {
        const p = getProductById(data.selectedProductId)
        if (p) setSelectedProduct(p)
      }
      if (data.pack) setPack(data.pack)
      if (data.imageProgress) setImageProgress(data.imageProgress)
      if (data.lastParams) lastParamsRef.current = data.lastParams
      if (data.loadedFromId) setLoadedFromId(data.loadedFromId)
      addToast('✓ Đã khôi phục LandingPage AI từ phiên trước', 'success')
    },
    getStatus: () => {
      if (isGenerating || isGeneratingImages) return 'in-progress'
      if (pack) return 'paused'
      return 'completed'
    },
    getProgressVi: computeProgress,
    getTitleVi: () => pack?.productName ?? selectedProduct?.productName,
    // Only persist when there's actual work (avatar pack exists or gen in flight)
    shouldPersist: () => !!pack || isGenerating || isGeneratingImages,
    // Re-save when any of these change
    deps: [selectedProduct?.id, pack, isGenerating, isGeneratingImages, imageProgress, loadedFromId],
  })

  // ── Auto-sync edits to the saved project (Canva-style live save) ─────
  // Debounced 1.5s — every change to `pack` while a project is loaded
  // gets pushed back to the store. No "Lưu" button needed during editing.
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!loadedFromId || !pack) return
    if (isGenerating) return  // never overwrite during fresh generation
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      lpUpdate(loadedFromId, pack)
    }, 1500)
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    }
  }, [pack, loadedFromId, isGenerating, lpUpdate])

  // ── Accept "open project" payload from sidebar / finder ───────────────
  useEffect(() => {
    if (activeApp !== 'landing-page') return
    if (!interAppPayload || interAppPayload.targetApp !== 'landing-page') return
    if (interAppPayload.targetField === 'landingProjectId' && typeof interAppPayload.data === 'string') {
      handleLoadProject(interAppPayload.data)
      consumePayload()
    }
  }, [interAppPayload, activeApp, consumePayload, handleLoadProject])

  // ── "Lưu thành project" / "Đã lưu" handler — promotes session to a saved project ──
  const handleSaveAsProject = (title?: string) => {
    if (!pack) return
    if (loadedFromId) {
      // Already a saved project — force-sync immediately
      lpUpdate(loadedFromId, pack)
      addToast('✓ Đã lưu thay đổi vào project')
      return
    }
    const saved = lpAdd(pack, title)
    setLoadedFromId(saved.id)
    addToast(`✓ Đã tạo project "${saved.title}" — chỉnh sửa tự đồng bộ`)
  }

  // ── Start a fresh session (drop loaded project link) ──────────────────
  const handleNewProject = () => {
    setLoadedFromId(null)
    setPack(null)
    setImageProgress(null)
    lastParamsRef.current = null
    addToast('Đã thoát project — tạo mới')
  }

  useEffect(() => {
    if (activeApp !== 'landing-page') return
    if (!interAppPayload || interAppPayload.targetApp !== 'landing-page') return
    if (interAppPayload.targetField === 'productId') {
      const product = getProductById(interAppPayload.data as string)
      if (product) setSelectedProduct(product)
      consumePayload()
    }
    // landingProjectId handled in a separate effect (after handleLoadProject is defined)
  }, [interAppPayload, activeApp, consumePayload, getProductById])

  // ── Pack generation (Phase A — text only) ───────────────────────────
  const runGeneration = async (params: Omit<LandingGenParams, 'productId'>) => {
    if (!selectedProduct) return
    lastParamsRef.current = params
    // Fresh generation breaks the "loaded project" link — user starts over.
    if (loadedFromId) setLoadedFromId(null)
    setIsGenerating(true)
    setPack(null)
    setImageProgress(null)
    try {
      // Fallback: if user uploaded no visual memory, use the product's main
      // image as a single ref so product-focused sections still have something
      // to lock identity against.
      const visualMemory = (params.visualMemory && params.visualMemory.length > 0)
        ? params.visualMemory
        : selectedProduct.productImage
          ? [{ ref: selectedProduct.productImage, label: 'sản phẩm chính' }]
          : []

      const p = await generateLandingPack({
        ...params,
        productId: selectedProduct.id,
        visualMemory,
      })
      setPack(p)
      // Force-save right after pack lands — don't wait for debounce
      sessionApi.forceSave()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Tạo landing pack thất bại: ${msg}`, 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRegenerate = () => {
    if (!lastParamsRef.current) return
    void runGeneration(lastParamsRef.current)
  }

  // ── Per-image patch — used by queue workers + single regen ──────────
  // Each successful image patch triggers the debounced auto-save (via deps).
  const patchImagePrompt = (sectionIdx: number, imageIdx: number, patch: Partial<ImagePrompt>) => {
    setPack((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        sections: prev.sections.map((s, si) =>
          si !== sectionIdx ? s : {
            ...s,
            imagePrompts: s.imagePrompts.map((p, ii) => ii === imageIdx ? { ...p, ...patch } : p),
          },
        ),
      }
    })
  }

  // ── Phase B — batch image generation (Z8 perf upgrade) ──────────────
  const handleGenerateAllImages = async () => {
    if (!pack) return
    setIsGeneratingImages(true)
    const startedAt = Date.now()
    setImageProgress({ done: 0, failed: 0, total: 0, retries: 0, startedAt })
    try {
      await generatePackImages(pack, {
        concurrency: 6, // Z8: 3 → 6 (3x throughput, priority queue gates hero first)
        onTaskUpdate: patchImagePrompt,
        onProgress: (done, failed, total, retries) =>
          setImageProgress({ done, failed, total, retries, startedAt }),
      })
      addToast('✓ Đã sinh xong toàn bộ ảnh landing pack')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Sinh ảnh lỗi: ${msg}`, 'error')
    } finally {
      setIsGeneratingImages(false)
      // Final save once batch completes
      sessionApi.forceSave()
    }
  }

  // ── Per-image regen — fired by click ✨ / 🔄 / Thử lại on a single card ─
  const handleRegenerateOneImage = async (sectionIdx: number, imageIdx: number) => {
    if (!pack) return
    try {
      await regenerateSingleImage(pack, sectionIdx, imageIdx, patchImagePrompt)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Sinh ảnh lỗi: ${msg}`, 'error')
    }
  }

  // ── Per-image delete — clears generatedAssetRef + resets status to idle ─
  const handleDeleteOneImage = (sectionIdx: number, imageIdx: number) => {
    if (!pack) return
    patchImagePrompt(sectionIdx, imageIdx, {
      status: 'idle',
      generatedAssetRef: undefined,
      error: undefined,
    })
  }

  // ── Batch helpers: only failed / only remaining ─────────────────────
  // Both reuse regenerateSingleImage in sequence (not the worker pool) so
  // each card's loading state animates individually — matches per-card UX.
  const runImageSubset = async (predicate: (p: ImagePrompt) => boolean) => {
    if (!pack) return
    setIsGeneratingImages(true)
    const targets: Array<[number, number]> = []
    pack.sections.forEach((s, si) => {
      s.imagePrompts?.forEach((p, ii) => {
        if (predicate(p)) targets.push([si, ii])
      })
    })
    if (targets.length === 0) {
      setIsGeneratingImages(false)
      return
    }
    const startedAt = Date.now()
    setImageProgress({ done: 0, failed: 0, total: targets.length, retries: 0, startedAt })
    let done = 0
    let failed = 0
    // Z8: 3 → 6 parallel (matches batch worker pool)
    const CONCURRENCY = 6
    let cursor = 0
    await new Promise<void>((resolve) => {
      let active = 0
      const pump = () => {
        while (active < CONCURRENCY && cursor < targets.length) {
          const [si, ii] = targets[cursor++]
          active++
          regenerateSingleImage(pack, si, ii, patchImagePrompt)
            .then(() => { done++ })
            .catch(() => { failed++ })
            .finally(() => {
              active--
              setImageProgress({ done, failed, total: targets.length, retries: 0, startedAt })
              if (cursor >= targets.length && active === 0) resolve()
              else pump()
            })
        }
      }
      pump()
    })
    setIsGeneratingImages(false)
    addToast(`✓ Hoàn tất: ${done} ảnh OK${failed > 0 ? ` · ${failed} lỗi` : ''}`)
    sessionApi.forceSave()
  }

  const handleRetryFailedImages = () => runImageSubset((p) => p.status === 'failed')
  const handleGenerateRemaining  = () => runImageSubset((p) => p.status !== 'done' && p.status !== 'generating' && p.status !== 'queued')

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <div className="flex w-full lg:w-[360px] shrink-0 flex-col border-b lg:border-b-0 lg:border-r border-black/8">
        <InputPanel
          selectedProduct={selectedProduct}
          onProductSelect={setSelectedProduct}
          onGenerate={runGeneration}
          isGenerating={isGenerating}
        />
      </div>

      <div className="flex w-full flex-1 flex-col min-h-[400px] lg:min-h-0">
        {/* Floating auto-save indicator — Canva-style */}
        <div className="absolute right-4 top-14 z-30">
          <AutoSaveIndicator
            lastSavedAt={sessionApi.lastSavedAt}
            lastSaveOk={sessionApi.lastSaveOk}
          />
        </div>
        <OutputPanel
          pack={pack}
          isGenerating={isGenerating}
          onRegenerate={handleRegenerate}
          onGenerateAllImages={handleGenerateAllImages}
          onGenerateRemaining={handleGenerateRemaining}
          onRetryFailed={handleRetryFailedImages}
          onRegenerateImage={handleRegenerateOneImage}
          onDeleteImage={handleDeleteOneImage}
          imageProgress={imageProgress}
          isGeneratingImages={isGeneratingImages}
          loadedFromId={loadedFromId}
          loadedProjectTitle={loadedProject?.title}
          onLoadProject={handleLoadProject}
          onSaveAsProject={handleSaveAsProject}
          onNewProject={handleNewProject}
        />
      </div>
    </div>
  )
}
