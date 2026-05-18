// ─────────────────────────────────────────────────────────────────────
// Background renderers — fill the entire canvas with the requested
// background style. Drawn BEFORE the phone mockup; everything else
// (phone frame, chat body, shadow) sits on top.
// ─────────────────────────────────────────────────────────────────────

import type { ChatProofBackground } from './types'

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number, height: number,
  bg: ChatProofBackground,
): void {
  switch (bg) {
    case 'dark-gradient':    return drawDarkGradient(ctx, width, height)
    case 'ad-creative-grid': return drawAdCreativeGrid(ctx, width, height)
    case 'soft-neutral':     return drawSoftNeutral(ctx, width, height)
    case 'minimal-light':    return drawMinimalLight(ctx, width, height)
  }
}

function drawDarkGradient(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.8)
  grad.addColorStop(0, '#1a1a2e')
  grad.addColorStop(1, '#000000')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // Subtle starfield
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  let seed = 12345
  for (let i = 0; i < 80; i++) {
    seed = (seed * 9301 + 49297) % 233280
    const x = (seed / 233280) * w
    seed = (seed * 9301 + 49297) % 233280
    const y = (seed / 233280) * h
    seed = (seed * 9301 + 49297) % 233280
    const r = (seed / 233280) * 1.4 + 0.3
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Reference image style — black bg with diagonal yellow/green
 *  decorative line accents. Mimics the "Reels" Instagram screenshot. */
function drawAdCreativeGrid(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, w, h)

  // Subtle starfield
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  let seed = 54321
  for (let i = 0; i < 60; i++) {
    seed = (seed * 9301 + 49297) % 233280
    const x = (seed / 233280) * w
    seed = (seed * 9301 + 49297) % 233280
    const y = (seed / 233280) * h
    ctx.fillRect(x, y, 1.5, 1.5)
  }

  // Diagonal accent lines — yellow + green
  ctx.save()
  ctx.translate(w * 0.5, h * 0.5)
  ctx.rotate(-Math.PI / 6)
  ctx.translate(-w * 0.5, -h * 0.5)

  const lineSpec: Array<{ color: string; xOffset: number; thickness: number; opacity: number }> = [
    { color: '#FDE047', xOffset: -w * 0.32, thickness: 3, opacity: 0.9 },
    { color: '#22D67A', xOffset: -w * 0.12, thickness: 4, opacity: 0.85 },
    { color: '#FDE047', xOffset:  w * 0.18, thickness: 3, opacity: 0.7 },
    { color: '#22D67A', xOffset:  w * 0.42, thickness: 4, opacity: 0.85 },
  ]
  for (const ln of lineSpec) {
    ctx.globalAlpha = ln.opacity
    ctx.strokeStyle = ln.color
    ctx.lineWidth = ln.thickness
    ctx.beginPath()
    ctx.moveTo(w * 0.5 + ln.xOffset, -h * 0.3)
    ctx.lineTo(w * 0.5 + ln.xOffset, h * 1.3)
    ctx.stroke()
  }
  ctx.restore()
  ctx.globalAlpha = 1
}

function drawSoftNeutral(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#F5EEE3')
  grad.addColorStop(1, '#E6D9C4')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
}

function drawMinimalLight(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#FAFAFA'
  ctx.fillRect(0, 0, w, h)
  // Subtle vignette
  const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.3, w * 0.5, h * 0.5, w * 0.8)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,0.05)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
}
