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
import { TPCN_PALETTES, getComboLabel } from '../constants'

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
    ? 'Reference 1 = brand logo (render EXACTLY as shown — preserve shape, colors, no redraw). References 2+ = product photos.'
    : 'All references are product photos.'

  // Count enforcement. productCount is the authoritative source (user input);
  // fall back to parsing the description ("2 jars" → 2), then to 1.
  const count = c.productCount ?? extractCountFromDescription(c.description) ?? 1
  const countInstruction = count > 1
    ? `Show EXACTLY ${count} bottle(s)/jar(s) of the product clearly visible, arranged side-by-side in a clean row. Each bottle must match the reference photos exactly (same color, shape, label).`
    : `Show exactly 1 bottle/jar of the product centered, matching the reference photos.`

  // Count label — top-center pill, universal label table by count + market.
  // HOT merges INTO the pill (red bg + 🔥 prefix) per user spec — no separate HOT badge.
  const countLabel = getComboLabel(count, params.language)
  const labelPillSpec = c.isHot
    ? `LABEL PILL (HOT variant): rounded pill ~420px wide × 60px tall, rounded corners 30px, background SOLID RED (#DC2626), centered at top y≈260-320 (just below brand seal). Text "🔥 ${countLabel}" in WHITE Plus Jakarta Sans ExtraBold ~44px. Subtle drop shadow.`
    : `LABEL PILL: rounded pill ~420px wide × 60px tall, rounded corners 30px, background accent color ${p.cta}, centered at top y≈260-320 (just below brand seal). Text "${countLabel}" in WHITE Plus Jakarta Sans ExtraBold ~44px. Subtle drop shadow.`

  // Price block sits on the RIGHT half, BELOW the count label pill.
  const priceBlock = c.originalPrice
    ? `- RIGHT half (y≈360), struck-through original price "${c.originalPrice}" (~32px light tint)\n- DIRECTLY BELOW (y≈410, still RIGHT half), GIANT current price "${c.price}" (~140px ExtraBold white with strong shadow)${c.discount ? `\n- AMBER PILL BADGE next to/below current price (~36px dark bold): "${c.discount}"` : ''}`
    : `- RIGHT half (y≈380), GIANT price "${c.price}" (~140px ExtraBold white with strong shadow).`

  return `1:1 square TikTok Shop VARIANT THUMBNAIL (1024×1024). ${productRefHint}

PRODUCT FIDELITY (CRITICAL):
- Render ONLY the inner product container (bottle, jar, tube, or primary container — the actual product item).
- DO NOT include the outer cardboard packaging box/carton, even if the reference photos show it.
- Each bottle must replicate refs EXACTLY: same color, shape, label, brand name. Do NOT redesign.
- ${countInstruction}

═══ BRAND SEAL — IDENTICAL spec to the main 9 listing slots (no white banner, integrated) ═══
- LAYER 1 — LOGO: Render Reference 1 (brand logo) LARGE and CENTERED at the top. Logo size ~280px wide × 120px tall, at y≈40-160. NO white box, NO banner — logo sits directly on the brand-color gradient. Preserve logo EXACTLY from Reference 1.
- LAYER 2 — SUBTITLE: Below logo at y≈170-205, render "Official store | ${marketBadge}" in WHITE Plus Jakarta Sans Medium Italic ~28px. Center-aligned.
- LAYER 3 — UNDERLINE: Thin horizontal white line ~140px wide at 50% opacity centered at y≈215.
- DO NOT render the brand kit's store name as separate text — the logo carries it.

═══ COUNT LABEL PILL — top-center, just below brand seal ═══
${labelPillSpec}

LAYOUT (all combo content sits BELOW the brand seal + label pill, y≥360):
- Saturated brand-color gradient background (${p.primary} → ${p.secondary}) with subtle decorative particles
- Product zone: LEFT half + center (y≈400-870), ${count} bottle(s) side-by-side standing upright on a subtle podium/surface

PRICE OVERLAY (must appear, dominant — on the RIGHT half, parallel to product zone):
${priceBlock}

VARIANT LABEL: At bottom-center (y≈920), white rounded rect with name "${c.name}" inside (~28px medium dark navy bold).

STYLE: Same premium e-commerce aesthetic as the main 9 listing slots. Plus Jakarta Sans ExtraBold for prices. Saturated brand palette. Clean focus on product + price.

LANGUAGE: ${langName} ONLY in any rendered text (except "Official store" subtitle and count label which use their universal forms). NO other languages.

NO trust bar, NO cert badges, NO clutter, NO outer packaging box.`
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
