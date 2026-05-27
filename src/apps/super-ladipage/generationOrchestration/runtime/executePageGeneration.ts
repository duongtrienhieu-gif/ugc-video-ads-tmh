// ─────────────────────────────────────────────────────────────────────
// Generation Orchestration — executePageGeneration (POST-REBUILD)
//
// Single-source-of-truth pipeline:
//   1. Scene synthesis batch (Gemini, parallel) → 1 prompt per section
//   2. Sequential gen of imageRole='hero-anchor' (no reference yet)
//   3. Parallel gen of remaining sections, injecting hero-anchor URL as
//      character-reference for character-bearing roles
//
// LOCKED: per-section prompt comes from scene synthesis output VERBATIM.
// NO prompt stacking. NO post-synthesis mutation.
// ─────────────────────────────────────────────────────────────────────

import type {
  OrchestratedPage,
  RendererExecutor,
  ExecutorRegistry,
  GeneratedAsset,
  ReferenceAsset,
} from '../types'
import type { RendererKey } from '../../rendererAdapters'
import type { NicheKey } from '../../storytelling/types'
import type { LandingLanguage } from '../../storytelling/types'
import type {
  ProtagonistVisualContext,
  ProductVisualContext,
  SceneDescription,
} from '../../imageSceneSynthesis'
import { synthesizePageScenes } from '../../imageSceneSynthesis'
import { executeSectionGeneration } from './executeSectionGeneration'

export interface PageGenerationContext {
  /** Niche for cultural anchoring + scene synthesis. */
  niche: NicheKey
  /** Protagonist visual identity for character continuity. */
  protagonist: ProtagonistVisualContext
  /** Product context (null = no product in any image). */
  productContext: ProductVisualContext | null
  /** Output language — only used for scene synthesis cultural anchor. */
  targetLanguage: LandingLanguage
  /** Gemini API key (for scene synthesis). */
  geminiApiKey: string
  /** KIE API key (for executor fallback inside scene synthesis). */
  kieApiKey: string
  /** OPT.1 (2026-05-28) — Pre-computed scene prompts from pack-gen time.
   *  When provided, executePageGeneration SKIPS its own synthesizePageScenes
   *  call (saves 7-9 Gemini calls per "Tạo ảnh" click). Keyed by composed
   *  section id matching exportablePage.sections[i].id. */
  preComputedScenes?: Record<string, SceneDescription>
}

export interface ExecutePageGenerationOptions {
  executors: ExecutorRegistry
  /** Page-level synthesis + cultural context. Required post-rebuild. */
  context: PageGenerationContext
  /** Max parallel sections during the post-anchor phase. Default 2. */
  concurrency?: number
  signal?: AbortSignal
  onSectionStart?: (sectionId: string, renderer: RendererKey) => void
  onSectionComplete?: (sectionId: string, asset: GeneratedAsset) => void
  onSceneSynthesized?: (sectionId: string, scene: SceneDescription) => void
  filter?: (sectionId: string) => boolean
  /** UI-FIX4 (2026-05-28) — When true, bypass the
   *  `generationStatus === 'planned' | 'failed'` queue filter so an
   *  explicit per-section regen click ALWAYS runs even if the section
   *  is currently 'completed' (stale image / want a re-roll) or stuck
   *  in 'generating' (previous attempt aborted before status update).
   *  Without this flag those sections were silently filtered out and
   *  the click did nothing — no toast, no error, no gen. */
  forceRegenerate?: boolean
}

export interface ExecutePageGenerationResult {
  succeeded: string[]
  failed: string[]
  skipped: string[]
  cancelled: string[]
  durationMs: number
  /** Scene synthesis telemetry — how many sections got Gemini prompts vs fallback. */
  synthesisSucceeded: number
  synthesisFallback: number
}

const DEFAULT_CONCURRENCY = 2

export async function executePageGeneration(
  page: OrchestratedPage,
  options: ExecutePageGenerationOptions,
): Promise<ExecutePageGenerationResult> {
  const startedAt = Date.now()
  const succeeded: string[] = []
  const failed: string[] = []
  const skipped: string[] = []
  const cancelled: string[] = []

  // ── Build work queue (sections eligible for generation) ──────────
  // UI-FIX4 (2026-05-28): when forceRegenerate is set (explicit single-
  // section click), bypass the status filter so completed/generating
  // sections still queue up. Avoids the "click does nothing" silent-fail.
  const queue = page.sections.filter((s) => {
    if (!s.generatedAsset) return false
    if (options.filter && !options.filter(s.id)) return false
    if (options.forceRegenerate) return true
    const status = s.generatedAsset.generationStatus
    return status === 'planned' || status === 'failed'
  })

  if (queue.length === 0) {
    return {
      succeeded, failed, skipped, cancelled,
      durationMs: 0,
      synthesisSucceeded: 0, synthesisFallback: 0,
    }
  }

  // ── STEP 1 — Scene synthesis (OPT.1: reuse pre-computed when available) ──
  // If meta.imageScenes pre-computed at pack-gen time exists for ALL queue
  // sections, skip Gemini call entirely. Save 7-9 calls per "Tạo ảnh" click.
  // Otherwise run synthesis for missing scenes only.
  const preComputed = options.context.preComputedScenes
  const allQueueHavePreComputed = preComputed
    ? queue.every((s) => preComputed[s.id]?.prompt)
    : false

  let synthesis: import('../../imageSceneSynthesis').PageSceneSynthesis
  if (allQueueHavePreComputed && preComputed) {
    // FAST PATH — no Gemini call, just reuse pre-computed scenes
    const scenes: Record<string, SceneDescription> = {}
    for (const s of queue) {
      scenes[s.id] = preComputed[s.id]
    }
    synthesis = {
      scenes,
      succeeded: queue.length,
      fallbackCount: 0,
      durationMs: 0,
    }
    console.info(`[exec/scene-synth] OPT.1 fast path — reused ${queue.length} pre-computed scenes (skipped Gemini synthesis)`)
    // Still call onSceneSynthesized callback for UI consistency
    for (const s of queue) {
      options.onSceneSynthesized?.(s.id, scenes[s.id])
    }
  } else {
    // SLOW PATH — synthesize missing scenes via Gemini
    const composedSections = queue.map((s) => ({
      id: s.id,
      role: s.role,
      sourceBlockIds: s.sourceBlockIds,
      paragraphs: s.paragraphs,
      inlineProof: s.inlineProof,
      density: s.density,
      pacingRole: s.pacingRole,
      imageRole: s.imageRole,
      scrollWeight: s.scrollWeight,
      ctaInline: s.ctaInline,
      spacingBefore: s.spacingBefore,
      spacingAfter: s.spacingAfter,
      transitionHint: s.transitionHint,
      wordCount: s.wordCount,
      paragraphCount: s.paragraphCount,
    }))

    synthesis = await synthesizePageScenes(
      composedSections,
      {
        niche: options.context.niche,
        protagonist: options.context.protagonist,
        productContext: options.context.productContext,
        targetLanguage: options.context.targetLanguage,
        onSectionSynthesized: options.onSceneSynthesized,
      },
      {
        geminiApiKey: options.context.geminiApiKey,
        kieApiKey: options.context.kieApiKey,
      },
      { signal: options.signal },
    )
    console.info(`[exec/scene-synth] SLOW PATH — synthesized ${synthesis.succeeded}/${queue.length} via Gemini`)
  }

  if (options.signal?.aborted) {
    queue.forEach((s) => cancelled.push(s.id))
    return {
      succeeded, failed, skipped, cancelled,
      durationMs: Date.now() - startedAt,
      synthesisSucceeded: synthesis.succeeded,
      synthesisFallback: synthesis.fallbackCount,
    }
  }

  // ── Inject synthesized prompts + routing into assets (in-memory only) ──
  // We work off a per-section asset COPY so we don't mutate the OrchestratedPage
  // captured by React state.
  type WorkItem = {
    sectionId: string
    asset: GeneratedAsset
    scene: SceneDescription
    imageRole: typeof queue[number]['imageRole']
    aspectRatio: import('../../renderContract').ImageAspectRatio
  }
  const workItems: WorkItem[] = []
  for (const section of queue) {
    if (!section.generatedAsset) continue
    const scene = synthesis.scenes[section.id]
    if (!scene || !scene.prompt) {
      skipped.push(section.id)
      options.onSectionComplete?.(section.id, {
        ...section.generatedAsset,
        generationStatus: 'failed',
        failureReason: 'Scene synthesis produced empty prompt',
        executedAt: Date.now(),
      })
      continue
    }

    const asset: GeneratedAsset = {
      ...section.generatedAsset,
      renderer: scene.routing.renderer,
      promptUsed: { prompt: scene.prompt },
    }

    workItems.push({
      sectionId: section.id,
      asset,
      scene,
      imageRole: section.imageRole,
      aspectRatio: section.renderContract.imageAspectRatio ?? '9:16',
    })
  }

  // ── STEP 2 — Sequential generation of hero-anchor (if present) ───
  // Captures the anchor URL to inject as character-reference for the rest.
  let characterAnchorUrl: string | null = null
  const anchorItems = workItems.filter((w) => w.scene.routing.isCharacterAnchorSource)
  const restItems = workItems.filter((w) => !w.scene.routing.isCharacterAnchorSource)

  for (const work of anchorItems) {
    if (options.signal?.aborted) {
      cancelled.push(work.sectionId)
      continue
    }
    await runOne(work, null, options, succeeded, failed, skipped, (url) => {
      if (!characterAnchorUrl) characterAnchorUrl = url
    })
  }

  // ── STEP 3 — Parallel generation of remaining sections ───────────
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < restItems.length) {
      if (options.signal?.aborted) return
      const work = restItems[nextIndex++]
      await runOne(work, characterAnchorUrl, options, succeeded, failed, skipped)
      if (options.signal?.aborted) {
        while (nextIndex < restItems.length) {
          cancelled.push(restItems[nextIndex++].sectionId)
        }
        return
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, restItems.length) },
    () => worker(),
  )
  await Promise.all(workers)

  return {
    succeeded, failed, skipped, cancelled,
    durationMs: Date.now() - startedAt,
    synthesisSucceeded: synthesis.succeeded,
    synthesisFallback: synthesis.fallbackCount,
  }
}

// ─── Per-item executor runner (extracted for shared use across anchor+rest) ──

async function runOne(
  work: { sectionId: string; asset: GeneratedAsset; scene: SceneDescription; imageRole: import('../../composer').ImageRole; aspectRatio: import('../../renderContract').ImageAspectRatio },
  characterAnchorUrl: string | null,
  options: ExecutePageGenerationOptions,
  succeeded: string[],
  failed: string[],
  skipped: string[],
  onAnchorComplete?: (url: string) => void,
): Promise<void> {
  const executor: RendererExecutor | undefined = options.executors[work.asset.renderer]
  if (!executor) {
    skipped.push(work.sectionId)
    options.onSectionComplete?.(work.sectionId, {
      ...work.asset,
      generationStatus: 'failed',
      failureReason: `No executor registered for renderer '${work.asset.renderer}'`,
      executedAt: Date.now(),
    })
    return
  }

  // Inject the character anchor URL as a reference if section needs it
  let references = work.asset.referenceAssets
  if (work.scene.routing.requiresCharacterReference && characterAnchorUrl) {
    const hasAlready = references.some((r) => r.kind === 'character-reference' && r.url === characterAnchorUrl)
    if (!hasAlready) {
      references = [
        { kind: 'character-reference', url: characterAnchorUrl, name: 'hero-anchor-generated' },
        ...references,
      ]
    }
  }

  options.onSectionStart?.(work.sectionId, work.asset.renderer)

  try {
    const updated = await executeSectionGeneration({
      asset: { ...work.asset, referenceAssets: references },
      executor,
      sectionId: work.sectionId,
      imageRole: work.imageRole,
      aspectRatio: work.aspectRatio,
    })

    if (updated.generationStatus === 'completed') {
      succeeded.push(work.sectionId)
      if (onAnchorComplete && updated.outputImages[0]?.url) {
        onAnchorComplete(updated.outputImages[0].url)
      }
    } else {
      failed.push(work.sectionId)
    }
    options.onSectionComplete?.(work.sectionId, updated)
  } catch (err) {
    failed.push(work.sectionId)
    options.onSectionComplete?.(work.sectionId, {
      ...work.asset,
      generationStatus: 'failed',
      failureReason: err instanceof Error ? err.message : 'unexpected error',
      executedAt: Date.now(),
    })
  }
}

/** Helper for ad-hoc reference assembly outside the orchestrator. */
export function withCharacterReference(
  base: ReferenceAsset[],
  characterUrl: string,
): ReferenceAsset[] {
  return [
    { kind: 'character-reference', url: characterUrl, name: 'hero-anchor-generated' },
    ...base.filter((r) => !(r.kind === 'character-reference' && r.url === characterUrl)),
  ]
}
