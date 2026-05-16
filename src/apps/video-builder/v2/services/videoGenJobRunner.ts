// ─────────────────────────────────────────────────────────────────────────
// Video Gen queue runner.
//
// Wires VideoGenItem[] → runVideoClip() with a worker-pool of 2 concurrent
// requests. Updates the videoGenJobStore on every status transition so the
// UI re-renders per clip as workers finish.
//
// Why 2 workers (not 3-5 like the image queue): each Kling clip takes
// 60-120s and 70 credits. Spawning more in parallel = (a) higher
// concurrent credit exposure if user hits cancel late, (b) more KIE-side
// queueing anyway. 2 is the sweet spot for predictable progress + cost.
// ─────────────────────────────────────────────────────────────────────────

import type { SceneBlueprint, VideoGenJob } from '../types'
import { useVideoGenJobStore } from '../stores/videoGenJobStore'
import { runVideoClip } from './videoGen'

export interface RunVideoQueueParams {
  apiKey: string
  /** Blueprint per sceneId. Used to compile the per-clip motion prompt. */
  blueprintBySceneId: Map<number, SceneBlueprint>
  /** Override worker count. Default 2. */
  concurrency?: number
  /** Abort signal — cancels remaining queued items. */
  signal?: AbortSignal
  /** Called when overall counts change (done / failed / total). */
  onProgress?: (done: number, failed: number, total: number) => void
}

export async function runVideoQueue(params: RunVideoQueueParams): Promise<void> {
  const { apiKey, blueprintBySceneId, signal } = params
  const concurrency = params.concurrency ?? 2

  const store = useVideoGenJobStore.getState()
  const job = store.job
  if (!job) return

  // Reset to running. Items already 'completed' are skipped — this lets the
  // runner be invoked again after a partial failure / pause without
  // re-billing for clips already on disk.
  store.setQueueState({ isRunning: true, isPaused: false })

  const total = job.items.length
  const countDone   = () => useVideoGenJobStore.getState().job?.items.filter((i) => i.status === 'completed').length ?? 0
  const countFailed = () => useVideoGenJobStore.getState().job?.items.filter((i) => i.status === 'failed').length ?? 0
  params.onProgress?.(countDone(), countFailed(), total)

  // Build the index queue — anything not yet completed gets re-enqueued
  // (including 'failed' items so the user can hit "Run again" to retry).
  const queueIndices: number[] = []
  job.items.forEach((it, idx) => {
    if (it.status !== 'completed' && it.status !== 'cancelled') queueIndices.push(idx)
  })

  let cursor = 0
  await new Promise<void>((resolve) => {
    let active = 0
    let resolved = false

    const finish = () => {
      if (resolved) return
      if (cursor >= queueIndices.length && active === 0) {
        resolved = true
        useVideoGenJobStore.getState().setQueueState({ isRunning: false, isPaused: false })
        resolve()
      }
    }

    const pump = () => {
      while (!resolved && active < concurrency && cursor < queueIndices.length) {
        if (signal?.aborted) {
          // Mark remaining queued items as cancelled
          for (let i = cursor; i < queueIndices.length; i++) {
            useVideoGenJobStore.getState().patchItem(queueIndices[i], {
              status: 'cancelled',
              error: 'Đã huỷ',
            })
          }
          cursor = queueIndices.length
          finish()
          return
        }

        const idx = queueIndices[cursor++]
        const itemSnapshot = useVideoGenJobStore.getState().job?.items[idx]
        if (!itemSnapshot) continue
        const blueprint = blueprintBySceneId.get(itemSnapshot.sceneId)
        if (!blueprint) {
          useVideoGenJobStore.getState().patchItem(idx, {
            status: 'failed',
            error: 'Không tìm thấy blueprint cho sceneId này',
          })
          params.onProgress?.(countDone(), countFailed(), total)
          continue
        }

        active++
        useVideoGenJobStore.getState().patchItem(idx, {
          status: 'generating',
          error: undefined,
        })

        runVideoClip({
          apiKey,
          blueprint,
          keyframeRef: itemSnapshot.keyframeRef,
          durationSec: itemSnapshot.durationSec,
          signal,
          onStatus: (s, taskId) => {
            if (taskId) {
              useVideoGenJobStore.getState().patchItem(idx, { taskId })
            }
            if (s === 'processing') {
              // already 'generating' in store — no-op
            }
          },
        })
          .then(({ videoRef, taskId, promptUsed }) => {
            useVideoGenJobStore.getState().patchItem(idx, {
              status: 'completed',
              videoRef,
              taskId,
              promptUsed,
              error: undefined,
            })
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err)
            const isCancel = msg.includes('huỷ') || msg.includes('abort') || signal?.aborted
            useVideoGenJobStore.getState().patchItem(idx, {
              status: isCancel ? 'cancelled' : 'failed',
              error: msg,
              retryCount: (itemSnapshot.retryCount ?? 0) + 1,
            })
          })
          .finally(() => {
            active--
            params.onProgress?.(countDone(), countFailed(), total)
            pump()
            finish()
          })
      }
      finish()
    }

    pump()
  })
}

/** Re-run a SINGLE failed/cancelled clip (per-card retry button). */
export async function retrySingleVideoClip(
  idx: number,
  apiKey: string,
  blueprintBySceneId: Map<number, SceneBlueprint>,
): Promise<void> {
  const item = useVideoGenJobStore.getState().job?.items[idx]
  if (!item) return
  const blueprint = blueprintBySceneId.get(item.sceneId)
  if (!blueprint) {
    useVideoGenJobStore.getState().patchItem(idx, {
      status: 'failed',
      error: 'Không tìm thấy blueprint',
    })
    return
  }
  useVideoGenJobStore.getState().patchItem(idx, {
    status: 'generating',
    error: undefined,
  })
  try {
    const { videoRef, taskId, promptUsed } = await runVideoClip({
      apiKey,
      blueprint,
      keyframeRef: item.keyframeRef,
      durationSec: item.durationSec,
    })
    useVideoGenJobStore.getState().patchItem(idx, {
      status: 'completed',
      videoRef,
      taskId,
      promptUsed,
      error: undefined,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    useVideoGenJobStore.getState().patchItem(idx, {
      status: 'failed',
      error: msg,
      retryCount: (item.retryCount ?? 0) + 1,
    })
  }
}

/** Build a fresh queue from approved scene-gen items. */
export function buildVideoQueueFromScenes(
  approvedScenes: { sceneId: number; keyframeRef: string }[],
  opts?: { durationSec?: number; providerLabel?: string; creditPerClip?: number },
): VideoGenJob {
  return {
    id: `video-${Date.now()}`,
    total: approvedScenes.length,
    items: approvedScenes.map((s) => ({
      sceneId: s.sceneId,
      keyframeRef: s.keyframeRef,
      status: 'pending',
      retryCount: 0,
      durationSec: opts?.durationSec ?? 5,
    })),
    isRunning: false,
    isPaused: false,
    providerLabel: opts?.providerLabel ?? 'Kling 3.0 std / KIE',
    creditPerClip: opts?.creditPerClip ?? 70,
  }
}
