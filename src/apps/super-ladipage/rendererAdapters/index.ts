// ─────────────────────────────────────────────────────────────────────
// Renderer Adapters — public API barrel (P11)
//
// Single entry: adaptRenderContractedPage. Output: RendererAdaptedPage
// with per-section rendererOutputs (gptImage / flux / sdxl).
//
// Pure syntax translation — same upstream psychology, different
// renderer-native form. No semantic re-interpretation.
// ─────────────────────────────────────────────────────────────────────

// Entry — main adapt fns
export { adaptRenderContractedPage } from './runtime/adaptRenderContractedPage'
export { adaptToRenderers } from './runtime/adaptToRenderers'

// Per-renderer adapters (exposed for direct testing / specialized callers)
export { gptImageAdapter } from './adapters/gptImageAdapter'
export { fluxAdapter } from './adapters/fluxAdapter'
export { sdxlAdapter } from './adapters/sdxlAdapter'

// Types
export type {
  RendererKey,
  RendererPrompt,
  RendererOutputs,
  RendererAdaptedSection,
  RendererAdaptedPage,
} from './types'

// Validator
export { rendererOutputValidator } from './validators/rendererOutputValidator'
