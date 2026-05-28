// Font loading helper for canvas rendering.
// Konva renders text via the browser's Canvas 2D API, which won't use a
// webfont until it's actually loaded. Calling document.fonts.load() before
// drawing ensures Plus Jakarta Sans is ready — otherwise the first paint
// falls back to a system font and the text looks wrong.

const REQUIRED_FONT = 'Plus Jakarta Sans'
const REQUIRED_WEIGHTS = [400, 500, 600, 700, 800]

let cachedPromise: Promise<void> | null = null

export function ensureCanvasFontsLoaded(): Promise<void> {
  if (cachedPromise) return cachedPromise
  cachedPromise = (async () => {
    if (typeof document === 'undefined' || !document.fonts) return
    await Promise.all(
      REQUIRED_WEIGHTS.map((w) => document.fonts.load(`${w} 16px "${REQUIRED_FONT}"`)),
    )
  })().catch(() => { /* swallow — fall back to system font rather than crash */ })
  return cachedPromise
}
