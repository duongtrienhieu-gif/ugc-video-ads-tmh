// ─────────────────────────────────────────────────────────────────────────
// Landing-page DEBUG STORE (Phase 1 / Task 5)
//
// Lightweight in-memory + localStorage-backed ring buffer that records the
// last N image-generation attempts per asset. Captured by
// runWithCreditSafeRetry in generateImages.ts; surfaced in SectionCard
// when debug mode is enabled (?debug=1 in URL, OR localStorage.lp_debug
// === '1').
//
// NOT a Zustand store — Zustand is overkill for a debug ring buffer that
// only needs flat get/set + occasional snapshot. Plain module-level Map +
// pub/sub for React subscribers.
// ─────────────────────────────────────────────────────────────────────────

export interface DebugAttempt {
  /** Asset key: "<sectionIdx>:<imageIdx>". */
  assetKey: string
  /** Section type for quick filtering. */
  sectionType: string
  /** ImagePrompt.filename for human-readable id. */
  filename: string
  /** Attempt number (1-based) within the credit-safe retry loop. */
  attempt: number
  /** Total max attempts configured for this run. */
  maxAttempts: number
  /** Provider / model identifier (currently always "KIE GPT-4o"). */
  provider: string
  /** Final prompt body sent to KIE (post buildFinalPrompt assembly). */
  prompt: string
  /** Number of filesUrl reference images attached. */
  filesUrlCount: number
  /** KIE size requested ("1:1" / "2:3" / "3:2"). */
  kieSize: string
  /** Outcome status. */
  status: 'started' | 'success' | 'failed' | 'recovered' | 'timeout' | 'cancelled'
  /** Failure reason (raw error message) when status !== 'success'. */
  errorReason?: string
  /** Duration in ms from submit to outcome. */
  durationMs?: number
  /** KIE taskId returned from submit (if any). */
  taskId?: string
  /** Generated asset ref (asset:xxx) on success. */
  assetRef?: string
  /** Epoch ms timestamp when this attempt started. */
  startedAt: number
  /** Epoch ms timestamp when this attempt ended (success or fail). */
  endedAt?: number
}

const MAX_ENTRIES = 300   // ring buffer cap — landing pack ≈ 37 assets × ~3 attempts each

// Map keyed by assetKey "<sectionIdx>:<imageIdx>" → recent attempts (newest last).
const attemptsByAsset = new Map<string, DebugAttempt[]>()
// Global flat log (newest last) for the timeline panel.
const flatLog: DebugAttempt[] = []

const subscribers = new Set<() => void>()

function notify() {
  for (const s of subscribers) s()
}

export function recordAttempt(attempt: DebugAttempt): void {
  // Per-asset bucket — keep last 10 attempts only.
  const bucket = attemptsByAsset.get(attempt.assetKey) ?? []
  bucket.push(attempt)
  if (bucket.length > 10) bucket.shift()
  attemptsByAsset.set(attempt.assetKey, bucket)

  // Flat log — ring buffer.
  flatLog.push(attempt)
  if (flatLog.length > MAX_ENTRIES) flatLog.shift()

  // Persist to localStorage on best-effort (debug only, never block).
  try {
    localStorage.setItem('lp_debug_log', JSON.stringify(flatLog.slice(-100)))
  } catch { /* quota / disabled — ignore */ }

  notify()
}

/** Update an existing in-flight attempt with final outcome. Matched by
 *  assetKey + attempt number + startedAt. */
export function finalizeAttempt(
  match: Pick<DebugAttempt, 'assetKey' | 'attempt' | 'startedAt'>,
  patch: Partial<DebugAttempt>,
): void {
  const bucket = attemptsByAsset.get(match.assetKey)
  if (bucket) {
    const idx = bucket.findIndex((a) =>
      a.attempt === match.attempt && a.startedAt === match.startedAt,
    )
    if (idx >= 0) {
      bucket[idx] = { ...bucket[idx]!, ...patch, endedAt: patch.endedAt ?? Date.now() }
    }
  }
  const flatIdx = flatLog.findIndex((a) =>
    a.assetKey === match.assetKey && a.attempt === match.attempt && a.startedAt === match.startedAt,
  )
  if (flatIdx >= 0) {
    flatLog[flatIdx] = { ...flatLog[flatIdx]!, ...patch, endedAt: patch.endedAt ?? Date.now() }
  }
  notify()
}

export function getAttemptsForAsset(assetKey: string): DebugAttempt[] {
  return attemptsByAsset.get(assetKey) ?? []
}

export function getFlatLog(): DebugAttempt[] {
  return flatLog.slice()
}

export function clearAll(): void {
  attemptsByAsset.clear()
  flatLog.length = 0
  try { localStorage.removeItem('lp_debug_log') } catch { /* ignore */ }
  notify()
}

export function subscribeDebug(fn: () => void): () => void {
  subscribers.add(fn)
  return () => { subscribers.delete(fn) }
}

/**
 * Debug-mode gate. Returns true if URL has ?debug=1 OR localStorage
 * "lp_debug" === '1'. Use in SectionCard / OutputPanel to conditionally
 * render the debug panel.
 *
 * Safe to call from SSR / build (window guard). Stable per render — the
 * underlying flag rarely flips, no need to subscribe.
 */
export function isDebugMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (new URLSearchParams(window.location.search).get('debug') === '1') return true
  } catch { /* ignore */ }
  try {
    return localStorage.getItem('lp_debug') === '1'
  } catch {
    return false
  }
}
