// ═════════════════════════════════════════════════════════════════════
// Renderer Adapters — type definitions
//
// POST-REBUILD (2026-05-27): the per-section prompt is now produced by
// imageSceneSynthesis (single Gemini call per image) — NOT by fragment
// translation. RendererOutputs is therefore a SLIM passthrough holder of
// the synthesized scene prompt, indexed by the active renderer.
//
// Routing now decides per-section whether 'gptImage' (gpt-image-2) or
// 'gpt4o' (gpt-4o-image with reference lock) is used — old 'flux' / 'sdxl'
// keys removed.
// ═════════════════════════════════════════════════════════════════════

import type { ImagePromptSection, ImagePromptPage } from '../promptTranslation'

// ─── Renderer key (LOCKED — 2 KIE-backed renderers) ───────────────
//
// gptImage = KIE gpt-image-2  → cheap no-reference flat-lays (object-trace
//                                without product reference only)
// gpt4o    = KIE gpt-4o-image → premium with up-to-5 reference URLs lock
//                                (used for character continuity + product)

export type RendererKey = 'gptImage' | 'gpt4o'

// ─── Single renderer output (slim post-rebuild) ───────────────────

export interface RendererPrompt {
  /** The synthesized scene prompt (output of imageSceneSynthesis). */
  prompt: string
  /** Negative prompt where supported. Undefined for KIE endpoints. */
  negativePrompt?: string
}

// ─── Outputs (one prompt per renderer route) ──────────────────────

export interface RendererOutputs {
  gptImage?: RendererPrompt
  gpt4o?: RendererPrompt
}

// ─── RendererAdaptedSection extends ImagePromptSection ─────────────

export interface RendererAdaptedSection extends ImagePromptSection {
  /** Present only when imagePromptContract exists (imageRole !== 'none'). */
  rendererOutputs?: RendererOutputs
}

// ─── RendererAdaptedPage extends ImagePromptPage ──────────────────

export interface RendererAdaptedPage extends ImagePromptPage {
  sections: RendererAdaptedSection[]
  /** Soft warnings from rendererOutputValidator (governance preservation). */
  rendererAdapterWarnings: string[]
  /** Count of sections that received rendererOutputs. */
  adaptedSectionCount: number
}
