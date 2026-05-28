// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — TuningPanel (P8 validation loop)
//
// 5 knobs, each integer in [-2, +2]. -2/-1/0/+1/+2 button row per knob.
// Reset button restores identity. Live update via onChange callback.
//
// UGLY-BUT-CORRECT: utility panel, no slider polish — discrete buttons.
// ─────────────────────────────────────────────────────────────────────

import type { TuningKnobs, TuningKnobValue } from '../tuning/types'
import { IDENTITY_KNOBS, isIdentityKnobs } from '../tuning/types'

interface Props {
  knobs: TuningKnobs
  onChange: (next: TuningKnobs) => void
}

const KNOB_DEFS: Array<{
  key: keyof TuningKnobs
  label: string
  hintLow: string
  hintHigh: string
}> = [
  // P14 — productization knobs (realism + polish first, per marketer priority)
  { key: 'realismLevel', label: 'Realism', hintLow: 'documentary', hintHigh: 'stylized' },
  { key: 'polishLevel', label: 'Polish', hintLow: 'raw-handheld', hintHigh: 'high-polish' },
  { key: 'breathing', label: 'Breathing', hintLow: 'cramped', hintHigh: 'vast' },
  { key: 'density', label: 'Density', hintLow: 'airy', hintHigh: 'tight' },
  { key: 'proofVisibility', label: 'Proof visibility', hintLow: 'invisible', hintHigh: 'spotlight' },
  { key: 'imageFrequency', label: 'Image frequency', hintLow: 'text-only', hintHigh: 'image-heavy' },
  { key: 'ctaAggression', label: 'CTA aggression', hintLow: 'hidden', hintHigh: 'urgent' },
]

const STEPS: TuningKnobValue[] = [-2, -1, 0, 1, 2]

export function TuningPanel({ knobs, onChange }: Props) {
  const setKnob = (key: keyof TuningKnobs, value: TuningKnobValue) => {
    onChange({ ...knobs, [key]: value })
  }

  return (
    <div className="px-6 py-4 border-t border-stone-200 bg-stone-100 space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[11px] uppercase tracking-wider text-stone-700">
          Semantic tuning {isIdentityKnobs(knobs) && '· identity'}
        </p>
        {!isIdentityKnobs(knobs) && (
          <button
            onClick={() => onChange(IDENTITY_KNOBS)}
            className="font-mono text-[10px] text-stone-600 underline hover:text-stone-900"
          >
            reset
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {KNOB_DEFS.map((def) => {
          const value = knobs[def.key]
          return (
            <div key={def.key} className="space-y-1">
              <div className="flex items-center justify-between font-mono text-[10px]">
                <span className="font-medium text-stone-700">{def.label}</span>
                <span className="text-stone-400">
                  {def.hintLow} ← → {def.hintHigh}
                </span>
              </div>
              <div className="flex gap-1">
                {STEPS.map((step) => (
                  <button
                    key={step}
                    onClick={() => setKnob(def.key, step)}
                    className={
                      value === step
                        ? 'flex-1 rounded-sm bg-stone-800 px-2 py-1 font-mono text-[10px] text-white'
                        : 'flex-1 rounded-sm bg-stone-200 px-2 py-1 font-mono text-[10px] text-stone-700 hover:bg-stone-300'
                    }
                  >
                    {step > 0 ? `+${step}` : step}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <p className="font-mono text-[9px] italic leading-snug text-stone-500">
        Tuning shifts existing enum values only. No prompt mutation, no paragraph rewriting.
        Use this to dial pacing before copying into real Ladipage pages.
      </p>
    </div>
  )
}
