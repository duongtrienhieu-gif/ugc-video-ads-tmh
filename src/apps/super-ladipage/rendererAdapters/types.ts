// ═════════════════════════════════════════════════════════════════════
// Renderer Adapters — type definitions (P11 renderer-native assembly)
//
// Translates ImagePromptContract → renderer-native prompts. Adapters
// are pure SYNTAX TRANSLATORS, not creative writers. They preserve
// upstream psychology and only change syntactic form per renderer.
//
// LOCKED: 3 renderers only (gptImage / flux / sdxl). No Midjourney —
// MJ drifts aesthetic-heavy and poisons governance.
//
// LOCKED: adapter input is the contract ONLY (6 fragment buckets).
// Adapters do NOT see imageIntent, section role, or visualSemantics.
// This prevents semantic re-interpretation by definition.
// ═════════════════════════════════════════════════════════════════════

import type { ImagePromptSection, ImagePromptPage } from '../promptTranslation'

// ─── Renderer key (LOCKED — no expansion without governance) ───────

export type RendererKey = 'gptImage' | 'flux' | 'sdxl'

// ─── Single renderer output ───────────────────────────────────────

export interface RendererPrompt {
  /** Positive prompt in renderer-native syntax. */
  prompt: string
  /** Negative prompt where supported. Undefined when renderer doesn't
   *  accept a separate negative slot (e.g., gptImage embeds avoidance
   *  inline in the positive prompt). */
  negativePrompt?: string
}

// ─── Outputs for ALL renderers, per section ───────────────────────

export interface RendererOutputs {
  gptImage: RendererPrompt
  flux: RendererPrompt
  sdxl: RendererPrompt
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
