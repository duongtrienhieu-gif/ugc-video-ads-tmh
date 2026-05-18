// ── Prompt Assembler (P15) ──────────────────────────────────────────────────
//
// Takes a CreativeConfig + runtime PromptContext and returns the final
// text prompt the engine sends to the model.
//
// Pipeline:
//   1. For each block in config.promptBlocks, resolve text (call fn if
//      block.text is a function — pass it the PromptContext)
//   2. Sort blocks by ASSEMBLE_ORDER stable order
//   3. Drop empty results (block builder returned '')
//   4. Join with double-newline separator
//
// Output: a single multi-section prompt the dispatcher passes to KIE
// (or whichever model the config.model declares).

import type { CreativeConfig, PromptContext, PromptBlock } from '../../types/creativeDNA'
import { ASSEMBLE_ORDER } from '../../types/creativeDNA'
import { assembleDnaDirective } from './dnaDirective'

export interface AssembleResult {
  prompt: string
  /** Diagnostic — which blocks contributed text. */
  blocksUsed: string[]
}

export function assemblePrompt(
  config: CreativeConfig,
  ctx: PromptContext,
): AssembleResult {
  // P28 — auto-prepend a Creative DNA directive when the DNA declares
  // any Phase 4 rule arrays (layoutRules / contentRules / visualRules
  // / qualityRules / failureModes / emotionalGoal / typographyStyle /
  // platformBehavior). Legacy configs without these declared get no
  // DNA block — back-compat preserved. Engines no longer need to wire
  // BLOCKS.dnaRules() manually in each config.
  const blocks: PromptBlock[] = [...config.promptBlocks]
  const dnaText = assembleDnaDirective(config.dna)
  if (dnaText) {
    blocks.unshift({ kind: 'dnaRules', text: dnaText })
  }

  // Resolve each block's text
  const resolved: { block: PromptBlock; text: string }[] = []
  for (const block of blocks) {
    const text = typeof block.text === 'function' ? block.text(ctx) : block.text
    if (text && text.trim().length > 0) {
      resolved.push({ block, text: text.trim() })
    }
  }

  // Sort by ASSEMBLE_ORDER (blocks of unknown kind go last in original order)
  const orderIndex = new Map(ASSEMBLE_ORDER.map((k, i) => [k, i]))
  resolved.sort((a, b) => {
    const ai = orderIndex.get(a.block.kind) ?? 999
    const bi = orderIndex.get(b.block.kind) ?? 999
    return ai - bi
  })

  // Join sections
  const prompt = resolved.map((r) => r.text).join('\n\n')
  const blocksUsed = resolved.map((r) => r.block.kind)

  return { prompt, blocksUsed }
}
