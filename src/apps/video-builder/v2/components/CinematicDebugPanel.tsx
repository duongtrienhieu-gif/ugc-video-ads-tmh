// ── Cinematic Debug Panel ────────────────────────────────────────────────────
// Z14 — Test + observability layer. Collapsible diagnostic panel shown above
// the storyboard cards. Three views:
//
//   1. Storyboard Debug Table — every scene with all Z11/Z12/Z13 fields
//      (sceneType, subjectFocus, visualMotif, cameraGrammar, cinematicIntent,
//       energyScore, socialPreset, transitionOut)
//   2. Diagnostics — warnings from analyzeCinematics + aggregate stats +
//      ASCII energy curve graph
//   3. Export — download full processed blueprint JSON for the renderer phase
//
// All read-only. Doesn't mutate blueprints.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react'
import { ChevronDown, AlertTriangle, AlertCircle, CheckCircle2, Download, BarChart3, Table2, FileJson } from 'lucide-react'
import type { SceneBlueprint } from '../types'
import { analyzeCinematics, buildCinematicExport } from '../services/cinematicDiagnostics'
import type { CinematicDiagnostic } from '../services/cinematicDiagnostics'

interface Props {
  blueprints: SceneBlueprint[]
  /** Original script — used as hash source for the export filename. */
  scriptSource?: string
}

export default function CinematicDebugPanel({ blueprints, scriptSource = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'table' | 'diagnostics' | 'export'>('table')

  // Recompute analysis whenever blueprints change. Cheap pure function.
  const stats = useMemo(() => analyzeCinematics(blueprints), [blueprints])

  if (blueprints.length === 0) return null

  const errorCount   = stats.warnings.filter((w) => w.level === 'error').length
  const warningCount = stats.warnings.filter((w) => w.level === 'warning').length

  const headerBg =
    errorCount > 0   ? 'bg-red-50 border-red-200'   :
    warningCount > 0 ? 'bg-amber-50 border-amber-200' :
                       'bg-emerald-50 border-emerald-200'

  const headerIcon =
    errorCount > 0   ? <AlertCircle    className="h-4 w-4 text-red-600" /> :
    warningCount > 0 ? <AlertTriangle  className="h-4 w-4 text-amber-600" /> :
                       <CheckCircle2   className="h-4 w-4 text-emerald-600" />

  const headerLabel =
    errorCount > 0   ? `Cinematic Debug — ${errorCount} ERROR · ${warningCount} warn` :
    warningCount > 0 ? `Cinematic Debug — ${warningCount} warning` :
                       'Cinematic Debug — ✓ clean'

  return (
    <div className={`rounded-lg border ${headerBg} overflow-hidden`}>
      {/* Header — click to expand */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-black/[0.02]"
      >
        {headerIcon}
        <span className="text-xs font-bold text-gray-900">{headerLabel}</span>
        <span className="ml-2 text-[10px] text-gray-500">
          {blueprints.length} scenes · avg energy {stats.averageEnergy.toFixed(0)} · variance {stats.energyVariance.toFixed(1)}
        </span>
        <ChevronDown className={`ml-auto h-3.5 w-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-black/8 bg-white">
          {/* Tab bar */}
          <div className="flex items-center gap-1 border-b border-black/8 bg-gray-50/60 px-2 py-1.5">
            <TabBtn
              active={tab === 'table'}
              icon={<Table2 className="h-3 w-3" />}
              label="Scene table"
              onClick={() => setTab('table')}
            />
            <TabBtn
              active={tab === 'diagnostics'}
              icon={<BarChart3 className="h-3 w-3" />}
              label={`Diagnostics ${errorCount + warningCount > 0 ? `(${errorCount + warningCount})` : ''}`}
              onClick={() => setTab('diagnostics')}
            />
            <TabBtn
              active={tab === 'export'}
              icon={<FileJson className="h-3 w-3" />}
              label="Export JSON"
              onClick={() => setTab('export')}
            />
          </div>

          {/* Tab body */}
          <div className="p-3">
            {tab === 'table'       && <SceneTable blueprints={blueprints} />}
            {tab === 'diagnostics' && <DiagnosticsView stats={stats} />}
            {tab === 'export'      && <ExportView blueprints={blueprints} scriptSource={scriptSource} />}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab button ──────────────────────────────────────────────────────────────

function TabBtn({
  active, icon, label, onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        active
          ? 'bg-white text-violet-700 shadow-sm ring-1 ring-violet-200'
          : 'text-gray-500 hover:bg-white/60 hover:text-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

// ─── Scene table — all 9+ cinematic fields per scene ────────────────────────

function SceneTable({ blueprints }: { blueprints: SceneBlueprint[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[10px]">
        <thead>
          <tr className="border-b border-black/10 bg-gray-50/40 text-[9px] uppercase tracking-wider text-gray-500">
            <th className="px-2 py-1.5">#</th>
            <th className="px-2 py-1.5">sceneType</th>
            <th className="px-2 py-1.5">subjectFocus</th>
            <th className="px-2 py-1.5">visualMotif</th>
            <th className="px-2 py-1.5">cameraGrammar</th>
            <th className="px-2 py-1.5">cinematicIntent</th>
            <th className="px-2 py-1.5 text-right">energy</th>
            <th className="px-2 py-1.5">socialPreset</th>
            <th className="px-2 py-1.5">transitionOut</th>
            <th className="px-2 py-1.5">CTA</th>
          </tr>
        </thead>
        <tbody>
          {blueprints.map((b, i) => (
            <tr
              key={b.sceneId}
              className="border-b border-black/5 align-top text-gray-700 hover:bg-violet-50/30"
            >
              <td className="px-2 py-1.5 font-bold text-gray-800">{i + 1}</td>
              <td className="px-2 py-1.5">
                <code className="rounded bg-fuchsia-50 px-1 py-0.5 text-[9px] text-fuchsia-700">{b.sceneType ?? '—'}</code>
              </td>
              <td className="px-2 py-1.5">
                <code className="rounded bg-violet-50 px-1 py-0.5 text-[9px] text-violet-700">{b.subjectFocus ?? '—'}</code>
              </td>
              <td className="px-2 py-1.5">
                <code className="rounded bg-cyan-50 px-1 py-0.5 text-[9px] text-cyan-700">{b.visualMotif ?? '—'}</code>
              </td>
              <td className="px-2 py-1.5">
                <code className="rounded bg-blue-50 px-1 py-0.5 text-[9px] text-blue-700">{b.cameraGrammar ?? '—'}</code>
              </td>
              <td className="px-2 py-1.5">
                <code className="rounded bg-amber-50 px-1 py-0.5 text-[9px] text-amber-700">{b.cinematicIntent ?? '—'}</code>
              </td>
              <td className="px-2 py-1.5 text-right">
                <EnergyChip value={b.energyScore ?? 0} />
              </td>
              <td className="px-2 py-1.5">
                <code className="rounded bg-pink-50 px-1 py-0.5 text-[9px] text-pink-700">{b.socialPreset ?? '—'}</code>
              </td>
              <td className="px-2 py-1.5">
                {b.transitionOut ? (
                  <code className="rounded bg-emerald-50 px-1 py-0.5 text-[9px] text-emerald-700">{b.transitionOut}</code>
                ) : (
                  <span className="text-[9px] text-gray-400">(end)</span>
                )}
              </td>
              <td className="px-2 py-1.5">
                {b.ctaFocus ? <span className="rounded bg-rose-500 px-1 py-0.5 text-[9px] font-bold text-white">CTA</span> : <span className="text-[9px] text-gray-300">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EnergyChip({ value }: { value: number }) {
  const tone =
    value >= 90 ? 'bg-red-100 text-red-700 ring-red-200' :
    value >= 75 ? 'bg-orange-100 text-orange-700 ring-orange-200' :
    value >= 55 ? 'bg-amber-100 text-amber-700 ring-amber-200' :
    value >= 35 ? 'bg-sky-100 text-sky-700 ring-sky-200' :
                  'bg-slate-100 text-slate-600 ring-slate-200'
  return (
    <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums ring-1 ${tone}`}>
      {value}
    </span>
  )
}

// ─── Diagnostics view: warnings + stats + energy curve graph ────────────────

function DiagnosticsView({ stats }: { stats: ReturnType<typeof analyzeCinematics> }) {
  return (
    <div className="space-y-3">
      {/* Top KPI strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiCard label="Avg energy"        value={stats.averageEnergy.toFixed(1)}    hint="0-100 across all scenes" />
        <KpiCard label="Variance (stddev)" value={stats.energyVariance.toFixed(1)}   hint="<12 = flat pacing" warn={stats.energyVariance < 12} />
        <KpiCard label="CTA window energy" value={stats.ctaWindowEnergy.toFixed(1)}  hint="final 20% avg" warn={stats.ctaWindowEnergy < 80} />
        <KpiCard label="Motif unique"      value={`${stats.visualMotifUniqueCount}`} hint="≥4 ideal" warn={stats.visualMotifUniqueCount < 4} />
      </div>

      {/* Energy curve graph */}
      <EnergyCurveGraph curve={stats.energyCurve} ctaCutoff={Math.floor(stats.totalScenes * 0.8)} />

      {/* Distribution mixes */}
      <DistributionRows stats={stats} />

      {/* Warnings list */}
      <WarningsList warnings={stats.warnings} />
    </div>
  )
}

function KpiCard({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className={`rounded-md border px-2.5 py-2 ${warn ? 'border-amber-300 bg-amber-50/40' : 'border-black/10 bg-white'}`}>
      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-0.5 text-base font-bold tabular-nums ${warn ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
      {hint && <p className="text-[9px] text-gray-400">{hint}</p>}
    </div>
  )
}

function EnergyCurveGraph({ curve, ctaCutoff }: { curve: number[]; ctaCutoff: number }) {
  if (curve.length === 0) return null
  // Each bar is `flex-1` so the row spans full width regardless of N
  return (
    <div className="rounded-md border border-black/10 bg-gray-50/30 p-2.5">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Energy curve</p>
        <span className="text-[9px] text-gray-400">CTA window starts at scene {ctaCutoff + 1}</span>
      </div>
      <div className="flex h-20 items-end gap-0.5 rounded bg-white p-1">
        {curve.map((v, i) => {
          const tone =
            v >= 90 ? 'bg-red-500'    :
            v >= 75 ? 'bg-orange-500' :
            v >= 55 ? 'bg-amber-400'  :
            v >= 35 ? 'bg-sky-400'    :
                      'bg-slate-300'
          const inCta = i >= ctaCutoff
          return (
            <div
              key={i}
              title={`Scene ${i + 1}: energy ${v}${inCta ? ' (CTA window)' : ''}`}
              className={`flex-1 rounded-t ${tone} transition-all ${inCta ? 'ring-1 ring-red-300' : ''}`}
              style={{ height: `${Math.max(4, v)}%` }}
            />
          )
        })}
      </div>
      <div className="mt-0.5 flex justify-between text-[8px] tabular-nums text-gray-400">
        <span>scene 1</span>
        <span>scene {curve.length}</span>
      </div>
    </div>
  )
}

function DistributionRows({ stats }: { stats: ReturnType<typeof analyzeCinematics> }) {
  const rows: Array<{ label: string; mix: Partial<Record<string, number>> }> = [
    { label: 'subjectFocus',     mix: stats.subjectFocusMix },
    { label: 'visualMotif',      mix: stats.visualMotifMix },
    { label: 'cameraGrammar',    mix: stats.cameraGrammarMix },
    { label: 'cinematicIntent',  mix: stats.cinematicIntentMix },
    { label: 'socialPreset',     mix: stats.socialPresetMix },
    { label: 'transitionOut',    mix: stats.transitionMix },
    { label: 'sceneType',        mix: stats.sceneTypeMix },
  ]
  return (
    <div className="rounded-md border border-black/10 bg-gray-50/30 p-2.5 space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Distribution</p>
      {rows.map((r) => {
        const entries = Object.entries(r.mix)
          .filter(([, v]) => (v ?? 0) > 0)
          .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
        if (entries.length === 0) return null
        return (
          <div key={r.label} className="flex items-start gap-2 text-[10px]">
            <span className="w-28 shrink-0 font-mono text-gray-500">{r.label}</span>
            <div className="flex flex-1 flex-wrap gap-1">
              {entries.map(([k, v]) => (
                <span key={k} className="rounded bg-white px-1.5 py-0.5 ring-1 ring-black/10 text-gray-700">
                  {k}<span className="ml-0.5 font-bold text-violet-600">×{v}</span>
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WarningsList({ warnings }: { warnings: CinematicDiagnostic[] }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Rule check ({warnings.length})</p>
      {warnings.map((w, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-[11px] ${
            w.level === 'error'   ? 'border-red-200 bg-red-50/40 text-red-700' :
            w.level === 'warning' ? 'border-amber-200 bg-amber-50/40 text-amber-700' :
                                    'border-emerald-200 bg-emerald-50/40 text-emerald-700'
          }`}
        >
          <span className="shrink-0 pt-px">
            {w.level === 'error'   ? <AlertCircle    className="h-3 w-3" /> :
             w.level === 'warning' ? <AlertTriangle  className="h-3 w-3" /> :
                                     <CheckCircle2   className="h-3 w-3" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5">
              <code className="rounded bg-white/60 px-1 py-0 text-[9px] text-gray-600 ring-1 ring-black/5">{w.code}</code>
              <span className="font-medium">{w.message}</span>
            </p>
            {w.scenes.length > 0 && (
              <p className="mt-0.5 text-[9px] text-gray-500">
                scenes: {w.scenes.map((s) => `#${s}`).join(', ')}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Export view ─────────────────────────────────────────────────────────────

function ExportView({ blueprints, scriptSource }: { blueprints: SceneBlueprint[]; scriptSource: string }) {
  const [copied, setCopied] = useState(false)
  const payload = useMemo(() => buildCinematicExport(blueprints, scriptSource), [blueprints, scriptSource])
  const json = JSON.stringify(payload, null, 2)
  const bytes = new Blob([json]).size

  const handleDownload = () => {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cinematic-blueprint-${payload.scriptHash}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* silent */ }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-black/10 bg-gray-50/40 px-2.5 py-2">
        <FileJson className="h-3.5 w-3.5 text-violet-600" />
        <p className="text-[11px] font-semibold text-gray-700">
          Cinematic Blueprint Export — {(bytes / 1024).toFixed(1)} KB · {blueprints.length} scenes · hash <code className="rounded bg-white px-1 py-0 text-[10px] text-violet-700">{payload.scriptHash}</code>
        </p>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-md border border-black/10 bg-white px-2 py-1 text-[10px] font-medium text-gray-600 hover:bg-black/[0.04]"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm hover:bg-violet-700"
          >
            <Download className="h-3 w-3" /> Download .json
          </button>
        </div>
      </div>
      <pre className="max-h-72 overflow-auto rounded-md border border-black/10 bg-gray-900 px-3 py-2 font-mono text-[10px] leading-relaxed text-emerald-200">
        {json}
      </pre>
      <p className="text-[10px] text-gray-500">
        Payload chứa toàn bộ blueprint <em>sau khi đã xử lý</em> (normalize → motif → preset → cinematic assign → timeline director). Dùng cho phase renderer kế tiếp.
      </p>
    </div>
  )
}
