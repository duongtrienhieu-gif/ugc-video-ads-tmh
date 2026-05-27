// ─────────────────────────────────────────────────────────────────────
// Generation Orchestration — KIE gpt-image-2 executor (POST-REBUILD)
//
// Wraps KIE.ai's /jobs/createTask + gpt-image-2-text-to-image. This is
// the cheap text-to-image route — gpt-image-2 ignores reference images,
// so only used for object-trace flat-lays WITHOUT product reference.
//
// Sections needing character continuity OR product reference lock route
// to kieGpt4oImageExecutor instead.
//
// LOCKED: prompt is the SCENE DESCRIPTION from imageSceneSynthesis,
// verbatim. NO prepend / append / hint stacking. (Old productIdentityHint
// prepend hack removed — scene synthesis embeds product context directly
// into the single prompt now.)
// ─────────────────────────────────────────────────────────────────────

import { submitGptImage2, pollGptImage2UntilDone } from '../../../../utils/kieai'
import type {
  RendererExecutor,
  ExecutorInput,
  ExecutorOutput,
} from '../types'
import type { ImageAspectRatio } from '../../renderContract'

const ASPECT_MAP: Record<ImageAspectRatio, '1:1' | '3:2' | '2:3'> = {
  '1:1':  '1:1',
  '4:5':  '2:3',
  '3:4':  '2:3',
  '9:16': '2:3',
  '16:9': '3:2',
}

export interface KieGptImageExecutorOptions {
  apiKey: string
  resolution?: '1K' | '2K' | '4K'
  timeoutMs?: number
  signal?: AbortSignal
}

/** OPT.5 (2026-05-28) — KIE gpt-image-2 executor with reduced timeout + retry.
 *  Default timeout: 2min (was 4min). Auto-retry 1 lần on transient failures. */
export function createKieGptImageExecutor(
  options: KieGptImageExecutorOptions,
): RendererExecutor {
  const timeoutMs = options.timeoutMs ?? 120_000  // 2 min (was 4 min)
  const MAX_ATTEMPTS = 2

  return {
    renderer: 'gptImage',

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

      // gpt-image-2 only used for no-reference flat-lays, but we still
      // pass references when caller chose to send them (safety net).
      const filesUrl = input.references
        .map((r) => r.url)
        .filter(Boolean)
        .slice(0, 5)

      let lastError: ExecutorOutput | null = null

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        console.info(`[kie-gptImage] attempt ${attempt}/${MAX_ATTEMPTS} section=${input.sectionId} promptLen=${input.prompt.prompt.length}`)

      let taskId: string
      try {
        const submission = await submitGptImage2({
          apiKey: options.apiKey,
          prompt: input.prompt.prompt,
          filesUrl: filesUrl.length > 0 ? filesUrl : undefined,
          size,
          resolution: options.resolution ?? '1K',
        })
        taskId = submission.taskId
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'KIE submit threw'
        if (msg.includes('INSUFFICIENT_CREDITS')) {
          return {
            status: 'failed',
            images: [],
            failureReason: 'KIE: insufficient credits — top up before retrying',
          }
        }
        lastError = {
          status: 'failed',
          images: [],
          failureReason: `KIE submit failed: ${msg}`,
        }
        console.warn(`[kie-gptImage] attempt ${attempt} submit error: ${msg.slice(0, 120)}`)
        if (attempt < MAX_ATTEMPTS) continue
        return lastError
      }

      try {
        const imageUrl = await pollGptImage2UntilDone({
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
        const msg = err instanceof Error ? err.message : 'KIE poll threw'
        if (msg.includes('CANCELLED')) {
          return {
            status: 'failed',
            images: [],
            failureReason: 'Cancelled by user',
          }
        }
        if (msg.includes('TIMEOUT')) {
          lastError = {
            status: 'failed',
            images: [],
            failureReason: `KIE timeout (${Math.round(timeoutMs / 1000)}s) — task may be stuck`,
          }
          console.warn(`[kie-gptImage] attempt ${attempt} timeout`)
          if (attempt < MAX_ATTEMPTS) continue
          return lastError
        }
        if (msg.includes('GENERATE_FAILED') || msg.includes('content_policy')) {
          return {
            status: 'failed',
            images: [],
            failureReason: `KIE gen rejected: ${msg.slice(0, 200)}`,
          }
        }
        lastError = {
          status: 'malformed',
          images: [],
          failureReason: msg.slice(0, 240),
        }
        console.warn(`[kie-gptImage] attempt ${attempt} poll error: ${msg.slice(0, 120)}`)
        if (attempt < MAX_ATTEMPTS) continue
        return lastError
      }
      } // end for-loop

      return lastError ?? {
        status: 'failed',
        images: [],
        failureReason: 'KIE gpt-image-2 exhausted retries with no specific error',
      }
    },
  }
}
