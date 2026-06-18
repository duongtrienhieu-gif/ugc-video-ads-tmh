import { useEffect, useRef, useState } from 'react'
import { Sliders, X as XIcon } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import type { Product } from '../../stores/types'
import type {
  AdsContentGenParams, AdsContentResult, LangMode,
} from './types'
import { generateAdsContent } from './services/generateAdsContent'
import InputPanel from './components/InputPanel'
import OutputPanel from './components/OutputPanel'
import AutoSaveIndicator from '../../components/AutoSaveIndicator'
import { useSessionPersist } from '../../services/sessionPersistence'

interface AdsContentSnapshot {
  selectedProductId: string | null
  presetId: string
  langMode: LangMode
  result: AdsContentResult | null
  lastParams: Omit<AdsContentGenParams, 'productId'> | null
}

const DEFAULT_PRESET_ID = 'story'           // an ADS_ANGLES id
const DEFAULT_LANG: LangMode = 'ms'          // MY-first per project default

export default function AdsContent() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [result, setResult] = useState<AdsContentResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Form state lifted from InputPanel so it survives F5 via session persistence.
  // Platform is fixed to Facebook; length/CTA/educational derive from the angle.
  const [presetId, setPresetId] = useState<string>(DEFAULT_PRESET_ID)
  const [langMode, setLangMode] = useState<LangMode>(DEFAULT_LANG)

  const lastParamsRef = useRef<Omit<AdsContentGenParams, 'productId'> | null>(null)

  const interAppPayload = useAppStore((s) => s.interAppPayload)
  const consumePayload  = useAppStore((s) => s.consumePayload)
  const activeApp       = useAppStore((s) => s.activeApp)
  const addToast        = useAppStore((s) => s.addToast)
  const getProductById  = useBankStore((s) => s.getProductById)

  const sessionApi = useSessionPersist<AdsContentSnapshot>({
    moduleId: 'ads-content',
    version: 5, // bumped — angle set changed (listicle replaces hook-stop), dropped 'both'
    snapshot: () => ({
      selectedProductId: selectedProduct?.id ?? null,
      presetId,
      langMode,
      result,
      lastParams: lastParamsRef.current,
    }),
    hydrate: (data) => {
      if (data.selectedProductId) {
        const p = getProductById(data.selectedProductId)
        if (p) setSelectedProduct(p)
      }
      if (data.presetId)  setPresetId(data.presetId)
      if (data.langMode)  setLangMode(data.langMode)
      if (data.result)    setResult(data.result)
      if (data.lastParams) lastParamsRef.current = data.lastParams
    },
    getStatus: () => (isGenerating ? 'in-progress' : result || selectedProduct ? 'paused' : 'completed'),
    getTitleVi: () => selectedProduct?.productName,
    getProgressVi: () => (result ? 'Đã sinh content — sẵn sàng copy' : isGenerating ? 'Đang tạo content...' : selectedProduct ? 'Đã chọn sản phẩm — chưa tạo' : undefined),
    shouldPersist: () =>
      !!result || isGenerating || !!selectedProduct ||
      presetId !== DEFAULT_PRESET_ID || langMode !== DEFAULT_LANG,
    deps: [selectedProduct?.id, result, isGenerating, presetId, langMode],
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

  // Mobile output-first (M5): auto-collapse input form when result lands so
  // the user sees what they just generated, with a "Sửa" FAB to re-open.
  const [mobileFormVisible, setMobileFormVisible] = useState(true)
  const prevResultRef = useRef<AdsContentResult | null>(null)
  useEffect(() => {
    if (!prevResultRef.current && result) setMobileFormVisible(false)
    prevResultRef.current = result
  }, [result])
  const showInputOnMobile = !result || mobileFormVisible

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <div className={`${showInputOnMobile ? 'flex' : 'hidden'} lg:flex w-full lg:w-[380px] shrink-0 flex-col border-b lg:border-b-0 lg:border-r border-black/8`}>
        <InputPanel
          selectedProduct={selectedProduct}
          onProductSelect={setSelectedProduct}
          onGenerate={runGeneration}
          isGenerating={isGenerating}
          presetId={presetId}
          onPresetIdChange={setPresetId}
          langMode={langMode}
          onLangModeChange={setLangMode}
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

        {result && (
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
