// ── Session Registry ────────────────────────────────────────────────────────
// Central registry of every persistable module + scanning logic for the
// global RestoreSessionModal. Phase R1 spec.
//
// Adding a new module:
//   1. Append a ModuleRegistration to `MODULE_REGISTRY` below
//   2. Use `useSessionPersist` in the module with the same persistKey
//   3. (Done — modal auto-picks it up)
// ─────────────────────────────────────────────────────────────────────────────

import type { ModuleRegistration, SessionMeta, SnapshotEnvelope } from './types'

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24h
const ONE_HOUR_MS = 60 * 60 * 1000

/**
 * Master list of every persistable module in the app.
 * Order in this array = order shown in the restore modal.
 *
 * Phase R3 pilots LandingPage AI. R4-R6 will append Avatar AI / Product AI /
 * Script Architect / Ads Content / Video Builder / Voice / etc.
 */
export const MODULE_REGISTRY: ModuleRegistration[] = [
  {
    moduleId: 'landing-page',
    moduleNameVi: 'LandingPage AI',
    persistKey: 'ugc-lab:landing-page:inflight-v1',
    version: 1,
    maxAgeMs: DEFAULT_MAX_AGE_MS,
  },
  // ── R4 rollout ───────────────────────────────────────────────────────────
  {
    moduleId: 'character-studio',
    moduleNameVi: 'Avatar AI',
    persistKey: 'ugc-lab:character-studio:inflight-v1',
    version: 1,
    maxAgeMs: DEFAULT_MAX_AGE_MS,
  },
  {
    moduleId: 'script-architect',
    moduleNameVi: 'Tạo Kịch bản UGC',
    persistKey: 'ugc-lab:script-architect:inflight-v1',
    version: 1,
    maxAgeMs: DEFAULT_MAX_AGE_MS,
  },
  {
    moduleId: 'ads-content',
    moduleNameVi: 'Ads Content',
    persistKey: 'ugc-lab:ads-content:inflight-v1',
    version: 1,
    maxAgeMs: DEFAULT_MAX_AGE_MS,
  },
  // ── R4b — BrollStudio (migrated from bespoke pattern) ────────────────────
  {
    moduleId: 'broll-studio',
    moduleNameVi: 'Product AI',
    persistKey: 'ugc-lab:broll-studio:inflight-v1',
    version: 1,
    maxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days — original BrollStudio behavior
  },
  // ── R6 ───────────────────────────────────────────────────────────────────
  {
    moduleId: 'voice-studio',
    moduleNameVi: 'Giọng đọc',
    persistKey: 'ugc-lab:voice-studio:inflight-v1',
    version: 1,
    maxAgeMs: DEFAULT_MAX_AGE_MS,
  },
]

/** Get a module's registration by moduleId. */
export function getRegistration(moduleId: string): ModuleRegistration | null {
  return MODULE_REGISTRY.find((m) => m.moduleId === moduleId) ?? null
}

/** Safely read + parse an envelope from localStorage. Returns null on any failure. */
export function readEnvelope<T>(persistKey: string): SnapshotEnvelope<T> | null {
  try {
    const raw = localStorage.getItem(persistKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SnapshotEnvelope<T>
    if (typeof parsed !== 'object' || parsed === null || !('version' in parsed) || !('data' in parsed)) return null
    return parsed
  } catch {
    return null
  }
}

/** Write an envelope. Silently swallows errors (storage may be full). */
export function writeEnvelope<T>(persistKey: string, envelope: SnapshotEnvelope<T>): void {
  try {
    localStorage.setItem(persistKey, JSON.stringify(envelope))
  } catch (err) {
    // Storage quota exceeded, private mode, etc. — log but don't crash
    console.warn(`[sessionPersistence] failed to write ${persistKey}:`, err)
  }
}

/** Clear one module's snapshot. */
export function clearEnvelope(persistKey: string): void {
  try {
    localStorage.removeItem(persistKey)
  } catch {/* ignore */}
}

/**
 * Scan all registered modules and return metadata for sessions that need
 * the restore modal to show. Filters:
 *   - version must match current (else stale — drop)
 *   - updatedAt within maxAgeMs (else stale — drop + clear)
 *   - status is 'in-progress' or 'paused' (completed/failed not surfaced)
 */
export function scanForPendingSessions(): SessionMeta[] {
  const now = Date.now()
  const results: SessionMeta[] = []

  for (const reg of MODULE_REGISTRY) {
    const envelope = readEnvelope(reg.persistKey)
    if (!envelope) continue

    // Drop old-version snapshots
    if (envelope.version !== reg.version) {
      clearEnvelope(reg.persistKey)
      continue
    }
    // Drop expired snapshots
    if (now - envelope.updatedAt > reg.maxAgeMs) {
      clearEnvelope(reg.persistKey)
      continue
    }
    // Skip terminal statuses
    if (envelope.status !== 'in-progress' && envelope.status !== 'paused') continue

    results.push({
      moduleId: envelope.moduleId,
      moduleNameVi: envelope.moduleNameVi,
      status: envelope.status,
      startedAt: envelope.startedAt,
      updatedAt: envelope.updatedAt,
      progressVi: envelope.progressVi,
      titleVi: envelope.titleVi,
      persistKey: reg.persistKey,
    })
  }

  // External bridges (v2 video-builder jobs, etc.)
  for (const bridge of EXTERNAL_BRIDGES) {
    const meta = bridge.scan()
    if (meta) results.push(meta)
  }

  // Most recently updated first
  results.sort((a, b) => b.updatedAt - a.updatedAt)
  return results
}

// ── External Job Bridges (R5+) ───────────────────────────────────────────────
// Some modules (notably video-builder v2) already have their own async-job
// stores with bespoke localStorage + tryResumeFromStorage logic. Rather than
// refactor those, we bridge their raw job blobs into the unified modal.
//
// Each bridge:
//   - Has its own localStorage key + raw shape (no envelope wrapper)
//   - Provides a `scan()` returning SessionMeta if a non-terminal job exists
//   - Provides `discard()` to wipe the key (when user clicks [Bỏ])
//
// On [Khôi phục], the bridge does NOTHING extra — when the user navigates to
// the module, its existing tryResumeFromStorage picks the data back up.

export interface ExternalJobBridge {
  /** Module id this bridge belongs to (used for "Khôi phục" navigation). */
  moduleId: string
  /** Display name for the modal. */
  moduleNameVi: string
  /** localStorage key holding the raw job blob. */
  persistKey: string
  /** Read localStorage + return modal metadata, or null if no pending job. */
  scan(): SessionMeta | null
  /** User chose [Bỏ] — remove the underlying data. */
  discard(): void
}

/** Inspect a raw v2 master-frame job blob and decide if it's pending. */
function scanMasterFrameJob(): SessionMeta | null {
  const KEY = 'ugc-lab-v2-master-frame-job'
  const MAX_AGE = 12 * 60 * 1000 // 12 minutes — matches store's MAX_JOB_AGE_MS
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const job = JSON.parse(raw) as {
      status?: string
      createdAt?: number
      updatedAt?: number
      statusVi?: string
      inputs?: { productName?: string }
      progress?: number
    }
    if (!job?.status || typeof job.createdAt !== 'number') return null
    if (Date.now() - job.createdAt > MAX_AGE) {
      localStorage.removeItem(KEY)
      return null
    }
    const isTerminal = job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled'
    if (isTerminal) return null
    return {
      moduleId: 'video-builder',
      moduleNameVi: 'UGC Builder — Master Frame',
      status: 'in-progress',
      startedAt: job.createdAt,
      updatedAt: job.updatedAt ?? job.createdAt,
      progressVi: `${job.statusVi ?? 'Đang xử lý'} (${job.progress ?? 0}%)`,
      titleVi: job.inputs?.productName,
      persistKey: KEY,
    }
  } catch {
    return null
  }
}

function scanSceneGenJob(): SessionMeta | null {
  const KEY = 'ugc-lab-v2-scene-gen-job'
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const job = JSON.parse(raw) as {
      status?: string
      startedAt?: number
      items?: Array<{ status?: string }>
      productName?: string
    }
    if (!job?.status || !Array.isArray(job.items)) return null
    const isTerminal = job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled'
    if (isTerminal) return null
    const approved = job.items.filter((i) => i?.status === 'approved').length
    return {
      moduleId: 'video-builder',
      moduleNameVi: 'UGC Builder — B-Roll Queue',
      status: 'in-progress',
      startedAt: job.startedAt ?? Date.now(),
      updatedAt: job.startedAt ?? Date.now(),
      progressVi: `${approved}/${job.items.length} cảnh đã duyệt`,
      titleVi: job.productName,
      persistKey: KEY,
    }
  } catch {
    return null
  }
}

function scanVideoGenJob(): SessionMeta | null {
  const KEY = 'ugc-lab-v2-video-gen-job'
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const job = JSON.parse(raw) as {
      status?: string
      startedAt?: number
      items?: Array<{ status?: string }>
    }
    if (!job?.status || !Array.isArray(job.items)) return null
    const isTerminal = job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled'
    if (isTerminal) return null
    const done = job.items.filter((i) => i?.status === 'completed' || i?.status === 'approved').length
    return {
      moduleId: 'video-builder',
      moduleNameVi: 'UGC Builder — Video Render',
      status: 'in-progress',
      startedAt: job.startedAt ?? Date.now(),
      updatedAt: job.startedAt ?? Date.now(),
      progressVi: `${done}/${job.items.length} video clip render xong`,
      persistKey: KEY,
    }
  } catch {
    return null
  }
}

export const EXTERNAL_BRIDGES: ExternalJobBridge[] = [
  {
    moduleId: 'video-builder',
    moduleNameVi: 'UGC Builder — Master Frame',
    persistKey: 'ugc-lab-v2-master-frame-job',
    scan: scanMasterFrameJob,
    discard: () => { try { localStorage.removeItem('ugc-lab-v2-master-frame-job') } catch {/* ignore */} },
  },
  {
    moduleId: 'video-builder',
    moduleNameVi: 'UGC Builder — B-Roll Queue',
    persistKey: 'ugc-lab-v2-scene-gen-job',
    scan: scanSceneGenJob,
    discard: () => { try { localStorage.removeItem('ugc-lab-v2-scene-gen-job') } catch {/* ignore */} },
  },
  {
    moduleId: 'video-builder',
    moduleNameVi: 'UGC Builder — Video Render',
    persistKey: 'ugc-lab-v2-video-gen-job',
    scan: scanVideoGenJob,
    discard: () => { try { localStorage.removeItem('ugc-lab-v2-video-gen-job') } catch {/* ignore */} },
  },
]

/** Get external bridge by persistKey — used by modal's per-session discard. */
export function getBridgeByKey(persistKey: string): ExternalJobBridge | null {
  return EXTERNAL_BRIDGES.find((b) => b.persistKey === persistKey) ?? null
}

/** Discard a single session — used when user clicks [Bỏ] on one item. */
export function discardSession(persistKey: string): void {
  const bridge = getBridgeByKey(persistKey)
  if (bridge) {
    bridge.discard()
    return
  }
  clearEnvelope(persistKey)
}

/** Discard ALL pending sessions — used when user clicks "Bỏ tất cả". */
export function discardAllPendingSessions(): void {
  for (const reg of MODULE_REGISTRY) {
    clearEnvelope(reg.persistKey)
  }
}

/**
 * One-time migration of legacy bespoke localStorage keys into the new envelope
 * format. Idempotent — running it twice is safe (no-op if already migrated).
 *
 * Add new entries here when migrating a module from its own ad-hoc key.
 */
const LEGACY_MIGRATIONS: Array<{
  oldKey: string
  newKey: string
  moduleId: string
  moduleNameVi: string
  version: number
  /** Build the envelope's `data` field + metadata from the old blob shape. */
  build: (raw: unknown) => { data: unknown; startedAt: number; updatedAt: number; titleVi?: string; progressVi?: string } | null
}> = [
  // BrollStudio (Product AI) — moved from 'product-ai-state-v1' bespoke key
  {
    oldKey: 'product-ai-state-v1',
    newKey: 'ugc-lab:broll-studio:inflight-v1',
    moduleId: 'broll-studio',
    moduleNameVi: 'Product AI',
    version: 1,
    build: (raw) => {
      try {
        const r = raw as { lastUpdatedAt?: number; tiles?: Array<{ url?: string | null }> }
        if (!r || typeof r.lastUpdatedAt !== 'number') return null
        const filledTiles = Array.isArray(r.tiles) ? r.tiles.filter((t) => t?.url).length : 0
        return {
          data: r,
          startedAt: r.lastUpdatedAt,
          updatedAt: r.lastUpdatedAt,
          progressVi: `${filledTiles}/${Array.isArray(r.tiles) ? r.tiles.length : 4} tile đã tạo`,
        }
      } catch {
        return null
      }
    },
  },
]

export function migrateLegacyKeys(): void {
  for (const m of LEGACY_MIGRATIONS) {
    try {
      // Skip if new key already populated — don't clobber
      if (localStorage.getItem(m.newKey)) {
        // But still clean up the old key to avoid clutter
        localStorage.removeItem(m.oldKey)
        continue
      }
      const oldRaw = localStorage.getItem(m.oldKey)
      if (!oldRaw) continue
      const parsed = JSON.parse(oldRaw)
      const built = m.build(parsed)
      if (!built) {
        localStorage.removeItem(m.oldKey)
        continue
      }
      const envelope: SnapshotEnvelope = {
        version: m.version,
        moduleId: m.moduleId,
        moduleNameVi: m.moduleNameVi,
        status: 'paused',
        startedAt: built.startedAt,
        updatedAt: built.updatedAt,
        progressVi: built.progressVi,
        titleVi: built.titleVi,
        data: built.data,
      }
      localStorage.setItem(m.newKey, JSON.stringify(envelope))
      localStorage.removeItem(m.oldKey)
      console.info(`[sessionPersistence] migrated legacy key '${m.oldKey}' → '${m.newKey}'`)
    } catch (err) {
      console.warn(`[sessionPersistence] migration failed for ${m.oldKey}:`, err)
    }
  }
}

/** Cleanup utility — clears terminal-status entries older than 1h on app boot. */
export function pruneExpiredSnapshots(): void {
  const now = Date.now()
  for (const reg of MODULE_REGISTRY) {
    const envelope = readEnvelope(reg.persistKey)
    if (!envelope) continue
    if (envelope.version !== reg.version) {
      clearEnvelope(reg.persistKey)
      continue
    }
    const isTerminal = envelope.status === 'completed' || envelope.status === 'failed'
    if (isTerminal && now - envelope.updatedAt > ONE_HOUR_MS) {
      clearEnvelope(reg.persistKey)
    }
  }
}

/** Format a human-friendly relative time in Vietnamese. */
export function formatRelativeVi(ts: number): string {
  const diffSec = Math.round((Date.now() - ts) / 1000)
  if (diffSec < 60) return 'vừa xong'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin} phút trước`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr} giờ trước`
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay} ngày trước`
}
