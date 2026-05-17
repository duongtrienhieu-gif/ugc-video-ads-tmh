// ── productRenderPool.ts — Phase 2 SCAFFOLDING ─────────────────────────────
//
// Reusable asset cache for the hybrid-render pipeline. When a section gets
// strategy='reusable_render' from renderPlanner (e.g. hero_01 = master
// product packshot), the AI-rendered output is stored here keyed by
// (productId, packshotStyle, aspect). Subsequent sections needing the same
// packshot (promo banners, social-proof screenshots, ingredient cards) pull
// it from this pool instead of issuing fresh KIE calls.
//
// Storage: localStorage under `ugc-lab:landing-page:product-render-pool-v1`.
// Only ASSET REFS are persisted (e.g. "asset:abc-123"). The actual image
// blobs live in Supabase Storage — pool entries are tiny (~80 bytes each)
// so a 50-entry cap is generous and won't bloat localStorage.
//
// Phase 2 ships the cache + DevTools API but NO consumer wires it yet.
// generateImages.ts continues to render every asset fresh. Phase 5/6 will
// plug the pool into the routing logic behind ENABLE_HYBRID_RENDER.

// ── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'ugc-lab:landing-page:product-render-pool-v1'
const MAX_ENTRIES = 50

/** Schema version — bump when entry shape changes; old entries get dropped. */
const SCHEMA_VERSION = 1

// ── Types ──────────────────────────────────────────────────────────────────

/** One cache entry. Lightweight — only asset ref + metadata for LRU. */
export interface PooledAsset {
  /** Composite cache key — see makePoolKey() */
  key: string
  /** Supabase asset ref (asset:xxx) — the actual image blob lives there */
  assetRef: string
  /** Product this packshot belongs to — useful for cleanup by product. */
  productId: string
  /** Packshot style label — "hero", "macro-bottle", "label-front", etc. */
  packshotStyle: string
  /** "1:1" / "4:5" / "16:9" — drives whether downstream sections can reuse it. */
  aspect: string
  /** Prompt hash — short hex of the prompt that generated it. Lets the
   *  planner skip cache when prompt drift is significant. */
  promptHash: string
  /** Epoch ms — when this entry was created. Used for cache age display. */
  createdAt: number
  /** Epoch ms — when this entry was last consumed by a derived asset.
   *  Drives LRU eviction. */
  lastUsedAt: number
  /** How many times this entry has been reused across pack generations. */
  reuseCount: number
}

interface PoolFile {
  version: number
  entries: PooledAsset[]
}

// ── Key derivation (deterministic, ASCII-safe) ─────────────────────────────

/**
 * Build a stable cache key from productId + packshotStyle + aspect.
 * Different products are NEVER pooled together. Different aspects are NEVER
 * pooled together (4:5 packshot can't substitute for 1:1 ingredient card).
 */
export function makePoolKey(opts: {
  productId: string
  packshotStyle: string
  aspect: string
}): string {
  const safe = (s: string) => (s ?? '').toLowerCase().replace(/[^\w-]+/g, '-').slice(0, 40)
  return `${safe(opts.productId)}::${safe(opts.packshotStyle)}::${safe(opts.aspect)}`
}

/**
 * 8-char hex hash of a string. Pure JS, no crypto — only used as a
 * cache-busting hint (NOT a security primitive). FNV-1a 32-bit.
 */
export function hashPrompt(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) >>> 0
    h = ((h * 0x01000193) >>> 0)
  }
  return h.toString(16).padStart(8, '0').slice(0, 8)
}

// ── Storage layer ──────────────────────────────────────────────────────────

function readPool(): PoolFile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { version: SCHEMA_VERSION, entries: [] }
    const parsed = JSON.parse(raw) as Partial<PoolFile>
    if (parsed.version !== SCHEMA_VERSION || !Array.isArray(parsed.entries)) {
      // Stale schema — drop everything
      return { version: SCHEMA_VERSION, entries: [] }
    }
    return parsed as PoolFile
  } catch {
    return { version: SCHEMA_VERSION, entries: [] }
  }
}

function writePool(pool: PoolFile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pool))
  } catch (err) {
    // Quota exceeded / private mode — fail silent, pool simply won't help
    console.warn('[productRenderPool] write failed:', err)
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Look up a pooled asset by key. Returns null if no hit. Calling this also
 * bumps lastUsedAt + reuseCount so LRU eviction protects hot entries.
 *
 * Pass `promptHash` to enforce prompt-stability: if a stored entry's hash
 * differs from `expectedHash`, we treat it as a miss (the cached packshot
 * was generated from a stale prompt and should not be reused).
 */
export function getPooledAsset(opts: {
  key: string
  expectedHash?: string
}): PooledAsset | null {
  const pool = readPool()
  const entry = pool.entries.find((e) => e.key === opts.key)
  if (!entry) return null

  if (opts.expectedHash && entry.promptHash !== opts.expectedHash) {
    // Prompt drifted — skip cache, signal to planner that a fresh render is required
    return null
  }

  // Touch — LRU update
  entry.lastUsedAt = Date.now()
  entry.reuseCount += 1
  writePool(pool)

  return entry
}

/**
 * Insert / update a pooled asset. If the pool is at capacity, the oldest
 * (least recently used) entry is evicted to make room.
 *
 * Idempotent: writing the same key replaces the existing entry.
 */
export function setPooledAsset(opts: {
  key: string
  assetRef: string
  productId: string
  packshotStyle: string
  aspect: string
  promptHash: string
}): PooledAsset {
  const pool = readPool()
  const now = Date.now()

  // Remove existing entry with same key (idempotent overwrite)
  pool.entries = pool.entries.filter((e) => e.key !== opts.key)

  // Insert new entry
  const entry: PooledAsset = {
    key: opts.key,
    assetRef: opts.assetRef,
    productId: opts.productId,
    packshotStyle: opts.packshotStyle,
    aspect: opts.aspect,
    promptHash: opts.promptHash,
    createdAt: now,
    lastUsedAt: now,
    reuseCount: 0,
  }
  pool.entries.unshift(entry)

  // Evict LRU when over capacity
  if (pool.entries.length > MAX_ENTRIES) {
    pool.entries.sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    pool.entries = pool.entries.slice(0, MAX_ENTRIES)
  }

  writePool(pool)
  return entry
}

/** Remove a single pooled entry by key. */
export function evictPooledAsset(key: string): void {
  const pool = readPool()
  pool.entries = pool.entries.filter((e) => e.key !== key)
  writePool(pool)
}

/** Remove every entry tied to a product (used when a product is deleted). */
export function evictByProduct(productId: string): void {
  const pool = readPool()
  pool.entries = pool.entries.filter((e) => e.productId !== productId)
  writePool(pool)
}

/** Wipe the entire pool — exposed for "Reset" actions. */
export function clearPool(): void {
  writePool({ version: SCHEMA_VERSION, entries: [] })
}

// ── Stats ──────────────────────────────────────────────────────────────────

export interface PoolStats {
  entryCount: number
  totalReuses: number
  byProduct: Record<string, number>
  byAspect: Record<string, number>
  oldestAgeMs: number | null
  newestAgeMs: number | null
}

/** Read-only snapshot of pool health. Drives metrics chip / debug panel. */
export function getPoolStats(): PoolStats {
  const pool = readPool()
  const now = Date.now()
  const byProduct: Record<string, number> = {}
  const byAspect: Record<string, number> = {}
  let oldest = -Infinity
  let newest = Infinity
  let totalReuses = 0

  for (const e of pool.entries) {
    byProduct[e.productId] = (byProduct[e.productId] ?? 0) + 1
    byAspect[e.aspect] = (byAspect[e.aspect] ?? 0) + 1
    totalReuses += e.reuseCount
    if (e.createdAt < newest) newest = e.createdAt
    if (e.createdAt > oldest) oldest = e.createdAt
  }

  return {
    entryCount: pool.entries.length,
    totalReuses,
    byProduct,
    byAspect,
    oldestAgeMs: pool.entries.length > 0 ? now - newest : null,
    newestAgeMs: pool.entries.length > 0 ? now - oldest : null,
  }
}

/** Raw entries list — used by DevTools panel / tests / debug only. */
export function listPooledAssets(): readonly PooledAsset[] {
  return readPool().entries
}

// ── DevTools helpers ───────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  const w = window as unknown as {
    __productRenderPool?: {
      list: typeof listPooledAssets
      stats: typeof getPoolStats
      clear: typeof clearPool
      makeKey: typeof makePoolKey
    }
  }
  w.__productRenderPool = {
    list: listPooledAssets,
    stats: getPoolStats,
    clear: clearPool,
    makeKey: makePoolKey,
  }
}
