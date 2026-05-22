// ─────────────────────────────────────────────────────────────────────
// bioIntroDetector — chỉ check section 1 (intro-portrait)
//
// BANNED opening patterns:
//   - name + age ("Aishah, 38 tuổi")
//   - location-first ("Sống ở Selangor...")
//   - routine-first ("Mỗi sáng cô dậy lúc...")
//   - personality label ("Cô là kiểu người...")
//   - background exposition ("Sinh ra trong gia đình...")
//   - job description first ("Cô làm chủ cửa hàng...")
//
// Hook PHẢI mở bằng observation/anomaly/negative-space/etc — không phải bio.
// ─────────────────────────────────────────────────────────────────────

import type { SectionId } from '../types'
import type { ParsedSection } from '../runtime/parsePackResponse'

export interface ValidatorViolation {
  sectionId: SectionId
  violation: string
}

export interface ValidatorResult {
  pass: boolean
  violations: ValidatorViolation[]
}

/** P0.5.4 STORYSELLING REALIGNMENT — only flag 3RD PERSON observer-mode
 *  bio intros. 1st person ID reveal ("Tôi 38 tuổi, mẹ 2 con — đã hơn nửa
 *  năm nay tôi ngủ không sâu") IS ALLOWED — it's a natural confession
 *  opener flowing into pain.
 *
 *  Patterns now require 3rd-person framing (cô / anh / chị / named) to
 *  trigger. */
const BIO_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    // Named character (not Tôi/Mình/Em) + comma + age → 3rd-person bio
    // Negative lookahead excludes 1st-person openers.
    pattern: /^(?!tôi|mình|em\b)[A-ZÀ-Ỹ][\p{L}]+,\s*\d{2}\s*(tuổi|năm)/iu,
    reason: 'Mở bằng "Tên, X tuổi" 3rd-person — bio CV observer intro',
  },
  {
    // 3rd-person location bio ("Cô sống ở", "Anh hiện sống tại")
    pattern: /^(cô|anh|chị)\s+(sống|hiện sống|ở)\s+(ở|tại)/i,
    reason: 'Mở bằng 3rd-person địa lý — observer bio',
  },
  {
    // 3rd-person routine ("Mỗi sáng cô dậy", "Hằng ngày anh đi")
    pattern: /^(mỗi sáng|mỗi ngày|hằng ngày|hàng ngày)\s+(cô|anh|chị)\b/i,
    reason: 'Mở bằng 3rd-person routine — observer bio',
  },
  {
    // 3rd-person personality label
    pattern: /^(cô|anh|chị)\s+(là kiểu người|là người|thuộc kiểu)/i,
    reason: 'Mở bằng 3rd-person personality label — observer bio',
  },
  {
    // Background exposition still 3rd person
    pattern: /^(cô|anh|chị)\s+sinh ra\s+(trong|tại|ở)/i,
    reason: 'Mở bằng 3rd-person background exposition — observer bio',
  },
  {
    // 3rd-person job
    pattern: /^(cô|anh|chị)\s+(làm|là)\s+(chủ|nhân viên|giáo viên|y tá)/i,
    reason: 'Mở bằng 3rd-person job description — observer bio',
  },
  {
    // 3rd-person family composition
    pattern: /^(cô|anh|chị)\s+(có|đang có)\s+\d+\s+(con|đứa)/i,
    reason: 'Mở bằng 3rd-person family composition — observer bio',
  },
]

export function bioIntroDetector(section: ParsedSection): ValidatorResult {
  if (section.id !== 'intro-portrait') {
    return { pass: true, violations: [] }
  }

  // Get first 3 non-empty lines / paragraphs joined
  const firstLines = section.copy
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 3)

  const firstChunk = firstLines.join(' ')

  const violations: ValidatorViolation[] = []
  for (const { pattern, reason } of BIO_PATTERNS) {
    if (pattern.test(firstChunk)) {
      violations.push({ sectionId: section.id, violation: reason })
    }
  }

  return { pass: violations.length === 0, violations }
}
