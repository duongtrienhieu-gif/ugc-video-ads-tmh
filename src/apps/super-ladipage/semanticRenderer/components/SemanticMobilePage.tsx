// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — SemanticMobilePage (P7 top-level renderer)
//
// Renders VisualSemanticsPage as single-column mobile preview. Iterates
// sections, dispatches each to SemanticSection. Adds debug footer with
// scroll metrics + fatigue warnings.
//
// UGLY-BUT-CORRECT: minimal chrome, intentional. Validates scroll rhythm.
// ─────────────────────────────────────────────────────────────────────

import { AlertTriangle } from 'lucide-react'
import type { SemanticMobilePageProps } from '../types'
import { SemanticSection } from './SemanticSection'

export function SemanticMobilePage({ page, characterName }: SemanticMobilePageProps) {
  return (
    <div className="bg-stone-50 min-h-full">
      {/* Mobile-frame container — simulates mobile viewport on desktop */}
      <div className="max-w-md mx-auto bg-white shadow-sm border-x border-stone-200">

        {/* Top spacer */}
        <div className="h-8" />

        {/* Sections */}
        {page.sections.map((section) => (
          <SemanticSection
            key={section.id}
            section={section}
            characterName={characterName}
          />
        ))}

        {/* Bottom spacer */}
        <div className="h-16" />

        {/* Debug footer — page metrics + warnings (P7 validation aid) */}
        <div className="px-6 py-6 border-t border-stone-200 bg-stone-100 text-[10px] text-stone-500 space-y-2">
          <p className="font-mono uppercase tracking-wider">
            Semantic preview · {page.totalSections} sections · {page.totalWordCount} words · ~{page.estimatedScrollTimeSec}s scroll
          </p>
          {page.fatigueWarnings.length > 0 && (
            <div className="mt-2">
              <p className="flex items-center gap-1 text-amber-700 font-mono">
                <AlertTriangle className="h-3 w-3" />
                {page.fatigueWarnings.length} fatigue warning(s):
              </p>
              <ul className="mt-1 ml-4 list-disc text-amber-700 italic">
                {page.fatigueWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {page.consistencyWarnings.length > 0 && (
            <div className="mt-2">
              <p className="flex items-center gap-1 text-amber-700 font-mono">
                <AlertTriangle className="h-3 w-3" />
                {page.consistencyWarnings.length} render contract warning(s):
              </p>
              <ul className="mt-1 ml-4 list-disc text-amber-700 italic">
                {page.consistencyWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {page.semanticsWarnings.length > 0 && (
            <div className="mt-2">
              <p className="flex items-center gap-1 text-amber-700 font-mono">
                <AlertTriangle className="h-3 w-3" />
                {page.semanticsWarnings.length} visual semantics warning(s):
              </p>
              <ul className="mt-1 ml-4 list-disc text-amber-700 italic">
                {page.semanticsWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
