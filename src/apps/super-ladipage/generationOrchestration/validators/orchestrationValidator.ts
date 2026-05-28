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
//
// Fix C (2026-05-29) — Two checks demoted to no-op for the post-rebuild
// world (the fragment-stacking + 3-renderer pipeline was deleted in
// IS.6, which made these checks fire on every single pack as false
// positives):
//
//   - Check 2 "adapter coverage gap": adaptRenderContractedPage now
//     intentionally returns empty rendererOutputs={} because real
//     prompts are produced at exec time by scene synthesis. The check
//     was written against the pre-rebuild assumption that the adapter
//     populates outputs for all 3 renderers. → Skip when outputs map
//     is the empty post-rebuild sentinel.
//
//   - Check 4 "routing skew > 80%": post-rebuild we only have 2
//     renderers (gpt4o + gptImage). storytelling packs are 100%
//     gpt4o by design (every section needs character/product
//     reference lock; gptImage is reserved for ref-less object-trace).
//     80% threshold is impossible to honor with this routing table.
//     → Raise threshold to 100% so it only warns on a degenerate
//     all-gptImage page (which would mean no character continuity).
// ─────────────────────────────────────────────────────────────────────

import type { OrchestratedSection, ReferenceAsset } from '../types'

// Post-rebuild: 2 renderers (gpt4o for character/product, gptImage for
// ref-less). storytelling packs naturally route 100% gpt4o; only flag a
// page that is 100% gptImage (no character continuity at all).
const SKEW_THRESHOLD = 1.0

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
    // Fix C (2026-05-29) — Skip when rendererOutputs is the post-rebuild
    // empty-object sentinel ({}). adaptRenderContractedPage intentionally
    // produces empty maps post-IS.6; real prompts come from scene synthesis
    // at exec time. The original check fired on every storytelling pack
    // as a false positive.
    const outputsAreEmptySentinel = Object.keys(s.rendererOutputs).length === 0
    if (!outputsAreEmptySentinel && !(asset.renderer in s.rendererOutputs)) {
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
