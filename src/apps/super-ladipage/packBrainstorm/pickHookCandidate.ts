// ─────────────────────────────────────────────────────────────────────
// Pack Brainstorm — pickHookCandidate (REBUILD Sprint 4, 2026-05-28)
//
// Seed-based picker that selects 1 of N hook candidates emitted by the
// brainstormer, respecting an anti-repeat memory of fingerprints used
// for THIS PRODUCT in previous packs.
//
// Selection rules:
//   1. Filter out candidates whose fingerprint matches any
//      `avoidedFingerprints` entry. If filter removes ALL candidates,
//      bypass the filter (better to repeat than to fail the pack).
//   2. Pick the remaining candidate at index (seed % candidates.length).
//   3. Fingerprint = sha-lite hash of subVariant + normalized first 60
//      chars of hookDraft. Stable across regenerations.
// ─────────────────────────────────────────────────────────────────────

import type { HookCandidate } from './types'

/** Lightweight deterministic hash — sufficient for fingerprint comparison
 *  + localStorage de-dupe. No crypto dependency. */
export function hookFingerprint(candidate: { subVariant: string; hookDraft: string }): string {
  const normalized = (candidate.hookDraft || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  const input = `${candidate.subVariant}::${normalized}`
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i)
    hash |= 0
  }
  // Encode as short base36 string + sub-variant prefix for human-readable telemetry
  return `${candidate.subVariant.slice(0, 12)}-${(hash >>> 0).toString(36)}`
}

export interface PickHookCandidateInput {
  candidates: HookCandidate[]
  seed: number
  avoidedFingerprints?: string[]
}

export interface PickHookCandidateResult {
  picked: HookCandidate
  fingerprint: string
  /** True when the picker had to bypass the avoid list because every
   *  candidate matched a recent fingerprint. Surface in logs so we can
   *  tell when memory needs flushing or candidate pool needs widening. */
  bypassed: boolean
  /** Total candidates considered (telemetry). */
  candidatePoolSize: number
}

export function pickHookCandidate(input: PickHookCandidateInput): PickHookCandidateResult {
  if (input.candidates.length === 0) {
    throw new Error('[pickHookCandidate] candidates array is empty')
  }

  const avoid = new Set((input.avoidedFingerprints ?? []).map((s) => s.toLowerCase()))

  // Compute fingerprint for each candidate upfront
  const withPrints = input.candidates.map((c) => ({
    candidate: c,
    print: hookFingerprint(c),
  }))

  let pool = withPrints.filter((p) => !avoid.has(p.print.toLowerCase()))
  let bypassed = false

  if (pool.length === 0) {
    // Every candidate matched something in the avoid list — bypass.
    pool = withPrints
    bypassed = true
  }

  const seed = Math.abs(input.seed | 0)
  const picked = pool[seed % pool.length]

  return {
    picked: picked.candidate,
    fingerprint: picked.print,
    bypassed,
    candidatePoolSize: input.candidates.length,
  }
}
