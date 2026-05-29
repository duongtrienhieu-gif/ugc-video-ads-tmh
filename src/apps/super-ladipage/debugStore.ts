// ─────────────────────────────────────────────────────────────────────
// Super Ladipage — debug store stub.
// Phase 2: no-op để UI port giữ nguyên cấu trúc gọi.
// Phase 3 sẽ implement nếu cần track retry / fail reason cho mỗi asset.
// ─────────────────────────────────────────────────────────────────────

export interface DebugAttempt {
  attempt: number
  maxAttempts: number
  provider: string
  kieSize: string
  filesUrlCount: number
  status: 'started' | 'success' | 'failed' | 'recovered' | 'timeout' | 'cancelled'
  taskId?: string
  durationMs?: number
  startedAt: number
  errorReason?: string
}

const NO_ATTEMPTS: DebugAttempt[] = []

export function getAttemptsForAsset(_assetKey: string): DebugAttempt[] {
  return NO_ATTEMPTS
}

export function subscribeDebug(_listener: () => void): () => void {
  return () => {}
}

export function isDebugMode(): boolean {
  if (typeof window === 'undefined') return false
  if (window.location.search.includes('debug=1')) return true
  try {
    return window.localStorage.getItem('slp_debug') === '1'
  } catch {
    return false
  }
}
