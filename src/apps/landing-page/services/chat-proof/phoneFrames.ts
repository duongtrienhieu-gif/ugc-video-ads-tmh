// ─────────────────────────────────────────────────────────────────────
// Phone frame renderers — draw the bezel + notch / camera cutout around
// the chat-body region. Returns the inner rect where the screen content
// (status bar + header + chat body) should be drawn.
//
// Frames are drawn purely with canvas primitives — no external images,
// keeps the bundle small and the look deterministic.
// ─────────────────────────────────────────────────────────────────────

import { fillRoundRect, roundRectPath } from './canvasUtils'
import type { PhoneFrame } from './types'

export interface ScreenRect {
  x: number
  y: number
  width: number
  height: number
  /** Corner radius of the inner screen — chat content respects this. */
  screenRadius: number
  /** Where the status bar (with notch / pill) starts. */
  statusBarY: number
  /** Vertical reserved height for the status bar including notch. */
  statusBarHeight: number
}

/** Frame thickness as a fraction of phone width. */
const BEZEL_FRAC = 0.025

/** Draw a phone frame centered at (cx, cy) with the given outer width.
 *  Returns the inner screen rect for content rendering. */
export function drawPhoneFrame(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  outerWidth: number,
  frame: PhoneFrame,
): ScreenRect {
  // iPhone aspect ≈ 19.5:9 → height = width * 2.165
  const aspectRatio = frame === 'android-samsung' ? 2.10 : 2.165
  const outerHeight = outerWidth * aspectRatio
  const x = cx - outerWidth / 2
  const y = cy - outerHeight / 2

  const bezel = outerWidth * BEZEL_FRAC
  const outerRadius = outerWidth * 0.13
  const innerRadius = outerRadius - bezel

  // Frame body (slightly metallic look via gradient)
  const frameColor = frame === 'iphone-white' ? '#E8E8E8' : '#0A0A0A'
  const frameHighlight = frame === 'iphone-white' ? '#FFFFFF' : '#2A2A2A'

  // Outer shadow under phone
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = outerWidth * 0.12
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = outerHeight * 0.03
  fillRoundRect(ctx, x, y, outerWidth, outerHeight, outerRadius, frameColor)
  ctx.restore()

  // Bezel highlight ring
  ctx.save()
  roundRectPath(ctx, x + bezel * 0.4, y + bezel * 0.4, outerWidth - bezel * 0.8, outerHeight - bezel * 0.8, outerRadius - bezel * 0.4)
  ctx.strokeStyle = frameHighlight
  ctx.lineWidth = bezel * 0.3
  ctx.stroke()
  ctx.restore()

  // Inner screen background (default black — actual content draws over)
  const screenX = x + bezel
  const screenY = y + bezel
  const screenW = outerWidth - bezel * 2
  const screenH = outerHeight - bezel * 2
  fillRoundRect(ctx, screenX, screenY, screenW, screenH, innerRadius, '#000')

  // Status bar zone (where notch / camera sits)
  const statusBarHeight = frame === 'android-samsung'
    ? screenH * 0.045
    : screenH * 0.055

  // Draw notch / pill / cutout
  if (frame === 'android-samsung') {
    // Center hole-punch camera dot
    const dotR = screenW * 0.018
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.arc(screenX + screenW / 2, screenY + statusBarHeight * 0.55, dotR, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // iPhone Dynamic Island pill
    const pillW = screenW * 0.32
    const pillH = screenH * 0.028
    const pillX = screenX + (screenW - pillW) / 2
    const pillY = screenY + screenH * 0.012
    fillRoundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2, '#000')
  }

  return {
    x: screenX,
    y: screenY,
    width: screenW,
    height: screenH,
    screenRadius: innerRadius,
    statusBarY: screenY,
    statusBarHeight,
  }
}

/** Draw a partial-crop "screenshot edge" — used by layout B (no full
 *  phone frame, just a soft top / bottom edge as if cropped from a real
 *  screenshot). Returns the same ScreenRect contract so template code
 *  can stay symmetrical. */
export function drawScreenshotCrop(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  screenWidth: number, screenHeight: number,
): ScreenRect {
  const x = cx - screenWidth / 2
  const y = cy - screenHeight / 2

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = screenWidth * 0.06
  ctx.shadowOffsetY = screenWidth * 0.015
  fillRoundRect(ctx, x, y, screenWidth, screenHeight, 12, '#000')
  ctx.restore()

  return {
    x,
    y,
    width: screenWidth,
    height: screenHeight,
    screenRadius: 12,
    statusBarY: y,
    statusBarHeight: screenHeight * 0.05,
  }
}
