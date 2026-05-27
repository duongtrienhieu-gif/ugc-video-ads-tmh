// ─────────────────────────────────────────────────────────────────────
// Renderer Adapters — adaptToRenderers (P11 single-section assembly)
//
// ImagePromptContract → RendererOutputs (gptImage + flux + sdxl).
// Pure orchestration: invokes each adapter, returns the bundle.
// Adapter input is the contract ONLY (no section, no intent) — adapters
// cannot semantically re-interpret.
// ─────────────────────────────────────────────────────────────────────

import type { ImagePromptContract } from '../../promptTranslation'
import type { RendererOutputs } from '../types'
import { gptImageAdapter } from '../adapters/gptImageAdapter'
import { fluxAdapter } from '../adapters/fluxAdapter'
import { sdxlAdapter } from '../adapters/sdxlAdapter'

export function adaptToRenderers(contract: ImagePromptContract): RendererOutputs {
  return {
    gptImage: gptImageAdapter(contract),
    flux: fluxAdapter(contract),
    sdxl: sdxlAdapter(contract),
  }
}
