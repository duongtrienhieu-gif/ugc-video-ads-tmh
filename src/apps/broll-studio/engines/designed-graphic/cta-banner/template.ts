// ── CTA Banner Canvas Template (P8) ─────────────────────────────────────────
//
// Renders a 4:5 CTA banner: bold headline + supporting subhead + offer
// pill + CTA button, with the product image as the primary visual.
// Vector-only — no AI generation in the canvas pipeline.

import {
  createCanvas,
  loadImage,
  roundedRectPath,
  wrapText,
} from '../../ui-native/_shared/canvas'
import type { DesignedGraphicLayout, DesignedGraphicTypography, DesignedGraphicColorTheme } from '../../../types/designedGraphic'
import type { CtaBannerContent } from '../_textPayload'
import { contentRect } from '../../../shared/design-system/grid'

export interface CtaBannerRenderInputs {
  content: CtaBannerContent
  layout: DesignedGraphicLayout
  typography: DesignedGraphicTypography
  colorTheme: DesignedGraphicColorTheme
  /** Product image URL — drawn as the hero visual. */
  productImageUrl?: string
}

export async function renderCtaBanner(
  inputs: CtaBannerRenderInputs,
): Promise<HTMLCanvasElement> {
  const { content, layout, typography, colorTheme } = inputs
  const { canvas, ctx } = createCanvas(layout.canvasSize)

  // Background — gradient if available
  if (colorTheme.gradient && colorTheme.gradient.length >= 2) {
    const g = ctx.createLinearGradient(0, 0, 0, layout.canvasSize.height)
    g.addColorStop(0, colorTheme.gradient[0])
    g.addColorStop(1, colorTheme.gradient[1])
    ctx.fillStyle = g
  } else {
    ctx.fillStyle = colorTheme.background
  }
  ctx.fillRect(0, 0, layout.canvasSize.width, layout.canvasSize.height)

  const inner = contentRect(layout)

  // ── Product hero on top half ───────────────────────────────────────
  const heroH = Math.round(inner.height * 0.42)
  const heroRect = { x: inner.x, y: inner.y, width: inner.width, height: heroH }

  if (inputs.productImageUrl) {
    try {
      const img = await loadImage(inputs.productImageUrl)
      // Cover-fit centered, then rounded clip
      ctx.save()
      roundedRectPath(ctx, heroRect.x, heroRect.y, heroRect.width, heroRect.height, 32)
      ctx.fillStyle = '#FFFFFF'
      ctx.fill()
      ctx.clip()
      const scale = Math.max(heroRect.width / img.naturalWidth, heroRect.height / img.naturalHeight)
      const drawW = img.naturalWidth * scale
      const drawH = img.naturalHeight * scale
      ctx.drawImage(
        img,
        heroRect.x + (heroRect.width - drawW) / 2,
        heroRect.y + (heroRect.height - drawH) / 2,
        drawW, drawH,
      )
      ctx.restore()
    } catch {
      // Fall through — header still renders without image
    }
  } else {
    // No image: render a soft accent rectangle as placeholder
    roundedRectPath(ctx, heroRect.x, heroRect.y, heroRect.width, heroRect.height, 32)
    ctx.fillStyle = colorTheme.accent + '22'  // 13% opacity hex append
    ctx.fill()
  }

  let cursor = heroRect.y + heroRect.height + 56

  // ── Offer pill ─────────────────────────────────────────────────────
  ctx.font = `600 ${typography.captionPx}px ${typography.fontStack}`
  const offerText = content.offerLine.toUpperCase()
  const offerW = ctx.measureText(offerText).width + 36
  const offerH = Math.round(typography.captionPx * 2.2)
  roundedRectPath(ctx, inner.x, cursor, offerW, offerH, offerH / 2)
  ctx.fillStyle = colorTheme.accent
  ctx.fill()
  ctx.fillStyle = colorTheme.background
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(offerText, inner.x + offerW / 2, cursor + offerH / 2)
  cursor += offerH + 28

  // ── Headline ───────────────────────────────────────────────────────
  ctx.fillStyle = colorTheme.foreground
  ctx.font = `800 ${typography.displayPx}px ${typography.fontStack}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const headlineLines = wrapText(ctx, content.headline, inner.width)
  for (const line of headlineLines) {
    ctx.fillText(line, inner.x, cursor)
    cursor += Math.round(typography.displayPx * 1.05)
  }
  cursor += 16

  // ── Subheadline ────────────────────────────────────────────────────
  ctx.fillStyle = colorTheme.foreground
  ctx.globalAlpha = 0.72
  ctx.font = `500 ${typography.bodyPx}px ${typography.fontStack}`
  const subLines = wrapText(ctx, content.subheadline, inner.width)
  for (const line of subLines) {
    ctx.fillText(line, inner.x, cursor)
    cursor += Math.round(typography.bodyPx * 1.45)
  }
  ctx.globalAlpha = 1

  // ── CTA button (bottom, full width) ────────────────────────────────
  const btnH = Math.round(typography.bodyPx * 2.4)
  const btnY = layout.canvasSize.height - layout.padding.bottom - btnH
  roundedRectPath(ctx, inner.x, btnY, inner.width, btnH, btnH / 2)
  ctx.fillStyle = colorTheme.primary
  ctx.fill()

  ctx.fillStyle = colorTheme.background
  ctx.font = `700 ${Math.round(typography.bodyPx * 1.1)}px ${typography.fontStack}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(content.ctaText.toUpperCase(), inner.x + inner.width / 2, btnY + btnH / 2)

  // Arrow on the right side of the button
  const arrowCx = inner.x + inner.width - 60
  const arrowCy = btnY + btnH / 2
  ctx.strokeStyle = colorTheme.background
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(arrowCx - 14, arrowCy)
  ctx.lineTo(arrowCx + 6, arrowCy)
  ctx.moveTo(arrowCx - 4, arrowCy - 10)
  ctx.lineTo(arrowCx + 6, arrowCy)
  ctx.lineTo(arrowCx - 4, arrowCy + 10)
  ctx.stroke()

  return canvas
}
