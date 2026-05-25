// ── Tìm Source Video — localStorage TTL cache ────────────────────────────────
// Cheap dev-loop saver + production hit-rate booster. Key is namespaced so the
// cache survives across app reloads but stays scoped to this feature. TTL is
// per-entry; expired entries get evicted on read.

const NAMESPACE = 'ugc-lab:tim-source-video:cache:v1:'

interface Envelope<T> {
  v: T
  exp: number  // unix ms; 0 = no expiry
}

/** Stable string hash (djb2). Used to key cache entries by content. */
export function hash(input: string): string {
  let h = 5381
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i)
  }
  return (h >>> 0).toString(36)
}

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(NAMESPACE + key)
    if (!raw) return null
    const env = JSON.parse(raw) as Envelope<T>
    if (env.exp > 0 && Date.now() > env.exp) {
      localStorage.removeItem(NAMESPACE + key)
      return null
    }
    return env.v
  } catch {
    return null
  }
}

export function cacheSet<T>(key: string, value: T, ttlMs = 24 * 60 * 60 * 1000): void {
  try {
    const env: Envelope<T> = { v: value, exp: ttlMs > 0 ? Date.now() + ttlMs : 0 }
    localStorage.setItem(NAMESPACE + key, JSON.stringify(env))
  } catch {
    // Quota full or private mode — silently skip (cache is best-effort)
  }
}

/** Wrap an async function in a cache layer. Hits the cache; on miss, runs the
 *  loader, stores result, and returns it. Errors from loader are NOT cached. */
export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key)
  if (hit !== null) return hit
  const result = await loader()
  cacheSet(key, result, ttlMs)
  return result
}

/** Manual purge — exposed in case the user wants a "clear cache" button later. */
export function cacheClear(): number {
  let count = 0
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(NAMESPACE)) keysToRemove.push(k)
    }
    keysToRemove.forEach(k => { localStorage.removeItem(k); count++ })
  } catch { /* ignore */ }
  return count
}
