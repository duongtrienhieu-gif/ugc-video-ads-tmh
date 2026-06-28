import { useState, useEffect, useRef } from 'react'
import { PenLine } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import type { Product } from '../../stores/types'
import type {
  HookStrength, LengthSeconds, ScriptGenerationParams, ScriptGenerationResult, ToneModifier,
} from './types'
import InputPanel from './components/InputPanel'
import OutputPanel from './components/OutputPanel'
import AppHeader from '../../components/shell/AppHeader'
import SegmentTabs from '../../components/shell/SegmentTabs'
import AutoSaveIndicator from '../../components/AutoSaveIndicator'
import { useSessionPersist } from '../../services/sessionPersistence'
import { generateUGCScript } from './services/generateScript'
import { getPresetById } from './services/presets'

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
      // Guard against stale sessions pointing at a preset removed in the COD rebuild.
      if (data.presetId && getPresetById(data.presetId)) setPresetId(data.presetId)
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

  // Mobile flow (unified pattern): a [Thiết lập | Kết quả] segmented control
  // replaces the old floating FAB. When a result lands (null → set) we auto-
  // switch to "Kết quả" so the user sees the script. Desktop shows both panes.
  const [mobileTab, setMobileTab] = useState<'setup' | 'result'>('setup')
  const prevResultRef = useRef<ScriptGenerationResult | null>(null)
  useEffect(() => {
    if (!prevResultRef.current && result) setMobileTab('result')
    prevResultRef.current = result
  }, [result])

  return (
    <div className="flex h-full flex-col">
      <AppHeader
        icon={PenLine}
        eyebrow="KỊCH BẢN UGC"
        title="Script Architect"
        subtitle="Script video ads theo công thức quảng cáo thực chiến"
        actions={<AutoSaveIndicator lastSavedAt={sessionApi.lastSavedAt} lastSaveOk={sessionApi.lastSaveOk} />}
      />

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
        <div className={`${mobileTab === 'setup' ? 'flex' : 'hidden'} w-full shrink-0 flex-col lg:flex lg:w-[360px] lg:border-r lg:border-app-border`}>
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

        {/* Result canvas */}
        <div className={`${mobileTab === 'result' ? 'flex' : 'hidden'} w-full min-h-0 flex-1 flex-col lg:flex`}>
          <OutputPanel
            result={result}
            productId={selectedProduct?.id ?? null}
            productName={selectedProduct?.productName ?? null}
            isGenerating={isGenerating}
            onRegenerate={handleRegenerate}
          />
        </div>
      </div>
    </div>
  )
}
