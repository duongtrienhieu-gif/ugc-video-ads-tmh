// ─────────────────────────────────────────────────────────────────────
// recoverPartialJson — brace-walker for truncated Gemini synthesis output
//
// Mirrors the OPT.6 / Sprint 7 recovery pattern from generatePIBatch.ts
// and parsePackResponse.ts. When Gemini truncates a JSON response mid-
// value (free-tier overload, server-side limit, network cut), strict
// JSON.parse throws on the whole document → ALL fields lost. This helper
// walks the raw string, tracks brace + string state, and extracts every
// complete top-level "key": value pair that lives BEFORE the truncation
// point.
//
// Supports values of type: string, array, object, number, bool, null.
//
// Returns null when nothing recoverable, so the caller can decide whether
// to fall back to a different source (e.g. brainstorm pain ladder for
// reader symptoms).
// ─────────────────────────────────────────────────────────────────────

/** Walk top-level keys of a possibly-truncated JSON object.
 *  Returns the complete key-value pairs found before truncation.
 *  Returns null if nothing recoverable. */
export function recoverPartialJson(raw: string): Record<string, unknown> | null {
  const rootStart = raw.indexOf('{')
  if (rootStart === -1) return null

  const out: Record<string, unknown> = {}
  let i = rootStart + 1

  while (i < raw.length) {
    // Skip whitespace + commas between entries
    while (i < raw.length && /[\s,]/.test(raw[i])) i++
    if (i >= raw.length) break
    if (raw[i] === '}') break   // root closes — done

    // Expect a quoted key
    if (raw[i] !== '"') return Object.keys(out).length > 0 ? out : null
    const keyStart = i + 1
    i++
    while (i < raw.length && raw[i] !== '"') {
      if (raw[i] === '\\') i++
      i++
    }
    if (i >= raw.length) break
    const key = raw.slice(keyStart, i)
    i++   // past closing quote

    // Skip whitespace + colon
    while (i < raw.length && /[\s:]/.test(raw[i])) i++
    if (i >= raw.length) break

    // Extract value depending on its type
    const valStart = i
    let valEnd = -1

    if (raw[i] === '"') {
      // ── String value
      i++
      while (i < raw.length && raw[i] !== '"') {
        if (raw[i] === '\\') i++
        i++
      }
      if (i >= raw.length) break   // unterminated string
      valEnd = i
      i++
    } else if (raw[i] === '[' || raw[i] === '{') {
      // ── Array or object — track depth + string state
      const openChar = raw[i]
      const closeChar = openChar === '[' ? ']' : '}'
      let depth = 0
      let inString = false
      let escape = false
      for (; i < raw.length; i++) {
        const c = raw[i]
        if (escape) { escape = false; continue }
        if (c === '\\' && inString) { escape = true; continue }
        if (c === '"') { inString = !inString; continue }
        if (inString) continue
        if (c === openChar) depth++
        else if (c === closeChar) {
          depth--
          if (depth === 0) { valEnd = i; break }
        }
      }
      if (valEnd === -1) break   // truncated mid array/object
      i = valEnd + 1
    } else {
      // ── Number, bool, null — read until comma / brace / whitespace
      const primStart = i
      while (i < raw.length && raw[i] !== ',' && raw[i] !== '}' && !/\s/.test(raw[i])) i++
      if (i === primStart) break   // no primitive read — bail
      valEnd = i - 1
    }

    if (valEnd === -1) break

    const valStr = raw.slice(valStart, valEnd + 1)
    try {
      out[key] = JSON.parse(valStr)
    } catch {
      // entry malformed — skip, keep walking for later complete ones
    }
  }

  return Object.keys(out).length > 0 ? out : null
}

/** Strip markdown fences from raw Gemini output. */
export function stripJsonFences(raw: string): string {
  let t = raw.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  }
  return t
}
