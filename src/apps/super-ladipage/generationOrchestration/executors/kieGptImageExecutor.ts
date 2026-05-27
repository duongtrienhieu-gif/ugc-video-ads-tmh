// ─────────────────────────────────────────────────────────────────────
// Generation Orchestration — KIE gpt-image-2 executor (LIVE)
//
// Wraps KIE.ai gpt-image-2 (the codebase's canonical image-gen gateway)
// in the P12 RendererExecutor interface. Replaces MockExecutor in
// production paths when API key is present.
//
// LOCKED: NO prompt mutation. Prompt fed verbatim from upstream adapter.
// LOCKED: NO aesthetic enhancement. KIE is a deterministic translator
// of (prompt + references) → image — orchestrator stays semantic-only.
//
// KIE supports up to 5 reference images (filesUrl). We pass through
// section.references untouched.
// ─────────────────────────────────────────────────────────────────────

import { submitGptImage2, pollGptImage2UntilDone } from '../../../../utils/kieai'
import type {
  RendererExecutor,
  ExecutorInput,
  ExecutorOutput,
} from '../types'
import type { ImageAspectRatio } from '../../renderContract'

// ─── Aspect ratio map (ImageAspectRatio → KIE Gpt4oSize) ───────────
//
// KIE supports '1:1' / '3:2' / '2:3' only. Our taxonomy is larger —
// map to the closest KIE option preserving orientation.

const ASPECT_MAP: Record<ImageAspectRatio, '1:1' | '3:2' | '2:3'> = {
  '1:1':  '1:1',
  '4:5':  '2:3',  // portrait-ish
  '3:4':  '2:3',
  '9:16': '2:3',
  '16:9': '3:2',  // landscape
}

export interface KieGptImageExecutorOptions {
  /** KIE.ai API key (from useSettingsStore.kieApiKey). */
  apiKey: string
  /** Resolution. '1K' = web-default + cheapest (6 credits). */
  resolution?: '1K' | '2K' | '4K'
  /** Timeout per generation (ms). Default 4 min. */
  timeoutMs?: number
  /** Optional abort signal for cancel. */
  signal?: AbortSignal
}

export function createKieGptImageExecutor(
  options: KieGptImageExecutorOptions,
): RendererExecutor {
  return {
    renderer: 'gptImage',

    async generate(input: ExecutorInput): Promise<ExecutorOutput> {
      // ── Guard: API key required ────────────────────────────────
      if (!options.apiKey) {
        return {
          status: 'failed',
          images: [],
          failureReason: 'KIE API key missing — set in Settings before generation',
        }
      }

      // ── Guard: prompt non-empty ────────────────────────────────
      if (!input.prompt.prompt || input.prompt.prompt.trim().length === 0) {
        return {
          status: 'malformed',
          images: [],
          failureReason: 'KIE rejected: empty prompt from adapter',
        }
      }

      // ── Map aspect ratio ───────────────────────────────────────
      const size: '1:1' | '3:2' | '2:3' = input.aspectRatio
        ? ASPECT_MAP[input.aspectRatio]
        : '2:3'  // mobile-default (portrait)

      // ── Collect reference URLs (max 5 per KIE limit) ──────────
      const filesUrl = input.references
        .map((r) => r.url)
        .filter(Boolean)
        .slice(0, 5)

      // ── Submit task ────────────────────────────────────────────
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
        // Insufficient credits is the explicit failure mode KIE surfaces
        if (msg.includes('INSUFFICIENT_CREDITS')) {
          return {
            status: 'failed',
            images: [],
            failureReason: 'KIE: insufficient credits — top up before retrying',
          }
        }
        return {
          status: 'failed',
          images: [],
          failureReason: `KIE submit failed: ${msg}`,
        }
      }

      // ── Poll until done ────────────────────────────────────────
      try {
        const imageUrl = await pollGptImage2UntilDone({
          apiKey: options.apiKey,
          taskId,
          timeoutMs: options.timeoutMs,
          signal: options.signal,
        })
        return {
          status: 'ok',
          images: [{ url: imageUrl }],
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'KIE poll threw'
        // Distinguish timeout / abort from malformed output
        if (msg.includes('CANCELLED')) {
          return {
            status: 'failed',
            images: [],
            failureReason: 'Cancelled by user',
          }
        }
        if (msg.includes('TIMEOUT')) {
          return {
            status: 'failed',
            images: [],
            failureReason: `KIE timeout (${Math.round((options.timeoutMs ?? 240000) / 1000)}s) — task may be stuck`,
          }
        }
        // Anything else is a generation failure (malformed output / API error)
        return {
          status: 'malformed',
          images: [],
          failureReason: msg.slice(0, 240),
        }
      }
    },
  }
}
