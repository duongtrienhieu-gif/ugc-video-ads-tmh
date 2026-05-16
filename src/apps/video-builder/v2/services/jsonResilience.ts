// ── JSON Resilience Layer ────────────────────────────────────────────────────
// LLMs are NOT deterministic parsers. Their JSON outputs frequently arrive
// with:
//   • markdown code fences (```json ... ```)
//   • leading or trailing prose ("Here is the storyboard: [...]")
//   • unescaped quotes inside string values
//   • unescaped newlines / tabs inside string values
//   • trailing commas before } or ]
//   • partial truncation (unclosed brackets) on token-limit hits
//   • smart quotes / curly quotes instead of straight ones
//   • control characters from copy-paste
//
// This module is a 3-layer defense:
//   1. extractJson(text)   — locate the JSON region inside arbitrary text
//   2. repairJson(text)    — fix common syntax errors (escaping, trailing commas, unclosed)
//   3. safeParseJson<T>()  — try direct parse → repair → return Result type
//
// Plus a debug log of the raw / extracted / repaired versions for tuning.
// ─────────────────────────────────────────────────────────────────────────────

export interface JsonParseResult<T> {
  ok: true
  data: T
  /** True iff repair was needed to make this parse succeed */
  repairUsed: boolean
}

export interface JsonParseError {
  ok: false
  error: string
  /** The JSON region extracted from the raw text (or raw text if no region found) */
  rawExtracted: string
  /** The repaired version that still failed to parse (only present if repair attempted) */
  rawRepaired?: string
}

export type SafeParseResult<T> = JsonParseResult<T> | JsonParseError

// ── 1) extractJson — find the JSON region ────────────────────────────────────

/**
 * Locate and return the JSON region within arbitrary LLM output.
 * Strategy:
 *   1. Strip markdown code fences (```json ... ```)
 *   2. Convert smart/curly quotes → straight quotes (LLM-isms)
 *   3. Find the first { or [ that begins a balanced region
 *   4. Walk forward, tracking string state + depth, to find the matching close
 *   5. Return the substring; if no balanced close found, return the slice from
 *      the first { / [ to the end of the input (repair layer can try to close)
 */
export function extractJson(text: string): string {
  let cleaned = text.trim()

  // Strip markdown code fences in various forms: ```json ... ``` / ``` ... ```
  cleaned = cleaned
    .replace(/^```(?:json|JSON|javascript|js|ts)?\s*\n?/i, '')
    .replace(/\n?\s*```\s*$/i, '')
    .trim()

  // Normalize smart quotes that LLMs sometimes emit (U+201C/U+201D/U+2018/U+2019)
  cleaned = cleaned
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")

  // Find first { or [ — start of probable JSON region
  let startIdx = -1
  let openChar = ''
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{' || cleaned[i] === '[') {
      startIdx = i
      openChar = cleaned[i]
      break
    }
  }
  if (startIdx < 0) return cleaned

  const closeChar = openChar === '{' ? '}' : ']'

  // Walk forward, tracking string state + nesting depth, to find matching close
  let depth = 0
  let inString = false
  let escaped = false
  let endIdx = -1

  for (let i = startIdx; i < cleaned.length; i++) {
    const ch = cleaned[i]

    if (escaped) { escaped = false; continue }
    if (ch === '\\') { escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue

    if (ch === openChar) depth++
    else if (ch === closeChar) {
      depth--
      if (depth === 0) { endIdx = i; break }
    }
  }

  // If we found a balanced close, return just the JSON region
  if (endIdx >= 0) return cleaned.slice(startIdx, endIdx + 1)

  // Unclosed — return from start onwards; repairJson() will try to close it
  return cleaned.slice(startIdx)
}

// ── 2) repairJson — fix common syntax errors ────────────────────────────────

/**
 * Repair common LLM JSON syntax issues. Walks the text character by character,
 * tracks whether we're inside a string, and escapes/replaces problematic chars.
 * Then post-processes to strip trailing commas and append missing close brackets.
 */
export function repairJson(text: string): string {
  let out = ''
  let inStr = false
  let esc = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (esc) {
      out += ch
      esc = false
      continue
    }
    if (ch === '\\') {
      out += ch
      esc = true
      continue
    }
    if (ch === '"') {
      // Heuristic: if we see a stray `"` inside a string that's followed by
      // a non-terminator character (not `}`, `]`, `,`, `:` or whitespace),
      // it's likely an unescaped quote inside a value — escape it.
      if (inStr) {
        // Look ahead: is this a real closing quote, or a stray inner quote?
        let j = i + 1
        while (j < text.length && (text[j] === ' ' || text[j] === '\t')) j++
        const next = text[j]
        // Real closer follows by: , } ] : end-of-input. Otherwise stray.
        if (next !== undefined && next !== ',' && next !== '}' && next !== ']' && next !== ':' && next !== '\n' && next !== '\r' && next !== '' && j !== text.length) {
          // Stray — escape it
          out += '\\"'
          continue
        }
      }
      inStr = !inStr
      out += ch
      continue
    }

    if (inStr) {
      // Inside string: escape control chars
      if (ch === '\n') out += '\\n'
      else if (ch === '\r') out += '\\r'
      else if (ch === '\t') out += '\\t'
      else if (ch.charCodeAt(0) < 0x20) out += '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0')
      else out += ch
    } else {
      out += ch
    }
  }

  // Strip trailing commas (`,]` or `,}` or `,\n]` etc.)
  out = out.replace(/,(\s*[}\]])/g, '$1')

  // Strip stray prose tags Gemini sometimes adds:
  //   "scene_goal": /* explanation */ "value"
  out = out.replace(/\/\*[\s\S]*?\*\//g, '')
  out = out.replace(/\/\/[^\n]*\n/g, '\n')

  // Try to close unbalanced brackets — count opens vs closes outside strings
  const balance = countUnbalanced(out)
  for (let i = 0; i < balance.openCurly - balance.closeCurly; i++) out += '}'
  for (let i = 0; i < balance.openSquare - balance.closeSquare; i++) out += ']'

  return out
}

function countUnbalanced(text: string): { openCurly: number; closeCurly: number; openSquare: number; closeSquare: number } {
  let openCurly = 0, closeCurly = 0, openSquare = 0, closeSquare = 0
  let inStr = false
  let esc = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (esc) { esc = false; continue }
    if (ch === '\\') { esc = true; continue }
    if (ch === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (ch === '{') openCurly++
    else if (ch === '}') closeCurly++
    else if (ch === '[') openSquare++
    else if (ch === ']') closeSquare++
  }
  return { openCurly, closeCurly, openSquare, closeSquare }
}

// ── 3) safeParseJson — full pipeline ─────────────────────────────────────────

/**
 * Production-grade JSON parser for LLM output. Returns a discriminated Result.
 * Never throws. Caller pattern:
 *   const r = safeParseJson<MySchema>(geminiResponse)
 *   if (!r.ok) { ...handle error, maybe retry... }
 *   else { use r.data }
 */
export function safeParseJson<T = unknown>(rawText: string): SafeParseResult<T> {
  const extracted = extractJson(rawText)

  // Attempt 1: direct parse on extracted region
  try {
    const data = JSON.parse(extracted) as T
    return { ok: true, data, repairUsed: false }
  } catch { /* try repair */ }

  // Attempt 2: repair, then parse
  const repaired = repairJson(extracted)
  try {
    const data = JSON.parse(repaired) as T
    console.warn('[safeParseJson] direct parse failed, succeeded after repair')
    return { ok: true, data, repairUsed: true }
  } catch (err) {
    return {
      ok: false,
      error: (err as Error).message,
      rawExtracted: extracted.slice(0, 800),
      rawRepaired: repaired.slice(0, 800),
    }
  }
}

// ── Debug logging helper ─────────────────────────────────────────────────────

/**
 * Log a JSON parse failure to console with the raw + extracted + repaired
 * versions. Use this in the catch path so user gets enough info to tune
 * the system prompt or report a bug.
 */
export function logJsonFailure(label: string, rawText: string, result: JsonParseError): void {
  console.group(`[${label}] JSON parse FAILED — ${result.error}`)
  console.log('Raw Gemini output (first 1000 chars):')
  console.log(rawText.slice(0, 1000))
  console.log('---')
  console.log('Extracted region:')
  console.log(result.rawExtracted)
  console.log('---')
  if (result.rawRepaired) {
    console.log('After repair (still failed):')
    console.log(result.rawRepaired)
  }
  console.groupEnd()
}
