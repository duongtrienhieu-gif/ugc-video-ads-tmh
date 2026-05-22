// ─────────────────────────────────────────────────────────────────────
// commercialToneDetector
//
// Detect promotional language slipping in. Stricter than bannedPhrase —
// these are softer marketing tropes that fail "human invitation" tone.
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../runtime/parsePackResponse'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'

const COMMERCIAL_PATTERNS: Array<{ pattern: string; reason: string }> = [
  // ── Soft CTA marketing-mềm patterns ──
  { pattern: 'bạn xứng đáng', reason: 'benefit-driven marketing CTA ("you deserve")' },
  { pattern: 'bạn sẽ không hối tiếc', reason: 'risk-reversal copy' },
  { pattern: 'đừng bỏ lỡ', reason: 'FOMO language' },
  { pattern: 'đừng để', reason: 'fear-driven framing' },
  { pattern: 'hãy thử ngay', reason: 'directive marketing CTA' },
  { pattern: 'thử ngay hôm nay', reason: 'urgency push' },
  { pattern: 'cơ hội thay đổi', reason: 'opportunity framing' },
  { pattern: 'mở ra cuộc sống mới', reason: 'transformation marketing' },

  // ── Product praise (commercial vibe) ──
  { pattern: 'sản phẩm tuyệt vời', reason: 'commercial praise' },
  { pattern: 'sản phẩm tốt', reason: 'commercial endorsement' },
  { pattern: 'sản phẩm chất lượng', reason: 'commercial endorsement' },
  { pattern: 'sản phẩm này thật sự', reason: 'commercial endorsement' },
  { pattern: 'thực sự hiệu quả', reason: 'commercial endorsement' },
  { pattern: 'hoàn toàn tự nhiên', reason: 'commercial selling point' },
  { pattern: 'an toàn tuyệt đối', reason: 'commercial reassurance' },

  // ── Aspirational language ──
  { pattern: 'phiên bản tốt hơn', reason: 'aspirational marketing' },
  { pattern: 'phiên bản tốt nhất', reason: 'aspirational marketing' },
  { pattern: 'tự tin hơn', reason: 'aspirational claim' },  // OK in body but flag in CTA section
  { pattern: 'tỏa sáng', reason: 'cliché marketing' },

  // ── Doctor / lab vibes ──
  { pattern: 'thành phần đột phá', reason: 'lab marketing language' },
  { pattern: 'công thức độc quyền', reason: 'lab marketing language' },
  { pattern: 'nghiên cứu khoa học', reason: 'authority marketing' },

  // ── Fake review / endorsement tone ──
  { pattern: 'tôi đã thử và', reason: 'fake review tone' },
  { pattern: 'tôi recommend', reason: 'fake recommendation' },
  { pattern: 'tôi giới thiệu', reason: 'commercial endorsement' },
  { pattern: 'tôi khuyên bạn', reason: 'directive endorsement' },
]

export function commercialToneDetector(sections: ParsedSection[]): ValidatorResult {
  const violations: ValidatorViolation[] = []

  for (const s of sections) {
    const lower = s.copy.toLowerCase()
    for (const { pattern, reason } of COMMERCIAL_PATTERNS) {
      if (lower.includes(pattern)) {
        violations.push({
          sectionId: s.id,
          violation: `Commercial tone: "${pattern}" — ${reason}`,
        })
      }
    }
  }

  return { pass: violations.length === 0, violations }
}
