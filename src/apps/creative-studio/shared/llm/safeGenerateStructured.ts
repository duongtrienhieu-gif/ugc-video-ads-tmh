// ── Safe Structured Generation Wrapper (P12-fix) ────────────────────────────
//
// Top-level helper used by every engine that needs structured LLM output:
//
//   const result = await safeGenerateStructured({
//     apiKey,
//     prompt,
//     systemInstruction,
//     maxOutputTokens,
//     schema: { validate, name },
//     fallback: { ...sane defaults... },
//     retries: 2,
//     generatorLabel: 'designed-graphic infographic',
//   })
//   // result.value is ALWAYS defined when fallback is supplied
//   // result.ok tells you whether the fallback was used
//
// Pipeline:
//   1. Call Gemini with responseMimeType: 'application/json' to force
//      structured output at the source (Gemini's built-in JSON mode)
//   2. Pipe response through extractStructuredJson (markdown fence,
//      smart quote, trailing comma, unterminated string repairs)
//   3. Validate against caller schema
//   4. If parse fails: retry up to N times with a harder instruction
//      ("RETURN STRICT VALID JSON ONLY")
//   5. After retries exhausted: return fallback (never throw)

import { directGeminiText } from '../../../../utils/gemini'
import { extractStructuredJson, type SchemaCheck } from './extractStructuredJson'

export interface SafeGenerateOptions<T> {
  apiKey: string
  prompt: string
  systemInstruction?: string
  maxOutputTokens?: number
  /** Schema check for the parsed value. */
  schema: SchemaCheck<T>
  /** Fallback used when all retries fail. */
  fallback: T
  /** Max additional attempts after the first. Default 2 → up to 3 total. */
  retries?: number
  /** Label for diagnostic logs. */
  generatorLabel: string
}

export interface SafeGenerateResult<T> {
  /** True if the LLM produced a valid result; false if fallback was used. */
  ok: boolean
  /** Always defined — either parsed value or fallback. */
  value: T
  /** How many LLM calls were made (1 + retries on failure). */
  attempts: number
  /** Last extraction failure reason (only set when ok=false). */
  reason?: string
}

const STRICT_SUFFIX =
  '\n\nIMPORTANT: Return STRICT VALID JSON ONLY. No prose. No markdown fence. '
  + 'No trailing commas. Use straight ASCII double quotes (") only — NEVER '
  + 'smart quotes (" ”). Escape all newlines inside string values as \\n. '
  + 'Do NOT truncate; if you need to be shorter, abbreviate values rather than '
  + 'leaving the JSON incomplete.'

export async function safeGenerateStructured<T>(
  opts: SafeGenerateOptions<T>,
): Promise<SafeGenerateResult<T>> {
  const maxAttempts = 1 + Math.max(0, opts.retries ?? 2)
  let lastReason: string | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const prompt = attempt === 1 ? opts.prompt : opts.prompt + STRICT_SUFFIX
    let raw: string
    try {
      raw = await directGeminiText({
        apiKey: opts.apiKey,
        prompt,
        systemInstruction: opts.systemInstruction,
        maxOutputTokens: opts.maxOutputTokens,
        // ── Critical fix: tell Gemini we want JSON. The model's
        //    server-side validator forces well-formed output. ──────
        responseMimeType: 'application/json',
      })
    } catch (err) {
      lastReason = `gemini call failed: ${(err as Error).message}`
      console.warn(`[safeGenerateStructured:${opts.generatorLabel}] attempt ${attempt}/${maxAttempts} — ${lastReason}`)
      continue
    }

    const ex = extractStructuredJson<T>(raw, {
      schema: opts.schema,
      generatorLabel: `${opts.generatorLabel}:attempt-${attempt}`,
    })
    if (ex.ok && ex.value !== null) {
      if (ex.repairs.length > 0) {
        console.info(`[safeGenerateStructured:${opts.generatorLabel}] succeeded after repairs: ${ex.repairs.join(', ')}`)
      }
      return { ok: true, value: ex.value, attempts: attempt }
    }
    lastReason = ex.reason
    console.warn(`[safeGenerateStructured:${opts.generatorLabel}] attempt ${attempt}/${maxAttempts} unparseable — ${ex.reason}`)
  }

  // All attempts exhausted — return fallback
  console.warn(`[safeGenerateStructured:${opts.generatorLabel}] all ${maxAttempts} attempts failed; using fallback (last reason: ${lastReason})`)
  return {
    ok: false,
    value: opts.fallback,
    attempts: maxAttempts,
    reason: lastReason,
  }
}
