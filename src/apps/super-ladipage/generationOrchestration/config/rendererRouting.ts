// ─────────────────────────────────────────────────────────────────────
// Generation Orchestration — renderer routing (P12)
//
// Deterministic decision table mapping ImageIntent → RendererKey.
// Pure declarative routing — NO autonomous creative decisions, NO
// quality scoring, NO renderer-specific psychology re-interpretation.
//
// Priority order (first match wins):
//   1. Screenshot / proof artifact            → SDXL  (text/UI rendering)
//   2. Raw handheld / documentary realism     → Flux  (compact realism)
//   3. Close emotional / tension / hero       → GPT Image (sentence control)
//   4. Default fallback                       → GPT Image (general baseline)
// ─────────────────────────────────────────────────────────────────────

import type { ImageIntent } from '../../imageSemantics'
import type { RendererKey } from '../../rendererAdapters'

export function selectRenderer(intent: ImageIntent): RendererKey {
  // ── Priority 1: Screenshot / proof artifact → SDXL ──────────────
  if (
    intent.proofFeel === 'screenshot' ||
    intent.framingStyle === 'screenshot-frame' ||
    intent.imageRole === 'proof-callout'
  ) {
    return 'sdxl'
  }

  // ── Priority 2: Raw handheld / documentary → Flux ───────────────
  if (
    intent.polishLevel === 'raw-handheld' ||
    intent.realismLevel === 'documentary-realism'
  ) {
    return 'flux'
  }

  // ── Priority 3: Close emotional / tension / hero → GPT Image ────
  if (
    intent.framingStyle === 'close-emotional' ||
    intent.emotionalState === 'tension' ||
    intent.imageRole === 'hero-anchor'
  ) {
    return 'gptImage'
  }

  // ── Default: GPT Image for general emotional/lifestyle ──────────
  return 'gptImage'
}
