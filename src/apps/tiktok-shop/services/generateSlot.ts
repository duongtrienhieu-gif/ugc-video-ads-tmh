// generateSlot — end-to-end image generation for ONE listing slot.
// Phase 6 final: uses GPT-4o image edit (/gpt4o-image/generate with filesUrl)
// for TRUE image-to-image preservation per [[feedback-product-fidelity-mandate]].
//
// Same cost as gpt-image-2 (6 credits @ 1K) but actually honors the reference
// images — gpt-image-2 silently ignores image_urls (text-to-image only).
// Battle-tested in Super Ladipage's kieGptImage1.ts provider.
//
// Flow:
//   1. Resolve reference image assetIds → public signed URLs
//   2. Build slot-specific prompt with EMBEDDED text + brand identity
//   3. POST to kie.ai /gpt4o-image/generate with filesUrl
//   4. Poll until done (pollGpt4oUntilDone — same retry/timeout pattern)
//   5. Download from kie CDN → save to our Supabase Storage as asset
//   6. Return the new assetId for ListingImage.imageAssetId

import {
  generateGpt4oImage,
  type ImageStatus,
  type Gpt4oSize,
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
  // 1. Resolve ref assetIds → signed URLs.
  //    Prepend the brand kit logo URL as the FIRST ref so AI can place it
  //    consistently across all 9 slots (true brand presence, not just text).
  //    Cap product refs at 4 to leave room for logo (gpt-4o-image max 5 refs).
  const logoUrl = params.brandKit.logo?.blobUrl?.trim() || null
  const hasLogoRef = !!logoUrl
  const productRefUrls = await resolveReferenceUrls(
    params.referenceImageAssetIds,
    hasLogoRef ? 4 : 5,
  )
  if (productRefUrls.length === 0) {
    throw new Error('Cần ít nhất 1 ảnh tham chiếu sản phẩm hợp lệ để generate')
  }
  const refUrls = hasLogoRef ? [logoUrl, ...productRefUrls] : productRefUrls

  // 2. Build prompt with embedded text + brand
  const prompt = buildPromptForSlot({
    brandKit: params.brandKit,
    product: params.product,
    slotConfig: params.slotConfig,
    paletteFamily: params.paletteFamily,
    language: params.language,
    hasLogoRef,
  })

  if (typeof console !== 'undefined') {
    console.log(`[tiktok-shop] slot=${params.slotConfig.slot} lang=${params.language} model=gpt-4o-image promptLen=${prompt.length} refs=${refUrls.length} (logo=${hasLogoRef})`)
  }

  // 3. Submit + poll GPT-4o image edit (TRUE i2i — refs are HONORED via filesUrl)
  // size accepts '1:1' | '3:2' | '2:3' — TikTok Shop always 1:1
  const size: Gpt4oSize = '1:1'
  const kieImageUrl = await generateGpt4oImage({
    apiKey: params.apiKey,
    prompt,
    filesUrl: refUrls,
    size,
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

async function resolveReferenceUrls(assetIds: string[], maxRefs = 5): Promise<string[]> {
  const urls: string[] = []
  // gpt-4o-image accepts up to 5 total refs (filesUrl)
  for (const id of assetIds.slice(0, maxRefs)) {
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
