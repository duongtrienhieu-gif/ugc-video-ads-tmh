// ── TimelinePlanningView ─────────────────────────────────────────────────────
// Z23 — UI for the new "Generate Coverage & Timeline" step. Sits between
// Scene Gen (8 master images approved) and Video Gen (Kling renders).
//
// This step is PURE PLANNING — NO Kling, NO KIE video API calls. It runs
// the editorial brain (Z11/Z12/Z13/Z17/Z21) over the masters to produce:
//   • coverageShots[]
//   • timelineCuts[]
//   • motionBlueprints[]
//   • transitionGraph[]
//   • continuityGroups[]
//   • energyCurve[]
//   • estimatedDurationSec
//
// Then the user clicks "Render Motion Clips" → THAT step calls Kling.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import {
  Sparkles, ArrowRight, ArrowLeft, ChevronDown, Film, Layers,
  Activity, Workflow, Camera, Gauge,
} from 'lucide-react'
import type {
  EditorialBlueprint, TimelineRenderJob, CoverageShot, TimelineCut,
} from '../types'

interface Props {
  blueprint: EditorialBlueprint | null
  renderJob: TimelineRenderJob | null
  isBuilding: boolean
  onBack: () => void
  onRenderClips: () => void
  /** Voice duration estimate (seconds) — drives planning. */
  voiceDurationSec: number
}

export default function TimelinePlanningView({
  blueprint, renderJob, isBuilding, onBack, onRenderClips, voiceDurationSec,
}: Props) {
  const [openSection, setOpenSection] = useState<'coverage' | 'cuts' | 'motion' | 'transitions' | null>('coverage')

  if (isBuilding || !blueprint || !renderJob) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <Sparkles className="h-12 w-12 animate-pulse text-violet-500" />
        <h2 className="text-base font-bold text-gray-800">Đang build coverage & timeline…</h2>
        <p className="max-w-md text-xs text-gray-500">
          Editorial brain đang derive 25-40 coverage shots, assemble 20-35 timeline cuts,
          map motion blueprints + transition graph, tính pacing per phase…
        </p>
        <p className="text-[10px] text-gray-400">⚡ Hoàn toàn local · không gọi Kling · không tốn credit</p>
      </div>
    )
  }

  // ── Stats ─────────────────────────────────────────────────────────────
  const coverageCount   = blueprint.coverageShots.length
  const cutCount        = blueprint.timelineCuts.length
  const masterCount     = blueprint.masterScenes.length
  const continuityCount = blueprint.continuityGroups.length
  const transitionCount = blueprint.transitionGraph.length
  const estimatedSec    = (blueprint.estimatedDurationSec ?? renderJob.estimatedDurationSec).toFixed(1)
  const motionVerbs     = new Set(renderJob.items.map((it) => it.klingMotion)).size

  // Phase distribution
  const phaseCounts: Record<string, number> = {}
  for (const cut of blueprint.timelineCuts) {
    const p = cut.phase ?? 'unknown'
    phaseCounts[p] = (phaseCounts[p] ?? 0) + 1
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-black/8 bg-gradient-to-r from-violet-50 to-pink-50 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
              <Workflow className="h-5 w-5 text-violet-600" />
              Bước 6: Coverage & Timeline Planning
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                ⚡ LOCAL · KHÔNG KIE
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Editorial brain derive coverage + cuts + motion + transitions từ {masterCount} master scenes.
              Renderer phase sẽ chạy SAU bước này.
            </p>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-black/[0.04]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Quay lại B-Roll
          </button>
        </div>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
          <KpiCard icon={Layers}   label="Master scenes"   value={masterCount}    tone="violet" />
          <KpiCard icon={Camera}   label="Coverage shots"  value={coverageCount}  tone="cyan" />
          <KpiCard icon={Film}     label="Timeline cuts"   value={cutCount}       tone="pink" />
          <KpiCard icon={Workflow} label="Transitions"     value={transitionCount} tone="amber" />
          <KpiCard icon={Activity} label="Motion verbs"    value={motionVerbs}    tone="emerald" />
          <KpiCard icon={Gauge}    label={`Voice ${voiceDurationSec}s · Est`} value={`${estimatedSec}s`} tone="indigo" />
        </div>

        {/* Phase distribution chip strip */}
        <div className="rounded-lg border border-violet-200 bg-violet-50/40 px-4 py-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-violet-700">
            Editorial phase distribution
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(phaseCounts).sort((a, b) => b[1] - a[1]).map(([phase, count]) => (
              <span key={phase} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${phasePillTone(phase)}`}>
                {phase} <span className="ml-1 font-bold tabular-nums">{count}</span>
              </span>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-violet-600">
            <strong>Continuity groups:</strong> {continuityCount} (mỗi group chia sẻ avatar / wardrobe / lighting / product)
          </p>
        </div>

        {/* Coverage shots panel */}
        <DebugSection
          title={`Coverage shots (${coverageCount})`}
          icon={Camera}
          open={openSection === 'coverage'}
          onToggle={() => setOpenSection(openSection === 'coverage' ? null : 'coverage')}
        >
          <CoverageList shots={blueprint.coverageShots} />
        </DebugSection>

        {/* Timeline cuts panel */}
        <DebugSection
          title={`Timeline cuts (${cutCount}) — ordered`}
          icon={Film}
          open={openSection === 'cuts'}
          onToggle={() => setOpenSection(openSection === 'cuts' ? null : 'cuts')}
        >
          <CutsList cuts={blueprint.timelineCuts} />
        </DebugSection>

        {/* Motion blueprint panel */}
        <DebugSection
          title={`Motion blueprints (${renderJob.items.length} cuts mapped to Kling verbs)`}
          icon={Activity}
          open={openSection === 'motion'}
          onToggle={() => setOpenSection(openSection === 'motion' ? null : 'motion')}
        >
          <MotionList renderJob={renderJob} />
        </DebugSection>

        {/* Transition graph panel */}
        <DebugSection
          title={`Transition graph (${transitionCount} edges)`}
          icon={Workflow}
          open={openSection === 'transitions'}
          onToggle={() => setOpenSection(openSection === 'transitions' ? null : 'transitions')}
        >
          <TransitionList graph={blueprint.transitionGraph} />
        </DebugSection>
      </div>

      {/* Footer — render CTA */}
      <div className="shrink-0 border-t border-black/8 bg-gradient-to-r from-violet-50 to-pink-50 px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">
              ▶ Bước tiếp theo: Render motion clips ({cutCount} cuts · ~{(cutCount * (renderJob.creditPerClip ?? 70)).toLocaleString()} credit)
            </p>
            <p className="text-[11px] text-gray-500">
              Kling 3.0 std / KIE · ~{renderJob.creditPerClip} credit/clip · 5s mỗi clip · 2 worker song song · motion bám editorial blueprint
            </p>
          </div>
          <button
            onClick={onRenderClips}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-5 py-2 text-sm font-bold text-white shadow-md transition-colors hover:from-violet-700 hover:to-pink-700"
          >
            🎬 Render {cutCount} motion clips
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, tone,
}: {
  icon: React.ElementType
  label: string
  value: number | string
  tone: 'violet' | 'cyan' | 'pink' | 'amber' | 'emerald' | 'indigo'
}) {
  const COLORS: Record<string, string> = {
    violet:  'border-violet-200 bg-white text-violet-700',
    cyan:    'border-cyan-200 bg-white text-cyan-700',
    pink:    'border-pink-200 bg-white text-pink-700',
    amber:   'border-amber-200 bg-white text-amber-700',
    emerald: 'border-emerald-200 bg-white text-emerald-700',
    indigo:  'border-indigo-200 bg-white text-indigo-700',
  }
  return (
    <div className={`rounded-lg border px-3 py-2 ${COLORS[tone]}`}>
      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-0.5 text-lg font-bold tabular-nums text-gray-900">{value}</div>
    </div>
  )
}

// ── Phase pill tone ───────────────────────────────────────────────────────

function phasePillTone(phase: string): string {
  switch (phase) {
    case 'hook':      return 'bg-fuchsia-100 text-fuchsia-700'
    case 'body':      return 'bg-blue-100 text-blue-700'
    case 'education': return 'bg-cyan-100 text-cyan-700'
    case 'recovery':  return 'bg-emerald-100 text-emerald-700'
    case 'cta':       return 'bg-pink-100 text-pink-700'
    default:          return 'bg-gray-100 text-gray-600'
  }
}

// ── Debug section wrapper ────────────────────────────────────────────────

function DebugSection({
  title, icon: Icon, open, onToggle, children,
}: {
  title: string
  icon: React.ElementType
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-black/10 bg-white">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-black/[0.02]"
      >
        <Icon className="h-3.5 w-3.5 text-violet-600" />
        <span className="text-xs font-bold text-gray-800">{title}</span>
        <ChevronDown className={`ml-auto h-3.5 w-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-black/8 p-3">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Coverage list ─────────────────────────────────────────────────────────

function CoverageList({ shots }: { shots: CoverageShot[] }) {
  return (
    <div className="max-h-72 overflow-y-auto">
      <table className="w-full text-left text-[10px]">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-black/10 text-[9px] uppercase tracking-wider text-gray-500">
            <th className="px-2 py-1.5">#</th>
            <th className="px-2 py-1.5">master</th>
            <th className="px-2 py-1.5">shotType</th>
            <th className="px-2 py-1.5">coverageRole</th>
            <th className="px-2 py-1.5">visualRole</th>
            <th className="px-2 py-1.5">description</th>
            <th className="px-2 py-1.5 text-right">dur</th>
          </tr>
        </thead>
        <tbody>
          {shots.map((s) => (
            <tr key={s.shotId} className="border-b border-black/5 align-top text-gray-700">
              <td className="px-2 py-1.5 font-bold">{s.shotId}</td>
              <td className="px-2 py-1.5 text-gray-500">#{s.masterSceneId}</td>
              <td className="px-2 py-1.5"><code className="rounded bg-violet-50 px-1 text-[9px] text-violet-700">{s.shotType}</code></td>
              <td className="px-2 py-1.5"><code className="rounded bg-cyan-50 px-1 text-[9px] text-cyan-700">{s.coverageRole ?? '—'}</code></td>
              <td className="px-2 py-1.5"><code className="rounded bg-pink-50 px-1 text-[9px] text-pink-700">{s.visualRole}</code></td>
              <td className="px-2 py-1.5 max-w-[280px] truncate text-[10px]" title={s.shotDescription}>{s.shotDescription}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{s.durationSec.toFixed(1)}s</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Cuts list ─────────────────────────────────────────────────────────────

function CutsList({ cuts }: { cuts: TimelineCut[] }) {
  return (
    <div className="max-h-72 overflow-y-auto">
      <table className="w-full text-left text-[10px]">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-black/10 text-[9px] uppercase tracking-wider text-gray-500">
            <th className="px-2 py-1.5">#</th>
            <th className="px-2 py-1.5">shot</th>
            <th className="px-2 py-1.5">phase</th>
            <th className="px-2 py-1.5">role</th>
            <th className="px-2 py-1.5">cutType</th>
            <th className="px-2 py-1.5">transition</th>
            <th className="px-2 py-1.5 text-right">start</th>
            <th className="px-2 py-1.5 text-right">dur</th>
            <th className="px-2 py-1.5 text-right">energy</th>
          </tr>
        </thead>
        <tbody>
          {cuts.map((c) => (
            <tr key={c.cutId} className="border-b border-black/5 text-gray-700">
              <td className="px-2 py-1.5 font-bold">{c.cutId}</td>
              <td className="px-2 py-1.5 text-gray-500">shot-{c.coverageShotId}</td>
              <td className="px-2 py-1.5"><code className={`rounded px-1 text-[9px] ${phasePillTone(c.phase ?? 'unknown')}`}>{c.phase ?? '—'}</code></td>
              <td className="px-2 py-1.5"><code className="rounded bg-pink-50 px-1 text-[9px] text-pink-700">{c.visualRole}</code></td>
              <td className="px-2 py-1.5"><code className="rounded bg-amber-50 px-1 text-[9px] text-amber-700">{c.cutType ?? '—'}</code></td>
              <td className="px-2 py-1.5"><code className="rounded bg-emerald-50 px-1 text-[9px] text-emerald-700">{c.transition}</code></td>
              <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{c.startSec.toFixed(1)}s</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{c.durationSec.toFixed(1)}s</td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${energyTone(c.energy)}`}>{c.energy}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function energyTone(e: number): string {
  if (e >= 90) return 'bg-red-100 text-red-700'
  if (e >= 75) return 'bg-orange-100 text-orange-700'
  if (e >= 55) return 'bg-amber-100 text-amber-700'
  if (e >= 35) return 'bg-sky-100 text-sky-700'
  return 'bg-slate-100 text-slate-600'
}

// ── Motion list ───────────────────────────────────────────────────────────

function MotionList({ renderJob }: { renderJob: TimelineRenderJob }) {
  return (
    <div className="max-h-72 overflow-y-auto">
      <table className="w-full text-left text-[10px]">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-black/10 text-[9px] uppercase tracking-wider text-gray-500">
            <th className="px-2 py-1.5">cut</th>
            <th className="px-2 py-1.5">klingMotion</th>
            <th className="px-2 py-1.5">role</th>
            <th className="px-2 py-1.5 text-right">dur</th>
            <th className="px-2 py-1.5">promptLen</th>
          </tr>
        </thead>
        <tbody>
          {renderJob.items.map((it) => (
            <tr key={it.cutId} className="border-b border-black/5 text-gray-700">
              <td className="px-2 py-1.5 font-bold">{it.cutId}</td>
              <td className="px-2 py-1.5"><code className="rounded bg-violet-50 px-1 text-[9px] text-violet-700">{it.klingMotion}</code></td>
              <td className="px-2 py-1.5"><code className="rounded bg-pink-50 px-1 text-[9px] text-pink-700">{it.visualRole}</code></td>
              <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{it.durationSec.toFixed(1)}s</td>
              <td className="px-2 py-1.5 tabular-nums text-gray-500">{it.prompt.length} ch</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Transition list ──────────────────────────────────────────────────────

function TransitionList({ graph }: { graph: EditorialBlueprint['transitionGraph'] }) {
  return (
    <div className="max-h-60 overflow-y-auto space-y-0.5">
      {graph.map((edge, i) => (
        <div key={i} className="flex items-center gap-2 rounded px-2 py-1 text-[10px] hover:bg-black/[0.02]">
          <span className="tabular-nums text-gray-400">#{edge.fromCutId}</span>
          <ArrowRight className="h-2.5 w-2.5 text-gray-300" />
          <span className="tabular-nums font-semibold text-gray-700">#{edge.toCutId}</span>
          <code className="ml-auto rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] text-emerald-700">{edge.type}</code>
        </div>
      ))}
    </div>
  )
}
