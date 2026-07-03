import { useEffect, useRef, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import type { Product } from '../../stores/types'
import type {
  AdsContentGenParams, AdsContentResult, LangMode,
} from './types'
import { generateAdsContent } from './services/generateAdsContent'
import InputPanel from './components/InputPanel'
import OutputPanel from './components/OutputPanel'
import SegmentTabs from '../../components/shell/SegmentTabs'
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
    version: 6, // bumped — angle set changed (PAS replaces hard-offer)
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

  // Mobile flow: [Thiết lập | Kết quả] segmented (replaces the old FAB).
  // Auto-switch to "Kết quả" when content lands (null → set). Desktop = 2-pane.
  const [mobileTab, setMobileTab] = useState<'setup' | 'result'>('setup')
  const prevResultRef = useRef<AdsContentResult | null>(null)
  useEffect(() => {
    if (!prevResultRef.current && result) setMobileTab('result')
    prevResultRef.current = result
  }, [result])

  return (
    <div className="flex h-full flex-col">
      {/* Mobile segmented control — replaces the floating FAB */}
      <div className="shrink-0 border-b border-app-border px-3 py-2 lg:hidden">
        <SegmentTabs
          value={mobileTab}
          onChange={setMobileTab}
          options={[
            { value: 'setup', label: 'Thiết lập' },
            { value: 'result', label: 'Kết quả' },
          ]}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Config rail */}
        <div className={`${mobileTab === 'setup' ? 'flex' : 'hidden'} w-full shrink-0 flex-col lg:flex lg:w-[380px] lg:border-r lg:border-app-border`}>
          {/* Ô tiêu đề GÓC NHỎ thay dải header full-width */}
          <div className="flex shrink-0 items-center gap-2 border-b border-app-border bg-app-surface px-3 py-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: 'var(--color-accent-dim)' }}>
              <Megaphone className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} strokeWidth={2} />
            </span>
            <span className="truncate text-sm font-bold text-app-text">Ads Content</span>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <AutoSaveIndicator lastSavedAt={sessionApi.lastSavedAt} lastSaveOk={sessionApi.lastSaveOk} />
            </div>
          </div>
          <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
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
        </div>

        {/* Result canvas */}
        <div className={`${mobileTab === 'result' ? 'flex' : 'hidden'} w-full min-h-0 flex-1 flex-col lg:flex`}>
          <OutputPanel
            result={result}
            isGenerating={isGenerating}
            onRegenerate={handleRegenerate}
          />
        </div>
      </div>
    </div>
  )
}
