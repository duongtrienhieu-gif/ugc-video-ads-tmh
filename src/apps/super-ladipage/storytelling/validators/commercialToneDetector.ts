// ─────────────────────────────────────────────────────────────────────
// commercialToneDetector — HARD validator
//
// 2 detector groups:
//
// GROUP A — General copywriter/motivational/lab-marketing bans (all blocks):
//   - "bạn xứng đáng", "đừng bỏ lỡ", motivational guru, fake empathy,
//     lab marketing language, urgency CTAs.
//
// GROUP B — Phase 3 ANTI-FEATURE-DUMP (Block 10 + 11 ONLY) [Chunk D]:
//   - Ingredient lists (3+ items comma-separated)
//   - Feature dump verb patterns ("chứa biotin, kẽm, B5")
//   - Hard compare markers ("vs / so với / bảng so sánh")
//   - Sales transition phrases ("Đặc biệt là", "Điểm nhấn", "Công dụng chính")
//
// Block 9 (natural-product-discovery) is SKIPPED for Group B — discovery
// context tự nhiên có thể mention nhẹ product detail.
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../runtime/parsePackResponse'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'

/** Block IDs scoped for Group B (anti-feature-dump). */
const FEATURE_DUMP_SCOPE = new Set(['why-this-felt-different', 'soft-mechanism-compare'])

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

// ── GROUP B — Phase 3 anti-feature-dump (Block 10/11 only) ────────────

/** Sales transition phrases — signal ad-brochure structure entering. */
const SALES_TRANSITION_PATTERNS: Array<{ pattern: string; reason: string }> = [
  { pattern: 'đặc biệt là', reason: 'sales-brochure transition phrase' },
  { pattern: 'đáng nói nhất', reason: 'sales-brochure emphasis transition' },
  { pattern: 'điểm nhấn của sản phẩm', reason: 'feature-spotlight sales transition' },
  { pattern: 'công dụng chính', reason: 'feature-listing sales transition' },
  { pattern: 'ưu điểm vượt trội', reason: 'hard-compare sales language' },
  { pattern: 'hơn hẳn các sản phẩm', reason: 'hard-compare brand language' },
  { pattern: 'không có sản phẩm nào', reason: 'hard-compare superlative' },
  { pattern: 'công thức tiên tiến', reason: 'lab-marketing feature framing' },
  { pattern: 'thành phần độc đáo', reason: 'feature-dump language' },
]

/** Hard compare markers — "vs / so với / bảng so sánh". */
const HARD_COMPARE_RE = /(\bvs\b|so\s+s[áa]nh\s+v[ớo]i|b[ảa]ng\s+so\s+s[áa]nh)/i

/** Ingredient list detection — 3+ items comma-separated after "chứa/có/bao gồm/gồm".
 *  Match like: "chứa biotin, kẽm, vitamin B5, L-cysteine" */
const INGREDIENT_LIST_RE =
  /\b(ch[ứu]a|c[óo]|bao\s+g[ồo]m|g[ồo]m\s+c[áa]c|được\s+l[àa]m\s+t[ừu])\b\s+[\p{L}\p{N}\s]+(?:,\s*[\p{L}\p{N}\s]+){2,}/iu

/** Run anti-feature-dump scan on a single block (only for FEATURE_DUMP_SCOPE blocks). */
function detectFeatureDumpInBlock(section: ParsedSection): ValidatorViolation[] {
  const violations: ValidatorViolation[] = []
  const lower = section.copy.toLowerCase()

  // Sales transition phrases
  for (const { pattern, reason } of SALES_TRANSITION_PATTERNS) {
    if (lower.includes(pattern)) {
      violations.push({
        sectionId: section.id,
        violation: `Phase-3 feature-dump: "${pattern}" — ${reason} (Block ${section.id} forbids ad-brochure language)`,
      })
    }
  }

  // Hard compare markers
  const compareMatch = section.copy.match(HARD_COMPARE_RE)
  if (compareMatch) {
    violations.push({
      sectionId: section.id,
      violation: `Phase-3 hard compare: "${compareMatch[0]}" — Block ${section.id} requires soft emotional compare, NOT hard table/vs markers`,
    })
  }

  // Ingredient list pattern
  const ingredMatch = section.copy.match(INGREDIENT_LIST_RE)
  if (ingredMatch) {
    violations.push({
      sectionId: section.id,
      violation: `Phase-3 ingredient list: "${ingredMatch[0].slice(0, 80)}..." — Block ${section.id} forbids feature dump, mechanism must be felt-experience driven`,
    })
  }

  return violations
}

export function commercialToneDetector(sections: ParsedSection[]): ValidatorResult {
  const violations: ValidatorViolation[] = []

  for (const s of sections) {
    const lower = s.copy.toLowerCase()

    // GROUP A: general copywriter/motivational/lab/urgency bans (all blocks).
    for (const { pattern, reason } of COMMERCIAL_PATTERNS) {
      if (lower.includes(pattern)) {
        violations.push({
          sectionId: s.id,
          violation: `Commercial tone: "${pattern}" — ${reason}`,
        })
      }
    }

    // GROUP B: anti-feature-dump (Block 10/11 only).
    if (FEATURE_DUMP_SCOPE.has(s.id)) {
      violations.push(...detectFeatureDumpInBlock(s))
    }
  }

  return { pass: violations.length === 0, violations }
}
