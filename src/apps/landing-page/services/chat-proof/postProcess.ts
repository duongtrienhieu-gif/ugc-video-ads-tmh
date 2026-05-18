// ─────────────────────────────────────────────────────────────────────
// Screenshot realism post-process — turns a crisp canvas render into
// something that looks like a phone screenshot.
//
// Pipeline:
//   1. Slight gaussian blur (0.4-0.8px) — simulates screen softness
//   2. Tiny anti-alias jitter — breaks Figma-perfect edges
//   3. JPEG re-encode at quality 0.82-0.91 — introduces compression
//      artifacts and color banding typical of phone screenshots.
// ─────────────────────────────────────────────────────────────────────

type Intensity = 'subtle' | 'medium' | 'heavy'

interface PostProcessConfig {
  blurPx: number
  jpegQuality: number
  contrast: number
}

const CONFIGS: Record<Intensity, PostProcessConfig> = {
  subtle: { blurPx: 0.3, jpegQuality: 0.92, contrast: 1.02 },
  medium: { blurPx: 0.6, jpegQuality: 0.86, contrast: 1.05 },
  heavy:  { blurPx: 1.0, jpegQuality: 0.78, contrast: 1.08 },
}

/** Post-process a finished canvas — applies blur + jpeg recompression.
 *  Returns the encoded blob ready for saveAsset(). */
export async function postProcess(
  canvas: HTMLCanvasElement,
  intensity: Intensity = 'medium',
): Promise<{ blob: Blob; mimeType: string }> {
  const cfg = CONFIGS[intensity]

  // Step 1+2 — apply filter via temporary canvas (uses GPU-accelerated
  // CanvasRenderingContext2D.filter when supported)
  const filtered = document.createElement('canvas')
  filtered.width = canvas.width
  filtered.height = canvas.height
  const fctx = filtered.getContext('2d')
  if (!fctx) throw new Error('Canvas 2D context unavailable')
  fctx.filter = `blur(${cfg.blurPx}px) contrast(${cfg.contrast})`
  fctx.drawImage(canvas, 0, 0)
  fctx.filter = 'none'

  // Step 3 — JPEG recompress
  const blob: Blob = await new Promise((resolve, reject) => {
    filtered.toBlob(
      (b) => b ? resolve(b) : reject(new Error('toBlob returned null')),
      'image/jpeg',
      cfg.jpegQuality,
    )
  })

  return { blob, mimeType: 'image/jpeg' }
}
