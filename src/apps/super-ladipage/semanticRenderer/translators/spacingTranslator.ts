// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — spacingTranslator (P7)
//
// SpacingPreset → Tailwind margin-bottom class. Mobile-only.
// ─────────────────────────────────────────────────────────────────────

import type { SpacingPreset } from '../../renderContract'
import type { SectionBreathing } from '../../visualSemantics'

/** SpacingPreset → mb class for section bottom margin. */
export function spacingToMbClass(preset: SpacingPreset): string {
  switch (preset) {
    case 'snug':         return 'mb-10'
    case 'comfortable':  return 'mb-16'
    case 'airy':         return 'mb-24'
    case 'expansive':    return 'mb-32'
  }
}

/** SectionBreathing → padding-y class for vertical breathing inside section. */
export function breathingToPyClass(breathing: SectionBreathing): string {
  switch (breathing) {
    case 'cramped':       return 'py-2'
    case 'comfortable':   return 'py-4'
    case 'generous':      return 'py-8'
    case 'vast':          return 'py-12'
  }
}
