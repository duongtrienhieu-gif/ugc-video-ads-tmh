// generateSlot — end-to-end image generation for ONE listing slot.
// Phase 6 pivot: uses Nano Banana 2 (Gemini 3.1 Flash Image) for stronger
// product reference preservation per [[feedback-product-fidelity-mandate]].
//
// Flow:
//   1. Resolve reference image assetIds → public signed URLs (kie.ai needs URLs)
//   2. Build slot-specific prompt with EMBEDDED text + brand identity
//   3. POST to kie.ai nano-banana-2 with image_input refs
//   4. Poll until done (reuses gpt-image-2 polling — same /jobs/recordInfo shape)
//   5. Download from kie URL → save to our Supabase Storage as asset
//   6. Return the new assetId for ListingImage.imageAssetId

import {
  generateNanoBanana2,
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

const TIMEOUT_MS = 5 * 60 * 1000

export async function generateSlotImage(params: GenerateSlotParams): Promise<GenerateSlotResult> {
  // 1. Resolve ref assetIds → signed URLs
  const refUrls = await resolveReferenceUrls(params.referenceImageAssetIds)
  if (refUrls.length === 0) {
    throw new Error('Cần ít nhất 1 ảnh tham chiếu hợp lệ để generate')
  }

  // 2. Build prompt with embedded text + brand
  const prompt = buildPromptForSlot({
    brandKit: params.brandKit,
    product: params.product,
    slotConfig: params.slotConfig,
    paletteFamily: params.paletteFamily,
    language: params.language,
  })

  if (typeof console !== 'undefined') {
    console.log(`[tiktok-shop] slot=${params.slotConfig.slot} lang=${params.language} model=nano-banana-2 promptLen=${prompt.length} refs=${refUrls.length}`)
  }

  // 3. Submit + poll Nano Banana 2 (Gemini 3.1 Flash Image)
  const resolution = params.slotConfig.highRes ? '2K' : '1K'
  const kieImageUrl = await generateNanoBanana2({
    apiKey: params.apiKey,
    prompt,
    imageInput: refUrls,
    aspectRatio: '1:1',
    resolution,
    outputFormat: 'jpeg',
    onStatusChange: params.onStatus,
    timeoutMs: TIMEOUT_MS,
    signal: params.signal,
  })

  // 4. Copy from kie's CDN → our Supabase Storage so the URL doesn't expire
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
