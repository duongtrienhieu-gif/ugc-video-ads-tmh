// ─────────────────────────────────────────────────────────────────────
// Generation Orchestration — orchestrationValidator (P12, SOFT)
//
// 4 soft checks against the planned orchestration:
//
//   1. Section has rendererOutputs but missing generatedAsset
//      → plan wiring bug
//   2. Routed renderer doesn't appear in rendererOutputs map
//      → adapter coverage gap (should never happen, P11 produces all 3)
//   3. Hero/product sections with empty referenceAssets AND non-empty
//      available pool → reference injection gap
//   4. Page renderer distribution skewed > 80% same renderer
//      → routing logic suspect (one renderer dominating)
//
// SOFT — never modifies the plan. Surfaces for QA.
// ─────────────────────────────────────────────────────────────────────

import type { OrchestratedSection, ReferenceAsset } from '../types'

const SKEW_THRESHOLD = 0.8

export function orchestrationValidator(
  sections: OrchestratedSection[],
  availableReferences: ReferenceAsset[],
): string[] {
  const warnings: string[] = []

  const rendererCounts: Record<string, number> = {}

  for (const s of sections) {
    if (!s.rendererOutputs) continue
    const asset = s.generatedAsset
    if (!asset) {
      warnings.push(
        `Section "${s.id}" has rendererOutputs but missing generatedAsset — ` +
        `plan wiring bug. Check planImageGenerationPage.`,
      )
      continue
    }

    // ── Check 2: renderer in rendererOutputs map ────────────────────
    if (!(asset.renderer in s.rendererOutputs)) {
      warnings.push(
        `Section "${s.id}" routed to renderer '${asset.renderer}' but ` +
        `rendererOutputs is missing this key. Adapter coverage gap.`,
      )
    }

    // ── Check 3: reference injection gap ────────────────────────────
    const intent = s.imageIntent
    if (intent && availableReferences.length > 0 && asset.referenceAssets.length === 0) {
      const productRoles = ['object-trace', 'lifestyle-context', 'proof-callout']
      const characterRoles = ['hero-anchor', 'mood-supporting']
      if (productRoles.includes(intent.imageRole)) {
        const hasProductRef = availableReferences.some(
          (r) => r.kind === 'packaging' || r.kind === 'product-shot' || r.kind === 'logo',
        )
        if (hasProductRef) {
          warnings.push(
            `Section "${s.id}" imageRole='${intent.imageRole}' got 0 references ` +
            `but product references are available. Reference injection gap.`,
          )
        }
      } else if (characterRoles.includes(intent.imageRole)) {
        const hasCharRef = availableReferences.some((r) => r.kind === 'character-reference')
        if (hasCharRef) {
          warnings.push(
            `Section "${s.id}" imageRole='${intent.imageRole}' got 0 references ` +
            `but character reference is available. Reference injection gap.`,
          )
        }
      }
    }

    rendererCounts[asset.renderer] = (rendererCounts[asset.renderer] ?? 0) + 1
  }

  // ── Check 4: routing skew ───────────────────────────────────────
  const totalPlans = Object.values(rendererCounts).reduce((a, b) => a + b, 0)
  if (totalPlans >= 3) {
    for (const [renderer, count] of Object.entries(rendererCounts)) {
      const share = count / totalPlans
      if (share > SKEW_THRESHOLD) {
        warnings.push(
          `Renderer '${renderer}' routes ${count}/${totalPlans} sections ` +
          `(${(share * 100).toFixed(0)}%, > ${SKEW_THRESHOLD * 100}% threshold) — ` +
          `routing skew. Either intent diversity is low or routing table biased.`,
        )
      }
    }
  }

  return warnings
}
