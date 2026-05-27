// ─────────────────────────────────────────────────────────────────────
// Generation Orchestration — executePageGeneration (LIVE batch)
//
// Page-level batch image generation. Iterates sections, runs the
// appropriate RendererExecutor per section, calls back into session
// state updates as each section transitions.
//
// LOCKED: concurrency bounded (default 2 — KIE rate-limit friendly).
// LOCKED: no re-routing — section's planned renderer is FROZEN.
// LOCKED: callbacks may NOT mutate prompt — only transition status.
// ─────────────────────────────────────────────────────────────────────

import type {
  OrchestratedPage,
  RendererExecutor,
  ExecutorRegistry,
  GeneratedAsset,
} from '../types'
import type { RendererKey } from '../../rendererAdapters'
import { executeSectionGeneration } from './executeSectionGeneration'

export interface ExecutePageGenerationOptions {
  /** Executor registry — at least one executor required. Missing
   *  executors fail those sections gracefully. */
  executors: ExecutorRegistry
  /** Max parallel sections. Default 2 (KIE rate-limit friendly). */
  concurrency?: number
  /** AbortController.signal — if aborted, in-flight sections cancel
   *  via their executor's signal pass-through; queued sections skip. */
  signal?: AbortSignal
  /** Callback when a section transitions to 'in-progress'. */
  onSectionStart?: (sectionId: string, renderer: RendererKey) => void
  /** Callback when a section completes (success or fail). */
  onSectionComplete?: (sectionId: string, asset: GeneratedAsset) => void
  /** Optional filter: only generate sections whose id matches predicate.
   *  Default: all sections with status='planned' or 'queued' or 'failed'. */
  filter?: (sectionId: string) => boolean
}

export interface ExecutePageGenerationResult {
  /** Sections successfully generated. */
  succeeded: string[]
  /** Sections that failed (after retry). */
  failed: string[]
  /** Sections skipped (no executor / no asset). */
  skipped: string[]
  /** Sections cancelled (signal aborted). */
  cancelled: string[]
  /** Total wall-clock ms. */
  durationMs: number
}

const DEFAULT_CONCURRENCY = 2

/** Run image generation across the page's planned sections. */
export async function executePageGeneration(
  page: OrchestratedPage,
  options: ExecutePageGenerationOptions,
): Promise<ExecutePageGenerationResult> {
  const startedAt = Date.now()
  const succeeded: string[] = []
  const failed: string[] = []
  const skipped: string[] = []
  const cancelled: string[] = []

  // ── Build work queue ─────────────────────────────────────────────
  const queue = page.sections.filter((s) => {
    if (!s.generatedAsset) return false  // no image planned for section
    if (options.filter && !options.filter(s.id)) return false
    const status = s.generatedAsset.generationStatus
    // Generate sections that are planned (never run) or previously failed.
    // 'in-progress' / 'retrying' = mid-flight (don't double-trigger).
    // 'completed' / 'skipped' = already terminal.
    return status === 'planned' || status === 'failed'
  })

  if (queue.length === 0) {
    return { succeeded, failed, skipped, cancelled, durationMs: 0 }
  }

  // ── Concurrency-bounded worker loop ─────────────────────────────
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < queue.length) {
      if (options.signal?.aborted) return
      const section = queue[nextIndex++]
      if (!section.generatedAsset) {
        skipped.push(section.id)
        continue
      }
      const renderer = section.generatedAsset.renderer
      const executor: RendererExecutor | undefined = options.executors[renderer]
      if (!executor) {
        skipped.push(section.id)
        // Surface as failed via callback so UI reflects "no executor"
        options.onSectionComplete?.(section.id, {
          ...section.generatedAsset,
          generationStatus: 'failed',
          failureReason: `No executor registered for renderer '${renderer}'`,
          executedAt: Date.now(),
        })
        continue
      }

      options.onSectionStart?.(section.id, renderer)

      try {
        const updated = await executeSectionGeneration({
          asset: section.generatedAsset,
          executor,
          sectionId: section.id,
          imageRole: section.imageIntent?.imageRole ?? 'mood-supporting',
          aspectRatio: section.renderContract.imageAspectRatio,
        })

        if (updated.generationStatus === 'completed') {
          succeeded.push(section.id)
        } else {
          failed.push(section.id)
        }
        options.onSectionComplete?.(section.id, updated)
      } catch (err) {
        // Defensive — executeSectionGeneration already catches, but if
        // it throws unexpectedly we degrade gracefully.
        failed.push(section.id)
        options.onSectionComplete?.(section.id, {
          ...section.generatedAsset,
          generationStatus: 'failed',
          failureReason: err instanceof Error ? err.message : 'unexpected error',
          executedAt: Date.now(),
        })
      }

      if (options.signal?.aborted) {
        // Pick up remaining unprocessed queue items into 'cancelled'
        while (nextIndex < queue.length) {
          cancelled.push(queue[nextIndex++].id)
        }
        return
      }
    }
  }

  // ── Spawn N workers ──────────────────────────────────────────────
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker())
  await Promise.all(workers)

  return {
    succeeded,
    failed,
    skipped,
    cancelled,
    durationMs: Date.now() - startedAt,
  }
}
