// ── Local Heuristic QC (P7) ─────────────────────────────────────────────────
//
// Synchronous checks on a rendered blob — no network, no AI. Each rule
// is cheap (bytes / dimensions / JPEG marker / SOI signature) and runs
// before the optional Gemini Vision tier. Goal: catch obvious failures
// (corrupt blob, PNG masquerading as screenshot, wrong canvas size,
// banned aesthetic flags) without paying for vision.

import type { QCIssue } from '../../types/qc'

export interface LocalHeuristicInput {
  /** The rendered blob about to be saved as the final asset. */
  blob: Blob
  /** Expected dimensions per the module's template. */
  expectedWidth: number
  expectedHeight: number
  /** Whether the module requires JPEG output (UI-native always does). */
  requireJpeg: boolean
  /** Authenticity rules pulled from the module (banned aesthetic strings). */
  bannedAesthetics?: string[]
  /** Resolved canvas to peek at the pixels (optional but recommended). */
  canvasPeek?: HTMLCanvasElement | null
}

/** A reasonable lower bound — anything smaller is almost certainly broken. */
const MIN_BYTES = 8 * 1024  // 8 KB
/** Upper bound — anything bigger is probably a PNG masquerading. */
const MAX_BYTES = 5 * 1024 * 1024  // 5 MB
/** Tolerance for crop drift (post-process intentionally shrinks). */
const CROP_DRIFT_TOLERANCE_PX = 30

/**
 * Run all local heuristics against the rendered blob. Returns a list of
 * issues. Empty list = all checks passed. Synchronous after blob bytes
 * are read.
 */
export async function runLocalHeuristics(
  input: LocalHeuristicInput,
): Promise<QCIssue[]> {
  const issues: QCIssue[] = []

  // Rule 1 — minimum size
  if (input.blob.size < MIN_BYTES) {
    issues.push({
      code: 'BLOB_TOO_SMALL',
      message: `Output blob is ${input.blob.size}B — under the ${MIN_BYTES}B floor, likely corrupt`,
      severity: 'error',
      tier: 'local',
    })
  }

  // Rule 2 — maximum size
  if (input.blob.size > MAX_BYTES) {
    issues.push({
      code: 'BLOB_TOO_LARGE',
      message: `Output blob is ${(input.blob.size / 1024 / 1024).toFixed(1)}MB — likely raw PNG, not a compressed screenshot`,
      severity: 'warning',
      tier: 'local',
    })
  }

  // Rule 3 — MIME type matches required encoding
  if (input.requireJpeg && input.blob.type && !input.blob.type.includes('jpeg')) {
    issues.push({
      code: 'WRONG_ENCODING',
      message: `Output is ${input.blob.type} — UI-native modules require JPEG to match real-screenshot compression`,
      severity: 'error',
      tier: 'local',
    })
  }

  // Rule 4 — JPEG signature peek (first two bytes 0xFF 0xD8)
  if (input.requireJpeg) {
    const head = await readFirstBytes(input.blob, 4)
    if (head.length < 2 || head[0] !== 0xFF || head[1] !== 0xD8) {
      issues.push({
        code: 'NOT_JPEG_SOI',
        message: 'Blob does not start with JPEG SOI marker (FF D8) — wrong encoding or corrupt',
        severity: 'error',
        tier: 'local',
      })
    }
  }

  // Rule 5 — banned-aesthetic textual flags. We can't see the image
  // server-side cheaply, but if the caller passes the canvas, we can
  // sample edges to spot pure-transparency PNG export (the most common
  // Figma giveaway).
  if (input.canvasPeek && (input.bannedAesthetics?.includes('rgba-transparency') ?? false)) {
    const transparent = hasTransparentPixels(input.canvasPeek)
    if (transparent) {
      issues.push({
        code: 'RGBA_TRANSPARENCY_DETECTED',
        message: 'Canvas contains transparent pixels — banned for UI-native authenticity (real screenshots are opaque)',
        severity: 'error',
        tier: 'local',
      })
    }
  }

  return issues
}

async function readFirstBytes(blob: Blob, n: number): Promise<Uint8Array> {
  const slice = blob.slice(0, n)
  const buf = await slice.arrayBuffer()
  return new Uint8Array(buf)
}

/** Sample 4 corners of the canvas — if any has alpha < 255, transparency present. */
function hasTransparentPixels(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  try {
    const corners: [number, number][] = [
      [0, 0],
      [canvas.width - 1, 0],
      [0, canvas.height - 1],
      [canvas.width - 1, canvas.height - 1],
    ]
    for (const [x, y] of corners) {
      const px = ctx.getImageData(x, y, 1, 1).data
      if (px[3] < 250) return true  // alpha threshold accounts for JPEG fudge
    }
    return false
  } catch {
    // getImageData can throw on tainted canvas (CORS) — fail open
    return false
  }
}

/** Helper — surface the canvas dimensions as a follow-up post-decode check. */
export async function checkDecodedDimensions(
  blob: Blob,
  expectedWidth: number,
  expectedHeight: number,
): Promise<QCIssue | null> {
  const img = await blobToImage(blob)
  if (!img) {
    return {
      code: 'DECODE_FAILED',
      message: 'Could not decode the output blob as an image',
      severity: 'error',
      tier: 'local',
    }
  }
  const dw = Math.abs(img.naturalWidth - expectedWidth)
  const dh = Math.abs(img.naturalHeight - expectedHeight)
  if (dw > CROP_DRIFT_TOLERANCE_PX || dh > CROP_DRIFT_TOLERANCE_PX) {
    return {
      code: 'DIMENSIONS_DRIFTED',
      message: `Decoded size ${img.naturalWidth}×${img.naturalHeight} differs from expected ${expectedWidth}×${expectedHeight} by more than tolerance ${CROP_DRIFT_TOLERANCE_PX}px`,
      severity: 'warning',
      tier: 'local',
    }
  }
  return null
}

async function blobToImage(blob: Blob): Promise<HTMLImageElement | null> {
  return await new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}
