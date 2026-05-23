// ─────────────────────────────────────────────────────────────────────
// selfInsertionDetector — SOFT WARNING ONLY (P0.5.4)
//
// Storyselling realignment: section 1 PHẢI có 1st person voice trong
// first 3 lines để reader self-insert. Nếu không có → soft warning
// (informational only, KHÔNG block retry).
//
// Why soft: validators là safety net, không driver. Stylistic finesse
// comes from prompt + Gemini judgment.
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../runtime/parsePackResponse'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'

/** First-person markers (Vietnamese). At least 1 must appear in section 1
 *  first 3 lines for self-insertion to work. */
const FIRST_PERSON_MARKERS = [
  /\btôi\b/i,
  /\bmình\b/i,
  /\bem\b/i,    // for younger female narrator
  /\bbạn\b/i,   // 2nd person direct address also counts
]

/** 3rd-person markers that suggest OBSERVER mode (bad in section 1). */
const OBSERVER_MARKERS = [
  /\bcô ấy\b/i,
  /\banh ấy\b/i,
  /^cô\s+/im,    // line starts with "Cô " — 3rd person about her
  /^anh\s+/im,   // line starts with "Anh " — 3rd person about him
  /^chị\s+/im,
]

export function selfInsertionDetector(section: ParsedSection): ValidatorResult {
  // Only checks section 1
  if (section.id !== 'hook-interrupt') {
    return { pass: true, violations: [] }
  }

  const firstLines = section.copy
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 3)
  const firstChunk = firstLines.join(' ')

  const violations: ValidatorViolation[] = []

  // Check for 1st/2nd person presence
  const hasFirstPerson = FIRST_PERSON_MARKERS.some((re) => re.test(firstChunk))
  if (!hasFirstPerson) {
    violations.push({
      sectionId: section.id,
      violation: 'Section 1 thiếu 1st person ("tôi"/"mình") hoặc 2nd person ("bạn") trong 3 dòng đầu — reader không có self-insertion hook',
    })
  }

  // Check for observer mode (named character / 3rd person)
  for (const re of OBSERVER_MARKERS) {
    if (re.test(firstChunk)) {
      violations.push({
        sectionId: section.id,
        violation: `Section 1 dùng 3rd-person observer ("${firstChunk.match(re)?.[0]}") — should be 1st person "tôi"`,
      })
      break  // only flag once
    }
  }

  return { pass: violations.length === 0, violations }
}
