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

export interface ParsedSection {
  id: SectionId
  title: string
  copy: string
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
    if (typeof sec.copy !== 'string') {
      throw new Error(`Storytelling pack section #${idx + 1} missing/invalid "copy"`)
    }
    if (!expectedSet.has(sec.id as SectionId)) {
      throw new Error(
        `Storytelling pack section #${idx + 1} has unexpected id "${sec.id}". ` +
        `Expected one of: ${[...expectedSet].join(', ')}`,
      )
    }
    return {
      id:    sec.id as SectionId,
      title: sec.title.trim(),
      copy:  sec.copy.trim(),
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
