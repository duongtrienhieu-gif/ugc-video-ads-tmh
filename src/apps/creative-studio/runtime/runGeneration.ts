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
import { readLocalization, writeLocalization } from '../services/productLocalizations'
import { nativeRewriteProduct } from '../services/nativeRewrite'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useBankStore } from '../../../stores/bankStore'
import type { UINativeLocale } from '../types/uiNative'

export interface RunGenerationArgs {
  creativeType: AssetTypeId
  inputs: GenerationInputs
  /** P53 — regenerate path. When set, the runner does NOT create a new
   *  job (which would prepend a fresh card to the top of the workspace
   *  and "jump" the new render to the front). Instead it RESETS the
   *  existing job's state (status=queued, progress=0, outputs cleared,
   *  errorMessage cleared) and re-runs executeJob on the same job id.
   *  The card stays in place; only its contents refresh. */
  regenerateJobId?: string
}

export async function runGeneration(args: RunGenerationArgs): Promise<string> {
  const store = useGenerationsStore.getState()
  let jobId: string

  if (args.regenerateJobId) {
    // P53 — in-place regenerate: reuse the existing job id, clear its
    // output so the same card flips back to a loading state without
    // shifting position in the workspace grid.
    console.info('[runGeneration] STEP 1 — regenerate existing job in place', { jobId: args.regenerateJobId, creativeType: args.creativeType })
    jobId = args.regenerateJobId
    await store.patchJob(jobId, {
      status:       'queued',
      progress:     0,
      outputs:      [],
      errorMessage: null,
    })
  } else {
    console.info('[runGeneration] STEP 1 — createJob', args)
    const job = await store.createJob(args.creativeType, args.inputs)
    console.info('[runGeneration] STEP 1 — job created', { id: job.id, isLocal: job.id.startsWith('local_') })
    jobId = job.id
  }

  void executeJob(jobId, args)
  return jobId
}

async function executeJob(jobId: string, args: RunGenerationArgs): Promise<void> {
  const store = useGenerationsStore.getState()

  console.info('[runGeneration] STEP 2 — mark generating', { jobId })
  await store.patchJob(jobId, { status: 'generating', progress: 5 })

  // ── P44 — auto native-rewrite before generation ─────────────────────
  //
  // The product fields in bankStore are stored in whatever language the
  // user entered (often English). The downstream prompts assume the
  // product fields are already in the target locale (via the P32
  // productLocalizations layer) — otherwise we ship English benefits
  // through a prompt that ALSO carries "[LOCALE HARD LOCK — my-MY]
  // visible text must be in Bahasa Melayu", confusing the image model
  // into rendering broken / invented Malay or English-on-Malay hybrids.
  //
  // The nativeRewriteProduct service already exists (P32) — it asks
  // Gemini to RE-WRITE (not translate) the product brief into the target
  // market's native marketing voice and persists the result in
  // localStorage. P44 wires it into the generation pipeline so the user
  // doesn't have to click "Tạo bản native" manually. The rewrite fires
  // exactly once per (productId, locale) pair; subsequent generations
  // hit the cached localization.
  await ensureNativeLocalization(jobId, args)

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

// ── P44 — auto native-rewrite helper ───────────────────────────────────
//
// Decides whether the (productId, locale) pair needs a Gemini-powered
// native rewrite + persists it if so. Failures are logged but never
// fatal — generation continues using the source-language fallback so
// the user still gets an asset, just one that may have mixed-language
// text. Skipped when:
//   - no productId on the job (engines that don't need product context)
//   - no locale on the job options
//   - locale is 'vi-VN' (the legacy "source language" slot — matches the
//     existing UI badge in CreativeStudio.tsx which treats vi-VN as
//     already-native and only shows the rewrite button for other locales)
//   - a localization already exists for this (productId, locale) pair
//   - the product is missing from bankStore (rare race condition)
//   - the Gemini API key is missing (warned, generation continues)

const REWRITE_TARGET_LOCALES: ReadonlySet<UINativeLocale> = new Set(['my-MY', 'id-ID', 'global'])

async function ensureNativeLocalization(jobId: string, args: RunGenerationArgs): Promise<void> {
  const productId = args.inputs.productId
  if (!productId) return

  const opts = args.inputs.options as Record<string, unknown> | undefined
  const rawLocale = opts?.['locale']
  if (typeof rawLocale !== 'string') return
  const locale = rawLocale as UINativeLocale
  if (!REWRITE_TARGET_LOCALES.has(locale)) return

  if (readLocalization(productId, locale)) return

  const apiKey = useSettingsStore.getState().geminiApiKey
  if (!apiKey) {
    console.warn('[runGeneration] P44 cannot auto native-rewrite — Gemini API key missing; falling back to source fields', { jobId, productId, locale })
    return
  }

  const product = useBankStore.getState().getProductById(productId)
  if (!product) {
    console.warn('[runGeneration] P44 cannot auto native-rewrite — product not in bankStore', { jobId, productId })
    return
  }

  console.info('[runGeneration] P44 auto native-rewrite triggered', { jobId, productId, locale })
  try {
    const { ok, fields, attempts } = await nativeRewriteProduct(apiKey, { product, targetLocale: locale })
    writeLocalization(productId, locale, fields)
    console.info('[runGeneration] P44 auto native-rewrite OK', { jobId, productId, locale, ok, attempts })
  } catch (err) {
    console.warn('[runGeneration] P44 auto native-rewrite failed; continuing with source fields', { jobId, productId, locale, err })
  }
}

function friendlyError(raw: string): string {
  const low = raw.toLowerCase()
  if (low.includes('api key')) return 'Thiếu API key — vào Cài đặt để thêm'
  if (low.includes('credit') || low.includes('insufficient')) return 'Hết KIE credit — nạp thêm rồi thử lại'
  if (low.includes('network') || low.includes('fetch') || low.includes('timeout')) return 'Lỗi mạng — thử lại sau'
  return 'Tạo asset chưa thành công — bấm "Tạo lại"'
}
