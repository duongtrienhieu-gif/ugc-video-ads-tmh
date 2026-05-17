import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import type { Product } from '../../stores/types'
import type {
  Goal, LabBriefHandoff, LabBriefParams, LabBriefResult, ToneId,
} from './types'
import { generateBrief } from './services/generateBrief'
import { getGoalById } from './services/presets'
import { useLabContentStore } from './store'
import InputPanel from './components/InputPanel'
import OutputPanel from './components/OutputPanel'
import AutoSaveIndicator from '../../components/AutoSaveIndicator'
import { useSessionPersist } from '../../services/sessionPersistence'

interface LabContentSnapshot {
  selectedProductId: string | null
  goal: Goal
  toneId: ToneId
  customToneNote: string
  result: LabBriefResult | null
  lastParams: Omit<LabBriefParams, 'productId'> | null
  savedBriefId: string | null  // if user already pressed "Lưu brief", remember which save
}

const DEFAULT_GOAL: Goal = 'conversion'
const DEFAULT_TONE: ToneId = 'storyteller'

export default function LabContent() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [result, setResult] = useState<LabBriefResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const [goal, setGoal] = useState<Goal>(DEFAULT_GOAL)
  const [toneId, setToneId] = useState<ToneId>(DEFAULT_TONE)
  const [customToneNote, setCustomToneNote] = useState('')

  const [savedBriefId, setSavedBriefId] = useState<string | null>(null)

  const lastParamsRef = useRef<Omit<LabBriefParams, 'productId'> | null>(null)

  const interAppPayload = useAppStore((s) => s.interAppPayload)
  const consumePayload  = useAppStore((s) => s.consumePayload)
  const activeApp       = useAppStore((s) => s.activeApp)
  const sendToApp       = useAppStore((s) => s.sendToApp)
  const openApp         = useAppStore((s) => s.openApp)
  const addToast        = useAppStore((s) => s.addToast)
  const getProductById  = useBankStore((s) => s.getProductById)
  const addSaved        = useLabContentStore((s) => s.add)

  const sessionApi = useSessionPersist<LabContentSnapshot>({
    moduleId: 'lab-content',
    version: 1,
    snapshot: () => ({
      selectedProductId: selectedProduct?.id ?? null,
      goal,
      toneId,
      customToneNote,
      result,
      lastParams: lastParamsRef.current,
      savedBriefId,
    }),
    hydrate: (data) => {
      if (data.selectedProductId) {
        const p = getProductById(data.selectedProductId)
        if (p) setSelectedProduct(p)
      }
      if (data.goal)                        setGoal(data.goal)
      if (data.toneId)                      setToneId(data.toneId)
      if (typeof data.customToneNote === 'string') setCustomToneNote(data.customToneNote)
      if (data.result)                      setResult(data.result)
      if (data.lastParams)                  lastParamsRef.current = data.lastParams
      if (data.savedBriefId)                setSavedBriefId(data.savedBriefId)
    },
    getStatus: () => (isGenerating ? 'in-progress' : result || selectedProduct ? 'paused' : 'completed'),
    getTitleVi: () => selectedProduct?.productName,
    getProgressVi: () =>
      result
        ? 'Đã có brief — sẵn sàng push sang Ads / Kịch bản'
        : isGenerating
          ? 'Đang phân tích chiến lược...'
          : selectedProduct
            ? 'Đã chọn sản phẩm — chưa tạo brief'
            : undefined,
    shouldPersist: () =>
      !!result || isGenerating || !!selectedProduct ||
      goal !== DEFAULT_GOAL || toneId !== DEFAULT_TONE || customToneNote.trim().length > 0,
    deps: [selectedProduct?.id, result, isGenerating, goal, toneId, customToneNote, savedBriefId],
  })

  // Accept productId hand-off from other apps (e.g. Finder → Lab Content)
  useEffect(() => {
    if (activeApp !== 'lab-content') return
    if (!interAppPayload || interAppPayload.targetApp !== 'lab-content') return
    if (interAppPayload.targetField === 'productId') {
      const product = getProductById(interAppPayload.data as string)
      if (product) setSelectedProduct(product)
    }
    consumePayload()
  }, [interAppPayload, activeApp, consumePayload, getProductById])

  const runGeneration = async (params: Omit<LabBriefParams, 'productId'>) => {
    if (!selectedProduct) return
    lastParamsRef.current = params
    setIsGenerating(true)
    setResult(null)
    setSavedBriefId(null)
    try {
      const r = await generateBrief({ ...params, productId: selectedProduct.id })
      setResult(r)
      sessionApi.forceSave()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Tạo brief thất bại: ${msg}`, 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRegenerate = () => {
    if (!lastParamsRef.current) return
    void runGeneration(lastParamsRef.current)
  }

  const handleSave = () => {
    if (!result || savedBriefId) return
    const goalLabel = getGoalById(result.goal)?.label ?? result.goal
    const saved = addSaved({
      ...result,
      title: `${result.productName} — ${goalLabel}`,
    })
    setSavedBriefId(saved.id)
    addToast('Đã lưu brief vào History', 'success')
  }

  const handlePushToAdsContent = (handoff: LabBriefHandoff) => {
    sendToApp({
      targetApp: 'ads-content',
      targetField: 'lab-brief',
      data: handoff,
    })
    openApp('ads-content')
    addToast(`Đã mở Ads Content với góc "${handoff.angle.titleVi}"`, 'info')
  }

  const handlePushToScriptArchitect = (handoff: LabBriefHandoff) => {
    sendToApp({
      targetApp: 'script-architect',
      targetField: 'lab-brief',
      data: handoff,
    })
    openApp('script-architect')
    addToast(`Đã mở Kịch bản UGC với góc "${handoff.angle.titleVi}"`, 'info')
  }

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <div className="flex w-full lg:w-[380px] shrink-0 flex-col border-b lg:border-b-0 lg:border-r border-black/8">
        <InputPanel
          selectedProduct={selectedProduct}
          onProductSelect={(p) => { setSelectedProduct(p); setSavedBriefId(null) }}
          onGenerate={runGeneration}
          isGenerating={isGenerating}
          goal={goal}
          onGoalChange={setGoal}
          toneId={toneId}
          onToneIdChange={setToneId}
          customToneNote={customToneNote}
          onCustomToneNoteChange={setCustomToneNote}
        />
      </div>

      <div className="flex w-full flex-1 flex-col min-h-[400px] lg:min-h-0 relative">
        <div className="absolute right-4 top-3 z-30">
          <AutoSaveIndicator lastSavedAt={sessionApi.lastSavedAt} lastSaveOk={sessionApi.lastSaveOk} />
        </div>
        <OutputPanel
          result={result}
          isGenerating={isGenerating}
          isAlreadySaved={!!savedBriefId}
          onRegenerate={handleRegenerate}
          onSave={handleSave}
          onPushToAdsContent={handlePushToAdsContent}
          onPushToScriptArchitect={handlePushToScriptArchitect}
        />
      </div>
    </div>
  )
}
