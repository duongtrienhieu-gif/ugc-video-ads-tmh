// ─────────────────────────────────────────────────────────────────────
// emotionalFlatteningDetector — SOFT WARNING (Chunk C2)
//
// Detects Phase 4 ending defaulting to generic "tired/healing" tone when
// niche desire architecture demands different emotional gravity.
//
// Example violations:
//   - beauty-confidence pack ending with "inner peace" (forbidden — niche
//     gravity is attractiveness + visibility)
//   - relationship pack ending with "body recovered" (forbidden — niche
//     gravity is patience + emotional warmth)
//   - haircare pack ending with "self-acceptance about decline" (forbidden —
//     niche gravity is femininity + identity restoration)
//
// Heuristic: scan Phase 4 blocks (future-self-cta + emotional-wins) text
// for phrases matching nicheDesireArchitecture[niche].forbiddenDefaults.
//
// SOFT — flags audit; doesn't trigger retry. Iteratively strengthen
// nicheDesireArchitecture forbidden lists if false negatives appear.
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../runtime/parsePackResponse'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'
import { NICHE_DESIRE_ARCHITECTURE } from '../config/nicheDesireArchitecture'
import type { NicheKey } from '../types'

/** Lexical patterns matching common forbidden-default endings.
 *  Each pattern maps to category in nicheDesireArchitecture.forbiddenDefaults. */
const FORBIDDEN_PATTERNS: Array<{ category: string; re: RegExp }> = [
  // "tired and healing" tone
  { category: 'tired and healing', re: /(mệt\s+và\s+(lành|hồi)|chỉ\s+cần\s+nghỉ|just\s+tired)/i },
  // inner peace conclusion only
  { category: 'inner peace conclusion only', re: /(bình\s+yên\s+(trong|tận)\s+(lòng|tâm)|an\s+yên\s+nội\s+tại|tâm\s+hồn\s+thanh\s+thản)/i },
  // self-acceptance ending (when niche wants reclamation)
  { category: 'self-acceptance ending', re: /(chấp\s+nhận\s+bản\s+thân|chấp\s+nhận\s+(sự|những)\s+thay\s+đổi)/i },
  // gentle resignation
  { category: 'gentle resignation', re: /(tới\s+tuổi\s+này\s+(thì|là)|cũng\s+đến\s+lúc\s+phải|đành\s+chấp\s+nhận)/i },
  // physical recovery (when niche wants emotional/identity)
  { category: 'physical recovery narrative', re: /(cơ\s+thể\s+(đã|đang)\s+(khoẻ|khỏe)|sức\s+khoẻ\s+ổn\s+định|cơ\s+thể\s+lành)/i },
  // healing narrative without visibility
  { category: 'healing without visibility', re: /(chữa\s+lành|tự\s+chữa\s+lành|hành\s+trình\s+chữa)/i },
]

export function emotionalFlatteningDetector(
  sections: ParsedSection[],
  niche: NicheKey,
): ValidatorResult {
  const desire = NICHE_DESIRE_ARCHITECTURE[niche]
  if (!desire) return { pass: true, violations: [] }

  const violations: ValidatorViolation[] = []

  // Scan Phase 4 ending blocks (emotional-wins + future-self-cta).
  const endingBlockIds = ['emotional-wins', 'future-self-cta']
  const forbiddenCategories = desire.forbiddenDefaults.map((d) => d.toLowerCase())

  for (const s of sections) {
    if (!endingBlockIds.includes(s.id)) continue

    for (const { category, re } of FORBIDDEN_PATTERNS) {
      // Check if this category is forbidden for THIS niche.
      const isForbidden = forbiddenCategories.some(
        (fd) => fd.includes(category.toLowerCase()) ||
                category.toLowerCase().includes(fd.split(' ')[0]),
      )
      if (!isForbidden) continue

      const match = s.copy.match(re)
      if (match) {
        violations.push({
          sectionId: s.id,
          violation:
            `Emotional flattening: ending matches forbidden default "${category}" ` +
            `for niche "${niche}" (gravity should be: ${desire.emotionalGravity}). ` +
            `Found phrase: "${match[0]}". Rewrite ending to land in niche's desire architecture.`,
        })
      }
    }
  }

  return { pass: violations.length === 0, violations }
}
