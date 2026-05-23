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
import {
  BELIEF_SHIFT_PROMPT,
  BELIEF_SHIFT_CATALYSTS,
  getReframeForNiche,
} from '../config/beliefShiftEngine'
import {
  MICRO_REALISM_PROMPT,
  microRealismDirectiveFor,
} from '../config/microRealismHooks'
import {
  SOFT_CTA_PROMPT,
  buildSoftCtaDirective,
} from '../config/softCtaPatterns'
import {
  pacingClassDirective,
} from '../config/pacingOrchestration'

// Note: imagePurposeRoleInstruction / cameraLanguageInstruction /
// NECESSITY_TEST_PROMPT / CAMERA_ANTI_DRIFT_PROMPT are used by Phase 4
// image gen pipeline (not text gen). Imported via barrel by image gen.
// In text-gen we inject 1-line VISUAL PLAN per section only.

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

/** Per-section directive block. ~50-70 tokens, more for special sections. */
function buildSectionDirective(
  plan: SectionPlan,
  index: number,
  input: StorytellingInput,
): string {
  const bp = plan.blueprint
  const sectionNum = index + 1

  const lines: string[] = []
  lines.push(`SECTION ${sectionNum} — id="${bp.id}" (${bp.role})`)
  // v4.6 — Pacing class (cross-pack rhythm orchestration)
  lines.push(`  ${pacingClassDirective(bp.id)}`)
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

  // Hook pattern enforcement for section 1 (hook-interrupt)
  if (bp.hookPattern && bp.id === 'hook-interrupt') {
    const hp = HOOK_PATTERNS[bp.hookPattern]
    lines.push(`  HOOK PATTERN: ${bp.hookPattern} — ${hp.description}`)
    lines.push(`  HOOK EXAMPLES (style only, do not copy): ${hp.examples.slice(0, 2).join(' / ')}`)
  }

  // 🔥 v4.2 — Belief shift specific directive for section 5
  if (bp.id === 'belief-shift') {
    const reframe = getReframeForNiche(input.niche)
    const catalystKeys = Object.keys(BELIEF_SHIFT_CATALYSTS) as Array<keyof typeof BELIEF_SHIFT_CATALYSTS>
    lines.push(`  🔥 BELIEF SHIFT — CONVERSION CORE for this section`)
    lines.push(`  STRUCTURE: [1] external catalyst (CHOOSE 1 of: ${catalystKeys.join(' / ')}) → [2] reframe → [3] permission`)
    lines.push(`  REFRAME REFERENCE for niche "${input.niche}":`)
    lines.push(`    OLD BELIEF (reader carries): ${reframe.oldBelief}`)
    lines.push(`    NEW FRAME (open door): ${reframe.newFrame}`)
    lines.push(`  PRODUCT NAME: KHÔNG mention in this section. Save for next section (soft-reveal).`)
  }

  // v4.3 — Visual plan per section (for text/visual alignment)
  if (bp.imagePurposeRoles && bp.imagePurposeRoles.length > 0) {
    const camera = bp.cameraLanguage?.length ? `, camera=[${bp.cameraLanguage.join(', ')}]` : ''
    lines.push(`  VISUAL PLAN: roles=[${bp.imagePurposeRoles.join(', ')}]${camera}`)
  } else if (bp.imageRequirement.countDefault === 0) {
    lines.push(`  VISUAL PLAN: text-only — no image generation for this section`)
  }

  // v4.4 — Micro-realism injection (embodied lived moments)
  const microRealism = microRealismDirectiveFor(bp.id)
  if (microRealism) {
    lines.push(`  ${microRealism}`)
  }

  // v4.5 — Trust continuity special output format (section 10)
  if (bp.id === 'trust-continuity') {
    lines.push(`  📋 OUTPUT FORMAT (trust-continuity): instead of long copy, output ALSO a "reviews" array of 3 mini quotes.`)
    lines.push(`  Section JSON shape: { id: "trust-continuity", title: "...", copy: "[short intro line]", reviews: [{ quote, author?, meta? }, ...] }`)
    lines.push(`  copy: 1 ngắn intro line dẫn vào quotes (vd: "Sau khi share câu chuyện này, có vài bạn nhắn lại...")`)
    lines.push(`  reviews: 3 quotes DIFFERENT voices (different ages/relationships), casual FB-comment vibe`)
    lines.push(`  author: short Vietnamese descriptor ("Chị Lan, 42" / "Hà, 30" / "Một bạn đọc")`)
    lines.push(`  Quotes phải DIVERSE — different niches details, different lengths, casual imperfect Vietnamese`)
    lines.push(`  KHÔNG: Shopee/TikTok screenshot vibe, star ratings, "5/5 sao", formal testimonial language`)
  }

  // v4.5 — Soft CTA specific directive (section 11)
  if (bp.id === 'soft-cta') {
    lines.push(`  💌 ${buildSoftCtaDirective()}`)
    lines.push(`  Length: 60-100 từ. KHÔNG benefit push. KHÔNG urgency.`)
    lines.push(`  Self-test: thay tên product bằng "cuốn sách tôi đọc" — section vẫn make sense → PASS. Nếu fail → too salesy.`)
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
  const sections = plan.map((p, i) => buildSectionDirective(p, i, input)).join('\n\n')

  const hookEnforcement = plan[0]?.blueprint.hookPattern ? HOOK_ENFORCEMENT_PROMPT : ''

  // Belief shift directive — inject if plan contains belief-shift section
  const beliefShiftDirective = plan.some((p) => p.blueprint.id === 'belief-shift')
    ? BELIEF_SHIFT_PROMPT
    : ''

  // v4.5 — Soft CTA prompt if plan contains soft-cta section
  const softCtaDirective = plan.some((p) => p.blueprint.id === 'soft-cta')
    ? SOFT_CTA_PROMPT
    : ''

  return `Generate ${plan.length} sections cho niche "${input.niche}" — emotional intensity ${input.emotionalIntensity}, pacing ${input.pacingType}.

${RETENTION_RESTRAINT_PROMPT}

${hookEnforcement}

${beliefShiftDirective}

${MICRO_REALISM_PROMPT}

${softCtaDirective}

Section directives (in order):

${sections}

CORE REMINDERS (storyselling):
- 1st person "tôi" voice. NO 3rd person observer ("Cô ấy", "Anh ấy", named character).
- Conversational flowing sentences (12-20 từ avg). NO fragmented chops ("Mệt. Rất mệt.").
- Specific named pain — concrete symptoms reader recognizes.
- Pull from RECOGNITION not drama. Reader thinks "ờ giống mình" not "writing đẹp".
- NO bio CV intro section 1. NO copywriter templates ("Bạn xứng đáng...").
- Section 5 (belief-shift) = CONVERSION CORE — external catalyst + reframe + permission. NO product name.
- Inject 1-2 micro-realism details per section from assigned category — embodied lived moments, NOT cinematic blocking.
- Read-aloud test: nghe như người Việt thật share với bạn thân.
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
