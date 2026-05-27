// ─────────────────────────────────────────────────────────────────────
// Renderer Adapter — Flux (P11)
//
// Style: compact realism tags, bucket-ordered, comma-joined. No weights,
// no parentheses — Flux reads natural fragments without emphasis tokens.
//
// Negative handling: Flux variants support a separate negative prompt
// slot (Flux-Dev/Flux-Schnell when wrapped with neg-supporting pipelines).
// Avoidance fragments go to negativePrompt as comma-joined.
//
// LOCKED: pure syntax translator. Order: realism → composition →
// atmosphere. No model-quality tokens, no "8k", no enhancement words.
// ─────────────────────────────────────────────────────────────────────

import type { ImagePromptContract } from '../../promptTranslation'
import type { RendererPrompt } from '../types'

export function fluxAdapter(contract: ImagePromptContract): RendererPrompt {
  // ── Positive: compact bucket-ordered tag list ───────────────────
  const positive = [
    ...contract.realismFragments,
    ...contract.compositionFragments,
    ...contract.atmosphereFragments,
  ].join(', ')

  // ── Negative: avoidance fragments comma-joined ──────────────────
  const negative = contract.avoidanceFragments.join(', ')

  return {
    prompt: positive,
    negativePrompt: negative,
  }
}
