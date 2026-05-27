// ─────────────────────────────────────────────────────────────────────
// Generation Orchestration — retry policy (P12)
//
// LOCKED: retry ONLY for technical/structural failure. NEVER retry on
// taste/quality grounds ("not beautiful enough", "not impressive enough").
//
// Retriable conditions:
//   - executor returned status='failed' (transient API/network error)
//   - executor returned status='malformed' (broken anatomy / unreadable
//     product / broken framing detected by executor)
//
// MAX_RETRIES bounded. After exhaustion, status becomes 'failed' and
// orchestration moves on — no fallback to a different renderer (that's
// P13+ calibration concern).
// ─────────────────────────────────────────────────────────────────────

import type { ExecutorOutput, ExecutorOutputStatus } from '../types'

export const MAX_RETRIES = 2

export const RETRIABLE_STATUSES: ExecutorOutputStatus[] = ['failed', 'malformed']

/** Decide whether to retry given the most recent executor output + attempt count. */
export function shouldRetry(output: ExecutorOutput, retryCount: number): boolean {
  if (retryCount >= MAX_RETRIES) return false
  return RETRIABLE_STATUSES.includes(output.status)
}
