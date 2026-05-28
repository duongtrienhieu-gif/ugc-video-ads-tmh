// Combo thumbnail generator — produces ONE variant image (1024×1024) per
// ComboOption. Used by TikTok Shop's option picker (each variant shows a
// small thumbnail). Independent from the 9-slot main listing.
//
// Same kie.ai endpoint (gpt-4o-image, 6 credits @ 1K) and ref pattern as
// the main slot generator — the brand kit logo is prepended to filesUrl so
// combos stay visually consistent with the main 9 images.

import {
  generateGpt4oImage,
  type ImageStatus,
} from '../../../utils/kieai'
import { getUrl, saveAsset } from '../../../utils/assetStore'
import type { ResolvedBrandKit, Market } from '../../../types/brandKit'
import type { ComboOption, PaletteFamily } from '../types'
import { TPCN_PALETTES } from '../constants'
import { composeHeaderOverlay } from './composeHeaderOverlay'

export interface GenerateComboParams {
  apiKey: string
  brandKit: ResolvedBrandKit
  combo: ComboOption
  paletteFamily: PaletteFamily
  language: Market
  /** Same product photo refs the main slots use — for product fidelity. */
  referenceImageAssetIds: string[]
  onStatus?: (status: ImageStatus) => void
  signal?: AbortSignal
}

export interface GenerateComboResult {
  assetId: string
  prompt: string
}

const TIMEOUT_MS = 5 * 60 * 1000

export async function generateComboImage(params: GenerateComboParams): Promise<GenerateComboResult> {
  // 1. Resolve refs (logo first, then product photos — same pattern as main slots)
  const logoUrl = params.brandKit.logo?.blobUrl?.trim() || null
  const hasLogoRef = !!logoUrl
  const productRefUrls = await resolveReferenceUrls(
    params.referenceImageAssetIds,
    hasLogoRef ? 4 : 5,
  )
  if (productRefUrls.length === 0) {
    throw new Error('Cần ít nhất 1 ảnh tham chiếu sản phẩm hợp lệ để generate combo')
  }
  const refUrls = hasLogoRef ? [logoUrl, ...productRefUrls] : productRefUrls

  // 2. Build prompt
  const prompt = buildComboPrompt(params, hasLogoRef)

  if (typeof console !== 'undefined') {
    console.log(`[tiktok-shop:combo] id=${params.combo.id.slice(0, 8)} name="${params.combo.name}" promptLen=${prompt.length} refs=${refUrls.length}`)
  }

  // 3. Submit + poll
  const kieImageUrl = await generateGpt4oImage({
    apiKey: params.apiKey,
    prompt,
    filesUrl: refUrls,
    size: '1:1',
    onStatusChange: params.onStatus,
    timeoutMs: TIMEOUT_MS,
    signal: params.signal,
  })

  // 4. Composite brand header overlay — same deterministic strip as the
  //    main 9 slots so combo thumbnails match the listing's brand identity
  //    exactly.
  const composedBlob = await composeHeaderOverlay({
    aiImageUrl: kieImageUrl,
    brandKit: params.brandKit,
    paletteFamily: params.paletteFamily,
  })

  // 5. Save composited image
  const assetId = await saveAsset(composedBlob, 'image/jpeg')
  return { assetId, prompt }
}

// ── Prompt builder ───────────────────────────────────────────────────────

function buildComboPrompt(params: GenerateComboParams, hasLogoRef: boolean): string {
  const p = TPCN_PALETTES[params.paletteFamily]
  const c = params.combo
  const langName = params.language === 'ms' ? 'Bahasa Malaysia' : 'Vietnamese'
  const productRefHint = hasLogoRef
    ? 'Reference 1 = brand logo (preserve exactly). References 2+ = product photos.'
    : 'All references are product photos.'

  // Count enforcement. productCount is the authoritative source (user input);
  // fall back to parsing the description ("2 jars" → 2), then to 1.
  const count = c.productCount ?? extractCountFromDescription(c.description) ?? 1
  const countInstruction = count > 1
    ? `Show EXACTLY ${count} instances of the product clearly visible, arranged side-by-side or in a small cluster (NOT just 1). Each instance must match the reference photos.`
    : `Show exactly 1 instance of the product centered, matching the reference photos.`

  // Description is optional now (Phase 9 fix). Default from count so the
  // prompt always has something concrete to render.
  const effectiveDescription = c.description.trim()
    || (count > 1 ? `${count} units of the product` : '1 unit of the product')

  // Build the price block instruction dynamically based on what fields exist
  const priceBlock = c.originalPrice
    ? `Top-right corner: struck-through original price "${c.originalPrice}" (~32px light tint), below it GIANT current price "${c.price}" (~120px ExtraBold white with shadow)${c.discount ? `, plus an AMBER PILL BADGE "${c.discount}" (~36px dark bold) right below the price.` : '.'}`
    : `Top-right corner: GIANT price "${c.price}" (~120px ExtraBold white with shadow).`

  const hotBadge = c.isHot
    ? '\nHOT BADGE: small red rounded-corner badge in top-left next to logo with text "🔥 HOT" (~24px white bold).'
    : ''

  return `1:1 square TikTok Shop VARIANT THUMBNAIL (1024×1024). ${productRefHint}

PRODUCT: Replicate EXACTLY from refs — same color, shape, label, brand name. Do NOT redesign.

VARIANT CONTENT: ${effectiveDescription}
PRODUCT COUNT: ${countInstruction}

LAYOUT:
- Product configuration centered, occupying ~60% of canvas area
- Soft brand-color gradient background (${p.primary} → ${p.secondary}) with subtle decorative particles
- BRAND LOGO + store name "${params.brandKit.storeName}" small top-left (~7% canvas height)${hotBadge}

PRICE OVERLAY (must appear, dominant):
${priceBlock}

VARIANT LABEL: At bottom-center, white rounded rect with name "${c.name}" inside (~28px medium dark navy bold).

STYLE: Same premium e-commerce aesthetic as the main 9 listing slots. Plus Jakarta Sans ExtraBold for prices. Saturated brand palette. Clean focus on product + price.

LANGUAGE: ${langName} ONLY in any text. NO other languages.

NO trust bar, NO cert badges, NO clutter.`
}

// Try to extract a leading number from a description string like
// "2 product unit", "3 jars", "5 items" → 2, 3, 5. Returns null otherwise.
function extractCountFromDescription(desc: string): number | null {
  const match = desc.trim().match(/^(\d+)/)
  if (!match) return null
  const n = parseInt(match[1], 10)
  if (Number.isNaN(n) || n < 1 || n > 20) return null
  return n
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function resolveReferenceUrls(assetIds: string[], maxRefs = 5): Promise<string[]> {
  const urls: string[] = []
  for (const id of assetIds.slice(0, maxRefs)) {
    try {
      const url = await getUrl(id)
      if (url) urls.push(url)
    } catch { /* silent skip */ }
  }
  return urls
}
