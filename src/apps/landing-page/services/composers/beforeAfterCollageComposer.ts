// Before/after split-frame collage composer — 4:5 canvas.
// Composed locally from 2 AI-rendered portrait images. Replaces the
// "AI renders the split collage as one image" approach with a split-frame
// builder that takes 2 portraits + adds "Sebelum" / "Selepas" labels.

import type { Composer } from '../templateEngine'
import { roundRect, loadImage, resolveImageRef, addJpegNoise } from '../templateEngine'

export interface BeforeAfterParams {
  /** Before portrait — tired/heavier/plain version. */
  beforeImageRef: string
  /** After portrait — vibrant/confident version. */
  afterImageRef: string
  /** Split direction. 'horizontal' = side-by-side; 'vertical' = stacked. */
  layout: 'horizontal' | 'vertical'
  /** Label text — defaults to Malay. */
  beforeLabel?: string  // "SEBELUM"
  afterLabel?: string   // "SELEPAS"
  /** Optional bottom strip with caption. */
  caption?: string
  /** Show "+30 hari" duration chip. */
  durationChip?: string
}

const COLORS = {
  bg:           '#0F0F0F',
  beforeBg:     '#3C3C3C',
  afterBg:      '#E8F5E9',
  beforeBadge:  'rgba(0,0,0,0.75)',
  afterBadge:   '#2E7D32',
  beforeText:   '#FFFFFF',
  afterText:    '#FFFFFF',
  arrow:        '#FFC107',
  caption:      '#F5F5F5',
}

export const beforeAfterCollageComposer: Composer<BeforeAfterParams> = {
  id: 'before-after-collage',
  defaultSize: { width: 800, height: 1000 },

  async draw(ctx, params, { width, height }) {
    // Backdrop
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, width, height)

    const captionH = params.caption ? 120 : 60
    const splitArea = { x: 16, y: 16, w: width - 32, h: height - captionH - 16 }

    let beforeRect: { x: number; y: number; w: number; h: number }
    let afterRect: { x: number; y: number; w: number; h: number }

    if (params.layout === 'horizontal') {
      // Side-by-side
      const halfW = (splitArea.w - 8) / 2
      beforeRect = { x: splitArea.x, y: splitArea.y, w: halfW, h: splitArea.h }
      afterRect  = { x: splitArea.x + halfW + 8, y: splitArea.y, w: halfW, h: splitArea.h }
    } else {
      // Stacked
      const halfH = (splitArea.h - 8) / 2
      beforeRect = { x: splitArea.x, y: splitArea.y, w: splitArea.w, h: halfH }
      afterRect  = { x: splitArea.x, y: splitArea.y + halfH + 8, w: splitArea.w, h: halfH }
    }

    // Draw each portrait — graceful fallback to colored placeholder
    await drawPortrait(ctx, params.beforeImageRef, beforeRect, COLORS.beforeBg, 'desaturate')
    await drawPortrait(ctx, params.afterImageRef, afterRect, COLORS.afterBg, 'normal')

    // ── Labels ────────────────────────────────────────────────────────
    drawLabel(ctx, beforeRect, params.beforeLabel ?? 'SEBELUM', COLORS.beforeBadge, COLORS.beforeText)
    drawLabel(ctx, afterRect, params.afterLabel ?? 'SELEPAS', COLORS.afterBadge, COLORS.afterText)

    // ── Arrow between (only horizontal layout looks cool with it) ─────
    if (params.layout === 'horizontal') {
      const cx = splitArea.x + splitArea.w / 2
      const cy = splitArea.y + splitArea.h / 2
      ctx.fillStyle = COLORS.arrow
      ctx.beginPath()
      ctx.moveTo(cx - 24, cy - 18)
      ctx.lineTo(cx + 24, cy)
      ctx.lineTo(cx - 24, cy + 18)
      ctx.lineTo(cx - 12, cy)
      ctx.closePath()
      ctx.fill()
      // White outline
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = 4
      ctx.stroke()
    }

    // ── Duration chip ────────────────────────────────────────────────
    if (params.durationChip) {
      const chipX = afterRect.x + 16
      const chipY = afterRect.y + 16
      const chipW = ctx.measureText(params.durationChip).width + 28
      ctx.fillStyle = '#FFC107'
      roundRect(ctx, chipX, chipY, chipW, 36, 18)
      ctx.fill()
      ctx.fillStyle = '#1A1A1A'
      ctx.font = 'bold 16px -apple-system, sans-serif'
      ctx.textBaseline = 'middle'
      ctx.fillText(params.durationChip, chipX + 14, chipY + 18)
    }

    // ── Bottom caption strip ─────────────────────────────────────────
    if (params.caption) {
      const stripY = height - captionH
      ctx.fillStyle = '#1A1A1A'
      ctx.fillRect(0, stripY, width, captionH)
      ctx.fillStyle = COLORS.caption
      ctx.font = 'bold 22px -apple-system, sans-serif'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.fillText(params.caption, width / 2, stripY + captionH / 2)
      ctx.textAlign = 'left'
    }

    // Very subtle noise — feels like real ad screenshot collage
    addJpegNoise(ctx, width, height, 0.02, `ba-${params.beforeImageRef.slice(-8)}`)
  },
}

async function drawPortrait(
  ctx: CanvasRenderingContext2D,
  ref: string | undefined,
  rect: { x: number; y: number; w: number; h: number },
  fallbackColor: string,
  filter: 'normal' | 'desaturate',
): Promise<void> {
  // Background fill first
  ctx.fillStyle = fallbackColor
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12)
  ctx.fill()

  if (!ref) return
  const url = await resolveImageRef(ref)
  if (!url) return

  try {
    const img = await loadImage(url)
    ctx.save()
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12)
    ctx.clip()
    // cover-fit
    const ratio = Math.max(rect.w / img.width, rect.h / img.height)
    const drawW = img.width * ratio
    const drawH = img.height * ratio
    const dx = rect.x + (rect.w - drawW) / 2
    const dy = rect.y + (rect.h - drawH) / 2

    if (filter === 'desaturate') {
      // OffscreenCanvas/Canvas supports `filter` in modern browsers
      try { ctx.filter = 'grayscale(0.5) brightness(0.85) contrast(1.05)' } catch {/* skip */}
    }
    ctx.drawImage(img, dx, dy, drawW, drawH)
    try { ctx.filter = 'none' } catch {/* skip */}

    ctx.restore()
  } catch {
    // Already drew fallback bg above
  }
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  text: string,
  bg: string, fg: string,
): void {
  ctx.fillStyle = bg
  const labelW = ctx.measureText(text).width + 36
  const labelH = 42
  // Bottom-left corner of the panel
  const lx = rect.x + 16
  const ly = rect.y + rect.h - labelH - 16
  roundRect(ctx, lx, ly, labelW, labelH, 8)
  ctx.fill()
  ctx.fillStyle = fg
  ctx.font = 'bold 20px -apple-system, "Segoe UI", sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, lx + 18, ly + labelH / 2)
}
