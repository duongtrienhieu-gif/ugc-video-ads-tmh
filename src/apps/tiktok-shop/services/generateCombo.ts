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

  // 4. Download AI image and save directly. Brand frame is rendered by AI
  //    per the deterministic spec inside buildComboPrompt (same as main slots).
  const aiResp = await fetch(kieImageUrl)
  if (!aiResp.ok) throw new Error(`Tải ảnh combo thất bại (HTTP ${aiResp.status})`)
  const aiBlob = await aiResp.blob()
  const assetId = await saveAsset(aiBlob, 'image/jpeg')
  return { assetId, prompt }
}

// ── Prompt builder ───────────────────────────────────────────────────────

function buildComboPrompt(params: GenerateComboParams, hasLogoRef: boolean): string {
  const p = TPCN_PALETTES[params.paletteFamily]
  const c = params.combo
  const langName = params.language === 'ms' ? 'Bahasa Malaysia' : 'Vietnamese'
  const marketBadge = params.language === 'ms' ? '🇲🇾 MY' : '🇻🇳 VN'
  const productRefHint = hasLogoRef
    ? 'Reference 1 = brand logo (preserve EXACTLY inside the BRAND FRAME). References 2+ = product photos.'
    : 'All references are product photos. (No logo ref — render store name as text only in the frame.)'
  const logoSlot = hasLogoRef
    ? 'LEFT (16px padding): brand logo from Reference 1, ~64px tall, vertically centered'
    : 'LEFT (16px padding): small brand mark icon ~48px (no logo ref provided)'

  // Count enforcement. productCount is the authoritative source (user input);
  // fall back to parsing the description ("2 jars" → 2), then to 1.
  const count = c.productCount ?? extractCountFromDescription(c.description) ?? 1
  const countInstruction = count > 1
    ? `Show EXACTLY ${count} instances of the product clearly visible, arranged side-by-side or in a small cluster (NOT just 1). Each instance must match the reference photos.`
    : `Show exactly 1 instance of the product centered, matching the reference photos.`

  const effectiveDescription = c.description.trim()
    || (count > 1 ? `${count} units of the product` : '1 unit of the product')

  // Price block sits BELOW the brand frame on the RIGHT side (NOT top-right —
  // that area is now occupied by the centered brand frame).
  const priceBlock = c.originalPrice
    ? `- BELOW BRAND FRAME, RIGHT half (y≈160), struck-through original price "${c.originalPrice}" (~32px light tint)\n- DIRECTLY BELOW the strike-through (y≈210, still RIGHT half), GIANT current price "${c.price}" (~140px ExtraBold white with strong shadow)${c.discount ? `\n- AMBER PILL BADGE next to/below current price (~36px dark bold): "${c.discount}"` : ''}`
    : `- BELOW BRAND FRAME, RIGHT half (y≈180), GIANT price "${c.price}" (~140px ExtraBold white with strong shadow).`

  const hotBadge = c.isHot
    ? '\nHOT BADGE: small red rounded-corner badge floating in upper-left content area (y≈140, NOT inside the brand frame) with text "🔥 HOT" (~24px white bold).'
    : ''

  return `1:1 square TikTok Shop VARIANT THUMBNAIL (1024×1024). ${productRefHint}

PRODUCT FIDELITY: Replicate EXACTLY from product refs — same color, shape, label, brand name. Do NOT redesign.

VARIANT CONTENT: ${effectiveDescription}
PRODUCT COUNT: ${countInstruction}

═══ BRAND FRAME — IDENTICAL spec to the main 9 listing slots (master seal) ═══
- Position: TOP CENTER, horizontally centered on canvas
- Dimensions: ~720px wide × 90px tall, rounded corners 20px
- Background INSIDE: clean WHITE (#FFFFFF) with subtle drop shadow
- Three elements left → center → right INSIDE the frame:
  • ${logoSlot}
  • CENTER: store name "${params.brandKit.storeName}" in dark navy (#0E2A47) Plus Jakarta Sans ExtraBold ~32px
  • RIGHT (16px padding): rounded pill "${marketBadge}" in accent color with white bold text (~28px height)
- Same exact size/shape/colors as the main 9 slots — unified brand identity.

LAYOUT (all combo content sits BELOW the brand frame, y≥140):
- Product configuration centered horizontally on canvas, occupying ~55% of total area (y≈380-820)
- Saturated brand-color gradient background (${p.primary} → ${p.secondary}) with subtle decorative particles${hotBadge}

PRICE OVERLAY (must appear, dominant):
${priceBlock}

VARIANT LABEL: At bottom-center (y≈900), white rounded rect with name "${c.name}" inside (~28px medium dark navy bold).

STYLE: Same premium e-commerce aesthetic as the main 9 listing slots. Plus Jakarta Sans ExtraBold for prices. Saturated brand palette. Clean focus on product + price.

LANGUAGE: ${langName} ONLY in any rendered text. NO other languages.

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
