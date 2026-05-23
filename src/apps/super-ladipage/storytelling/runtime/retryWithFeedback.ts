// ═════════════════════════════════════════════════════════════════════
// retryWithFeedback — orchestrate gen → validate → retry → fallback
//
// Strategy:
//   attempt 1: build prompt, call Gemini, parse, validate
//   if pass → return (status='pass')
//   if fail → retry attempt 2 with feedback hint (specific violations)
//   attempt 2: rebuild prompt + feedback, call Gemini, parse, validate
//   if pass → return (status='retry-pass')
//   if fail → downgrade failing sections to FALLBACK_COPY (NOT drama
//             escalation), return with status='fallback' on those sections
//
// Important: max 1 retry. Never escalate. Never throw on validation
// fail — graceful degradation via fallback.
// ═════════════════════════════════════════════════════════════════════

import type { SectionId, SectionPlan, StorytellingInput } from '../types'
import { buildSystemPrompt } from './systemPrompt'
import { buildPackGenUserPrompt, buildRetryFeedback, logPromptStats } from './buildPackGenPrompt'
import { callGeminiForPack } from './callGemini'
import { parsePackResponse } from './parsePackResponse'
import type { ParsedPack, ParsedSection } from './parsePackResponse'
import { runValidators, logValidationResult } from '../validators'
import type { AggregatedValidation } from '../validators'
import { FALLBACK_COPY } from './fallbackCopy'
import type { NarratorDnaSelection } from './selectNarratorDna'
import { selectNarratorDna } from './selectNarratorDna'
import {
  generateReviews,
  buildStoryContextLine,
  type GenerateReviewsResult,
} from './generateReviews'

export type SectionGenStatus =
  | { kind: 'pass' }
  | { kind: 'retry-pass'; firstAttemptViolations: string[] }
  | { kind: 'fallback'; violations: string[] }

export interface GeneratedPackResult {
  sections: ParsedSection[]
  perSectionStatus: SectionGenStatus[]
  attempts: number
  /** Final validation result after all retries/fallbacks. */
  finalValidation: AggregatedValidation
  /** Initial validation (attempt 1) — for telemetry. */
  initialValidation: AggregatedValidation
  /** v5.1+ — narrator/DNA/curve/snapshots/hook/discovery selection used.
   *  Exposed so callers (CLI/UI) can log selection details. */
  selection: NarratorDnaSelection
  /** v5.7 Phase B v2 — separate review-only Gemini call result.
   *  Undefined if review productInfo was not provided to generatePackWithRetry. */
  reviewsCall?: GenerateReviewsResult
}

interface RunArgs {
  input: StorytellingInput
  plan: SectionPlan[]
  productBrief: string
  geminiApiKey: string
  kieApiKey: string
  /** v5.1 — Narrator/DNA/curve selection. OPTIONAL — if undefined,
   *  generatePackWithRetry auto-derives from input via selectNarratorDna.
   *  Top-level service (generateStorytellingPack) passes pre-derived
   *  selection; CLI test harness lets it auto-derive. */
  selection?: NarratorDnaSelection
  /** v5.7 Phase B v2 — product info for SEPARATE review-only Gemini call.
   *  If omitted, review call is skipped and trust-continuity reviews stay empty. */
  productInfo?: {
    productName: string
    painPoint: string
  }
}

/** Single Gemini call + parse. Throws on parse error.
 *  Selection MUST be defined when runOnce called (generatePackWithRetry
 *  ensures via argsWithSelection narrowing). */
async function runOnce(
  args: RunArgs & { selection: NarratorDnaSelection },
  retryFeedback?: string,
  label = 'storytelling-packgen',
): Promise<ParsedPack> {
  const systemPrompt = buildSystemPrompt(args.input, args.productBrief)
  const userPrompt = buildPackGenUserPrompt(args.input, args.plan, args.selection, retryFeedback)
  logPromptStats(systemPrompt, userPrompt, args.plan)

  const raw = await callGeminiForPack({
    geminiApiKey: args.geminiApiKey,
    kieApiKey:    args.kieApiKey,
    systemPrompt,
    userPrompt,
    label,
  })

  const expectedIds = args.plan.map((p) => p.blueprint.id)
  return parsePackResponse(raw, expectedIds)
}

/** Apply fallback copy to specific sections. Returns mutated pack. */
function applyFallback(
  pack: ParsedPack,
  failingIds: SectionId[],
): ParsedPack {
  const failingSet = new Set(failingIds)
  return {
    sections: pack.sections.map((s) => {
      if (!failingSet.has(s.id)) return s
      const fb = FALLBACK_COPY[s.id]
      // v5.7 Phase C — derive paragraphs[] from fb.copy by splitting on \n\n
      // so ParsedSection contract holds (paragraphs required, copy derived).
      const paragraphs = fb.copy
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
      return {
        id: s.id,
        title: fb.title,
        paragraphs,
        copy: paragraphs.join('\n\n'),
        reviews: fb.reviews,
      }
    }),
  }
}

/** Top-level orchestrator. Always returns a usable pack — never throws
 *  on validation. Throws only if Gemini both Gemini+KIE fail OR JSON
 *  malformed beyond recovery.
 *
 *  v5.7 Phase B v2 — if args.productInfo provided, also runs SEPARATE
 *  review-only Gemini call and merges results into trust-continuity section.
 *  Review call failures are non-fatal (pack ships with empty reviews + warning). */
export async function generatePackWithRetry(args: RunArgs): Promise<GeneratedPackResult> {
  const mainResult = await generateMainPackOnly(args)

  // ─── v5.7 Phase B v2 — Separate review-only call ─────────────────
  if (!args.productInfo) {
    // Caller (e.g. legacy UI service) didn't pass productInfo → skip review call.
    return mainResult
  }

  const styles = mainResult.selection.reviewStyles
  if (!styles || styles.length === 0) {
    console.warn('[storytelling/runtime] no reviewStyles in selection — skipping separate review call')
    return mainResult
  }

  const storyContext = buildStoryContextLine(
    args.productInfo.productName,
    args.input.niche,
    args.productInfo.painPoint,
  )
  const reviewsCall = await generateReviews({
    geminiApiKey:     args.geminiApiKey,
    kieApiKey:        args.kieApiKey,
    productName:      args.productInfo.productName,
    productNiche:     args.input.niche,
    painPoint:        args.productInfo.painPoint,
    storyContextLine: storyContext,
    styles,
  })

  // Merge reviews into trust-continuity section if call succeeded.
  let mergedSections = mainResult.sections
  if (reviewsCall.status === 'ok' && reviewsCall.reviews.length > 0) {
    mergedSections = mainResult.sections.map((s) =>
      s.id === 'trust-continuity'
        ? { ...s, reviews: reviewsCall.reviews }
        : s,
    )
  }

  return { ...mainResult, sections: mergedSections, reviewsCall }
}

/** Internal: runs the main pack-gen Gemini call(s) only. v5.7 Phase B v2 split
 *  this out so the wrapper can layer the separate review-only call on top. */
async function generateMainPackOnly(args: RunArgs): Promise<GeneratedPackResult> {
  // v5.1 — Auto-derive narrator/DNA/curve selection if not provided.
  // Top-level service pre-derives; CLI test harness lets us derive here.
  const argsWithSelection: RunArgs & { selection: NarratorDnaSelection } = args.selection
    ? { ...args, selection: args.selection }
    : {
        ...args,
        selection: selectNarratorDna({
          niche:     args.input.niche,
          productId: args.input.productId,
          seed:      args.input.randomSeed,
        }),
      }

  // ─── Attempt 1 ────────────────────────────────────────────────
  console.info(`[storytelling/runtime] attempt 1 — initial Gemini call`)
  let pack: ParsedPack
  try {
    pack = await runOnce(argsWithSelection, undefined, 'storytelling-packgen-1')
  } catch (err) {
    // Parse / Gemini error — try retry with explicit JSON-mode reminder
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[storytelling/runtime] attempt 1 errored: ${msg.slice(0, 200)} — retrying`)
    const feedback = buildRetryFeedback([
      `Previous attempt errored: ${msg.slice(0, 150)}`,
      'Output MUST be valid JSON only — no markdown fences, no prose outside JSON',
    ])
    pack = await runOnce(argsWithSelection, feedback, 'storytelling-packgen-1-retry')
  }

  const initialValidation = runValidators(pack)
  logValidationResult(initialValidation)

  if (initialValidation.pass) {
    return {
      sections: pack.sections,
      perSectionStatus: pack.sections.map(() => ({ kind: 'pass' } as SectionGenStatus)),
      attempts: 1,
      initialValidation,
      finalValidation: initialValidation,
      selection: argsWithSelection.selection,
    }
  }

  // ─── Attempt 2 (retry with violation feedback) ────────────────
  console.warn(
    `[storytelling/runtime] attempt 1 had ${initialValidation.violations.length} violations — retrying with feedback`,
  )
  const feedback = buildRetryFeedback(initialValidation.retryFeedback)
  let pack2: ParsedPack
  try {
    pack2 = await runOnce(argsWithSelection, feedback, 'storytelling-packgen-2')
  } catch (err) {
    // Retry call errored — fall back to attempt 1 result + downgrade failing sections
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[storytelling/runtime] attempt 2 errored: ${msg.slice(0, 200)} — using attempt 1 + fallback`)
    return buildFallbackResult(pack, initialValidation, 2, argsWithSelection.selection)
  }

  const secondValidation = runValidators(pack2)
  logValidationResult(secondValidation)

  if (secondValidation.pass) {
    const violationsByIdInitial = groupViolationsBySection(initialValidation)
    return {
      sections: pack2.sections,
      perSectionStatus: pack2.sections.map((s) => {
        const violations = violationsByIdInitial.get(s.id) ?? []
        if (violations.length > 0) {
          return { kind: 'retry-pass', firstAttemptViolations: violations } as SectionGenStatus
        }
        return { kind: 'pass' } as SectionGenStatus
      }),
      attempts: 2,
      initialValidation,
      finalValidation: secondValidation,
      selection: argsWithSelection.selection,
    }
  }

  // ─── Both attempts failed — downgrade failing sections ───────
  console.warn(
    `[storytelling/runtime] attempt 2 still had ${secondValidation.violations.length} violations — applying fallback to failing sections`,
  )
  return buildFallbackResult(pack2, secondValidation, 3, argsWithSelection.selection)
}

/** When both attempts fail: keep passing sections from last attempt,
 *  replace failing sections with FALLBACK_COPY. Result always validates. */
function buildFallbackResult(
  pack: ParsedPack,
  failedValidation: AggregatedValidation,
  attempts: number,
  selection: NarratorDnaSelection,
): GeneratedPackResult {
  const violationsById = groupViolationsBySection(failedValidation)
  const fixed = applyFallback(pack, failedValidation.failingSections)
  const finalValidation = runValidators(fixed)
  logValidationResult(finalValidation)

  return {
    sections: fixed.sections,
    perSectionStatus: fixed.sections.map((s) => {
      const violations = violationsById.get(s.id) ?? []
      if (violations.length > 0) {
        return { kind: 'fallback', violations } as SectionGenStatus
      }
      return { kind: 'pass' } as SectionGenStatus
    }),
    attempts,
    initialValidation: failedValidation,
    finalValidation,
    selection,
  }
}

function groupViolationsBySection(
  validation: AggregatedValidation,
): Map<SectionId, string[]> {
  const map = new Map<SectionId, string[]>()
  for (const v of validation.violations) {
    const arr = map.get(v.sectionId) ?? []
    arr.push(`[${v.validator}] ${v.violation}`)
    map.set(v.sectionId, arr)
  }
  return map
}
