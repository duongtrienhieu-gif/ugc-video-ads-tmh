// ═════════════════════════════════════════════════════════════════════
// Storytelling Engine — pack-gen user prompt builder
//
// Compose per-section directives từ config layer. Each section ~50-70
// tokens. Total ~600-700 tokens for 10 sections.
//
// Directives consume v4 dynamics fields:
//   - narrativeRole → 1-line role instruction
//   - emotionalFunction → 1-line function instruction
//   - curiosityMechanic → 1-line device instruction
//   - rhythmProfile → 1-line cadence constraint
//   - transitionPsychology → 1-line hand-off instruction
//   - retentionMechanic → 1-line pull instruction
//   - hookPattern (section 1 only) → enforcement
// ═════════════════════════════════════════════════════════════════════

import type {
  ProtagonistProfile, SectionId, SectionPlan, StorytellingInput,
} from '../types'
import { SECTION_BLUEPRINTS } from '../config/sectionBlueprints'
import {
  composeDynamicsDirective,
} from '../config/narrativeDynamics'
import { HOOK_PATTERNS, HOOK_ENFORCEMENT_PROMPT } from '../config/narrativeHooks'
import { rhythmInstructionFor } from '../config/rhythmVariance'
import { retentionInstructionFor } from '../config/retentionPatterns'
import { RETENTION_RESTRAINT_PROMPT } from '../config/retentionPatterns'

/** Compose protagonist brief — 1-2 lines, used in system prompt context. */
export function buildProtagonistBrief(p: ProtagonistProfile): string {
  const hijab = p.cultural.hijabState === 'always' ? 'hijab always' :
                p.cultural.hijabState === 'never'  ? 'no hijab' : 'hijab sometimes'
  return `${p.gender}, age ${p.ageRange}, ${p.cultural.world}, ${hijab}, ${p.wardrobeWorld} wardrobe, ${p.personalityVibe}, ${p.homeLifestyle.setting} setting, family: ${p.homeLifestyle.familyStructure}`
}

/** Compose product brief — 1 line, name + niche + key trait. */
export function buildProductBrief(productName: string, niche: string, painPoint?: string): string {
  const pain = painPoint ? ` (target: ${painPoint.slice(0, 60)})` : ''
  return `${productName} — ${niche}${pain}`
}

/** Per-section directive block. ~50-70 tokens. */
function buildSectionDirective(plan: SectionPlan, index: number): string {
  const bp = plan.blueprint
  const sectionNum = index + 1

  const lines: string[] = []
  lines.push(`SECTION ${sectionNum} — id="${bp.id}" (${bp.role})`)
  lines.push(`  rhythm: ${bp.rhythmProfile} — ${rhythmInstructionFor(bp.rhythmProfile)}`)

  // 4-line dynamics directive (role/function/curiosity/transition)
  const dynamics = composeDynamicsDirective(
    bp.narrativeRole,
    bp.emotionalFunction,
    bp.curiosityMechanic,
    bp.transitionPsychology,
  )
  for (const line of dynamics.split('\n')) lines.push(`  ${line}`)

  // Retention micro-pull (optional — null for closure)
  lines.push(`  RETENTION: ${retentionInstructionFor(bp.retentionMechanic)}`)

  // Tension target
  lines.push(`  TENSION: ${bp.tensionLevel}/10`)

  // Text density hint
  lines.push(`  DENSITY: ${bp.textDensity}${bp.imageRequirement.countDefault === 0 ? ' (no image — pure text breathing)' : ''}`)

  // Hook pattern enforcement for section 1
  if (bp.hookPattern && sectionNum === 1) {
    const hp = HOOK_PATTERNS[bp.hookPattern]
    lines.push(`  HOOK PATTERN: ${bp.hookPattern} — ${hp.description}`)
    lines.push(`  HOOK EXAMPLES (style only, do not copy): ${hp.examples.slice(0, 2).join(' / ')}`)
  }

  return lines.join('\n')
}

/** Compose retry feedback — used when validators fail attempt 1. */
export function buildRetryFeedback(violations: string[]): string {
  if (violations.length === 0) return ''
  return `\n\nPREVIOUS ATTEMPT FAILED. Fix these violations:\n${violations.map((v) => `- ${v}`).join('\n')}\n\nKeep all other rules. Regenerate the entire pack.`
}

/** Top-level user prompt builder. Returns the full prompt body that
 *  goes after the system prompt. */
export function buildPackGenUserPrompt(
  input: StorytellingInput,
  plan: SectionPlan[],
  retryFeedback?: string,
): string {
  const sections = plan.map((p, i) => buildSectionDirective(p, i)).join('\n\n')

  const hookEnforcement = plan[0]?.blueprint.hookPattern ? HOOK_ENFORCEMENT_PROMPT : ''

  return `Generate ${plan.length} sections cho niche "${input.niche}" — emotional intensity ${input.emotionalIntensity}, pacing ${input.pacingType}.

${RETENTION_RESTRAINT_PROMPT}

${hookEnforcement}

Section directives (in order):

${sections}

REMEMBER:
- adjacent sections PHẢI khác rhythm profile
- KHÔNG ai-essay tone, KHÔNG enumerated structure
- KHÔNG bio intro section 1
- Output JSON only${retryFeedback ?? ''}`
}

/** Section IDs trong plan — for prompt to reference exact IDs in output. */
export function planToSectionIds(plan: SectionPlan[]): SectionId[] {
  return plan.map((p) => p.blueprint.id)
}

/** Approximate token count helper — for logging/safety. */
export function approximateTokenCount(text: string): number {
  // Rough estimate: 1 token ≈ 4 chars for English / Vietnamese mix
  return Math.ceil(text.length / 4)
}

/** Sanity check — load blueprint to verify all 10 sections + dynamics encoded. */
export function logPromptStats(systemPrompt: string, userPrompt: string, plan: SectionPlan[]) {
  const sysTokens = approximateTokenCount(systemPrompt)
  const userTokens = approximateTokenCount(userPrompt)
  console.info(
    `[storytelling/runtime] prompt stats — system ~${sysTokens}t, user ~${userTokens}t, total ~${sysTokens + userTokens}t, sections=${plan.length}`,
  )
  // Verify all sections have blueprints
  for (const p of plan) {
    if (!SECTION_BLUEPRINTS[p.blueprint.id]) {
      console.warn(`[storytelling/runtime] section ${p.blueprint.id} missing blueprint`)
    }
  }
}
