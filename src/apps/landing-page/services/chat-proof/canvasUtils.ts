// ─────────────────────────────────────────────────────────────────────
// Canvas drawing primitives used by every chat template.
//
// Centralizes rounded-rect / text-wrapping / soft-shadow / image-clip so
// each platform template stays focused on layout, not drawing math.
// ─────────────────────────────────────────────────────────────────────

/** Draw a rounded rectangle path. Caller decides fill / stroke. */
export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number | { tl: number; tr: number; br: number; bl: number },
): void {
  const radii = typeof r === 'number'
    ? { tl: r, tr: r, br: r, bl: r }
    : r
  ctx.beginPath()
  ctx.moveTo(x + radii.tl, y)
  ctx.lineTo(x + w - radii.tr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radii.tr)
  ctx.lineTo(x + w, y + h - radii.br)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radii.br, y + h)
  ctx.lineTo(x + radii.bl, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radii.bl)
  ctx.lineTo(x, y + radii.tl)
  ctx.quadraticCurveTo(x, y, x + radii.tl, y)
  ctx.closePath()
}

export function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number | { tl: number; tr: number; br: number; bl: number },
  fill: string,
): void {
  roundRectPath(ctx, x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
}

/** Wrap text into lines that fit `maxWidth`. Splits on whitespace and
 *  preserves explicit \n breaks. Returns the wrapped lines. */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const out: string[] = []
  const paragraphs = text.split('\n')
  for (const para of paragraphs) {
    if (para === '') { out.push(''); continue }
    const words = para.split(' ')
    let line = ''
    for (const word of words) {
      const trial = line ? `${line} ${word}` : word
      const w = ctx.measureText(trial).width
      if (w > maxWidth && line) {
        out.push(line)
        line = word
      } else {
        line = trial
      }
    }
    if (line) out.push(line)
  }
  return out
}

/** Draw an HTMLImageElement scaled+cropped to fill (x,y,w,h) with rounded
 *  corners. cover-fit (centered crop) — never stretches. */
export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
  radius = 0,
): void {
  ctx.save()
  if (radius > 0) {
    roundRectPath(ctx, x, y, w, h, radius)
    ctx.clip()
  }
  const ir = img.width / img.height
  const tr = w / h
  let sx = 0, sy = 0, sw = img.width, sh = img.height
  if (ir > tr) {
    // image is wider — crop sides
    sw = img.height * tr
    sx = (img.width - sw) / 2
  } else {
    sh = img.width / tr
    sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
  ctx.restore()
}

/** Soft drop-shadow under (x,y,w,h). Caller is responsible for drawing
 *  the actual content afterward. */
export function drawSoftShadow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  radius: number,
  blur = 40,
  offsetY = 20,
  color = 'rgba(0,0,0,0.35)',
): void {
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = blur
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = offsetY
  fillRoundRect(ctx, x, y, w, h, radius, '#000')
  ctx.restore()
}

/** Load an HTMLImageElement from a URL (handles cross-origin). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 80)}`))
    img.src = src
  })
}

/** Deterministic color from a string — used for avatar backgrounds when
 *  no custom hint is provided. */
export function colorFromString(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const palette = [
    '#34B7F1', '#25D366', '#F0B90B', '#E91E63', '#9C27B0',
    '#3F51B5', '#FF9800', '#009688', '#FF5722', '#795548',
  ]
  return palette[h % palette.length]
}

/** Draw a circular avatar with initials. */
export function drawAvatar(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  name: string,
  bgColor?: string,
): void {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fillStyle = bgColor ?? colorFromString(name)
  ctx.fill()

  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  ctx.fillStyle = '#fff'
  ctx.font = `600 ${radius}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(initials, cx, cy + radius * 0.05)
  ctx.restore()
}

/** Approximate iOS / system font stack — falls back gracefully. */
export const SYSTEM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
