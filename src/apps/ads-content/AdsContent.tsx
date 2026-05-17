import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import type { Product } from '../../stores/types'
import type {
  AdsContentGenParams, AdsContentResult, CtaStrength, LengthMode, PlatformId, ToneId,
} from './types'
import { generateAdsContent } from './services/generateAdsContent'
import InputPanel from './components/InputPanel'
import OutputPanel from './components/OutputPanel'
import AutoSaveIndicator from '../../components/AutoSaveIndicator'
import { useSessionPersist } from '../../services/sessionPersistence'
import {
  mapFormulaToAdsPreset, mapLabToneToAdsTones,
} from '../lab-content/services/handoffMapping'
import type { LabBriefHandoff } from '../lab-content/types'

interface AdsContentSnapshot {
  selectedProductId: string | null
  presetId: string
  platform: PlatformId
  lengthMode: LengthMode
  toneIds: ToneId[]
  ctaStrength: CtaStrength
  educationalMode: boolean
  result: AdsContentResult | null
  lastParams: Omit<AdsContentGenParams, 'productId'> | null
}

const DEFAULT_PRESET_ID = 'storytelling'
const DEFAULT_PLATFORM: PlatformId = 'facebook-feed'
const DEFAULT_LENGTH: LengthMode = 'medium'
const DEFAULT_CTA: CtaStrength = 'balanced'

export default function AdsContent() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [result, setResult] = useState<AdsContentResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Form state lifted from InputPanel so it survives F5 via session persistence
  const [presetId, setPresetId] = useState<string>(DEFAULT_PRESET_ID)
  const [platform, setPlatform] = useState<PlatformId>(DEFAULT_PLATFORM)
  const [lengthMode, setLengthMode] = useState<LengthMode>(DEFAULT_LENGTH)
  const [toneIds, setToneIds] = useState<ToneId[]>([])
  const [ctaStrength, setCtaStrength] = useState<CtaStrength>(DEFAULT_CTA)
  const [educationalMode, setEducationalMode] = useState(false)

  const lastParamsRef = useRef<Omit<AdsContentGenParams, 'productId'> | null>(null)

  const interAppPayload = useAppStore((s) => s.interAppPayload)
  const consumePayload  = useAppStore((s) => s.consumePayload)
  const activeApp       = useAppStore((s) => s.activeApp)
  const addToast        = useAppStore((s) => s.addToast)
  const getProductById  = useBankStore((s) => s.getProductById)

  const sessionApi = useSessionPersist<AdsContentSnapshot>({
    moduleId: 'ads-content',
    version: 2, // bumped — snapshot now includes form state
    snapshot: () => ({
      selectedProductId: selectedProduct?.id ?? null,
      presetId,
      platform,
      lengthMode,
      toneIds,
      ctaStrength,
      educationalMode,
      result,
      lastParams: lastParamsRef.current,
    }),
    hydrate: (data) => {
      if (data.selectedProductId) {
        const p = getProductById(data.selectedProductId)
        if (p) setSelectedProduct(p)
      }
      if (data.presetId)    setPresetId(data.presetId)
      if (data.platform)    setPlatform(data.platform)
      if (data.lengthMode)  setLengthMode(data.lengthMode)
      if (Array.isArray(data.toneIds)) setToneIds(data.toneIds)
      if (data.ctaStrength) setCtaStrength(data.ctaStrength)
      if (typeof data.educationalMode === 'boolean') setEducationalMode(data.educationalMode)
      if (data.result)      setResult(data.result)
      if (data.lastParams)  lastParamsRef.current = data.lastParams
    },
    getStatus: () => (isGenerating ? 'in-progress' : result || selectedProduct ? 'paused' : 'completed'),
    getTitleVi: () => selectedProduct?.productName,
    getProgressVi: () => (result ? 'Đã sinh content — sẵn sàng copy' : isGenerating ? 'Đang tạo content...' : selectedProduct ? 'Đã chọn sản phẩm — chưa tạo' : undefined),
    shouldPersist: () =>
      !!result || isGenerating || !!selectedProduct ||
      presetId !== DEFAULT_PRESET_ID || platform !== DEFAULT_PLATFORM ||
      lengthMode !== DEFAULT_LENGTH || ctaStrength !== DEFAULT_CTA ||
      toneIds.length > 0 || educationalMode,
    deps: [selectedProduct?.id, result, isGenerating, presetId, platform, lengthMode, toneIds, ctaStrength, educationalMode],
  })

  // Accept productId / lab-brief hand-off from other apps
  useEffect(() => {
    if (activeApp !== 'ads-content') return
    if (!interAppPayload || interAppPayload.targetApp !== 'ads-content') return
    if (interAppPayload.targetField === 'productId') {
      const product = getProductById(interAppPayload.data as string)
      if (product) setSelectedProduct(product)
    } else if (interAppPayload.targetField === 'lab-brief') {
      // Pre-fill form from a Lab Content strategic brief.
      const handoff = interAppPayload.data as LabBriefHandoff
      const product = getProductById(handoff.productId)
      if (product) setSelectedProduct(product)
      setPresetId(mapFormulaToAdsPreset(handoff.angle.recommendedFormula))
      const mappedTones = mapLabToneToAdsTones(handoff.toneId) as ToneId[]
      if (mappedTones.length > 0) setToneIds(mappedTones)
      // Conversion / retargeting goal → harder CTA; awareness / engagement → softer.
      if (handoff.goal === 'conversion' || handoff.goal === 'retargeting') {
        setCtaStrength('hard')
      } else {
        setCtaStrength('soft')
      }
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
          presetId={presetId}
          onPresetIdChange={setPresetId}
          platform={platform}
          onPlatformChange={setPlatform}
          lengthMode={lengthMode}
          onLengthModeChange={setLengthMode}
          toneIds={toneIds}
          onToneIdsChange={setToneIds}
          ctaStrength={ctaStrength}
          onCtaStrengthChange={setCtaStrength}
          educationalMode={educationalMode}
          onEducationalModeChange={setEducationalMode}
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
