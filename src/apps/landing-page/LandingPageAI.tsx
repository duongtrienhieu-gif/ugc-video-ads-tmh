import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import type { Product } from '../../stores/types'
import type { LandingGenParams, LandingPagePack, ImagePrompt } from './types'
import { generateLandingPack } from './services/generateLandingPack'
import { generatePackImages, regenerateSingleImage } from './services/generateImages'
import InputPanel from './components/InputPanel'
import OutputPanel from './components/OutputPanel'

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
    }
  }

  // ── Per-image regen — fired by click 🔄 on a single image card ─────
  const handleRegenerateOneImage = async (sectionIdx: number, imageIdx: number) => {
    if (!pack) return
    try {
      await regenerateSingleImage(pack, sectionIdx, imageIdx, patchImagePrompt)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Sinh lại ảnh lỗi: ${msg}`, 'error')
    }
  }

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
        <OutputPanel
          pack={pack}
          isGenerating={isGenerating}
          onRegenerate={handleRegenerate}
          onGenerateAllImages={handleGenerateAllImages}
          onRegenerateImage={handleRegenerateOneImage}
          imageProgress={imageProgress}
          isGeneratingImages={isGeneratingImages}
        />
      </div>
    </div>
  )
}
