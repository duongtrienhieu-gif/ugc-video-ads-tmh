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
//   • invisible Unicode (BOM, zero-width spaces, line/paragraph separators)
//   • unterminated strings on partial responses
//
// This module is a 4-stage defense:
//   0. sanitizeUnicode(text) — strip BOM, zero-width, line separator chars
//   1. extractJson(text)     — locate the JSON region inside arbitrary text
//   2. repairJson(text)      — fix common syntax errors (escaping, trailing
//                              commas, unclosed strings, unclosed brackets)
//   3. safeParseJson<T>()    — try direct parse → repair → return Result type
//
// Plus debug log helpers + error position extraction for inspection.
// ─────────────────────────────────────────────────────────────────────────────

export interface JsonParseResult<T> {
  ok: true
  data: T
  /** True iff repair was needed to make this parse succeed */
  repairUsed: boolean
  /** True iff unicode sanitization was needed */
  sanitizationUsed?: boolean
}

export interface JsonParseError {
  ok: false
  error: string
  /** Error position info (line, column, char index) — best-effort extracted from JSON.parse error message */
  errorPosition?: { index?: number; line?: number; column?: number }
  /** The JSON region extracted from the raw text (or raw text if no region found) */
  rawExtracted: string
  /** The repaired version that still failed to parse (only present if repair attempted) */
  rawRepaired?: string
}

export type SafeParseResult<T> = JsonParseResult<T> | JsonParseError

// ── 0) sanitizeUnicode — pre-extract cleanup of invisible / weird chars ─────
// We use String.fromCharCode for the regex char-class to avoid embedding
// problematic literal codepoints (U+2028 / U+2029) in this source file —
// some TS parsers reject them as in-source line terminators.

const BOM = String.fromCharCode(0xFEFF)
const ZWSP = String.fromCharCode(0x200B)  // zero-width space
const ZWNJ = String.fromCharCode(0x200C)  // zero-width non-joiner
const ZWJ  = String.fromCharCode(0x200D)  // zero-width joiner
const WJ   = String.fromCharCode(0x2060)  // word joiner
const LS   = String.fromCharCode(0x2028)  // line separator
const PS   = String.fromCharCode(0x2029)  // paragraph separator

const ZERO_WIDTH_RE = new RegExp(`[${ZWSP}${ZWNJ}${ZWJ}${WJ}]`, 'g')
const LINE_SEP_RE   = new RegExp(`[${LS}${PS}]`, 'g')
const BOM_RE        = new RegExp(`^${BOM}`)

/**
 * Strip invisible / problematic Unicode characters that frequently break
 * JSON.parse even when the content "looks" valid:
 *   • U+FEFF (BOM) at start
 *   • U+200B/200C/200D/2060 (zero-width characters anywhere)
 *   • U+2028/U+2029 (line/paragraph separator — replaced with \n)
 *
 * Returns the cleaned text and a flag indicating whether anything changed.
 */
export function sanitizeUnicode(text: string): { cleaned: string; changed: boolean } {
  const before = text
  const cleaned = text
    .replace(BOM_RE, '')
    .replace(ZERO_WIDTH_RE, '')
    .replace(LINE_SEP_RE, '\n')
  const changed = cleaned !== before
  return { cleaned, changed }
}

// ── Error position extraction (best-effort) ─────────────────────────────────

const POS_REGEX = /position\s+(\d+)/i

function extractErrorPosition(message: string, source: string): JsonParseError['errorPosition'] {
  const m = message.match(POS_REGEX)
  if (!m) return undefined
  const index = parseInt(m[1], 10)
  if (isNaN(index)) return undefined
  // Calculate line + column
  let line = 1, column = 1
  for (let i = 0; i < Math.min(index, source.length); i++) {
    if (source[i] === '\n') { line++; column = 1 }
    else column++
  }
  return { index, line, column }
}

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
 * Then post-processes to strip trailing commas, complete unterminated strings,
 * and append missing close brackets.
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
        if (next !== undefined && next !== ',' && next !== '}' && next !== ']' && next !== ':' && next !== '\n' && next !== '\r' && j !== text.length) {
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

  // ── Quote completion: if the final state left us inside a string, close it ──
  // Walk the output one more time to detect if we ended mid-string.
  // If yes, append a closing quote so the string is terminated.
  let finalInStr = false
  let finalEsc = false
  for (let i = 0; i < out.length; i++) {
    const ch = out[i]
    if (finalEsc) { finalEsc = false; continue }
    if (ch === '\\') { finalEsc = true; continue }
    if (ch === '"') finalInStr = !finalInStr
  }
  if (finalInStr) out += '"'

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
 *
 * Full pipeline (4 stages):
 *   0. sanitizeUnicode — strip BOM, zero-width, line separator chars
 *   1. extractJson — locate balanced { } or [ ] region
 *   2. JSON.parse — fast path
 *   3. On fail → repairJson + retry parse
 */
export function safeParseJson<T = unknown>(rawText: string): SafeParseResult<T> {
  // Stage 0: Unicode sanitization
  const { cleaned, changed: sanitizationUsed } = sanitizeUnicode(rawText)

  // Stage 1: Extract JSON region
  const extracted = extractJson(cleaned)

  // Stage 2: direct parse on extracted region
  try {
    const data = JSON.parse(extracted) as T
    return { ok: true, data, repairUsed: false, sanitizationUsed }
  } catch { /* try repair */ }

  // Stage 3: repair, then parse
  const repaired = repairJson(extracted)
  try {
    const data = JSON.parse(repaired) as T
    console.warn('[safeParseJson] direct parse failed, succeeded after repair', { sanitizationUsed })
    return { ok: true, data, repairUsed: true, sanitizationUsed }
  } catch (err) {
    const msg = (err as Error).message
    const errorPosition = extractErrorPosition(msg, repaired)
    return {
      ok: false,
      error: msg,
      errorPosition,
      rawExtracted: extracted.slice(0, 1000),
      rawRepaired: repaired.slice(0, 1000),
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
  if (result.errorPosition) {
    console.log(`Error position: char ${result.errorPosition.index} · line ${result.errorPosition.line} · col ${result.errorPosition.column}`)
    if (result.rawRepaired && result.errorPosition.index !== undefined) {
      const idx = result.errorPosition.index
      const ctx = result.rawRepaired.slice(Math.max(0, idx - 40), idx + 40)
      console.log(`Context around error: ...${ctx}...`)
    }
  }
  console.log('Raw output (first 1000 chars):')
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
