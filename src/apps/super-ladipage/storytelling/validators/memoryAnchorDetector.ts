// ─────────────────────────────────────────────────────────────────────
// memoryAnchorDetector — SOFT WARNING (Chunk C2)
//
// Verifies that Block 10 (why-this-felt-different) contains a SHARP
// memorable anchor phrase. Without it, reader exits the pack with
// emotional impression but forgets the product / mechanism / reason.
//
// Heuristic: search Block 10 text for anchor patterns:
//   - "khác là" / "cái khác" — comparison-anchor
//   - "không phải X mà là Y" / "không phải [...] mà [..]" — mechanism-anchor
//   - "hoá ra" / "thực ra" — insight-anchor
//   - "không [...] không [...] chỉ" — process-anchor
//
// SOFT — flags audit if Block 10 lacks any anchor pattern.
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../runtime/parsePackResponse'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'

const ANCHOR_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'comparison-anchor', re: /(cái\s+khác\s+là|khác\s+biệt\s+nằm|điều\s+khác\s+là)/i },
  { name: 'mechanism-anchor', re: /không\s+phải\s+\S+.{0,80}mà\s+(là|là\s+ở)/i },
  { name: 'insight-anchor', re: /(hoá\s+ra|hóa\s+ra|thực\s+ra\s+thì|té\s+ra)/i },
  { name: 'process-anchor', re: /không\s+\S+\s*(—|-|·)\s*không\s+\S+/i },
  { name: 'wrong-question-anchor', re: /(đặt\s+sai|hỏi\s+sai|nhìn\s+sai)/i },
]

export function memoryAnchorDetector(sections: ParsedSection[]): ValidatorResult {
  const violations: ValidatorViolation[] = []

  const block10 = sections.find((s) => s.id === 'why-this-felt-different')
  if (!block10) {
    // Block 10 not in plan (shouldn't happen — it's required). Skip.
    return { pass: true, violations: [] }
  }

  const text = block10.copy
  const matchedPatterns = ANCHOR_PATTERNS.filter((p) => p.re.test(text))

  if (matchedPatterns.length === 0) {
    violations.push({
      sectionId: 'why-this-felt-different',
      violation:
        `No memory anchor pattern detected in Block 10. Reader will exit ` +
        `with emotional impression but FORGET the product differentiator. ` +
        `Expected one of: comparison ("cái khác là..."), mechanism ("không phải X mà là Y"), ` +
        `insight ("hoá ra..."), process ("không X — không Y — chỉ Z"), wrong-question ("đặt sai câu hỏi"). ` +
        `Check sampledMemoryAnchor injection.`,
    })
  }

  return { pass: violations.length === 0, violations }
}
