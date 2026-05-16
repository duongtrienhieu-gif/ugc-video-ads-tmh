// ── Scene Gen Job Runner ─────────────────────────────────────────────────────
// Orchestrates the sequential 9-scene generation queue. Each scene runs through
// generateScene() (gen + QC + smart-retry), updates the store on every status
// change, then moves to the next scene.
//
// Sequential = 1-by-1, NOT parallel. Reasons:
//   • KIE rate limits — burst calls trigger 429s
//   • User can observe progress + abort mid-queue
//   • Failed scenes don't waste credit if user wants to bail early
//
// Cancellation: setting job.status to 'cancelled' or 'paused' breaks the loop
// at the next iteration boundary (between scenes, not mid-gen).
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
  /** Cost control: skip QC retry per scene */
  lowCostMode?: boolean
}

/**
 * Initialize the queue store + kick off the sequential runner.
 * Returns immediately; the runner runs as a detached promise.
 */
export function startSceneGenQueue(params: StartSceneQueueParams): void {
  const store = useSceneGenJobStore.getState()

  // Build initial job
  const items: SceneGenItem[] = params.blueprints.map((blueprint) => ({
    sceneId: blueprint.sceneId,
    blueprint,
    status: 'pending',
    imageUrl: null,
    retryCount: 0,
  }))

  const job: SceneGenJob = {
    startedAt: Date.now(),
    masterFrameUrl: params.masterFrameUrl,
    identity: params.identity,
    productName: params.productName,
    consistency: params.consistency,
    dna: params.dna,
    lowCostMode: params.lowCostMode ?? false,
    items,
    currentIdx: -1,
    status: 'running',
  }
  store.createQueue(job)

  // Detached runner — caller does NOT await
  runQueue(params).catch((err) => {
    console.error('[sceneGenJobRunner] uncaught error:', err)
    useSceneGenJobStore.getState().setQueueState({ status: 'failed' })
  })
}

// ── Internal sequential loop ─────────────────────────────────────────────────

async function runQueue(params: StartSceneQueueParams): Promise<void> {
  const store = useSceneGenJobStore.getState
  const blueprints = params.blueprints

  for (let i = 0; i < blueprints.length; i++) {
    const currentJob = store().job
    if (!currentJob) return  // cleared externally — bail

    // User cancelled / paused — exit between iterations
    if (currentJob.status === 'cancelled' || currentJob.status === 'paused') {
      console.log(`[sceneGenJobRunner] queue ${currentJob.status} at scene ${i + 1}`)
      return
    }

    // Skip already-finished items (in case we're resuming a partial queue)
    if (currentJob.items[i].status === 'approved' || currentJob.items[i].status === 'failed') {
      continue
    }

    store().setQueueState({ currentIdx: i })
    store().patchItem(i, { status: 'generating', startedAt: Date.now() })

    try {
      const result = await generateScene({
        kieApiKey: params.kieApiKey,
        geminiKey: params.geminiKey,
        blueprint: blueprints[i],
        masterFrameUrl: params.masterFrameUrl,
        identity: params.identity,
        productName: params.productName,
        consistency: params.consistency,
        dna: params.dna,
        lowCostMode: params.lowCostMode ?? false,
        onAttempt: (attemptIdx, qc) => {
          // attemptIdx > 0 → we're in a retry
          if (attemptIdx === 0) {
            store().patchItem(i, { status: 'generating' })
          } else if (qc === null) {
            store().patchItem(i, { status: 'retrying', retryCount: attemptIdx })
          } else if (!qc.passed) {
            store().patchItem(i, { status: 'auto_validating', retryCount: attemptIdx, qc })
          } else {
            store().patchItem(i, { status: 'auto_validating', qc })
          }
        },
      })

      // Final accepted (or best-of-N) — auto-approve if QC passed (or lowCostMode)
      const autoApprove = result.passedOnLastTry || params.lowCostMode
      store().patchItem(i, {
        status: autoApprove ? 'approved' : 'rejected',
        imageUrl: result.imageUrl,
        promptUsed: result.promptUsed,
        qc: result.qc,
        retryCount: result.retryCount,
        finishedAt: Date.now(),
      })

      console.log(`[sceneGenJobRunner] scene ${i + 1}/${blueprints.length} done, status=${autoApprove ? 'approved' : 'rejected'}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const isCancelled = msg.includes('CANCELLED')
      store().patchItem(i, {
        status: isCancelled ? 'cancelled' : 'failed',
        error: msg.slice(0, 200),
        finishedAt: Date.now(),
      })
      if (isCancelled) {
        store().setQueueState({ status: 'cancelled' })
        return
      }
      console.error(`[sceneGenJobRunner] scene ${i + 1} failed:`, msg)
      // Continue to next scene even on failure — don't abandon the whole queue
    }
  }

  // Queue finished — set final status
  const final = store().job
  if (final) {
    const anyFailed = final.items.some((it) => it.status === 'failed')
    store().setQueueState({
      currentIdx: -1,
      status: anyFailed ? 'failed' : 'completed',
    })
  }
}

// ── Manual regen of a single scene (user clicks regen on a card) ─────────────

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
