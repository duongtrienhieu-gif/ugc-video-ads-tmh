// ── LLM JSON Response Helpers (P9) ──────────────────────────────────────────
//
// Gemini text responses occasionally come back wrapped in a markdown
// code fence even when the system instruction says "no fences". This
// helper strips the fence and parses; throws a tagged error with the
// raw payload prefix so callers know exactly which generator failed.
//
// Was duplicated in ui-native/_shared/textPayload.ts (stripJsonFence)
// and designed-graphic/_textPayload.ts (stripFence) pre-P9.

/** Strip a leading ```json or ``` fence + trailing ``` fence if present. */
export function stripJsonFence(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
}

/**
 * Parse a Gemini text response as JSON of the expected shape. Throws
 * a tagged error with the failing-generator label + a short preview
 * of the offending payload so debug logs are actionable.
 */
export function parseLLMJson<T>(raw: string, generatorLabel: string): T {
  const cleaned = stripJsonFence(raw).trim()
  try {
    return JSON.parse(cleaned) as T
  } catch (err) {
    const preview = cleaned.slice(0, 120).replace(/\s+/g, ' ')
    throw new Error(
      `[${generatorLabel}] JSON parse failed: ${(err as Error).message}. `
      + `First 120 chars: "${preview}…"`,
    )
  }
}
