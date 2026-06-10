// ── AutoEditPhase ────────────────────────────────────────────────────────────
// Z34 Phase 5 UI — the "conversion layer". Pick a style, click Generate,
// see the edit plan visualised as a timeline, then Export (Phase 6).
//
// Layout (top-to-bottom):
//   1. Generate plan button + status (style is auto-picked, no picker)
//   2. Plan summary KPI strip — segment / zoom count / duration / CTA
//   3. Timeline visualiser — colored bars per segment + zoom markers + CTA
//   4. Warnings panel — if planner detected anything off
//   5. Export button (Phase 6 — ffmpeg.wasm)
//
// Z98 — subtitles, SFX and BGM were all dropped from the engine, so this UI no
// longer has subtitle/BGM/SFX pickers or rows. The planner always returns empty
// captions/sfxCues + null bgm.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react'
import {
  Loader2, Sparkles, AlertCircle, ChevronRight, RotateCcw, Wand2,
  Zap, Play, Megaphone, Download,
  CheckCircle2,
} from 'lucide-react'
import { useAppStore } from '../../../../stores/appStore'
import { useAdsVideoStore } from '../stores/adsVideoStore'
import type { AutoEditPlan } from '../types'
import { EDITING_STYLES } from '../services/editingStyles'
import { buildAutoEditPlan, validatePlan } from '../services/autoEditPlanner'

const TONE_BG: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  violet:  'bg-violet-100 text-violet-800 border-violet-300',
  amber:   'bg-amber-100 text-amber-800 border-amber-300',
  pink:    'bg-pink-100 text-pink-800 border-pink-300',
  sky:     'bg-sky-100 text-sky-800 border-sky-300',
  rose:    'bg-rose-100 text-rose-800 border-rose-300',
}

interface Props {
  onContinue: () => void
}

export default function AutoEditPhase({ onContinue }: Props) {
  const state = useAdsVideoStore((s) => s.state)
  const setAutoEditPlan    = useAdsVideoStore((s) => s.setAutoEditPlan)
  const setIsGeneratingPlan = useAdsVideoStore((s) => s.setIsGeneratingPlan)
  const setAutoEditError   = useAdsVideoStore((s) => s.setAutoEditError)
  const addToast           = useAppStore((s) => s.addToast)

  const autoEdit = state.autoEdit
  const styleConfig = EDITING_STYLES[autoEdit.styleId]

  // ── Pre-flight: do we have what we need? ──────────────────────────────
  const hasCreatorVideo = !!state.creatorVideo?.videoRef
  const hasScript = !!state.scriptBrain.script

  // Z85 — auto-use ALL rendered inserts. The old manual "Duyệt / Loại" gate was
  // redundant: the user already paid for every insert in Bước 2, so there's no
  // reason to make them re-approve here. Every clip with a videoRef is fed
  // straight into the plan (the planner itself drops anything still failing).
  const renderedInserts = state.inserts.filter((it) => !!it.videoRef)

  // Hard inputs required just to enter (+build) the phase.
  const hasInputs = hasCreatorVideo && hasScript
  const canGenerate = hasInputs

  const warnings = useMemo(() => {
    return autoEdit.plan ? validatePlan(autoEdit.plan) : []
  }, [autoEdit.plan])

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleGenerate = () => {
    if (!canGenerate || !state.creatorVideo || !state.scriptBrain.script) return
    setIsGeneratingPlan(true)
    setAutoEditError(null)
    // setTimeout 0 so the spinner gets to paint before the synchronous planner runs
    setTimeout(() => {
      try {
        const plan = buildAutoEditPlan({
          creatorVideo: state.creatorVideo!,
          inserts: renderedInserts,
          script: state.scriptBrain.script!,
          styleId: autoEdit.styleId,
          subtitleStyleId: autoEdit.subtitleStyleId,
          bgmStyleId: 'none',  // Z85 — BGM feature removed (no music files)
        })
        setAutoEditPlan(plan)
        addToast(
          `✓ Edit plan: ${plan.segments.length} segments · ${plan.punchZooms.length} zooms · ${plan.totalDurationSec.toFixed(1)}s`,
          'success',
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setAutoEditError(msg.slice(0, 240))
        addToast(`Build plan lỗi: ${msg}`, 'error')
      } finally {
        setIsGeneratingPlan(false)
      }
    }, 50)
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (!hasInputs) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <Wand2 className="h-10 w-10 text-gray-300" />
        <h3 className="text-lg font-bold text-gray-900">Chưa đủ input cho Auto Edit</h3>
        <ul className="text-[12px] text-gray-500">
          {!hasCreatorVideo && <li>• Cần creator video (bước 3)</li>}
          {!hasScript && <li>• Cần script (bước 2)</li>}
        </ul>
        <p className="mt-2 text-[11px] text-amber-700">
          Action inserts không bắt buộc (0 inserts cũng OK), nhưng càng nhiều insert đã duyệt thì plan càng đa dạng.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">Bước 4 — Auto Edit (conversion layer)</h2>
          <p className="text-[12px] text-gray-500">
            Tạo edit plan TikTok-native: cuts, punch zooms, CTA overlay.
            Plan deterministic — không gọi AI ở phase này, free re-roll.
          </p>
        </div>

        {/* ── Z85 — auto-use all rendered clips (no manual approval) ──────── */}
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            Tự dùng <b>video creator + {renderedInserts.length} insert</b> đã render (đã trả phí ở bước 2 — không cần duyệt lại).
            Đạo diễn AI tự chọn nhịp dựng phù hợp.
          </span>
        </div>

        {/* ── Generate banner ────────────────────────────────────────────── */}
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 p-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">
              {autoEdit.plan ? 'Đã có plan — regenerate để thử style khác' : 'Build edit plan'}
            </p>
            <p className="text-[11px] text-gray-500">
              {renderedInserts.length} insert · {state.scriptBrain.script?.totalDurationSec.toFixed(1)}s voice · {styleConfig.labelVi}
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={autoEdit.isGenerating || !canGenerate}
            title={!canGenerate ? 'Cần creator video + script trước khi dựng' : undefined}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-5 py-2 text-sm font-bold text-white shadow-md transition-all hover:from-violet-700 hover:to-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {autoEdit.isGenerating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Đang tính plan...</>
            ) : autoEdit.plan ? (
              <><RotateCcw className="h-4 w-4" /> Build lại</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Build plan</>
            )}
          </button>
        </div>

        {/* ── Error banner ─────────────────────────────────────────────────── */}
        {autoEdit.error && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div><strong>Lỗi:</strong> {autoEdit.error}</div>
          </div>
        )}

        {/* ── Plan summary + visualiser ───────────────────────────────────── */}
        {autoEdit.plan && (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Kpi label="Duration"  value={`${autoEdit.plan.totalDurationSec.toFixed(1)}s`} icon={Play} tone="violet" />
              <Kpi label="Segments"  value={autoEdit.plan.segments.length} icon={Zap} tone="emerald" />
              <Kpi label="Zooms"     value={autoEdit.plan.punchZooms.length} icon={Zap} tone="pink" />
              <Kpi label="CTA"       value={autoEdit.plan.cta ? 'YES' : 'NO'} icon={Megaphone} tone={autoEdit.plan.cta ? 'rose' : 'sky'} />
            </div>

            {warnings.length > 0 && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-amber-700">Cảnh báo</p>
                <ul className="space-y-0.5 text-[11px] text-amber-900">
                  {warnings.map((w, i) => <li key={i}>• {w}</li>)}
                </ul>
              </div>
            )}

            <EditTimelineViewer plan={autoEdit.plan} />

            {/* ── Export stub + Continue ─────────────────────────────────── */}
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-emerald-900">
                  ✓ Plan sẵn sàng — sang Export để render MP4 cuối
                </p>
                <p className="text-[11px] text-emerald-700">
                  Plan này deterministic — sửa style + click "Build lại" để re-roll (free, không tốn credit).
                </p>
              </div>
              <button
                onClick={onContinue}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:from-emerald-700 hover:to-teal-700"
              >
                <Download className="h-4 w-4" /> Sang Export <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── KPI chip ─────────────────────────────────────────────────────────────

function Kpi({
  label, value, icon: Icon, tone,
}: {
  label: string; value: string | number; icon: React.ElementType; tone: string
}) {
  return (
    <div className={`rounded-xl border p-2 ${TONE_BG[tone] ?? 'border-gray-200 bg-white'}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 opacity-70" />
        <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">{label}</span>
      </div>
      <p className="mt-0.5 text-base font-extrabold leading-tight">{value}</p>
    </div>
  )
}

// ── Timeline visualiser ──────────────────────────────────────────────────
// Renders the edit plan as a horizontal ruler with colored segment bars
// + caption ticks + zoom triangles + SFX dots. 100% width = totalDuration.

function EditTimelineViewer({ plan }: { plan: AutoEditPlan }) {
  const total = plan.totalDurationSec
  const pctOf = (sec: number) => `${Math.min(100, (sec / total) * 100)}%`

  return (
    <div className="rounded-xl border border-black/10 bg-white p-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
        Timeline ({total.toFixed(1)}s)
      </p>

      {/* Segments row */}
      <div className="relative h-8 w-full overflow-hidden rounded-md bg-gray-100">
        {plan.segments.map((seg) => {
          const isInsert = seg.source.kind === 'action_insert'
          return (
            <div
              key={seg.segmentId}
              className={`absolute top-0 h-full ${
                isInsert ? 'bg-pink-400/80 border-x border-pink-600' : 'bg-violet-300/60'
              }`}
              style={{ left: pctOf(seg.startSec), width: pctOf(seg.durationSec) }}
              title={`#${seg.segmentId} ${seg.source.kind === 'action_insert' ? `insert ${seg.source.insertId}` : 'creator'} · ${seg.startSec.toFixed(1)}s → ${(seg.startSec + seg.durationSec).toFixed(1)}s`}
            />
          )
        })}
      </div>
      <p className="mt-1 text-[9px] text-gray-400">
        <span className="inline-block h-2 w-2 rounded bg-violet-300/80 mr-1"></span>Creator
        <span className="ml-3 inline-block h-2 w-2 rounded bg-pink-400/80 mr-1"></span>Insert
      </p>

      {/* Punch zooms row */}
      {plan.punchZooms.length > 0 && (
        <div className="mt-2">
          <p className="mb-0.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">Punch zooms</p>
          <div className="relative h-3 w-full overflow-visible">
            {plan.punchZooms.map((z, i) => (
              <div
                key={i}
                className="absolute -top-1 h-5 w-px bg-amber-500"
                style={{ left: pctOf(z.startSec) }}
                title={`${z.reason} @ ${z.startSec.toFixed(1)}s · scale ${z.targetScale.toFixed(2)}x`}
              >
                <span className="absolute -top-0.5 -translate-x-1/2 text-[10px]">🔍</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA marker */}
      {plan.cta && (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-rose-700">
            CTA overlay @ {plan.cta.startSec.toFixed(1)}s — {plan.cta.durationSec.toFixed(1)}s
          </p>
          <p className="mt-0.5 text-[12px] font-bold text-rose-900">"{plan.cta.text}"</p>
          <p className="text-[10px] text-rose-700">
            Animation: {plan.cta.animation} · Style: {plan.cta.style}
          </p>
        </div>
      )}

    </div>
  )
}
