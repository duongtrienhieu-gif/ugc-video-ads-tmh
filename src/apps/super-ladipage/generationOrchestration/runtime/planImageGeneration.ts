// ─────────────────────────────────────────────────────────────────────
// Generation Orchestration — planImageGeneration (P12 single section)
//
// RendererAdaptedSection + references → GeneratedAsset | undefined.
// Pure deterministic plan. NO API calls, NO async, NO mutation.
//
// Returns undefined when section has no rendererOutputs / no imageIntent
// (text-only sections like reframe / close).
// ─────────────────────────────────────────────────────────────────────

import type { RendererAdaptedSection } from '../../rendererAdapters'
import type { GeneratedAsset, ReferenceAsset } from '../types'
import { selectRenderer } from '../config/rendererRouting'
import { selectReferences } from '../config/referenceSelection'

export function planImageGeneration(
  section: RendererAdaptedSection,
  availableReferences: ReferenceAsset[],
): GeneratedAsset | undefined {
  if (!section.imageIntent || !section.rendererOutputs) return undefined

  const renderer = selectRenderer(section.imageIntent)
  const promptUsed = section.rendererOutputs[renderer]
  const referenceAssets = selectReferences(section.imageIntent, availableReferences)

  return {
    renderer,
    promptUsed,
    referenceAssets,
    generationStatus: 'planned',
    retryCount: 0,
    outputImages: [],
    plannedAt: Date.now(),
    // semanticConsistencyScore: deferred to P13 calibration loop
  }
}
