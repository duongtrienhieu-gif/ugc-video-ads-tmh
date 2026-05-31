// ─────────────────────────────────────────────────────────────────────
// fakeCertDetector — anti-fake cert claim validator (2026-05-30)
//
// User reported dental pack output included "vợ tôi đã kiểm tra KKM,
// tất cả đều được chứng nhận và sản xuất tại nhà máy tuân thủ tiêu
// chuẩn EU-GMP" — the system fabricated cert/regulatory claims that
// were never in the user input. This is a SERIOUS LEGAL RISK in MY
// (Trade Descriptions Act) + matches the user-pinned memory rule
// `[[feedback-no-fake-certs]]`.
//
// This validator catches cert + regulatory body mentions in the
// generated pack copy. If the input did not provide cert proof (no
// uploaded cert image, no explicit cert field), the cert mention is
// REJECTED + the section flagged for retry.
//
// Sources scanned: any storytelling section .copy field. PI blocks are
// scanned at PI generation time via generatePIBatch's banned-phrase
// hook (same place we caught "gốc rễ"). The two layers compose without
// overlap — storytelling sees its own blocks, PI sees its own.
//
// Conservative matching: only flag UNAMBIGUOUS regulatory body mentions
// that imply official certification. Doesn't flag "tôi cảm thấy yên
// tâm" / "an toàn" / soft trust signals — those are narrator opinion,
// not regulatory claims.
//
// Hard validator: 1+ unsupported cert claim → retry pack with feedback.
// Soft mode: when input has cert proof URL, the same phrases are OK.
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../runtime/parsePackResponse'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'

interface CertPattern {
  pattern: RegExp
  bodyName: string
  reason: string
}

// Regulatory bodies + cert badges that imply official certification.
// All matched case-insensitively. Word-boundary anchored where possible
// so "kkm" doesn't match inside "skkm" or "okkm".
const CERT_PATTERNS: ReadonlyArray<CertPattern> = [
  // Malaysia
  { pattern: /\bKKM\b/i,                bodyName: 'KKM (Kementerian Kesihatan Malaysia)', reason: 'cert claim implies KKM endorsement — legal risk if no proof' },
  { pattern: /\bJAKIM\b/i,              bodyName: 'JAKIM', reason: 'cert claim implies JAKIM (Halal) endorsement — legal risk' },
  { pattern: /\bMS\s*1500\b/i,          bodyName: 'MS 1500 (JAKIM Halal Malaysia)', reason: 'cert claim implies MS 1500 (JAKIM Halal) — legal risk' },
  { pattern: /\bNPRA\b/i,               bodyName: 'NPRA (National Pharmaceutical Regulatory Agency)', reason: 'cert claim implies NPRA registration — legal risk' },
  // Halal claims (often paired with brand "Halal Certified" or "Halal certification")
  { pattern: /\bhalal\s+certified\b/i,  bodyName: 'Halal Certified', reason: 'cert claim implies Halal certification — legal risk if no JAKIM/MUI proof' },
  { pattern: /\bsijil\s+halal\b/i,      bodyName: 'Sijil Halal (MS)', reason: 'cert claim implies Halal cert — legal risk' },
  { pattern: /\bchứng\s+nhận\s+halal\b/i, bodyName: 'Chứng nhận Halal (VN)', reason: 'cert claim implies Halal cert — legal risk' },
  // GMP / EU-GMP / cGMP
  { pattern: /\bGMP\b/i,                bodyName: 'GMP (Good Manufacturing Practice)', reason: 'cert claim implies GMP-certified facility — legal risk' },
  { pattern: /\bEU[\s-]?GMP\b/i,        bodyName: 'EU-GMP', reason: 'cert claim implies EU-GMP facility — legal risk' },
  { pattern: /\bcGMP\b/i,               bodyName: 'cGMP', reason: 'cert claim implies current GMP — legal risk' },
  { pattern: /\btiêu\s+chuẩn\s+EU[\s-]?GMP\b/i, bodyName: 'tiêu chuẩn EU-GMP', reason: 'cert claim — legal risk' },
  // US
  { pattern: /\bFDA[\s-]?approved\b/i,  bodyName: 'FDA approved', reason: 'cert claim implies FDA approval — legal risk' },
  { pattern: /\bFDA[\s-]?registered\b/i,bodyName: 'FDA registered', reason: 'cert claim implies FDA registration — legal risk' },
  { pattern: /\bFDA\s+chứng\s+nhận\b/i, bodyName: 'FDA chứng nhận (VN)', reason: 'cert claim — legal risk' },
  // Indonesia
  { pattern: /\bBPOM\b/i,               bodyName: 'BPOM (Badan POM)', reason: 'cert claim implies BPOM registration — legal risk' },
  // ISO
  { pattern: /\bISO\s*\d{4,5}\b/i,      bodyName: 'ISO', reason: 'cert claim implies ISO certification — legal risk if no doc' },
  // Vietnam
  { pattern: /\bBộ\s+Y\s+tế\s+chứng\s+nhận\b/i, bodyName: 'Bộ Y tế chứng nhận (VN MOH)', reason: 'cert claim — legal risk' },
  { pattern: /\bGiấy\s+phép\s+lưu\s+hành\b/i, bodyName: 'Giấy phép lưu hành (VN)', reason: 'cert claim — legal risk' },
  // Generic fab patterns
  { pattern: /\bđược\s+chứng\s+nhận\s+(quốc\s+tế|bộ\s+y\s+tế|halal|kkm|gmp|fda)/i, bodyName: 'cert verb + body', reason: 'cert claim — legal risk' },
  { pattern: /\bcertified\s+by\s+(KKM|JAKIM|NPRA|FDA|BPOM|GMP|HALAL)/i, bodyName: 'cert verb + body (EN)', reason: 'cert claim — legal risk' },
]

export interface FakeCertDetectorOptions {
  /** Whether the user uploaded any cert proof asset (image, document URL).
   *  When true, the detector is bypassed — cert mentions are allowed. */
  userProvidedCertProof?: boolean
}

/** Anti-fake-cert validator. HARD when no proof was uploaded. */
export function fakeCertDetector(
  sections: ParsedSection[],
  options: FakeCertDetectorOptions = {},
): ValidatorResult {
  const violations: ValidatorViolation[] = []

  // When user uploaded actual cert proof, all mentions are legitimately
  // backed → skip validation entirely.
  if (options.userProvidedCertProof) {
    return { pass: true, violations: [] }
  }

  for (const s of sections) {
    const text = s.copy
    for (const { pattern, bodyName, reason } of CERT_PATTERNS) {
      const m = text.match(pattern)
      if (m) {
        const matched = m[0]
        violations.push({
          sectionId: s.id,
          violation:
            `Unsupported cert claim "${matched}" (${bodyName}) — ${reason}. ` +
            `Input did not provide cert proof. Strip cert mention or skip this claim.`,
        })
      }
    }
  }

  return { pass: violations.length === 0, violations }
}
