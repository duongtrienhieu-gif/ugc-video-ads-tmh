// ─────────────────────────────────────────────────────────────────────
// Proof System — generateProofSet (P1 foundation)
//
// Replaces legacy runtime/generateReviews.ts.
//
// Separate Gemini call for proof generation. Voice-isolated from
// storytelling narrator. 3 proof pieces with stance/entropy/phase
// variety enforced via sampleProofConfig.
//
// Output shape compatible with current ParsedReview consumers — fills
// social-proof block's reviews[] field.
// ─────────────────────────────────────────────────────────────────────

import { textGenWithFallback } from '../../services/textGenWithFallback'
import type { NicheKey, ProofPiece } from '../types'
import { sampleProofConfig } from './sampleProofConfig'
import { buildProofSystemPrompt, buildProofUserPrompt } from './proofPrompts'

const PROOF_TIMEOUT_MS = 45_000

export interface GenerateProofSetArgs {
  geminiApiKey: string
  kieApiKey: string
  productName: string
  productNiche: NicheKey
  painPoint: string
  /** 1-line summary of protagonist's story arc — minimal context so proof
   *  voices can land without leaking narrator voice. */
  storyContextLine: string
  /** Seed for deterministic sampling. */
  seed: string
}

export interface GenerateProofSetResult {
  pieces: ProofPiece[]
  status: 'ok' | 'parse-error' | 'call-error' | 'empty'
  runtimeSec: number
  errorMessage?: string
  /** Telemetry — sampled config (for debug + future audit). */
  sampledStances?: string[]
}

/** Parse proof JSON response. Tolerant of fence wrappers. */
function parseProofResponse(raw: string): ProofPiece[] | null {
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  }
  try {
    const obj = JSON.parse(cleaned) as { reviews?: unknown }
    if (!obj || !Array.isArray(obj.reviews)) return null
    const pieces: ProofPiece[] = []
    for (const r of obj.reviews) {
      if (!r || typeof r !== 'object') continue
      const rec = r as Record<string, unknown>
      const quote = typeof rec.quote === 'string' ? rec.quote.trim() : ''
      if (!quote) continue
      const author = typeof rec.author === 'string' ? rec.author.trim() : undefined
      const meta = typeof rec.meta === 'string' ? rec.meta.trim() : undefined
      pieces.push({ quote, author, meta })
    }
    return pieces.length > 0 ? pieces : null
  } catch {
    return null
  }
}

/** Top-level proof generator. Always returns a result (never throws).
 *  Caller checks `status` to decide whether to use pieces or warn. */
export async function generateProofSet(args: GenerateProofSetArgs): Promise<GenerateProofSetResult> {
  const startedAt = Date.now()

  const config = sampleProofConfig(args.seed, args.productNiche)
  const sampledStances = config.pieces.map((p) => p.stance.id)

  const systemPrompt = buildProofSystemPrompt()
  const userPrompt = buildProofUserPrompt({
    productName: args.productName,
    productNiche: args.productNiche,
    painPoint: args.painPoint,
    storyContextLine: args.storyContextLine,
    config,
  })

  console.info(
    `[proof/generateProofSet] proof call — niche=${args.productNiche}, ` +
    `stances=[${sampledStances.join(', ')}]`,
  )

  try {
    const raw = await textGenWithFallback({
      geminiApiKey:      args.geminiApiKey,
      kieApiKey:         args.kieApiKey,
      systemInstruction: systemPrompt,
      prompt:            userPrompt,
      jsonMode:          true,
      maxOutputTokens:   800,
      timeoutMs:         PROOF_TIMEOUT_MS,
      label:             'proof-set',
    })
    const runtimeSec = (Date.now() - startedAt) / 1000

    const parsed = parseProofResponse(raw)
    if (!parsed || parsed.length === 0) {
      console.warn(`[proof/generateProofSet] parse failed or empty — raw="${raw.slice(0, 200)}"`)
      return {
        pieces: [],
        status: 'parse-error',
        runtimeSec,
        errorMessage: 'parse failed',
        sampledStances,
      }
    }

    // Attach stance telemetry per piece (in order of generation).
    const annotated: ProofPiece[] = parsed.map((piece, i) => ({
      ...piece,
      stanceId: config.pieces[i]?.stance.id,
      phaseResonance: config.pieces[i]?.phaseResonance,
    }))

    console.info(`[proof/generateProofSet] ✓ ${annotated.length} pieces in ${runtimeSec.toFixed(1)}s`)
    return { pieces: annotated, status: 'ok', runtimeSec, sampledStances }
  } catch (err) {
    const runtimeSec = (Date.now() - startedAt) / 1000
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[proof/generateProofSet] call failed in ${runtimeSec.toFixed(1)}s: ${msg.slice(0, 200)}`)
    return {
      pieces: [],
      status: 'call-error',
      runtimeSec,
      errorMessage: msg,
      sampledStances,
    }
  }
}

/** Compose minimal story context line for proof prompt. */
export function buildStoryContextLine(
  productName: string,
  productNiche: string,
  painPoint: string,
): string {
  return `Người chia sẻ là một narrator trải qua "${painPoint.slice(0, 80)}" và tìm thấy ${productName} (niche: ${productNiche}). Reviews là từ người khác đọc bài share, không phải narrator.`
}
