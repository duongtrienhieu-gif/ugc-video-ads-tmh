// ─────────────────────────────────────────────────────────────────────
// Generation Orchestration — KIE gpt-4o-image executor (POST-REBUILD)
//
// Wraps KIE.ai's /gpt4o-image/generate endpoint. This is the premium
// route with TRUE image-to-image: it accepts up to 5 reference image
// URLs via `filesUrl` and locks the output to match them.
//
// Used for:
//   - hero-anchor (no refs initially → generates the anchor)
//   - mood-supporting / lifestyle-context / proof-callout (character ref)
//   - object-trace WHEN product reference is provided
//
// LOCKED: prompt is the SCENE DESCRIPTION from imageSceneSynthesis,
// verbatim. NO prepend / append / hint stacking.
//
// CIRCUIT BREAKER (Option A — 2026-05-31)
// Module-level state shared across all executor instances within a tab.
// When KIE's gpt-4o-image queue is stuck (server-side), the poll loop
// times out per task. Without a breaker, an 8-section batch wastes
// 8 × 240s = ~32 min before failing.
// After TRIP_THRESHOLD=2 consecutive timeouts, the breaker trips and
// subsequent calls fail-fast in ~1ms with status='failed' +
// failureReason='KIE_DEGRADED: ...'. The breaker auto-resets after
// AUTO_RESET_MS=60s of no calls so the user can retry once KIE recovers,
// AND resetKieHealth() can be called explicitly at full-batch entry.
// Failures other than TIMEOUT (credit/policy/cancel) do NOT count
// because they are not server-stuck symptoms.
// ─────────────────────────────────────────────────────────────────────

import { submitGpt4oImage, pollGpt4oUntilDone } from '../../../../utils/kieai'
import type {
  RendererExecutor,
  ExecutorInput,
  ExecutorOutput,
} from '../types'
import type { ImageAspectRatio } from '../../renderContract'

// ─── Circuit breaker state (module-level, shared across executors) ─

const TRIP_THRESHOLD = 2
const AUTO_RESET_MS = 60_000

let consecutiveTimeouts = 0
let circuitTripped = false
let lastCallTs = 0
let trippedAt = 0

/** Reset breaker — called at the start of a full batch run. */
export function resetKieHealth(): void {
  consecutiveTimeouts = 0
  circuitTripped = false
  trippedAt = 0
}

/** Read breaker state with stale auto-reset. */
export function isKieUnhealthy(): boolean {
  if (circuitTripped && Date.now() - lastCallTs > AUTO_RESET_MS) {
    // No calls for AUTO_RESET_MS → KIE may have recovered, give next call a chance
    resetKieHealth()
    return false
  }
  return circuitTripped
}

/** Telemetry snapshot — used by UI to render the degraded banner. */
export function getKieHealthSnapshot() {
  return {
    consecutiveTimeouts,
    tripped: circuitTripped,
    trippedAt,
    secondsSinceLastCall: lastCallTs ? Math.round((Date.now() - lastCallTs) / 1000) : null,
  }
}

function recordKieResult(result: 'success' | 'timeout' | 'other'): void {
  lastCallTs = Date.now()
  if (result === 'success') {
    consecutiveTimeouts = 0
    circuitTripped = false
    trippedAt = 0
    return
  }
  if (result === 'timeout') {
    consecutiveTimeouts++
    if (consecutiveTimeouts >= TRIP_THRESHOLD && !circuitTripped) {
      circuitTripped = true
      trippedAt = Date.now()
      console.warn(`[kie-gpt4o] CIRCUIT TRIPPED — ${consecutiveTimeouts} consecutive timeouts, fast-failing subsequent calls for ${AUTO_RESET_MS / 1000}s of inactivity or until resetKieHealth()`)
    }
    return
  }
  // 'other' — non-timeout failures (credit / policy / cancel) don't count
}

// ─── Aspect ratio map (ImageAspectRatio → KIE Gpt4oSize) ───────────

const ASPECT_MAP: Record<ImageAspectRatio, '1:1' | '3:2' | '2:3'> = {
  '1:1':  '1:1',
  '4:5':  '2:3',
  '3:4':  '2:3',
  '9:16': '2:3',
  '16:9': '3:2',
}

export interface KieGpt4oImageExecutorOptions {
  apiKey: string
  timeoutMs?: number
  signal?: AbortSignal
}

/** OPT.5 (2026-05-28) — KIE gpt-4o executor with reduced timeout + auto-retry.
 *  - Default timeout: 2min (was 4min) — fail-fast on stuck queues
 *  - Auto-retry 1 lần on transient failure (timeout / network)
 *  - Hard failures (INSUFFICIENT_CREDITS / CANCELLED / content_policy) → no retry */
export function createKieGpt4oImageExecutor(
  options: KieGpt4oImageExecutorOptions,
): RendererExecutor {
  const timeoutMs = options.timeoutMs ?? 120_000  // 2 min (was 4 min)
  const MAX_ATTEMPTS = 2

  return {
    renderer: 'gpt4o',

    async generate(input: ExecutorInput): Promise<ExecutorOutput> {
      if (!options.apiKey) {
        return {
          status: 'failed',
          images: [],
          failureReason: 'KIE API key missing — set in Settings before generation',
        }
      }
      if (!input.prompt.prompt || input.prompt.prompt.trim().length === 0) {
        return {
          status: 'malformed',
          images: [],
          failureReason: 'KIE rejected: empty scene prompt from synthesis',
        }
      }

      // CIRCUIT BREAKER (2026-05-31) — fast-fail if KIE queue has shown
      // sustained timeouts in this session. Caller (UI banner) can detect
      // the 'KIE_DEGRADED:' prefix and surface a recovery hint.
      if (isKieUnhealthy()) {
        console.warn(`[kie-gpt4o] section=${input.sectionId} fast-failed — circuit breaker tripped (KIE queue degraded)`)
        return {
          status: 'failed',
          images: [],
          failureReason: 'KIE_DEGRADED: bỏ qua vì queue KIE đang nghẽn (đã có ≥2 timeout liên tiếp). Thử lại sau ~1-2 phút khi KIE hồi.',
        }
      }

      const size: '1:1' | '3:2' | '2:3' = input.aspectRatio
        ? ASPECT_MAP[input.aspectRatio]
        : '2:3'

      const filesUrl = input.references
        .map((r) => r.url)
        .filter(Boolean)
        .slice(0, 5)

      let lastError: ExecutorOutput | null = null

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        console.info(`[kie-gpt4o] attempt ${attempt}/${MAX_ATTEMPTS} section=${input.sectionId} promptLen=${input.prompt.prompt.length} refs=${filesUrl.length}`)

      let taskId: string
      try {
        const submission = await submitGpt4oImage({
          apiKey: options.apiKey,
          prompt: input.prompt.prompt,
          filesUrl: filesUrl.length > 0 ? filesUrl : undefined,
          size,
        })
        taskId = submission.taskId
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'KIE gpt-4o submit threw'
        // HARD failures — no retry, no circuit-counter (not server-stuck)
        if (msg.includes('INSUFFICIENT_CREDITS')) {
          recordKieResult('other')
          return {
            status: 'failed',
            images: [],
            failureReason: 'KIE: insufficient credits — top up before retrying',
          }
        }
        // SOFT — submit-level network/timeout counts as transient, not the
        // queue-stuck symptom we care about, so record as 'other' (no trip).
        recordKieResult('other')
        lastError = {
          status: 'failed',
          images: [],
          failureReason: `KIE gpt-4o submit failed: ${msg}`,
        }
        console.warn(`[kie-gpt4o] attempt ${attempt} submit error: ${msg.slice(0, 120)}`)
        if (attempt < MAX_ATTEMPTS) continue
        return lastError
      }

      try {
        const imageUrl = await pollGpt4oUntilDone({
          apiKey: options.apiKey,
          taskId,
          timeoutMs,
          signal: options.signal,
        })
        recordKieResult('success')
        return {
          status: 'ok',
          images: [{ url: imageUrl }],
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'KIE gpt-4o poll threw'
        if (msg.includes('CANCELLED')) {
          recordKieResult('other')
          return {
            status: 'failed',
            images: [],
            failureReason: 'Cancelled by user',
          }
        }
        if (msg.includes('TIMEOUT')) {
          // SOFT — track for circuit breaker + retry within attempt budget
          recordKieResult('timeout')
          lastError = {
            status: 'failed',
            images: [],
            failureReason: `KIE gpt-4o timeout (${Math.round(timeoutMs / 1000)}s) — task may be stuck`,
          }
          console.warn(`[kie-gpt4o] attempt ${attempt} timeout after ${Math.round(timeoutMs / 1000)}s`)
          // If breaker just tripped, abort remaining in-attempt retries —
          // subsequent calls in this batch will fast-fail at the entry guard.
          if (isKieUnhealthy()) return lastError
          if (attempt < MAX_ATTEMPTS) continue
          return lastError
        }
        // Hard failures: GENERATE_FAILED, content_policy, malformed output
        if (msg.includes('GENERATE_FAILED') || msg.includes('content_policy')) {
          recordKieResult('other')
          return {
            status: 'failed',
            images: [],
            failureReason: `KIE gen rejected: ${msg.slice(0, 200)}`,
          }
        }
        // Other transient — retry once
        recordKieResult('other')
        lastError = {
          status: 'malformed',
          images: [],
          failureReason: msg.slice(0, 240),
        }
        console.warn(`[kie-gpt4o] attempt ${attempt} poll error: ${msg.slice(0, 120)}`)
        if (attempt < MAX_ATTEMPTS) continue
        return lastError
      }
      } // end for-loop

      return lastError ?? {
        status: 'failed',
        images: [],
        failureReason: 'KIE gpt-4o exhausted retries with no specific error',
      }
    },
  }
}
