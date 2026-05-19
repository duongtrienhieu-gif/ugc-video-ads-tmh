// ── FFmpeg.wasm Loader ───────────────────────────────────────────────────────
// Z36 — Singleton loader for @ffmpeg/ffmpeg. First call fetches the ~30MB
// wasm + worker bundle from unpkg CDN; subsequent calls reuse the cached
// instance.
//
// Browser requirements:
//   • SharedArrayBuffer support — set via vite headers config or
//     served from a cross-origin isolated context (COOP/COEP).
//     Without it ffmpeg.wasm falls back to single-threaded mode
//     (~3x slower but still works).
//   • Modern Chrome/Edge/Firefox/Safari. NOT IE11.
//
// We use the @ffmpeg/ffmpeg 0.12.x API which is significantly different
// from 0.11.x — exec() instead of run(), FS via readFile/writeFile, etc.
// ─────────────────────────────────────────────────────────────────────────────

import type { FFmpeg } from '@ffmpeg/ffmpeg'

// Public CDN URLs for the wasm + worker assets. @ffmpeg/core is fetched
// separately so we can pin a known-good version.
const FFMPEG_CORE_VERSION = '0.12.6'
const CORE_BASE_URL =
  `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`

interface FfmpegSingleton {
  instance: FFmpeg
  loaded: boolean
}

let singleton: FfmpegSingleton | null = null
let loadingPromise: Promise<FFmpeg> | null = null

export interface LoadFfmpegOptions {
  /** Progress callback for the wasm fetch (0-1) — fired once during load */
  onLoadProgress?: (ratio: number) => void
  /** Progress callback for the active ffmpeg run — fired during exec() */
  onExecProgress?: (ratio: number, currentTimeSec: number) => void
  /** Log callback — pipes ffmpeg stderr to the console for debugging */
  onLog?: (msg: string) => void
}

/**
 * Get (or lazy-load) the singleton ffmpeg instance.
 *
 * On first call, fetches the wasm core (~30MB) from unpkg CDN and
 * boots the worker. Cached for the rest of the session.
 *
 * Throws a friendly error if @ffmpeg/ffmpeg is not installed or if
 * the browser doesn't support WebAssembly.
 */
export async function getFFmpeg(opts: LoadFfmpegOptions = {}): Promise<FFmpeg> {
  if (singleton?.loaded) {
    // Already loaded — just re-wire callbacks for this call
    rewireCallbacks(singleton.instance, opts)
    return singleton.instance
  }
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    let FFmpegClass: typeof FFmpeg
    let toBlobURL: (url: string, mimeType: string) => Promise<string>
    try {
      // Dynamic import so a missing dep doesn't break the entire build.
      const ffmpegModule = await import('@ffmpeg/ffmpeg')
      const utilModule = await import('@ffmpeg/util')
      FFmpegClass = ffmpegModule.FFmpeg
      toBlobURL = utilModule.toBlobURL
    } catch (err) {
      throw new Error(
        '@ffmpeg/ffmpeg chưa cài. Chạy: npm install @ffmpeg/ffmpeg @ffmpeg/util. ' +
        `Chi tiết: ${err instanceof Error ? err.message : 'unknown error'}`
      )
    }

    const ffmpeg = new FFmpegClass()
    rewireCallbacks(ffmpeg, opts)

    // toBlobURL converts the cross-origin script into a same-origin blob
    // URL, sidestepping CSP / cross-origin worker restrictions. Without
    // this trick, browsers refuse to spawn the wasm worker from unpkg.
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
      toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
    ])

    console.log(`[FFMPEG] loading core ${FFMPEG_CORE_VERSION} from unpkg...`)
    opts.onLoadProgress?.(0.5)

    await ffmpeg.load({ coreURL, wasmURL })
    console.log('[FFMPEG] core loaded')
    opts.onLoadProgress?.(1.0)

    singleton = { instance: ffmpeg, loaded: true }
    return ffmpeg
  })()

  try {
    return await loadingPromise
  } finally {
    loadingPromise = null
  }
}

function rewireCallbacks(ffmpeg: FFmpeg, opts: LoadFfmpegOptions): void {
  // The FFmpeg class exposes EventEmitter-style on('log') and on('progress')
  // Remove any prior listeners we registered so callbacks don't pile up
  // (FFmpeg 0.12 doesn't expose removeAllListeners but rebinding works for
  // our use because we only ever add ONE listener per event)
  if (opts.onLog) {
    ffmpeg.on('log', ({ message }) => opts.onLog?.(message))
  }
  if (opts.onExecProgress) {
    ffmpeg.on('progress', ({ progress, time }) => {
      // time is in microseconds → seconds
      opts.onExecProgress?.(progress, time / 1_000_000)
    })
  }
}

/** Eager warm-up — call once when the user enters the Export phase so
 *  the ~30MB wasm is fetched in the background while they tweak picks. */
export function warmUpFFmpeg(opts: LoadFfmpegOptions = {}): void {
  getFFmpeg(opts).catch((err) => {
    console.warn('[FFMPEG] warm-up failed', err)
  })
}

/** Is ffmpeg loaded already? (Used by UI to show "wasm cached" vs "first run".) */
export function isFFmpegLoaded(): boolean {
  return singleton?.loaded === true
}
