// ── VideoBuilderV2 — AI Director Pipeline (BETA) ─────────────────────────────
// New pipeline architecture targeting consistent face + product across all
// B-Roll scenes. Replaces independent txt2img scene generation with a
// Master Frame → derived variations workflow.
//
// MODULE 1 (this file): Master Frame Workflow
//   ├─ input          : pick avatar + product + script
//   ├─ identity-extract: Gemini Vision describes avatar + product (locked)
//   ├─ master-frame   : gen + user approves canonical reference frame
//   └─ next phases    : will be filled in by modules 2-5 in future commits
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react'
import { Sparkles, FlaskConical, Package, UserRound, FileText, ChevronRight, Loader2, Info, ArrowLeft, Code2, BarChart3 } from 'lucide-react'
import { useAppStore } from '../../../stores/appStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useAssetUrl } from '../../../hooks/useAssetUrl'
import BankPicker from '../../../components/BankPicker'
import type { Model, Product } from '../../../stores/types'
import type { V2PipelineState, CompiledPrompt } from './types'
import { createEmptyV2State } from './types'
import { extractIdentityPack } from './services/masterFrame'
import { generateStoryboard, computeSceneCount } from './services/sceneBlueprint'
import { defaultVisualStyleDna, computeConsistencyConfig } from './types'
import type { SceneBlueprint, DiversityReport } from './types'
import ConsistencySlider from './components/ConsistencySlider'
import MasterFrameJobStepper from './components/MasterFrameJobStepper'
import AnalyticsPanel from './components/AnalyticsPanel'
import SceneGenGrid from './components/SceneGenGrid'
import VideoGenGrid from './components/VideoGenGrid'
import TimelinePlanningView from './components/TimelinePlanningView'
import TimelineRenderGrid from './components/TimelineRenderGrid'
import { useMasterFrameJobStore } from './stores/masterFrameJobStore'
import { useSceneGenJobStore } from './stores/sceneGenJobStore'
import { useVideoGenJobStore } from './stores/videoGenJobStore'
import { useTimelineRenderJobStore } from './stores/timelineRenderJobStore'
import { startMasterFrameJob, clearMasterFrameJob } from './services/masterFrameJobRunner'
import { startSceneGenQueue, regenerateScene, cancelSceneGenQueue } from './services/sceneGenJobRunner'
import { runVideoQueue, retrySingleVideoClip, buildVideoQueueFromScenes } from './services/videoGenJobRunner'
// Z23: editorial planning step — pure logic, NO Kling
import { buildEditorialBlueprint } from './services/editorialIntelligence'
import { estimateVoiceDuration } from './services/timelineAssembler'
import { buildTimelineRenderJob } from './services/timelineRenderer'
// Z26: incremental render — store-wired entry points
import { startTimelineRender, renderSingleCut } from './services/timelineRendererJobRunner'
import MasterFrameApproval from './components/MasterFrameApproval'
import PromptCompilerDebugPanel from './components/PromptCompilerDebugPanel'
import StoryboardEditor from './components/StoryboardEditor'

// Compute which phase pills the user can click — a phase is reachable
// either because we're currently on it OR because its data is already
// populated (re-entry should restore the cached view, not regenerate).
function computeReachablePhases(
  state: V2PipelineState,
  hasSceneJob: boolean,
  hasVideoJob: boolean,
): ReadonlySet<V2PipelineState['phase']> {
  const reachable = new Set<V2PipelineState['phase']>(['input', state.phase])
  if (state.identityPack) {
    reachable.add('identity-extract')
    reachable.add('master-frame')
  }
  if (state.masterFrame.candidates.length > 0) {
    reachable.add('master-frame')
  }
  if (state.blueprints.length > 0) {
    reachable.add('blueprint')
  }
  if (hasSceneJob || state.blueprints.length > 0) {
    reachable.add('scene-gen')
  }
  // Z23: timeline-planning reachable once we have an editorial blueprint
  // (planning is local — no remote job needed). Also reachable if user
  // has any scene-gen output (so they can build planning from approved
  // masters even after refresh).
  if (state.editorialBlueprint || hasSceneJob) {
    reachable.add('timeline-planning')
  }
  // video-gen: reachable once the timeline render job is built OR a video
  // job already exists (resumed from localStorage).
  if (hasVideoJob || state.timelineRenderJob) {
    reachable.add('video-gen')
  }
  return reachable
}

// ── Phase header (top breadcrumb) ───────────────────────────────────────────
// Each phase pill is a NAVIGATION button — clicking any phase that has
// cached data jumps the workspace back to that view WITHOUT regenerating.
// Phases that don't have data yet render as disabled (visual only).
function PhaseHeader({
  phase, reachable, onPhaseClick,
}: {
  phase: V2PipelineState['phase']
  reachable: ReadonlySet<V2PipelineState['phase']>
  onPhaseClick: (id: V2PipelineState['phase']) => void
}) {
  const steps: { id: V2PipelineState['phase']; label: string; num: number }[] = [
    { id: 'input',            label: 'Chọn input',           num: 1 },
    { id: 'identity-extract', label: 'Phân tích identity',  num: 2 },
    { id: 'master-frame',     label: 'Master Frame',         num: 3 },
    { id: 'blueprint',        label: 'Storyboard',           num: 4 },
    { id: 'scene-gen',        label: 'Gen B-Roll',           num: 5 },
    { id: 'timeline-planning',label: 'Coverage & Timeline',  num: 6 },
    { id: 'video-gen',        label: 'Render Clips',         num: 7 },
    { id: 'video-voice',      label: 'Voice + Concat',       num: 8 },
  ]
  const activeIdx = steps.findIndex((s) => s.id === phase)

  return (
    <div className="flex items-center gap-1 overflow-x-auto px-1">
      {steps.map((s, i) => {
        const isActive = i === activeIdx
        const isPast = i < activeIdx
        const isReachable = reachable.has(s.id)
        const baseCls = isActive
          ? 'bg-violet-600 text-white'
          : isPast
            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            : isReachable
              ? 'bg-black/[0.04] text-gray-600 hover:bg-violet-50 hover:text-violet-700'
              : 'bg-black/[0.04] text-gray-400 cursor-not-allowed'
        const dotCls = isActive
          ? 'bg-white text-violet-600'
          : isPast ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-white'

        return (
          <div key={s.id} className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => { if (isReachable) onPhaseClick(s.id) }}
              disabled={!isReachable}
              title={
                isActive
                  ? `Đang ở: ${s.label}`
                  : isReachable
                    ? `Quay lại "${s.label}" (giữ nguyên data, không regenerate)`
                    : `${s.label} chưa có dữ liệu — hoàn thành các bước trước`
              }
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${baseCls}`}
            >
              <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${dotCls}`}>
                {isPast ? '✓' : s.num}
              </span>
              <span>{s.label}</span>
            </button>
            {i < steps.length - 1 && <ChevronRight className="h-3 w-3 shrink-0 text-gray-300" />}
          </div>
        )
      })}
    </div>
  )
}

// ── Input picker tile ────────────────────────────────────────────────────────
function InputPickerTile({
  imageUrl, label, hint, icon: Icon, onPick, onClear,
}: {
  imageUrl: string | null | undefined
  label: string
  hint: string
  icon: React.ElementType
  onPick: () => void
  onClear?: () => void
}) {
  const resolvedUrl = useAssetUrl(imageUrl ?? undefined)
  const display = imageUrl?.startsWith('http') ? imageUrl : resolvedUrl

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
        {imageUrl && onClear && (
          <button onClick={onClear} className="text-[10px] text-gray-400 hover:text-red-500">Bỏ chọn</button>
        )}
      </div>
      <button
        onClick={onPick}
        className="group aspect-square w-full overflow-hidden rounded-lg border border-dashed border-black/10 bg-black/[0.02] transition-colors hover:border-violet-400 hover:bg-violet-50/30"
      >
        {display ? (
          <img src={display} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-300 group-hover:text-violet-400">
            <Icon className="h-8 w-8" strokeWidth={1.2} />
            <span className="text-[11px] font-semibold">Chọn từ Project</span>
          </div>
        )}
      </button>
      <p className="text-[10px] text-gray-400">{hint}</p>
    </div>
  )
}

interface Props {
  /** Called when user clicks "Switch về Pipeline v1" — parent toggles version */
  onSwitchToV1: () => void
}

export default function VideoBuilderV2({ onSwitchToV1 }: Props) {
  const [state, setState] = useState<V2PipelineState>(createEmptyV2State)
  const [pickerMode, setPickerMode] = useState<'avatar' | 'product' | 'script' | null>(null)
  const [identityProgress, setIdentityProgress] = useState<string>('')
  /** Last compiled prompt — shown in debug panel. Reflects job's finalCompiled. */
  const [lastCompiled, _setLastCompiled] = useState<CompiledPrompt | null>(null)
  const [debugOpen, setDebugOpen] = useState(false)
  // setLastCompiled is reserved for future use when scene-gen module 6 wires
  // its own debug panel calls; the job runner stores the compiled prompt
  // directly on the finalized job object instead. Suppress unused-var warning:
  void _setLastCompiled
  /** Module 3 storyboard state */
  const [diversityReport, setDiversityReport] = useState<DiversityReport | null>(null)
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false)
  /** Module 4 QC state — OFF by default (speed-first mode). User opts in for slow strict QC. */
  const [qcEnabled, setQcEnabled] = useState(false)
  const [qcProgress, setQcProgress] = useState<{ attempt: number; status: string; elapsedSec?: number } | null>(null)
  /** Task 8 — analytics panel modal */
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const cancelledRef = useRef(false)
  /** Wallclock when current Master Frame gen started — used to show "stuck N s" warning */
  const genStartRef = useRef<number | null>(null)

  const kieApiKey = useSettingsStore((s) => s.kieApiKey)
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const addToast = useAppStore((s) => s.addToast)

  useEffect(() => () => { cancelledRef.current = true }, [])

  // ── Module 6: Resume in-flight job from localStorage on mount ───────────
  // If a previous session was interrupted (refresh / crash), the job state is
  // in localStorage. We restore it so the user sees their last progress
  // instead of starting from scratch.
  const activeJob = useMasterFrameJobStore((s) => s.job)
  const tryResumeFromStorage = useMasterFrameJobStore((s) => s.tryResumeFromStorage)
  // Also try to resume an in-flight scene-gen queue
  const tryResumeSceneQueue = useSceneGenJobStore((s) => s.tryResumeFromStorage)
  useEffect(() => {
    const resumedMaster = tryResumeFromStorage()
    if (resumedMaster) {
      addToast('Đã khôi phục Master Frame job đang chạy từ phiên trước', 'info')
      setState((s) => s.phase === 'input' ? { ...s, phase: 'master-frame' } : s)
    }
    // Resume scene-gen queue if any
    const resumedScenes = tryResumeSceneQueue()
    if (resumedScenes) {
      addToast('Đã khôi phục queue Gen B-Roll đang dở từ phiên trước (đã pause)', 'info')
      setState((s) => ({ ...s, phase: 'scene-gen' }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When the job runner finalizes with 'completed', sync the result into the
  // local v2 state so existing MasterFrameApproval grid can show it.
  useEffect(() => {
    if (activeJob?.status === 'completed' && activeJob.finalImageUrl) {
      // Check if already in candidates (avoid double-add on re-render)
      const alreadyAdded = state.masterFrame.candidates.some((c) => c.imageUrl === activeJob.finalImageUrl)
      if (!alreadyAdded) {
        setState((s) => ({
          ...s,
          masterFrame: {
            ...s.masterFrame,
            candidates: [...s.masterFrame.candidates, {
              imageUrl: activeJob.finalImageUrl!,
              promptUsed: activeJob.finalCompiled?.final ?? '',
              createdAt: activeJob.updatedAt,
              status: 'pending-approval',
              qc: activeJob.finalQc ?? null,
            }],
            isGenerating: false,
          },
        }))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJob?.status, activeJob?.finalImageUrl])

  // Tick the elapsed-seconds counter every second while generating, so user sees
  // "stuck for 45s" rather than just a spinner with no time info.
  useEffect(() => {
    if (!state.masterFrame.isGenerating || !genStartRef.current) return
    const id = setInterval(() => {
      if (!genStartRef.current) return
      const elapsedSec = Math.round((Date.now() - genStartRef.current) / 1000)
      setQcProgress((prev) => prev ? { ...prev, elapsedSec } : { attempt: 1, status: 'Đang xử lý...', elapsedSec })
    }, 1000)
    return () => clearInterval(id)
  }, [state.masterFrame.isGenerating])

  const handleCancelGen = () => {
    cancelledRef.current = true
    genStartRef.current = null
    setState((s) => ({
      ...s,
      masterFrame: { ...s.masterFrame, isGenerating: false, error: 'Đã hủy bởi user' },
    }))
    setQcProgress(null)
    addToast('Đã hủy task. KIE backend có thể vẫn xử lý — bạn không bị trừ thêm credit cho task bị bỏ.', 'info')
    // Reset cancellation flag after a beat so subsequent gens work
    setTimeout(() => { cancelledRef.current = false }, 100)
  }

  // ── Module 5: Consistency slider handler ──────────────────────────────────
  // Updating strength recomputes the entire ConsistencyConfig (threshold + retries)
  // which propagates to prompt compiler, QC engine, retry orchestrator.
  const handleStrengthChange = (newStrength: number) => {
    setState((s) => ({ ...s, consistency: computeConsistencyConfig(newStrength) }))
  }

  // ── Handlers: input pickers ───────────────────────────────────────────────
  const handlePickAvatar = (item: unknown) => {
    setState((s) => ({ ...s, inputs: { ...s.inputs, avatar: item as Model } }))
    setPickerMode(null)
  }
  const handlePickProduct = (item: unknown) => {
    setState((s) => ({ ...s, inputs: { ...s.inputs, product: item as Product } }))
    setPickerMode(null)
  }
  const handlePickScript = (item: unknown) => {
    const sc = item as { scriptText: string }
    setState((s) => ({ ...s, inputs: { ...s.inputs, script: sc.scriptText ?? '' } }))
    setPickerMode(null)
  }

  // ── Phase 1: extract identity pack via Gemini Vision ──────────────────────
  const handleStartIdentityExtract = async () => {
    if (!state.inputs.avatar || !state.inputs.product) {
      addToast('Cần chọn cả Avatar và Sản phẩm', 'error')
      return
    }
    if (!geminiApiKey) {
      addToast('Cần Gemini API key trong Cài đặt', 'error')
      return
    }

    setState((s) => ({ ...s, phase: 'identity-extract' }))
    setIdentityProgress('Phân tích avatar + sản phẩm...')
    try {
      const identity = await extractIdentityPack({
        avatar: state.inputs.avatar,
        product: state.inputs.product,
        geminiKey: geminiApiKey,
      })
      if (cancelledRef.current) return
      setState((s) => ({ ...s, identityPack: identity, phase: 'master-frame' }))
      addToast('✓ Đã trích xuất identity pack — đang tạo Master Frame (async job)...')
      // Auto-start first master frame generation via the new job runner
      handleGenerateMasterFrameViaJob(identity)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Phân tích identity thất bại: ${msg.slice(0, 100)}`, 'error')
      setState((s) => ({ ...s, phase: 'input' }))
    } finally {
      setIdentityProgress('')
    }
  }

  // ── New job-based gen (Module 6 async architecture) ───────────────────────
  // Returns jobId immediately; the pipeline runs as a detached promise that
  // updates masterFrameJobStore as it progresses. UI subscribes via the store.
  const handleGenerateMasterFrameViaJob = (identityOverride?: typeof state.identityPack) => {
    const identity = identityOverride ?? state.identityPack
    if (!state.inputs.avatar || !state.inputs.product) return
    if (!kieApiKey) { addToast('Cần KIE.ai API key', 'error'); return }
    if (!geminiApiKey) { addToast('Cần Gemini API key', 'error'); return }

    // Resolve URLs (if identity not yet extracted, use raw bank refs as URLs)
    const avatarImageUrl = identity?.avatarImageUrl ?? state.inputs.avatar.characterImage
    const productImageUrl = identity?.productImageUrl ?? state.inputs.product.productImage

    startMasterFrameJob({
      kieApiKey,
      geminiKey: geminiApiKey,
      inputs: {
        avatarId: state.inputs.avatar.id,
        productId: state.inputs.product.id,
        consistencyStrength: state.consistency.strength,
        qcEnabled,
        avatarImageUrl,
        productImageUrl,
        productName: state.inputs.product.productName,
      },
    })
    addToast('✓ Job đã bắt đầu — chạy ở background', 'info')
  }

  // (Legacy synchronous handleGenerateMasterFrame removed — replaced by
  //  handleGenerateMasterFrameViaJob which uses the async job runner.)

  const handleApproveFrame = (idx: number) => {
    setState((s) => ({
      ...s,
      masterFrame: {
        ...s.masterFrame,
        approvedIdx: idx,
        candidates: s.masterFrame.candidates.map((c, i) => ({
          ...c,
          status: i === idx ? 'approved' : 'pending-approval',
        })),
      },
    }))
  }

  const handleRejectAll = () => {
    setState((s) => ({
      ...s,
      masterFrame: { candidates: [], approvedIdx: -1, isGenerating: false, error: null },
      phase: 'input',
    }))
  }

  const handleContinueAfterMasterFrame = () => {
    setState((s) => ({ ...s, phase: 'blueprint' }))
    // Auto-trigger first storyboard generation
    void handleGenerateStoryboard()
  }

  // ── Module 3: storyboard JSON gen via Gemini ─────────────────────────────
  const handleGenerateStoryboard = async () => {
    if (!state.identityPack || !state.inputs.product || !state.inputs.script.trim()) {
      addToast('Thiếu identity pack hoặc kịch bản', 'error')
      return
    }
    if (!geminiApiKey) {
      addToast('Cần Gemini API key trong Cài đặt', 'error')
      return
    }
    setIsGeneratingStoryboard(true)
    // Z12: dynamic scene count — scale with script length.
    // clamp(ceil(words/35), 8, 24). A 60-word script → 8 scenes; 500 → 15;
    // 800 → 23; very long → capped at 24.
    const dynamicSceneCount = computeSceneCount(state.inputs.script)
    console.log(
      `[CINEMATIC] dynamicSceneCount=${dynamicSceneCount} ` +
      `script.words=${state.inputs.script.trim().split(/\s+/).filter(Boolean).length}`,
    )
    try {
      const { blueprints, diversity, recoveredAtStage } = await generateStoryboard({
        geminiKey: geminiApiKey,
        script: state.inputs.script,
        identity: state.identityPack,
        productName: state.inputs.product.productName,
        dna: defaultVisualStyleDna(),
        numScenes: dynamicSceneCount,
        onStageChange: (stage, reason) => {
          // Spec Task 10: stage-specific Vietnamese toasts
          if (stage === 'attempt-1') {
            // Initial — no toast needed (just the "đang tạo storyboard" loader)
            return
          }
          if (stage === 'reprompt-2') {
            addToast(`🔧 JSON lỗi — đang tự sửa format (retry lần 2)...${reason ? '\n' + reason : ''}`, 'info')
          } else if (stage === 'safe-mode-3') {
            addToast(`⚠️ JSON vẫn lỗi sau 2 lần — chuyển sang SAFE-MODE (prompt đơn giản, tin cậy cao)`, 'info')
          }
        },
      })
      if (cancelledRef.current) return
      setState((s) => ({ ...s, blueprints }))
      setDiversityReport(diversity)
      // Stage-specific success message
      if (recoveredAtStage === 'safe-mode-3') {
        addToast(`✓ Đã tạo storyboard ở SAFE-MODE — nội dung đơn giản hơn nhưng đầy đủ`, 'info')
      } else if (recoveredAtStage === 'reprompt-2') {
        addToast(`✓ Đã tạo storyboard (sửa được JSON ở lần 2)`, 'info')
      } else if (diversity.passed) {
        addToast(`✓ Đã tạo storyboard ${blueprints.length} cảnh (diversity OK)`)
      } else {
        addToast(`Đã tạo storyboard nhưng diversity cảnh báo — review trước khi gen ảnh`, 'info')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Friendly Vietnamese error — show retry count + suggestion
      if (msg.includes('JSON') || msg.includes('json') || msg.includes('3 lần')) {
        addToast('🔴 AI không trả được JSON hợp lệ sau 3 lần thử (normal → reprompt → safe-mode). Vui lòng nhấn "Gen lại storyboard" sau ~10s. Mở DevTools Console (F12) xem [parseStoryboardResponse] log chi tiết.', 'error')
      } else {
        addToast(`Tạo storyboard thất bại: ${msg.slice(0, 120)}`, 'error')
      }
    } finally {
      setIsGeneratingStoryboard(false)
    }
  }

  const handleUpdateScene = (idx: number, patch: Partial<SceneBlueprint>) => {
    setState((s) => ({
      ...s,
      blueprints: s.blueprints.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
    }))
  }

  const handleBackToMasterFrame = () => {
    setState((s) => ({ ...s, phase: 'master-frame' }))
  }

  // ── Module 7: Scene Generation Engine — start the queue ────────────────
  // Z9: Fast Mode default ON — skips QC retry, parallel-friendly, hits the
  // <90s-for-all-scenes target. User can flip to HQ Mode on the toggle.
  const [lowCostMode, setLowCostMode] = useState(true)

  const handleContinueAfterStoryboard = () => {
    if (!state.identityPack || !state.inputs.product) return
    if (state.blueprints.length === 0) {
      addToast('Chưa có storyboard — gen storyboard trước', 'error')
      return
    }
    // Need an approved master frame to derive scenes from
    const approvedFrame = state.masterFrame.candidates[state.masterFrame.approvedIdx]
    if (!approvedFrame) {
      addToast('Chưa có Master Frame đã duyệt — quay lại bước trước', 'error')
      return
    }
    if (!kieApiKey || !geminiApiKey) {
      addToast('Thiếu API key (KIE / Gemini) trong Cài đặt', 'error')
      return
    }

    setState((s) => ({ ...s, phase: 'scene-gen' }))
    startSceneGenQueue({
      kieApiKey,
      geminiKey: geminiApiKey,
      blueprints: state.blueprints,
      masterFrameUrl: approvedFrame.imageUrl,
      identity: state.identityPack,
      productName: state.inputs.product.productName,
      consistency: state.consistency,
      dna: defaultVisualStyleDna(),
      lowCostMode,
      // Z9: parallel worker pool — 3 scenes in flight at once. KIE handles this
      // comfortably; higher risks 429 rate-limits on the image-edit endpoint.
      concurrency: 3,
    })
    addToast(
      `⚡ Bắt đầu render ${state.blueprints.length} cảnh — ${lowCostMode ? 'Fast Mode' : 'HQ Mode'} · parallel × 3`,
      'info',
    )
  }

  // ── Scene Gen UI handlers ─────────────────────────────────────────────
  const sceneJob = useSceneGenJobStore((s) => s.job)
  // Z26 — reactive subscription so the grid swap re-renders correctly
  // when the job lands / clears.
  const timelineRenderJobStoreVal = useTimelineRenderJobStore((s) => s.job)
  const patchSceneItem = useSceneGenJobStore((s) => s.patchItem)

  const handleRegenScene = (idx: number) => {
    if (!sceneJob || !state.identityPack || !state.inputs.product) return
    const approvedFrame = state.masterFrame.candidates[state.masterFrame.approvedIdx]
    if (!approvedFrame || !kieApiKey || !geminiApiKey) return
    void regenerateScene(idx, {
      kieApiKey,
      geminiKey: geminiApiKey,
      blueprints: state.blueprints,
      masterFrameUrl: approvedFrame.imageUrl,
      identity: state.identityPack,
      productName: state.inputs.product.productName,
      consistency: state.consistency,
      dna: defaultVisualStyleDna(),
      lowCostMode,
    })
  }

  const handleApproveScene = (idx: number) => patchSceneItem(idx, { status: 'approved' })
  const handleRejectScene  = (idx: number) => patchSceneItem(idx, { status: 'rejected' })

  // ── Video Gen (Kling 3.0) handlers ────────────────────────────────────
  const videoJob = useVideoGenJobStore((s) => s.job)
  const createVideoQueue = useVideoGenJobStore((s) => s.createQueue)
  const videoCancelRef = useRef<AbortController | null>(null)

  /** Map sceneId → SceneBlueprint so the runner can compile per-clip prompts. */
  const blueprintBySceneId = new Map<number, SceneBlueprint>(
    state.blueprints.map((b) => [b.sceneId, b]),
  )

  // ── Z23: NEW planning step — runs editorial brain on approved scenes,
  //         produces EditorialBlueprint + TimelineRenderJob. NO Kling. ────
  const [isBuildingTimeline, setIsBuildingTimeline] = useState(false)

  const handleBuildTimelinePlan = () => {
    if (!sceneJob) return
    const approvedScenes = sceneJob.items
      .filter((it) => it.status === 'approved' && it.imageUrl)
    if (approvedScenes.length === 0) {
      addToast('Chưa có cảnh nào được duyệt — quay lại Gen B-Roll duyệt trước', 'error')
      return
    }

    // Jump to planning phase immediately + show loader
    setIsBuildingTimeline(true)
    setState((s) => ({ ...s, phase: 'timeline-planning' }))

    // Run synchronously — pure logic, no network. Wrap in setTimeout(0)
    // so the loading UI gets a chance to paint first.
    setTimeout(() => {
      try {
        // Voice duration estimate from script (150 wpm Vietnamese/Malay UGC)
        const voiceDurationSec = estimateVoiceDuration(state.inputs.script)

        // Editorial brain — derive coverage + cuts + transitions + motion
        const blueprint = buildEditorialBlueprint(state.blueprints, { voiceDurationSec })

        // Map masterSceneId → approved keyframe asset ref
        const masterKeyframeRefs: Record<number, string> = {}
        for (const it of approvedScenes) {
          if (it.imageUrl) masterKeyframeRefs[it.sceneId] = it.imageUrl
        }

        // Build ready-to-render TimelineRenderJob (still NO Kling call)
        const renderJob = buildTimelineRenderJob(blueprint, {
          masterKeyframeRefs,
          providerLabel: 'Kling 3.0 std / KIE (cut-level)',
          creditPerClip: 70,
        })

        // Z26 — persist into the timelineRenderJobStore. This is the
        // source of truth for the new per-cut grid + survives refreshes
        // (locks/skips persist via localStorage). The legacy state.timelineRenderJob
        // still gets set for any consumer that reads it directly.
        useTimelineRenderJobStore.getState().createJob(renderJob)
        setState((s) => ({
          ...s,
          editorialBlueprint: blueprint,
          timelineRenderJob: renderJob,
        }))
        addToast(
          `✓ Đã build coverage & timeline — ${blueprint.coverageShots.length} shots → ${blueprint.timelineCuts.length} cuts (${(blueprint.estimatedDurationSec ?? 0).toFixed(1)}s)`,
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        addToast(`Build timeline lỗi: ${msg}`, 'error')
        // Bounce back to scene-gen if planning fails
        setState((s) => ({ ...s, phase: 'scene-gen' }))
      } finally {
        setIsBuildingTimeline(false)
      }
    }, 50)
  }

  // ── Z26 — Navigate to render phase WITHOUT auto-rendering. The
  //    TimelineRenderGrid drives all Kling calls per-cut so users can
  //    preview-test 1-3 clips, lock the good ones, and only then bulk-
  //    render the rest. This replaces the old "click → 50 clips burn"
  //    flow that motivated Z26.
  const handleNavigateToRender = () => {
    if (!useTimelineRenderJobStore.getState().job) {
      addToast('Chưa có timeline render job — build planning trước', 'error')
      return
    }
    setState((s) => ({ ...s, phase: 'video-gen' }))
  }

  // ── Z26 — Single-cut render (per-card [Render] / [Rerender] button) ──
  const handleRenderSingleCut = async (cutId: number) => {
    if (!kieApiKey) {
      addToast('Chưa có KIE API key', 'error')
      return
    }
    try {
      await renderSingleCut(cutId, { apiKey: kieApiKey })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Render cut-${cutId} lỗi: ${msg}`, 'error')
    }
  }

  // ── Z26 — Bulk render all PENDING cuts. Locked + skipped are always
  //    excluded (enforced inside startTimelineRender). ─────────────────
  const handleRenderRemainingCuts = async () => {
    if (!kieApiKey) {
      addToast('Chưa có KIE API key', 'error')
      return
    }
    const ctrl = new AbortController()
    videoCancelRef.current = ctrl
    try {
      const result = await startTimelineRender({
        apiKey: kieApiKey,
        concurrency: 2,
        signal: ctrl.signal,
      })
      if (result.done > 0 || result.failed > 0) {
        addToast(
          `✓ Render xong ${result.done} clip${result.failed > 0 ? ` · ${result.failed} lỗi (xem nút "Thử lại lỗi")` : ''}`,
          result.failed > 0 ? 'error' : 'success',
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Bulk render lỗi: ${msg}`, 'error')
    } finally {
      videoCancelRef.current = null
    }
  }

  // ── Z26 — Retry only the FAILED cuts. Same runner as bulk, but with
  //    includeFailed=true and cutIds limited to failed items. ─────────
  const handleRetryFailedCuts = async () => {
    if (!kieApiKey) return
    const job = useTimelineRenderJobStore.getState().job
    if (!job) return
    const failedIds = job.items.filter((it) => it.status === 'failed').map((it) => it.cutId)
    if (failedIds.length === 0) return

    const ctrl = new AbortController()
    videoCancelRef.current = ctrl
    try {
      const result = await startTimelineRender({
        apiKey: kieApiKey,
        cutIds: failedIds,
        includeFailed: true,
        concurrency: 2,
        signal: ctrl.signal,
      })
      addToast(
        `✓ Retry xong ${result.done}/${failedIds.length} clip${result.failed > 0 ? ` · ${result.failed} vẫn lỗi` : ''}`,
        result.failed > 0 ? 'error' : 'success',
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Retry lỗi: ${msg}`, 'error')
    } finally {
      videoCancelRef.current = null
    }
  }

  // ── LEGACY — Z23 cut-level video gen (still used if user comes from
  //    an older flow without a timelineRenderJob in store). ──────────
  const handleStartVideoQueue = async () => {
    if (!sceneJob || !kieApiKey) return
    const approvedScenes = sceneJob.items
      .filter((it) => it.status === 'approved' && it.imageUrl)
      .map((it) => ({ sceneId: it.sceneId, keyframeRef: it.imageUrl! }))

    if (approvedScenes.length === 0) {
      addToast('Chưa có cảnh nào được duyệt — quay lại Gen B-Roll duyệt trước', 'error')
      return
    }

    const job = buildVideoQueueFromScenes(approvedScenes, { durationSec: 5 })
    createVideoQueue(job)
    setState((s) => ({ ...s, phase: 'video-gen' }))

    const ctrl = new AbortController()
    videoCancelRef.current = ctrl
    try {
      await runVideoQueue({
        apiKey: kieApiKey,
        blueprintBySceneId,
        concurrency: 2,
        signal: ctrl.signal,
      })
      addToast('✓ Đã sinh xong toàn bộ video clips')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Sinh video lỗi: ${msg}`, 'error')
    } finally {
      videoCancelRef.current = null
    }
  }
  void handleStartVideoQueue  // kept for back-compat — not wired in Z26 path

  const handleRetryVideoClip = async (idx: number) => {
    if (!kieApiKey) return
    try {
      await retrySingleVideoClip(idx, kieApiKey, blueprintBySceneId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Sinh lại clip lỗi: ${msg}`, 'error')
    }
  }

  const handleCancelVideoQueue = () => {
    videoCancelRef.current?.abort()
    useVideoGenJobStore.getState().setQueueState({ isRunning: false, isPaused: true })
  }

  const canStart = !!state.inputs.avatar && !!state.inputs.product && !!state.inputs.script.trim()

  // ── Render by phase ───────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header — beta banner + switch to v1 + phase breadcrumb */}
      <div className="shrink-0 border-b border-black/8 bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-3 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            <div>
              <h1 className="text-sm font-bold">UGC Builder v2 — AI Director (BETA)</h1>
              <p className="text-[11px] text-white/70">Pipeline mới: Master Frame → derived scenes · giảm drift, tăng nhất quán</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAnalyticsOpen(true)}
              title="Tổng hợp usable rate / fail reasons / best strength từ các job đã chạy"
              className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <BarChart3 className="h-3.5 w-3.5" /> Analytics
            </button>
            <button
              onClick={() => setDebugOpen(true)}
              disabled={!lastCompiled}
              title={lastCompiled ? 'Xem prompt cuối đã compile (5 sections)' : 'Chưa có prompt nào — tạo Master Frame trước'}
              className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm transition-colors hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Code2 className="h-3.5 w-3.5" /> Prompt Compiler v2
            </button>
            <button
              onClick={onSwitchToV1}
              className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm hover:bg-white/25"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Quay về v1 (stable)
            </button>
          </div>
        </div>
      </div>

      {/* Phase breadcrumb — clickable navigation; revisiting a phase
          restores its cached state without regenerating anything. */}
      <div className="shrink-0 border-b border-black/8 bg-white px-6 py-2.5">
        <PhaseHeader
          phase={state.phase}
          reachable={computeReachablePhases(state, !!sceneJob, !!videoJob)}
          onPhaseClick={(id) => setState((s) => (s.phase === id ? s : { ...s, phase: id }))}
        />
      </div>

      {/* Body — switches by phase */}
      <div className="flex-1 overflow-hidden">
        {/* PHASE: INPUT */}
        {state.phase === 'input' && (
          <div className="h-full overflow-y-auto p-6">
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
              <div className="text-xs text-violet-700">
                <p className="font-semibold">Bước 1: Chọn input</p>
                <p>Chọn avatar + sản phẩm + kịch bản đã lưu trong Project. Pipeline v2 sẽ tạo 1 "Master Frame" làm khuôn mẫu identity cho toàn bộ video.</p>
              </div>
            </div>

            {/* Module 5 — Consistency slider (full debug variant on input page) */}
            <div className="mb-4">
              <ConsistencySlider
                strength={state.consistency.strength}
                onChange={handleStrengthChange}
                variant="full"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <InputPickerTile
                imageUrl={state.inputs.avatar?.characterImage}
                label="Avatar AI"
                hint={state.inputs.avatar?.name ?? 'Chưa chọn avatar'}
                icon={UserRound}
                onPick={() => setPickerMode('avatar')}
                onClear={() => setState((s) => ({ ...s, inputs: { ...s.inputs, avatar: null } }))}
              />
              <InputPickerTile
                imageUrl={state.inputs.product?.productImage}
                label="Sản phẩm"
                hint={state.inputs.product?.productName ?? 'Chưa chọn sản phẩm'}
                icon={Package}
                onPick={() => setPickerMode('product')}
                onClear={() => setState((s) => ({ ...s, inputs: { ...s.inputs, product: null } }))}
              />
              <div className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white p-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Kịch bản</p>
                <button
                  onClick={() => setPickerMode('script')}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-black/10 bg-black/[0.02] text-gray-300 transition-colors hover:border-violet-400 hover:bg-violet-50/30 hover:text-violet-400"
                >
                  <FileText className="h-8 w-8" strokeWidth={1.2} />
                  <span className="text-[11px] font-semibold">Chọn kịch bản</span>
                </button>
                <p className="text-[10px] text-gray-400 line-clamp-2">{state.inputs.script ? state.inputs.script.slice(0, 80) + '...' : 'Chưa chọn kịch bản'}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleStartIdentityExtract}
                disabled={!canStart}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-purple-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:from-violet-700 hover:to-purple-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" /> Bắt đầu phân tích & tạo Master Frame
              </button>
            </div>
          </div>
        )}

        {/* PHASE: IDENTITY EXTRACT */}
        {state.phase === 'identity-extract' && (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
            <h2 className="text-base font-bold text-gray-800">Đang phân tích avatar + sản phẩm</h2>
            <p className="max-w-md text-xs text-gray-500">
              Gemini Vision đang trích xuất mô tả chính xác về khuôn mặt + bao bì sản phẩm để khóa identity cho toàn bộ pipeline.
            </p>
            {identityProgress && <p className="text-[11px] text-violet-600">{identityProgress}</p>}
          </div>
        )}

        {/* PHASE: MASTER FRAME — stepper overlay when job running, then approval grid */}
        {state.phase === 'master-frame' && (
          <div className="flex h-full flex-col overflow-hidden">
            {/* Show stepper if there's an active or recently-finished job */}
            {activeJob && (activeJob.status !== 'completed' || state.masterFrame.candidates.length === 0) && (
              <div className="shrink-0 border-b border-black/8 bg-gradient-to-r from-violet-50/50 to-pink-50/50 p-4">
                <MasterFrameJobStepper
                  onCompleted={() => {
                    // After job completes, optionally clear it so user can start fresh
                    // (the candidate already got pushed into local state via the useEffect above)
                  }}
                />
                {activeJob.status === 'completed' && (
                  <button
                    onClick={() => clearMasterFrameJob()}
                    className="mt-2 text-[10px] text-violet-600 hover:text-violet-800 underline"
                  >
                    Đóng panel job
                  </button>
                )}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-hidden">
              <MasterFrameApproval
                state={state.masterFrame}
                identity={state.identityPack}
                onGenerateMore={() => handleGenerateMasterFrameViaJob()}
                onApprove={handleApproveFrame}
                onReject={handleRejectAll}
                onContinue={handleContinueAfterMasterFrame}
                qcEnabled={qcEnabled}
                onQcEnabledChange={setQcEnabled}
                qcProgress={qcProgress}
                onCancel={handleCancelGen}
                consistencyStrength={state.consistency.strength}
                onConsistencyChange={handleStrengthChange}
              />
            </div>
          </div>
        )}

        {/* PHASE: BLUEPRINT (Module 3 — Scene Blueprint JSON editor) */}
        {state.phase === 'blueprint' && (
          <StoryboardEditor
            blueprints={state.blueprints}
            diversity={diversityReport}
            isGenerating={isGeneratingStoryboard}
            onRegenerate={() => void handleGenerateStoryboard()}
            onUpdateScene={handleUpdateScene}
            onBack={handleBackToMasterFrame}
            onContinue={handleContinueAfterStoryboard}
            lowCostMode={lowCostMode}
            onLowCostModeChange={setLowCostMode}
            script={state.inputs.script}
          />
        )}

        {/* PHASE: SCENE-GEN — Module 7 — real sequential img2img queue */}
        {state.phase === 'scene-gen' && (
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-hidden">
              <SceneGenGrid
                onRegenerate={handleRegenScene}
                onApprove={handleApproveScene}
                onReject={handleRejectScene}
                onCancelQueue={cancelSceneGenQueue}
              />
            </div>
            {/* Z23: "Build Coverage & Timeline" CTA — pure LOCAL planning,
                no Kling call. Replaces the old direct "Sinh video clip". */}
            {sceneJob && sceneJob.items.some((it) => it.status === 'approved' && it.imageUrl) && (
              <div className="shrink-0 border-t border-black/8 bg-gradient-to-r from-violet-50 to-pink-50 px-6 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">
                      🧠 Bước tiếp theo: Coverage & Timeline planning ({sceneJob.items.filter((i) => i.status === 'approved' && i.imageUrl).length} masters đã duyệt)
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Editorial brain derive 25-40 coverage shots + 20-35 timeline cuts + motion + transitions. ⚡ Local · không gọi Kling · không tốn credit.
                    </p>
                  </div>
                  <button
                    onClick={handleBuildTimelinePlan}
                    className="flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-5 py-2 text-sm font-bold text-white shadow-md transition-colors hover:from-violet-700 hover:to-pink-700"
                  >
                    🧠 Build Coverage & Timeline
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Z23 — PHASE: TIMELINE-PLANNING (pure editorial brain, NO Kling) */}
        {state.phase === 'timeline-planning' && (
          <TimelinePlanningView
            blueprint={state.editorialBlueprint ?? null}
            renderJob={state.timelineRenderJob ?? null}
            isBuilding={isBuildingTimeline}
            onBack={() => setState((s) => ({ ...s, phase: 'scene-gen' }))}
            onRenderClips={handleNavigateToRender}
            voiceDurationSec={estimateVoiceDuration(state.inputs.script)}
          />
        )}

        {/* PHASE: VIDEO-GEN — Z26 per-cut render UX (preview-first + lock).
            Falls back to legacy VideoGenGrid only if no timelineRenderJob
            exists in the store (pre-Z23 flow). */}
        {state.phase === 'video-gen' && (
          timelineRenderJobStoreVal ? (
            <TimelineRenderGrid
              creditPerClip={state.timelineRenderJob?.creditPerClip ?? 70}
              onRenderCut={handleRenderSingleCut}
              onRenderRemaining={handleRenderRemainingCuts}
              onRetryFailed={handleRetryFailedCuts}
              onCancelRun={handleCancelVideoQueue}
            />
          ) : (
            <VideoGenGrid
              blueprintBySceneId={blueprintBySceneId}
              onRetry={handleRetryVideoClip}
              onCancelQueue={handleCancelVideoQueue}
            />
          )
        )}
      </div>

      {/* Bank pickers */}
      <BankPicker bankType="models" isOpen={pickerMode === 'avatar'} onSelect={handlePickAvatar} onClose={() => setPickerMode(null)} />
      <BankPicker bankType="products" isOpen={pickerMode === 'product'} onSelect={handlePickProduct} onClose={() => setPickerMode(null)} />
      <BankPicker bankType="scripts" isOpen={pickerMode === 'script'} onSelect={handlePickScript} onClose={() => setPickerMode(null)} />

      {/* Prompt Compiler v2 debug overlay */}
      {debugOpen && <PromptCompilerDebugPanel compiled={lastCompiled} onClose={() => setDebugOpen(false)} />}

      {/* Task 8 — Analytics modal */}
      <AnalyticsPanel open={analyticsOpen} onClose={() => setAnalyticsOpen(false)} />
    </div>
  )
}
