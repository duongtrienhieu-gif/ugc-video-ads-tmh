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
}

interface RunArgs {
  input: StorytellingInput
  plan: SectionPlan[]
  productBrief: string
  geminiApiKey: string
  kieApiKey: string
}

/** Single Gemini call + parse. Throws on parse error. */
async function runOnce(
  args: RunArgs,
  retryFeedback?: string,
  label = 'storytelling-packgen',
): Promise<ParsedPack> {
  const systemPrompt = buildSystemPrompt(args.input, args.productBrief)
  const userPrompt = buildPackGenUserPrompt(args.input, args.plan, retryFeedback)
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
      return { id: s.id, title: fb.title, copy: fb.copy }
    }),
  }
}

/** Top-level orchestrator. Always returns a usable pack — never throws
 *  on validation. Throws only if Gemini both Gemini+KIE fail OR JSON
 *  malformed beyond recovery. */
export async function generatePackWithRetry(args: RunArgs): Promise<GeneratedPackResult> {
  // ─── Attempt 1 ────────────────────────────────────────────────
  console.info(`[storytelling/runtime] attempt 1 — initial Gemini call`)
  let pack: ParsedPack
  try {
    pack = await runOnce(args, undefined, 'storytelling-packgen-1')
  } catch (err) {
    // Parse / Gemini error — try retry with explicit JSON-mode reminder
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[storytelling/runtime] attempt 1 errored: ${msg.slice(0, 200)} — retrying`)
    const feedback = buildRetryFeedback([
      `Previous attempt errored: ${msg.slice(0, 150)}`,
      'Output MUST be valid JSON only — no markdown fences, no prose outside JSON',
    ])
    pack = await runOnce(args, feedback, 'storytelling-packgen-1-retry')
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
    }
  }

  // ─── Attempt 2 (retry with violation feedback) ────────────────
  console.warn(
    `[storytelling/runtime] attempt 1 had ${initialValidation.violations.length} violations — retrying with feedback`,
  )
  const feedback = buildRetryFeedback(initialValidation.retryFeedback)
  let pack2: ParsedPack
  try {
    pack2 = await runOnce(args, feedback, 'storytelling-packgen-2')
  } catch (err) {
    // Retry call errored — fall back to attempt 1 result + downgrade failing sections
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[storytelling/runtime] attempt 2 errored: ${msg.slice(0, 200)} — using attempt 1 + fallback`)
    return buildFallbackResult(pack, initialValidation, 2)
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
    }
  }

  // ─── Both attempts failed — downgrade failing sections ───────
  console.warn(
    `[storytelling/runtime] attempt 2 still had ${secondValidation.violations.length} violations — applying fallback to failing sections`,
  )
  return buildFallbackResult(pack2, secondValidation, 3)
}

/** When both attempts fail: keep passing sections from last attempt,
 *  replace failing sections with FALLBACK_COPY. Result always validates. */
function buildFallbackResult(
  pack: ParsedPack,
  failedValidation: AggregatedValidation,
  attempts: number,
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
