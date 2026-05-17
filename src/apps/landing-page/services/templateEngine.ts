// ── templateEngine.ts — Phase 3 SCAFFOLDING ────────────────────────────────
//
// Canvas-based local rendering for template_composed / derived_asset image
// types. Replaces the legacy "render every screenshot via KIE GPT-4o" path.
//
// Architecture:
//   1. Each composer (whatsappComposer, shopeeComposer, ...) is a pure
//      function: (CanvasRenderingContext2D, ComposerParams) => Promise<void>
//   2. composeToBlob() owns the canvas lifecycle: creates a headless
//      OffscreenCanvas (preferred) or DOM canvas, calls the composer,
//      then exports as PNG/JPEG Blob.
//   3. Optional saveToAssetStore() uploads the Blob to Supabase via the
//      existing saveAsset() helper and returns "asset:xxx" — same shape as
//      the AI render path so downstream code (SectionCard) sees no diff.
//
// Phase 3 ships the engine + the whatsappComposer ONLY. No consumer wires
// these into generateImages.ts yet. Phase 6 will plug them in behind the
// ENABLE_HYBRID_RENDER feature flag.

import { saveAsset } from '../../../utils/assetStore'

// ── Public types ────────────────────────────────────────────────────────────

/** A composer is a pure draw function — no I/O, no state. */
export interface Composer<TParams> {
  /** Stable id used by CompositionConfig.composer. */
  id: string
  /** Default canvas dimensions if caller doesn't specify. */
  defaultSize: { width: number; height: number }
  /** Draw the asset onto the given 2D context. May be async to allow image
   *  loading (e.g. product packshot fetched from Supabase signed URL). */
  draw(ctx: CanvasRenderingContext2D, params: TParams, opts: { width: number; height: number }): Promise<void>
}

export interface ComposeOptions {
  /** Canvas width in pixels. Defaults to composer.defaultSize.width. */
  width?: number
  /** Canvas height in pixels. Defaults to composer.defaultSize.height. */
  height?: number
  /** Output format. PNG = lossless (sharp). JPEG = compressed (mimics
   *  authentic phone screenshot artifacts). */
  format?: 'png' | 'jpeg'
  /** JPEG quality 0..1. Ignored for PNG. Default 0.85 — close to real
   *  phone-grade compression. */
  quality?: number
  /** Optional pixel scale — render at 2x then downscale for sharper text. */
  pixelRatio?: number
}

// ── Canvas helpers ─────────────────────────────────────────────────────────

/**
 * Create a 2D rendering context. Uses OffscreenCanvas when available
 * (faster + no DOM mount), falls back to a hidden canvas element.
 */
function createContext(
  width: number,
  height: number,
): { ctx: CanvasRenderingContext2D; canvas: HTMLCanvasElement | OffscreenCanvas } {
  // Prefer OffscreenCanvas — Chrome/Edge support, no DOM cost
  if (typeof OffscreenCanvas !== 'undefined') {
    const off = new OffscreenCanvas(width, height)
    const ctx = off.getContext('2d') as unknown as CanvasRenderingContext2D | null
    if (ctx) return { ctx, canvas: off }
  }
  // Fallback — DOM canvas. Not appended to document = invisible.
  const dom = document.createElement('canvas')
  dom.width = width
  dom.height = height
  const ctx = dom.getContext('2d')
  if (!ctx) throw new Error('templateEngine: cannot acquire 2D context')
  return { ctx, canvas: dom }
}

/** Convert canvas → Blob across both OffscreenCanvas + HTMLCanvasElement. */
async function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  format: 'png' | 'jpeg',
  quality: number,
): Promise<Blob> {
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'

  // OffscreenCanvas has convertToBlob (async, native)
  if ('convertToBlob' in canvas && typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type: mimeType, quality })
  }

  // DOM canvas — toBlob is async via callback
  const dom = canvas as HTMLCanvasElement
  return new Promise<Blob>((resolve, reject) => {
    dom.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))),
      mimeType,
      quality,
    )
  })
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Run a composer against a canvas and return the rendered Blob.
 * Does NOT upload to Supabase — caller decides whether to persist.
 */
export async function composeToBlob<TParams>(
  composer: Composer<TParams>,
  params: TParams,
  opts: ComposeOptions = {},
): Promise<Blob> {
  const w = opts.width ?? composer.defaultSize.width
  const h = opts.height ?? composer.defaultSize.height
  const scale = opts.pixelRatio ?? 1
  const format = opts.format ?? 'jpeg'
  const quality = opts.quality ?? 0.85

  // Render at scale × target size for crisper text, then export at native.
  const { ctx, canvas } = createContext(w * scale, h * scale)
  ctx.scale(scale, scale)
  await composer.draw(ctx, params, { width: w, height: h })

  return canvasToBlob(canvas, format, quality)
}

/**
 * Compose + upload to Supabase asset store. Returns "asset:xxx" — same
 * shape as the AI render path so generateImages.ts can treat composed
 * outputs identically to AI outputs.
 */
export async function composeAndStore<TParams>(
  composer: Composer<TParams>,
  params: TParams,
  opts: ComposeOptions = {},
): Promise<string> {
  const blob = await composeToBlob(composer, params, opts)
  const mime = blob.type || (opts.format === 'png' ? 'image/png' : 'image/jpeg')
  return saveAsset(blob, mime)
}

// ── Shared drawing helpers (used by composers) ─────────────────────────────

/** Draw a rounded rect path on the current ctx. */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

/** Wrap text inside a max-width box, returning an array of lines. */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

/** Load an image (asset:xxx ref or http url) into an HTMLImageElement. */
export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 60)}`))
    img.src = src
  })
}

/** Deterministic 0..1 PRNG seeded by a string — for stable "noise" in composers. */
export function seededRand(seed: string): () => number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h = (h ^ seed.charCodeAt(i)) >>> 0
    h = ((h * 0x01000193) >>> 0)
  }
  return () => {
    h = ((h * 1664525) + 1013904223) >>> 0
    return (h & 0xffffffff) / 0x100000000
  }
}
