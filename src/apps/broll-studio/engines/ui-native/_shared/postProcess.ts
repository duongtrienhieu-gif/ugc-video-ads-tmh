// ── UI-Native Post-process Pipeline (P5) ────────────────────────────────────
//
// Anti-Figma processing. Real screenshots are NOT pixel-perfect — they
// have:
//   • slight crop drift (a few pixels off all sides)
//   • visible JPEG compression artifacts from messaging app upload
//   • slight color shift from device color science
//
// Removing these gives away the synthetic origin. This pipeline applies
// just enough imperfection to pass at-a-glance authenticity without
// destroying readability.

import { canvasToBlob, createCanvas } from './canvas'
import type { PostProcessIntensity } from '../../../types/uiNative'

export interface PostProcessConfig {
  intensity: PostProcessIntensity
  /** Re-encode quality (0-1). Lower = more JPEG ringing. */
  jpegQuality?: number
  /** Max crop drift in pixels per side. */
  maxCropDriftPx?: number
}

const INTENSITY_DEFAULTS: Record<PostProcessIntensity, Required<Omit<PostProcessConfig, 'intensity'>>> = {
  subtle: { jpegQuality: 0.90, maxCropDriftPx: 4 },
  medium: { jpegQuality: 0.82, maxCropDriftPx: 8 },
  heavy:  { jpegQuality: 0.72, maxCropDriftPx: 14 },
}

/**
 * Apply post-process to a finished canvas. Returns a Blob ready for
 * saveAsset. Always JPEG output — PNG screenshots from a phone are
 * vanishingly rare and immediately flag as Figma export.
 */
export async function applyPostProcess(
  canvas: HTMLCanvasElement,
  config: PostProcessConfig,
  seed: string = 'default',
): Promise<Blob> {
  const settings = { ...INTENSITY_DEFAULTS[config.intensity], ...config }
  const rng = seededRng(seed)

  const driftLeft   = Math.floor(rng() * settings.maxCropDriftPx)
  const driftTop    = Math.floor(rng() * settings.maxCropDriftPx)
  const driftRight  = Math.floor(rng() * settings.maxCropDriftPx)
  const driftBottom = Math.floor(rng() * settings.maxCropDriftPx)

  const finalW = canvas.width - driftLeft - driftRight
  const finalH = canvas.height - driftTop - driftBottom

  // Crop to drifted bounds
  const { canvas: cropCanvas, ctx } = createCanvas({ width: finalW, height: finalH })
  ctx.drawImage(canvas, driftLeft, driftTop, finalW, finalH, 0, 0, finalW, finalH)

  return await canvasToBlob(cropCanvas, 'image/jpeg', settings.jpegQuality)
}

function seededRng(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let s = h >>> 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
