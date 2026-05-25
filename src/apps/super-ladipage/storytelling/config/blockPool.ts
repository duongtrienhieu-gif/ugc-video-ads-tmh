// ═════════════════════════════════════════════════════════════════════
// Storytelling Engine — BLOCK POOL (Reader-Immersion architecture)
//
// 15 canonical psychological blocks organized into 4 phases. Resolver
// picks 13-15 per pack (flex by niche / emotional intensity).
//
// Architecture principle: each block = PSYCHOLOGICAL TRANSITION carried
// by the reader, NOT a story scene carried by the narrator. Reader is
// emotional center of gravity throughout the pack.
//
// What each block carries:
//   - phase                  → which of 4 conversion phases
//   - psychologicalFunction  → what this block DOES to reader's mind
//   - youIBalance            → who's the emotional center for this block
//   - intent                 → 1-line psychological purpose
//   - required               → can resolver skip this block?
//   - paragraphTarget        → soft pacing target (validator warns if out)
//   - samplingHooks          → which sampling objects to inject
//
// Block ordering = pack ordering. Resolver outputs in this sequence.
// ─────────────────────────────────────────────────────────────────────

import type { BlockBlueprint, BlockId } from '../types'

export const BLOCK_POOL: Record<BlockId, BlockBlueprint> = {
  // ─── Phase 1 — RECOGNITION (4 blocks, reader-heavy) ─────────────────

  'self-recognition-hook': {
    id: 'self-recognition-hook',
    phase: 'recognition',
    psychologicalFunction: 'mirror-recognition',
    youIBalance: 'reader-heavy',
    intent: 'Reader feels "đang nói về mình" trong 1-3 giây. You-first opener + micro moment + hidden emotion + bridge.',
    required: true,
    paragraphTarget: { min: 3, max: 5 },
    samplingHooks: { performanceHookLayer: true },
  },

  'daily-micro-friction': {
    id: 'daily-micro-friction',
    phase: 'recognition',
    psychologicalFunction: 'surface-friction',
    youIBalance: 'reader-heavy',
    intent: 'Surface daily behaviors reader normalizes nhưng đã thành friction. Embodied micro-moments reader recognizes.',
    required: true,
    paragraphTarget: { min: 3, max: 4 },
    samplingHooks: { readerMirrorBeat: true },
  },

  'hidden-emotional-truth': {
    id: 'hidden-emotional-truth',
    phase: 'recognition',
    psychologicalFunction: 'name-hidden-feeling',
    youIBalance: 'reader-heavy',
    intent: 'Name the unspoken feeling reader carries silently. Surface without dramatizing.',
    required: true,
    paragraphTarget: { min: 2, max: 4 },
    samplingHooks: { readerMirrorBeat: true },
  },

  'not-alone-bridge': {
    id: 'not-alone-bridge',
    phase: 'recognition',
    psychologicalFunction: 'reduce-isolation',
    youIBalance: 'reader-heavy',
    intent: '"Không phải mỗi mình bạn" — reduce isolation. Narrator may surface implicitly here but reader still the center.',
    required: true,
    paragraphTarget: { min: 2, max: 3 },
    samplingHooks: { readerMirrorBeat: true },
  },

  // ─── Phase 2 — TRUST + RESISTANCE ALIGNMENT (3-4 blocks) ────────────

  'narrator-validation-entry': {
    id: 'narrator-validation-entry',
    phase: 'trust-alignment',
    psychologicalFunction: 'narrator-join',
    youIBalance: 'narrator-validation',
    intent: 'Narrator joins reader from lived experience. NOT protagonist — validator. "Tôi cũng từng đứng đó."',
    required: true,
    paragraphTarget: { min: 3, max: 4 },
    samplingHooks: { readerMirrorBeat: true },
  },

  'shared-failed-attempts': {
    id: 'shared-failed-attempts',
    phase: 'trust-alignment',
    psychologicalFunction: 'shared-frustration',
    youIBalance: 'narrator-validation',
    intent: 'Frustration loop — both reader and narrator tried, both failed. Object-storytelling of tried-and-failed.',
    required: true,
    paragraphTarget: { min: 3, max: 5 },
    samplingHooks: { readerMirrorBeat: true },
  },

  'skepticism-alignment': {
    id: 'skepticism-alignment',
    phase: 'trust-alignment',
    psychologicalFunction: 'anticipate-resistance',
    youIBalance: 'narrator-validation',
    intent: 'Anticipate reader\'s "yeah but..." Validate their skepticism before reframe. Build trust through honest doubt.',
    required: false,
    paragraphTarget: { min: 2, max: 4 },
    samplingHooks: { readerMirrorBeat: true },
  },

  'belief-shift': {
    id: 'belief-shift',
    phase: 'trust-alignment',
    psychologicalFunction: 'reframe-belief',
    youIBalance: 'narrator-validation',
    intent: 'External catalyst + reframe + permission. CONVERSION CORE. Product BRIEF/ABSENT here.',
    required: true,
    paragraphTarget: { min: 3, max: 5 },
    samplingHooks: { beliefCatalyst: true, readerMirrorBeat: true },
  },

  // ─── Phase 3 — SOLUTION OPENING (2-3 blocks) ────────────────────────

  'natural-product-discovery': {
    id: 'natural-product-discovery',
    phase: 'solution-opening',
    psychologicalFunction: 'organic-discovery',
    youIBalance: 'narrator-validation',
    intent: 'Product emerges naturally through discovery channel. Low expectation, reluctant tone. NO ecommerce interruption.',
    required: true,
    paragraphTarget: { min: 2, max: 4 },
    samplingHooks: { discoveryChannel: true },
  },

  'why-this-felt-different': {
    id: 'why-this-felt-different',
    phase: 'solution-opening',
    psychologicalFunction: 'mechanism-through-emotion',
    youIBalance: 'narrator-validation',
    intent: 'Explain mechanism through felt difference, not feature dump. "Cái khác là focus vào cơ thể bên dưới..."',
    required: true,
    paragraphTarget: { min: 2, max: 4 },
    samplingHooks: {},
  },

  'soft-mechanism-compare': {
    id: 'soft-mechanism-compare',
    phase: 'solution-opening',
    psychologicalFunction: 'emotional-compare',
    youIBalance: 'narrator-validation',
    intent: 'Soft compare vs old approach via emotional positioning. "Trước, tôi cố che bên ngoài; cơ thể bên trong vẫn mệt."',
    required: false,
    paragraphTarget: { min: 2, max: 3 },
    samplingHooks: {},
  },

  // ─── Phase 4 — FUTURE SELF IMMERSION (4 blocks) ─────────────────────

  'micro-transformation': {
    id: 'micro-transformation',
    phase: 'future-self',
    psychologicalFunction: 'specific-micro-win',
    youIBalance: 'narrator-validation',
    intent: 'Small specific wins noticed retrospectively. NOT miracle. "Một sáng tôi nhận ra không còn nghĩ tới X liên tục..."',
    required: true,
    paragraphTarget: { min: 3, max: 4 },
    samplingHooks: { payoffArchetype: true },
  },

  'emotional-wins': {
    id: 'emotional-wins',
    phase: 'future-self',
    psychologicalFunction: 'quality-of-life-shift',
    youIBalance: 'future-reader',
    intent: 'Quality-of-life shift felt through daily ease. Reader projects forward via narrator\'s gentle examples.',
    required: true,
    paragraphTarget: { min: 3, max: 4 },
    samplingHooks: { payoffArchetype: true, readerMirrorBeat: true },
  },

  'social-proof': {
    id: 'social-proof',
    phase: 'future-self',
    psychologicalFunction: 'normalize-via-others',
    youIBalance: 'narrator-validation',
    intent: 'Fragmented imperfect peer voices. NOT polished testimonials. Reviews come from SEPARATE generation pass.',
    required: true,
    paragraphTarget: { min: 1, max: 1 },
    samplingHooks: { reviewSlot: true },
  },

  'future-self-cta': {
    id: 'future-self-cta',
    phase: 'future-self',
    psychologicalFunction: 'future-self-invitation',
    youIBalance: 'future-reader',
    intent: 'Emotional projection + soft future-self invitation. NO "buy now". Reader feels "maybe I should finally take care of myself".',
    required: true,
    paragraphTarget: { min: 2, max: 3 },
    samplingHooks: { payoffArchetype: true, softCta: true },
  },
}

/** Canonical ordering of all 15 blocks (Phase 1→4 sequence). */
export const ALL_BLOCK_IDS: BlockId[] = [
  // Phase 1
  'self-recognition-hook',
  'daily-micro-friction',
  'hidden-emotional-truth',
  'not-alone-bridge',
  // Phase 2
  'narrator-validation-entry',
  'shared-failed-attempts',
  'skepticism-alignment',
  'belief-shift',
  // Phase 3
  'natural-product-discovery',
  'why-this-felt-different',
  'soft-mechanism-compare',
  // Phase 4
  'micro-transformation',
  'emotional-wins',
  'social-proof',
  'future-self-cta',
]

/** Helper — return blocks belonging to a phase, in canonical order. */
export function blocksForPhase(phase: BlockBlueprint['phase']): BlockBlueprint[] {
  return ALL_BLOCK_IDS
    .map((id) => BLOCK_POOL[id])
    .filter((b) => b.phase === phase)
}
