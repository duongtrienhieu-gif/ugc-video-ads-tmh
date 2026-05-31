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
  Sparkles, FlaskConical, Package, UserRound, FileText,
  ChevronRight, ArrowLeft, RotateCcw, Lock, Zap, Star,
  Film, Wand2, Download, Info, Settings,
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
  COST_MODE_CONFIG, V3_CREDIT_COST, formatCredits,
  type V3Phase,
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
  'auto-edit',        // clip approval gate + edit plan live here
  'export',
]

const PHASE_ICON: Record<V3Phase, React.ElementType> = {
  'input':          FileText,
  'script-voice':   Wand2,   // Z31 — Ad Brain
  'creator-video':  UserRound,
  'action-inserts': Film,
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

  const [pickerMode, setPickerMode] = useState<'avatar' | 'product' | 'script' | null>(null)

  // Z36 — single flow, no workflow modes. You always pick a product + a
  // creator avatar; the script is OPTIONAL (leave blank and the Ad Brain
  // writes one for you at the next step). Voice is resolved at the Script
  // step from the category that matches the avatar + output language.
  const productOk = !!state.inputs.product
  const avatarOk  = !!state.inputs.avatar
  const canContinue = productOk && avatarOk

  // BankPicker's onSelect uses the BankItem union (Product | Model | Script |
  // VoicePreset). We only ever open one picker at a time so a cast is safe.
  const handlePickAvatar  = (item: unknown) => setAvatar(item as Model)
  const handlePickProduct = (item: unknown) => setProduct(item as Product)
  const handlePickScript  = (item: unknown) => {
    const sc = item as { scriptText?: string }
    setScript(sc.scriptText ?? '')
  }

  // Whole-project credit estimate at the fixed 720p profile — so the user
  // sees the ceiling cost up front. Inserts are the bulk of the spend.
  const insertMax = COST_MODE_CONFIG[state.costMode].insertCount.max
  const projectCredits =
    V3_CREDIT_COST.tts +
    V3_CREDIT_COST.keyframe +
    V3_CREDIT_COST.lipsync +
    insertMax * V3_CREDIT_COST.insert

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">Bước 1 — Chọn input</h2>
          <p className="text-[12px] text-gray-500">
            Chọn <strong>sản phẩm</strong> và <strong>creator</strong>. Script có thể để trống — AI sẽ tự viết ở bước sau.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AssetTile
            imageUrl={state.inputs.product?.productImage ?? null}
            label="Product *"
            hint="Sản phẩm bạn muốn quảng cáo (bắt buộc)"
            icon={Package}
            onPick={() => setPickerMode('product')}
            onClear={() => setProduct(null)}
          />
          <AssetTile
            imageUrl={state.inputs.avatar?.characterImage ?? null}
            label="Avatar *"
            hint="Creator AI sẽ đóng vai trong video chính (bắt buộc)"
            icon={UserRound}
            onPick={() => setPickerMode('avatar')}
            onClear={() => setAvatar(null)}
          />
          <div className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Script (tuỳ chọn)</p>
              {state.inputs.script && (
                <button onClick={() => setScript('')} className="text-[10px] text-gray-400 hover:text-red-500">Xoá</button>
              )}
            </div>
            <textarea
              value={state.inputs.script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Để trống cho AI tự viết — hoặc dán script của bạn..."
              className="aspect-square w-full resize-none rounded-lg border border-black/10 bg-black/[0.02] p-2 text-[12px] focus:border-violet-400 focus:outline-none"
            />
            <button
              onClick={() => setPickerMode('script')}
              className="text-[10px] font-semibold text-violet-600 hover:text-violet-700"
            >
              Chọn script có sẵn →
            </button>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 p-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">
              Chi phí ước tính cả project: <strong>{formatCredits(projectCredits)}</strong>
            </p>
            <p className="text-[11px] text-gray-500">
              720p · ~30s · tối đa {insertMax} action inserts. Chỉ trừ credit khi bạn bấm render — mỗi nút đều hiện giá ngay.
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
  const clearState  = useAdsVideoStore((s) => s.clearState)
  const addToast    = useAppStore((s) => s.addToast)

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [showLegacy, setShowLegacy] = useState(false)

  // Phase reachability — Phase 1 keeps it simple: input always reachable;
  // creator-video reachable once inputs valid; rest reachable in narrative
  // order once their predecessor has output. Phase 2+ will tighten these.
  const reachable = new Set<V3Phase>(['input'])
  // Z36 — single flow: script-voice unlocks once BOTH product + avatar are
  // picked (the only two required inputs).
  if (state.inputs.product && state.inputs.avatar) reachable.add('script-voice')
  // creator-video unlocks once we have a generated script (Ad Brain done)
  if (state.scriptBrain.script) reachable.add('creator-video')
  // Z32 — action-inserts unlocks once the creator video has a videoRef
  // (completed lipsync, regardless of approval state)
  if (state.creatorVideo?.videoRef) {
    reachable.add('action-inserts')
  }
  // auto-edit only needs creator video + script. Inserts are optional.
  // The clip approval gate now lives inside this phase.
  if (state.creatorVideo?.videoRef && state.scriptBrain.script) {
    reachable.add('auto-edit')
  }
  // export reachable once an auto-edit plan exists.
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
          <ActionInsertsPhase onContinue={() => setPhase('auto-edit')} />
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

// Suppress unused-warning for icons kept for future use
void FlaskConical
void Lock
void Star
void Info
void ArrowLeft
void Sparkles
