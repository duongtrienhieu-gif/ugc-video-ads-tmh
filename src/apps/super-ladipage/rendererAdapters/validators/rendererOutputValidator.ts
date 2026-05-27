// ─────────────────────────────────────────────────────────────────────
// Renderer Adapters — rendererOutputValidator (P11, SOFT)
//
// 4 governance-preservation checks across the 3 adapters. Confirms
// psychology survives translation:
//
//   1. Any adapter has empty positive prompt when contract exists
//      → translation hole / adapter wiring bug
//   2. SDXL/Flux negativePrompt has FEWER fragments than half of the
//      source avoidanceFragments → avoidance weakened
//   3. GPT Image prompt missing "avoiding" inline tail when avoidance
//      non-empty → governance lost in conversational assembly
//   4. Any adapter positive prompt > 800 chars → bloat risk (renderer
//      may truncate, dropping tail psychology)
//
// SOFT — never modifies outputs. Surfaces problems for QA.
// ─────────────────────────────────────────────────────────────────────

import type { RendererAdaptedSection } from '../types'

const MAX_PROMPT_CHARS = 800

export function rendererOutputValidator(sections: RendererAdaptedSection[]): string[] {
  const warnings: string[] = []

  for (const s of sections) {
    if (!s.imagePromptContract) continue
    const outputs = s.rendererOutputs
    if (!outputs) {
      warnings.push(
        `Section "${s.id}" has imagePromptContract but missing rendererOutputs — ` +
        `adapter wiring bug. Check adaptRenderContractedPage.`,
      )
      continue
    }

    const avoidanceCount = s.imagePromptContract.avoidanceFragments.length
    const minNegativeFragments = Math.ceil(avoidanceCount / 2)

    // ── Check 1: empty positive prompt per adapter ──────────────────
    for (const key of ['gptImage', 'flux', 'sdxl'] as const) {
      const out = outputs[key]
      if (!out.prompt || out.prompt.trim().length === 0) {
        warnings.push(
          `Section "${s.id}" adapter '${key}' produced empty positive prompt — ` +
          `translation hole. Check ${key}Adapter.`,
        )
      }
    }

    // ── Check 2: negative prompt weakened (flux + sdxl) ─────────────
    for (const key of ['flux', 'sdxl'] as const) {
      const neg = outputs[key].negativePrompt ?? ''
      const negFragmentCount = neg.length === 0 ? 0 : neg.split(',').length
      if (avoidanceCount > 0 && negFragmentCount < minNegativeFragments) {
        warnings.push(
          `Section "${s.id}" adapter '${key}' negative prompt weakened — ` +
          `has ${negFragmentCount} fragments vs ${avoidanceCount} source avoidance items. ` +
          `Governance failure.`,
        )
      }
    }

    // ── Check 3: GPT Image missing inline avoidance tail ────────────
    if (avoidanceCount > 0 && !outputs.gptImage.prompt.includes('avoiding')) {
      warnings.push(
        `Section "${s.id}" adapter 'gptImage' missing inline 'avoiding' tail — ` +
        `${avoidanceCount} avoidance fragments lost. Governance failure.`,
      )
    }

    // ── Check 4: bloat — any prompt > 800 chars ─────────────────────
    for (const key of ['gptImage', 'flux', 'sdxl'] as const) {
      const len = outputs[key].prompt.length
      if (len > MAX_PROMPT_CHARS) {
        warnings.push(
          `Section "${s.id}" adapter '${key}' positive prompt ${len} chars ` +
          `(> ${MAX_PROMPT_CHARS}). Renderer truncation risk — tail psychology may be dropped.`,
        )
      }
    }
  }

  return warnings
}
