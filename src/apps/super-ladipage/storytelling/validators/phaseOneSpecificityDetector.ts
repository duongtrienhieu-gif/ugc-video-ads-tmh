// ─────────────────────────────────────────────────────────────────────
// phaseOneSpecificityDetector — HARD VALIDATOR (SPEC-FIX 2026-05-27)
//
// Detects Phase 1-2 sections that LACK product-specific physical
// anchoring. Reader recognition requires concrete symptoms FROM THIS
// PRODUCT (e.g., "sáng dậy mũi cứng" for nasal spray, NOT abstract
// "cảm giác nặng nề" or "không nhẹ nhõm").
//
// Generic for ALL products: extracts key noun phrases from synthesis-
// derived readerSpecificSymptoms list (per-pack, per-product) and
// checks each Phase 1-2 section contains at least ONE such anchor.
//
// HARD validator — triggers retry if first 3 Phase-1 blocks all fail
// (recognition phase missing concrete anchors → conversion will fail).
// SOFT warning otherwise (partial coverage).
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../runtime/parsePackResponse'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'
import type { BlockId } from '../types'

/** Phase 1-2 block IDs that MUST anchor to product-specific symptoms. */
const PHASE_1_2_BLOCK_IDS: ReadonlyArray<BlockId> = [
  'self-recognition-hook',
  'daily-micro-friction',
  'hidden-emotional-truth',
  'not-alone-bridge',
  'narrator-validation-entry',
  'shared-failed-attempts',
]

/** Vietnamese stop-words to exclude when extracting key terms from
 *  readerSpecificSymptoms (so we don't match on "và", "khi", "có"). */
const STOP_WORDS = new Set([
  // Vietnamese function words
  'và', 'khi', 'có', 'một', 'cái', 'là', 'của', 'để', 'cho', 'như', 'sau',
  'trước', 'với', 'theo', 'nhưng', 'mà', 'thì', 'rằng', 'này', 'đó', 'ấy',
  'được', 'bị', 'không', 'chưa', 'đã', 'sẽ', 'đang', 'phải', 'cần', 'có thể',
  'lại', 'mới', 'còn', 'cũng', 'rồi', 'lên', 'xuống', 'ra', 'vào', 'tại',
  'trong', 'ngoài', 'trên', 'dưới', 'qua', 'từ', 'đến', 'tới', 'về', 'bằng',
  // Generic body/emotion words that DON'T add product specificity
  'người', 'cơ thể', 'cảm giác', 'cảm thấy', 'tự', 'mình', 'bản thân',
  // Punctuation noise
  '(', ')', ',', '.', '—', ':', ';', "'", '"',
])

/** Extract key noun-phrase tokens from a symptom string.
 *  Naive but works: pick 2+ char chunks that aren't stop-words. */
function extractKeyTerms(symptom: string): string[] {
  const lowered = symptom.toLowerCase()
  // Split by common Vietnamese delimiters but KEEP multi-word phrases
  // by also extracting 2-word bigrams (which often carry the real
  // product-specific signal: "mũi cứng", "đầu gối", "men gan", etc.)
  const words = lowered
    .split(/[\s,()\-—:;'"\.]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w))

  const terms: string[] = []
  // Single-word terms (≥ 3 chars)
  for (const w of words) {
    if (w.length >= 3) terms.push(w)
  }
  // Bigrams (2-word phrases — often the real anchor)
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`
    if (bigram.length >= 5) terms.push(bigram)
  }
  return terms
}

/** Returns true if section.copy contains at least one of the key terms. */
function sectionAnchorsTo(section: ParsedSection, keyTerms: string[]): boolean {
  const lowerCopy = section.copy.toLowerCase()
  return keyTerms.some((term) => lowerCopy.includes(term))
}

export function phaseOneSpecificityDetector(
  sections: ParsedSection[],
  readerSpecificSymptoms: string[],
): ValidatorResult {
  // No synthesis-derived symptoms → can't validate (synthesis failed/fallback).
  // Return pass — don't false-flag legacy packs.
  if (!readerSpecificSymptoms || readerSpecificSymptoms.length === 0) {
    return { pass: true, violations: [] }
  }

  // Build a flat list of key terms across all symptoms.
  const keyTerms = Array.from(
    new Set(readerSpecificSymptoms.flatMap((s) => extractKeyTerms(s))),
  ).filter((t) => t.length >= 3)

  if (keyTerms.length === 0) {
    return { pass: true, violations: [] }
  }

  const violations: ValidatorViolation[] = []
  const phaseSections = sections.filter(
    (s) => typeof s.id === 'string' && (PHASE_1_2_BLOCK_IDS as string[]).includes(s.id),
  )

  let failedCount = 0
  for (const s of phaseSections) {
    if (!sectionAnchorsTo(s, keyTerms)) {
      failedCount++
      violations.push({
        sectionId: s.id,
        violation:
          `Phase 1-2 specificity failure: section "${s.id}" lacks any product-specific ` +
          `physical anchor. Reader can't recognize "this is MY problem" — pack drifts to ` +
          `abstract emotional space. Must mention ≥1 concrete symptom from synthesis brief ` +
          `(eg "${readerSpecificSymptoms[0].slice(0, 60)}...").`,
      })
    }
  }

  // HARD fail rule: if MORE THAN HALF of Phase 1-2 sections lack anchors,
  // recognition is broken — trigger retry. (1 weak section is tolerable;
  // 3+ weak sections out of 6 means systematic abstraction drift.)
  const hardFail = phaseSections.length >= 3 && failedCount > phaseSections.length / 2

  return {
    pass: !hardFail && violations.length === 0,
    violations,
  }
}
