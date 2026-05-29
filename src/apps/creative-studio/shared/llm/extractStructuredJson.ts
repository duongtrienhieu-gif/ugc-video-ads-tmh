// ── Hardened Structured JSON Extractor (P12-fix) ────────────────────────────
//
// LLMs (including Gemini) return malformed JSON in real-world conditions:
//   • markdown fences (```json ... ```)
//   • prose preamble ("Here is your JSON:") or postscript
//   • smart quotes (" ”) instead of straight quotes
//   • unicode apostrophes (’) in name fields
//   • trailing commas
//   • unterminated strings from token truncation
//   • unescaped newlines inside string values
//
// This module accepts noisy text and returns a parsed object, repairing
// what it can and returning fallback when it can't. NEVER throws —
// that's the entire point: dispatcher must not crash on bad LLM output.

export interface SchemaCheck<T> {
  /** Return true if the parsed value looks structurally correct. */
  validate: (v: unknown) => v is T
  name?: string
}

export interface ExtractOptions<T> {
  schema?: SchemaCheck<T>
  fallback?: T
  generatorLabel?: string
}

export interface ExtractResult<T> {
  ok: boolean
  value: T | null
  reason?: string
  repairs: string[]
}

/** Extract a structured value from a noisy LLM response. Never throws. */
export function extractStructuredJson<T>(
  raw: string,
  options: ExtractOptions<T> = {},
): ExtractResult<T> {
  const repairs: string[] = []
  let text = raw

  // Stage 1 — strip markdown fence
  const fenced = text.replace(/^\s*```(?:json)?\s*\n?/i, '').replace(/```\s*$/i, '')
  if (fenced !== text) { repairs.push('strip-fence'); text = fenced }

  // Stage 2 — trim prose: find first '{' and matching last '}'
  const sliced = sliceFirstObject(text)
  if (sliced !== null) {
    if (sliced !== text) repairs.push('slice-first-object')
    text = sliced
  }

  // Stage 3 — fix smart quotes + unicode apostrophes
  const normalized = normalizeQuotes(text)
  if (normalized !== text) { repairs.push('normalize-quotes'); text = normalized }

  // Stage 4 — remove trailing commas
  const noTrailing = text.replace(/,(\s*[}\]])/g, '$1')
  if (noTrailing !== text) { repairs.push('strip-trailing-commas'); text = noTrailing }

  // Stage 5 — escape unescaped newlines inside string values
  const escapedNl = escapeNewlinesInStrings(text)
  if (escapedNl !== text) { repairs.push('escape-newlines'); text = escapedNl }

  // Stage 6 — try parse
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (firstErr) {
    const repaired = repairUnterminatedString(text)
    if (repaired !== text) {
      try {
        parsed = JSON.parse(repaired)
        repairs.push('repair-unterminated-string')
      } catch {
        return fail(repairs, options, `unparseable after repairs: ${(firstErr as Error).message}`)
      }
    } else {
      return fail(repairs, options, (firstErr as Error).message)
    }
  }

  // Stage 7 — schema check
  if (options.schema && !options.schema.validate(parsed)) {
    return fail(repairs, options, `schema mismatch (${options.schema.name ?? 'unnamed'})`)
  }

  return { ok: true, value: parsed as T, repairs }
}

function fail<T>(repairs: string[], options: ExtractOptions<T>, reason: string): ExtractResult<T> {
  const label = options.generatorLabel ?? 'unknown'
  if (options.fallback !== undefined) {
    console.warn(`[extractStructuredJson:${label}] fallback used — ${reason} (repairs: ${repairs.join(', ') || 'none'})`)
    return { ok: false, value: options.fallback, reason, repairs }
  }
  console.warn(`[extractStructuredJson:${label}] no fallback — ${reason} (repairs: ${repairs.join(', ') || 'none'})`)
  return { ok: false, value: null, reason, repairs }
}

// ── Stage helpers ──────────────────────────────────────────────────────

function sliceFirstObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escapeNext = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escapeNext) { escapeNext = false; continue }
    if (ch === '\\') { escapeNext = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return text.slice(start) // unterminated — repair stage will close it
}

function normalizeQuotes(text: string): string {
  return text
    .replace(/[“”]/g, '"')                  // smart double quotes → "
    .replace(/([{,[\s:])\s*['‘’]/g, '$1"')  // smart single before structural → "
    .replace(/['‘’]\s*([}\],:])/g, '"$1')  // smart single before structural close → "
    .replace(/[‘’]/g, "'")                  // remaining smart apostrophe → straight
}

function escapeNewlinesInStrings(text: string): string {
  let out = ''
  let inString = false
  let escapeNext = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (escapeNext) { out += ch; escapeNext = false; continue }
    if (ch === '\\') { out += ch; escapeNext = true; continue }
    if (ch === '"')  { inString = !inString; out += ch; continue }
    if (inString && (ch === '\n' || ch === '\r')) { out += '\\n'; continue }
    if (inString && ch === '\t') { out += '\\t'; continue }
    out += ch
  }
  return out
}

function repairUnterminatedString(text: string): string {
  let depth = 0
  let inString = false
  let escapeNext = false
  let lastValidBoundary = -1
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (escapeNext) { escapeNext = false; continue }
    if (ch === '\\') { escapeNext = true; continue }
    if (ch === '"')  { inString = !inString; continue }
    if (inString) continue
    if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') {
      depth--
      if (depth >= 0) lastValidBoundary = i
    } else if (ch === ',' && depth >= 1) {
      lastValidBoundary = i - 1   // trim back to before the trailing-incomplete field
    }
  }
  if (!inString && depth === 0) return text
  let repaired = text
  if (inString) {
    // Drop the in-flight incomplete field — trim back to last valid boundary
    if (lastValidBoundary > 0) {
      repaired = text.slice(0, lastValidBoundary + 1)
      // Re-walk to compute depth after the trim
      depth = 0
      inString = false
      escapeNext = false
      for (let i = 0; i < repaired.length; i++) {
        const c = repaired[i]
        if (escapeNext) { escapeNext = false; continue }
        if (c === '\\') { escapeNext = true; continue }
        if (c === '"')  { inString = !inString; continue }
        if (!inString) {
          if (c === '{' || c === '[') depth++
          else if (c === '}' || c === ']') depth--
        }
      }
    } else {
      repaired += '"'
    }
  }
  while (depth > 0) { repaired += '}'; depth-- }
  return repaired
}
