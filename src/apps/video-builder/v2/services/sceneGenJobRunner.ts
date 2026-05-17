// ── Scene Gen Job Runner ─────────────────────────────────────────────────────
// Orchestrates the 9-scene generation queue. Each scene runs through
// generateScene() (gen + QC + smart-retry), updates the store on every status
// change.
//
// Z9 PERFORMANCE FIX — was sequential, now PARALLEL:
//   • Worker-pool concurrency (default 3) — was 1-by-1
//   • Priority queue — narrative-critical beats render first so the user
//     sees hero / pain / discovery scenes before fillers
//   • Each scene still cancellable via job.status='cancelled' between
//     iterations of the pump (not mid-network-call)
//
// Cancellation: setting job.status='cancelled' stops the pump from launching
// any further scenes. In-flight scenes continue to completion (KIE doesn't
// expose abort) — their results still land in the store.
// ─────────────────────────────────────────────────────────────────────────────

import { useSceneGenJobStore } from '../stores/sceneGenJobStore'
import { generateScene } from './sceneGenEngine'
import type {
  SceneBlueprint,
  IdentityPack,
  ConsistencyConfig,
  VisualStyleDna,
  SceneGenJob,
  SceneGenItem,
  SceneType,
} from '../types'

export interface StartSceneQueueParams {
  kieApiKey: string
  geminiKey: string
  blueprints: SceneBlueprint[]
  masterFrameUrl: string
  identity: IdentityPack
  productName: string
  consistency: ConsistencyConfig
  dna: VisualStyleDna
  /** Cost control: skip QC retry per scene (also the "Fast Mode" switch) */
  lowCostMode?: boolean
  /** Z9: max scenes in flight simultaneously. Default 3 — KIE happily handles
   *  3 concurrent /gpt4o-image/generate calls. Higher risks 429s. */
  concurrency?: number
}

// ─────────────────────────────────────────────────────────────────────────
// Z9 PRIORITY QUEUE — lower number = higher priority.
// Order chosen so the user sees the most-narratively-critical beats first:
//   hook → pain/frustration/failed_solution → discovery → social_proof/recovery → explanation → lifestyle/cta
// CTA intentionally LATE — it's a closer, not a hook.
// ─────────────────────────────────────────────────────────────────────────
const SCENE_PRIORITY: Record<SceneType, number> = {
  'hook':            0,
  'pain':            1,
  'frustration':     1,
  'failed_solution': 1,
  'discovery':       2,
  'social_proof':    3,
  'recovery':        3,
  'explanation':     4,
  'lifestyle':       5,
  'cta':             5,
}

const DEFAULT_PRIORITY = 9  // unknown / missing sceneType falls to bottom

function priorityFor(sceneType: SceneType | undefined): number {
  if (!sceneType) return DEFAULT_PRIORITY
  return SCENE_PRIORITY[sceneType] ?? DEFAULT_PRIORITY
}

/**
 * Initialize the queue store + kick off the parallel runner.
 * Returns immediately; the runner runs as a detached promise.
 */
export function startSceneGenQueue(params: StartSceneQueueParams): void {
  const store = useSceneGenJobStore.getState()

  // Build initial job — items keep storyboard order in the STORE (so the UI
  // grid still scans left-to-right in narrative order). The runner sorts
  // INTERNALLY by priority for dispatch.
  const items: SceneGenItem[] = params.blueprints.map((blueprint) => ({
    sceneId: blueprint.sceneId,
    blueprint,
    status: 'pending',
    imageUrl: null,
    retryCount: 0,
  }))

  const concurrency = Math.max(1, Math.min(6, params.concurrency ?? 3))

  const job: SceneGenJob = {
    startedAt: Date.now(),
    masterFrameUrl: params.masterFrameUrl,
    identity: params.identity,
    productName: params.productName,
    consistency: params.consistency,
    dna: params.dna,
    lowCostMode: params.lowCostMode ?? false,
    concurrency,
    items,
    currentIdx: -1,
    status: 'running',
  }
  store.createQueue(job)

  // Detached runner — caller does NOT await
  runQueue(params, concurrency).catch((err) => {
    console.error('[sceneGenJobRunner] uncaught error:', err)
    useSceneGenJobStore.getState().setQueueState({ status: 'failed' })
  })
}

// ─────────────────────────────────────────────────────────────────────────
// Z9: PARALLEL WORKER POOL (replaces sequential for-loop).
// Up to `concurrency` scenes run simultaneously. As each completes, the
// pump launches the next-priority scene until the queue drains.
// ─────────────────────────────────────────────────────────────────────────

async function runQueue(params: StartSceneQueueParams, concurrency: number): Promise<void> {
  const storeGet = useSceneGenJobStore.getState
  const blueprints = params.blueprints

  // Build dispatch order: indices into `blueprints` sorted by priority.
  // The store's `items` keeps storyboard order — we only re-order DISPATCH.
  const dispatchOrder = blueprints
    .map((bp, idx) => ({ idx, priority: priorityFor(bp.sceneType) }))
    .sort((a, b) => a.priority - b.priority || a.idx - b.idx)
    .map((x) => x.idx)

  console.log(
    `[sceneGenJobRunner] Z9 parallel queue start: concurrency=${concurrency} · ` +
    `dispatch order = [${dispatchOrder.map((i) => `${i + 1}(${blueprints[i].sceneType ?? 'na'})`).join(', ')}]`,
  )

  let cursor = 0
  await new Promise<void>((resolve) => {
    let active = 0
    let resolved = false

    const finish = () => {
      if (resolved) return
      if (cursor >= dispatchOrder.length && active === 0) {
        resolved = true
        resolve()
      }
    }

    const pump = () => {
      while (!resolved && active < concurrency && cursor < dispatchOrder.length) {
        const current = storeGet().job
        if (!current) { resolved = true; resolve(); return }

        // User cancelled / paused — stop launching new scenes (in-flight ones
        // finish on their own)
        if (current.status === 'cancelled' || current.status === 'paused') {
          console.log(`[sceneGenJobRunner] queue ${current.status} — stopped launching new scenes`)
          cursor = dispatchOrder.length
          finish()
          return
        }

        const itemIdx = dispatchOrder[cursor++]

        // Skip if this slot already has a terminal result (resume scenarios)
        if (current.items[itemIdx]?.status === 'approved' || current.items[itemIdx]?.status === 'failed') {
          continue
        }

        active++
        // Move legacy "currentIdx" forward to the latest launched scene so the
        // existing UI header keeps showing progress
        storeGet().setQueueState({ currentIdx: itemIdx })
        storeGet().patchItem(itemIdx, { status: 'generating', startedAt: Date.now() })

        runOne(params, blueprints, itemIdx)
          .finally(() => {
            active--
            pump()
            finish()
          })
      }
      finish()
    }

    pump()
  })

  // Queue finished — set final status
  const final = storeGet().job
  if (final) {
    const anyFailed = final.items.some((it) => it.status === 'failed')
    const wasCancelled = final.status === 'cancelled'
    storeGet().setQueueState({
      currentIdx: -1,
      status: wasCancelled ? 'cancelled' : anyFailed ? 'failed' : 'completed',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Run ONE scene end-to-end. Used by the worker pool above + manual regen.
// Patches the store; never throws (errors land in item.error).
// ─────────────────────────────────────────────────────────────────────────
async function runOne(
  params: StartSceneQueueParams,
  blueprints: SceneBlueprint[],
  itemIdx: number,
): Promise<void> {
  const storeGet = useSceneGenJobStore.getState

  try {
    const result = await generateScene({
      kieApiKey: params.kieApiKey,
      geminiKey: params.geminiKey,
      blueprint: blueprints[itemIdx],
      masterFrameUrl: params.masterFrameUrl,
      identity: params.identity,
      productName: params.productName,
      consistency: params.consistency,
      dna: params.dna,
      lowCostMode: params.lowCostMode ?? false,
      onAttempt: (attemptIdx, qc) => {
        if (attemptIdx === 0) {
          storeGet().patchItem(itemIdx, { status: 'generating' })
        } else if (qc === null) {
          storeGet().patchItem(itemIdx, { status: 'retrying', retryCount: attemptIdx })
        } else if (!qc.passed) {
          storeGet().patchItem(itemIdx, { status: 'auto_validating', retryCount: attemptIdx, qc })
        } else {
          storeGet().patchItem(itemIdx, { status: 'auto_validating', qc })
        }
      },
    })

    const autoApprove = result.passedOnLastTry || params.lowCostMode
    storeGet().patchItem(itemIdx, {
      status: autoApprove ? 'approved' : 'rejected',
      imageUrl: result.imageUrl,
      promptUsed: result.promptUsed,
      qc: result.qc,
      retryCount: result.retryCount,
      finishedAt: Date.now(),
    })
    console.log(
      `[sceneGenJobRunner] scene ${itemIdx + 1}/${blueprints.length} done — ` +
      `status=${autoApprove ? 'approved' : 'rejected'}`,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const isCancelled = msg.includes('CANCELLED')
    storeGet().patchItem(itemIdx, {
      status: isCancelled ? 'cancelled' : 'failed',
      error: msg.slice(0, 200),
      finishedAt: Date.now(),
    })
    if (isCancelled) {
      // Cancel cascades: mark whole queue cancelled (pump will stop next tick)
      storeGet().setQueueState({ status: 'cancelled' })
    } else {
      console.error(`[sceneGenJobRunner] scene ${itemIdx + 1} failed:`, msg)
    }
  }
}

// ── Manual regen of a single scene (user clicks regen on a card) ─────────────
// Unchanged — single-scene regen runs as its own detached promise; doesn't
// touch the worker pool.

export async function regenerateScene(idx: number, params: StartSceneQueueParams): Promise<void> {
  const store = useSceneGenJobStore.getState
  const cur = store().job
  if (!cur) return
  if (idx < 0 || idx >= cur.items.length) return

  store().patchItem(idx, { status: 'generating', retryCount: 0, qc: null, error: undefined, startedAt: Date.now() })

  try {
    const blueprint = cur.items[idx].blueprint
    const result = await generateScene({
      kieApiKey: params.kieApiKey,
      geminiKey: params.geminiKey,
      blueprint,
      masterFrameUrl: cur.masterFrameUrl,
      identity: cur.identity,
      productName: cur.productName,
      consistency: cur.consistency,
      dna: cur.dna,
      lowCostMode: cur.lowCostMode,
      onAttempt: (attemptIdx, qc) => {
        if (attemptIdx === 0) {
          store().patchItem(idx, { status: 'generating' })
        } else if (qc === null) {
          store().patchItem(idx, { status: 'retrying', retryCount: attemptIdx })
        }
      },
    })

    const autoApprove = result.passedOnLastTry || cur.lowCostMode
    store().patchItem(idx, {
      status: autoApprove ? 'approved' : 'rejected',
      imageUrl: result.imageUrl,
      promptUsed: result.promptUsed,
      qc: result.qc,
      retryCount: result.retryCount,
      finishedAt: Date.now(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    store().patchItem(idx, { status: 'failed', error: msg.slice(0, 200), finishedAt: Date.now() })
  }
}

// ── Cancel the queue ─────────────────────────────────────────────────────────

export function cancelSceneGenQueue(): void {
  useSceneGenJobStore.getState().setQueueState({ status: 'cancelled' })
}

export function clearSceneGenQueue(): void {
  useSceneGenJobStore.getState().clearJob()
}
