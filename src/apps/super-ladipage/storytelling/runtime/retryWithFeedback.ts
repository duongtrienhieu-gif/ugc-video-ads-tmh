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

import type { BlockId, BlockPlan, StorytellingInput } from '../types'
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
  generateProofSet,
  buildStoryContextLine,
  type GenerateProofSetResult,
  type ProofPiece,
} from '../../proof'
import { isProofBlock } from '../config/blockPool'

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
  /** Proof System P1 — separate proof Gemini call result.
   *  Replaces legacy reviewsCall. Undefined if productInfo was not provided. */
  reviewsCall?: GenerateProofSetResult
}

interface RunArgs {
  input: StorytellingInput
  plan: BlockPlan[]
  productBrief: string
  /** P-PRODUCT-CLASS (2026-05-27) — Product reality block. Positive
   *  description (mechanism / hero triggers / failed attempts / discovery
   *  context) — injected INTO system prompt as context, not rules.
   *  Optional: omitted = pack ships with niche-only context (legacy path). */
  realityBrief?: string
  /** P-SYNTHESIS (2026-05-27) — Deep product synthesis brief.
   *  PRIMARY context — leads system prompt before niche pool data.
   *  Contains forbiddenDriftSymptoms guardrail. Highest accuracy layer. */
  synthesizedBrief?: string
  /** SPEC-FIX (2026-05-27) — Reader-specific symptoms from synthesis,
   *  passed structurally so nicheDomainLockBrief can REPLACE its generic
   *  symptom pool (single source of truth, no competing pools). */
  synthesizedReaderSymptoms?: string[]
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
  const systemPrompt = buildSystemPrompt(
    args.input,
    args.productBrief,
    args.realityBrief,
    args.synthesizedBrief,
  )
  const userPrompt = buildPackGenUserPrompt(
    args.input,
    args.plan,
    args.selection,
    retryFeedback,
    args.synthesizedReaderSymptoms,
  )
  logPromptStats(systemPrompt, userPrompt, args.plan)

  const raw = await callGeminiForPack({
    geminiApiKey: args.geminiApiKey,
    kieApiKey:    args.kieApiKey,
    systemPrompt,
    userPrompt,
    label,
  })

  // P2: filter out proof blocks — Gemini main call generates story only.
  // Proof blocks filled by interleaveProofBlocks() after both calls complete.
  const expectedIds = args.plan
    .filter((p) => !isProofBlock(p.blueprint.id))
    .map((p) => p.blueprint.id)
  return parsePackResponse(raw, expectedIds)
}

/** P2 — Interleave proof block placeholders into story sections.
 *  Returns full pack sections in plan order. Proof blocks have empty
 *  paragraphs until fillProofBlocks() runs. */
function interleaveProofPlaceholders(
  storyPack: ParsedPack,
  plan: BlockPlan[],
): ParsedPack {
  const storyMap = new Map(storyPack.sections.map((s) => [s.id, s]))
  const fullSections: ParsedSection[] = plan.map((bp) => {
    if (isProofBlock(bp.blueprint.id)) {
      return {
        id: bp.blueprint.id,
        title: '',
        paragraphs: [],
        copy: '',
      }
    }
    const existing = storyMap.get(bp.blueprint.id)
    if (existing) return existing
    // Should not happen — story block missing from Gemini output.
    return {
      id: bp.blueprint.id,
      title: '',
      paragraphs: [],
      copy: '',
    }
  })
  return { sections: fullSections }
}

/** P2 — Fill proof block placeholders with proof pieces by phaseResonance.
 *  Each proof block ID maps to a piece's phaseResonance:
 *    proof-recognition  ← phaseResonance='recognition'
 *    proof-solution     ← phaseResonance='solution'
 *    proof-future-self  ← phaseResonance='future-self'
 *  Unmatched proof blocks stay with empty content (no piece sampled for that phase). */
function fillProofBlocks(pack: ParsedPack, pieces: ProofPiece[]): ParsedPack {
  // Build phase → piece map
  const pieceByPhase = new Map<string, ProofPiece>()
  for (const piece of pieces) {
    if (piece.phaseResonance) {
      pieceByPhase.set(piece.phaseResonance, piece)
    }
  }

  const proofIdToPhase: Record<string, string> = {
    'proof-recognition':  'recognition',
    'proof-solution':     'solution',
    'proof-future-self':  'future-self',
  }

  return {
    sections: pack.sections.map((s) => {
      if (!isProofBlock(s.id as BlockId)) return s
      const phase = proofIdToPhase[s.id]
      const piece = phase ? pieceByPhase.get(phase) : undefined
      if (!piece) return s  // no piece for this phase — placeholder stays empty
      // Compose piece into block content. Title = author label, paragraphs = quote.
      const authorTag = piece.author ? ` — ${piece.author}` : ''
      const metaTag = piece.meta ? ` · ${piece.meta}` : ''
      return {
        id: s.id,
        title: piece.author ?? 'Chia sẻ',
        paragraphs: [piece.quote, `${authorTag}${metaTag}`.trim()].filter((p) => p.length > 0),
        copy: `${piece.quote}\n\n${authorTag}${metaTag}`.trim(),
        reviews: [{ quote: piece.quote, author: piece.author, meta: piece.meta }],
      }
    }),
  }
}

/** Apply fallback copy to specific blocks. Returns mutated pack. */
function applyFallback(
  pack: ParsedPack,
  failingIds: BlockId[],
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
 *  Proof System P1 — if args.productInfo provided, also runs SEPARATE
 *  proof Gemini call (replaces legacy generateReviews). Result merges
 *  into social-proof block. Proof call failures non-fatal (pack ships
 *  with empty reviews + warning). */
export async function generatePackWithRetry(args: RunArgs): Promise<GeneratedPackResult> {
  const mainResult = await generateMainPackOnly(args)

  // ─── Separate proof call (Proof System P1) ───────────────────────
  if (!args.productInfo) {
    // Caller didn't pass productInfo → skip proof call.
    return mainResult
  }

  const storyContext = buildStoryContextLine(
    args.productInfo.productName,
    args.input.niche,
    args.productInfo.painPoint,
  )
  const reviewsCall = await generateProofSet({
    geminiApiKey:     args.geminiApiKey,
    kieApiKey:        args.kieApiKey,
    productName:      args.productInfo.productName,
    productNiche:     args.input.niche,
    painPoint:        args.productInfo.painPoint,
    storyContextLine: storyContext,
    seed:             mainResult.selection.seed,
  })

  // P2 — Distribute proof pieces into proof block placeholders by phaseResonance.
  // proof-recognition ← phaseResonance='recognition', proof-solution ← 'solution',
  // proof-future-self ← 'future-self'. Unmatched proof blocks stay empty (rare).
  let mergedSections = mainResult.sections
  if (reviewsCall.status === 'ok' && reviewsCall.pieces.length > 0) {
    const filled = fillProofBlocks({ sections: mainResult.sections }, reviewsCall.pieces)
    mergedSections = filled.sections
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

  const initialValidation = runValidators(pack, args.input.niche, args.synthesizedReaderSymptoms)
  logValidationResult(initialValidation)

  if (initialValidation.pass) {
    // P2 — interleave proof block placeholders into final pack.sections.
    // Proof content filled later by generatePackWithRetry after proof Gemini call.
    const fullPack = interleaveProofPlaceholders(pack, args.plan)
    return {
      sections: fullPack.sections,
      perSectionStatus: fullPack.sections.map(() => ({ kind: 'pass' } as SectionGenStatus)),
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
    return buildFallbackResult(pack, initialValidation, 2, argsWithSelection.selection, args.input.niche, args.plan, args.synthesizedReaderSymptoms)
  }

  const secondValidation = runValidators(pack2, args.input.niche, args.synthesizedReaderSymptoms)
  logValidationResult(secondValidation)

  if (secondValidation.pass) {
    const violationsByIdInitial = groupViolationsBySection(initialValidation)
    // P2 — interleave proof block placeholders into final pack.sections.
    const fullPack = interleaveProofPlaceholders(pack2, args.plan)
    return {
      sections: fullPack.sections,
      perSectionStatus: fullPack.sections.map((s) => {
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
  return buildFallbackResult(pack2, secondValidation, 3, argsWithSelection.selection, args.input.niche, args.plan, args.synthesizedReaderSymptoms)
}

/** When both attempts fail: keep passing sections from last attempt,
 *  replace failing sections with FALLBACK_COPY. Result always validates.
 *  P2 — interleaves proof block placeholders after fallback. */
function buildFallbackResult(
  pack: ParsedPack,
  failedValidation: AggregatedValidation,
  attempts: number,
  selection: NarratorDnaSelection,
  niche: import('../types').NicheKey,
  plan: BlockPlan[],
  readerSpecificSymptoms?: string[],
): GeneratedPackResult {
  const violationsById = groupViolationsBySection(failedValidation)
  const fixed = applyFallback(pack, failedValidation.failingSections)
  const finalValidation = runValidators(fixed, niche, readerSpecificSymptoms)
  logValidationResult(finalValidation)

  // P2 — interleave proof block placeholders into final pack.
  const fullPack = interleaveProofPlaceholders(fixed, plan)

  return {
    sections: fullPack.sections,
    perSectionStatus: fullPack.sections.map((s) => {
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
): Map<BlockId, string[]> {
  const map = new Map<BlockId, string[]>()
  for (const v of validation.violations) {
    const arr = map.get(v.sectionId as BlockId) ?? []
    arr.push(`[${v.validator}] ${v.violation}`)
    map.set(v.sectionId as BlockId, arr)
  }
  return map
}
