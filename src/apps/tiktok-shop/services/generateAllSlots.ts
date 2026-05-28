// Parallel orchestrator that generates ALL AI-gen slots for one listing.
// Uses a simple promise pool (max 3 concurrent) to avoid hammering kie.ai
// while still being meaningfully faster than sequential.
//
// Per-slot failures are isolated — one slot's content_policy reject does NOT
// abort the other 8. Caller decides whether to retry failed slots.

import type { ResolvedBrandKit, Market } from '../../../types/brandKit'
import type { Product } from '../../../stores/types'
import type { SlotConfig, PaletteFamily, SlotNumber, SlotTexts, TiktokShopProductBrief } from '../types'
import { SLOT_MAP } from '../constants'
import { generateSlotImage, friendlyErrorMessage } from './generateSlot'

const MAX_CONCURRENT = 3

export interface OrchestratorCallbacks {
  /** Fires when a slot starts generating (move card to 'generating' state) */
  onSlotStart?: (slot: SlotNumber) => void
  /** Fires on success — caller stores the asset and marks slot 'completed' */
  onSlotSuccess?: (slot: SlotNumber, assetId: string, prompt: string) => void
  /** Fires on failure — caller marks slot 'failed' + shows error */
  onSlotError?: (slot: SlotNumber, friendlyError: string) => void
  /** Fires after every slot resolves (success OR fail) — for progress bar */
  onSlotSettled?: (slot: SlotNumber, status: 'success' | 'fail') => void
}

export interface OrchestrateParams {
  apiKey: string
  brandKit: ResolvedBrandKit
  product: Product
  paletteFamily: PaletteFamily
  language: Market
  referenceImageAssetIds: string[]
  /** AI-generated per-slot text — forwarded to every slot generator so all
   *  9 images use the same product-specific copy. */
  slotTexts?: SlotTexts
  /** Phase 10 — Vision-extracted brief, forwarded to every slot for identity
   *  consistency across the 9-image set. */
  brief?: TiktokShopProductBrief
  callbacks?: OrchestratorCallbacks
  signal?: AbortSignal
}

export interface OrchestrateResult {
  successCount: number
  failCount: number
  skippedCanvasOnly: number
}

export async function generateAllSlots(params: OrchestrateParams): Promise<OrchestrateResult> {
  // Only the AI-gen slots — canvas-only (5, 9) need no API call.
  const aiSlots = SLOT_MAP.filter((s) => s.visualMode === 'ai-gen')
  const skippedCanvasOnly = SLOT_MAP.length - aiSlots.length

  let successCount = 0
  let failCount = 0

  // Build the task list. Each task is an async function the pool will await.
  const tasks: Array<() => Promise<void>> = aiSlots.map((slotConfig) => async () => {
    if (params.signal?.aborted) {
      params.callbacks?.onSlotError?.(slotConfig.slot, 'Đã huỷ')
      params.callbacks?.onSlotSettled?.(slotConfig.slot, 'fail')
      failCount++
      return
    }
    params.callbacks?.onSlotStart?.(slotConfig.slot)
    try {
      const { assetId, prompt } = await generateSlotImage({
        apiKey: params.apiKey,
        brandKit: params.brandKit,
        product: params.product,
        slotConfig,
        paletteFamily: params.paletteFamily,
        language: params.language,
        referenceImageAssetIds: params.referenceImageAssetIds,
        slotTexts: params.slotTexts,
        brief: params.brief,
        signal: params.signal,
      })
      params.callbacks?.onSlotSuccess?.(slotConfig.slot, assetId, prompt)
      params.callbacks?.onSlotSettled?.(slotConfig.slot, 'success')
      successCount++
    } catch (err) {
      const msg = friendlyErrorMessage(err)
      params.callbacks?.onSlotError?.(slotConfig.slot, msg)
      params.callbacks?.onSlotSettled?.(slotConfig.slot, 'fail')
      failCount++
    }
  })

  await runPool(tasks, MAX_CONCURRENT)

  return { successCount, failCount, skippedCanvasOnly }
}

// Run an array of async tasks with a concurrency limit. Resolves when all done.
async function runPool(tasks: Array<() => Promise<void>>, limit: number): Promise<void> {
  let index = 0
  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const my = index++
      try {
        await tasks[my]()
      } catch {
        // Tasks already self-handle errors via callbacks — pool just keeps going
      }
    }
  }
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker())
  await Promise.all(workers)
}

// Re-generate a single slot — convenience wrapper used by the per-slot
// re-roll button. Returns whether it succeeded.
export interface RegenSingleSlotParams {
  apiKey: string
  brandKit: ResolvedBrandKit
  product: Product
  slotConfig: SlotConfig
  paletteFamily: PaletteFamily
  language: Market
  referenceImageAssetIds: string[]
  slotTexts?: SlotTexts
  brief?: TiktokShopProductBrief
}

export async function regenerateSingleSlot(
  params: RegenSingleSlotParams,
): Promise<{ success: boolean; assetId?: string; prompt?: string; error?: string }> {
  if (params.slotConfig.visualMode === 'canvas-only') {
    return { success: false, error: 'Slot này là canvas-only, không cần re-gen AI' }
  }
  try {
    const { assetId, prompt } = await generateSlotImage({
      apiKey: params.apiKey,
      brandKit: params.brandKit,
      product: params.product,
      slotConfig: params.slotConfig,
      paletteFamily: params.paletteFamily,
      language: params.language,
      referenceImageAssetIds: params.referenceImageAssetIds,
      slotTexts: params.slotTexts,
      brief: params.brief,
    })
    return { success: true, assetId, prompt }
  } catch (err) {
    return { success: false, error: friendlyErrorMessage(err) }
  }
}
