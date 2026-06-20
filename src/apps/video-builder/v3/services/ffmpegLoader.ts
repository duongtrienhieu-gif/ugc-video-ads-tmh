// ── FFmpeg.wasm Loader ───────────────────────────────────────────────────────
// Z36 — Singleton loader for @ffmpeg/ffmpeg. The core wasm + js are
// served same-origin via Vite `?url` imports from @ffmpeg/core in
// node_modules (added as a dep). Avoids:
//   • flaky unpkg/jsdelivr CDN reachability under high traffic
//   • COEP credentialless cross-origin restrictions on Vercel that
//     surfaced as `failed to import ffmpeg-core.js` in the worker
//   • CSP issues with blob: URLs created from cross-origin fetches
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

// Same-origin static paths under /public/ffmpeg/. Files are auto-copied
// from node_modules/@ffmpeg/core/dist/esm/ at pre(dev|build) — see
// scripts/copy-ffmpeg-core.mjs. ESM (not UMD) is required: @ffmpeg/ffmpeg
// 0.12.x's worker is module-type and loads core via dynamic `import().default`
// after `importScripts` throws. UMD has no default export → would fail.
const coreURL = '/ffmpeg/ffmpeg-core.js'
const wasmURL = '/ffmpeg/ffmpeg-core.wasm'

interface FfmpegSingleton {
  instance: FFmpeg
  loaded: boolean
}

let singleton: FfmpegSingleton | null = null
let loadingPromise: Promise<FFmpeg> | null = null

// Z91 — serialize every ffmpeg.exec() across the WHOLE app. The FFmpeg.wasm
// instance is a SINGLETON and is NOT re-entrant: two exec() calls in flight at
// once collide on the single worker's resolver (one hangs / returns the wrong
// result / corrupts output). This happens when steps run in parallel — e.g.
// Bước 2 static-image clips while Bước 3's atempo runs, or two concurrent
// inserts both rendering a static clip. We chain every exec() onto one promise
// so they run strictly one-at-a-time, FIFO. writeFile/readFile already serialize
// at the worker-message level and use unique filenames, so locking exec() (the
// actual command run) is sufficient.
let execLock: Promise<unknown> = Promise.resolve()

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
 * Same-origin core URLs come from Vite asset imports (no CDN fetch).
 * Cached after first load for the rest of the session.
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
    try {
      // Dynamic import so a missing dep doesn't break the entire build.
      const ffmpegModule = await import('@ffmpeg/ffmpeg')
      FFmpegClass = ffmpegModule.FFmpeg
    } catch (err) {
      throw new Error(
        '@ffmpeg/ffmpeg chưa cài. Chạy: npm install @ffmpeg/ffmpeg @ffmpeg/core @ffmpeg/util. ' +
        `Chi tiết: ${err instanceof Error ? err.message : 'unknown error'}`
      )
    }

    const ffmpeg = new FFmpegClass()
    rewireCallbacks(ffmpeg, opts)

    // Z91 — wrap exec() ONCE so every call (from any phase / parallel render)
    // serializes through execLock. No call-site changes needed.
    const rawExec = ffmpeg.exec.bind(ffmpeg)
    ffmpeg.exec = ((...args: Parameters<typeof rawExec>) => {
      const run = execLock.then(() => rawExec(...args))
      execLock = run.then(() => {}, () => {})  // release on settle (swallow errors)
      return run
    }) as typeof ffmpeg.exec

    console.log('[FFMPEG] loading same-origin core…')
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

/** P6ar — HARD reset the singleton: terminate the (possibly CRASHED) wasm worker and
 *  drop the cached instance so the NEXT getFFmpeg() builds a fresh one. Critical for
 *  recovery: when a worker dies mid-assemble (OOM / a corrupt clip) it throws
 *  "ErrnoError: FS error", but the singleton stays loaded=true → EVERY later assemble
 *  FS-errors forever until a full page reload. Calling this between assemble attempts
 *  (see assembleFromHybridState) lets a retry run on a clean worker. Best-effort —
 *  terminate() on an already-dead worker is swallowed. */
export async function resetFFmpeg(): Promise<void> {
  const inst = singleton?.instance
  singleton = null
  loadingPromise = null
  execLock = Promise.resolve()   // drop any chained-onto-a-dead-worker exec promise
  if (inst) {
    try { inst.terminate() } catch { /* worker already gone — noop */ }
  }
}
