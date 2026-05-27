// ─────────────────────────────────────────────────────────────────────
// Renderer Adapter — GPT Image (P11)
//
// Style: conversational, natural sentence flow. Commas between fragments,
// occasional "and" connector where it reads naturally.
//
// Negative handling: GPT Image / DALL-E-style models don't accept a
// separate negative prompt — avoidance is embedded INLINE in the positive
// prompt via "avoiding [list]" tail. This preserves governance.
//
// LOCKED: pure syntax translator. No fragment re-ordering for "flow",
// no fragment removal, no aesthetic embellishment.
// ─────────────────────────────────────────────────────────────────────

import type { ImagePromptContract } from '../../promptTranslation'
import type { RendererPrompt } from '../types'

export function gptImageAdapter(contract: ImagePromptContract): RendererPrompt {
  // ── Positive assembly: bucket-ordered, comma-joined ─────────────
  const positiveParts = [
    ...contract.realismFragments,
    ...contract.compositionFragments,
    ...contract.atmosphereFragments,
  ]
  const positiveBody = positiveParts.join(', ')

  // ── Inline avoidance tail — governance survives in positive slot ─
  // Format: "; avoiding studio perfection, over-polish, ..."
  const avoidanceTail =
    contract.avoidanceFragments.length > 0
      ? `; avoiding ${contract.avoidanceFragments.join(', ')}`
      : ''

  return {
    prompt: positiveBody + avoidanceTail,
    // GPT Image does not accept separate negativePrompt — leave undefined
    negativePrompt: undefined,
  }
}
