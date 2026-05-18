// ── Engine-Neutral Canvas Helpers (P9 — promoted from ui-native/_shared) ────
//
// Thin Canvas API utilities shared across all engine groups
// (ui-native chat / review / comment templates, designed-graphic
// infographic / cta-banner templates, future templates). Browser-only —
// relies on document.createElement('canvas'), no node fallback.
//
// Was at engines/ui-native/_shared/canvas.ts in P5–P8 (which forced a
// cross-engine import from designed-graphic templates and violated the
// engine-isolation rule). P9 hoists it to shared/canvas/ so all three
// engine groups can import without crossing each other's folders.

export interface CanvasSize {
  width: number
  height: number
}

/** Create a fresh canvas at the given size with a 2D context. */
export function createCanvas(size: CanvasSize): {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
} {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('[ui-native] 2D canvas context unavailable')
  // Subpixel-aware text rendering — chat UI needs crisp text
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return { canvas, ctx }
}

/** Load an image from a URL — returns once decoded. */
export async function loadImage(url: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`[ui-native] image load failed: ${url}`))
    img.src = url
  })
}

/** Draw a circular avatar from an HTMLImageElement, clipped to a circle. */
export function drawCircularAvatar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  radius: number,
): void {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2)
  ctx.restore()
}

/** Draw a rounded rectangle path (clip / fill / stroke caller-controlled). */
export function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
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

/** Measure + word-wrap text against a max width, returning visual lines. */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const paragraphs = text.split('\n')
  const out: string[] = []

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) { out.push(''); continue }
    const words = paragraph.split(/\s+/)
    let line = ''
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (ctx.measureText(next).width <= maxWidth) {
        line = next
      } else {
        if (line) out.push(line)
        line = word
      }
    }
    if (line) out.push(line)
  }

  return out
}

/** Render multi-line text from wrapText output. Returns final y cursor. */
export function drawWrappedLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
): number {
  let cursor = y
  for (const line of lines) {
    ctx.fillText(line, x, cursor)
    cursor += lineHeight
  }
  return cursor
}

/** Convert a canvas to a Blob (defaulting to image/jpeg with given quality). */
export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string = 'image/jpeg',
  quality: number = 0.92,
): Promise<Blob> {
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('[ui-native] canvas.toBlob returned null'))
      },
      type,
      quality,
    )
  })
}
