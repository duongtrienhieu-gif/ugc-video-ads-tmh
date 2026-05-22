import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Sliders, X as XIcon } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import type { Product } from '../../stores/types'
import type { LandingGenParams, LandingPagePack, ImagePrompt } from './types'
// generateLandingPack giờ đi qua formDispatcher để route form 'advertorial'
// sang storytelling engine. Drop-in replacement — signature identical,
// behavior cho 4 form UGC khác (ugc-malaysia/premium/hard-sell-cod/chuyen-gia)
// hoàn toàn unchanged.
import { generateLandingPack } from './formDispatcher'
import { generatePackImages, regenerateSingleImage } from './services/generateImages'
import { useSessionPersist } from '../../services/sessionPersistence'
import AutoSaveIndicator from '../../components/AutoSaveIndicator'
import InputPanel from './components/InputPanel'
import OutputPanel from './components/OutputPanel'
import { useSuperLadipageStore } from './store'

// ── Session-persistence snapshot shape ─────────────────────────────────────
interface SuperLadipageSnapshot {
  selectedProductId: string | null
  pack: LandingPagePack | null
  imageProgress: ImageProgress | null
  lastParams: Omit<LandingGenParams, 'productId'> | null
  loadedFromId?: string | null
}

// ─────────────────────────────────────────────────────────────────────
// Friendly error helper — map raw KIE / Gemini error message thành chuỗi
// tiếng Việt ngắn marketer hiểu được. Raw error vẫn còn ở console.error.
// ─────────────────────────────────────────────────────────────────────
export function friendlyError(raw: string): string {
  if (!raw) return 'Lỗi không xác định — bấm Thử lại'
  const m = raw.toLowerCase()
  if (m.includes('timeout') || m.includes('quá') && (m.includes('90s') || m.includes('150s') || m.includes('180s'))) {
    return '⏱️ Ảnh tạo lâu hơn dự kiến — bấm Thử lại'
  }
  if (m.includes('insufficient_credits') || m.includes('thiếu credit') || m.includes('hết credit')) {
    return '💳 Hết credit KIE — nạp thêm rồi Thử lại'
  }
  if (m.includes('content_policy')) {
    return '🚫 KIE từ chối prompt — sửa nội dung section rồi Thử lại'
  }
  if (m.includes('generate_failed') || m.includes('failed')) {
    return '⚠️ KIE từ chối render — bấm Thử lại'
  }
  if (m.includes('huỷ') || m.includes('cancel')) {
    return '⏹️ Đã huỷ'
  }
  if (m.includes('fetch') || m.includes('network')) {
    return '📡 Mất kết nối tạm thời — bấm Thử lại'
  }
  return raw.length > 80 ? raw.slice(0, 77) + '…' : raw
}

/**
 * Normalize ghost in-flight states khi app mount. Khi user refresh giữa lúc
 * đang generate, imagePrompt persisted có thể giữ status='generating' /
 * 'queued' / 'retrying' không còn đúng. Convert sang 'failed' để UI hiển
 * thị nút Thử lại rõ ràng thay vì spinner vĩnh viễn.
 */
function clearGhostInFlightStates(pack: LandingPagePack): LandingPagePack {
  let mutated = false
  const sections = pack.sections.map((s) => {
    const imagePrompts = s.imagePrompts.map((p) => {
      if (
        (p.status === 'generating' || p.status === 'queued' || p.status === 'retrying') &&
        !p.generatedAssetRef
      ) {
        mutated = true
        return { ...p, status: 'failed' as const, error: 'Bị gián đoạn — bấm Thử lại' }
      }
      return p
    })
    return mutated ? { ...s, imagePrompts } : s
  })
  return mutated ? { ...pack, sections } : pack
}

/** Extended progress shape — drives ETA / images-per-minute UI. */
export interface ImageProgress {
  done: number
  failed: number
  total: number
  retries: number
  startedAt: number
}

export default function SuperLadipage() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [pack, setPack] = useState<LandingPagePack | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingImages, setIsGeneratingImages] = useState(false)
  const [imageProgress, setImageProgress] = useState<ImageProgress | null>(null)
  const [loadedFromId, setLoadedFromId] = useState<string | null>(null)

  const lastParamsRef = useRef<Omit<LandingGenParams, 'productId'> | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const cancelInFlight = useCallback((reason: string) => {
    if (abortRef.current) {
      console.info(`[SuperLadipage] aborting in-flight image batch — ${reason}`)
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])
  useEffect(() => () => { cancelInFlight('component unmount') }, [cancelInFlight])

  // Global semaphore cho individual "Thử lại" clicks. Trước đây mỗi click
  // fire regenerateSingleImage trực tiếp → user spam 10 cards = 10 KIE
  // submits song song = vượt per-account limit → fail 100%. Giờ wrap qua
  // queue: tối đa MAX_INDIVIDUAL_CONCURRENT chạy đồng thời, click thừa
  // vào pendingQueueRef chờ slot. UI hiện chip "Đang tạo: N" tự update
  // vì task được đánh dấu status='queued' ngay khi click.
  const MAX_INDIVIDUAL_CONCURRENT = 4
  const inFlightCountRef = useRef(0)
  const pendingQueueRef  = useRef<Array<() => Promise<void>>>([])
  const enqueueIndividualGen = useCallback(async (task: () => Promise<void>): Promise<void> => {
    if (inFlightCountRef.current < MAX_INDIVIDUAL_CONCURRENT) {
      inFlightCountRef.current++
      try {
        await task()
      } finally {
        inFlightCountRef.current--
        const next = pendingQueueRef.current.shift()
        if (next) {
          // Fire-and-forget — next task tự xử lý try/finally của riêng nó
          enqueueIndividualGen(next).catch(() => { /* error đã handle in task */ })
        }
      }
    } else {
      pendingQueueRef.current.push(task)
    }
  }, [])

  const interAppPayload = useAppStore((s) => s.interAppPayload)
  const consumePayload  = useAppStore((s) => s.consumePayload)
  const activeApp       = useAppStore((s) => s.activeApp)
  const addToast        = useAppStore((s) => s.addToast)
  const getProductById  = useBankStore((s) => s.getProductById)
  const slpGetById      = useSuperLadipageStore((s) => s.getById)
  const slpAdd          = useSuperLadipageStore((s) => s.add)
  const slpUpdate       = useSuperLadipageStore((s) => s.update)
  const slpItems        = useSuperLadipageStore((s) => s.items)
  const loadedProject  = loadedFromId ? slpItems.find((x) => x.id === loadedFromId) : null

  const handleLoadProject = useCallback((id: string) => {
    const saved = slpGetById(id)
    if (!saved) {
      addToast('Không tìm thấy project', 'error')
      return
    }
    setLoadedFromId(saved.id)
    setPack(clearGhostInFlightStates({
      productId:    saved.productId,
      productName:  saved.productName,
      language:     saved.language,
      sections:     saved.sections,
      visualMemory: saved.visualMemory,
      generatedAt:  saved.generatedAt,
    }))
    if (saved.productId) {
      const p = getProductById(saved.productId)
      if (p) setSelectedProduct(p)
    }
    setImageProgress(null)
    setIsGenerating(false)
    setIsGeneratingImages(false)
    addToast(`✓ Đã mở "${saved.title}" — chỉnh sửa tự đồng bộ`, 'success')
  }, [slpGetById, getProductById, addToast])

  const computedProgress = useMemo(() => {
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
  }, [pack])
  const computeProgress = () => computedProgress

  const sessionApi = useSessionPersist<SuperLadipageSnapshot>({
    moduleId: 'super-ladipage',
    moduleNameVi: 'Super Ladipage',
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
      if (data.pack) setPack(clearGhostInFlightStates(data.pack))
      if (data.imageProgress && !(isGenerating || isGeneratingImages)) {
        setImageProgress(null)
      }
      if (data.lastParams) lastParamsRef.current = data.lastParams
      if (data.loadedFromId) setLoadedFromId(data.loadedFromId)
      addToast('✓ Đã khôi phục Super Ladipage từ phiên trước', 'success')
    },
    getStatus: () => {
      if (isGenerating || isGeneratingImages) return 'in-progress'
      if (pack) return 'paused'
      return 'completed'
    },
    getProgressVi: computeProgress,
    getTitleVi: () => pack?.productName ?? selectedProduct?.productName,
    shouldPersist: () => !!pack || isGenerating || isGeneratingImages,
    deps: [selectedProduct?.id, pack, isGenerating, isGeneratingImages, imageProgress, loadedFromId],
  })

  // ── Auto-sync edits to the saved project (Canva-style live save) ─────
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!loadedFromId || !pack) return
    if (isGenerating) return
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      slpUpdate(loadedFromId, pack)
    }, 1500)
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    }
  }, [pack, loadedFromId, isGenerating, slpUpdate])

  // ── Accept "open project" payload from sidebar / finder ───────────────
  useEffect(() => {
    if (activeApp !== 'super-ladipage') return
    if (!interAppPayload || interAppPayload.targetApp !== 'super-ladipage') return
    if (interAppPayload.targetField === 'landingProjectId' && typeof interAppPayload.data === 'string') {
      handleLoadProject(interAppPayload.data)
      consumePayload()
    }
  }, [interAppPayload, activeApp, consumePayload, handleLoadProject])

  const handleSaveAsProject = (title?: string) => {
    if (!pack) return
    if (loadedFromId) {
      slpUpdate(loadedFromId, pack)
      addToast('✓ Đã lưu thay đổi vào project')
      return
    }
    const saved = slpAdd(pack, title)
    setLoadedFromId(saved.id)
    addToast(`✓ Đã tạo project "${saved.title}" — chỉnh sửa tự đồng bộ`)
  }

  const handleNewProject = () => {
    cancelInFlight('user clicked "Tạo mới"')
    setLoadedFromId(null)
    setPack(null)
    setImageProgress(null)
    lastParamsRef.current = null
    addToast('Đã thoát project — tạo mới')
  }

  useEffect(() => {
    if (activeApp !== 'super-ladipage') return
    if (!interAppPayload || interAppPayload.targetApp !== 'super-ladipage') return
    if (interAppPayload.targetField === 'productId') {
      const product = getProductById(interAppPayload.data as string)
      if (product) setSelectedProduct(product)
      consumePayload()
    }
  }, [interAppPayload, activeApp, consumePayload, getProductById])

  // ── Pack generation (Pass 1 — text only) ────────────────────────────
  const runGeneration = async (params: Omit<LandingGenParams, 'productId'>) => {
    if (!selectedProduct) return
    cancelInFlight('user requested fresh generation')
    lastParamsRef.current = params
    if (loadedFromId) setLoadedFromId(null)
    setIsGenerating(true)
    setPack(null)
    setImageProgress(null)
    try {
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
      sessionApi.forceSave()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[SuperLadipage] pack generation failed:', err)
      addToast(`Tạo landing pack thất bại: ${friendlyError(msg)}`, 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRegenerate = () => {
    if (!lastParamsRef.current) return
    void runGeneration(lastParamsRef.current)
  }

  const patchImagePrompt = useCallback((sectionIdx: number, imageIdx: number, patch: Partial<ImagePrompt>) => {
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
  }, [])

  // ── Pass 2 — batch image generation ──────────────────────────────────
  const handleGenerateAllImages = async () => {
    if (!pack) return
    cancelInFlight('user clicked "Sinh ảnh" — restart batch')
    const controller = new AbortController()
    abortRef.current = controller
    setIsGeneratingImages(true)
    const startedAt = Date.now()
    setImageProgress({ done: 0, failed: 0, total: 0, retries: 0, startedAt })
    try {
      await generatePackImages(pack, {
        // Phase 1 stability freeze: concurrency 2 (reduced from 4).
        // Priority: stability > speed until render pipeline is deterministic.
        // Solo user: 1×2 = 2 concurrent KIE tasks → low error rate.
        // 3-user burst on same acc: 3×2 = 6 → well under KIE threshold ~10-15.
        // Trade-off: pack 35 ảnh ~14-18 phút vs ~9-13 phút (concurrency 4).
        concurrency: 2,
        signal: controller.signal,
        onTaskUpdate: (sIdx, iIdx, patch) =>
          patchImagePrompt(sIdx, iIdx, patch.error ? { ...patch, error: friendlyError(patch.error) } : patch),
        onProgress: (done, failed, total, retries) =>
          setImageProgress({ done, failed, total, retries, startedAt }),
      })
      addToast('✓ Đã sinh xong toàn bộ ảnh landing pack')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('huỷ')) {
        addToast(`Sinh ảnh lỗi: ${friendlyError(msg)}`, 'error')
      }
    } finally {
      setIsGeneratingImages(false)
      if (abortRef.current === controller) abortRef.current = null
      sessionApi.forceSave()
    }
  }

  const handleRegenerateOneImage = async (sectionIdx: number, imageIdx: number) => {
    if (!pack) return
    // Mark ngay status='queued' để UI cập nhật chip "Đang tạo: N" + nút
    // "Thử lại" thành spinner. User thấy phản hồi tức thời dù task có
    // thể đang chờ trong queue. Xóa error cũ.
    patchImagePrompt(sectionIdx, imageIdx, { status: 'queued', error: undefined })
    // Wrap qua enqueueIndividualGen — nếu inFlight đã đầy (4), task
    // chờ trong pendingQueueRef cho tới khi 1 slot free. Tránh user
    // spam 10 click = 10 KIE submits song song.
    await enqueueIndividualGen(async () => {
      try {
        await regenerateSingleImage(
          pack, sectionIdx, imageIdx,
          (sIdx, iIdx, patch) =>
            patchImagePrompt(sIdx, iIdx, patch.error ? { ...patch, error: friendlyError(patch.error) } : patch),
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        addToast(`Sinh ảnh lỗi: ${friendlyError(msg)}`, 'error')
      }
    })
  }

  const handleDeleteOneImage = (sectionIdx: number, imageIdx: number) => {
    if (!pack) return
    patchImagePrompt(sectionIdx, imageIdx, {
      status: 'idle',
      generatedAssetRef: undefined,
      error: undefined,
    })
  }

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
    const CONCURRENCY = 4  // match main batch — 3 user × 4 = 12/acc marginal safe zone
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

  // ── Mobile output-first viewport ────────────────────────────────────
  const [mobileFormVisible, setMobileFormVisible] = useState(true)
  const prevPackRef = useRef<LandingPagePack | null>(null)
  useEffect(() => {
    if (!prevPackRef.current && pack) {
      setMobileFormVisible(false)
    }
    prevPackRef.current = pack
  }, [pack])

  const showInputOnMobile = !pack || mobileFormVisible

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <div
        className={`${showInputOnMobile ? 'flex' : 'hidden'} lg:flex w-full lg:w-[360px] shrink-0 flex-col border-b lg:border-b-0 lg:border-r border-black/8`}
      >
        <InputPanel
          selectedProduct={selectedProduct}
          onProductSelect={setSelectedProduct}
          onGenerate={runGeneration}
          isGenerating={isGenerating}
        />
      </div>

      <div className="relative flex w-full flex-1 flex-col min-h-[400px] lg:min-h-0">
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

        {pack && (
          <button
            onClick={() => setMobileFormVisible((v) => !v)}
            aria-label={showInputOnMobile ? 'Đóng cấu hình' : 'Sửa cấu hình'}
            title={showInputOnMobile ? 'Đóng cấu hình' : 'Sửa cấu hình'}
            className="lg:hidden fixed bottom-4 right-4 z-40 flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-3 text-[12px] font-bold text-white shadow-lg shadow-violet-900/30 hover:bg-violet-700 active:scale-95 transition-transform"
          >
            {showInputOnMobile
              ? <><XIcon className="h-4 w-4" /> Đóng</>
              : <><Sliders className="h-4 w-4" /> Sửa</>}
          </button>
        )}
      </div>
    </div>
  )
}
