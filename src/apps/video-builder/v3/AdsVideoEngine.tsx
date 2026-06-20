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
  Film, Wand2, Download, Info, FolderOpen, Save, Plus, Pencil, Trash2,
} from 'lucide-react'
import { useAppStore } from '../../../stores/appStore'
import { useAdsVideoStore } from './stores/adsVideoStore'
import ScriptVoicePhase from './components/ScriptVoicePhase'
import HybridVideoPhase from './components/HybridVideoPhase'
import HybridExportPhase from './components/HybridExportPhase'
import ExportedVideoLibrary from './components/ExportedVideoLibrary'
import {
  V3_PHASE_LABEL_VI,
  type V3Phase,
  type SavedProject,
} from './types'
import {
  getAllProjects, hydrateProjectAsState, saveCurrentAsProject, updateProject,
  renameProject, deleteProject,
} from './services/projectLibrary'

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
// HYBRID 1-luồng: only 3 steps. creator-video + auto-edit (mode-1) are retired —
// the hybrid "Tạo Video" step does director + voice + face + render + assemble.
const PHASE_ORDER: V3Phase[] = [
  'input',
  'action-inserts',   // = "Tạo Video" (hybrid hub)
  'export',           // = HybridExportPhase
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

export default function AdsVideoEngine(_props: Props) {
  const state    = useAdsVideoStore((s) => s.state)
  const setPhase = useAdsVideoStore((s) => s.setPhase)
  const clearState  = useAdsVideoStore((s) => s.clearState)
  const hydrateFromSnapshot = useAdsVideoStore((s) => s.hydrateFromSnapshot)
  const addToast    = useAppStore((s) => s.addToast)

  const setActiveProjectId = useAdsVideoStore((s) => s.setActiveProjectId)

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [restoreOpen, setRestoreOpen] = useState(false)   // P6au — "Dự án của tôi" modal (lưu/mở/đổi tên/xoá)
  const [libraryOpen, setLibraryOpen] = useState(false)   // P6y — exported-video library modal
  const [projects, setProjects] = useState<SavedProject[]>([])
  const refreshProjects = () => setProjects(getAllProjects())

  // P6au — does the current state have any real work worth saving?
  const hasWork = !!(state.scriptBrain.script || state.hybrid.scenes?.length || state.hybrid.finalVideoRef)

  // P6au — SAVE the current project: update the open slot, else create a new one.
  const saveActiveProject = (): string | null => {
    if (!hasWork) { addToast('Chưa có gì để lưu — tạo kịch bản hoặc render cảnh trước', 'info'); return null }
    const cur = useAdsVideoStore.getState().state
    if (cur.activeProjectId && updateProject(cur.activeProjectId, cur)) {
      addToast('Đã lưu project (cập nhật)', 'success')
      refreshProjects()
      return cur.activeProjectId
    }
    const saved = saveCurrentAsProject(cur)
    setActiveProjectId(saved.id)
    addToast(`Đã lưu project "${saved.name}"`, 'success')
    refreshProjects()
    return saved.id
  }

  // P6au — OPEN a saved project into the active state (incl. the hybrid scenes/clips/voice),
  // route to the right step, and mark it active so further edits save back to it.
  const handleOpen = (proj: SavedProject) => {
    hydrateFromSnapshot(hydrateProjectAsState(proj))   // sets activeProjectId = proj.id (see projectLibrary)
    const snap = proj.snapshot
    const target: V3Phase = snap.hybrid?.finalVideoRef ? 'export'
      : (snap.hybrid?.scenes?.length || snap.scriptBrain?.script) ? 'action-inserts'
      : 'input'
    setPhase(target)
    setRestoreOpen(false)
    addToast(`Đã mở "${proj.name}" — sửa thoải mái, tự lưu lại project này`, 'success')
  }

  // P6au — NEW project: offer to save the current one first, then start fresh.
  const handleNewProject = () => {
    if (hasWork && state.activeProjectId == null) saveActiveProject()   // unsaved scratch → keep it in the library
    else if (hasWork && state.activeProjectId) saveActiveProject()      // persist latest edits before leaving
    clearState()
    setActiveProjectId(undefined)
    setRestoreOpen(false)
    addToast('Đã lưu project cũ + mở project MỚI', 'success')
  }

  const handleRename = (p: SavedProject) => {
    const name = window.prompt('Tên mới cho project:', p.name)?.trim()
    if (name) { renameProject(p.id, name); refreshProjects() }
  }
  const handleDelete = (p: SavedProject) => {
    if (!window.confirm(`Xoá project "${p.name}"? (không xoá clip đã render — chỉ xoá bản lưu)`)) return
    deleteProject(p.id)
    if (state.activeProjectId === p.id) setActiveProjectId(undefined)
    refreshProjects()
  }

  // P6au — AUTO-SAVE: while a project is open, debounce-write edits back to its library slot
  // so "vào sửa video cũ" always persists without remembering to click Lưu. Only the active
  // (opened/saved) project auto-saves; a fresh scratch project waits for an explicit Lưu.
  useEffect(() => {
    if (!state.activeProjectId) return
    const id = state.activeProjectId
    const t = setTimeout(() => {
      const cur = useAdsVideoStore.getState().state
      if (cur.activeProjectId === id) updateProject(id, cur)
    }, 2500)
    return () => clearTimeout(t)
  }, [state])

  // Migration: map retired phases onto the hybrid flow. 'script-voice' (Z37 merge)
  // and the mode-1 'creator-video' / 'auto-edit' steps → the merged screens.
  useEffect(() => {
    if (state.phase === 'script-voice') setPhase('input')
    else if (state.phase === 'creator-video' || state.phase === 'auto-edit') setPhase('action-inserts')
  }, [state.phase, setPhase])

  // Phase reachability (hybrid): input always; "Tạo Video" once a script exists;
  // Export once a plan exists (the export screen guides the user if not yet rendered).
  const reachable = new Set<V3Phase>(['input'])
  if (state.scriptBrain.script) reachable.add('action-inserts')
  if (state.hybrid.scenes?.length || state.hybrid.finalVideoRef) reachable.add('export')

  const handleResetAll = () => {
    setResetConfirmOpen(false)
    clearState()
    addToast('Đã xoá toàn bộ tiến trình — bắt đầu lại từ bước Chọn input', 'success')
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Top banner — NEW BRANDING (Z30) ──────────────────────────────── */}
      {/* pr reserves room for the global Gemini/KIE-Credit badges (App.tsx —
          absolute right-4 top-3 z-50) so the banner's own buttons aren't
          covered by them. */}
      <div className="shrink-0 border-b border-black/8 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 py-3 pl-6 pr-3 text-white md:pr-[260px]">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            <div>
              <h1 className="text-sm font-bold">Ads Video — AI UGC Ad Engine</h1>
              <p className="text-[11px] text-white/80">
                Creator-first · Preview-first · Low-cost iteration
              </p>
            </div>
          </div>
          {/* Z98 — action buttons sit right after the title (center-left) so the
              global Gemini/KIE-Credit badges (absolute top-right) can't cover them. */}
          <div className="flex flex-wrap items-center gap-2">
            {/* P6au — multi-project: Lưu / Dự án (mở-sửa) / Mới. */}
            <button
              onClick={saveActiveProject}
              disabled={!hasWork}
              title="Lưu project video hiện tại (kịch bản + cảnh + clip đã render + giọng). Mở lại sửa được."
              className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm hover:bg-white/25 disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" /> Lưu project
            </button>
            <button
              onClick={() => { refreshProjects(); setRestoreOpen(true) }}
              title="Mở / sửa các project video đã lưu (đồng bộ trên cloud)"
              className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm hover:bg-white/25"
            >
              <FolderOpen className="h-3.5 w-3.5" /> Dự án của tôi
            </button>
            <button
              onClick={handleNewProject}
              title="Lưu project hiện tại rồi mở một project MỚI (trống)"
              className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm hover:bg-white/25"
            >
              <Plus className="h-3.5 w-3.5" /> Project mới
            </button>
            <button
              onClick={() => setLibraryOpen(true)}
              title="Thư viện video đã ghép hoàn chỉnh — tải lại 0 credit, còn kể cả sau Tạo lại từ đầu"
              className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm hover:bg-white/25"
            >
              <Film className="h-3.5 w-3.5" /> Video đã xuất
            </button>
            <button
              onClick={() => setResetConfirmOpen(true)}
              title="Xoá sạch tiến trình ĐANG mở + bắt đầu lại từ bước 1 (KHÔNG đụng các project đã lưu)"
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
        {(state.phase === 'action-inserts' || state.phase === 'creator-video' || state.phase === 'auto-edit') && (
          <HybridVideoPhase />
        )}
        {state.phase === 'export' && (
          <HybridExportPhase />
        )}
      </div>

      {/* P6y — Exported-video library (final MP4s only; survives "Tạo lại từ đầu"). */}
      {libraryOpen && <ExportedVideoLibrary onClose={() => setLibraryOpen(false)} />}

      {/* Z98 — Restore picker — always-accessible Library load (works even when
          the wizard tabs are gated after a lost render). */}
      {restoreOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setRestoreOpen(false)}>
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100">
                <FolderOpen className="h-5 w-5 text-violet-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900">Dự án của tôi</h3>
                <p className="text-xs text-gray-500">
                  Mở để sửa tiếp (giữ kịch bản + cảnh + clip đã render + giọng). Đồng bộ trên cloud — đổi máy vẫn thấy.
                </p>
              </div>
              <button
                onClick={() => { saveActiveProject(); }}
                disabled={!hasWork}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" /> Lưu hiện tại
              </button>
            </div>
            {projects.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                Chưa có project nào. Bấm "Lưu hiện tại" để lưu video đang làm.
              </p>
            ) : (
              <div className="-mx-1 flex-1 overflow-y-auto px-1">
                {projects.map((p) => {
                  const sceneCount = p.snapshot.hybrid?.scenes?.length ?? 0
                  const clipCount = Object.keys(p.snapshot.hybrid?.clips ?? {}).length
                  const hasFinal = !!p.snapshot.hybrid?.finalVideoRef
                  const isActive = p.id === state.activeProjectId
                  return (
                    <div
                      key={p.id}
                      className={`mb-2 flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${isActive ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-gray-50'}`}
                    >
                      <button onClick={() => handleOpen(p)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-gray-900">
                            {p.isWinner && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
                            {p.name}
                            {isActive && <span className="rounded bg-violet-200 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">ĐANG MỞ</span>}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
                            <span>{new Date(p.lastEditedAt).toLocaleString('vi-VN')}</span>
                            {sceneCount > 0 && <span className="rounded bg-sky-100 px-1.5 py-0.5 font-semibold text-sky-700">{sceneCount} cảnh</span>}
                            {clipCount > 0 && <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold text-green-700">{clipCount} clip</span>}
                            {hasFinal && <span className="rounded bg-fuchsia-100 px-1.5 py-0.5 font-semibold text-fuchsia-700">có video</span>}
                          </div>
                        </div>
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <button onClick={() => handleOpen(p)} title="Mở để sửa" className="rounded-lg bg-violet-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-violet-700">Mở</button>
                        <button onClick={() => handleRename(p)} title="Đổi tên" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleDelete(p)} title="Xoá bản lưu" className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-100 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <button
              onClick={() => setRestoreOpen(false)}
              className="mt-4 self-end rounded-lg px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

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
