// ─────────────────────────────────────────────────────────────────────
// CTA — aggressiveSalesDetector (P3, SOFT)
//
// Detects when CTA orchestration drifts toward aggressive DR / hard-sell
// language. Scans all blocks for:
//   - scarcity phrases ("chỉ còn X" / "ưu đãi sắp hết")
//   - hard-sell CTA ("đặt hàng ngay" / "mua ngay" / "order now")
//   - countdown/deadline language
//   - aggressive DR templates ("không thể bỏ qua", "cơ hội cuối")
//
// SOFT — surfaces audit visibility, doesn't trigger retry.
// Existing commercialToneDetector (HARD, Chunk D) catches some of these;
// this is supplementary surveillance for CTA-specific patterns.
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../../storytelling/runtime/parsePackResponse'
import type { ValidatorResult, ValidatorViolation } from '../../storytelling/validators/bioIntroDetector'

/** Aggressive sales markers. Used pack-wide scan. */
const AGGRESSIVE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // Scarcity language
  { pattern: /ch[ỉi]\s+c[òo]n\s+\d+/i,                  reason: 'scarcity countdown ("chỉ còn X")' },
  { pattern: /ưu\s+đ[ãa]i\s+(s[ắa]p\s+h[ếe]t|cu[ốo]i)/i, reason: 'fake scarcity ("ưu đãi sắp hết")' },
  { pattern: /h[ếe]t\s+h[àa]ng\s+s[ớo]m/i,              reason: 'stock pressure ("hết hàng sớm")' },
  { pattern: /s[ốo]\s+l[ưu]ợng\s+c[óo]\s+h[ạa]n/i,      reason: 'limited stock pressure' },

  // Hard CTA
  { pattern: /đ[ặa]t\s+h[àa]ng\s+ngay/i,                reason: 'hard CTA ("đặt hàng ngay")' },
  { pattern: /mua\s+ngay\s+h[ôo]m\s+nay/i,              reason: 'urgency CTA ("mua ngay hôm nay")' },
  { pattern: /(mua\s+ngay|order\s+now)\b/i,             reason: 'hard CTA verb' },
  { pattern: /nh[ấa]nh\s+tay\s+đ[ặa]t/i,                reason: 'urgency push' },

  // Deadline language
  { pattern: /c[ơo]\s+h[ộo]i\s+(cu[ốo]i|duy\s+nh[ấa]t)/i, reason: 'fake "last opportunity"' },
  { pattern: /kh[ôo]ng\s+th[ểe]\s+b[ỏo]\s+qua/i,         reason: 'aggressive DR ("không thể bỏ qua")' },
  { pattern: /h[ôo]m\s+nay\s+l[àa]\s+(ng[àa]y|c[ơo]\s+h[ộo]i)/i, reason: 'today-is-the-day urgency' },
]

export function aggressiveSalesDetector(sections: ParsedSection[]): ValidatorResult {
  const violations: ValidatorViolation[] = []

  for (const s of sections) {
    const text = s.copy
    for (const { pattern, reason } of AGGRESSIVE_PATTERNS) {
      const match = text.match(pattern)
      if (match) {
        violations.push({
          sectionId: s.id,
          violation:
            `Aggressive sales language: "${match[0]}" — ${reason}. ` +
            `CTA orchestration drifted toward hard-sell. Should be emotional momentum only.`,
        })
      }
    }
  }

  return { pass: violations.length === 0, violations }
}
