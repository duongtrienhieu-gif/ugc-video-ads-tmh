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

/** First-line bio patterns. Tiếng Việt regex hơi loose — không quá strict
 *  để không catch hợp lệ. */
const BIO_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    // Name (capitalized word) + comma + age + tuổi
    pattern: /^[A-ZÀ-Ỹ][\p{L}]+,\s*\d{2}\s*(tuổi|năm)/u,
    reason: 'Mở bằng "Tên, X tuổi" — bio CV intro',
  },
  {
    pattern: /^(sống|hiện sống|cô sống|anh sống|cô ở|anh ở|chị sống)\s+(ở|tại)/i,
    reason: 'Mở bằng địa lý ("sống ở...") — bio intro',
  },
  {
    pattern: /^(mỗi sáng|mỗi ngày|hằng ngày|hàng ngày)/i,
    reason: 'Mở bằng routine description — bio intro',
  },
  {
    pattern: /^(cô là kiểu người|anh là kiểu người|chị là kiểu người|cô là người|anh là người)/i,
    reason: 'Mở bằng personality label — bio intro',
  },
  {
    pattern: /^sinh ra\s+(trong|tại|ở)/i,
    reason: 'Mở bằng background exposition — bio intro',
  },
  {
    pattern: /^(cô|anh|chị)\s+(làm|là)\s+(chủ|nhân viên|giáo viên|y tá)/i,
    reason: 'Mở bằng job description — bio intro',
  },
  {
    pattern: /^(cô|anh|chị)\s+(có|đang có)\s+\d+\s+(con|đứa)/i,
    reason: 'Mở bằng family composition — bio intro',
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
