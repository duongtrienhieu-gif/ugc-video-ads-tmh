import { useEffect, useRef, useState } from 'react'
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

// ── Session-persistence snapshot shape ─────────────────────────────────────
// Phase R3 pilot. Persisted across F5 / refresh / browser-close. Stores only
// lightweight refs (asset URLs / IDs) — actual image blobs live in Supabase
// via utils/assetStore.ts. Generation-in-flight is NOT auto-resumed (KIE
// task IDs aren't currently kept here in R3) — but UI state + outputs are.
interface LandingPageSnapshot {
  selectedProductId: string | null
  pack: LandingPagePack | null
  imageProgress: { done: number; failed: number; total: number } | null
  lastParams: Omit<LandingGenParams, 'productId'> | null
}

export default function LandingPageAI() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [pack, setPack] = useState<LandingPagePack | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingImages, setIsGeneratingImages] = useState(false)
  const [imageProgress, setImageProgress] = useState<{ done: number; failed: number; total: number } | null>(null)

  // Remember last params so "Tạo lại" reuses language / niche / visualMemory.
  const lastParamsRef = useRef<Omit<LandingGenParams, 'productId'> | null>(null)

  const interAppPayload = useAppStore((s) => s.interAppPayload)
  const consumePayload  = useAppStore((s) => s.consumePayload)
  const activeApp       = useAppStore((s) => s.activeApp)
  const addToast        = useAppStore((s) => s.addToast)
  const getProductById  = useBankStore((s) => s.getProductById)

  // ── Session persistence (Phase R3 pilot) ──────────────────────────────
  // Counts how many sections + images are complete — drives the modal preview.
  const computeProgress = () => {
    if (!pack) return undefined
    const totalSections = pack.sections.length
    const totalImages = pack.sections.reduce((sum, s) => sum + s.imagePrompts.length, 0)
    const doneImages = pack.sections.reduce(
      (sum, s) => sum + s.imagePrompts.filter((p) => p.imageRef).length,
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
    }),
    hydrate: (data) => {
      if (data.selectedProductId) {
        const p = getProductById(data.selectedProductId)
        if (p) setSelectedProduct(p)
      }
      if (data.pack) setPack(data.pack)
      if (data.imageProgress) setImageProgress(data.imageProgress)
      if (data.lastParams) lastParamsRef.current = data.lastParams
      addToast('✓ Đã khôi phục LandingPage AI từ phiên trước', 'success')
    },
    getStatus: () => {
      if (isGenerating || isGeneratingImages) return 'in-progress'
      if (pack) return 'paused'
      return 'completed'
    },
    getProgressVi: computeProgress,
    getTitleVi: () => pack?.metadata.productName ?? selectedProduct?.productName,
    // Only persist when there's actual work (avatar pack exists or gen in flight)
    shouldPersist: () => !!pack || isGenerating || isGeneratingImages,
    // Re-save when any of these change
    deps: [selectedProduct?.id, pack, isGenerating, isGeneratingImages, imageProgress],
  })

  useEffect(() => {
    if (activeApp !== 'landing-page') return
    if (!interAppPayload || interAppPayload.targetApp !== 'landing-page') return
    if (interAppPayload.targetField === 'productId') {
      const product = getProductById(interAppPayload.data as string)
      if (product) setSelectedProduct(product)
    }
    consumePayload()
  }, [interAppPayload, activeApp, consumePayload, getProductById])

  // ── Pack generation (Phase A — text only) ───────────────────────────
  const runGeneration = async (params: Omit<LandingGenParams, 'productId'>) => {
    if (!selectedProduct) return
    lastParamsRef.current = params
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

  // ── Phase B — batch image generation ────────────────────────────────
  const handleGenerateAllImages = async () => {
    if (!pack) return
    setIsGeneratingImages(true)
    setImageProgress({ done: 0, failed: 0, total: 0 })
    try {
      await generatePackImages(pack, {
        concurrency: 3,
        onTaskUpdate: patchImagePrompt,
        onProgress: (done, failed, total) => setImageProgress({ done, failed, total }),
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
    setImageProgress({ done: 0, failed: 0, total: targets.length })
    let done = 0
    let failed = 0
    // Run up to 3 in parallel (matches the batch worker pool concurrency)
    const CONCURRENCY = 3
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
              setImageProgress({ done, failed, total: targets.length })
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
        />
      </div>
    </div>
  )
}
