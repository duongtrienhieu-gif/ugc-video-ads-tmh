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
//
// ── Z24 PROVIDER OVERLOAD FIX (current) ────────────────────────────────────
// Symptom: 8 heavy image-edit requests fired in parallel cause KIE provider
// queue to stall → 300s timeouts on 2/8 scenes.
//
// Strategy:
//   1. STAGED orchestration — render the highest-priority scene ALONE first
//      (establishes identity / style / packaging cache on KIE side), then
//      open the worker pool for the remaining scenes.
//   2. Concurrency cap: 2 (was 3). Even with the Fast wrapper's 90s
//      attempt timeout, 8 parallel image-edit jobs trample the provider.
//   3. Watchdog: per-scene setTimeout(75s) flags 'provider_stuck' if the
//      Fast wrapper hasn't returned yet — UI surfaces this before the
//      90s hard-cut triggers a fresh resubmission.
//   4. New status callbacks: provider_stuck / retrying_provider / recovered
//      so the grid card shows what's happening instead of just spinning.
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
  /** Z24: max scenes in flight simultaneously DURING STAGE 2. Default 2
   *  (was 3 in Z9). KIE provider queue stalls under 3+ heavy image-edits;
   *  2 stays just below the saturation threshold we observed. Stage 1
   *  (scene[0]) always runs solo regardless of this value. */
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

  // Z24: default 2 (was 3). Cap raised slightly (4 max) so power users can
  // still override, but never above 4 — KIE provider saturates around there.
  const concurrency = Math.max(1, Math.min(4, params.concurrency ?? 2))

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
// Z24: STAGED ORCHESTRATION
//
//   Stage 1 — render dispatch[0] ALONE and await. This is the highest-
//   priority scene (usually the hook). Running it solo:
//     • avoids parallel-load contention with the heavy first request
//     • establishes identity / packaging refs on KIE's side (cache warm)
//     • surfaces auth / quota / hard provider failures FAST so the user
//       can stop the whole queue before we burn credit on 7 more
//
//   Stage 2 — open the worker pool with `concurrency` (default 2) for
//   the remaining scenes. As each completes, the pump launches the
//   next-priority scene until the queue drains.
//
// All other scenes start in 'queued' state until the pool launches them.
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
    `[SCENE_GEN STAGED] start · stage2_concurrency=${concurrency} · ` +
    `dispatch = [${dispatchOrder.map((i) => `${i + 1}(${blueprints[i].sceneType ?? 'na'})`).join(', ')}]`,
  )

  // Mark all non-terminal items as 'queued' so the UI shows they're waiting
  // (instead of leaving them in 'pending' which looks like "not yet started").
  for (const idx of dispatchOrder) {
    const cur = storeGet().job?.items[idx]
    if (cur && cur.status !== 'approved' && cur.status !== 'failed') {
      storeGet().patchItem(idx, { status: 'queued' })
    }
  }

  // ── STAGE 1: solo render of dispatch[0] ─────────────────────────────────
  if (dispatchOrder.length > 0) {
    const firstIdx = dispatchOrder[0]
    const job0 = storeGet().job
    if (job0 && (job0.status === 'cancelled' || job0.status === 'paused')) {
      console.log(`[SCENE_GEN STAGED] cancelled before stage 1`)
    } else if (job0?.items[firstIdx]?.status !== 'approved' && job0?.items[firstIdx]?.status !== 'failed') {
      console.log(`[SCENE_GEN STAGED] stage 1 · solo render scene ${firstIdx + 1} (${blueprints[firstIdx].sceneType ?? 'na'}) — establishing identity/style/packaging cache`)
      storeGet().setQueueState({ currentIdx: firstIdx })
      storeGet().patchItem(firstIdx, { status: 'generating', startedAt: Date.now() })
      await runOne(params, blueprints, firstIdx)
      console.log(`[SCENE_GEN STAGED] stage 1 done · opening pool for ${dispatchOrder.length - 1} remaining scene(s)`)
    }
  }

  // ── STAGE 2: pool with `concurrency` for remaining scenes ───────────────
  let cursor = 1  // start after dispatch[0]
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
          console.log(`[SCENE_GEN STAGED] stage 2 ${current.status} — stopped launching new scenes`)
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
    console.log(`[SCENE_GEN STAGED] queue finished · status=${wasCancelled ? 'cancelled' : anyFailed ? 'failed' : 'completed'}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Run ONE scene end-to-end. Used by the worker pool above + manual regen.
// Patches the store; never throws (errors land in item.error).
//
// Z24: adds a soft-watchdog timer that marks the item 'provider_stuck'
// at 75s if the Fast wrapper hasn't returned. Wrapper's hard-cut at 90s
// then triggers a fresh resubmission → 'retrying_provider' callback fires.
// On eventual success, a brief 'recovered' flash precedes the QC update.
// ─────────────────────────────────────────────────────────────────────────
async function runOne(
  params: StartSceneQueueParams,
  blueprints: SceneBlueprint[],
  itemIdx: number,
): Promise<void> {
  const storeGet = useSceneGenJobStore.getState
  let usedProviderRetry = false  // set when onProviderRetry fires

  // Z24: watchdog — if the first KIE submission is still in flight at 75s,
  // surface 'provider_stuck' in the UI. The Fast wrapper will hard-cut at
  // 90s and trigger onProviderRetry (which flips us to 'retrying_provider').
  const stuckWatchdog = setTimeout(() => {
    const cur = storeGet().job?.items[itemIdx]
    if (cur && cur.status === 'generating') {
      console.warn(`[SCENE_GEN STAGED] scene ${itemIdx + 1} → provider_stuck (watchdog 75s)`)
      storeGet().patchItem(itemIdx, { status: 'provider_stuck' })
    }
  }, 75_000)

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
      onProviderStuck: (attempt, total) => {
        console.warn(`[SCENE_GEN STAGED] scene ${itemIdx + 1} provider_stuck attempt ${attempt}/${total}`)
        storeGet().patchItem(itemIdx, { status: 'provider_stuck' })
      },
      onProviderRetry: (attempt, total) => {
        usedProviderRetry = true
        console.warn(`[SCENE_GEN STAGED] scene ${itemIdx + 1} retrying_provider attempt ${attempt}/${total}`)
        storeGet().patchItem(itemIdx, { status: 'retrying_provider' })
      },
      onRecovered: () => {
        storeGet().patchItem(itemIdx, { status: 'recovered' })
      },
    })

    // Z24: brief "recovered" flash before the final approved/rejected status
    // — only if we actually had a provider retry, so the user sees the win.
    if (usedProviderRetry) {
      storeGet().patchItem(itemIdx, { status: 'recovered' })
      // tiny delay so the UI gets to paint the recovered chip before flipping
      await new Promise<void>((r) => setTimeout(r, 400))
    }

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
      `[SCENE_GEN STAGED] scene ${itemIdx + 1}/${blueprints.length} done — ` +
      `status=${autoApprove ? 'approved' : 'rejected'}${usedProviderRetry ? ' (via provider retry)' : ''}`,
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
      console.error(`[SCENE_GEN STAGED] scene ${itemIdx + 1} failed:`, msg)
    }
  } finally {
    clearTimeout(stuckWatchdog)
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
