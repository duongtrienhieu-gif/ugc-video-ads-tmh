// Phase 9 — Deterministic brand header overlay.
//
// Why exists: AI image gen (gpt-4o-image) renders the brand header
// (logo + store name + flag) DIFFERENTLY in every slot — different
// background frame, different flag chip style, different padding. Users
// see inconsistency across the 9 listing images. AI variance is inherent
// per-call and can't be eliminated via prompt alone.
//
// Fix: prompt the AI to LEAVE TOP 80px BLANK, then composite a fixed
// header strip (same design every time) onto that zone client-side via
// Canvas 2D. 100% identical header across all 9 main slots + all combo
// thumbnails. No extra credit.
//
// This is a narrowly-scoped revival of canvas overlay — ONLY for the
// brand header, not the trust bar (which user removed) and not the slot
// content (AI handles fine).

import type { ResolvedBrandKit } from '../../../types/brandKit'
import type { PaletteFamily } from '../types'
import { TPCN_PALETTES } from '../constants'

export const HEADER_HEIGHT = 80
const CANVAS_SIZE = 1024
const LOGO_SIZE = 56
const LOGO_PADDING = 12

interface ComposeParams {
  /** URL of the AI-generated image (signed Supabase URL or kie.ai CDN URL) */
  aiImageUrl: string
  brandKit: ResolvedBrandKit
  paletteFamily: PaletteFamily
}

/** Composite the brand header strip onto the top of an AI-generated image.
 *  Returns the composited image as a JPEG blob. */
export async function composeHeaderOverlay(params: ComposeParams): Promise<Blob> {
  await ensureFontsLoaded()

  const palette = TPCN_PALETTES[params.paletteFamily]
  const [aiImg, logoImg] = await Promise.all([
    loadImage(params.aiImageUrl),
    params.brandKit.logo?.blobUrl ? loadImage(params.brandKit.logo.blobUrl).catch(() => null) : Promise.resolve(null),
  ])

  // Build the canvas at native AI image size — usually 1024×1024 but be
  // defensive in case kie returns a slightly different size.
  const w = aiImg.naturalWidth || CANVAS_SIZE
  const h = aiImg.naturalHeight || CANVAS_SIZE
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  // 1. Draw AI image as base
  ctx.drawImage(aiImg, 0, 0, w, h)

  // 2. Header background — solid white with subtle brand-color tint at
  //    bottom edge for visual anchor. Always opaque so it covers whatever
  //    the AI drew in this zone (even if AI ignored the "leave blank"
  //    instruction).
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, w, HEADER_HEIGHT)
  // Thin accent line at bottom of header
  ctx.fillStyle = palette.primary
  ctx.fillRect(0, HEADER_HEIGHT - 3, w, 3)

  // 3. Logo (top-left) — preserve aspect ratio
  let textX = LOGO_PADDING
  if (logoImg) {
    const aspect = (logoImg.naturalWidth || LOGO_SIZE) / (logoImg.naturalHeight || LOGO_SIZE)
    const drawH = LOGO_SIZE
    const drawW = drawH * aspect
    const y = (HEADER_HEIGHT - drawH) / 2
    ctx.drawImage(logoImg, LOGO_PADDING, y, drawW, drawH)
    textX = LOGO_PADDING + drawW + 12
  }

  // 4. Store name (next to logo)
  ctx.fillStyle = palette.primary
  ctx.font = `700 24px "Plus Jakarta Sans", system-ui, sans-serif`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  const storeName = truncateToFit(ctx, params.brandKit.storeName, w - textX - 180)
  ctx.fillText(storeName, textX, HEADER_HEIGHT / 2 - 2)

  // 5. Flag chip (top-right) — only when brandKit has a country flag
  if (params.brandKit.flagOrigin) {
    const flag = params.brandKit.flagOrigin.toUpperCase()
    const flagText = `${flagEmoji(flag)}  ${flag}`
    ctx.font = `700 18px "Plus Jakarta Sans", system-ui, sans-serif`
    const textW = ctx.measureText(flagText).width
    const chipW = textW + 32
    const chipH = 36
    const chipX = w - chipW - 16
    const chipY = (HEADER_HEIGHT - chipH) / 2
    drawRoundedRect(ctx, chipX, chipY, chipW, chipH, chipH / 2, palette.cta)
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'center'
    ctx.fillText(flagText, chipX + chipW / 2, chipY + chipH / 2 - 1)
    ctx.textAlign = 'left'
  }

  // 6. Export as JPEG (smaller than PNG, quality high enough)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('canvas.toBlob returned null'))
      },
      'image/jpeg',
      0.92,
    )
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    // Required so canvas.toBlob() doesn't taint when sourcing Supabase /
    // kie.ai signed URLs from a different origin.
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Image load failed: ${url.slice(0, 80)}`))
    img.src = url
  })
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  ctx.fill()
}

function truncateToFit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let truncated = text
  while (truncated.length > 1 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.slice(0, -1)
  }
  return truncated + '…'
}

function flagEmoji(iso: string): string {
  if (!iso || iso.length !== 2) return '🏳️'
  const A = 0x1F1E6
  return String.fromCodePoint(A + (iso.charCodeAt(0) - 65)) +
         String.fromCodePoint(A + (iso.charCodeAt(1) - 65))
}

// ── Font loading ─────────────────────────────────────────────────────────
// Plus Jakarta Sans is loaded via Google Fonts in index.html, but Canvas
// 2D ctx.font is render-time — if the font isn't yet loaded when we draw,
// the browser falls back to a system font and we get the wrong metrics.
// Pre-await once per session, cached.

let fontPromise: Promise<void> | null = null
function ensureFontsLoaded(): Promise<void> {
  if (fontPromise) return fontPromise
  fontPromise = (async () => {
    if (typeof document === 'undefined' || !document.fonts) return
    try {
      await Promise.all([
        document.fonts.load('700 24px "Plus Jakarta Sans"'),
        document.fonts.load('700 18px "Plus Jakarta Sans"'),
      ])
    } catch { /* swallow — fall back to system font rather than blocking gen */ }
  })()
  return fontPromise
}
