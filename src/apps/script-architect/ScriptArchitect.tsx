import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import type { Product } from '../../stores/types'
import type { ScriptGenerationParams, ScriptGenerationResult } from './types'
import InputPanel from './components/InputPanel'
import OutputPanel from './components/OutputPanel'
import { generateUGCScript } from './services/generateScript'

export default function ScriptArchitect() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [result, setResult] = useState<ScriptGenerationResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Remember the last params so "Tạo lại" reuses the same preset / length /
  // tone / educational mode instead of forcing the user to re-select.
  const lastParamsRef = useRef<Omit<ScriptGenerationParams, 'productId'> | null>(null)

  const interAppPayload = useAppStore((s) => s.interAppPayload)
  const consumePayload  = useAppStore((s) => s.consumePayload)
  const activeApp       = useAppStore((s) => s.activeApp)
  const addToast        = useAppStore((s) => s.addToast)
  const getProductById  = useBankStore((s) => s.getProductById)

  // Accept productId hand-off from other apps (e.g. Finder → Tạo Kịch bản)
  useEffect(() => {
    if (activeApp !== 'script-architect') return
    if (!interAppPayload || interAppPayload.targetApp !== 'script-architect') return
    if (interAppPayload.targetField === 'productId') {
      const product = getProductById(interAppPayload.data as string)
      if (product) setSelectedProduct(product)
    }
    consumePayload()
  }, [interAppPayload, activeApp, consumePayload, getProductById])

  const runGeneration = async (params: Omit<ScriptGenerationParams, 'productId'>) => {
    if (!selectedProduct) return
    lastParamsRef.current = params
    setIsGenerating(true)
    setResult(null)
    try {
      const r = await generateUGCScript({ ...params, productId: selectedProduct.id })
      setResult(r)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Tạo kịch bản thất bại: ${msg}`, 'error')
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
          result={result}
          productId={selectedProduct?.id ?? null}
          productName={selectedProduct?.productName ?? null}
          isGenerating={isGenerating}
          onRegenerate={handleRegenerate}
        />
      </div>
    </div>
  )
}
