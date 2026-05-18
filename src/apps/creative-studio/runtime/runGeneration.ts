// ── Generation Runner (P13) ────────────────────────────────────────────────
//
// Fire-and-forget async runner. Called from the click handler — does
// not block UI. Drives a job through:
//
//   1. createJob() → 'queued' row in Supabase + store
//   2. patchJob({ status: 'generating' }) — UI shows spinner card
//   3. await generateAssets(...) — engine pipeline (KIE / Gemini / canvas)
//   4. patchJob({ status: 'completed', outputs: [asset] }) — DB + UI
//      OR
//      patchJob({ status: 'failed', errorMessage: ... })
//
// The runner NEVER throws — it always finishes the job lifecycle so
// the UI never gets stuck on a perpetual spinner.

import { generateAssets } from '../orchestration/generateAssets'
import type { AssetTypeId } from '../types/asset'
import { useGenerationsStore } from '../stores/generationsStore'
import type { GenerationInputs } from '../services/generationsAPI'

export interface RunGenerationArgs {
  creativeType: AssetTypeId
  inputs: GenerationInputs
}

/**
 * Kick off a generation job. Returns the created job id so the caller
 * can scroll-to / highlight the new card if desired. Does NOT await
 * the actual render — the heavy work happens in the background.
 */
export async function runGeneration(args: RunGenerationArgs): Promise<string> {
  const store = useGenerationsStore.getState()
  const job = await store.createJob(args.creativeType, args.inputs)

  // Kick off in background — caller returns immediately
  void executeJob(job.id, args)

  return job.id
}

async function executeJob(jobId: string, args: RunGenerationArgs): Promise<void> {
  const store = useGenerationsStore.getState()

  // 'queued' → 'generating' (sync DB write so the change is durable)
  await store.patchJob(jobId, { status: 'generating', progress: 5 })

  try {
    const asset = await generateAssets(args.creativeType, {
      productId: args.inputs.productId,
      modelId:   args.inputs.modelId,
      options: {
        ...(args.inputs.options ?? {}),
        // P13: reference refs (if any) — engine dispatchers consume
        ...(args.inputs.referenceRefs && args.inputs.referenceRefs.length > 0
          ? { referenceRefs: args.inputs.referenceRefs }
          : {}),
      },
    })

    await store.patchJob(jobId, {
      status:   'completed',
      progress: 100,
      outputs:  [asset],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error('[runGeneration.executeJob]', err)
    await store.patchJob(jobId, {
      status:       'failed',
      errorMessage: friendlyError(msg),
    })
  }
}

function friendlyError(raw: string): string {
  const low = raw.toLowerCase()
  if (low.includes('api key')) return 'Thiếu API key — vào Cài đặt để thêm'
  if (low.includes('credit') || low.includes('insufficient')) return 'Hết KIE credit — nạp thêm rồi thử lại'
  if (low.includes('network') || low.includes('fetch') || low.includes('timeout')) return 'Lỗi mạng — thử lại sau'
  return 'Tạo asset chưa thành công — bấm "Tạo lại"'
}
