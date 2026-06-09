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
import type { ComboOption, PaletteFamily, TiktokShopProductBrief } from '../types'
import { TPCN_PALETTES, getComboLabel } from '../constants'

export interface GenerateComboParams {
  apiKey: string
  brandKit: ResolvedBrandKit
  combo: ComboOption
  paletteFamily: PaletteFamily
  language: Market
  /** Same product photo refs the main slots use — for product fidelity. */
  referenceImageAssetIds: string[]
  /** Phase 10 — Vision brief for identity consistency with the main 9 slots. */
  brief?: TiktokShopProductBrief
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

  // Inline brief context — same identity lock as the main 9 slots
  const briefBlock = params.brief ? `\nPRODUCT BRIEF (Vision-extracted, identity lock — same as main 9 slots):
- Name (exact): "${params.brief.productNameExact}"
- Subtype: ${params.brief.productSubtype}
- Packaging: ${params.brief.packagingDescription}
- Primary colors: ${params.brief.primaryColors.join(', ')}
` : ''

  // Count enforcement. productCount is the authoritative source (user input);
  // fall back to parsing the description ("2 jars" → 2), then to 1.
  const count = c.productCount ?? extractCountFromDescription(c.description) ?? 1
  const countInstruction = count > 1
    ? `Show EXACTLY ${count} bottle(s)/jar(s) of the product clearly visible, arranged side-by-side in a clean row. Each bottle must match the reference photos exactly (same color, shape, label).`
    : `Show exactly 1 bottle/jar of the product centered, matching the reference photos.`

  // Count label — top-center pill, universal label table by count + market.
  // Sits on the BRAND GRADIENT (bottom zone), just below the white brand-seal zone.
  // HOT merges INTO the pill (red bg + 🔥 prefix) per user spec — no separate HOT badge.
  const countLabel = getComboLabel(count, params.language)
  const labelPillSpec = c.isHot
    ? `LABEL PILL (HOT variant): rounded pill ~420px wide × 60px tall, rounded corners 30px, background SOLID RED (#DC2626), centered at y≈220-280 (just inside the brand gradient bottom zone). Text "🔥 ${countLabel}" in WHITE Plus Jakarta Sans ExtraBold ~44px. Subtle drop shadow.`
    : `LABEL PILL: rounded pill ~420px wide × 60px tall, rounded corners 30px, background accent color ${p.cta}, centered at y≈220-280. Text "${countLabel}" in WHITE Plus Jakarta Sans ExtraBold ~44px. Subtle drop shadow.`

  return `1:1 square TikTok Shop VARIANT THUMBNAIL (1024×1024). ${productRefHint}

PRODUCT FIDELITY (CRITICAL):
- Render ONLY the inner product container (bottle, jar, tube, or primary container — the actual product item).
- DO NOT include the outer cardboard packaging box/carton, even if the reference photos show it.
- Each bottle must replicate refs EXACTLY: same color, shape, label, brand name. Do NOT redesign.
- ${countInstruction}${briefBlock}

=== BACKGROUND — full canvas brand gradient ===
- The ENTIRE canvas is filled with saturated brand-color gradient (${p.primary} → ${p.secondary}) with subtle decorative particles. Unified backdrop.

=== BRAND SEAL — TOP-RIGHT CORNER BADGE (slightly larger for clean logo render), IDENTICAL to the main 9 slots ===
- Render a WHITE (#FFFFFF) rounded rectangle badge in the TOP-RIGHT corner.
- Dimensions: ~320px wide × 100px tall (3.2:1 aspect), rounded corners 18px, subtle drop shadow.
- Position: top-right corner with 20px margin (x=684-1004, y=20-120). NOT centered.
- CONTENTS — HORIZONTAL ROW (single row, vertically centered at y≈70):
  - LEFT: Reference 1 logo ~80×80px at x≈700. Preserve ORIGINAL colors AND DETAILS EXACTLY — render every logo element (brand mark, decorations, subscript) crisply, do NOT simplify.
  - MIDDLE: thin "|" separator (dark navy 40% opacity, ~40px tall) at x≈800.
  - RIGHT: "Official | ${marketBadge}" in DARK NAVY Plus Jakarta Sans Medium ~16px at x≈820-990.
- DO NOT enlarge past ~320px wide.
- DO NOT center — must hug top-right corner.
- DO NOT simplify or partially render the logo.
- DO NOT render store name as additional text.

=== COUNT LABEL PILL — top-center, inside the brand gradient bottom zone ===
${labelPillSpec}

LAYOUT (combo product fills the brand gradient bottom zone, y≥300):
- Product zone: FULL WIDTH centered (y≈360-870), ${count} bottle(s) side-by-side standing upright on a subtle podium/surface. Hero focus on the product — no price overlays, no number callouts.

VARIANT LABEL: At bottom-center (y≈920), white rounded rect with name "${c.name}" inside (~28px medium dark navy bold).

STYLE: Same premium e-commerce aesthetic as the main 9 listing slots. Plus Jakarta Sans ExtraBold for the variant label. Saturated brand palette. Clean focus on the product itself.

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
