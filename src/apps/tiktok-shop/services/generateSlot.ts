// generateSlot — end-to-end image generation for ONE listing slot.
// Flow:
//   1. Resolve reference image assetIds → public signed URLs (kie.ai needs URLs)
//   2. Build slot-specific prompt (prompts/promptBuilder.ts)
//   3. POST to kie.ai gpt-image-2 with reference images
//   4. Poll until done (kieai.ts pollImageUntilDone)
//   5. Download from kie URL → save to our Supabase Storage as asset
//   6. Return the new assetId for ListingImage.imageAssetId
//
// Errors are bubbled up — the calling component decides whether to retry,
// show toast, mark slot failed, etc.

import {
  generateImage,
  pollImageUntilDone,
  type ImageStatus,
} from '../../../utils/kieai'
import { getUrl, saveFromBlobUrl } from '../../../utils/assetStore'
import type { ResolvedBrandKit, Market } from '../../../types/brandKit'
import type { Product } from '../../../stores/types'
import type { SlotConfig, PaletteFamily } from '../types'
import { buildPromptForSlot } from './promptBuilder'

export interface GenerateSlotParams {
  apiKey: string
  brandKit: ResolvedBrandKit
  product: Product
  slotConfig: SlotConfig
  paletteFamily: PaletteFamily
  language: Market
  referenceImageAssetIds: string[]
  onStatus?: (status: ImageStatus) => void
  signal?: AbortSignal
}

export interface GenerateSlotResult {
  assetId: string
  prompt: string         // saved on ListingImage for re-roll diagnostics
}

const KIE_MODEL = 'gpt-image-2-text-to-image'
const TIMEOUT_MS = 5 * 60 * 1000

export async function generateSlotImage(params: GenerateSlotParams): Promise<GenerateSlotResult> {
  // 1. Resolve ref assetIds → signed URLs
  const refUrls = await resolveReferenceUrls(params.referenceImageAssetIds)
  if (refUrls.length === 0) {
    throw new Error('Cần ít nhất 1 ảnh tham chiếu hợp lệ để generate')
  }

  // 2. Build prompt
  const prompt = buildPromptForSlot({
    brandKit: params.brandKit,
    product: params.product,
    slotConfig: params.slotConfig,
    paletteFamily: params.paletteFamily,
    language: params.language,
  })

  // Lightweight prompt-language sanity log (memory rule: avoid mixed-language drift).
  // Doesn't block — just surfaces in F12 if the prompt accidentally leaks the wrong tongue.
  if (typeof console !== 'undefined') {
    console.log(`[tiktok-shop] slot=${params.slotConfig.slot} lang=${params.language} promptLen=${prompt.length} refs=${refUrls.length}`)
  }

  // 3. Submit to kie.ai
  const resolution = params.slotConfig.highRes ? '2K' : '1K'
  const { taskId } = await generateImage({
    apiKey: params.apiKey,
    model: KIE_MODEL,
    prompt,
    resolution,
    aspectRatio: '1:1',
    referenceImageUrls: refUrls,
  })

  // 4. Poll until done
  const kieImageUrl = await pollImageUntilDone({
    apiKey: params.apiKey,
    taskId,
    onStatusChange: params.onStatus,
    timeoutMs: TIMEOUT_MS,
  })

  // 5. Copy from kie's CDN → our Supabase Storage so the URL doesn't expire
  //    + our user owns the asset
  const assetId = await saveFromBlobUrl(kieImageUrl)

  return { assetId, prompt }
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function resolveReferenceUrls(assetIds: string[]): Promise<string[]> {
  const urls: string[] = []
  // gpt-image-2 accepts up to 5 reference images
  for (const id of assetIds.slice(0, 5)) {
    try {
      const url = await getUrl(id)
      if (url) urls.push(url)
    } catch {
      // Silent skip — the prompt will still work with fewer refs, just less product fidelity
    }
  }
  return urls
}

// Common error classifier — UI can show a friendly message + suggest action.
export type GenerateErrorKind =
  | 'insufficient-credits'
  | 'content-policy'
  | 'timeout'
  | 'cancelled'
  | 'no-references'
  | 'network'
  | 'unknown'

export function classifyGenerateError(err: unknown): GenerateErrorKind {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg === 'INSUFFICIENT_CREDITS' || msg.includes('INSUFFICIENT_CREDITS')) return 'insufficient-credits'
  if (msg.includes('content_policy') || msg.toLowerCase().includes('policy')) return 'content-policy'
  if (msg.includes('TIMEOUT')) return 'timeout'
  if (msg.includes('CANCELLED')) return 'cancelled'
  if (msg.includes('tham chiếu')) return 'no-references'
  if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) return 'network'
  return 'unknown'
}

export function friendlyErrorMessage(err: unknown): string {
  const kind = classifyGenerateError(err)
  switch (kind) {
    case 'insufficient-credits': return 'Hết credit kie.ai — nạp thêm để tiếp tục.'
    case 'content-policy':       return 'kie.ai từ chối prompt vì policy. Thử ảnh tham chiếu khác hoặc đổi sản phẩm.'
    case 'timeout':              return 'kie.ai quá lâu chưa xong. Hãy thử lại — task có thể đang stuck queue.'
    case 'cancelled':            return 'Đã huỷ.'
    case 'no-references':        return 'Cần ít nhất 2 ảnh tham chiếu hợp lệ.'
    case 'network':              return 'Lỗi mạng — kiểm tra kết nối + thử lại.'
    default:                     return err instanceof Error ? err.message : String(err)
  }
}
