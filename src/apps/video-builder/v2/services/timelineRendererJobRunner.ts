// ── Timeline Renderer Job Runner ─────────────────────────────────────────────
// Z22 — Cut-level worker pool. Processes TimelineRenderJob.items through
// Kling 3.0 std via KIE.ai with concurrency 2 (matches videoGenJobRunner
// pattern). Per-cut status updates pushed via callbacks.
//
// NOT a React store wiring — that's a future commit. This is pure logic so
// the caller can decide how to persist (zustand / context / direct UI).
//
// On 422 from Kling: auto-retry once with minimal-fallback payload. If
// minimal also fails, mark cut failed + move on.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  TimelineRenderItem, TimelineRenderJob, TimelineRenderStatus,
} from '../types'
import {
  buildKlingPayloadForCut, buildMinimalFallbackPayload, validateKlingPayload,
} from './timelineRenderer'
import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'
import { generateVideoJob, pollVideoJobUntilDone } from '../../../../utils/kieai'

// ═════════════════════════════════════════════════════════════════════════
// Public callback shape — caller wires this into their store / UI
// ═════════════════════════════════════════════════════════════════════════

export interface CutStatusUpdate {
  cutId: number
  status: TimelineRenderStatus
  taskId?: string
  videoRef?: string
  error?: string
  retryCount?: number
}

export interface RunTimelineRenderParams {
  apiKey: string
  job: TimelineRenderJob
  /** Override worker count. Default 2 (Kling-friendly — clip is heavy +
   *  expensive, more parallelism = bigger credit exposure on cancel). */
  concurrency?: number
  /** Abort signal — cancels remaining queued items. */
  signal?: AbortSignal
  /** Called whenever a cut transitions status. Caller persists this. */
  onCutUpdate: (update: CutStatusUpdate) => void
  /** Called when overall counts change. */
  onProgress?: (done: number, failed: number, total: number) => void
}

// ═════════════════════════════════════════════════════════════════════════
// Per-cut submission (with 422 fallback)
// ═════════════════════════════════════════════════════════════════════════

interface SubmitResult {
  videoRef: string
  taskId: string
  usedFallback: boolean
}

async function submitCutToKling(
  item: TimelineRenderItem,
  apiKey: string,
  signal: AbortSignal | undefined,
): Promise<SubmitResult> {
  // 1. Resolve keyframe asset → public URL
  let keyframeUrl: string
  if (isAssetRef(item.parentKeyframeRef)) {
    const resolved = await getUrl(item.parentKeyframeRef)
    if (!resolved) throw new Error(`Không tải được keyframe cho cut-${item.cutId} (asset không tồn tại)`)
    keyframeUrl = resolved
  } else if (item.parentKeyframeRef.startsWith('http')) {
    keyframeUrl = item.parentKeyframeRef
  } else {
    throw new Error(`parentKeyframeRef không hợp lệ cho cut-${item.cutId}: ${item.parentKeyframeRef.slice(0, 60)}`)
  }
  if (signal?.aborted) throw new Error('Đã huỷ')

  // 2. Build full sanitized payload
  const fullPayload = buildKlingPayloadForCut(item, keyframeUrl)
  const validationErr = validateKlingPayload(fullPayload)
  if (validationErr) {
    throw new Error(`Cut-${item.cutId} payload không hợp lệ: ${validationErr.field} — ${validationErr.reason}`)
  }

  console.log(
    `[KLING_PAYLOAD cut-${item.cutId}] ` +
    `motion=${fullPayload.motion} duration=${fullPayload.duration} aspect=${fullPayload.aspectRatio} ` +
    `promptLen=${fullPayload.prompt.length} negativeLen=${fullPayload.negativePrompt.length}`,
  )

  // 3. Try full payload first
  let taskId: string
  let usedFallback = false
  try {
    const result = await generateVideoJob({
      apiKey,
      jobModelId: fullPayload.jobModelId,
      prompt: fullPayload.prompt,
      // KIE generateVideoJob only accepts 16:9 / 9:16. KlingSubmitPayload
      // may include '1:1' too — fall back to 9:16 for square requests.
      aspectRatio: fullPayload.aspectRatio === '1:1' ? '9:16' : fullPayload.aspectRatio,
      resolution: '720p',
      duration: fullPayload.duration,
      referenceImageUrls: [fullPayload.imageUrl],
    })
    taskId = result.taskId
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // 422 → retry with minimal-fallback payload (strip everything decorative)
    if (msg.includes('422') || msg.toLowerCase().includes('unprocessable')) {
      console.warn(`[KLING_FALLBACK cut-${item.cutId}] full payload 422 — retrying with minimal payload`)
      const minimal = buildMinimalFallbackPayload(item, keyframeUrl)
      console.log(
        `[KLING_PAYLOAD cut-${item.cutId} MINIMAL] ` +
        `motion=${minimal.motion} duration=${minimal.duration} promptLen=${minimal.prompt.length}`,
      )
      try {
        const result = await generateVideoJob({
          apiKey,
          jobModelId: minimal.jobModelId,
          prompt: minimal.prompt,
          aspectRatio: minimal.aspectRatio === '1:1' ? '9:16' : minimal.aspectRatio,
          resolution: '720p',
          duration: minimal.duration,
          referenceImageUrls: [minimal.imageUrl],
        })
        taskId = result.taskId
        usedFallback = true
      } catch (fallbackErr) {
        const fbMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
        throw new Error(`Cut-${item.cutId} 422 (cả full + minimal fallback): ${fbMsg.slice(0, 200)}`)
      }
    } else {
      throw err
    }
  }

  if (signal?.aborted) throw new Error('Đã huỷ')

  // 4. Poll until done
  const remoteVideoUrl = await pollVideoJobUntilDone({
    apiKey,
    taskId,
    timeoutMs: 6 * 60 * 1000,  // Kling typical 60-120s; 6min ceiling
  })

  if (signal?.aborted) throw new Error('Đã huỷ')

  // 5. Fetch + persist the MP4
  const resp = await fetch(remoteVideoUrl)
  if (!resp.ok) throw new Error(`Fetch cut-${item.cutId} clip lỗi: ${resp.status}`)
  const blob = await resp.blob()
  const videoRef = await saveAsset(blob, blob.type || 'video/mp4')

  return { videoRef, taskId, usedFallback }
}

// ═════════════════════════════════════════════════════════════════════════
// Worker pool — concurrency 2, mirrors videoGenJobRunner pattern
// ═════════════════════════════════════════════════════════════════════════

export async function runTimelineRender(params: RunTimelineRenderParams): Promise<void> {
  const { apiKey, job, signal, onCutUpdate, onProgress } = params
  const concurrency = params.concurrency ?? 2
  const items = job.items

  const total = items.length
  let done = 0
  let failed = 0
  onProgress?.(done, failed, total)

  console.log(
    `[TIMELINE_RENDER START] job=${job.id} items=${total} ` +
    `concurrency=${concurrency} estimated=${job.estimatedDurationSec.toFixed(1)}s`,
  )

  // Queue index — only items not already terminal
  const queueIndices: number[] = []
  items.forEach((it, idx) => {
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
        console.log(`[TIMELINE_RENDER END] done=${done} failed=${failed} total=${total}`)
        resolve()
      }
    }

    const pump = () => {
      while (!resolved && active < concurrency && cursor < queueIndices.length) {
        if (signal?.aborted) {
          // Cancel remaining queued items
          for (let i = cursor; i < queueIndices.length; i++) {
            const idx = queueIndices[i]
            onCutUpdate({
              cutId: items[idx].cutId,
              status: 'cancelled',
              error: 'Đã huỷ',
            })
          }
          cursor = queueIndices.length
          finish()
          return
        }

        const idx = queueIndices[cursor++]
        const item = items[idx]
        active++

        onCutUpdate({ cutId: item.cutId, status: 'generating' })

        submitCutToKling(item, apiKey, signal)
          .then(({ videoRef, taskId, usedFallback }) => {
            console.log(`[TIMELINE_RENDER cut-${item.cutId}] DONE ${usedFallback ? '(via minimal fallback)' : ''}`)
            onCutUpdate({
              cutId: item.cutId,
              status: 'completed',
              videoRef,
              taskId,
            })
            done++
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err)
            const isCancel = msg.includes('huỷ') || msg.toLowerCase().includes('abort') || signal?.aborted
            console.error(`[TIMELINE_RENDER cut-${item.cutId}] FAIL: ${msg.slice(0, 200)}`)
            onCutUpdate({
              cutId: item.cutId,
              status: isCancel ? 'cancelled' : 'failed',
              error: msg.slice(0, 200),
              retryCount: (item.retryCount ?? 0) + 1,
            })
            if (!isCancel) failed++
          })
          .finally(() => {
            active--
            onProgress?.(done, failed, total)
            pump()
            finish()
          })
      }
      finish()
    }

    pump()
  })
}

// ═════════════════════════════════════════════════════════════════════════
// Single-cut retry helper (per-card "Try again" button in UI)
// ═════════════════════════════════════════════════════════════════════════

export async function retrySingleCut(
  item: TimelineRenderItem,
  apiKey: string,
  onUpdate: (update: CutStatusUpdate) => void,
): Promise<void> {
  onUpdate({ cutId: item.cutId, status: 'generating' })
  try {
    const { videoRef, taskId, usedFallback } = await submitCutToKling(item, apiKey, undefined)
    console.log(`[TIMELINE_RENDER cut-${item.cutId}] RETRY DONE ${usedFallback ? '(via minimal)' : ''}`)
    onUpdate({
      cutId: item.cutId,
      status: 'completed',
      videoRef,
      taskId,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[TIMELINE_RENDER cut-${item.cutId}] RETRY FAIL: ${msg.slice(0, 200)}`)
    onUpdate({
      cutId: item.cutId,
      status: 'failed',
      error: msg.slice(0, 200),
      retryCount: (item.retryCount ?? 0) + 1,
    })
  }
}
