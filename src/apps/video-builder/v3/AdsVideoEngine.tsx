// ── Ads Video — AI UGC Ad Engine (v3) ────────────────────────────────────────
// Z30 PHASE 1 — CORE SYSTEM RESET.
//
// Replaces the v2 "AI Director / cinematic coverage graph" UI with a
// creator-first, preview-first workflow. v2 is preserved behind the
// legacy switch — this is the NEW default.
//
// What this file ships in Phase 1:
//   • Top-level shell with new branding ("Ads Video — AI UGC Ad Engine")
//   • 8-step phase stepper (input → creator-video → action-inserts →
//     preview → approve → final-render → auto-edit → export)
//   • Workflow Mode picker (QUICK / HYBRID / ADVANCED)
//   • Cost Mode picker (TEST / STANDARD / FULL) with default TEST
//   • Functional Input phase reusing the existing asset bank
//   • All other phases are STUBS — show the architecture but rendering
//     itself is deferred to Phase 2 (creator video) + Phase 3 (inserts)
//     + Phase 4 (auto edit).
//
// Persistence: every state mutation goes through useAdsVideoStore which
// saves to localStorage on every commit — F5 / logout survives by
// default (Z27 hard-won lesson).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import {
  Sparkles, FlaskConical, Package, UserRound, FileText, Mic2,
  ChevronRight, ArrowLeft, RotateCcw, Lock, Zap, Star,
  PlayCircle, ListChecks, Film, Wand2, Download, Info, Settings,
} from 'lucide-react'
import { useAppStore } from '../../../stores/appStore'
import { useAssetUrl } from '../../../hooks/useAssetUrl'
import BankPicker from '../../../components/BankPicker'
import type { Model, Product } from '../../../stores/types'
import { useAdsVideoStore } from './stores/adsVideoStore'
import ScriptVoicePhase from './components/ScriptVoicePhase'
import CreatorVideoPhase from './components/CreatorVideoPhase'
import ActionInsertsPhase from './components/ActionInsertsPhase'
import AutoEditPhase from './components/AutoEditPhase'
import ExportPhase from './components/ExportPhase'
import {
  V3_PHASE_LABEL_VI,
  WORKFLOW_MODE_CONFIG, COST_MODE_CONFIG,
  type V3Phase, type WorkflowMode, type CostMode,
} from './types'

interface Props {
  /** Switch to legacy v2 (cinematic coverage pipeline). */
  onSwitchToV2: () => void
  /** Switch to legacy v1 (stable). */
  onSwitchToV1: () => void
}

// ── Phase stepper ──────────────────────────────────────────────────────────
// Compact horizontal pill row — each phase is clickable when its
// prerequisites are met. Z30 simplifies the v2 stepper (was 8 phases
// of cinematic graph) to 8 lean creator-first steps.

const PHASE_ORDER: V3Phase[] = [
  'input',
  'script-voice',     // Z31 — Ad Brain (script + voice timing)
  'creator-video',
  'action-inserts',
  'preview',
  'approve',
  'final-render',
  'auto-edit',
  'export',
]

const PHASE_ICON: Record<V3Phase, React.ElementType> = {
  'input':          FileText,
  'script-voice':   Wand2,   // Z31 — Ad Brain
  'creator-video':  UserRound,
  'action-inserts': Film,
  'preview':        PlayCircle,
  'approve':        ListChecks,
  'final-render':   Sparkles,
  'auto-edit':      Wand2,
  'export':         Download,
}

function PhaseStepper({
  phase, reachable, onPhaseClick,
}: {
  phase: V3Phase
  reachable: ReadonlySet<V3Phase>
  onPhaseClick: (id: V3Phase) => void
}) {
  const activeIdx = PHASE_ORDER.indexOf(phase)
  return (
    <div className="flex items-center gap-1 overflow-x-auto px-1">
      {PHASE_ORDER.map((p, i) => {
        const Icon = PHASE_ICON[p]
        const isActive = i === activeIdx
        const isPast = i < activeIdx
        const isReachable = reachable.has(p)
        const baseCls = isActive
          ? 'bg-violet-600 text-white'
          : isPast
            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            : isReachable
              ? 'bg-black/[0.04] text-gray-600 hover:bg-violet-50 hover:text-violet-700'
              : 'bg-black/[0.04] text-gray-400 cursor-not-allowed'
        return (
          <div key={p} className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => { if (isReachable) onPhaseClick(p) }}
              disabled={!isReachable}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${baseCls}`}
              title={isActive ? `Đang ở: ${V3_PHASE_LABEL_VI[p]}` : V3_PHASE_LABEL_VI[p]}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{V3_PHASE_LABEL_VI[p]}</span>
            </button>
            {i < PHASE_ORDER.length - 1 && <ChevronRight className="h-3 w-3 shrink-0 text-gray-300" />}
          </div>
        )
      })}
    </div>
  )
}

// ── Mode picker chips ──────────────────────────────────────────────────────

const MODE_TONE_BG: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  violet:  'bg-violet-100 text-violet-800 border-violet-300',
  amber:   'bg-amber-100 text-amber-800 border-amber-300',
  pink:    'bg-pink-100 text-pink-800 border-pink-300',
}

function WorkflowModeRow({
  current, onChange,
}: {
  current: WorkflowMode
  onChange: (m: WorkflowMode) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Workflow</span>
      {(['QUICK', 'HYBRID', 'ADVANCED'] as WorkflowMode[]).map((m) => {
        const cfg = WORKFLOW_MODE_CONFIG[m]
        const isActive = m === current
        const tone = MODE_TONE_BG[cfg.tone] ?? MODE_TONE_BG.violet
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            title={cfg.descriptionVi}
            className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-all ${
              isActive ? `${tone} ring-2 ring-offset-1` : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            {cfg.labelVi}
          </button>
        )
      })}
    </div>
  )
}

function CostModeRow({
  current, onChange,
}: {
  current: CostMode
  onChange: (m: CostMode) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Cost mode</span>
      {(['TEST', 'STANDARD', 'FULL'] as CostMode[]).map((m) => {
        const cfg = COST_MODE_CONFIG[m]
        const isActive = m === current
        const tone = MODE_TONE_BG[cfg.tone] ?? MODE_TONE_BG.amber
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            title={cfg.descriptionVi}
            className={`flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold transition-all ${
              isActive ? `${tone} ring-2 ring-offset-1` : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <span>{cfg.labelVi}</span>
            <span className="text-[9px] opacity-80">${cfg.estimatedUsd.min}-{cfg.estimatedUsd.max}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Asset picker tile ──────────────────────────────────────────────────────

function AssetTile({
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

// ── Stub phase view ────────────────────────────────────────────────────────
// Phase 1 only ships the architecture — these are placeholders so the user
// can navigate the new flow. Each shows what it WILL do in a later phase.

function PhaseStub({
  title, summaryVi, plannedFeatures, icon: Icon,
}: {
  title: string
  summaryVi: string
  plannedFeatures: string[]
  icon: React.ElementType
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-pink-100">
        <Icon className="h-8 w-8 text-violet-600" />
      </div>
      <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      <p className="max-w-md text-center text-sm text-gray-500">{summaryVi}</p>
      <div className="mt-3 w-full max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-amber-700">
          Phase 1 — kiến trúc mới · sẽ xây ở các Phase tiếp theo:
        </p>
        <ul className="space-y-1 text-[12px] text-amber-900">
          {plannedFeatures.map((f, i) => <li key={i}>• {f}</li>)}
        </ul>
      </div>
    </div>
  )
}

// ── Input phase (functional) ───────────────────────────────────────────────

function InputPhase({
  onContinue,
}: {
  onContinue: () => void
}) {
  const state    = useAdsVideoStore((s) => s.state)
  const setAvatar  = useAdsVideoStore((s) => s.setAvatar)
  const setProduct = useAdsVideoStore((s) => s.setProduct)
  const setScript  = useAdsVideoStore((s) => s.setScript)
  const setVoiceId = useAdsVideoStore((s) => s.setVoiceId)

  const [pickerMode, setPickerMode] = useState<'avatar' | 'product' | 'script' | null>(null)

  const mode     = state.mode
  const costMode = state.costMode

  // What's REQUIRED for this mode to continue:
  //   QUICK    → product only
  //   HYBRID   → product + avatar + voiceId
  //   ADVANCED → product + avatar + voiceId + script
  const productOk = !!state.inputs.product
  const avatarOk  = !!state.inputs.avatar
  const voiceOk   = !!state.inputs.voiceId
  const scriptOk  = state.inputs.script.trim().length > 10

  const canContinue =
    mode === 'QUICK'    ? productOk :
    mode === 'HYBRID'   ? (productOk && avatarOk && voiceOk) :
    /* ADVANCED */         (productOk && avatarOk && voiceOk && scriptOk)

  // BankPicker's onSelect uses the BankItem union (Product | Model | Script |
  // VoicePreset). We only ever open one picker at a time so a cast is safe.
  const handlePickAvatar  = (item: unknown) => setAvatar(item as Model)
  const handlePickProduct = (item: unknown) => setProduct(item as Product)
  const handlePickScript  = (item: unknown) => {
    const sc = item as { scriptText?: string }
    setScript(sc.scriptText ?? '')
  }

  // Show which inputs are needed for the current mode
  const needAvatar = mode !== 'QUICK'
  const needVoice  = mode !== 'QUICK'
  const needScript = mode === 'ADVANCED'

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">Bước 1 — Chọn input</h2>
          <p className="text-[12px] text-gray-500">
            Mode <strong>{WORKFLOW_MODE_CONFIG[mode].labelVi}</strong> · {WORKFLOW_MODE_CONFIG[mode].descriptionVi}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AssetTile
            imageUrl={state.inputs.product?.productImage ?? null}
            label="Product *"
            hint="Sản phẩm bạn muốn quảng cáo (bắt buộc cho mọi mode)"
            icon={Package}
            onPick={() => setPickerMode('product')}
            onClear={() => setProduct(null)}
          />
          {needAvatar && (
            <AssetTile
              imageUrl={state.inputs.avatar?.characterImage ?? null}
              label="Avatar *"
              hint="Creator AI sẽ đóng vai trong video chính"
              icon={UserRound}
              onPick={() => setPickerMode('avatar')}
              onClear={() => setAvatar(null)}
            />
          )}
          {needScript && (
            <div className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Script *</p>
                {state.inputs.script && (
                  <button onClick={() => setScript('')} className="text-[10px] text-gray-400 hover:text-red-500">Xoá</button>
                )}
              </div>
              <textarea
                value={state.inputs.script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Dán hoặc gõ script ad của bạn..."
                className="aspect-square w-full resize-none rounded-lg border border-black/10 bg-black/[0.02] p-2 text-[12px] focus:border-violet-400 focus:outline-none"
              />
              <button
                onClick={() => setPickerMode('script')}
                className="text-[10px] font-semibold text-violet-600 hover:text-violet-700"
              >
                Chọn script có sẵn →
              </button>
            </div>
          )}
        </div>

        {needVoice && (
          <div className="mt-3 rounded-xl border border-black/10 bg-white p-3">
            <div className="flex items-center gap-2">
              <Mic2 className="h-4 w-4 text-gray-400" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Voice *</p>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              {state.inputs.voiceId ?? '(Chưa chọn) — picker voice ElevenLabs sẽ wire vào Phase 2'}
            </p>
            <button
              onClick={() => setVoiceId('placeholder-voice-id')}
              className="mt-2 rounded-md border border-violet-300 bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-100"
            >
              {state.inputs.voiceId ? 'Đổi voice (stub)' : 'Pick voice (stub)'}
            </button>
          </div>
        )}

        {mode === 'QUICK' && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-[12px] font-bold text-emerald-800">⚡ QUICK MODE</p>
            <p className="mt-1 text-[11px] text-emerald-900">
              Chỉ cần product — AI sẽ auto-pick creator, generate script + voice, và build inserts ở các bước sau.
            </p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 p-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">
              Cost mode: <strong>{COST_MODE_CONFIG[costMode].labelVi}</strong> · trần ~${COST_MODE_CONFIG[costMode].estimatedUsd.max} cho toàn project
            </p>
            <p className="text-[11px] text-gray-500">
              {COST_MODE_CONFIG[costMode].descriptionVi}
            </p>
          </div>
          <button
            onClick={onContinue}
            disabled={!canContinue}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-5 py-2 text-sm font-bold text-white shadow-md transition-all hover:from-violet-700 hover:to-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Tiếp tục → Script + Voice <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <BankPicker bankType="models"   isOpen={pickerMode === 'avatar'}  onSelect={handlePickAvatar}  onClose={() => setPickerMode(null)} />
      <BankPicker bankType="products" isOpen={pickerMode === 'product'} onSelect={handlePickProduct} onClose={() => setPickerMode(null)} />
      <BankPicker bankType="scripts"  isOpen={pickerMode === 'script'}  onSelect={handlePickScript}  onClose={() => setPickerMode(null)} />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AdsVideoEngine({ onSwitchToV2, onSwitchToV1 }: Props) {
  const state    = useAdsVideoStore((s) => s.state)
  const setPhase = useAdsVideoStore((s) => s.setPhase)
  const setMode  = useAdsVideoStore((s) => s.setMode)
  const setCostMode = useAdsVideoStore((s) => s.setCostMode)
  const clearState  = useAdsVideoStore((s) => s.clearState)
  const addToast    = useAppStore((s) => s.addToast)

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [showLegacy, setShowLegacy] = useState(false)

  // Phase reachability — Phase 1 keeps it simple: input always reachable;
  // creator-video reachable once inputs valid; rest reachable in narrative
  // order once their predecessor has output. Phase 2+ will tighten these.
  const reachable = new Set<V3Phase>(['input'])
  // Z31 — script-voice phase unlocks once product is picked (avatar required
  // only in HYBRID/ADVANCED modes — InputPhase already gates that)
  if (state.inputs.product) reachable.add('script-voice')
  // creator-video unlocks once we have a generated script (Ad Brain done)
  if (state.scriptBrain.script) reachable.add('creator-video')
  // Z32 — action-inserts unlocks once the creator video has a videoRef
  // (completed lipsync, regardless of approval state)
  if (state.creatorVideo?.videoRef) {
    reachable.add('action-inserts')
  }
  // Z33 — preview/approve unlock once at least one insert has been rendered
  if (state.inserts.some((it) => !!it.videoRef)) {
    reachable.add('preview')
    reachable.add('approve')
  }
  // Z34 — auto-edit only needs creator video + script. Inserts are optional.
  if (state.creatorVideo?.videoRef && state.scriptBrain.script) {
    reachable.add('auto-edit')
  }
  // Final-render + export still require approved/locked inserts (Phase 6+ wiring)
  if (state.inserts.some((it) => it.status === 'approved' || it.status === 'locked')) {
    reachable.add('final-render')
    reachable.add('export')
  }
  // Export also reachable if auto-edit plan exists (Phase 6 will export from plan)
  if (state.autoEdit.plan) {
    reachable.add('export')
  }

  const handleResetAll = () => {
    setResetConfirmOpen(false)
    clearState()
    addToast('Đã xoá toàn bộ tiến trình — bắt đầu lại từ bước Chọn input', 'success')
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Top banner — NEW BRANDING (Z30) ──────────────────────────────── */}
      <div className="shrink-0 border-b border-black/8 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-6 py-3 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            <div>
              <h1 className="text-sm font-bold">Ads Video — AI UGC Ad Engine</h1>
              <p className="text-[11px] text-white/80">
                Creator-first · Preview-first · Low-cost iteration
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Legacy escape hatch */}
            <button
              onClick={() => setShowLegacy((v) => !v)}
              title="Switch tới legacy pipelines (v2 cinematic / v1 stable)"
              className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm hover:bg-white/25"
            >
              <Settings className="h-3.5 w-3.5" /> Legacy
            </button>
            {showLegacy && (
              <>
                <button
                  onClick={onSwitchToV2}
                  className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm hover:bg-white/25"
                >
                  v2 (Cinematic)
                </button>
                <button
                  onClick={onSwitchToV1}
                  className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm hover:bg-white/25"
                >
                  v1 (Stable)
                </button>
              </>
            )}
            <button
              onClick={() => setResetConfirmOpen(true)}
              title="Xoá toàn bộ tiến trình + bắt đầu lại từ bước 1"
              className="flex items-center gap-1.5 rounded-lg border border-white/30 bg-red-500/30 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm transition-colors hover:bg-red-500/50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Tạo lại từ đầu
            </button>
          </div>
        </div>

        {/* Mode + cost-mode row */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm">
          <WorkflowModeRow current={state.mode} onChange={setMode} />
          <CostModeRow current={state.costMode} onChange={setCostMode} />
        </div>
      </div>

      {/* ── Phase stepper ────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-black/8 bg-white px-6 py-2.5">
        <PhaseStepper
          phase={state.phase}
          reachable={reachable}
          onPhaseClick={setPhase}
        />
      </div>

      {/* ── Body — switches by phase ────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {state.phase === 'input' && (
          <InputPhase onContinue={() => setPhase('script-voice')} />
        )}
        {state.phase === 'script-voice' && (
          <ScriptVoicePhase onContinue={() => setPhase('creator-video')} />
        )}
        {state.phase === 'creator-video' && (
          <CreatorVideoPhase onContinue={() => setPhase('action-inserts')} />
        )}
        {state.phase === 'action-inserts' && (
          <ActionInsertsPhase onContinue={() => setPhase('preview')} />
        )}
        {state.phase === 'preview' && (
          <PhaseStub
            title="Preview"
            summaryVi="Play through tất cả clip theo thứ tự (main creator → inserts) — kiểm tra continuity + motion trước khi approve."
            plannedFeatures={[
              'Video player chạy main creator + N inserts liên tiếp',
              'Hiển thị transition giữa các clip (cut hoặc dissolve)',
              'Click clip → jump tới timestamp',
            ]}
            icon={PlayCircle}
          />
        )}
        {state.phase === 'approve' && (
          <PhaseStub
            title="Duyệt / Loại"
            summaryVi="Per-clip approve / reject / lock 🔒. Approved clips eligible cho final-render upgrade lên 1080p."
            plannedFeatures={[
              'Card grid — copy infrastructure từ Z28 TimelineRenderGrid approval system',
              'Status: idle / rendering / completed / approved / rejected / locked / failed',
              'Locked clips immune to bulk operations (Z26 lesson)',
            ]}
            icon={ListChecks}
          />
        )}
        {state.phase === 'final-render' && (
          <PhaseStub
            title="Render bản cuối"
            summaryVi="Upgrade approved clips từ TEST_480 lên FINAL_1080. Chỉ approved + locked được upgrade — rejected bị bỏ."
            plannedFeatures={[
              'Render profile FINAL_1080 chỉ chạy trên clip đã approve',
              'Cost preview rõ ràng: "X clip × 140cr = Ycr"',
              'Skip locked nếu user muốn giữ 480p version',
            ]}
            icon={Sparkles}
          />
        )}
        {state.phase === 'auto-edit' && (
          <AutoEditPhase onContinue={() => setPhase('export')} />
        )}
        {state.phase === 'export' && (
          <ExportPhase />
        )}
      </div>

      {/* Reset confirm modal — same pattern as Z27 */}
      {resetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setResetConfirmOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <RotateCcw className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900">Xoá toàn bộ tiến trình?</h3>
                <p className="mt-1 text-[13px] text-gray-600">
                  Sẽ xoá: inputs, video creator, {state.inserts.length} action inserts, và mọi clip đã render.
                </p>
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  <strong>Không hoàn tác được.</strong> Bạn sẽ phải tạo lại từ đầu và tốn credit lần nữa.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setResetConfirmOpen(false)} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Huỷ</button>
              <button onClick={handleResetAll} className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700">
                <RotateCcw className="h-3.5 w-3.5" /> Xoá hết
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Suppress unused-warning for icons referenced only in stub feature lists
void FlaskConical
void Lock
void Star
void Info
void ArrowLeft
