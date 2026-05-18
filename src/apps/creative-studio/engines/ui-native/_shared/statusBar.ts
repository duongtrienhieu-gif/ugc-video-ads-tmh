// ── Status Bar Renderer (P5) ────────────────────────────────────────────────
//
// Renders an iOS- or Android-style phone status bar at the top of the
// canvas. Pixel-cheap to draw (vector shapes only — no atomic AI calls).
//
// Authenticity hooks (per types/uiNative.ts UINativeAuthenticity):
//   • Real-looking time (not 00:00 / 12:00) — caller passes timeLabel
//   • Battery + signal + wifi glyphs always present
//   • iOS notch / dynamic island OR Android-style corner cut

import type { StatusBarStyle } from '../../../types/uiNative'

export interface StatusBarRenderOptions {
  style: StatusBarStyle
  /** Foreground color (text + icons). */
  fg: string
  /** Background fill. Pass null for transparent. */
  bg: string | null
  /** Time label, eg "14:23" or "9:41". */
  timeLabel: string
  /** Canvas width (status bar spans full width). */
  width: number
}

const STATUS_BAR_HEIGHT = 44

/** Render the status bar starting at y=0. Returns the y after the bar. */
export function renderStatusBar(
  ctx: CanvasRenderingContext2D,
  opts: StatusBarRenderOptions,
): number {
  const { style, fg, bg, timeLabel, width } = opts

  if (bg) {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, STATUS_BAR_HEIGHT)
  }

  ctx.fillStyle = fg
  ctx.strokeStyle = fg

  // Left side — time label
  ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(timeLabel, style === 'ios' ? 32 : 16, STATUS_BAR_HEIGHT / 2)

  // Right side — signal + wifi + battery glyphs
  const rightEdge = width - 16
  const iconBaseline = STATUS_BAR_HEIGHT / 2

  // Battery glyph
  const batteryRight = rightEdge
  const batteryW = 26
  const batteryH = 12
  const batteryX = batteryRight - batteryW
  const batteryY = iconBaseline - batteryH / 2
  ctx.lineWidth = 1.2
  ctx.strokeRect(batteryX, batteryY, batteryW, batteryH)
  ctx.fillRect(batteryRight, batteryY + 3, 2, batteryH - 6)
  // 78% fill
  ctx.fillRect(batteryX + 2, batteryY + 2, (batteryW - 4) * 0.78, batteryH - 4)

  // Wifi glyph (three arcs from a point)
  const wifiCx = batteryX - 14
  const wifiCy = iconBaseline + 4
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath()
    ctx.arc(wifiCx, wifiCy, i * 4, Math.PI * 1.25, Math.PI * 1.75)
    ctx.stroke()
  }

  // Signal bars (4 ascending)
  const sigRight = wifiCx - 12
  const sigBarW = 3
  const sigGap = 2
  for (let i = 0; i < 4; i++) {
    const h = 4 + i * 2
    const x = sigRight - (3 - i) * (sigBarW + sigGap)
    ctx.fillRect(x, iconBaseline + 4 - h, sigBarW, h)
  }

  if (style === 'ios') {
    // Dynamic island — centered black pill
    const islandW = 110
    const islandH = 24
    const islandX = (width - islandW) / 2
    const islandY = (STATUS_BAR_HEIGHT - islandH) / 2
    ctx.fillStyle = '#000000'
    roundedRect(ctx, islandX, islandY, islandW, islandH, islandH / 2)
    ctx.fill()
  }

  return STATUS_BAR_HEIGHT
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}
