// ═════════════════════════════════════════════════════════════════════
// Storytelling Engine — pack response parser
//
// Parse raw Gemini JSON output into typed sections. Strips markdown
// fences if any (KIE fallback sometimes wraps despite instructions).
// Validates shape — throws if malformed.
//
// Section content validation lives in /validators/ — this layer only
// checks JSON structure correctness.
// ═════════════════════════════════════════════════════════════════════

import type { SectionId } from '../types'

/** Mini quote from trust-continuity section. */
export interface ParsedReview {
  quote: string
  author?: string
  meta?: string
}

export interface ParsedSection {
  id: SectionId
  title: string
  /** v5.7 Phase C — structural paragraph array (source of truth for reading flow).
   *  Gemini outputs as paragraphs[] field directly. Parser normalizes legacy
   *  `copy: string` input into paragraphs by splitting on \n\n. */
  paragraphs: string[]
  /** Joined paragraphs.join('\n\n') — kept for backward-compat with 8+ existing
   *  consumers (validators, UI renderer, services). Always derived from paragraphs. */
  copy: string
  /** v4.5 — optional reviews array. Used by trust-continuity (section 10)
   *  for 3 mini quotes (different voices). Other sections leave undefined. */
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

/** Parse raw Gemini output. Throws if malformed. */
export function parsePackResponse(
  raw: string,
  expectedSectionIds: SectionId[],
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

  const expectedSet = new Set(expectedSectionIds)
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
    if (!expectedSet.has(sec.id as SectionId)) {
      throw new Error(
        `Storytelling pack section #${idx + 1} has unexpected id "${sec.id}". ` +
        `Expected one of: ${[...expectedSet].join(', ')}`,
      )
    }
    // v4.5 — parse optional reviews (trust-continuity section)
    let reviews: ParsedReview[] | undefined
    if (sec.id === 'trust-continuity' && Array.isArray(sec.reviews)) {
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
      id:         sec.id as SectionId,
      title:      sec.title.trim(),
      paragraphs,
      copy:       paragraphs.join('\n\n'),
      reviews,
    }
  })

  // Verify count matches
  if (sections.length !== expectedSectionIds.length) {
    throw new Error(
      `Storytelling pack section count mismatch — expected ${expectedSectionIds.length}, got ${sections.length}`,
    )
  }

  // Verify order matches expected
  for (let i = 0; i < expectedSectionIds.length; i++) {
    if (sections[i].id !== expectedSectionIds[i]) {
      throw new Error(
        `Storytelling pack section #${i + 1} order mismatch — expected "${expectedSectionIds[i]}", got "${sections[i].id}"`,
      )
    }
  }

  return { sections }
}
