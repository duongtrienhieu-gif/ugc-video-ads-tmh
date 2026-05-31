// ─────────────────────────────────────────────────────────────────────
// drCloseDetector — pain-driven-DR close cadence validator (2026-05-30)
//
// User feedback (dental whitening pack): pain-driven-DR mode produced
// strong Phase 1-4 agitation + RM500 wasted-money detail + sensory
// transformation peak — then cut to a generic soft close ("Có lẽ đã
// đến lúc bạn cho phép bản thân thử một cách khác") with no action
// verb, no scarcity recall, no transformation echo, no risk reversal.
// "Đầu voi đuôi chuột" = wasted Phase 1-4 conversion energy.
//
// Companion fix in buildPackGenPrompt.ts injects DR_CTA_PROMPT for
// pain-driven-DR packs. This validator HARD-ENFORCES the directive
// at runtime — if Gemini ignored the prompt and shipped a soft close
// anyway, the validator catches it + triggers retry.
//
// Rules (DR mode only — soft + aspiration modes bypass entirely):
//   1. The close-invitation block (future-self-cta) MUST contain at
//      least 1 action verb from the language-appropriate verb list.
//   2. MUST contain at least 1 numeric reference (price / pack tier /
//      duration / scarcity number) — echo of the pricing block.
//
// Both rules are conservative: failing either means the close lacks
// conversion teeth. Both rules passing doesn't guarantee a great
// close, only that the structural minimum is met.
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../runtime/parsePackResponse'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'
import type { NarrativeMode } from '../../narrativeMode'

// Block id that holds the close. Same id used throughout the codebase
// (see resolveBlockPlan + BLOCK_POOL).
const CLOSE_BLOCK_ID = 'future-self-cta' as const

// Per-language action verb whitelist. Conservative — only verbs the
// reader can act on immediately ("click", "type", "tap"). Excludes soft
// verbs like "consider" / "think about".
const ACTION_VERBS_VI: ReadonlyArray<string> = [
  'đặt', 'mua', 'thử', 'lấy', 'nhận', 'click', 'tap', 'nhấn', 'ấn',
  'order', 'add to cart', 'thêm vào giỏ',
]
const ACTION_VERBS_MS: ReadonlyArray<string> = [
  'order', 'beli', 'cuba', 'ambil', 'dapatkan', 'klik', 'tekan',
  'tambah', 'tempah',
]
const ACTION_VERBS_EN: ReadonlyArray<string> = [
  'order', 'buy', 'try', 'get', 'grab', 'click', 'tap', 'add', 'subscribe',
]

// Numeric reference: any RM/USD/$ price OR digit cluster ≥ 2 digits
// inside a context word ('hộp', 'gói', 'pair', 'kotak', 'pack',
// 'hôm nay', 'tháng', etc).
const NUMERIC_REF_RE = /(?:\b(?:RM|USD|VND|IDR|\$)\s*\d|\b\d{2,}\b\s*(?:hộp|gói|chai|pair|kotak|pack|tube|set|kit|đôi|tháng|ngày|hari|days?|months?|weeks?))/i

function pickActionVerbs(language: 'vi' | 'ms' | 'en'): ReadonlyArray<string> {
  switch (language) {
    case 'ms': return ACTION_VERBS_MS
    case 'en': return ACTION_VERBS_EN
    case 'vi':
    default:   return ACTION_VERBS_VI
  }
}

export interface DrCloseDetectorOptions {
  narrativeMode?: NarrativeMode
  targetLanguage?: 'vi' | 'ms' | 'en'
}

/** DR-close cadence validator. Only HARD for pain-driven-DR mode. */
export function drCloseDetector(
  sections: ParsedSection[],
  options: DrCloseDetectorOptions = {},
): ValidatorResult {
  const violations: ValidatorViolation[] = []

  // Only applies to pain-driven-DR. Other modes legitimately use soft close.
  if (options.narrativeMode !== 'pain-driven-DR') {
    return { pass: true, violations: [] }
  }

  const language = options.targetLanguage ?? 'vi'
  const actionVerbs = pickActionVerbs(language)

  const closeSection = sections.find((s) => s.id === CLOSE_BLOCK_ID)
  if (!closeSection) {
    // No close block — pack plan might have skipped it; not the
    // validator's job to enforce presence. Skip silently.
    return { pass: true, violations: [] }
  }

  const text = closeSection.copy.toLowerCase()

  // Rule 1 — action verb present?
  const hasActionVerb = actionVerbs.some((v) => text.includes(v.toLowerCase()))
  if (!hasActionVerb) {
    violations.push({
      sectionId: closeSection.id,
      violation:
        `DR close missing ACTION VERB. Pain-driven-DR close must include at least one of: ` +
        `${actionVerbs.slice(0, 6).join(', ')}. Current close reads as soft-recognition "permission to try". ` +
        `Add explicit imperative recall: "Đặt 1 hộp về thử" / "Order satu kotak" / "Try one box".`,
    })
  }

  // Rule 2 — numeric reference present?
  const hasNumericRef = NUMERIC_REF_RE.test(closeSection.copy)
  if (!hasNumericRef) {
    violations.push({
      sectionId: closeSection.id,
      violation:
        `DR close missing NUMERIC REFERENCE (price / pack tier / duration). ` +
        `Pain-driven-DR close must echo the pricing block's offer ("RM59 promo to end of month", ` +
        `"Pack 2+2 RM89", "30 days money-back"). Without numeric anchor the close drifts into ` +
        `generic soft-recognition.`,
    })
  }

  return { pass: violations.length === 0, violations }
}
