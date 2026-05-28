import { directGeminiText } from '../../../utils/gemini'
import { kieTextGenerate } from '../../../utils/kieai'
import { withTimeout } from './withTimeout'

// ─────────────────────────────────────────────────────────────────────
// textGenWithFallback — fallback chain cho text generation.
//
// Bug đã gặp: Gemini 503 (Service Unavailable) khi peak hour SEA.
//
// Strategy:
//   1. Try directGeminiText (Google direct, JSON mode, nhanh nhất)
//   2. Nếu 503/quá tải → fallback kieTextGenerate (gpt-4o-mini qua KIE,
//      paid tier, không rate limit)
//   3. Cả 2 đều fail → throw error tổng hợp
//
// KIE không có JSON mode native nên ta thêm "Output JSON only, no prose"
// vào prompt khi fallback.
// ─────────────────────────────────────────────────────────────────────

export interface TextGenInput {
  geminiApiKey:        string
  kieApiKey:           string
  prompt:              string
  systemInstruction?:  string
  /** Bắt buộc JSON output. Gemini dùng responseMimeType, KIE chỉ pad prompt. */
  jsonMode?:           boolean
  maxOutputTokens?:    number
  /** Timeout cho mỗi provider riêng. */
  timeoutMs?:          number
  label?:              string
}

function isGeminiOverloadError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  return (
    msg.includes('503') ||
    msg.includes('quá tải') ||
    msg.includes('overload') ||
    msg.includes('unavailable') ||
    msg.includes('rate limit') ||
    msg.includes('429') ||
    msg.includes('không có model khả dụng') ||
    msg.includes('timeout')
  )
}

export async function textGenWithFallback(input: TextGenInput): Promise<string> {
  const timeout = input.timeoutMs ?? 120_000
  const label = input.label ?? 'textGen'

  // ─── Try 1: Gemini direct (JSON mode if requested) ───
  try {
    console.log(`[${label}] try 1/2 — Gemini direct${input.jsonMode ? ' (JSON mode)' : ''}, timeout ${Math.round(timeout / 1000)}s...`)
    const startedAt = Date.now()
    const result = await withTimeout(
      directGeminiText({
        apiKey:             input.geminiApiKey,
        prompt:             input.prompt,
        systemInstruction:  input.systemInstruction,
        responseMimeType:   input.jsonMode ? 'application/json' : undefined,
        maxOutputTokens:    input.maxOutputTokens,
      }),
      timeout,
      `${label} (Gemini)`,
    )
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
    console.log(`[${label}] Gemini OK in ${elapsed}s — ${result.length} chars`)
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!isGeminiOverloadError(err)) {
      // Lỗi không phải overload → throw luôn, đừng phí credit KIE
      console.error(`[${label}] Gemini hard-failed: ${msg.slice(0, 200)}`)
      throw err
    }
    console.warn(`[${label}] Gemini overloaded (${msg.slice(0, 100)}) — falling back to KIE...`)
  }

  // ─── Try 2: KIE text proxy (gpt-4o-mini) ───
  // KIE không support JSON mode → pad prompt với instruction
  const padded = input.jsonMode
    ? `${input.prompt}\n\nIMPORTANT: Output JSON ONLY. No markdown fences. No prose. No "Here is the JSON:" prefix.`
    : input.prompt
  const sys = input.jsonMode && input.systemInstruction
    ? `${input.systemInstruction}\n\nALWAYS output valid JSON only. Never wrap in markdown fences.`
    : input.systemInstruction

  try {
    console.log(`[${label}] try 2/2 — KIE proxy (gpt-4o-mini fallback), timeout ${Math.round(timeout / 1000)}s...`)
    const startedAt = Date.now()
    const result = await withTimeout(
      kieTextGenerate(input.kieApiKey, padded, sys),
      timeout,
      `${label} (KIE)`,
    )
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
    console.log(`[${label}] KIE OK in ${elapsed}s — ${result.length} chars`)
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[${label}] KIE also failed: ${msg.slice(0, 200)}`)
    throw new Error(
      `Cả Gemini và KIE đều thất bại. ` +
      `Gemini có thể đang quá tải (peak hour SEA — thử lại sau 5-10 phút). ` +
      `KIE lỗi: ${msg.slice(0, 150)}`,
    )
  }
}
