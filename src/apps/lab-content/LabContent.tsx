import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import type { Product } from '../../stores/types'
import type {
  ContentAngle, Goal, LabBriefParams, LabBriefResult, PricingInfo, SalesLetterLength, ToneId,
} from './types'
import { DEFAULT_PRICING_INFO } from './types'
import { generateBrief } from './services/generateBrief'
import { generateLabCaption } from './services/generateLabCaption'
import { generateLabScript } from './services/generateLabScript'
import { generateHookLab } from './services/generateHookLab'
import { generateFunnel } from './services/generateFunnel'
import { generateCoc } from './services/generateCoc'
import { generateSalesLetter } from './services/generateSalesLetter'
import { generateMultiAngle } from './services/generateMultiAngle'
import { getGoalById } from './services/presets'
import { useLabContentStore } from './store'
import InputPanel from './components/InputPanel'
import OutputPanel from './components/OutputPanel'
import AngleOutputModal, { type OutputMode } from './components/AngleOutputModal'
import HookLabModal from './components/HookLabModal'
import FunnelModal from './components/FunnelModal'
import CocModal from './components/CocModal'
import SalesLetterModal from './components/SalesLetterModal'
import MultiAngleModal from './components/MultiAngleModal'
import AutoSaveIndicator from '../../components/AutoSaveIndicator'
import { useSessionPersist } from '../../services/sessionPersistence'

interface LabContentSnapshot {
  selectedProductId: string | null
  goal: Goal
  toneId: ToneId
  customToneNote: string
  pricing: PricingInfo
  result: LabBriefResult | null
  lastParams: Omit<LabBriefParams, 'productId'> | null
  savedBriefId: string | null
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
  const [pricing, setPricing] = useState<PricingInfo>(DEFAULT_PRICING_INFO)

  const [savedBriefId, setSavedBriefId] = useState<string | null>(null)

  // ── Inline output modal state (caption + script per angle) ─────────────
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<OutputMode>('caption')
  const [modalAngle, setModalAngle] = useState<ContentAngle | null>(null)
  const [modalGenerating, setModalGenerating] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  // ── Hook Lab modal state ───────────────────────────────────────────────
  const [hookLabOpen, setHookLabOpen] = useState(false)
  const [hookLabGenerating, setHookLabGenerating] = useState(false)
  const [hookLabError, setHookLabError] = useState<string | null>(null)

  // ── Funnel modal state ─────────────────────────────────────────────────
  const [funnelOpen, setFunnelOpen] = useState(false)
  const [funnelGenerating, setFunnelGenerating] = useState(false)
  const [funnelError, setFunnelError] = useState<string | null>(null)

  // ── COC Multiplier modal state ─────────────────────────────────────────
  const [cocOpen, setCocOpen] = useState(false)
  const [cocGenerating, setCocGenerating] = useState(false)
  const [cocError, setCocError] = useState<string | null>(null)

  // ── Long-Form Sales Letter modal state ─────────────────────────────────
  const [salesLetterOpen, setSalesLetterOpen] = useState(false)
  const [salesLetterGenerating, setSalesLetterGenerating] = useState(false)
  const [salesLetterError, setSalesLetterError] = useState<string | null>(null)

  // ── Multi-Angle Ad Pack modal state ────────────────────────────────────
  const [multiAngleOpen, setMultiAngleOpen] = useState(false)
  const [multiAngleGenerating, setMultiAngleGenerating] = useState(false)
  const [multiAngleError, setMultiAngleError] = useState<string | null>(null)

  const lastParamsRef = useRef<Omit<LabBriefParams, 'productId'> | null>(null)

  const interAppPayload = useAppStore((s) => s.interAppPayload)
  const consumePayload  = useAppStore((s) => s.consumePayload)
  const activeApp       = useAppStore((s) => s.activeApp)
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
      pricing,
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
      if (data.pricing && typeof data.pricing === 'object') setPricing({ ...DEFAULT_PRICING_INFO, ...data.pricing })
      if (data.result) {
        // Migrate older snapshots that pre-date angleOutputs
        setResult({ ...data.result, angleOutputs: data.result.angleOutputs ?? {} })
      }
      if (data.lastParams)                  lastParamsRef.current = data.lastParams
      if (data.savedBriefId)                setSavedBriefId(data.savedBriefId)
    },
    getStatus: () => (isGenerating ? 'in-progress' : result || selectedProduct ? 'paused' : 'completed'),
    getTitleVi: () => selectedProduct?.productName,
    getProgressVi: () =>
      result
        ? 'Đã có brief — sẵn sàng tạo caption / kịch bản'
        : isGenerating
          ? 'Đang phân tích chiến lược...'
          : selectedProduct
            ? 'Đã chọn sản phẩm — chưa tạo brief'
            : undefined,
    shouldPersist: () =>
      !!result || isGenerating || !!selectedProduct ||
      goal !== DEFAULT_GOAL || toneId !== DEFAULT_TONE || customToneNote.trim().length > 0 ||
      pricing.enabled,
    deps: [selectedProduct?.id, result, isGenerating, goal, toneId, customToneNote, pricing, savedBriefId],
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

  // ── Brief generation ────────────────────────────────────────────────────
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

  const handleRegenerateBrief = () => {
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

  // ── Modal open + generation ────────────────────────────────────────────
  const handleOpenCaption = (angle: ContentAngle) => {
    setModalAngle(angle)
    setModalMode('caption')
    setModalError(null)
    setModalOpen(true)
    // Auto-generate if no cached output exists for this angle
    const cached = result?.angleOutputs?.[angle.id]?.caption
    if (!cached) void runCaptionGeneration(angle, false)
  }

  const handleOpenScript = (angle: ContentAngle) => {
    setModalAngle(angle)
    setModalMode('script')
    setModalError(null)
    setModalOpen(true)
    const cached = result?.angleOutputs?.[angle.id]?.script
    if (!cached) void runScriptGeneration(angle, false)
  }

  const runCaptionGeneration = async (angle: ContentAngle, isRetry: boolean) => {
    if (!result) return
    setModalGenerating(true)
    setModalError(null)
    try {
      const output = await generateLabCaption(result, angle)
      // Merge into angleOutputs
      setResult((prev) => {
        if (!prev) return prev
        const existing = prev.angleOutputs[angle.id] ?? {}
        return {
          ...prev,
          angleOutputs: {
            ...prev.angleOutputs,
            [angle.id]: { ...existing, caption: output },
          },
        }
      })
      sessionApi.forceSave()
      if (isRetry) addToast('Đã tạo lại caption', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setModalError(msg)
    } finally {
      setModalGenerating(false)
    }
  }

  const runScriptGeneration = async (angle: ContentAngle, isRetry: boolean) => {
    if (!result) return
    setModalGenerating(true)
    setModalError(null)
    try {
      const output = await generateLabScript(result, angle)
      setResult((prev) => {
        if (!prev) return prev
        const existing = prev.angleOutputs[angle.id] ?? {}
        return {
          ...prev,
          angleOutputs: {
            ...prev.angleOutputs,
            [angle.id]: { ...existing, script: output },
          },
        }
      })
      sessionApi.forceSave()
      if (isRetry) addToast('Đã tạo lại kịch bản', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setModalError(msg)
    } finally {
      setModalGenerating(false)
    }
  }

  const handleModalRegenerate = () => {
    if (!modalAngle) return
    if (modalMode === 'caption') void runCaptionGeneration(modalAngle, true)
    else                          void runScriptGeneration(modalAngle, true)
  }

  // ── Hook Lab ───────────────────────────────────────────────────────────
  const handleOpenHookLab = () => {
    setHookLabError(null)
    setHookLabOpen(true)
    if (!result?.hookLabOutput) void runHookLabGeneration(false)
  }

  const runHookLabGeneration = async (isRetry: boolean) => {
    if (!result) return
    setHookLabGenerating(true)
    setHookLabError(null)
    try {
      const output = await generateHookLab(result)
      setResult((prev) => prev ? { ...prev, hookLabOutput: output } : prev)
      sessionApi.forceSave()
      if (isRetry) addToast('Đã tạo lại 30 hook', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setHookLabError(msg)
    } finally {
      setHookLabGenerating(false)
    }
  }

  // ── Funnel ─────────────────────────────────────────────────────────────
  const handleOpenFunnel = () => {
    setFunnelError(null)
    setFunnelOpen(true)
    if (!result?.funnelOutput) void runFunnelGeneration(false)
  }

  const runFunnelGeneration = async (isRetry: boolean) => {
    if (!result) return
    setFunnelGenerating(true)
    setFunnelError(null)
    try {
      const output = await generateFunnel(result)
      setResult((prev) => prev ? { ...prev, funnelOutput: output } : prev)
      sessionApi.forceSave()
      if (isRetry) addToast('Đã tạo lại phễu', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setFunnelError(msg)
    } finally {
      setFunnelGenerating(false)
    }
  }

  // ── COC Multiplier ─────────────────────────────────────────────────────
  const handleOpenCoc = () => {
    setCocError(null)
    setCocOpen(true)
    // Don't auto-generate — user provides pillar text first
  }

  const runCocGeneration = async (pillarText: string) => {
    if (!result) return
    setCocGenerating(true)
    setCocError(null)
    try {
      const output = await generateCoc(result, pillarText)
      setResult((prev) => prev ? { ...prev, cocOutput: output } : prev)
      sessionApi.forceSave()
      addToast(`Đã tạo ${output.micros.length} micro-content`, 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setCocError(msg)
    } finally {
      setCocGenerating(false)
    }
  }

  // ── Long-Form Sales Letter ─────────────────────────────────────────────
  const handleOpenSalesLetter = () => {
    setSalesLetterError(null)
    setSalesLetterOpen(true)
  }

  const runSalesLetterGeneration = async (length: SalesLetterLength, focusAngle: ContentAngle | null) => {
    if (!result) return
    setSalesLetterGenerating(true)
    setSalesLetterError(null)
    try {
      const output = await generateSalesLetter(result, length, focusAngle)
      setResult((prev) => prev ? { ...prev, salesLetterOutput: output } : prev)
      sessionApi.forceSave()
      addToast(`Đã tạo sales letter ${output.wordCountVi} từ`, 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSalesLetterError(msg)
    } finally {
      setSalesLetterGenerating(false)
    }
  }

  // ── Multi-Angle Ad Pack ────────────────────────────────────────────────
  const handleOpenMultiAngle = () => {
    setMultiAngleError(null)
    setMultiAngleOpen(true)
    if (!result?.multiAngleOutput) void runMultiAngleGeneration()
  }

  const runMultiAngleGeneration = async () => {
    if (!result) return
    setMultiAngleGenerating(true)
    setMultiAngleError(null)
    try {
      const output = await generateMultiAngle(result)
      setResult((prev) => prev ? { ...prev, multiAngleOutput: output } : prev)
      sessionApi.forceSave()
      addToast(`Đã tạo ${output.ads.length} ads`, 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMultiAngleError(msg)
    } finally {
      setMultiAngleGenerating(false)
    }
  }

  const cachedModalOutput = (() => {
    if (!modalAngle || !result) return null
    const slot = result.angleOutputs?.[modalAngle.id]
    if (!slot) return null
    return modalMode === 'caption' ? slot.caption ?? null : slot.script ?? null
  })()

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
          pricing={pricing}
          onPricingChange={setPricing}
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
          onRegenerate={handleRegenerateBrief}
          onSave={handleSave}
          onOpenCaption={handleOpenCaption}
          onOpenScript={handleOpenScript}
          onOpenHookLab={handleOpenHookLab}
          onOpenFunnel={handleOpenFunnel}
          onOpenCoc={handleOpenCoc}
          onOpenSalesLetter={handleOpenSalesLetter}
          onOpenMultiAngle={handleOpenMultiAngle}
        />
      </div>

      <AngleOutputModal
        open={modalOpen}
        mode={modalMode}
        angle={modalAngle}
        cachedOutput={cachedModalOutput}
        isGenerating={modalGenerating}
        error={modalError}
        onClose={() => setModalOpen(false)}
        onRegenerate={handleModalRegenerate}
      />

      <HookLabModal
        open={hookLabOpen}
        productName={result?.productName ?? ''}
        cachedOutput={result?.hookLabOutput ?? null}
        isGenerating={hookLabGenerating}
        error={hookLabError}
        onClose={() => setHookLabOpen(false)}
        onRegenerate={() => void runHookLabGeneration(true)}
      />

      <FunnelModal
        open={funnelOpen}
        productName={result?.productName ?? ''}
        cachedOutput={result?.funnelOutput ?? null}
        isGenerating={funnelGenerating}
        error={funnelError}
        onClose={() => setFunnelOpen(false)}
        onRegenerate={() => void runFunnelGeneration(true)}
      />

      <CocModal
        open={cocOpen}
        result={result}
        cachedOutput={result?.cocOutput ?? null}
        isGenerating={cocGenerating}
        error={cocError}
        onClose={() => setCocOpen(false)}
        onGenerate={(pillarText) => void runCocGeneration(pillarText)}
      />

      <SalesLetterModal
        open={salesLetterOpen}
        result={result}
        cachedOutput={result?.salesLetterOutput ?? null}
        isGenerating={salesLetterGenerating}
        error={salesLetterError}
        onClose={() => setSalesLetterOpen(false)}
        onGenerate={(length, angle) => void runSalesLetterGeneration(length, angle)}
      />

      <MultiAngleModal
        open={multiAngleOpen}
        result={result}
        cachedOutput={result?.multiAngleOutput ?? null}
        isGenerating={multiAngleGenerating}
        error={multiAngleError}
        onClose={() => setMultiAngleOpen(false)}
        onGenerate={() => void runMultiAngleGeneration()}
      />
    </div>
  )
}
