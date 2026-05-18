// ── Infographic Canvas Template (P8) ────────────────────────────────────────
//
// Renders a 4:5 infographic: hero stat callout + 3-5 supporting bullets
// + footnote, plus optional product image inset. Vector-only — no AI
// generation in the canvas pipeline (background palette + composition
// + typography from design-system tokens).

import {
  createCanvas,
  loadImage,
  roundedRectPath,
  wrapText,
} from '../../ui-native/_shared/canvas'
import type { DesignedGraphicLayout, DesignedGraphicTypography, DesignedGraphicColorTheme } from '../../../types/designedGraphic'
import type { InfographicContent } from '../_textPayload'
import { contentRect, splitVertical } from '../../../shared/design-system/grid'

export interface InfographicRenderInputs {
  content: InfographicContent
  layout: DesignedGraphicLayout
  typography: DesignedGraphicTypography
  colorTheme: DesignedGraphicColorTheme
  /** Optional product image URL (asset:// or https://) — drawn as inset. */
  productImageUrl?: string
}

export async function renderInfographic(
  inputs: InfographicRenderInputs,
): Promise<HTMLCanvasElement> {
  const { content, layout, typography, colorTheme } = inputs
  const { canvas, ctx } = createCanvas(layout.canvasSize)

  // ── Background — gradient if available else flat fill ─────────────
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

  // ── Title bar ──────────────────────────────────────────────────────
  ctx.fillStyle = colorTheme.primary
  ctx.font = `700 ${Math.round(typography.captionPx * 1.4)}px ${typography.fontStack}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const titleLines = wrapText(ctx, content.title.toUpperCase(), inner.width)
  let cursor = inner.y
  for (const line of titleLines) {
    ctx.fillText(line, inner.x, cursor)
    cursor += Math.round(typography.captionPx * 1.6)
  }
  cursor += 24

  // ── Hero stat ──────────────────────────────────────────────────────
  // Big display number with unit suffix, label below
  ctx.fillStyle = colorTheme.foreground
  ctx.font = `800 ${typography.displayPx}px ${typography.fontStack}`
  ctx.textBaseline = 'alphabetic'
  const valueText = content.heroStat.value
  const unitText = content.heroStat.unit
  const valueWidth = ctx.measureText(valueText).width

  const heroBaseline = cursor + typography.displayPx
  ctx.fillText(valueText, inner.x, heroBaseline)

  // Unit follows the value at ~70% size
  ctx.font = `700 ${Math.round(typography.displayPx * 0.55)}px ${typography.fontStack}`
  ctx.fillStyle = colorTheme.accent
  ctx.fillText(unitText, inner.x + valueWidth + 16, heroBaseline)

  cursor = heroBaseline + 20

  // Hero label below number
  ctx.fillStyle = colorTheme.foreground
  ctx.font = `500 ${Math.round(typography.bodyPx * 1.1)}px ${typography.fontStack}`
  ctx.textBaseline = 'top'
  const heroLabelLines = wrapText(ctx, content.heroStat.label, inner.width - 40)
  for (const line of heroLabelLines) {
    ctx.fillText(line, inner.x, cursor)
    cursor += Math.round(typography.bodyPx * 1.45)
  }
  cursor += 30

  // ── Divider line in accent color ───────────────────────────────────
  ctx.fillStyle = colorTheme.accent
  ctx.fillRect(inner.x, cursor, 80, 6)
  cursor += 40

  // ── Bullets area (split vertical inside remaining inner space) ────
  const bulletsRect = { x: inner.x, y: cursor, width: inner.width, height: inner.height - (cursor - inner.y) - 80 }
  const items = content.bullets.slice(0, 5)
  const rows = splitVertical(bulletsRect, Math.max(items.length, 3), 14)
  for (let i = 0; i < items.length; i++) {
    drawBulletRow(ctx, items[i], rows[i], typography, colorTheme, i + 1)
  }

  // ── Optional product image inset (top-right corner) ───────────────
  if (inputs.productImageUrl) {
    try {
      const img = await loadImage(inputs.productImageUrl)
      const insetSize = 220
      const insetX = inner.x + inner.width - insetSize
      const insetY = inner.y - 20
      ctx.save()
      roundedRectPath(ctx, insetX, insetY, insetSize, insetSize, 24)
      ctx.fillStyle = '#FFFFFF'
      ctx.fill()
      ctx.clip()
      // Cover-fit
      const scale = Math.max(insetSize / img.naturalWidth, insetSize / img.naturalHeight)
      const drawW = img.naturalWidth * scale
      const drawH = img.naturalHeight * scale
      ctx.drawImage(img, insetX + (insetSize - drawW) / 2, insetY + (insetSize - drawH) / 2, drawW, drawH)
      ctx.restore()
    } catch {
      // Skip on load failure — infographic still valid without inset
    }
  }

  // ── Footnote at the bottom ─────────────────────────────────────────
  ctx.fillStyle = colorTheme.foreground
  ctx.globalAlpha = 0.55
  ctx.font = `400 ${typography.captionPx}px ${typography.fontStack}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  const footnoteY = layout.canvasSize.height - layout.padding.bottom
  const footnoteLines = wrapText(ctx, content.footnote, inner.width)
  let footnoteCursor = footnoteY - (footnoteLines.length - 1) * (typography.captionPx + 4)
  for (const line of footnoteLines) {
    ctx.fillText(line, inner.x, footnoteCursor)
    footnoteCursor += typography.captionPx + 4
  }
  ctx.globalAlpha = 1

  return canvas
}

function drawBulletRow(
  ctx: CanvasRenderingContext2D,
  text: string,
  rect: { x: number; y: number; width: number; height: number },
  typography: DesignedGraphicTypography,
  colorTheme: DesignedGraphicColorTheme,
  index: number,
): void {
  // Index pill on the left
  const pillSize = Math.round(typography.bodyPx * 1.6)
  const pillCx = rect.x + pillSize / 2
  const pillCy = rect.y + rect.height / 2
  ctx.fillStyle = colorTheme.primary
  ctx.beginPath()
  ctx.arc(pillCx, pillCy, pillSize / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `700 ${Math.round(typography.bodyPx * 0.9)}px ${typography.fontStack}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(index), pillCx, pillCy + 1)

  // Bullet text
  ctx.fillStyle = colorTheme.foreground
  ctx.font = `500 ${typography.bodyPx}px ${typography.fontStack}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const textX = rect.x + pillSize + 20
  const textMaxW = rect.width - pillSize - 30
  const lines = wrapText(ctx, text, textMaxW)
  if (lines.length === 1) {
    ctx.fillText(lines[0], textX, pillCy)
  } else {
    // Multi-line — distribute vertically
    const totalH = lines.length * typography.bodyPx * 1.3
    let lineY = pillCy - totalH / 2 + typography.bodyPx * 0.65
    for (const line of lines) {
      ctx.fillText(line, textX, lineY)
      lineY += typography.bodyPx * 1.3
    }
  }
}
