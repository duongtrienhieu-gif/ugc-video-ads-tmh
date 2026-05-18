// ─────────────────────────────────────────────────────────────────────
// Comparison card canvas renderer — takes the side-by-side photographic
// scene from KIE and overlays the UI layer:
//   - THEM / US header bands
//   - Bullet rows with X / check icons
//   - Central VS badge (focal anchor)
//   - Carousel chrome (slide indicator, brand wordmark, slide arrows)
//
// All text + icons are canvas-rendered — never AI.
// ─────────────────────────────────────────────────────────────────────

import { drawImageCover, fillRoundRect, SYSTEM_FONT_STACK, wrapText } from '../chat-proof/canvasUtils'
import type {
  ComparisonCardVariant, ComparisonContent, ComparisonBullet,
} from './types'

interface VariantTheme {
  outerBg: string
  /** Headline band colors per side. */
  leftHeaderBg: string
  leftHeaderText: string
  rightHeaderBg: string
  rightHeaderText: string
  /** Bullet row colors. */
  leftBulletBg: string
  leftBulletText: string
  leftBulletSubtext: string
  rightBulletBg: string
  rightBulletText: string
  rightBulletSubtext: string
  /** Icon colors. */
  xIconColor: string
  xIconBg: string
  checkIconColor: string
  checkIconBg: string
  /** VS badge colors. */
  vsBadgeBg: string
  vsBadgeText: string
  vsBadgeBorder: string
  /** Carousel chrome. */
  chromeColor: string
  chromePillBg: string
  brandColor: string
}

const THEMES: Record<ComparisonCardVariant, VariantTheme> = {
  'supplement-wellness': {
    outerBg: '#0A0A0A',
    leftHeaderBg: 'transparent',
    leftHeaderText: '#FFFFFF',
    rightHeaderBg: 'transparent',
    rightHeaderText: '#FFFFFF',
    leftBulletBg: 'rgba(35,35,35,0.85)',
    leftBulletText: '#E5E5E5',
    leftBulletSubtext: '#9A9A9A',
    rightBulletBg: 'rgba(28,75,46,0.92)',
    rightBulletText: '#FFFFFF',
    rightBulletSubtext: '#D3E8D9',
    xIconColor: '#FFFFFF',
    xIconBg: '#3C3C3C',
    checkIconColor: '#FFFFFF',
    checkIconBg: '#22A34C',
    vsBadgeBg: '#FFFFFF',
    vsBadgeText: '#0A0A0A',
    vsBadgeBorder: 'rgba(255,255,255,0.95)',
    chromeColor: '#FFFFFF',
    chromePillBg: 'rgba(255,255,255,0.18)',
    brandColor: '#FFFFFF',
  },
  'beauty-luxury': {
    outerBg: '#F4E4DA',
    leftHeaderBg: 'transparent',
    leftHeaderText: '#FFFFFF',
    rightHeaderBg: 'transparent',
    rightHeaderText: '#2A1818',
    leftBulletBg: 'rgba(58,40,50,0.88)',
    leftBulletText: '#F4E4DA',
    leftBulletSubtext: '#C4A8AC',
    rightBulletBg: 'rgba(255,250,247,0.92)',
    rightBulletText: '#2A1818',
    rightBulletSubtext: '#7A5856',
    xIconColor: '#FFFFFF',
    xIconBg: '#5A4044',
    checkIconColor: '#FFFFFF',
    checkIconBg: '#C2746C',
    vsBadgeBg: '#FFFFFF',
    vsBadgeText: '#2A1818',
    vsBadgeBorder: 'rgba(255,255,255,0.95)',
    chromeColor: '#2A1818',
    chromePillBg: 'rgba(255,255,255,0.78)',
    brandColor: '#2A1818',
  },
  'detox-clinical': {
    outerBg: '#0F1B26',
    leftHeaderBg: 'transparent',
    leftHeaderText: '#FFFFFF',
    rightHeaderBg: 'transparent',
    rightHeaderText: '#1F2937',
    leftBulletBg: 'rgba(31,42,55,0.88)',
    leftBulletText: '#E4ECF3',
    leftBulletSubtext: '#9CABBA',
    rightBulletBg: 'rgba(248,251,255,0.92)',
    rightBulletText: '#1F2937',
    rightBulletSubtext: '#5C6B7A',
    xIconColor: '#FFFFFF',
    xIconBg: '#4A5A6B',
    checkIconColor: '#FFFFFF',
    checkIconBg: '#2A8FD4',
    vsBadgeBg: '#FFFFFF',
    vsBadgeText: '#1F2937',
    vsBadgeBorder: 'rgba(255,255,255,0.95)',
    chromeColor: '#FFFFFF',
    chromePillBg: 'rgba(255,255,255,0.20)',
    brandColor: '#FFFFFF',
  },
  'tiktok-bold': {
    outerBg: '#000000',
    leftHeaderBg: 'transparent',
    leftHeaderText: '#FFFFFF',
    rightHeaderBg: 'transparent',
    rightHeaderText: '#000000',
    leftBulletBg: 'rgba(28,28,28,0.92)',
    leftBulletText: '#FFFFFF',
    leftBulletSubtext: '#A0A0A0',
    rightBulletBg: 'rgba(255,255,255,0.95)',
    rightBulletText: '#000000',
    rightBulletSubtext: '#3C3C3C',
    xIconColor: '#FFFFFF',
    xIconBg: '#2A2A2A',
    checkIconColor: '#000000',
    checkIconBg: '#C8FF4A',
    vsBadgeBg: '#FFFFFF',
    vsBadgeText: '#000000',
    vsBadgeBorder: 'rgba(255,255,255,0.95)',
    chromeColor: '#FFFFFF',
    chromePillBg: 'rgba(255,255,255,0.18)',
    brandColor: '#FFFFFF',
  },
}

/** Draw an X (cross) icon centered at (cx, cy) within a circle of radius r. */
function drawXIcon(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  bg: string, fg: string,
): void {
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = fg
  ctx.lineWidth = Math.max(2, r * 0.22)
  ctx.lineCap = 'round'
  const off = r * 0.42
  ctx.beginPath()
  ctx.moveTo(cx - off, cy - off)
  ctx.lineTo(cx + off, cy + off)
  ctx.moveTo(cx + off, cy - off)
  ctx.lineTo(cx - off, cy + off)
  ctx.stroke()
}

/** Draw a check (tick) icon centered at (cx, cy) within a circle of radius r. */
function drawCheckIcon(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  bg: string, fg: string,
): void {
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = fg
  ctx.lineWidth = Math.max(2, r * 0.22)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.40, cy + r * 0.05)
  ctx.lineTo(cx - r * 0.10, cy + r * 0.35)
  ctx.lineTo(cx + r * 0.45, cy - r * 0.30)
  ctx.stroke()
}

/** Draw the VS badge at the exact center of the canvas — circular,
 *  high-contrast, focal anchor. */
function drawVsBadge(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  text: string,
  theme: VariantTheme,
): void {
  // Soft outer shadow
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = radius * 0.6
  ctx.shadowOffsetY = radius * 0.08
  ctx.fillStyle = theme.vsBadgeBg
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Border ring
  ctx.strokeStyle = theme.vsBadgeBorder
  ctx.lineWidth = Math.max(1.5, radius * 0.025)
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.stroke()

  // Text
  ctx.fillStyle = theme.vsBadgeText
  ctx.font = `800 ${Math.round(radius * 1.05)}px ${SYSTEM_FONT_STACK}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, cx, cy + radius * 0.04)
}

/** Draw a side header band — "THEM" or "US". Drawn directly on top of
 *  the AI scene at the top edge of each half. */
function drawSideHeader(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
  text: string,
  color: string,
  fontSize: number,
): void {
  ctx.fillStyle = color
  ctx.font = `900 ${fontSize}px ${SYSTEM_FONT_STACK}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  // Slight text shadow for legibility over photographic backgrounds
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = fontSize * 0.18
  ctx.shadowOffsetY = fontSize * 0.05
  ctx.fillText(text, x + w / 2, y)
  ctx.restore()
}

/** Draw a single bullet row — icon (X or check) + text + optional subtext.
 *  Returns the bottom Y of the row. */
function drawBulletRow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
  bullet: ComparisonBullet,
  variant: 'them' | 'us',
  theme: VariantTheme,
  canvasW: number,
): number {
  const padding = w * 0.06
  const radius = w * 0.06
  const iconR = canvasW * 0.018

  const textFontSize = Math.round(canvasW * 0.026)
  const subFontSize  = Math.round(canvasW * 0.020)

  ctx.font = `700 ${textFontSize}px ${SYSTEM_FONT_STACK}`
  const textWidthBudget = w - padding * 2 - iconR * 2 - padding * 0.5
  const textLines = wrapText(ctx, bullet.text, textWidthBudget).slice(0, 2)

  let subLines: string[] = []
  if (bullet.subtext) {
    ctx.font = `400 ${subFontSize}px ${SYSTEM_FONT_STACK}`
    subLines = wrapText(ctx, bullet.subtext, textWidthBudget).slice(0, 1)
  }

  const textLineHeight = textFontSize * 1.18
  const subLineHeight  = subFontSize * 1.20
  const innerH =
    textLines.length * textLineHeight +
    (subLines.length > 0 ? 3 + subLines.length * subLineHeight : 0)
  const rowH = Math.max(iconR * 2.4, innerH + padding * 1.0)

  // Row background
  fillRoundRect(
    ctx, x, y, w, rowH, radius,
    variant === 'them' ? theme.leftBulletBg : theme.rightBulletBg,
  )

  // Icon
  const iconCx = x + padding + iconR
  const iconCy = y + rowH / 2
  if (variant === 'them') {
    drawXIcon(ctx, iconCx, iconCy, iconR, theme.xIconBg, theme.xIconColor)
  } else {
    drawCheckIcon(ctx, iconCx, iconCy, iconR, theme.checkIconBg, theme.checkIconColor)
  }

  // Text block
  const textX = iconCx + iconR + padding * 0.5
  let textY = y + (rowH - innerH) / 2
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  ctx.fillStyle = variant === 'them' ? theme.leftBulletText : theme.rightBulletText
  ctx.font = `700 ${textFontSize}px ${SYSTEM_FONT_STACK}`
  for (const line of textLines) {
    ctx.fillText(line, textX, textY)
    textY += textLineHeight
  }
  if (subLines.length > 0) {
    textY += 3
    ctx.fillStyle = variant === 'them' ? theme.leftBulletSubtext : theme.rightBulletSubtext
    ctx.font = `400 ${subFontSize}px ${SYSTEM_FONT_STACK}`
    for (const line of subLines) {
      ctx.fillText(line, textX, textY)
      textY += subLineHeight
    }
  }

  return y + rowH
}

/** Draw the carousel chrome — slide indicator pill, brand wordmark,
 *  bottom navigation arrows. */
function drawCarouselChrome(
  ctx: CanvasRenderingContext2D,
  width: number, height: number,
  carousel: NonNullable<ComparisonContent['carousel']>,
  theme: VariantTheme,
): void {
  const pad = width * 0.04

  // Slide indicator pill (top-left)
  const pillH = height * 0.038
  const pillPadX = pillH * 0.7
  const chromeFontSize = Math.round(width * 0.022)
  ctx.font = `600 ${chromeFontSize}px ${SYSTEM_FONT_STACK}`
  const tw = ctx.measureText(carousel.slideIndex).width
  const chevSize = chromeFontSize * 0.55
  const pillW = tw + pillPadX * 2 + chevSize * 4

  fillRoundRect(ctx, pad, pad, pillW, pillH, pillH / 2, theme.chromePillBg)

  ctx.strokeStyle = theme.chromeColor
  ctx.lineWidth = Math.max(1.5, width * 0.0025)
  ctx.lineCap = 'round'
  const cy = pad + pillH / 2

  // Left chevron
  ctx.beginPath()
  ctx.moveTo(pad + pillPadX + chevSize * 0.7, cy - chevSize * 0.5)
  ctx.lineTo(pad + pillPadX, cy)
  ctx.lineTo(pad + pillPadX + chevSize * 0.7, cy + chevSize * 0.5)
  ctx.stroke()

  // Indicator text
  ctx.fillStyle = theme.chromeColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(carousel.slideIndex, pad + pillW / 2, cy + 1)

  // Right chevron
  ctx.beginPath()
  ctx.moveTo(pad + pillW - pillPadX - chevSize * 0.7, cy - chevSize * 0.5)
  ctx.lineTo(pad + pillW - pillPadX, cy)
  ctx.lineTo(pad + pillW - pillPadX - chevSize * 0.7, cy + chevSize * 0.5)
  ctx.stroke()

  // Download icon top-right
  const dlSize = pillH
  const dlX = width - pad - dlSize
  fillRoundRect(ctx, dlX, pad, dlSize, dlSize, dlSize * 0.22, theme.chromePillBg)
  ctx.beginPath()
  ctx.moveTo(dlX + dlSize / 2, pad + dlSize * 0.30)
  ctx.lineTo(dlX + dlSize / 2, pad + dlSize * 0.65)
  ctx.moveTo(dlX + dlSize / 2 - dlSize * 0.18, pad + dlSize * 0.50)
  ctx.lineTo(dlX + dlSize / 2, pad + dlSize * 0.65)
  ctx.lineTo(dlX + dlSize / 2 + dlSize * 0.18, pad + dlSize * 0.50)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(dlX + dlSize * 0.28, pad + dlSize * 0.72)
  ctx.lineTo(dlX + dlSize * 0.72, pad + dlSize * 0.72)
  ctx.stroke()

  // Brand wordmark + domain (bottom-left)
  if (carousel.brandWordmark || carousel.brandDomain) {
    const brandSize = Math.round(width * 0.030)
    const domainSize = Math.round(width * 0.020)
    let by = height - pad - brandSize - (carousel.brandDomain ? domainSize * 1.3 : 0)
    if (carousel.brandWordmark) {
      ctx.fillStyle = theme.brandColor
      ctx.font = `700 ${brandSize}px ${SYSTEM_FONT_STACK}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(carousel.brandWordmark, pad, by)
      by += brandSize * 1.15
    }
    if (carousel.brandDomain) {
      ctx.fillStyle = theme.brandColor
      ctx.globalAlpha = 0.75
      ctx.font = `500 ${domainSize}px ${SYSTEM_FONT_STACK}`
      ctx.fillText(carousel.brandDomain, pad, by)
      ctx.globalAlpha = 1
    }
  }

  // Bottom-right side arrow (next slide indicator)
  const arrowSize = width * 0.045
  const arrowX = width - pad - arrowSize
  const arrowY = height - pad - arrowSize
  fillRoundRect(ctx, arrowX, arrowY, arrowSize, arrowSize, arrowSize * 0.22, theme.chromePillBg)
  ctx.strokeStyle = theme.chromeColor
  ctx.lineWidth = Math.max(1.5, width * 0.003)
  const acx = arrowX + arrowSize / 2
  const acy = arrowY + arrowSize / 2
  ctx.beginPath()
  ctx.moveTo(acx - arrowSize * 0.18, acy)
  ctx.lineTo(acx + arrowSize * 0.18, acy)
  ctx.moveTo(acx + arrowSize * 0.05, acy - arrowSize * 0.16)
  ctx.lineTo(acx + arrowSize * 0.20, acy)
  ctx.lineTo(acx + arrowSize * 0.05, acy + arrowSize * 0.16)
  ctx.stroke()
}

/** Main entry — draw the full comparison card onto the canvas context. */
export function drawComparisonCard(
  ctx: CanvasRenderingContext2D,
  width: number, height: number,
  variant: ComparisonCardVariant,
  content: ComparisonContent,
  sceneImage: HTMLImageElement | null,
): void {
  const theme = THEMES[variant]

  // Outer background (visible if scene is inset)
  ctx.fillStyle = theme.outerBg
  ctx.fillRect(0, 0, width, height)

  // Inset the scene panel slightly for breathing room
  const inset = width * 0.025
  const panelX = inset
  const panelY = inset
  const panelW = width - inset * 2
  const panelH = height - inset * 2

  // Draw photographic scene (or fallback gradient split)
  if (sceneImage) {
    drawImageCover(ctx, sceneImage, panelX, panelY, panelW, panelH, width * 0.012)
  } else {
    // Placeholder split — two solid halves so layout still shows during gen
    const radius = width * 0.012
    fillRoundRect(ctx, panelX, panelY, panelW / 2, panelH, { tl: radius, tr: 0, br: 0, bl: radius }, '#2A2A2A')
    fillRoundRect(ctx, panelX + panelW / 2, panelY, panelW / 2, panelH, { tl: 0, tr: radius, br: radius, bl: 0 }, '#22A34C')
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = `500 ${Math.round(width * 0.022)}px ${SYSTEM_FONT_STACK}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('— scene generating —', width / 2, panelY + panelH / 2)
  }

  // ── Side headers (THEM / US) ───────────────────────────────────────
  const headerFontSize = Math.round(width * 0.075)
  const headerY = panelY + panelH * 0.05
  drawSideHeader(
    ctx,
    panelX, headerY, panelW / 2,
    content.leftHeader ?? 'THEM',
    theme.leftHeaderText,
    headerFontSize,
  )
  drawSideHeader(
    ctx,
    panelX + panelW / 2, headerY, panelW / 2,
    content.rightHeader ?? 'US',
    theme.rightHeaderText,
    headerFontSize,
  )

  // ── Bullet rows ────────────────────────────────────────────────────
  // Bullets sit in the bottom ~40% of each side, stacked vertically.
  const bulletAreaTop = panelY + panelH * 0.58
  const bulletAreaH = panelH * 0.38
  const sidePadX = width * 0.025
  const colW = panelW / 2 - sidePadX * 1.5
  const colSpacing = bulletAreaH * 0.025

  // Estimate per-bullet height to vertically center
  const themCount = content.themBullets.length
  const usCount = content.usBullets.length
  const maxCount = Math.max(themCount, usCount, 1)
  const avgRowH = (bulletAreaH - colSpacing * (maxCount - 1)) / maxCount

  let yLeft = bulletAreaTop
  for (const b of content.themBullets.slice(0, 4)) {
    yLeft = drawBulletRow(
      ctx,
      panelX + sidePadX, yLeft, colW,
      b, 'them', theme, width,
    )
    yLeft += colSpacing
    if (yLeft > bulletAreaTop + bulletAreaH) break
    // Skip-guard — avoid drawing past the bottom
    void avgRowH
  }

  let yRight = bulletAreaTop
  for (const b of content.usBullets.slice(0, 4)) {
    yRight = drawBulletRow(
      ctx,
      panelX + panelW / 2 + sidePadX * 0.5, yRight, colW,
      b, 'us', theme, width,
    )
    yRight += colSpacing
    if (yRight > bulletAreaTop + bulletAreaH) break
  }

  // ── VS badge (center focal anchor) ─────────────────────────────────
  const vsRadius = width * 0.07
  drawVsBadge(
    ctx,
    panelX + panelW / 2,
    panelY + panelH / 2,
    vsRadius,
    content.vsBadge ?? 'VS',
    theme,
  )

  // ── Carousel chrome ────────────────────────────────────────────────
  if (content.carousel) {
    drawCarouselChrome(ctx, width, height, content.carousel, theme)
  }
}
