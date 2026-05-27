// ─────────────────────────────────────────────────────────────────────
// Prompt Translation — promptContractValidator (P10, SOFT)
//
// 4 soft checks against the translated prompt contracts. Detects config
// drift / governance failure / lookup-table holes. Returns warnings.
//
//   1. Section has imageIntent but empty positiveFragments (translation bug)
//   2. Section has proofFeel !== 'none' but no proof fragments in composition
//   3. Duplicate fragments within any single bucket (config drift)
//   4. avoidanceFragments empty on any section (governance failure)
//
// SOFT — never modifies the contract. Surfaces problems for QA.
// ─────────────────────────────────────────────────────────────────────

import type { ImagePromptSection } from '../types'

export function promptContractValidator(sections: ImagePromptSection[]): string[] {
  const warnings: string[] = []

  for (const s of sections) {
    if (!s.imageIntent) continue  // no image → no contract → skip
    const c = s.imagePromptContract
    if (!c) {
      warnings.push(
        `Section "${s.id}" has imageIntent but missing imagePromptContract — ` +
        `translator wiring bug. Check translateImageIntentPage.`,
      )
      continue
    }

    // ── Check 1: empty positiveFragments ──────────────────────────
    if (c.positiveFragments.length === 0) {
      warnings.push(
        `Section "${s.id}" has imageIntent but empty positiveFragments — ` +
        `fragment-map lookup hole. Check fragmentMaps.ts coverage.`,
      )
    }

    // ── Check 2: proofFeel != 'none' but no proof artifact fragment ─
    if (s.imageIntent.proofFeel !== 'none') {
      const hasProofFragment = c.compositionFragments.some(
        (f) =>
          f.includes('screenshot') ||
          f.includes('attribution') ||
          f.includes('testimonial') ||
          f.includes('evidence'),
      )
      if (!hasProofFragment) {
        warnings.push(
          `Section "${s.id}" has proofFeel='${s.imageIntent.proofFeel}' but ` +
          `compositionFragments contain no proof artifact descriptor. ` +
          `Check PROOF_FRAGMENTS_BY_FEEL coverage.`,
        )
      }
    }

    // ── Check 3: duplicate fragments within buckets ─────────────────
    const buckets: Array<[string, string[]]> = [
      ['realismFragments', c.realismFragments],
      ['compositionFragments', c.compositionFragments],
      ['atmosphereFragments', c.atmosphereFragments],
      ['avoidanceFragments', c.avoidanceFragments],
    ]
    for (const [bucketName, list] of buckets) {
      const seen = new Set<string>()
      for (const frag of list) {
        if (seen.has(frag)) {
          warnings.push(
            `Section "${s.id}" has duplicate fragment '${frag}' in ${bucketName} — ` +
            `config drift. translateImageIntent should dedupe but check map overlap.`,
          )
          break  // 1 warning per bucket
        }
        seen.add(frag)
      }
    }

    // ── Check 4: avoidanceFragments empty (governance failure) ─────
    if (c.avoidanceFragments.length === 0) {
      warnings.push(
        `Section "${s.id}" has empty avoidanceFragments — anti-aesthetic ` +
        `governance failure. Check GLOBAL_AVOIDANCE_FRAGMENTS.`,
      )
    }
  }

  return warnings
}
