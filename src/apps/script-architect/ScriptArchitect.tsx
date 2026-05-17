import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import type { Product } from '../../stores/types'
import type {
  HookStrength, LengthSeconds, ScriptGenerationParams, ScriptGenerationResult, ToneModifier,
} from './types'
import InputPanel from './components/InputPanel'
import OutputPanel from './components/OutputPanel'
import AutoSaveIndicator from '../../components/AutoSaveIndicator'
import { useSessionPersist } from '../../services/sessionPersistence'
import { generateUGCScript } from './services/generateScript'
import {
  mapFormulaToScriptPreset, mapLabToneToScriptTones,
} from '../lab-content/services/handoffMapping'
import type { LabBriefHandoff } from '../lab-content/types'

// Session-persistence snapshot — survives F5
interface ScriptSnapshot {
  selectedProductId: string | null
  presetId: string
  lengthSec: LengthSeconds
  hookStrength: HookStrength
  toneModifiers: ToneModifier[]
  educationalMode: boolean
  result: ScriptGenerationResult | null
  lastParams: Omit<ScriptGenerationParams, 'productId'> | null
}

const DEFAULT_PRESET_ID = 'problem-solution'
const DEFAULT_LENGTH: LengthSeconds = 30
const DEFAULT_HOOK: HookStrength = 'balanced'

export default function ScriptArchitect() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [result, setResult] = useState<ScriptGenerationResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Form state lifted from InputPanel so it can be persisted across F5
  const [presetId, setPresetId] = useState<string>(DEFAULT_PRESET_ID)
  const [lengthSec, setLengthSec] = useState<LengthSeconds>(DEFAULT_LENGTH)
  const [hookStrength, setHookStrength] = useState<HookStrength>(DEFAULT_HOOK)
  const [toneModifiers, setToneModifiers] = useState<ToneModifier[]>([])
  const [educationalMode, setEducationalMode] = useState(false)

  const lastParamsRef = useRef<Omit<ScriptGenerationParams, 'productId'> | null>(null)

  const interAppPayload = useAppStore((s) => s.interAppPayload)
  const consumePayload  = useAppStore((s) => s.consumePayload)
  const activeApp       = useAppStore((s) => s.activeApp)
  const addToast        = useAppStore((s) => s.addToast)
  const getProductById  = useBankStore((s) => s.getProductById)

  const sessionApi = useSessionPersist<ScriptSnapshot>({
    moduleId: 'script-architect',
    version: 2, // bumped — snapshot shape changed to include form state
    snapshot: () => ({
      selectedProductId: selectedProduct?.id ?? null,
      presetId,
      lengthSec,
      hookStrength,
      toneModifiers,
      educationalMode,
      result,
      lastParams: lastParamsRef.current,
    }),
    hydrate: (data) => {
      if (data.selectedProductId) {
        const p = getProductById(data.selectedProductId)
        if (p) setSelectedProduct(p)
      }
      if (data.presetId)            setPresetId(data.presetId)
      if (data.lengthSec)           setLengthSec(data.lengthSec)
      if (data.hookStrength)        setHookStrength(data.hookStrength)
      if (Array.isArray(data.toneModifiers)) setToneModifiers(data.toneModifiers)
      if (typeof data.educationalMode === 'boolean') setEducationalMode(data.educationalMode)
      if (data.result)              setResult(data.result)
      if (data.lastParams)          lastParamsRef.current = data.lastParams
    },
    getStatus: () => (isGenerating ? 'in-progress' : result || selectedProduct ? 'paused' : 'completed'),
    getTitleVi: () => selectedProduct?.productName,
    getProgressVi: () => (result ? 'Đã sinh kịch bản — sẵn sàng xem / chỉnh' : isGenerating ? 'Đang tạo kịch bản...' : selectedProduct ? 'Đã chọn sản phẩm — chưa tạo' : undefined),
    shouldPersist: () =>
      !!result || isGenerating || !!selectedProduct ||
      presetId !== DEFAULT_PRESET_ID || lengthSec !== DEFAULT_LENGTH ||
      hookStrength !== DEFAULT_HOOK || toneModifiers.length > 0 || educationalMode,
    deps: [selectedProduct?.id, result, isGenerating, presetId, lengthSec, hookStrength, toneModifiers, educationalMode],
  })

  // Accept productId / lab-brief hand-off from other apps
  useEffect(() => {
    if (activeApp !== 'script-architect') return
    if (!interAppPayload || interAppPayload.targetApp !== 'script-architect') return
    if (interAppPayload.targetField === 'productId') {
      const product = getProductById(interAppPayload.data as string)
      if (product) setSelectedProduct(product)
    } else if (interAppPayload.targetField === 'lab-brief') {
      // Pre-fill form from a Lab Content strategic brief.
      const handoff = interAppPayload.data as LabBriefHandoff
      const product = getProductById(handoff.productId)
      if (product) setSelectedProduct(product)
      setPresetId(mapFormulaToScriptPreset(handoff.angle.recommendedFormula))
      const mappedTones = mapLabToneToScriptTones(handoff.toneId) as ToneModifier[]
      if (mappedTones.length > 0) setToneModifiers(mappedTones)
      // Conversion goal → stronger hook; awareness → balanced.
      if (handoff.goal === 'conversion' || handoff.goal === 'retargeting') {
        setHookStrength('aggressive')
      }
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
      sessionApi.forceSave()
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
          presetId={presetId}
          onPresetIdChange={setPresetId}
          lengthSec={lengthSec}
          onLengthSecChange={setLengthSec}
          hookStrength={hookStrength}
          onHookStrengthChange={setHookStrength}
          toneModifiers={toneModifiers}
          onToneModifiersChange={setToneModifiers}
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
          productId={selectedProduct?.id ?? null}
          productName={selectedProduct?.productName ?? null}
          isGenerating={isGenerating}
          onRegenerate={handleRegenerate}
        />
      </div>
    </div>
  )
}
