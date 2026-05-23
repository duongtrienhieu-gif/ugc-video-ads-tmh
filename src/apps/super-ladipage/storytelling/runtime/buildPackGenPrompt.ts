// ═════════════════════════════════════════════════════════════════════
// Storytelling Engine — pack-gen user prompt builder
//
// v5.7 architecture shift (per user feedback after first real test):
//   KEEP CORE SYSTEM SMALL. Per-pack diversity lives in SAMPLING OBJECTS
//   (narrator / hookAxis / memorySnapshot / reviewStyle / energyCurve /
//   discoveryChannel), NOT in giant prompt rules.
//
// Dropped from top-level (were duplicating per-section directives):
//   - HOOK_ENFORCEMENT_PROMPT      → covered by section 1 directive
//   - BELIEF_SHIFT_PROMPT          → covered by section 5 directive
//   - SOFT_CTA_PROMPT              → covered by section 11 directive
//   - RHYTHM_ENGINE_PROMPT         → covered by per-section RHYTHM line
//   - RETENTION_RESTRAINT_PROMPT   → covered by ENGINE_CORE_PHILOSOPHY
//   - MICRO_REALISM_PROMPT         → covered by ENGINE_CORE_PHILOSOPHY + per-section micro-realism
//   - VISUAL_FIRST_WRITING_PROMPT  → covered by ENGINE_CORE_PHILOSOPHY
//   - VISUAL_COHERENCE_PROMPT      → was Phase 4 image gen; not needed for text gen
//
// Also dropped: v5.6 "⛔ KHÔNG copy ..." anti-template bans (hook + belief +
// soft-reveal). Structural fix (per-pack hookPattern / beliefCatalystType
// sampling + structure-only reframe) handles the leak — anti-rules were
// belt-and-suspenders that contributed to prompt entropy.
// ═════════════════════════════════════════════════════════════════════

import type {
  ProtagonistProfile, SectionId, SectionPlan, StorytellingInput,
} from '../types'
import { SECTION_BLUEPRINTS } from '../config/sectionBlueprints'
import { composeDynamicsDirective } from '../config/narrativeDynamics'
import { HOOK_PATTERNS } from '../config/narrativeHooks'
import { rhythmInstructionFor } from '../config/rhythmVariance'
import { retentionInstructionFor } from '../config/retentionPatterns'
import {
  BELIEF_SHIFT_CATALYSTS,
  getReframeForNiche,
} from '../config/beliefShiftEngine'
import { microRealismDirectiveFor } from '../config/microRealismHooks'
import { buildSoftCtaDirective } from '../config/softCtaPatterns'
import {
  pacingClassDirective,
  SECTION_PACING_MAP,
} from '../config/pacingOrchestration'
import { narratorBrief } from '../config/narratorArchetypes'
import { emotionalDnaBrief } from '../config/personaEmotionalDNA'
import { energyCurveBrief } from '../config/energyCurvePresets'
import { snapshotsBrief } from '../config/memorySnapshots'
import { hookAxisBrief } from '../config/hookVariation'
import { discoveryChannelBrief } from '../config/discoveryChannels'
import {
  rhythmDirectiveFor,
  sectionRhythmHint,
} from '../config/rhythmEngine'
import { buildReviewBlockDirective } from '../config/reviewStyleProfiles'
import { visualCoherenceSummary } from '../config/visualStoryCoupling'
import { ENGINE_CORE_PHILOSOPHY } from '../config/enginePhilosophy'
import type { NarratorDnaSelection } from './selectNarratorDna'

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

/** Per-section directive block. ~30-45 tokens base, more for special sections.
 *  v5.7 — Further compression after Phase A audit. Removed v5.6 anti-template
 *  bans (sampling architecture handles diversity now). Merged dynamics +
 *  retention + pacing onto 1 line. */
function buildSectionDirective(
  plan: SectionPlan,
  index: number,
  input: StorytellingInput,
  selection: NarratorDnaSelection,
): string {
  const bp = plan.blueprint
  const sectionNum = index + 1

  const lines: string[] = []
  lines.push(`SECTION ${sectionNum} — id="${bp.id}" (${bp.role})`)

  // Energy curve applies delta to baseline tension.
  const tensionDelta = selection.energyCurve.tensionDeltas[bp.id] ?? 0
  const adjustedTension = Math.max(0, Math.min(10, bp.tensionLevel + tensionDelta))

  // META: rhythm + tension + density + pacing class on one line.
  const pacingClass = SECTION_PACING_MAP[bp.id]
  const densityNote = bp.imageRequirement.countDefault === 0 ? ' / text-only' : ''
  lines.push(`  META: rhythm=${bp.rhythmProfile} · tension=${adjustedTension}/10 · density=${bp.textDensity}${densityNote} · pacing=${pacingClass}`)

  // RHYTHM (compressed: instruction + typography + section hint on one line).
  const sectionHint = sectionRhythmHint(bp.id)
  lines.push(`  RHYTHM: ${rhythmInstructionFor(bp.rhythmProfile)} | ${rhythmDirectiveFor(pacingClass)}${sectionHint ? ` | ${sectionHint}` : ''}`)

  // Visual coherence (narrator + section).
  lines.push(`  ${visualCoherenceSummary(selection.narrator, bp.id)}`)

  // v5.7 — DYNAMICS + RETENTION + PACING merged onto 1-2 lines.
  const dynamics = composeDynamicsDirective(
    bp.narrativeRole, bp.emotionalFunction, bp.curiosityMechanic, bp.transitionPsychology,
  ).split('\n').join(' | ')
  lines.push(`  DYNAMICS: ${dynamics}`)
  lines.push(`  PULL: ${retentionInstructionFor(bp.retentionMechanic)} · ${pacingClassDirective(bp.id)}`)

  // ─── Hook pattern (section 1 only) ─────────────────────────────────
  // v5.7 — Dropped v5.6 anti-template ban lines. Per-pack hookPattern sampling
  // (1 of 6 via seed) + hookAxis (1 of 10) = 60 combos → structural diversity.
  if (bp.id === 'hook-interrupt') {
    const hp = HOOK_PATTERNS[selection.hookPattern]
    lines.push(`  HOOK PATTERN: ${selection.hookPattern} — ${hp.description}`)
    lines.push(`  Sinh phrasing mới từ pain + narrator voice. Description-driven, KHÔNG dùng câu mẫu.`)
    for (const line of hookAxisBrief(selection.hookAxis).split('\n')) {
      lines.push(`  ${line}`)
    }
  }

  // ─── Discovery channel (section 6) ─────────────────────────────────
  if (bp.id === 'soft-reveal') {
    for (const line of discoveryChannelBrief(selection.discoveryChannel).split('\n')) {
      lines.push(`  ${line}`)
    }
    // Note: structural ban "tìm thấy một sản phẩm tên là X" dropped — relies on
    // discovery channel diversity + narrator voice for natural product mention.
  }

  // ─── 🔥 Belief shift (section 5) ───────────────────────────────────
  // v5.7 — Structure + topic hint only. Reframe text NEVER pasted verbatim.
  if (bp.id === 'belief-shift') {
    const reframe = getReframeForNiche(input.niche)
    const catalystSpec = BELIEF_SHIFT_CATALYSTS[selection.beliefCatalystType]
    lines.push(`  🔥 BELIEF SHIFT — CONVERSION CORE`)
    lines.push(`  [1] CATALYST: ${selection.beliefCatalystType} — ${catalystSpec.description}`)
    lines.push(`  [2] REFRAME structure: "Có thể vấn đề không phải [old assumption about niche '${input.niche}'], `
      + `mà là [new actionable frame — body-system-level cause that supplement/care can support]"`)
    lines.push(`      Topic hint (DO NOT QUOTE): reframe around "${reframe.oldBelief.slice(0, 40)}..."`)
    lines.push(`  [3] PERMISSION: internal acceptance to seek solution — sinh từ narrator's contradictions.`)
    lines.push(`  KHÔNG mention product name. Reveal lives in section 6.`)
  }

  // Visual plan (Phase 4 image gen alignment).
  if (bp.imagePurposeRoles && bp.imagePurposeRoles.length > 0) {
    const camera = bp.cameraLanguage?.length ? `, camera=[${bp.cameraLanguage.join(', ')}]` : ''
    lines.push(`  VISUAL: roles=[${bp.imagePurposeRoles.join(', ')}]${camera}`)
  } else if (bp.imageRequirement.countDefault === 0) {
    lines.push(`  VISUAL: text-only`)
  }

  // Micro-realism injection.
  const microRealism = microRealismDirectiveFor(bp.id)
  if (microRealism) {
    lines.push(`  ${microRealism}`)
  }

  // ─── Trust continuity (section 10) ─────────────────────────────────
  // v5.7 Phase B — Inject 3 concrete reviewStyleProfile objects (per slot)
  // instead of abstract "casual FB-comment" rules. Each review slot gets
  // platform/age/energy/grammar/punctuation/typo/completeness as concrete data.
  if (bp.id === 'trust-continuity') {
    const reviewBlock = buildReviewBlockDirective(selection.reviewStyles)
    for (const line of reviewBlock.split('\n')) {
      lines.push(`  ${line}`)
    }
    lines.push(`  copy: 5-15 từ intro phù hợp tone narrator dẫn vào quotes. Tự nhiên.`)
  }

  // ─── Soft CTA (section 11) ─────────────────────────────────────────
  if (bp.id === 'soft-cta') {
    lines.push(`  💌 ${buildSoftCtaDirective()}`)
    lines.push(`  Length: 60-100 từ. KHÔNG benefit push. KHÔNG urgency.`)
    lines.push(`  Self-test: thay product bằng "cuốn sách tôi đọc" — vẫn make sense → PASS.`)
  }

  return lines.join('\n')
}

/** Compose retry feedback — used when validators fail attempt 1. */
export function buildRetryFeedback(violations: string[]): string {
  if (violations.length === 0) return ''
  return `\n\nPREVIOUS ATTEMPT FAILED. Fix these violations:\n${violations.map((v) => `- ${v}`).join('\n')}\n\nKeep all other rules. Regenerate the entire pack.`
}

/** Top-level user prompt builder.
 *
 *  v5.7 architecture: small core philosophy (~30 lines) + narrator/sampling
 *  brief at top + per-section directives + brief reminders at bottom.
 *  Total target: ~3000-4000 tokens (down from ~5000-6000 in v5.6). */
export function buildPackGenUserPrompt(
  input: StorytellingInput,
  plan: SectionPlan[],
  selection: NarratorDnaSelection,
  retryFeedback?: string,
): string {
  const sections = plan.map((p, i) => buildSectionDirective(p, i, input, selection)).join('\n\n')

  // Narrator block — drives voice. Diversity engine output lives here.
  const narratorBlock = `═══ NARRATOR (per-pack DNA) ═══
${narratorBrief(selection.narrator)}

${selection.emotionalDna ? emotionalDnaBrief(selection.emotionalDna) : '(no niche-specific DNA — use generic embodied vocabulary)'}

${energyCurveBrief(selection.energyCurve)}

═══ MEMORY SNAPSHOTS (scene library) ═══
${snapshotsBrief(selection.memorySnapshots)}

NARRATOR USAGE:
- Embody this narrator's voice throughout. NOT generic "tôi".
- Use 1-2 shame patterns + 1-2 contradictions as story moments.
- Weave 2-4 scenes from MEMORY SNAPSHOTS library across sections.
- Energy curve guides emotional movement — tendency, not force.`

  return `Generate ${plan.length} sections cho niche "${input.niche}" — emotional intensity ${input.emotionalIntensity}, pacing ${input.pacingType}.

${ENGINE_CORE_PHILOSOPHY}

${narratorBlock}

Section directives (in order):

${sections}

CLOSING REMINDERS:
- Embody the NARRATOR ARCHETYPE — not generic "tôi". Voice, wording, shame, contradictions.
- 1st person only. No 3rd-person observer mode.
- Section 5 (belief-shift) = CONVERSION CORE — no product name in this section.
- Section 10 reviews must feel like real DMs/comments — different voices, casual, imperfect.
- Allow awkward phrasing if natural — reader recognition > polished prose.
- Output JSON only.${retryFeedback ?? ''}`
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
