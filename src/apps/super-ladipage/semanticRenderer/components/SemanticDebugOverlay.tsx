// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — SemanticDebugOverlay (P8 validation loop)
//
// Per-section axis chip strip. Renders above each SemanticSection
// when debug mode is on. Exposes 7 axes user explicitly asked about:
//   sectionRole / mobilePattern / visualEnergy / readingTempo /
//   scrollWeight / proofWeight / ctaAggression
// Plus density + sectionBreathing for context.
//
// UGLY-BUT-CORRECT: pure utility chrome. No animations, no polish.
// ─────────────────────────────────────────────────────────────────────

import type { VisualSemanticsSection } from '../types'

interface Props {
  section: VisualSemanticsSection
}

export function SemanticDebugOverlay({ section }: Props) {
  const rc = section.renderContract
  const vs = section.visualSemantics

  const chips: Array<{ label: string; value: string; tone?: 'normal' | 'warn' }> = [
    { label: 'role', value: section.role },
    { label: 'pattern', value: rc.mobilePattern },
    { label: 'energy', value: rc.visualEnergy },
    { label: 'tempo', value: vs.readingTempo },
    {
      label: 'weight',
      value: section.scrollWeight,
      tone: section.scrollWeight === 'heavy' ? 'warn' : 'normal',
    },
    {
      label: 'proof',
      value: vs.proofWeight,
      tone: vs.proofWeight === 'spotlight' ? 'warn' : 'normal',
    },
    {
      label: 'cta',
      value: vs.ctaAggression,
      tone: vs.ctaAggression === 'urgent-foot' ? 'warn' : 'normal',
    },
    { label: 'density', value: section.density },
    {
      label: 'breathing',
      value: vs.sectionBreathing,
      tone: vs.sectionBreathing === 'cramped' ? 'warn' : 'normal',
    },
  ]

  return (
    <div className="mx-2 mb-3 mt-1 rounded border border-dashed border-stone-300 bg-stone-50 px-3 py-2">
      <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-stone-400">
        {section.id} · {section.wordCount}w · {section.paragraphCount}¶
      </div>
      <div className="flex flex-wrap gap-1">
        {chips.map((c) => (
          <span
            key={c.label}
            className={
              c.tone === 'warn'
                ? 'rounded-sm bg-amber-100 px-1.5 py-0.5 font-mono text-[9px] text-amber-800'
                : 'rounded-sm bg-stone-200 px-1.5 py-0.5 font-mono text-[9px] text-stone-700'
            }
          >
            <span className="text-stone-500">{c.label}:</span>{' '}
            <span className="font-medium">{c.value}</span>
          </span>
        ))}
      </div>
      {vs.psychologyNote && (
        <div className="mt-1.5 font-mono text-[9px] italic leading-snug text-stone-500">
          ↳ {vs.psychologyNote}
        </div>
      )}
    </div>
  )
}
