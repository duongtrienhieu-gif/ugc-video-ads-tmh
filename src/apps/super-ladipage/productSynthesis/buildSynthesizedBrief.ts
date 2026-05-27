// ─────────────────────────────────────────────────────────────────────
// Product Synthesis — buildSynthesizedBrief (POSITIVE injection block)
//
// Converts SynthesizedProductBrief → Vietnamese prompt block for
// storytelling Gemini. Replaces thin niche-pool injection. PRIMARY
// context for content accuracy.
// ─────────────────────────────────────────────────────────────────────

import type { SynthesizedProductBrief } from './types'

export function buildSynthesizedBrief(brief: SynthesizedProductBrief): string {
  if (brief.source === 'fallback' || !brief.productEssence) {
    return ''
  }

  const lines: string[] = [
    `═══ PRODUCT ESSENCE (PRIMARY CONTEXT — không drift sang sub-niche khác) ═══`,
    ``,
    `── What this product actually IS ──`,
    brief.productEssence,
    ``,
  ]

  if (brief.readerSpecificSymptoms.length > 0) {
    lines.push(
      `── Reader-specific symptoms (recognition phase MUST use 2-3 of these — NOT others) ──`,
      ...brief.readerSpecificSymptoms.map((s) => `  ✓ ${s}`),
      ``,
    )
  }

  if (brief.forbiddenDriftSymptoms.length > 0) {
    lines.push(
      `── ⛔ FORBIDDEN drift symptoms (these belong to OTHER products — NEVER use) ──`,
      ...brief.forbiddenDriftSymptoms.map((s) => `  ✗ ${s}`),
      ``,
    )
  }

  if (brief.usageScene) {
    lines.push(`── Realistic usage scene ──`, brief.usageScene, ``)
  }

  if (brief.discoveryRealistic) {
    lines.push(
      `── Realistic discovery (Phase 3 "natural-product-discovery" block MUST use this scene) ──`,
      brief.discoveryRealistic,
      ``,
    )
  }

  if (brief.realisticFailedAttempts.length > 0) {
    lines.push(
      `── Realistic failed attempts (Phase 2 "shared-failed-attempts" MUST use 2-3 of these — NOT generic) ──`,
      ...brief.realisticFailedAttempts.map((a) => `  • ${a}`),
      ``,
    )
  }

  lines.push(
    `═══════════════════════════════════════════════════════════════`,
    ``,
    `^^^ Reader của THIS product nhận diện qua symptoms cụ thể TRÊN — không phải symptoms generic của niche.`,
    `KHÔNG được drift sang forbiddenDriftSymptoms — đó là sản phẩm KHÁC.`,
  )

  return lines.join('\n')
}
