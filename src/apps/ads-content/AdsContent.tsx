import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import type { Product } from '../../stores/types'
import type { AdsContentGenParams, AdsContentResult } from './types'
import { generateAdsContent } from './services/generateAdsContent'
import InputPanel from './components/InputPanel'
import OutputPanel from './components/OutputPanel'
import AutoSaveIndicator from '../../components/AutoSaveIndicator'
import { useSessionPersist } from '../../services/sessionPersistence'

interface AdsContentSnapshot {
  selectedProductId: string | null
  result: AdsContentResult | null
  lastParams: Omit<AdsContentGenParams, 'productId'> | null
}

export default function AdsContent() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [result, setResult] = useState<AdsContentResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Remember last params so "Tạo lại" reuses the same preset / platform / etc.
  const lastParamsRef = useRef<Omit<AdsContentGenParams, 'productId'> | null>(null)

  const interAppPayload = useAppStore((s) => s.interAppPayload)
  const consumePayload  = useAppStore((s) => s.consumePayload)
  const activeApp       = useAppStore((s) => s.activeApp)
  const addToast        = useAppStore((s) => s.addToast)
  const getProductById  = useBankStore((s) => s.getProductById)

  const sessionApi = useSessionPersist<AdsContentSnapshot>({
    moduleId: 'ads-content',
    version: 1,
    snapshot: () => ({
      selectedProductId: selectedProduct?.id ?? null,
      result,
      lastParams: lastParamsRef.current,
    }),
    hydrate: (data) => {
      if (data.selectedProductId) {
        const p = getProductById(data.selectedProductId)
        if (p) setSelectedProduct(p)
      }
      if (data.result) setResult(data.result)
      if (data.lastParams) lastParamsRef.current = data.lastParams
      addToast('✓ Đã khôi phục Ads Content từ phiên trước', 'success')
    },
    getStatus: () => (isGenerating ? 'in-progress' : result ? 'paused' : 'completed'),
    getTitleVi: () => selectedProduct?.productName,
    getProgressVi: () => (result ? 'Đã sinh content — sẵn sàng copy' : isGenerating ? 'Đang tạo content...' : undefined),
    shouldPersist: () => !!result || isGenerating,
    deps: [selectedProduct?.id, result, isGenerating],
  })

  // Accept productId hand-off from other apps (e.g. Finder → Ads Content)
  useEffect(() => {
    if (activeApp !== 'ads-content') return
    if (!interAppPayload || interAppPayload.targetApp !== 'ads-content') return
    if (interAppPayload.targetField === 'productId') {
      const product = getProductById(interAppPayload.data as string)
      if (product) setSelectedProduct(product)
    }
    consumePayload()
  }, [interAppPayload, activeApp, consumePayload, getProductById])

  const runGeneration = async (params: Omit<AdsContentGenParams, 'productId'>) => {
    if (!selectedProduct) return
    lastParamsRef.current = params
    setIsGenerating(true)
    setResult(null)
    try {
      const r = await generateAdsContent({ ...params, productId: selectedProduct.id })
      setResult(r)
      sessionApi.forceSave()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Tạo content thất bại: ${msg}`, 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRegenerate = () => {
    if (!lastParamsRef.current) return
    void runGeneration(lastParamsRef.current)
  }

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <div className="flex w-full lg:w-[380px] shrink-0 flex-col border-b lg:border-b-0 lg:border-r border-black/8">
        <InputPanel
          selectedProduct={selectedProduct}
          onProductSelect={setSelectedProduct}
          onGenerate={runGeneration}
          isGenerating={isGenerating}
        />
      </div>

      <div className="flex w-full flex-1 flex-col min-h-[400px] lg:min-h-0 relative">
        <div className="absolute right-4 top-3 z-30">
          <AutoSaveIndicator lastSavedAt={sessionApi.lastSavedAt} lastSaveOk={sessionApi.lastSaveOk} />
        </div>
        <OutputPanel
          result={result}
          isGenerating={isGenerating}
          onRegenerate={handleRegenerate}
        />
      </div>
    </div>
  )
}
