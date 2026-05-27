// ─────────────────────────────────────────────────────────────────────
// Generation Orchestration — planImageGeneration (POST-REBUILD)
//
// RendererAdaptedSection + references → GeneratedAsset | undefined.
// Pure deterministic plan. NO API calls, NO async, NO mutation.
//
// Returns undefined when section has no imageIntent (text-only sections).
//
// Post-rebuild change: prompt/renderer no longer come from fragment-stack
// outputs. Plan-time produces a STUB asset (renderer='gptImage' as default,
// empty prompt). executePageGeneration runs scene synthesis at exec-time
// and overrides both fields per section.
// ─────────────────────────────────────────────────────────────────────

import type { RendererAdaptedSection } from '../../rendererAdapters'
import type { GeneratedAsset, ReferenceAsset } from '../types'
import { selectReferences } from '../config/referenceSelection'

export function planImageGeneration(
  section: RendererAdaptedSection,
  availableReferences: ReferenceAsset[],
): GeneratedAsset | undefined {
  if (!section.imageIntent) return undefined

  const referenceAssets = selectReferences(section.imageIntent, availableReferences)

  return {
    // Stub renderer — will be overridden by scene synthesis routing.
    renderer: 'gpt4o',
    // Stub prompt — will be replaced by synthesized scene prompt at exec time.
    promptUsed: { prompt: '' },
    referenceAssets,
    generationStatus: 'planned',
    retryCount: 0,
    outputImages: [],
    plannedAt: Date.now(),
  }
}
