// ─────────────────────────────────────────────────────────────────────
// Image Scene Synthesis — synthesizePageScenes (page-level batch)
//
// Run synthesizeImageScene in parallel across all sections needing an image.
// Concurrency cap = 4 to be friendly with Gemini rate limits at peak hour.
//
// Returns Record<sectionId, SceneDescription> for downstream consumption.
// ─────────────────────────────────────────────────────────────────────

import type { ComposedSection } from '../../composer'
import type { NicheKey } from '../../storytelling/types'
import type {
  PageSceneSynthesis,
  ProductVisualContext,
  ProtagonistVisualContext,
  SceneDescription,
} from '../types'
import { synthesizeImageScene } from './synthesizeImageScene'
import type { LandingLanguage } from '../../storytelling/types'

interface PageSynthesisContext {
  niche: NicheKey
  protagonist: ProtagonistVisualContext
  productContext: ProductVisualContext | null
  targetLanguage: LandingLanguage
  /** Optional callback when each section completes (for UI progress). */
  onSectionSynthesized?: (sectionId: string, scene: SceneDescription) => void
}

interface ApiKeys {
  geminiApiKey: string
  kieApiKey: string
}

const DEFAULT_CONCURRENCY = 4

/** Map a section's blockId / sourceBlockIds to a story phase 1-4. */
function inferStoryPhase(section: ComposedSection): 1 | 2 | 3 | 4 {
  const role = section.role
  if (role === 'hero-recognition' || role === 'lived-experience') return 1
  if (role === 'shared-struggle') return 2
  if (role === 'reframe-moment' || role === 'solution-opening') return 3
  // 'transformation' / 'close-invitation'
  return 4
}

export async function synthesizePageScenes(
  sections: ComposedSection[],
  context: PageSynthesisContext,
  keys: ApiKeys,
  options: { concurrency?: number; signal?: AbortSignal } = {},
): Promise<PageSceneSynthesis> {
  const startedAt = Date.now()
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY)
  const scenes: Record<string, SceneDescription> = {}
  let succeeded = 0
  let fallbackCount = 0

  // ── Filter to sections that need an image ──
  const queue = sections.filter((s) => s.imageRole !== 'none')

  if (queue.length === 0) {
    return { scenes, succeeded: 0, fallbackCount: 0, durationMs: 0 }
  }

  // ── Concurrency-bounded worker loop ──
  let nextIndex = 0
  async function worker(): Promise<void> {
    while (nextIndex < queue.length) {
      if (options.signal?.aborted) return
      const section = queue[nextIndex++]
      const sectionText = section.paragraphs.join('\n\n')

      const scene = await synthesizeImageScene(
        {
          sectionId: section.id,
          imageRole: section.imageRole,
          sectionText,
          sectionHeading: section.transitionHint ? undefined : undefined,
          storyPhase: inferStoryPhase(section),
          niche: context.niche,
          protagonist: context.protagonist,
          productContext: context.productContext,
          targetLanguage: context.targetLanguage,
        },
        keys,
      )

      scenes[section.id] = scene
      if (scene.source === 'gemini') succeeded++
      else fallbackCount++

      context.onSectionSynthesized?.(section.id, scene)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker())
  await Promise.all(workers)

  return {
    scenes,
    succeeded,
    fallbackCount,
    durationMs: Date.now() - startedAt,
  }
}
