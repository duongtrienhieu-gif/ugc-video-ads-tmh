// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — SemanticMobilePage (P7 top-level + P8 validation)
//
// Renders VisualSemanticsPage as single-column mobile preview. Iterates
// sections, dispatches each to SemanticSection.
//
// P8 view modes (validation loop):
//   - clean       → bare preview, no chrome. Screenshot/copy-ready for
//                   Ladipage workflow. Default mode.
//   - debug       → per-section axis chip strip via SemanticDebugOverlay.
//   - diagnostics → clean preview + DiagnosticsPanel below.
//   - tuning      → clean preview + TuningPanel below.
//
// Tuning state is internal — applyTuning runs in useMemo on every knob
// change. Original page is untouched (immutability).
// ─────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react'
import { AlertTriangle, Eye, Bug, Activity, Sliders, Share2 } from 'lucide-react'
import type { SemanticMobilePageProps, SemanticViewMode, VisualSemanticsPage } from '../types'
import { SemanticSection } from './SemanticSection'
import { SemanticDebugOverlay } from './SemanticDebugOverlay'
import { DiagnosticsPanel } from './DiagnosticsPanel'
import { TuningPanel } from './TuningPanel'
import { ExportPanel } from './ExportPanel'
import { SessionMetricsPanel } from './SessionMetricsPanel'
import { applyTuning } from '../tuning/applyTuning'
import { IDENTITY_KNOBS, isIdentityKnobs, type TuningKnobs } from '../tuning/types'
import { scrollDiagnostics } from '../diagnostics/scrollDiagnostics'
import type { ExportablePage } from '../../exportPipeline'

const VIEW_MODES: Array<{ key: SemanticViewMode; label: string; Icon: typeof Eye }> = [
  { key: 'clean', label: 'Clean', Icon: Eye },
  { key: 'debug', label: 'Debug', Icon: Bug },
  { key: 'diagnostics', label: 'Diagnostics', Icon: Activity },
  { key: 'tuning', label: 'Tuning', Icon: Sliders },
  { key: 'export', label: 'Export', Icon: Share2 },
]

export function SemanticMobilePage({
  page,
  characterName,
  session,
  onRegenerateImage,
  onRegenerateSection,
  onRegenerateProof,
  onApproveSection,
  onRejectSection,
  onToggleReviewFlag,
  onRetryFailedSection,
}: SemanticMobilePageProps) {
  const [viewMode, setViewMode] = useState<SemanticViewMode>('clean')
  const [knobs, setKnobs] = useState<TuningKnobs>(IDENTITY_KNOBS)

  // Apply tuning deterministically — identity short-circuits to original ref
  const tunedPage = useMemo(() => applyTuning(page, knobs), [page, knobs])

  // Recompute diagnostics on tuned page when in diagnostics view
  const report = useMemo(
    () => (viewMode === 'diagnostics' ? scrollDiagnostics(tunedPage) : null),
    [tunedPage, viewMode],
  )

  const showDebug = viewMode === 'debug'
  const showDiagnostics = viewMode === 'diagnostics'
  const showTuning = viewMode === 'tuning'
  const showExport = viewMode === 'export'
  const isClean = viewMode === 'clean'

  // P14 — ExportPanel needs an ExportablePage. Use runtime narrowing.
  const exportablePage = hasExportGuide(tunedPage) ? (tunedPage as ExportablePage) : null

  return (
    <div className="bg-stone-50 min-h-full">
      {/* View-mode toolbar (sticky-ish at top) */}
      {!isClean ? (
        <ViewModeToolbar viewMode={viewMode} onChange={setViewMode} tuned={!isIdentityKnobs(knobs)} />
      ) : (
        <ViewModeToolbar viewMode={viewMode} onChange={setViewMode} tuned={!isIdentityKnobs(knobs)} clean />
      )}

      {/* Mobile-frame container — simulates mobile viewport on desktop */}
      <div className="max-w-md mx-auto bg-white shadow-sm border-x border-stone-200">

        {/* Top spacer */}
        <div className="h-8" />

        {/* Sections */}
        {tunedPage.sections.map((section) => (
          <SemanticSection
            key={section.id}
            section={section}
            characterName={characterName}
            showDebug={showDebug}
            showExportActions={showExport}
            showSessionUI={Boolean(session) && (showDebug || showExport)}
            sectionState={session?.sections[section.id]}
            onRegenerateImage={onRegenerateImage}
            onRegenerateSection={onRegenerateSection}
            onRegenerateProof={onRegenerateProof}
            onApproveSection={onApproveSection}
            onRejectSection={onRejectSection}
            onToggleReviewFlag={onToggleReviewFlag}
            onRetryFailedSection={onRetryFailedSection}
          />
        ))}

        {/* Bottom spacer */}
        <div className="h-16" />

        {/* P8 tuning panel — only in tuning view */}
        {showTuning && <TuningPanel knobs={knobs} onChange={setKnobs} />}

        {/* P8 diagnostics panel — only in diagnostics view */}
        {showDiagnostics && report && <DiagnosticsPanel report={report} />}

        {/* INT — session observability metrics panel (appended to
            diagnostics view when session is available). */}
        {showDiagnostics && session && <SessionMetricsPanel session={session} />}

        {/* P14 export panel — only in export view.
            INT: pass sessionId for hosted preview share buttons. */}
        {showExport && exportablePage && (
          <ExportPanel page={exportablePage} sessionId={session?.sessionId} />
        )}

        {/* P7 debug footer — page metrics + validator warnings.
            Hidden in clean mode for Ladipage screenshot workflow. */}
        {!isClean && (
          <div className="px-6 py-6 border-t border-stone-200 bg-stone-100 text-[10px] text-stone-500 space-y-2">
            <p className="font-mono uppercase tracking-wider">
              Semantic preview · {tunedPage.totalSections} sections · {tunedPage.totalWordCount} words · ~{tunedPage.estimatedScrollTimeSec}s scroll
              {!isIdentityKnobs(knobs) && (
                <span className="ml-2 rounded-sm bg-amber-100 px-1.5 py-0.5 text-amber-800">
                  tuned
                </span>
              )}
            </p>
            {tunedPage.fatigueWarnings.length > 0 && (
              <WarningList icon="fatigue" label="fatigue warning" items={tunedPage.fatigueWarnings} />
            )}
            {tunedPage.consistencyWarnings.length > 0 && (
              <WarningList icon="contract" label="render contract warning" items={tunedPage.consistencyWarnings} />
            )}
            {tunedPage.semanticsWarnings.length > 0 && (
              <WarningList icon="semantics" label="visual semantics warning" items={tunedPage.semanticsWarnings} />
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ─── ViewModeToolbar ──────────────────────────────────────────────

interface ToolbarProps {
  viewMode: SemanticViewMode
  onChange: (m: SemanticViewMode) => void
  tuned: boolean
  clean?: boolean
}

function ViewModeToolbar({ viewMode, onChange, tuned, clean = false }: ToolbarProps) {
  return (
    <div
      className={
        clean
          ? 'sticky top-0 z-10 bg-stone-50/90 backdrop-blur border-b border-stone-200 px-3 py-2'
          : 'sticky top-0 z-10 bg-stone-50/90 backdrop-blur border-b border-stone-200 px-3 py-2'
      }
    >
      <div className="max-w-md mx-auto flex items-center gap-1">
        {VIEW_MODES.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={
              viewMode === key
                ? 'flex items-center gap-1 rounded-sm bg-stone-800 px-2 py-1 font-mono text-[10px] text-white'
                : 'flex items-center gap-1 rounded-sm bg-white border border-stone-300 px-2 py-1 font-mono text-[10px] text-stone-700 hover:bg-stone-100'
            }
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
        {tuned && (
          <span className="ml-auto rounded-sm bg-amber-100 px-1.5 py-0.5 font-mono text-[9px] uppercase text-amber-800">
            tuned
          </span>
        )}
      </div>
    </div>
  )
}

// ─── WarningList ──────────────────────────────────────────────────

interface WarningListProps {
  icon: 'fatigue' | 'contract' | 'semantics'
  label: string
  items: string[]
}

function WarningList({ label, items }: WarningListProps) {
  return (
    <div className="mt-2">
      <p className="flex items-center gap-1 text-amber-700 font-mono">
        <AlertTriangle className="h-3 w-3" />
        {items.length} {label}{items.length > 1 ? 's' : ''}:
      </p>
      <ul className="mt-1 ml-4 list-disc text-amber-700 italic">
        {items.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────────────

/** Runtime type guard — P14. Checks whether sections carry exportGuide
 *  (i.e., the upstream pack went through the full P14 derivation). */
function hasExportGuide(page: VisualSemanticsPage): boolean {
  const first = page.sections[0] as { exportGuide?: unknown } | undefined
  return Boolean(first?.exportGuide)
}

// Re-export overlay so consumers wanting standalone debug have it
export { SemanticDebugOverlay }
