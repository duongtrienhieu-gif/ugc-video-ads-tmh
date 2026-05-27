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
// ─────────────────────────────────────────────────────────────────────

import { submitGpt4oImage, pollGpt4oUntilDone } from '../../../../utils/kieai'
import type {
  RendererExecutor,
  ExecutorInput,
  ExecutorOutput,
} from '../types'
import type { ImageAspectRatio } from '../../renderContract'

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
        // HARD failures — no retry
        if (msg.includes('INSUFFICIENT_CREDITS')) {
          return {
            status: 'failed',
            images: [],
            failureReason: 'KIE: insufficient credits — top up before retrying',
          }
        }
        // SOFT — track and retry
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
        return {
          status: 'ok',
          images: [{ url: imageUrl }],
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'KIE gpt-4o poll threw'
        if (msg.includes('CANCELLED')) {
          return {
            status: 'failed',
            images: [],
            failureReason: 'Cancelled by user',
          }
        }
        if (msg.includes('TIMEOUT')) {
          // SOFT — track and retry
          lastError = {
            status: 'failed',
            images: [],
            failureReason: `KIE gpt-4o timeout (${Math.round(timeoutMs / 1000)}s) — task may be stuck`,
          }
          console.warn(`[kie-gpt4o] attempt ${attempt} timeout after ${Math.round(timeoutMs / 1000)}s`)
          if (attempt < MAX_ATTEMPTS) continue
          return lastError
        }
        // Hard failures: GENERATE_FAILED, content_policy, malformed output
        if (msg.includes('GENERATE_FAILED') || msg.includes('content_policy')) {
          return {
            status: 'failed',
            images: [],
            failureReason: `KIE gen rejected: ${msg.slice(0, 200)}`,
          }
        }
        // Other transient — retry once
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
