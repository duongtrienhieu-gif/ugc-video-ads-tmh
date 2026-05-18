// ── Timeline Renderer Job Runner ─────────────────────────────────────────────
// Z22 — Cut-level worker pool. Processes TimelineRenderJob.items through
// Kling 3.0 std via KIE.ai with concurrency 2 (matches videoGenJobRunner
// pattern). Per-cut status updates pushed via callbacks.
//
// On 422 from Kling: auto-retry once with minimal-fallback payload. If
// minimal also fails, mark cut failed + move on.
//
// ── Z26 INCREMENTAL RENDER ───────────────────────────────────────────────
// Adds store-wired entry points that respect the LOCK + SKIP semantics
// from useTimelineRenderJobStore. The legacy callback-based runner
// (runTimelineRender) is kept for non-store callers.
//
//   startTimelineRender({ apiKey, cutIds?, signal?, concurrency? })
//     • Reads the active job from the store.
//     • If cutIds passed: only render those cuts (preview / batch).
//       Else: render all status='pending' (+ 'failed' if includeFailed).
//     • ALWAYS skips 'locked' + 'skipped' + 'completed' items.
//     • Writes status updates back to the store directly.
//
//   renderSingleCut(cutId, { apiKey, signal? })
//     • Single-cut render (used by per-card [Render] / [Rerender] button).
//     • Resets status to 'queued' → 'generating' → 'completed' | 'failed'.
//     • Never bumps a 'locked' cut.
// ─────────────────────────────────────────────────────────────────────────

import type {
  TimelineRenderItem, TimelineRenderJob, TimelineRenderStatus,
} from '../types'
import {
  buildKlingPayloadForCut, buildMinimalFallbackPayload, validateKlingPayload,
} from './timelineRenderer'
import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'
import { generateVideoJob, pollVideoJobUntilDone } from '../../../../utils/kieai'
import { useTimelineRenderJobStore } from '../stores/timelineRenderJobStore'

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

  // Queue index — only items not already terminal. Z26 also skips
  // 'locked' + 'skipped'; Z28 adds 'approved' + 'rejected'. Every direct
  // caller of the legacy entry point inherits the full skip semantics.
  const queueIndices: number[] = []
  items.forEach((it, idx) => {
    if (
      it.status !== 'completed' &&
      it.status !== 'cancelled' &&
      it.status !== 'locked' &&
      it.status !== 'skipped' &&
      it.status !== 'approved' &&  // Z28
      it.status !== 'rejected'     // Z28
    ) queueIndices.push(idx)
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

// ═════════════════════════════════════════════════════════════════════════
// Z26 — STORE-WIRED ENTRY POINTS (lock/skip aware)
// ═════════════════════════════════════════════════════════════════════════
//
// These wrap the legacy callback runner with reads + writes against
// useTimelineRenderJobStore. Used by the new TimelineRenderGrid UI.
//
// The lock semantics are enforced HERE so callers don't have to remember:
//   • Bulk render skips 'locked' + 'skipped' + 'completed'.
//   • Single-cut render REFUSES to touch 'locked' (no-op + warn).
//   • Single-cut render on a 'completed' cut treats it as a rerender —
//     overwrites the previous videoRef.

export interface StartTimelineRenderParams {
  apiKey: string
  /** Optional explicit list of cut IDs to render. If omitted, runs every
   *  status='pending' item. Locked / skipped / completed are NEVER
   *  rendered regardless of this list — that's the whole point of Z26. */
  cutIds?: number[]
  /** Include 'failed' items in the bulk run (default false — failed
   *  retries go through a separate UI button to avoid surprise reruns). */
  includeFailed?: boolean
  /** Worker concurrency. Default 2 — KIE Kling handles 2 well; higher
   *  risks the same provider-overload pattern that hit scene-gen. */
  concurrency?: number
  signal?: AbortSignal
}

/**
 * Z26 — Render the eligible subset of the active TimelineRenderJob.
 * Reads from useTimelineRenderJobStore, writes status patches back.
 *
 * Returns when all targeted cuts have settled (completed | failed |
 * cancelled). Throws only on fatal "no job in store" errors.
 */
export async function startTimelineRender(
  params: StartTimelineRenderParams,
): Promise<{ done: number; failed: number; skipped: number }> {
  const store = useTimelineRenderJobStore.getState
  const job = store().job
  if (!job) {
    throw new Error('Chưa có timeline render job — quay lại bước "Coverage & Timeline" để build trước')
  }

  // Build the eligible target set:
  //   1. Start with cutIds if provided, else all items.
  //   2. Filter out locked / skipped / completed (always).
  //   3. Z28: also filter out approved + rejected (user verdicts excluded
  //      from bulk by design — don't burn credit re-rendering work the
  //      user already gave a verdict on).
  //   4. Filter out failed unless includeFailed=true.
  //   5. Filter out generating (already in flight from another caller).
  const requested = params.cutIds ? new Set(params.cutIds) : null
  const eligible = job.items.filter((it) => {
    if (requested && !requested.has(it.cutId)) return false
    if (it.status === 'locked'   || it.status === 'skipped'   || it.status === 'completed') return false
    if (it.status === 'approved' || it.status === 'rejected') return false  // Z28
    if (it.status === 'generating') return false
    if (it.status === 'failed' && !params.includeFailed) return false
    return true
  })

  if (eligible.length === 0) {
    console.log(`[TIMELINE_RENDER Z26/Z28] no eligible cuts to render — all locked/skipped/completed/approved/rejected`)
    return { done: 0, failed: 0, skipped: 0 }
  }

  console.log(
    `[TIMELINE_RENDER Z26] start · targets=${eligible.length} · ` +
    `concurrency=${params.concurrency ?? 2} · includeFailed=${params.includeFailed ?? false}`,
  )

  // Mark targets queued + set runner flag
  store().setJobState({ isRunning: true, isPaused: false })
  for (const it of eligible) {
    store().patchItem(it.cutId, { status: 'queued', error: undefined })
  }

  let done = 0
  let failed = 0

  // Build a synthetic job containing ONLY the eligible items so we can
  // reuse the legacy worker pool. Store patches still happen via the
  // onCutUpdate callback below.
  const syntheticJob: TimelineRenderJob = { ...job, items: eligible }

  try {
    await runTimelineRender({
      apiKey: params.apiKey,
      job: syntheticJob,
      concurrency: params.concurrency ?? 2,
      signal: params.signal,
      onCutUpdate: (update) => {
        // Z26 hardening — NEVER overwrite a 'locked' item even if the
        // runner somehow gets a stale callback for it. Belt-and-braces.
        const cur = store().job?.items.find((i) => i.cutId === update.cutId)
        if (cur?.status === 'locked') {
          console.warn(`[TIMELINE_RENDER Z26] ignored status update for locked cut-${update.cutId}`)
          return
        }
        const patch: Partial<TimelineRenderItem> = {
          status: update.status,
        }
        if (update.taskId !== undefined)      patch.taskId = update.taskId
        if (update.videoRef !== undefined)    patch.videoRef = update.videoRef
        if (update.error !== undefined)       patch.error = update.error
        if (update.retryCount !== undefined)  patch.retryCount = update.retryCount
        if (update.status === 'generating')   patch.startedAt = Date.now()
        if (update.status === 'completed' || update.status === 'failed') patch.finishedAt = Date.now()
        store().patchItem(update.cutId, patch)
      },
      onProgress: (d, f) => {
        done = d
        failed = f
      },
    })
  } finally {
    store().setJobState({ isRunning: false })
  }

  console.log(`[TIMELINE_RENDER Z26] end · done=${done} failed=${failed}`)
  return { done, failed, skipped: 0 }
}

/**
 * Z26 — Render a single cut (per-card [Render] / [Rerender] / [Preview]).
 * Refuses to touch a 'locked' cut. On a 'completed' cut it acts as a
 * rerender — overwrites videoRef on success.
 */
export async function renderSingleCut(
  cutId: number,
  params: { apiKey: string; signal?: AbortSignal },
): Promise<void> {
  const store = useTimelineRenderJobStore.getState
  const job = store().job
  if (!job) throw new Error('Chưa có timeline render job')

  const item = job.items.find((it) => it.cutId === cutId)
  if (!item) throw new Error(`Không tìm thấy cut-${cutId}`)

  if (item.status === 'locked') {
    console.warn(`[TIMELINE_RENDER Z26] renderSingleCut cut-${cutId} refused — clip đã khoá. Mở khoá trước.`)
    return
  }
  if (item.status === 'generating') {
    console.warn(`[TIMELINE_RENDER Z26] renderSingleCut cut-${cutId} skipped — already in flight`)
    return
  }

  store().patchItem(cutId, {
    status: 'generating',
    startedAt: Date.now(),
    error: undefined,
  })

  try {
    const { videoRef, taskId, usedFallback } =
      await submitCutToKling(item, params.apiKey, params.signal)
    console.log(`[TIMELINE_RENDER Z26 cut-${cutId}] single-render DONE${usedFallback ? ' (via minimal fallback)' : ''}`)

    // Z26/Z28 race guard — if the user locked OR approved this cut while
    // it was rendering, honour the verdict (keep previous videoRef) and
    // discard this one. Rejected isn't checked because rejected → rerender
    // is the EXPECTED flow ("user said no, take another shot").
    const after = store().job?.items.find((i) => i.cutId === cutId)
    if (after?.status === 'locked' || after?.status === 'approved') {
      console.warn(`[TIMELINE_RENDER Z28] cut-${cutId} ${after.status} mid-flight — discarding new videoRef`)
      return
    }
    store().patchItem(cutId, {
      status: 'completed',
      videoRef,
      taskId,
      finishedAt: Date.now(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const isCancel = msg.includes('huỷ') || msg.toLowerCase().includes('abort') || params.signal?.aborted
    console.error(`[TIMELINE_RENDER Z26 cut-${cutId}] single-render FAIL: ${msg.slice(0, 200)}`)
    store().patchItem(cutId, {
      status: isCancel ? 'cancelled' : 'failed',
      error: msg.slice(0, 200),
      retryCount: (item.retryCount ?? 0) + 1,
      finishedAt: Date.now(),
    })
  }
}
