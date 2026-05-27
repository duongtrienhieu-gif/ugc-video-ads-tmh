// ─────────────────────────────────────────────────────────────────────
// Generation Orchestration — executeSectionGeneration (P12 async exec)
//
// Async per-section execution with bounded retry. Updates GeneratedAsset
// in-place-immutably and returns new asset object.
//
// Consumer-triggered ONLY — pack gen does NOT auto-invoke this. Per
// "no automation" lock, execution must be explicit user action.
//
// Routing decision is FROZEN at plan time. Executor failure does NOT
// trigger renderer fallback (that's P13+ calibration concern).
// ─────────────────────────────────────────────────────────────────────

import type {
  GeneratedAsset,
  RendererExecutor,
  ExecutorInput,
  ExecutorOutput,
} from '../types'
import type { ImageAspectRatio } from '../../renderContract'
import type { ImageRole } from '../../imageSemantics'
import { shouldRetry } from '../config/retryPolicy'

export interface ExecuteSectionInput {
  asset: GeneratedAsset
  executor: RendererExecutor
  sectionId: string
  imageRole: ImageRole
  aspectRatio?: ImageAspectRatio
}

/** Run executor with bounded retry, return updated GeneratedAsset. */
export async function executeSectionGeneration(
  input: ExecuteSectionInput,
): Promise<GeneratedAsset> {
  const { asset, executor, sectionId, imageRole, aspectRatio } = input

  if (executor.renderer !== asset.renderer) {
    return {
      ...asset,
      generationStatus: 'failed',
      failureReason: `executor renderer mismatch: expected '${asset.renderer}', got '${executor.renderer}'`,
      executedAt: Date.now(),
    }
  }

  let retryCount = 0
  let lastOutput: ExecutorOutput | undefined
  const executedAt = Date.now()

  while (true) {
    const executorInput: ExecutorInput = {
      prompt: asset.promptUsed,
      references: asset.referenceAssets,
      imageRole,
      aspectRatio,
      sectionId,
      attempt: retryCount + 1,
    }

    let output: ExecutorOutput
    try {
      output = await executor.generate(executorInput)
    } catch (err) {
      // Executor threw — treat as 'failed' for retry policy
      output = {
        status: 'failed',
        images: [],
        failureReason: err instanceof Error ? err.message : 'executor threw',
      }
    }

    lastOutput = output

    if (!shouldRetry(output, retryCount)) break
    retryCount++
  }

  if (!lastOutput) {
    // Defensive — should not happen given the loop runs at least once
    return {
      ...asset,
      generationStatus: 'failed',
      failureReason: 'executor produced no output',
      retryCount,
      executedAt,
    }
  }

  return {
    ...asset,
    generationStatus: lastOutput.status === 'ok' ? 'completed' : 'failed',
    retryCount,
    outputImages: lastOutput.images,
    failureReason: lastOutput.failureReason,
    executedAt,
  }
}
