// ─────────────────────────────────────────────────────────────────────
// bannedPhraseDetector
//
// Lists patterns mapped to anti-pattern tags (visual/text/vibe). Phase 5
// runtime injects "AVOID: <tag>" — but Gemini may still slip. Output-side
// detector catches drift.
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../runtime/parsePackResponse'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'

interface BannedPattern {
  pattern: RegExp | string
  reason: string
}

const BANNED_PHRASES: BannedPattern[] = [
  // ── Miracle / instant transformation ──
  { pattern: 'khỏi hẳn', reason: 'miracle transformation claim' },
  { pattern: 'khỏi hoàn toàn', reason: 'miracle transformation claim' },
  { pattern: 'hết hẳn', reason: 'miracle transformation claim' },
  { pattern: 'ngay lập tức', reason: 'instant-result claim' },
  { pattern: /(?:sau|trong)\s+\d+\s+ngày\s+(?:đã\s+)?(?:khỏi|hết)/, reason: 'specific-day miracle' },

  // ── Hard sell / urgency ──
  { pattern: 'đặt hàng ngay', reason: 'hard-sell CTA' },
  { pattern: 'đặt mua ngay', reason: 'hard-sell CTA' },
  { pattern: 'click ngay', reason: 'hard-sell CTA' },
  { pattern: 'mua ngay', reason: 'hard-sell CTA' },
  { pattern: 'chỉ còn', reason: 'fake urgency' },
  { pattern: 'cơ hội cuối', reason: 'fake urgency' },
  { pattern: 'ưu đãi sắp hết', reason: 'fake urgency' },

  // ── Guarantee / superlative ──
  { pattern: 'đảm bảo', reason: 'guarantee language' },
  { pattern: 'cam kết', reason: 'guarantee language' },
  { pattern: 'duy nhất', reason: 'exclusivity claim' },
  { pattern: 'tốt nhất', reason: 'superlative marketing' },
  { pattern: 'hiệu quả nhất', reason: 'superlative marketing' },

  // ── Doctor / expert authority injection ──
  { pattern: /\bbs\.\s+\w/i, reason: 'doctor abbreviation injection' },
  { pattern: 'bác sĩ khuyên', reason: 'doctor authority' },
  { pattern: 'dược sĩ khuyên', reason: 'pharmacist authority' },
  { pattern: 'chuyên gia khuyên', reason: 'expert authority' },

  // ── Statistics dump ──
  { pattern: /\d{2,3}%\s*(người dùng|khách hàng|phụ nữ|đàn ông)/, reason: 'statistics dump' },
  { pattern: /\d{1,3}\.?\d{3,}\s+(người|khách|case)/, reason: 'volume statistics dump' },

  // ── Shocking reveal / plot twist promise ──
  { pattern: 'bí mật kinh hoàng', reason: 'shocking-reveal trope' },
  { pattern: 'sẽ thay đổi tất cả', reason: 'plot-twist promise' },
  { pattern: 'điều ít ai biết', reason: 'secret-tease trope' },
  // 'tiết lộ' REMOVED — natural use in confession voice OK ("tôi tiết lộ với chồng")

  // ── Fake confession bait ──
  { pattern: 'cuộc đời tôi sụp đổ', reason: 'overdramatic trauma' },
  { pattern: 'không ai biết tôi đã', reason: 'manufactured confession' },
  // 'tôi đã từng nghĩ đến' REMOVED — natural confession context OK

  // ── Generic-wellness AI fingerprints (SPEC-FIX 2026-05-27) ──
  // These phrases are explicitly in nicheMechanismVocab.bannedGenericPhrases
  // for EVERY niche but Gemini still drifts to them. Hard ban now.
  { pattern: 'phục hồi từ bên trong', reason: 'generic wellness fingerprint — banned across all niches' },
  { pattern: 'từ bên trong ra ngoài', reason: 'generic wellness fingerprint — banned across all niches' },
  { pattern: 'cân bằng cơ thể', reason: 'generic wellness fingerprint — banned across all niches' },
  { pattern: 'nuôi dưỡng toàn diện', reason: 'generic wellness fingerprint — banned across all niches' },
  { pattern: 'phục hồi tự nhiên', reason: 'generic wellness fingerprint — banned across all niches' },
  { pattern: 'gốc rễ vấn đề', reason: 'generic wellness fingerprint — banned across all niches' },
]

export function bannedPhraseDetector(sections: ParsedSection[]): ValidatorResult {
  const violations: ValidatorViolation[] = []

  for (const s of sections) {
    const lower = s.copy.toLowerCase()
    for (const { pattern, reason } of BANNED_PHRASES) {
      const hit = typeof pattern === 'string' ? lower.includes(pattern.toLowerCase()) : pattern.test(lower)
      if (hit) {
        const matched = typeof pattern === 'string' ? pattern : lower.match(pattern)?.[0] ?? '(regex match)'
        violations.push({
          sectionId: s.id,
          violation: `Banned phrase "${matched}" — ${reason}`,
        })
      }
    }
  }

  return { pass: violations.length === 0, violations }
}
