// ═════════════════════════════════════════════════════════════════════
// Storytelling Engine — pack response parser (Reader-Immersion architecture)
//
// Parse raw Gemini JSON output into typed blocks. Strips markdown
// fences if any (KIE fallback sometimes wraps despite instructions).
// Validates shape — throws if malformed.
//
// Block count is flex (13-15 per pack) — parser enforces match with
// caller-provided expected BlockIds. Block content validation lives in
// /validators/ — this layer only checks JSON structure correctness.
// ═════════════════════════════════════════════════════════════════════

import type { BlockId } from '../types'

/** Mini quote from social-proof block. */
export interface ParsedReview {
  quote: string
  author?: string
  meta?: string
}

export interface ParsedSection {
  id: BlockId
  title: string
  /** Structural paragraph array (source of truth for reading flow).
   *  Gemini outputs as paragraphs[] field directly. Parser normalizes legacy
   *  `copy: string` input into paragraphs by splitting on \n\n. */
  paragraphs: string[]
  /** Joined paragraphs.join('\n\n') — kept for backward-compat with existing
   *  consumers (validators, UI renderer, services). Always derived from paragraphs. */
  copy: string
  /** Optional reviews array. Used by social-proof block for 3 mini quotes
   *  (different voices). Other blocks leave undefined. */
  reviews?: ParsedReview[]
}

export interface ParsedPack {
  sections: ParsedSection[]
}

/** Strip markdown fences if present. KIE proxy sometimes wraps despite
 *  prompt instructions. */
function stripFences(raw: string): string {
  let t = raw.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  }
  return t
}

/** Sprint 7 (2026-05-28) — Partial JSON recovery for main storytelling pack.
 *
 *  Gemini sometimes truncates mid-stream (server-side limit / token cap)
 *  leaving a JSON like:
 *      { "sections": [
 *          { "id": "...", "title": "...", "paragraphs": ["..."] },
 *          { "id": "...", "title": "...", "paragraphs": ["..."] },
 *          { "id": "...", "title": "...", "paragraphs": ["...   ← cut here
 *  Standard JSON.parse throws on the whole document → all 13-15 blocks
 *  fall back to template. This helper walks the string, tracks brace depth +
 *  string state, and extracts every complete section object that lives
 *  BEFORE the truncation point.
 *
 *  Pattern mirrors OPT.6 recoverPartialBatchJson in productInfoLayer/
 *  runtime/generatePIBatch.ts — same brace-walker, adapted for ARRAY
 *  inside a `"sections"` key rather than top-level object entries.
 *
 *  Returns the list of complete section objects (may be empty), so the
 *  caller can decide what to do (fill missing with fallback placeholders).
 */
function recoverPartialPackSections(raw: string): unknown[] {
  // Find the `"sections"` key opening
  const keyMatch = raw.match(/"sections"\s*:\s*\[/)
  if (!keyMatch || keyMatch.index === undefined) return []
  let i = keyMatch.index + keyMatch[0].length

  const out: unknown[] = []

  // Walk array elements until we hit truncation or the closing `]`
  while (i < raw.length) {
    // Skip whitespace + commas between elements
    while (i < raw.length && /[\s,]/.test(raw[i])) i++
    if (i >= raw.length) break
    if (raw[i] === ']') break   // sections array closes — done

    // Each element must be a `{ ... }` object
    if (raw[i] !== '{') break
    const valStart = i
    let depth = 0
    let inString = false
    let escape = false
    let valEnd = -1
    for (; i < raw.length; i++) {
      const c = raw[i]
      if (escape) { escape = false; continue }
      if (c === '\\' && inString) { escape = true; continue }
      if (c === '"') { inString = !inString; continue }
      if (inString) continue
      if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth === 0) { valEnd = i; break }
      }
    }
    if (valEnd === -1) break   // truncated mid-section — stop

    const valStr = raw.slice(valStart, valEnd + 1)
    try {
      out.push(JSON.parse(valStr))
    } catch {
      // entry itself is malformed — skip, keep going for later complete ones
    }
    i = valEnd + 1
  }

  return out
}

/** Build an empty placeholder section. Used to fill slots for blocks that
 *  Gemini truncated before emitting. Downstream applyFallback() will
 *  replace these with template content. */
function emptyPlaceholderSection(id: BlockId): ParsedSection {
  return { id, title: '', paragraphs: [], copy: '' }
}

export interface RecoverableParseResult {
  pack: ParsedPack
  /** true when strict JSON.parse failed and we recovered partial sections. */
  recovered: boolean
  /** Expected block IDs that were NOT present in the recovered output.
   *  Caller should treat these as failing → applyFallback() fills them. */
  missingIds: BlockId[]
}

/** Sprint 7 — strict parse first, partial-recovery fallback.
 *
 *  Behavior:
 *   - On clean output → identical to parsePackResponse, recovered=false.
 *   - On truncation (unterminated string / unexpected end) → walk partial
 *     JSON, extract N complete sections, return a pack where missing
 *     expected IDs become empty placeholders + missingIds list.
 *   - On other parse errors (structural / wrong shape) → re-throw, since
 *     those aren't recoverable via brace-walking.
 *
 *  Worst case: 0 sections recovered → pack with all placeholders → existing
 *  fallback machinery fills every block. No worse than before this change. */
export function parsePackResponseRecoverable(
  raw: string,
  expectedBlockIds: BlockId[],
): RecoverableParseResult {
  try {
    const pack = parsePackResponse(raw, expectedBlockIds)
    return { pack, recovered: false, missingIds: [] }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    // Only attempt recovery on truncation-flavored failures. Structural
    // errors (missing "sections" array, wrong shape, unexpected block id)
    // mean Gemini misunderstood the schema — recovery won't help.
    const looksTruncated = errMsg.includes('bị cắt giữa chừng')
      || errMsg.toLowerCase().includes('unterminated')
      || errMsg.toLowerCase().includes('unexpected end')
    if (!looksTruncated) throw err

    const cleaned = stripFences(raw)
    const partialSections = recoverPartialPackSections(cleaned)

    // Validate + filter recovered sections against expected IDs.
    const expectedSet = new Set(expectedBlockIds)
    const validById = new Map<BlockId, ParsedSection>()
    for (const sRaw of partialSections) {
      if (!sRaw || typeof sRaw !== 'object') continue
      const sec = sRaw as Record<string, unknown>
      if (typeof sec.id !== 'string' || typeof sec.title !== 'string') continue
      if (!expectedSet.has(sec.id as BlockId)) continue

      let paragraphs: string[]
      if (Array.isArray(sec.paragraphs)) {
        paragraphs = (sec.paragraphs as unknown[])
          .filter((p): p is string => typeof p === 'string')
          .map((p) => p.trim())
          .filter((p) => p.length > 0)
      } else if (typeof sec.copy === 'string') {
        paragraphs = sec.copy
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter((p) => p.length > 0)
      } else {
        continue
      }
      if (paragraphs.length === 0) continue

      validById.set(sec.id as BlockId, {
        id: sec.id as BlockId,
        title: sec.title.trim(),
        paragraphs,
        copy: paragraphs.join('\n\n'),
      })
    }

    // Build full sections list in expected order — missing slots = empty placeholders.
    const sections: ParsedSection[] = expectedBlockIds.map((id) =>
      validById.get(id) ?? emptyPlaceholderSection(id)
    )
    const missingIds = expectedBlockIds.filter((id) => !validById.has(id))

    console.warn(
      `[storytelling/parse] Truncated mid-stream — recovered ${validById.size}/${expectedBlockIds.length} complete sections; ${missingIds.length} will use fallback (${missingIds.join(', ')})`,
    )

    return {
      pack: { sections },
      recovered: true,
      missingIds,
    }
  }
}

/** Parse raw Gemini output. Throws if malformed. */
export function parsePackResponse(
  raw: string,
  expectedBlockIds: BlockId[],
): ParsedPack {
  const cleaned = stripFences(raw)

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    if (errMsg.toLowerCase().includes('unterminated') || errMsg.toLowerCase().includes('unexpected end')) {
      throw new Error(
        `Storytelling pack JSON bị cắt giữa chừng (${cleaned.length} chars). ` +
        `Gemini hit maxOutputTokens. Cần tăng maxOutputTokens hoặc giảm scope.`,
      )
    }
    throw new Error(`Storytelling pack JSON parse failed: ${errMsg}. Raw start: ${cleaned.slice(0, 200)}`)
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Storytelling pack output is not an object')
  }

  const obj = parsed as Record<string, unknown>
  if (!Array.isArray(obj.sections)) {
    throw new Error(`Storytelling pack missing "sections" array. Got keys: ${Object.keys(obj).join(', ')}`)
  }

  const expectedSet = new Set(expectedBlockIds)
  const sections: ParsedSection[] = obj.sections.map((s, idx) => {
    if (!s || typeof s !== 'object') {
      throw new Error(`Storytelling pack section #${idx + 1} is not an object`)
    }
    const sec = s as Record<string, unknown>
    if (typeof sec.id !== 'string') {
      throw new Error(`Storytelling pack section #${idx + 1} missing/invalid "id"`)
    }
    if (typeof sec.title !== 'string') {
      throw new Error(`Storytelling pack section #${idx + 1} missing/invalid "title"`)
    }
    // v5.7 Phase C — accept either `paragraphs: string[]` (preferred, new schema)
    // OR `copy: string` (legacy, split by \n\n). One must be present + non-empty.
    let paragraphs: string[]
    if (Array.isArray(sec.paragraphs)) {
      paragraphs = (sec.paragraphs as unknown[])
        .filter((p): p is string => typeof p === 'string')
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
    } else if (typeof sec.copy === 'string') {
      paragraphs = sec.copy
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
    } else {
      throw new Error(`Storytelling pack section #${idx + 1} missing both "paragraphs" array and "copy" string`)
    }
    if (paragraphs.length === 0) {
      throw new Error(`Storytelling pack section #${idx + 1} has empty content (no paragraphs)`)
    }
    if (!expectedSet.has(sec.id as BlockId)) {
      throw new Error(
        `Storytelling pack block #${idx + 1} has unexpected id "${sec.id}". ` +
        `Expected one of: ${[...expectedSet].join(', ')}`,
      )
    }
    // Parse optional reviews (proof blocks — content interleaved post-parse
    // from separate proof Gemini call, but Gemini main call doesn't emit these).
    // Kept for legacy compatibility if Gemini accidentally emits reviews[].
    let reviews: ParsedReview[] | undefined
    if (typeof sec.id === 'string' && sec.id.startsWith('proof-') && Array.isArray(sec.reviews)) {
      reviews = (sec.reviews as unknown[])
        .map((r): ParsedReview | null => {
          if (!r || typeof r !== 'object') return null
          const rec = r as Record<string, unknown>
          if (typeof rec.quote !== 'string') return null
          return {
            quote:  rec.quote.trim(),
            author: typeof rec.author === 'string' ? rec.author.trim() : undefined,
            meta:   typeof rec.meta === 'string'   ? rec.meta.trim()   : undefined,
          }
        })
        .filter((r): r is ParsedReview => r !== null)
      if (reviews.length === 0) reviews = undefined
    }

    return {
      id:         sec.id as BlockId,
      title:      sec.title.trim(),
      paragraphs,
      copy:       paragraphs.join('\n\n'),
      reviews,
    }
  })

  // Verify count matches (flex 13-15 — driven by expected ids from caller)
  if (sections.length !== expectedBlockIds.length) {
    throw new Error(
      `Storytelling pack block count mismatch — expected ${expectedBlockIds.length}, got ${sections.length}`,
    )
  }

  // Verify order matches expected
  for (let i = 0; i < expectedBlockIds.length; i++) {
    if (sections[i].id !== expectedBlockIds[i]) {
      throw new Error(
        `Storytelling pack block #${i + 1} order mismatch — expected "${expectedBlockIds[i]}", got "${sections[i].id}"`,
      )
    }
  }

  return { sections }
}
