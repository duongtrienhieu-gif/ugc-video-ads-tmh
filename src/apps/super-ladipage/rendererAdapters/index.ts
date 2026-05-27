// ─────────────────────────────────────────────────────────────────────
// Renderer Adapters — public API barrel (POST-REBUILD slim)
//
// 3-renderer fragment-stacking system DELETED. Renderer routing now lives
// in imageSceneSynthesis. This module preserves only the page subtype
// (RendererAdaptedPage) for downstream orchestration + export.
// ─────────────────────────────────────────────────────────────────────

export { adaptRenderContractedPage } from './runtime/adaptRenderContractedPage'

export type {
  RendererKey,
  RendererPrompt,
  RendererOutputs,
  RendererAdaptedSection,
  RendererAdaptedPage,
} from './types'
