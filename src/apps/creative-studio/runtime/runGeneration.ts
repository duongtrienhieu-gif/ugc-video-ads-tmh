// ── Generation Runner (P13 + P24 traced + resilient) ──────────────────────
//
// Fire-and-forget async runner. Called from the click handler — does
// not block UI.
//
// Drives a job through:
//   1. createJob() → store + (optional) DB insert  ← ALWAYS succeeds
//   2. patchJob({ status: 'generating' })
//   3. await generateAssets(...) — engine pipeline (KIE / Gemini / canvas)
//   4. patchJob({ status: 'completed', outputs: [asset] })
//      OR patchJob({ status: 'failed', errorMessage })
//
// Every step is console.info'd so the user can open F12 and see
// exactly where a generation fails.

import { generateAssets } from '../orchestration/generateAssets'
import type { AssetTypeId } from '../types/asset'
import { useGenerationsStore } from '../stores/generationsStore'
import type { GenerationInputs } from '../services/generationsAPI'

export interface RunGenerationArgs {
  creativeType: AssetTypeId
  inputs: GenerationInputs
}

export async function runGeneration(args: RunGenerationArgs): Promise<string> {
  console.info('[runGeneration] STEP 1 — createJob', args)
  const store = useGenerationsStore.getState()
  const job = await store.createJob(args.creativeType, args.inputs)
  console.info('[runGeneration] STEP 1 — job created', { id: job.id, isLocal: job.id.startsWith('local_') })

  void executeJob(job.id, args)
  return job.id
}

async function executeJob(jobId: string, args: RunGenerationArgs): Promise<void> {
  const store = useGenerationsStore.getState()

  console.info('[runGeneration] STEP 2 — mark generating', { jobId })
  await store.patchJob(jobId, { status: 'generating', progress: 5 })

  try {
    console.info('[runGeneration] STEP 3 — generateAssets call', {
      creativeType: args.creativeType,
      productId: args.inputs.productId,
      modelId:   args.inputs.modelId,
    })

    const asset = await generateAssets(args.creativeType, {
      productId: args.inputs.productId,
      modelId:   args.inputs.modelId,
      options: {
        ...(args.inputs.options ?? {}),
        ...(args.inputs.referenceRefs && args.inputs.referenceRefs.length > 0
          ? { referenceRefs: args.inputs.referenceRefs }
          : {}),
      },
    })

    console.info('[runGeneration] STEP 4 — generateAssets OK', {
      jobId,
      assetId: asset.id,
      engineGroup: asset.metadata.engineGroup,
      outputUrl: asset.outputUrl,
    })

    await store.patchJob(jobId, {
      status:   'completed',
      progress: 100,
      outputs:  [asset],
    })
    console.info('[runGeneration] STEP 5 — job completed', { jobId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error('[runGeneration] STEP 3 — generateAssets FAILED', { jobId, err })
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
