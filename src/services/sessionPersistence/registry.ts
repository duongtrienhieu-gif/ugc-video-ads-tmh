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
  // ── R4+ slots — uncomment as each module is wired ────────────────────────
  // { moduleId: 'character-studio', moduleNameVi: 'Avatar AI', persistKey: 'ugc-lab:character-studio:inflight-v1', version: 1, maxAgeMs: DEFAULT_MAX_AGE_MS },
  // { moduleId: 'broll-studio',     moduleNameVi: 'Product AI', persistKey: 'ugc-lab:broll-studio:inflight-v1',     version: 1, maxAgeMs: DEFAULT_MAX_AGE_MS },
  // { moduleId: 'script-architect', moduleNameVi: 'Kịch bản',   persistKey: 'ugc-lab:script-architect:inflight-v1', version: 1, maxAgeMs: DEFAULT_MAX_AGE_MS },
  // { moduleId: 'ads-content',      moduleNameVi: 'Ads Content', persistKey: 'ugc-lab:ads-content:inflight-v1',      version: 1, maxAgeMs: DEFAULT_MAX_AGE_MS },
  // { moduleId: 'voice-studio',     moduleNameVi: 'Giọng đọc',   persistKey: 'ugc-lab:voice-studio:inflight-v1',     version: 1, maxAgeMs: DEFAULT_MAX_AGE_MS },
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

  // Most recently updated first
  results.sort((a, b) => b.updatedAt - a.updatedAt)
  return results
}

/** Discard a single session — used when user clicks [Bỏ] on one item. */
export function discardSession(persistKey: string): void {
  clearEnvelope(persistKey)
}

/** Discard ALL pending sessions — used when user clicks "Bỏ tất cả". */
export function discardAllPendingSessions(): void {
  for (const reg of MODULE_REGISTRY) {
    clearEnvelope(reg.persistKey)
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
