// ─────────────────────────────────────────────────────────────────────
// fabricationStatsDetector — anti-fake-stats validator (2026-05-30)
//
// User reported dental pack output included these statistics that were
// NOT in the user input:
//   - "đánh giá 4.9/5.0"
//   - "hơn 700.000 đơn vị đã được bán ra trên toàn thế giới"
//   - "96% nói rằng hiệu quả"
//   - "89% trở thành khách hàng thân thiết"
//   - "hiệu quả gấp 5 lần so với nước súc miệng thông thường"
//
// All fabricated → MY Trade Descriptions Act risk + reader catches the
// inconsistency = lost trust = pack fails to convert.
//
// This validator:
//   1. Scans every section for statistic-looking patterns (X% / X.X/5.0 /
//      thousands count / Nx faster).
//   2. Cross-checks each detected stat against the input fields
//      (productPainPoints + productBenefits + productUsp + productPricing).
//   3. If a stat appears in OUTPUT but NOT in INPUT → fabricated → flag
//      as violation.
//
// Hard validator: 1+ fabricated stat → retry pack with feedback.
//
// Conservative matching: only flag UNAMBIGUOUS statistics (numeric +
// associative context). Doesn't flag prices ("RM59"), phone numbers,
// dates, or narrator's age ("Tôi 38 tuổi" is biography not statistic).
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../runtime/parsePackResponse'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'

interface StatPattern {
  /** Regex to detect the statistic shape. Capture group 1 = the number. */
  pattern: RegExp
  /** Plain-English description of the stat shape. */
  shape: string
  /** Reason text for the violation. */
  reason: string
}

const STAT_PATTERNS: ReadonlyArray<StatPattern> = [
  // 4.9/5.0 or 4.9/5 or 9.5/10 rating
  { pattern: /\b(\d+(?:[.,]\d+)?)\s*\/\s*(?:5(?:\.0)?|10)\b/g, shape: 'rating X/5 or X/10', reason: 'fabricated rating — input does not contain this number' },
  // X% — most common fabrication shape (96%, 89%)
  { pattern: /\b(\d{2,3}(?:[.,]\d+)?)\s*%/g, shape: 'percent X%', reason: 'fabricated percent — input does not contain this number' },
  // Thousands count: 700.000 / 700,000 / 100k / 10M
  { pattern: /\b(\d{1,3}(?:[.,\s]\d{3})+)\s*(người|đơn\s+vị|khách|case|orders?|sản\s+phẩm|chai|hộp|pengguna|reviews?|sold|terjual)/gi, shape: 'volume claim "N người/đơn vị/..."', reason: 'fabricated volume — input does not contain this number' },
  // Nx / N times — "hiệu quả gấp X lần"
  { pattern: /\b(?:gấp|hơn|tăng)\s+(\d+(?:[.,]\d+)?)\s*lần\b/gi, shape: 'multiplier "gấp X lần"', reason: 'fabricated multiplier — input does not contain this comparison' },
  { pattern: /\b(\d+(?:[.,]\d+)?)\s*x\s+(?:faster|better|more|hơn|nhanh)\b/gi, shape: 'multiplier "Nx faster/better"', reason: 'fabricated multiplier — input does not contain this comparison' },
  // Ranking / superlative numeric: "đứng top 1", "số 1 thế giới"
  { pattern: /\bsố\s+1\s+(thế giới|toàn cầu|Việt Nam|Malaysia|Indonesia)/gi, shape: 'ranking "số 1 X"', reason: 'fabricated ranking — input does not back this claim' },
  // "Hàng nghìn / hàng vạn người" hyperbole
  { pattern: /\b(?:hàng\s+(?:nghìn|vạn|triệu|trăm\s+nghìn|chục\s+ngàn))\s+(người|khách|đơn|sản\s+phẩm)/gi, shape: 'hyperbole "hàng nghìn người"', reason: 'fabricated volume hyperbole — input does not back this' },
]

export interface FabricationStatsDetectorOptions {
  /** Concatenated user input fields (painPoints + benefits + USP + pricing
   *  + name + ingredients). Validator checks if the output's stat appears
   *  in this haystack. When empty, every stat is flagged as fabricated. */
  inputHaystack?: string
}

/** Normalize a number string for fuzzy comparison: strip thousand
 *  separators + currency-free, lowercase decimal separator to '.'. */
function normalizeNumber(s: string): string {
  return s
    .replace(/[\s.,](?=\d{3}\b)/g, '')   // strip thousand separators
    .replace(',', '.')                    // unify decimal sep
    .toLowerCase()
}

/** Anti-fabrication-stats validator. HARD when output contains stats
 *  NOT present in the user input.
 *
 *  Trade-off: false-positive risk on stats that appear in the input
 *  in a different format (e.g., input "5 sao" vs output "5/5"). Current
 *  implementation accepts this small risk in favor of catching the
 *  much larger risk of legal-exposure fabrication. */
export function fabricationStatsDetector(
  sections: ParsedSection[],
  options: FabricationStatsDetectorOptions = {},
): ValidatorResult {
  const violations: ValidatorViolation[] = []

  const haystackNormalized = (options.inputHaystack ?? '').toLowerCase()

  for (const s of sections) {
    const text = s.copy
    for (const sp of STAT_PATTERNS) {
      // Reset regex state — `g` flag means stateful iteration.
      const pattern = new RegExp(sp.pattern.source, sp.pattern.flags)
      let m: RegExpExecArray | null
      while ((m = pattern.exec(text)) !== null) {
        const fullMatch = m[0]
        const numberStr = m[1] ?? fullMatch
        const numberNorm = normalizeNumber(numberStr)

        // Check if this number appears (in normalized form) in user input.
        const haystackNumber = haystackNormalized.replace(/[\s.,](?=\d{3}\b)/g, '').replace(/,/g, '.')

        if (haystackNumber.includes(numberNorm)) {
          continue   // input has it — not fabricated
        }

        violations.push({
          sectionId: s.id,
          violation:
            `Fabricated stat "${fullMatch}" (${sp.shape}) — ${sp.reason}. ` +
            `Number "${numberStr}" not found in user input. Strip the stat or rewrite without numeric claim.`,
        })

        // Prevent infinite loop on zero-width matches
        if (m.index === pattern.lastIndex) pattern.lastIndex++
      }
    }
  }

  return { pass: violations.length === 0, violations }
}
