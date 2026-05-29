// ─────────────────────────────────────────────────────────────────────
// Generation Orchestration — MockExecutor (P12)
//
// Synthetic executor for dev / tests / preview. Returns a placeholder
// SVG data URI tagged with the section + renderer + prompt-snippet so
// downstream consumers can visually verify the orchestration plan
// without making real API calls.
//
// NO real API calls. NO API keys. NO cost. NO side effects.
//
// Real DALL-E / Flux / SDXL executors = P12.5+, separate files,
// optional dependencies (must NOT be required by orchestration core).
// ─────────────────────────────────────────────────────────────────────

import type {
  RendererExecutor,
  ExecutorInput,
  ExecutorOutput,
} from '../types'
import type { RendererKey } from '../../rendererAdapters'

export interface MockExecutorOptions {
  /** Renderer this mock claims to handle. */
  renderer: RendererKey
  /** Simulated latency in ms. Default 0 (instant). */
  latencyMs?: number
  /** Probability of returning status='failed' (0-1). Default 0. */
  failureRate?: number
  /** Probability of returning status='malformed' (0-1). Default 0. */
  malformedRate?: number
  /** Optional deterministic seed for reproducible failure injection. */
  seed?: number
}

/** Create a mock executor — synthetic SVG placeholder images. */
export function createMockExecutor(options: MockExecutorOptions): RendererExecutor {
  const {
    renderer,
    latencyMs = 0,
    failureRate = 0,
    malformedRate = 0,
    seed,
  } = options

  let rngState = seed ?? 0xC0FFEE

  const nextRandom = (): number => {
    // Simple LCG for deterministic test runs
    rngState = (rngState * 1103515245 + 12345) & 0x7FFFFFFF
    return rngState / 0x7FFFFFFF
  }

  return {
    renderer,
    async generate(input: ExecutorInput): Promise<ExecutorOutput> {
      if (latencyMs > 0) {
        await new Promise((r) => setTimeout(r, latencyMs))
      }

      const roll = seed === undefined ? Math.random() : nextRandom()
      if (roll < failureRate) {
        return {
          status: 'failed',
          images: [],
          failureReason: 'mock: simulated executor failure',
        }
      }
      if (roll < failureRate + malformedRate) {
        return {
          status: 'malformed',
          images: [],
          failureReason: 'mock: simulated malformed output',
        }
      }

      // Synthetic placeholder SVG — encodes plan metadata for QA
      const svg = buildPlaceholderSvg({
        renderer,
        sectionId: input.sectionId,
        imageRole: input.imageRole,
        aspectRatio: input.aspectRatio,
        attempt: input.attempt,
        promptSnippet: input.prompt.prompt.slice(0, 80),
        referenceCount: input.references.length,
      })

      return {
        status: 'ok',
        images: [
          {
            url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
            width: 512,
            height: 512,
          },
        ],
      }
    },
  }
}

// ─── helpers ─────────────────────────────────────────────────────

interface PlaceholderInfo {
  renderer: RendererKey
  sectionId: string
  imageRole: string
  aspectRatio?: string
  attempt: number
  promptSnippet: string
  referenceCount: number
}

function buildPlaceholderSvg(info: PlaceholderInfo): string {
  const labelLines = [
    `[MOCK] ${info.renderer}`,
    `section: ${info.sectionId}`,
    `role: ${info.imageRole}`,
    info.aspectRatio ? `ratio: ${info.aspectRatio}` : '',
    `refs: ${info.referenceCount}`,
    `attempt: ${info.attempt}`,
    `prompt: ${info.promptSnippet}${info.promptSnippet.length === 80 ? '…' : ''}`,
  ].filter(Boolean)

  const textElements = labelLines
    .map(
      (line, i) =>
        `<text x="20" y="${40 + i * 22}" font-family="monospace" font-size="13" fill="#444">${escapeXml(line)}</text>`,
    )
    .join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">` +
    `<rect width="512" height="512" fill="#f5f5f4" stroke="#a8a29e" stroke-dasharray="6 4"/>` +
    textElements +
    `</svg>`
  )
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
