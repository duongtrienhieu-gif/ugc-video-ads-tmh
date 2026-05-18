// ─────────────────────────────────────────────────────────────────────
// Ingredient card canvas renderer — takes the photographic scene from
// KIE + ingredient list + carousel chrome and overlays the UI layer
// (labels, connector lines, slide indicator, brand wordmark, arrows).
//
// EVERY text element is drawn by canvas — never AI. This is what fixes
// the "warped AI label text" failure mode.
// ─────────────────────────────────────────────────────────────────────

import { drawImageCover, fillRoundRect, SYSTEM_FONT_STACK, wrapText } from '../chat-proof/canvasUtils'
import type {
  IngredientCardVariant, IngredientCardContent, IngredientItem,
} from './types'

interface VariantTheme {
  /** Canvas outer background fill (visible around the scene if scene is
   *  inset rather than full-bleed). */
  outerBg: string
  /** Border around the scene panel (optional, for clinical/premium variants). */
  panelBorder: string | null
  panelBorderWidth: number
  /** Slot the photographic scene into a slightly-inset card region? */
  insetFraction: number
  /** Color of the connector line + label text. */
  labelColor: string
  /** Color of the benefit subtext (smaller, fainter). */
  benefitColor: string
  /** Typography sizes (% of canvas width). */
  labelFontFraction: number
  benefitFontFraction: number
  /** Connector line width. */
  connectorWidth: number
  /** Carousel indicator color. */
  chromeColor: string
  /** Carousel indicator background pill. */
  chromePillBg: string
  /** Brand wordmark color. */
  brandColor: string
}

const THEMES: Record<IngredientCardVariant, VariantTheme> = {
  'minimal-wellness': {
    outerBg: '#F7F4ED',
    panelBorder: null,
    panelBorderWidth: 0,
    insetFraction: 0.04,
    labelColor: '#1A1A1A',
    benefitColor: '#6E6E6E',
    labelFontFraction: 0.028,
    benefitFontFraction: 0.020,
    connectorWidth: 1.2,
    chromeColor: '#1A1A1A',
    chromePillBg: 'rgba(255,255,255,0.85)',
    brandColor: '#1A1A1A',
  },
  'clinical-clean': {
    outerBg: '#F4F7FA',
    panelBorder: '#D7DEE6',
    panelBorderWidth: 1,
    insetFraction: 0.05,
    labelColor: '#1F2937',
    benefitColor: '#5C6B7A',
    labelFontFraction: 0.026,
    benefitFontFraction: 0.019,
    connectorWidth: 1,
    chromeColor: '#1F2937',
    chromePillBg: 'rgba(255,255,255,0.9)',
    brandColor: '#1F2937',
  },
  'tiktok-ad': {
    outerBg: '#FFFFFF',
    panelBorder: null,
    panelBorderWidth: 0,
    insetFraction: 0.025,
    labelColor: '#0A0A0A',
    benefitColor: '#5A5A5A',
    labelFontFraction: 0.032,
    benefitFontFraction: 0.022,
    connectorWidth: 1.4,
    chromeColor: '#FFFFFF',
    chromePillBg: 'rgba(20,20,20,0.78)',
    brandColor: '#0A0A0A',
  },
  'premium-supplement': {
    outerBg: '#EFE6D6',
    panelBorder: '#D7C9AC',
    panelBorderWidth: 1,
    insetFraction: 0.045,
    labelColor: '#2A2218',
    benefitColor: '#6E5F45',
    labelFontFraction: 0.028,
    benefitFontFraction: 0.020,
    connectorWidth: 1.2,
    chromeColor: '#2A2218',
    chromePillBg: 'rgba(255,253,245,0.88)',
    brandColor: '#2A2218',
  },
}

/** Compute anchor positions for up to 5 ingredients. Layout is asymmetric
 *  but balanced — 2 on the left, 3 on the right (or vice versa). */
function assignAnchors(items: IngredientItem[]): IngredientItem[] {
  // Pre-defined positions: (sideX, positionY) — Y measured from top of
  // panel (0..1). Asymmetric on purpose.
  const positions: { sideX: 'left' | 'right'; positionY: number }[] = [
    { sideX: 'left',  positionY: 0.22 },
    { sideX: 'right', positionY: 0.30 },
    { sideX: 'left',  positionY: 0.62 },
    { sideX: 'right', positionY: 0.55 },
    { sideX: 'right', positionY: 0.78 },
  ]
  return items.slice(0, 5).map((item, i) => ({
    ...item,
    anchor: item.anchor ?? positions[i],
  }))
}

/** Draw a single ingredient callout — label + benefit + connector line. */
function drawCallout(
  ctx: CanvasRenderingContext2D,
  panelX: number, panelY: number, panelW: number, panelH: number,
  item: IngredientItem,
  theme: VariantTheme,
  canvasW: number,
): void {
  if (!item.anchor) return
  const { sideX, positionY } = item.anchor

  // Label box position — sits just outside the panel edge, indented in
  // by 6-8% of panel width.
  const labelFontSize = Math.round(canvasW * theme.labelFontFraction)
  const benefitFontSize = Math.round(canvasW * theme.benefitFontFraction)
  const labelLineHeight = labelFontSize * 1.15
  const benefitLineHeight = benefitFontSize * 1.20
  const calloutWidth = canvasW * 0.18

  ctx.font = `400 ${benefitFontSize}px ${SYSTEM_FONT_STACK}`
  const benefitLines = wrapText(ctx, item.benefit, calloutWidth).slice(0, 2)

  const labelX = sideX === 'left'
    ? panelX + panelW * 0.06
    : panelX + panelW * 0.94 - calloutWidth
  const labelY = panelY + panelH * positionY

  // Connector line — from label end → into the panel toward the center
  // where the ingredient sits. We don't know the exact ingredient pixel
  // position (it's inside the AI scene), so we anchor toward an
  // approximation of where the ingredient orbits the product.
  const connectorStartX = sideX === 'left'
    ? labelX + calloutWidth - 4
    : labelX + 4
  const connectorStartY = labelY + labelFontSize * 0.5

  // End point — about 30-45% in from the edge, on the same vertical
  // level as the label's mid-line (with slight curve toward center).
  const connectorEndX = sideX === 'left'
    ? panelX + panelW * 0.32
    : panelX + panelW * 0.68
  const connectorEndY = labelY + labelFontSize * 0.5

  ctx.strokeStyle = theme.labelColor
  ctx.lineWidth = theme.connectorWidth
  ctx.lineCap = 'round'
  ctx.beginPath()
  // Slight elbow midway
  const elbowX = sideX === 'left'
    ? connectorStartX + (connectorEndX - connectorStartX) * 0.25
    : connectorStartX + (connectorEndX - connectorStartX) * 0.25
  ctx.moveTo(connectorStartX, connectorStartY)
  ctx.lineTo(elbowX, connectorStartY)
  ctx.lineTo(connectorEndX, connectorEndY)
  ctx.stroke()

  // Small dot at the end of the connector
  ctx.fillStyle = theme.labelColor
  ctx.beginPath()
  ctx.arc(connectorEndX, connectorEndY, theme.connectorWidth * 1.6, 0, Math.PI * 2)
  ctx.fill()

  // Label text
  ctx.fillStyle = theme.labelColor
  ctx.font = `700 ${labelFontSize}px ${SYSTEM_FONT_STACK}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(item.name, labelX, labelY)

  // Benefit text
  ctx.fillStyle = theme.benefitColor
  ctx.font = `400 ${benefitFontSize}px ${SYSTEM_FONT_STACK}`
  let by = labelY + labelLineHeight + 2
  for (const line of benefitLines) {
    ctx.fillText(line, labelX, by)
    by += benefitLineHeight
  }
}

/** Draw the carousel chrome — slide indicator + download icon top-right
 *  + slide arrow bottom-right + brand wordmark bottom-left. */
function drawCarouselChrome(
  ctx: CanvasRenderingContext2D,
  panelX: number, panelY: number, panelW: number, panelH: number,
  carousel: NonNullable<IngredientCardContent['carousel']>,
  theme: VariantTheme,
  canvasW: number,
): void {
  // Top-left — slide indicator pill: "< 2 / 5 >"
  const pillH = panelH * 0.045
  const pillPadX = pillH * 0.65
  const chromeFontSize = Math.round(canvasW * 0.022)
  ctx.font = `600 ${chromeFontSize}px ${SYSTEM_FONT_STACK}`
  const indicatorText = carousel.slideIndex
  const tw = ctx.measureText(indicatorText).width
  // Add room for left + right chevrons
  const chevronSize = chromeFontSize * 0.55
  const pillW = tw + pillPadX * 2 + chevronSize * 4
  const pillX = panelX + panelW * 0.035
  const pillY = panelY + panelH * 0.035

  fillRoundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2, theme.chromePillBg)

  // Left chevron
  ctx.strokeStyle = theme.chromeColor
  ctx.lineWidth = Math.max(1.5, canvasW * 0.0025)
  ctx.lineCap = 'round'
  const chevCy = pillY + pillH / 2
  ctx.beginPath()
  ctx.moveTo(pillX + pillPadX + chevronSize * 0.7, chevCy - chevronSize * 0.5)
  ctx.lineTo(pillX + pillPadX, chevCy)
  ctx.lineTo(pillX + pillPadX + chevronSize * 0.7, chevCy + chevronSize * 0.5)
  ctx.stroke()

  // Text
  ctx.fillStyle = theme.chromeColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(indicatorText, pillX + pillW / 2, chevCy + 1)

  // Right chevron
  ctx.beginPath()
  ctx.moveTo(pillX + pillW - pillPadX - chevronSize * 0.7, chevCy - chevronSize * 0.5)
  ctx.lineTo(pillX + pillW - pillPadX, chevCy)
  ctx.lineTo(pillX + pillW - pillPadX - chevronSize * 0.7, chevCy + chevronSize * 0.5)
  ctx.stroke()

  // Top-right — download icon (small rounded square with downward arrow)
  const dlSize = pillH
  const dlX = panelX + panelW - panelW * 0.035 - dlSize
  const dlY = pillY
  fillRoundRect(ctx, dlX, dlY, dlSize, dlSize, dlSize * 0.22, theme.chromePillBg)
  ctx.strokeStyle = theme.chromeColor
  ctx.lineWidth = Math.max(1.5, canvasW * 0.0025)
  ctx.beginPath()
  const arrLen = dlSize * 0.35
  ctx.moveTo(dlX + dlSize / 2, dlY + dlSize * 0.30)
  ctx.lineTo(dlX + dlSize / 2, dlY + dlSize * 0.65)
  ctx.moveTo(dlX + dlSize / 2 - arrLen * 0.4, dlY + dlSize * 0.50)
  ctx.lineTo(dlX + dlSize / 2, dlY + dlSize * 0.65)
  ctx.lineTo(dlX + dlSize / 2 + arrLen * 0.4, dlY + dlSize * 0.50)
  ctx.stroke()
  // Tray
  ctx.beginPath()
  ctx.moveTo(dlX + dlSize * 0.30, dlY + dlSize * 0.72)
  ctx.lineTo(dlX + dlSize * 0.70, dlY + dlSize * 0.72)
  ctx.stroke()

  // Bottom-left — brand wordmark + domain
  if (carousel.brandWordmark || carousel.brandDomain) {
    const brandSize = Math.round(canvasW * 0.038)
    const domainSize = Math.round(canvasW * 0.020)
    const brandX = panelX + panelW * 0.05
    let brandY = panelY + panelH - panelH * 0.10
    if (carousel.brandWordmark) {
      ctx.fillStyle = theme.brandColor
      ctx.font = `700 ${brandSize}px ${SYSTEM_FONT_STACK}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(carousel.brandWordmark, brandX, brandY)
      brandY += brandSize * 1.15
    }
    if (carousel.brandDomain) {
      ctx.fillStyle = theme.benefitColor
      ctx.font = `500 ${domainSize}px ${SYSTEM_FONT_STACK}`
      ctx.fillText(carousel.brandDomain, brandX, brandY)
    }
  }
}

/** Main entry — draw the full ingredient card onto the canvas context.
 *  The caller is responsible for creating the canvas, post-processing,
 *  and encoding the result. */
export function drawIngredientCard(
  ctx: CanvasRenderingContext2D,
  width: number, height: number,
  variant: IngredientCardVariant,
  content: IngredientCardContent,
  sceneImage: HTMLImageElement | null,
): void {
  const theme = THEMES[variant]

  // Outer background
  ctx.fillStyle = theme.outerBg
  ctx.fillRect(0, 0, width, height)

  // Scene panel — inset slightly so the card has visible breathing room
  const inset = width * theme.insetFraction
  const panelX = inset
  const panelY = inset
  const panelW = width - inset * 2
  const panelH = height - inset * 2

  // Draw the photographic scene (or a placeholder gradient)
  if (sceneImage) {
    drawImageCover(ctx, sceneImage, panelX, panelY, panelW, panelH, width * 0.012)
  } else {
    const grad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH)
    grad.addColorStop(0, theme.outerBg)
    grad.addColorStop(1, theme.panelBorder ?? theme.outerBg)
    fillRoundRect(ctx, panelX, panelY, panelW, panelH, width * 0.012, grad as unknown as string)
    // Placeholder hint
    ctx.fillStyle = theme.benefitColor
    ctx.font = `500 ${Math.round(width * 0.022)}px ${SYSTEM_FONT_STACK}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('— scene generating —', panelX + panelW / 2, panelY + panelH / 2)
  }

  // Panel border (clinical / premium variants)
  if (theme.panelBorder) {
    ctx.strokeStyle = theme.panelBorder
    ctx.lineWidth = theme.panelBorderWidth
    ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1)
  }

  // Assign anchors then draw callouts
  const positioned = assignAnchors(content.ingredients)
  for (const item of positioned) {
    drawCallout(ctx, panelX, panelY, panelW, panelH, item, theme, width)
  }

  // Carousel chrome
  if (content.carousel) {
    drawCarouselChrome(ctx, panelX, panelY, panelW, panelH, content.carousel, theme, width)
  }

  // Optional headline strip
  if (content.headline) {
    const headlineSize = Math.round(width * 0.032)
    ctx.fillStyle = theme.labelColor
    ctx.font = `600 ${headlineSize}px ${SYSTEM_FONT_STACK}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(content.headline, width / 2, panelY + panelH * 0.10)
  }
}
