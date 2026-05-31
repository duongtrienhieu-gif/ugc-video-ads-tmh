// ─────────────────────────────────────────────────────────────────────
// Generation Orchestration — executePIImages (2026-05-30)
//
// Parallel pipeline for PI-block image generation. Mirrors
// executePageGeneration but operates on the StorytellingMeta.piImageAssets
// parallel store instead of OrchestratedPage.sections.
//
// Architecture rationale:
//   - PI blocks are not ComposedSections — they sit in PIBlock[] and are
//     interleaved into the final pack at anchor positions.
//   - Forcing PI through executePageGeneration would require either
//     stuffing fake ComposedSection objects into exportablePage (which
//     pollutes downstream serializers + ladipage adapter consumers) OR
//     refactoring executePageGeneration to accept a generic image-unit
//     interface (cascading change across the orchestration types chain).
//   - This standalone function lets PI piggyback on the existing executor
//     registry + scene-synthesis output WITHOUT touching the storytelling
//     image pipeline. The two functions can run in sequence (storytelling
//     first to produce the character anchor URL, then PI which reuses it).
//
// LOCKED:
//   - PI images NEVER seed the character anchor (storytelling hero-anchor
//     is the single source of identity continuity).
//   - PI images ALWAYS consume the character anchor URL if available, so
//     the narrator in the PI mechanism close-up matches the storytelling
//     protagonist.
//   - PI prompt comes from the pre-computed scene description (synthesized
//     at pack-gen time alongside storytelling scenes). If a PI scene is
//     missing, the asset is marked failed and skipped — no per-section
//     fallback gen here (keeps the function pure execution).
// ─────────────────────────────────────────────────────────────────────

import type {
  ExecutorRegistry,
  GeneratedAsset,
  ReferenceAsset,
} from '../types'
import type { SceneDescription } from '../../imageSceneSynthesis'
import type { ImageRole } from '../../imageSemantics'
import type { ImageAspectRatio } from '../../renderContract'
import { executeSectionGeneration } from './executeSectionGeneration'

export interface PIImageWorkItem {
  /** Stable id, e.g. 'pi-mechanism-personal'. */
  piBlockId: string
  /** Pre-computed scene description (prompt + routing + role). */
  scene: SceneDescription
  /** Initial generation plan (status='planned'). Mutated in-memory only. */
  asset: GeneratedAsset
  /** Image role passed to the executor for aspect-ratio + reference logic. */
  imageRole: ImageRole
  /** Aspect ratio — defaults to 9:16 (matches storytelling). */
  aspectRatio?: ImageAspectRatio
}

export interface ExecutePIImagesOptions {
  executors: ExecutorRegistry
  /** Character anchor URL from storytelling hero-anchor section. When
   *  available, every PI image gets it as a character-reference so the
   *  narrator identity stays consistent. Pass undefined if storytelling
   *  hero-anchor hasn't generated yet (PI will run without character lock,
   *  identity will drift — acceptable trade-off for parallel exec). */
  characterAnchorUrl?: string | null
  signal?: AbortSignal
  onItemStart?: (piBlockId: string) => void
  onItemComplete?: (piBlockId: string, asset: GeneratedAsset) => void
  /** Optional filter — when set, only items whose id matches will run. */
  filter?: (piBlockId: string) => boolean
  /** When true, run items even if their current status is 'completed' or
   *  'generating' (per-item regen click). */
  forceRegenerate?: boolean
}

export interface ExecutePIImagesResult {
  succeeded: string[]
  failed: string[]
  skipped: string[]
  cancelled: string[]
  durationMs: number
}

const DEFAULT_PI_ASPECT_RATIO: ImageAspectRatio = '9:16'

/** Execute every PI image work item in parallel (with concurrency=2). */
export async function executePIImages(
  workItems: PIImageWorkItem[],
  options: ExecutePIImagesOptions,
): Promise<ExecutePIImagesResult> {
  const startedAt = Date.now()
  const succeeded: string[] = []
  const failed: string[] = []
  const skipped: string[] = []
  const cancelled: string[] = []

  // Filter eligible items
  const eligible = workItems.filter((item) => {
    if (options.filter && !options.filter(item.piBlockId)) return false
    if (options.forceRegenerate) return true
    const status = item.asset.generationStatus
    return status === 'planned' || status === 'failed'
  })

  if (eligible.length === 0) {
    return {
      succeeded, failed, skipped, cancelled,
      durationMs: 0,
    }
  }

  // Parallel exec with low concurrency (PI is at most 1 item today, so this
  // is mostly a forward-compatible no-op).
  const concurrency = Math.min(2, eligible.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < eligible.length) {
      if (options.signal?.aborted) return
      const item = eligible[nextIndex++]
      await runOne(item)
      if (options.signal?.aborted) {
        while (nextIndex < eligible.length) {
          cancelled.push(eligible[nextIndex++].piBlockId)
        }
        return
      }
    }
  }

  async function runOne(item: PIImageWorkItem): Promise<void> {
    const executor = options.executors[item.asset.renderer]
    if (!executor) {
      skipped.push(item.piBlockId)
      options.onItemComplete?.(item.piBlockId, {
        ...item.asset,
        generationStatus: 'failed',
        failureReason: `No executor registered for renderer '${item.asset.renderer}'`,
        executedAt: Date.now(),
      })
      return
    }

    // Inject character anchor URL as reference if available + this PI image
    // wants character continuity. PI mechanism (proof-callout) keeps the
    // narrator visible in the corner, so it benefits from the anchor.
    let references = item.asset.referenceAssets
    if (
      item.scene.routing.requiresCharacterReference
      && options.characterAnchorUrl
    ) {
      const alreadyHas = references.some(
        (r: ReferenceAsset) => r.kind === 'character-reference' && r.url === options.characterAnchorUrl,
      )
      if (!alreadyHas) {
        references = [
          { kind: 'character-reference', url: options.characterAnchorUrl, name: 'hero-anchor-generated' },
          ...references,
        ]
      }
    }

    options.onItemStart?.(item.piBlockId)

    try {
      const updated = await executeSectionGeneration({
        asset: { ...item.asset, referenceAssets: references },
        executor,
        sectionId: item.piBlockId,
        imageRole: item.imageRole,
        aspectRatio: item.aspectRatio ?? DEFAULT_PI_ASPECT_RATIO,
      })

      if (updated.generationStatus === 'completed') {
        succeeded.push(item.piBlockId)
      } else {
        failed.push(item.piBlockId)
      }
      options.onItemComplete?.(item.piBlockId, updated)
    } catch (err) {
      failed.push(item.piBlockId)
      options.onItemComplete?.(item.piBlockId, {
        ...item.asset,
        generationStatus: 'failed',
        failureReason: err instanceof Error ? err.message : 'unexpected error',
        executedAt: Date.now(),
      })
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker())
  await Promise.all(workers)

  return {
    succeeded, failed, skipped, cancelled,
    durationMs: Date.now() - startedAt,
  }
}
