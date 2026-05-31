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

import { useState, useEffect } from 'react'
import {
  Sparkles, FlaskConical, UserRound, FileText,
  ChevronRight, ArrowLeft, RotateCcw, Lock, Zap, Star,
  Film, Wand2, Download, Info, Settings,
} from 'lucide-react'
import { useAppStore } from '../../../stores/appStore'
import { useAdsVideoStore } from './stores/adsVideoStore'
import ScriptVoicePhase from './components/ScriptVoicePhase'
import CreatorVideoPhase from './components/CreatorVideoPhase'
import ActionInsertsPhase from './components/ActionInsertsPhase'
import AutoEditPhase from './components/AutoEditPhase'
import ExportPhase from './components/ExportPhase'
import {
  V3_PHASE_LABEL_VI,
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

// Z37 — Bước 1 (Input) + Bước 2 (Script + Voice) merged into ONE screen.
// The script segmentation (5-block split) still runs, but BEHIND THE
// SCENES — the user only sees a single input step.
// Z39 — B-roll (action-inserts) moved AHEAD of creator-video so the user can
// test cheap inserts (Ken Burns ~6cr / Kling ~51cr) BEFORE committing ~700cr to
// avatar lipsync. Rationale: don't risk paying for lipsync only to find the
// B-roll concept was wrong.
const PHASE_ORDER: V3Phase[] = [
  'input',
  'action-inserts',
  'creator-video',
  'auto-edit',        // clip approval gate + edit plan live here
  'export',
]

const PHASE_ICON: Record<V3Phase, React.ElementType> = {
  'input':          FileText,
  'script-voice':   Wand2,   // legacy — no longer in PHASE_ORDER (Z37 merge)
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

// ── Main component ─────────────────────────────────────────────────────────

export default function AdsVideoEngine({ onSwitchToV2, onSwitchToV1 }: Props) {
  const state    = useAdsVideoStore((s) => s.state)
  const setPhase = useAdsVideoStore((s) => s.setPhase)
  const clearState  = useAdsVideoStore((s) => s.clearState)
  const addToast    = useAppStore((s) => s.addToast)

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [showLegacy, setShowLegacy] = useState(false)

  // Z37 — migration: persisted state may still sit on the now-merged
  // 'script-voice' phase. Map it back onto 'input' (the merged screen).
  useEffect(() => {
    if (state.phase === 'script-voice') setPhase('input')
  }, [state.phase, setPhase])

  // Phase reachability — Phase 1 keeps it simple: input always reachable;
  // creator-video reachable once inputs valid; rest reachable in narrative
  // order once their predecessor has output. Phase 2+ will tighten these.
  const reachable = new Set<V3Phase>(['input'])
  // Z39 — once a script exists, BOTH B-roll and creator-video unlock. B-roll now
  // comes first in the flow so the user can test cheap inserts before lipsync.
  if (state.scriptBrain.script) {
    reachable.add('action-inserts')
    reachable.add('creator-video')
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
        {(state.phase === 'input' || state.phase === 'script-voice') && (
          <ScriptVoicePhase onContinue={() => setPhase('action-inserts')} />
        )}
        {state.phase === 'action-inserts' && (
          <ActionInsertsPhase onContinue={() => setPhase('creator-video')} />
        )}
        {state.phase === 'creator-video' && (
          <CreatorVideoPhase onContinue={() => setPhase('auto-edit')} />
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
