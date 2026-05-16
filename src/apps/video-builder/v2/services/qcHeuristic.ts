// ── QC Heuristic Pre-check ───────────────────────────────────────────────────
// Cheap browser-side validation BEFORE spending a Gemini Vision call on QC.
// Catches obviously-broken outputs: empty image, error placeholder, solid color,
// suspiciously small file. If heuristic fails, we treat the gen as a fail
// immediately and retry — saving ~$0.002 + ~5s on each Gemini QC call we skip.
//
// Heuristics applied (in order, fail-fast):
//   1. fetch succeeds with 2xx
//   2. response is image/* (not html error page)
//   3. content-length > 30 KB (real photo is typically 100-500 KB)
//   4. quick canvas decode → check non-trivial pixel variance (not solid)
//
// Heuristic PASSES the image to Gemini QC — it does NOT replace it. Cheap filter.
// ─────────────────────────────────────────────────────────────────────────────

export interface HeuristicResult {
  /** True iff plausible — should proceed to Gemini QC. False iff obviously bad. */
  plausible: boolean
  /** Short English reason if not plausible */
  reason?: string
  /** Approximate file size in bytes (if known) */
  approxBytes?: number
}

/** Minimum file size that could plausibly be a real generated image. */
const MIN_PLAUSIBLE_BYTES = 30 * 1024  // 30 KB

/** Threshold for "solid color" detection — pixel variance must exceed this. */
const MIN_PIXEL_VARIANCE = 200

/**
 * Run the cheap pre-check. Should never throw — returns plausible=false on any error.
 * Returns plausible=true if the image LOOKS legit and is worth a full Gemini QC pass.
 */
export async function heuristicCheck(imageUrl: string): Promise<HeuristicResult> {
  // 1. Fetch — must succeed
  let blob: Blob
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) return { plausible: false, reason: `fetch failed ${res.status}` }
    if (!res.headers.get('content-type')?.startsWith('image/')) {
      return { plausible: false, reason: 'response is not image/*' }
    }
    blob = await res.blob()
  } catch (err) {
    return { plausible: false, reason: `fetch threw: ${(err as Error).message}` }
  }

  // 2. Size — too-small means error placeholder / empty
  if (blob.size < MIN_PLAUSIBLE_BYTES) {
    return { plausible: false, reason: `image too small (${blob.size} bytes)`, approxBytes: blob.size }
  }

  // 3. Canvas decode + variance check — detects solid colors / blank canvases
  try {
    const variance = await computePixelVariance(blob)
    if (variance < MIN_PIXEL_VARIANCE) {
      return { plausible: false, reason: `image looks solid/blank (variance ${variance.toFixed(0)})`, approxBytes: blob.size }
    }
  } catch {
    // Decode failure is suspicious but not definitive — still allow QC to decide
    return { plausible: true, approxBytes: blob.size }
  }

  return { plausible: true, approxBytes: blob.size }
}

/**
 * Compute a cheap approximation of pixel variance from a downscaled sample.
 * Decode to 32×32 → sum of channel variance. Pure solid color → variance ≈ 0.
 */
async function computePixelVariance(blob: Blob): Promise<number> {
  const bmp = await createImageBitmap(blob, { resizeWidth: 32, resizeHeight: 32, resizeQuality: 'low' })
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    if (!ctx) return 1000  // skip → assume plausible
    ctx.drawImage(bmp, 0, 0, 32, 32)
    const data = ctx.getImageData(0, 0, 32, 32).data

    // Compute mean + variance over R+G+B channels (skip alpha)
    let n = 0
    let sum = 0
    let sumSq = 0
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const v = (r + g + b) / 3
      sum += v
      sumSq += v * v
      n++
    }
    const mean = sum / n
    const variance = sumSq / n - mean * mean
    return variance
  } finally {
    bmp.close?.()
  }
}
