// ── Authenticity Post-Process Pipeline (P12 — replaces P5 postProcess) ─────
//
// Multi-stage post-process that takes a freshly-rendered "Figma clean"
// canvas and pushes it toward "real mobile screenshot":
//
//   1. CROP DRIFT     — slight off-pixel crop per side (4-14px), same
//                       as the P5 pipeline that ships today
//   2. GAUSSIAN BLUR  — 0.3-0.5px CSS filter applied while drawing the
//                       cropped image onto an intermediate canvas;
//                       breaks Figma-perfect edge sharpness without
//                       killing legibility
//   3. CHROMA NOISE   — getImageData → per-channel noise ±2..±5
//                       perturbation; emulates ISO sensor noise + JPEG
//                       chroma subsampling artifacts
//   4. JPEG RECOMPRESS — canvasToBlob with low quality (0.74-0.82);
//                       baked-in ringing + blocking
//
// Each stage is intensity-scaled so callers can dial it down for
// designed-graphic (which wants clean) vs ui-native (which wants
// authentic).

import { canvasToBlob, createCanvas } from '../../../shared/canvas'

export type AuthenticityIntensity = 'subtle' | 'medium' | 'heavy'

export interface AuthenticityConfig {
  intensity: AuthenticityIntensity
  /** Override JPEG quality (0-1). Defaults from intensity. */
  jpegQuality?: number
  /** Override max crop drift in px. Defaults from intensity. */
  maxCropDriftPx?: number
  /** Override gaussian blur radius in px. 0 disables. */
  blurPx?: number
  /** Override chroma noise amplitude (per-channel ±). 0 disables. */
  chromaNoise?: number
}

const INTENSITY_DEFAULTS: Record<AuthenticityIntensity, Required<Omit<AuthenticityConfig, 'intensity'>>> = {
  subtle: { jpegQuality: 0.88, maxCropDriftPx: 4,  blurPx: 0.25, chromaNoise: 2 },
  medium: { jpegQuality: 0.80, maxCropDriftPx: 8,  blurPx: 0.40, chromaNoise: 4 },
  heavy:  { jpegQuality: 0.72, maxCropDriftPx: 14, blurPx: 0.55, chromaNoise: 6 },
}

/**
 * Run the full authenticity pipeline on a rendered canvas. Returns a
 * Blob ready for saveAsset. Always JPEG output.
 */
export async function applyAuthenticityPipeline(
  canvas: HTMLCanvasElement,
  config: AuthenticityConfig,
  seed: string = 'default',
): Promise<Blob> {
  const settings = { ...INTENSITY_DEFAULTS[config.intensity], ...config }
  const rng = seededRng(seed)

  // ── Stage 1: crop drift ─────────────────────────────────────────
  const dL = Math.floor(rng() * settings.maxCropDriftPx)
  const dT = Math.floor(rng() * settings.maxCropDriftPx)
  const dR = Math.floor(rng() * settings.maxCropDriftPx)
  const dB = Math.floor(rng() * settings.maxCropDriftPx)
  const cropW = canvas.width - dL - dR
  const cropH = canvas.height - dT - dB

  // ── Stage 2: gaussian blur (via ctx.filter while compositing) ───
  const { canvas: stage2, ctx: ctx2 } = createCanvas({ width: cropW, height: cropH })
  if (settings.blurPx > 0) {
    // ctx.filter is supported on all modern browser canvases
    ctx2.filter = `blur(${settings.blurPx}px)`
  }
  ctx2.drawImage(canvas, dL, dT, cropW, cropH, 0, 0, cropW, cropH)
  ctx2.filter = 'none'

  // ── Stage 3: chroma noise (per-channel jitter) ──────────────────
  if (settings.chromaNoise > 0) {
    try {
      const img = ctx2.getImageData(0, 0, cropW, cropH)
      const data = img.data
      const amp = settings.chromaNoise
      const noiseRng = seededRng(`${seed}_noise`)
      // Sample every 3rd pixel to keep it fast — visually
      // indistinguishable from per-pixel noise at typical sizes.
      for (let i = 0; i < data.length; i += 12) {
        const r = noiseRng()
        const g = noiseRng()
        const b = noiseRng()
        data[i]     = clampByte(data[i]     + (r * 2 - 1) * amp)
        data[i + 1] = clampByte(data[i + 1] + (g * 2 - 1) * amp)
        data[i + 2] = clampByte(data[i + 2] + (b * 2 - 1) * amp)
      }
      ctx2.putImageData(img, 0, 0)
    } catch {
      // getImageData can throw on tainted canvas. Skip silently —
      // the result is still authentic-enough.
    }
  }

  // ── Stage 4: JPEG recompression ─────────────────────────────────
  return await canvasToBlob(stage2, 'image/jpeg', settings.jpegQuality)
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0
}

function seededRng(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  let s = h >>> 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
