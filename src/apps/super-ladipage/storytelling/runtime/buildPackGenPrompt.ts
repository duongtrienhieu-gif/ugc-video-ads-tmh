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
import { narratorBrief } from '../config/narratorArchetypes'
import { emotionalDnaBrief } from '../config/personaEmotionalDNA'
import { energyCurveBrief } from '../config/energyCurvePresets'
import {
  snapshotsBrief,
  VISUAL_FIRST_WRITING_PROMPT,
} from '../config/memorySnapshots'
import { hookAxisBrief } from '../config/hookVariation'
import { discoveryChannelBrief } from '../config/discoveryChannels'
import {
  RHYTHM_ENGINE_PROMPT,
  rhythmDirectiveFor,
  sectionRhythmHint,
} from '../config/rhythmEngine'
import { SECTION_PACING_MAP } from '../config/pacingOrchestration'
import { TRUST_REALISM_PROMPT } from '../config/trustRealismLibrary'
import {
  VISUAL_COHERENCE_PROMPT,
  visualCoherenceSummary,
} from '../config/visualStoryCoupling'
import type { NarratorDnaSelection } from './selectNarratorDna'

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

/** Per-section directive block. ~40-55 tokens base, more for special sections.
 *  v5.6 — Compressed static directives (was ~8 lines/section, now ~3-4) to lift
 *  narrator/variation signal-to-noise. Rhythm + tension + density merged onto one line. */
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

  // v5.6 — Energy curve applies delta to baseline tension. 5 presets now meaningfully
  // shift per-section tension targets instead of being prompt flavor.
  const tensionDelta = selection.energyCurve.tensionDeltas[bp.id] ?? 0
  const adjustedTension = Math.max(0, Math.min(10, bp.tensionLevel + tensionDelta))

  // v5.6 — Consolidated meta line: rhythm + tension + density + pacing class.
  const pacingClass = SECTION_PACING_MAP[bp.id]
  const densityNote = bp.imageRequirement.countDefault === 0 ? ' / text-only' : ''
  lines.push(`  META: rhythm=${bp.rhythmProfile} · tension=${adjustedTension}/10 · density=${bp.textDensity}${densityNote} · pacing=${pacingClass}`)

  // v5.6 — Compressed rhythm guidance (was 3 lines: typography + stats + hint).
  const sectionHint = sectionRhythmHint(bp.id)
  lines.push(`  RHYTHM: ${rhythmInstructionFor(bp.rhythmProfile)} | typography: ${rhythmDirectiveFor(pacingClass)}${sectionHint ? ` | ${sectionHint}` : ''}`)

  // v5.5 — Visual coherence (narrator + section).
  lines.push(`  ${visualCoherenceSummary(selection.narrator, bp.id)}`)

  // v5.6 — Compressed dynamics (was 4 lines: role + function + curiosity + transition).
  const dynamics = composeDynamicsDirective(
    bp.narrativeRole, bp.emotionalFunction, bp.curiosityMechanic, bp.transitionPsychology,
  ).split('\n').join(' | ')
  lines.push(`  DYNAMICS: ${dynamics}`)
  lines.push(`  RETENTION: ${retentionInstructionFor(bp.retentionMechanic)} | PACING: ${pacingClassDirective(bp.id)}`)

  // ─── Hook pattern (section 1 only) ─────────────────────────────────
  // v5.6 — Use seed-picked hookPattern (selection.hookPattern), NOT blueprint default.
  //        Removed verbatim hp.examples leak — was causing every pack to start with
  //        "Tôi bắt đầu ghét buổi sáng" because example #1 of 'emotional-rejection'
  //        was injected and Gemini copied it. Description-only now.
  if (bp.id === 'hook-interrupt') {
    const hp = HOOK_PATTERNS[selection.hookPattern]
    lines.push(`  HOOK PATTERN (per-pack): ${selection.hookPattern} — ${hp.description}`)
    lines.push(`  ⛔ KHÔNG dùng câu mẫu cố định. Sinh phrasing mới từ pain + narrator's voice.`)
    lines.push(`  ⛔ NEVER copy: "Tôi bắt đầu ghét buổi sáng" / "Tôi không còn thấy thoải mái khi soi gương" / bất kỳ phrase nào sound generic-template.`)
    for (const line of hookAxisBrief(selection.hookAxis).split('\n')) {
      lines.push(`  ${line}`)
    }
  }

  // ─── Discovery channel (section 6) ─────────────────────────────────
  if (bp.id === 'soft-reveal') {
    for (const line of discoveryChannelBrief(selection.discoveryChannel).split('\n')) {
      lines.push(`  ${line}`)
    }
    // v5.6 — Anti-mechanical structure rule. Was: every pack ended with
    // "Tôi tìm thấy một sản phẩm tên là [X]" mechanical phrasing.
    lines.push(`  ⛔ STRUCTURE BAN: KHÔNG dùng template "tìm thấy/thấy một sản phẩm tên là [X]". `
      + `Product name xuất hiện tự nhiên trong dòng narrator chia sẻ, không phải dòng giới thiệu mechanical.`)
  }

  // ─── 🔥 Belief shift (section 5) ───────────────────────────────────
  // v5.6 — Removed oldBelief/newFrame verbatim text leak (was causing
  //        "cơ thể đang thiếu gì đó để giữ ổn định bên trong" / "nang tóc đang yếu đi"
  //        to be copied word-for-word). Now: structure + niche topic hint only.
  //        Catalyst is seed-picked (single catalyst per pack) instead of "choose 1 of".
  if (bp.id === 'belief-shift') {
    const reframe = getReframeForNiche(input.niche)
    const catalystSpec = BELIEF_SHIFT_CATALYSTS[selection.beliefCatalystType]
    lines.push(`  🔥 BELIEF SHIFT — CONVERSION CORE`)
    lines.push(`  [1] CATALYST (per-pack): ${selection.beliefCatalystType} — ${catalystSpec.description}`)
    lines.push(`      ⛔ KHÔNG dùng catalyst examples nguyên xi. Sinh tình huống mới theo style.`)
    lines.push(`  [2] REFRAME structure: "Có thể vấn đề không phải [old assumption reader holds about niche '${input.niche}'], `
      + `mà là [new actionable frame — body-system-level cause that supplement/care can support]"`)
    lines.push(`      ⛔ KHÔNG quote câu mẫu. KHÔNG copy phrasing "thiếu gì đó để giữ ổn định" / "nang tóc đang yếu đi" / "cơ thể không phục hồi như trước".`)
    lines.push(`      Topic hint: reframe about ${reframe.oldBelief.slice(0, 40)}... → new frame open-door (KHÔNG miracle, KHÔNG promise).`)
    lines.push(`  [3] PERMISSION: internal acceptance to seek solution — sinh từ narrator's contradictions, không dùng template line.`)
    lines.push(`  ⛔ KHÔNG mention product name in this section. Reveal lives in next section.`)
    lines.push(`  ⛔ KHÔNG end with "Câu nói đó cứ ám ảnh tôi" template — that phrase is banned cross-pack.`)
  }

  // v4.3 — Visual plan per section (for text/visual alignment).
  if (bp.imagePurposeRoles && bp.imagePurposeRoles.length > 0) {
    const camera = bp.cameraLanguage?.length ? `, camera=[${bp.cameraLanguage.join(', ')}]` : ''
    lines.push(`  VISUAL: roles=[${bp.imagePurposeRoles.join(', ')}]${camera}`)
  } else if (bp.imageRequirement.countDefault === 0) {
    lines.push(`  VISUAL: text-only`)
  }

  // v4.4 — Micro-realism injection.
  const microRealism = microRealismDirectiveFor(bp.id)
  if (microRealism) {
    lines.push(`  ${microRealism}`)
  }

  // ─── Trust continuity (section 10) — v5.6 cleanup ──────────────────
  // Removed verbatim example "(vd: 'Sau khi share câu chuyện này...')" which
  // caused Pack 02 to output near-identical phrasing.
  if (bp.id === 'trust-continuity') {
    lines.push(`  📋 OUTPUT FORMAT: { id, title, copy, reviews: [{ quote, author?, meta? }, ...] }`)
    lines.push(`  copy: 5-15 từ intro phù hợp tone narrator dẫn vào quotes. Phrasing tự nhiên, KHÔNG dùng câu mẫu.`)
    lines.push(`  reviews: 3 quotes — DIFFERENT voices (ages, relationships, niches details), casual FB-comment vibe`)
    lines.push(`  author: short Vietnamese descriptor ("Chị Lan, 42" / "Hà, 30" / "Một bạn đọc")`)
    lines.push(`  Quotes phải casual imperfect Vietnamese — KHÔNG Shopee/TikTok rating, KHÔNG "5/5 sao", KHÔNG formal testimonial.`)
  }

  // ─── Soft CTA (section 11) ─────────────────────────────────────────
  if (bp.id === 'soft-cta') {
    lines.push(`  💌 ${buildSoftCtaDirective()}`)
    lines.push(`  Length: 60-100 từ. KHÔNG benefit push. KHÔNG urgency.`)
    lines.push(`  Self-test: thay tên product bằng "cuốn sách tôi đọc" — section vẫn make sense → PASS.`)
  }

  return lines.join('\n')
}

/** Compose retry feedback — used when validators fail attempt 1. */
export function buildRetryFeedback(violations: string[]): string {
  if (violations.length === 0) return ''
  return `\n\nPREVIOUS ATTEMPT FAILED. Fix these violations:\n${violations.map((v) => `- ${v}`).join('\n')}\n\nKeep all other rules. Regenerate the entire pack.`
}

/** Top-level user prompt builder. Returns the full prompt body that
 *  goes after the system prompt.
 *
 *  v5.1 — accepts NarratorDnaSelection. Narrator brief + DNA brief +
 *  energy curve brief injected at top of user prompt. */
export function buildPackGenUserPrompt(
  input: StorytellingInput,
  plan: SectionPlan[],
  selection: NarratorDnaSelection,
  retryFeedback?: string,
): string {
  const sections = plan.map((p, i) => buildSectionDirective(p, i, input, selection)).join('\n\n')

  const hookEnforcement = plan[0]?.blueprint.hookPattern ? HOOK_ENFORCEMENT_PROMPT : ''

  // Belief shift directive — inject if plan contains belief-shift section
  const beliefShiftDirective = plan.some((p) => p.blueprint.id === 'belief-shift')
    ? BELIEF_SHIFT_PROMPT
    : ''

  // v4.5 — Soft CTA prompt if plan contains soft-cta section
  const softCtaDirective = plan.some((p) => p.blueprint.id === 'soft-cta')
    ? SOFT_CTA_PROMPT
    : ''

  // v5.1 — Narrator DNA + Energy Curve at TOP of user prompt
  //   Narrator identity drives wording / pacing / shame / lifestyle.
  //   DNA gives niche-specific emotional vocabulary.
  //   Energy curve sets emotional movement style.
  // v5.2 — Memory snapshots library injected after DNA
  const narratorBlock = `═══ NARRATOR (v5.1 — human variation engine) ═══
${narratorBrief(selection.narrator)}

${selection.emotionalDna ? emotionalDnaBrief(selection.emotionalDna) : '(no niche-specific DNA — use generic embodied vocabulary)'}

${energyCurveBrief(selection.energyCurve)}

═══ MEMORY SNAPSHOTS (v5.2 — scene library for this pack) ═══
${snapshotsBrief(selection.memorySnapshots)}

INSTRUCTION:
- Embody this narrator's voice throughout. NOT a generic "tôi".
- Use 1-2 shame patterns + 1-2 contradictions as story moments.
- Surface social-context preferences naturally.
- Weave 2-4 scenes from MEMORY SNAPSHOTS library across sections — vary across packs.
- Sample 2-3 embodied vocabulary items from DNA across sections.
- Energy curve guides emotional movement — don't force, but tendency.`

  return `Generate ${plan.length} sections cho niche "${input.niche}" — emotional intensity ${input.emotionalIntensity}, pacing ${input.pacingType}.

${narratorBlock}

${RETENTION_RESTRAINT_PROMPT}

${hookEnforcement}

${beliefShiftDirective}

${MICRO_REALISM_PROMPT}

${VISUAL_FIRST_WRITING_PROMPT}

${RHYTHM_ENGINE_PROMPT}

${TRUST_REALISM_PROMPT}

${VISUAL_COHERENCE_PROMPT}

${softCtaDirective}

Section directives (in order):

${sections}

CORE REMINDERS (storyselling + v5.1 human variation):
- Embody the NARRATOR ARCHETYPE — voice, wording, shame, contradictions. NOT generic "tôi".
- 1st person voice. NO 3rd person observer ("Cô ấy", "Anh ấy", named character).
- Conversational flowing sentences (12-20 từ avg). NO fragmented chops.
- Specific NAMED pain — concrete embodied vocabulary from DNA. NOT abstract.
- Pull from RECOGNITION not drama. Reader thinks "ờ giống mình" not "writing đẹp".
- NO bio CV intro section 1. NO copywriter templates.
- Section 5 (belief-shift) = CONVERSION CORE — external catalyst + reframe + permission. NO product name.
- Inject 1-2 micro-realism + embodied vocabulary per section. NO cinematic blocking.
- ANTI-BEAUTIFUL: allow slightly awkward phrasing if natural. Don't polish to literary perfection.
  Human voices are imperfect. Reader recognition > prose beauty.
- MICRO-CONTRADICTIONS: surface 1-2 narrator contradictions as story moments.
  Humans are emotionally inconsistent — embody that.
- SOCIAL-CONTEXT: surface narrator's preferred social contexts naturally
  (family-centered uses family scenes; public-self-conscious uses public moments).
- Read-aloud test: nghe như NARRATOR THẬT đang share với bạn thân — NOT generic Vietnamese voice.
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
