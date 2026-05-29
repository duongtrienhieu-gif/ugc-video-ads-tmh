// ── Device Chrome Presets (P12 authenticity overhaul) ──────────────────────
//
// Pixel-accurate phone chrome (status bar height, safe areas, notch /
// dynamic island geometry) for the three most-screenshotted devices on
// SEA mobile UGC. Captured from real screenshots at native resolution.
//
// All numbers are in px at our standard 1080×1920 portrait canvas.
// When canvas resolution changes, scale these proportionally to the
// canvas width.

export type DeviceId = 'iphone-15-pro' | 'pixel-8' | 'samsung-s24'

export interface DeviceChrome {
  id: DeviceId
  label: string
  /** Status bar total height (battery / signal / time row + above-notch area). */
  statusBarHeight: number
  /** Top safe-area below the status bar (gap before app header begins). */
  safeAreaTop: number
  /** Bottom safe-area (home indicator + edge). */
  safeAreaBottom: number
  /** Notch / dynamic island geometry. Pill rendered centered horizontally. */
  notch: {
    kind: 'dynamic-island' | 'notch' | 'punch-hole' | 'none'
    width: number
    height: number
    /** Y offset from the top edge of the canvas. */
    yOffset: number
  }
  /** Whether to render a thin home indicator at the bottom. */
  homeIndicator: boolean
}

export const IPHONE_15_PRO: DeviceChrome = {
  id: 'iphone-15-pro',
  label: 'iPhone 15 Pro',
  statusBarHeight: 56,
  safeAreaTop:     4,
  safeAreaBottom:  60,
  notch: {
    kind: 'dynamic-island',
    width: 132,
    height: 38,
    yOffset: 18,
  },
  homeIndicator: true,
}

export const PIXEL_8: DeviceChrome = {
  id: 'pixel-8',
  label: 'Pixel 8',
  statusBarHeight: 48,
  safeAreaTop:     0,
  safeAreaBottom:  46,
  notch: {
    kind: 'punch-hole',
    width: 28,
    height: 28,
    yOffset: 10,
  },
  homeIndicator: false,
}

export const SAMSUNG_S24: DeviceChrome = {
  id: 'samsung-s24',
  label: 'Samsung Galaxy S24',
  statusBarHeight: 48,
  safeAreaTop:     0,
  safeAreaBottom:  44,
  notch: {
    kind: 'punch-hole',
    width: 26,
    height: 26,
    yOffset: 12,
  },
  homeIndicator: false,
}

export const DEVICE_PRESETS: DeviceChrome[] = [IPHONE_15_PRO, PIXEL_8, SAMSUNG_S24]

export function findDeviceChrome(id: DeviceId): DeviceChrome {
  return DEVICE_PRESETS.find((d) => d.id === id) ?? IPHONE_15_PRO
}

/** Render the platform-agnostic device chrome (status bar bg, notch /
 *  dynamic island, home indicator) onto the given canvas context.
 *  Returns the Y position where app content should begin (status bar
 *  bottom + safe area top). */
export function renderDeviceChrome(
  ctx: CanvasRenderingContext2D,
  device: DeviceChrome,
  width: number,
  height: number,
  opts: {
    statusBarBg: string | null
    statusBarFg: string
    timeLabel: string
  },
): number {
  // Status bar background
  if (opts.statusBarBg) {
    ctx.fillStyle = opts.statusBarBg
    ctx.fillRect(0, 0, width, device.statusBarHeight)
  }

  // Time on left
  ctx.fillStyle = opts.statusBarFg
  ctx.font = '600 17px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(opts.timeLabel, 36, device.statusBarHeight / 2 + 2)

  // Right-side glyphs: signal · wifi · battery
  const rightEdge = width - 32
  const iconY = device.statusBarHeight / 2 + 4

  // Battery
  const batteryW = 28
  const batteryH = 12
  const batteryX = rightEdge - batteryW
  const batteryY = iconY - batteryH / 2
  ctx.strokeStyle = opts.statusBarFg
  ctx.lineWidth = 1.4
  ctx.strokeRect(batteryX, batteryY, batteryW, batteryH)
  ctx.fillStyle = opts.statusBarFg
  ctx.fillRect(rightEdge, batteryY + 3, 2, batteryH - 6)
  // 76% charge
  ctx.fillRect(batteryX + 2, batteryY + 2, (batteryW - 4) * 0.76, batteryH - 4)

  // Wifi arcs
  const wifiCx = batteryX - 16
  const wifiCy = iconY + 4
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath()
    ctx.arc(wifiCx, wifiCy, i * 4, Math.PI * 1.25, Math.PI * 1.75)
    ctx.stroke()
  }

  // Signal bars (4 ascending)
  const sigRight = wifiCx - 14
  const sigBarW = 3
  const sigGap = 2
  for (let i = 0; i < 4; i++) {
    const h = 4 + i * 2
    const x = sigRight - (3 - i) * (sigBarW + sigGap)
    ctx.fillRect(x, iconY + 4 - h, sigBarW, h)
  }

  // Notch / Dynamic Island / Punch-hole
  const cx = width / 2
  if (device.notch.kind === 'dynamic-island') {
    ctx.fillStyle = '#000000'
    roundedFill(ctx, cx - device.notch.width / 2, device.notch.yOffset, device.notch.width, device.notch.height, device.notch.height / 2)
  } else if (device.notch.kind === 'punch-hole') {
    ctx.fillStyle = '#000000'
    ctx.beginPath()
    ctx.arc(cx, device.notch.yOffset + device.notch.height / 2, device.notch.width / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  // Home indicator (drawn at bottom — caller renders into footer area; we
  // just render the bar). Skip if device.homeIndicator is false.
  if (device.homeIndicator) {
    const barW = 280
    const barH = 6
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    roundedFill(ctx, (width - barW) / 2, height - 22, barW, barH, barH / 2)
  }

  return device.statusBarHeight + device.safeAreaTop
}

function roundedFill(
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
  ctx.fill()
}
