import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import type { Product } from '../../stores/types'
import type { EditableProductContext } from './types'
import InputPanel from './components/InputPanel'
import OutputPanel from './components/OutputPanel'
import { generateScript } from './services/generateScript'

export default function ScriptArchitect() {
  const [winningTranscript, setWinningTranscript] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [attachedImage, setAttachedImage] = useState<{
    file: File
    preview: string
    base64: string
    mimeType: string
  } | null>(null)
  const [generatedVariants, setGeneratedVariants] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [highlightField, setHighlightField] = useState<string | null>(null)

  const interAppPayload = useAppStore((s) => s.interAppPayload)
  const consumePayload = useAppStore((s) => s.consumePayload)
  const activeApp = useAppStore((s) => s.activeApp)
  const addToast = useAppStore((s) => s.addToast)
  const getProductById = useBankStore((s) => s.getProductById)

  useEffect(() => {
    if (activeApp !== 'script-architect') return
    if (!interAppPayload || interAppPayload.targetApp !== 'script-architect') return

    const { targetField, data } = interAppPayload

    if (targetField === 'winningTranscript' || targetField === 'reconstructionPrompt') {
      setWinningTranscript(data as string)
      setHighlightField('transcript')
      setTimeout(() => setHighlightField(null), 800)
    }

    if (targetField === 'productId') {
      const product = getProductById(data as string)
      if (product) setSelectedProduct(product)
    }

    consumePayload()
  }, [interAppPayload, activeApp, consumePayload, getProductById])

  const handleGenerate = async (productContext: EditableProductContext | null) => {
    if (!winningTranscript.trim() || !selectedProduct) return

    setIsGenerating(true)
    try {
      const result = await generateScript({
        winningTranscript,
        productId: selectedProduct.id,
        productContext: productContext ?? undefined,
        attachedImage: attachedImage
          ? { base64: attachedImage.base64, mimeType: attachedImage.mimeType }
          : null,
      })
      setGeneratedVariants(result.variants)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Tạo kịch bản thất bại: ${msg}`, 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row h-full">
      <div className="flex w-full lg:w-1/2 shrink-0 flex-col border-b lg:border-b-0 lg:border-r border-black/8">
        <InputPanel
          winningTranscript={winningTranscript}
          onTranscriptChange={setWinningTranscript}
          selectedProduct={selectedProduct}
          onProductSelect={setSelectedProduct}
          attachedImage={attachedImage}
          onAttachedImageChange={setAttachedImage}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          highlightField={highlightField}
        />
      </div>

      <div className="flex w-full lg:w-1/2 flex-col min-h-[300px] lg:min-h-0">
        <OutputPanel
          variants={generatedVariants}
          linkedProductId={selectedProduct?.id ?? null}
          isGenerating={isGenerating}
        />
      </div>
    </div>
  )
}
