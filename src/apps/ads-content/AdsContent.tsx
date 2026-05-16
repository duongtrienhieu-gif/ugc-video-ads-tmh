import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import type { Product } from '../../stores/types'
import type { AdsContentGenParams, AdsContentResult } from './types'
import { generateAdsContent } from './services/generateAdsContent'
import InputPanel from './components/InputPanel'
import OutputPanel from './components/OutputPanel'

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

      <div className="flex w-full flex-1 flex-col min-h-[400px] lg:min-h-0">
        <OutputPanel
          result={result}
          isGenerating={isGenerating}
          onRegenerate={handleRegenerate}
        />
      </div>
    </div>
  )
}
