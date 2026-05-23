// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — PACING ORCHESTRATION (v4.6)
//
// Cross-pack rhythm orchestration. Mỗi section có pacingClass — chống
// monotony bằng cách vary text/image density qua sections.
//
// Variety check: 5 distinct classes across 11 sections. Section 3, 5, 11
// = text-breathing (silence pauses). Section 10 = image-led (testimonials).
// Section 1 = impact (snap + anchor). Others mixed or dense-narrative.
// ─────────────────────────────────────────────────────────────────────

import type { PacingClass, SectionId } from '../types'

export interface PacingClassSpec {
  class: PacingClass
  description: string
  /** Brief 1-line directive for prompt injection. */
  instruction: string
  /** Text length budget (words). */
  textLengthGuide: string
  /** Image weight. */
  imageWeight: string
}

export const PACING_CLASSES: Record<PacingClass, PacingClassSpec> = {
  'impact': {
    class: 'impact',
    description: 'Strong opening — emotional snap + anchor image',
    instruction: 'short impactful sentences early, transition to medium flow, anchor image carries identity',
    textLengthGuide: '80-120 words',
    imageWeight: '2 images (anchor-face + emotion-detail)',
  },
  'text-breathing': {
    class: 'text-breathing',
    description: 'High text density, minimal/no image — silence pause for reflection',
    instruction: 'reflective monologue style, longer flowing sentences with breathing pauses, image minimal or absent',
    textLengthGuide: '100-150 words',
    imageWeight: '0-1 image (silence-frame OK)',
  },
  'dense-narrative': {
    class: 'dense-narrative',
    description: 'Solid narrative text + 1 supporting image',
    instruction: 'continuous narrative with embodied detail, 1 supporting image — text leads',
    textLengthGuide: '90-130 words',
    imageWeight: '1 image (continuity required)',
  },
  'mixed': {
    class: 'mixed',
    description: 'Balanced text + image — moderate density',
    instruction: 'balanced text-image, conversational flow with 1-2 supporting visuals',
    textLengthGuide: '70-110 words',
    imageWeight: '1-2 images',
  },
  'image-led': {
    class: 'image-led',
    description: 'Multiple images, low text density — testimonial section only',
    instruction: 'short intro then images carry the section, text minimal (mini quotes per image)',
    textLengthGuide: '30-60 words intro + 3 short reviews',
    imageWeight: '3 images (testimonial grid)',
  },
}

/** Per-section pacing class assignment.
 *  Variety check: hook-impact / text-breathing × 3 / dense × 2 / mixed × 4 / image-led × 1 */
export const SECTION_PACING_MAP: Record<SectionId, PacingClass> = {
  'hook-interrupt':    'impact',
  'daily-friction':    'dense-narrative',
  'internal-fear':     'text-breathing',
  'failed-attempts':   'mixed',
  'belief-shift':      'text-breathing',
  'soft-reveal':       'mixed',
  'micro-reward':      'mixed',
  'emotional-payoff':  'mixed',
  'reflection-trust':  'dense-narrative',
  'trust-continuity':  'image-led',
  'soft-cta':          'text-breathing',
}

/** 1-line directive for section directive injection. */
export function pacingClassDirective(sectionId: SectionId): string {
  const cls = SECTION_PACING_MAP[sectionId]
  const spec = PACING_CLASSES[cls]
  return `PACING: ${cls} — ${spec.instruction} (${spec.textLengthGuide}, ${spec.imageWeight})`
}

/** Validate pacing variety — flag if 3+ adjacent sections share class. */
export function validatePacingVariety(
  sectionIds: SectionId[],
): { valid: boolean; violations: Array<{ idx: number; class: PacingClass }> } {
  const violations: Array<{ idx: number; class: PacingClass }> = []
  for (let i = 0; i < sectionIds.length - 2; i++) {
    const a = SECTION_PACING_MAP[sectionIds[i]]
    const b = SECTION_PACING_MAP[sectionIds[i + 1]]
    const c = SECTION_PACING_MAP[sectionIds[i + 2]]
    if (a === b && b === c) {
      violations.push({ idx: i, class: a })
    }
  }
  return { valid: violations.length === 0, violations }
}
