// ─────────────────────────────────────────────────────────────────────
// commercialToneDetector (P0.5.4 STORYSELLING REALIGNMENT — loosened)
//
// Storyselling needs commercial gravity. We ALLOW:
//   - Direct product mention
//   - "Tôi recommend cho mọi người" friend tone
//   - "Tôi đã thử và..." natural confession
//   - "Thực sự hiệu quả" mild endorsement
//   - "Tự tin hơn" natural feeling
//   - Specific product trait mention
//
// We BLOCK only obvious copywriter templates / motivational guru / fake
// empathy scripts that break confession voice.
//
// Validators are SAFETY NET (block obvious failures), NOT DRIVER of style.
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../runtime/parsePackResponse'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'

const COMMERCIAL_PATTERNS: Array<{ pattern: string; reason: string }> = [
  // ── Copywriter templates (still banned — break confession voice) ──
  { pattern: 'bạn xứng đáng', reason: 'copywriter template ("you deserve") — không confession voice' },
  { pattern: 'bạn sẽ không hối tiếc', reason: 'risk-reversal copywriter line' },
  { pattern: 'đừng bỏ lỡ', reason: 'FOMO copywriter template' },
  { pattern: 'đừng để', reason: 'fear-driven copywriter framing' },
  { pattern: 'cơ hội thay đổi cuộc đời', reason: 'aspirational copywriter template' },
  { pattern: 'mở ra cuộc sống mới', reason: 'transformation copywriter template' },
  { pattern: 'phiên bản tốt hơn', reason: 'aspirational copywriter cliché' },
  { pattern: 'phiên bản tốt nhất', reason: 'aspirational copywriter cliché' },

  // ── Motivational guru tone (banned) ──
  { pattern: 'hãy tin vào bản thân', reason: 'motivational guru tone' },
  { pattern: 'bạn có thể làm được', reason: 'motivational guru tone' },
  { pattern: 'tỏa sáng', reason: 'motivational cliché' },

  // ── Fake empathy scripts (banned) ──
  { pattern: 'tôi hiểu cảm giác của bạn', reason: 'fake empathy script' },
  { pattern: 'tôi biết bạn đang', reason: 'fake empathy presumption' },

  // ── Lab/authority marketing (banned — different from natural mention) ──
  { pattern: 'thành phần đột phá', reason: 'lab marketing language' },
  { pattern: 'công thức độc quyền', reason: 'lab marketing language' },
  { pattern: 'công nghệ tiên tiến', reason: 'lab marketing language' },

  // ── Urgency CTAs (banned) ──
  { pattern: 'hãy thử ngay hôm nay', reason: 'urgency push CTA' },
  { pattern: 'mua ngay hôm nay', reason: 'hard-sell urgency' },

  // REMOVED (now allowed in storyselling confession voice):
  // - 'tôi recommend' / 'tôi giới thiệu' / 'tôi khuyên bạn' — natural friend tone OK
  // - 'tôi đã thử và' — natural confession
  // - 'sản phẩm tốt' / 'thực sự hiệu quả' — mild endorsement OK
  // - 'tự tin hơn' — real felt outcome OK
  // - 'sản phẩm chất lượng' / 'sản phẩm tuyệt vời' — slightly enthusiastic but acceptable
  // - 'hoàn toàn tự nhiên' / 'an toàn' — product trait mention OK
  // - 'nghiên cứu khoa học' — fact reference OK if not authority spam
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
