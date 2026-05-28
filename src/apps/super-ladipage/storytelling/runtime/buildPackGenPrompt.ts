// ═════════════════════════════════════════════════════════════════════
// Storytelling Engine — pack-gen user prompt builder (Reader-Immersion)
//
// Iterates BlockPlan, builds per-block directives driven by:
//   - phase                  → which conversion phase
//   - psychologicalFunction  → what this block does to reader's mind
//   - youIBalance            → reader-heavy / narrator-validation / future-reader
//   - intent                 → 1-line psychological purpose
//   - paragraphTarget        → soft pacing target
//   - samplingHooks          → which sampling objects to inject
//
// Each block is a PSYCHOLOGICAL TRANSITION carried by the reader, NOT a
// story scene carried by the narrator. Per-block directive injects ONLY
// what that block's samplingHooks call for — keeps prompt mass small.
// ═════════════════════════════════════════════════════════════════════

import type {
  BlockPlan, ProtagonistProfile, StorytellingInput, YouIBalance,
} from '../types'
import { isProofBlock } from '../config/blockPool'
import {
  BELIEF_SHIFT_CATALYSTS,
  getReframeForNiche,
} from '../config/beliefShiftEngine'
import { buildSoftCtaDirective } from '../config/softCtaPatterns'
import { narratorBrief } from '../config/narratorArchetypes'
import { emotionalDnaBrief } from '../config/personaEmotionalDNA'
import { energyCurveBrief } from '../config/energyCurvePresets'
import { snapshotsBrief } from '../config/memorySnapshots'
import { discoveryChannelBrief } from '../config/discoveryChannels'
import { ENGINE_CORE_PHILOSOPHY } from '../config/enginePhilosophy'
import {
  payoffArchetypeBrief, payoffSectionFlavor,
} from '../config/payoffArchetypes'
import {
  performanceHookSection1Directive,
  HOOK_PATTERNS,
} from '../config/performanceHookLayer'
import { sampleMirrorBeat, readerMirrorBeatDirective } from '../config/readerMirrorMoments'
import { nicheDomainLockBrief } from '../config/nicheDomainLock'
import { nicheMechanismBrief } from '../config/nicheMechanismVocab'
import { nicheDesireBrief } from '../config/nicheDesireArchitecture'
import { memoryAnchorBrief } from '../config/commercialMemoryAnchors'
import { dissolutionBrief } from '../config/productDissolutionPatterns'
import { softCompareBrief } from '../config/softComparePatterns'
import { buildCtaMomentsBrief } from '../../cta'
import type { NarratorDnaSelection } from './selectNarratorDna'
// Sprint 5 — E2 + E3 (2026-05-28): pull brainstorm into block directives
// so Phase 1-2 blocks can pin specific agitate beats + failed-attempts
// block gets explicit "concrete cost per attempt" rule.
import type { PackBrainstorm } from '../../packBrainstorm'

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

/** 1-line directive cụ thể hóa YOU/I balance cho block. */
function balanceFramingDirective(balance: YouIBalance): string {
  switch (balance) {
    case 'reader-heavy':
      return 'PHẢI: YOU dominant. Narrator absent or implicit. Reader\'s emotions = block\'s center. Mở/đóng KHÔNG bằng "Tôi/Mình".'
    case 'narrator-validation':
      return 'PHẢI: narrator validates (joins reader\'s spot, NOT spotlights self). Reader still emotional center. "Tôi cũng từng X" tone, không monologue.'
    case 'future-reader':
      return 'PHẢI: YOU projected forward. Narrator recedes. Reader imagines own self-care, own future-self moment.'
  }
}

/** Sprint 5 — E3 (2026-05-28). Map Phase 1-2 block id → which agitate beat
 *  it should execute. Order matches the natural flow:
 *    daily-micro-friction  → beat 1 (stack daily symptoms)
 *    hidden-emotional-truth → beat 2 (name the hidden feeling)
 *    not-alone-bridge       → beat 3 (reduce isolation via shared)
 *  Falls through to "first available beat" if a block doesn't have a
 *  specific assignment. */
const PHASE12_BEAT_ASSIGNMENT: Record<string, number> = {
  'daily-micro-friction':   0,
  'hidden-emotional-truth': 1,
  'not-alone-bridge':       2,
}

/** Per-block directive block. Lean — only what this block's
 *  psychologicalFunction + samplingHooks call for. */
function buildBlockDirective(
  plan: BlockPlan,
  input: StorytellingInput,
  selection: NarratorDnaSelection,
  /** Sprint 5 — E2/E3 (2026-05-28). Optional brainstorm for per-block
   *  beat assignment + concrete-cost rule on failed-attempts. */
  brainstorm?: PackBrainstorm,
): string {
  const block = plan.blueprint

  const lines: string[] = []
  lines.push(`BLOCK ${plan.order} — id="${block.id}" (phase=${block.phase})`)
  lines.push(`  PSYCHOLOGICAL FUNCTION: ${block.psychologicalFunction}`)
  lines.push(`  INTENT: ${block.intent}`)
  lines.push(`  YOU/I BALANCE: ${block.youIBalance}`)
  lines.push(`  ${balanceFramingDirective(block.youIBalance)}`)
  lines.push(`  PARAGRAPHS: ${block.paragraphTarget.min}-${block.paragraphTarget.max}`)

  // ─── Sprint 5 — E3: pin specific agitate beat to Phase 1-2 blocks ──
  // The brainstorm produces 3-5 agitate beats. Previously these were
  // listed in the brief but no individual block was told WHICH beat
  // belongs to it — Gemini sampled all beats per block → blurred
  // content + duplicateContent across Phase 1-2 blocks. Now each block
  // gets ONE assigned beat to execute.
  if (brainstorm && block.id in PHASE12_BEAT_ASSIGNMENT) {
    const beatIndex = PHASE12_BEAT_ASSIGNMENT[block.id]
    const beat = brainstorm.agitateBeats[beatIndex] ?? brainstorm.agitateBeats[0]
    if (beat) {
      lines.push(`  🎯 ASSIGNED AGITATE BEAT — execute THIS beat in THIS block:`)
      lines.push(`     "${beat}"`)
      lines.push(`  HARD RULE: this block must CENTER on the beat above. Do not blur to other Phase 1-2 beats — each beat belongs to its own block.`)
      lines.push(`  Each detail in this block should serve THIS beat. Use concrete sensory cue / number / micro-moment, not vague abstraction.`)
    }
  }

  // ─── Phase 1 Block 1 — Performance Hook Layer ────────────────────
  if (block.samplingHooks.performanceHookLayer) {
    for (const line of performanceHookSection1Directive(
      selection.youFirstOpener, selection.bridgePhrase,
    ).split('\n')) {
      lines.push(`  ${line}`)
    }
    // hookPattern + hookAxis as additional emotional flavor (sampled per pack)
    const hp = HOOK_PATTERNS[selection.hookPattern]
    lines.push(`  EMOTIONAL FLAVOR: hookPattern=${selection.hookPattern} (${hp.description.slice(0, 60)}) | hookAxis=${selection.hookAxis}`)
  }

  // ─── Reader mirror beat (any block where samplingHooks.readerMirrorBeat) ──
  if (block.samplingHooks.readerMirrorBeat) {
    const beat = sampleMirrorBeat(selection.seed, block.id)
    if (beat) {
      for (const line of readerMirrorBeatDirective(beat).split('\n')) {
        lines.push(`  ${line}`)
      }
    }
  }

  // ─── Discovery channel (natural-product-discovery block) ─────────
  if (block.samplingHooks.discoveryChannel) {
    for (const line of discoveryChannelBrief(selection.discoveryChannel).split('\n')) {
      lines.push(`  ${line}`)
    }
  }

  // ─── D: Product dissolution (Block 9 ONLY) ──────────────────────
  if (block.samplingHooks.productDissolution) {
    for (const line of dissolutionBrief(selection.dissolutionPattern).split('\n')) {
      lines.push(`  ${line}`)
    }
  }

  // ─── D: Soft compare (Block 11 ONLY, when included) ─────────────
  if (block.samplingHooks.softCompare) {
    for (const line of softCompareBrief(selection.comparePattern).split('\n')) {
      lines.push(`  ${line}`)
    }
  }

  // ─── Belief shift (belief-shift block) ────────────────────────────
  if (block.samplingHooks.beliefCatalyst) {
    const reframe = getReframeForNiche(input.niche)
    const catalystSpec = BELIEF_SHIFT_CATALYSTS[selection.beliefCatalystType]
    lines.push(`  🔥 BELIEF SHIFT — CONVERSION CORE`)
    lines.push(`  [1] CATALYST: ${selection.beliefCatalystType} — ${catalystSpec.description}`)
    lines.push(`  [2] REFRAME structure: "Có thể vấn đề không phải [old assumption about niche '${input.niche}'], `
      + `mà là [new actionable frame — body-system-level cause that supplement/care can support]"`)
    lines.push(`      Topic hint (DO NOT QUOTE): reframe around "${reframe.oldBelief.slice(0, 40)}..."`)
    lines.push(`  [3] PERMISSION: internal acceptance to seek solution.`)
    lines.push(`  KHÔNG mention product name. Reveal lives in Phase-3 natural-product-discovery block.`)
  }

  // ─── Payoff archetype flavor (Phase-4 blocks with payoffArchetype hook) ─
  if (block.samplingHooks.payoffArchetype) {
    if (block.id === 'micro-transformation' || block.id === 'emotional-wins' || block.id === 'future-self-cta') {
      for (const line of payoffSectionFlavor(selection.payoffArchetype, block.id).split('\n')) {
        lines.push(`  ${line}`)
      }
    }
  }

  // ─── Sprint 5 — E2 (2026-05-28): concrete cost rule for failed-attempts ──
  // Without this, Gemini wrote vague lists like "thử nhiều loại siro ho.. dùng
  // viên ngậm.." — zero specificity, reader doesn't feel the pain of wasted
  // money/time. Real DR voice anchors failed attempts with concrete cost
  // signals. This rule forces Gemini to add a cost dimension to each item.
  if (block.id === 'shared-failed-attempts') {
    lines.push(`  💸 CONCRETE COST RULE (Sprint 5 — E2):`)
    lines.push(`  HARD RULE: Each failed attempt MUST include a CONCRETE COST signal in at least ONE of these dimensions:`)
    lines.push(`    1. MONEY — specific amount, real or plausibly invented`)
    lines.push(`         e.g. "4 thang nước thuốc Bắc × 80 RM = 320 RM"`)
    lines.push(`         e.g. "máy xịt 180 RM, dùng 2 tháng đã hỏng"`)
    lines.push(`         e.g. "3 hộp viên uống × 65 RM"`)
    lines.push(`    2. TIME WASTED — specific duration the attempt was tried`)
    lines.push(`         e.g. "uống đều 3 tháng, không kết quả"`)
    lines.push(`         e.g. "kiên trì xông hơi 6 tuần"`)
    lines.push(`    3. BRAND / METHOD NAME — concrete reference (real local product or method)`)
    lines.push(`         e.g. "siro Bisolvon — vị ngọt, không hiệu quả"`)
    lines.push(`         e.g. "miếng dán Trung Quốc trên Shopee 35 RM"`)
    lines.push(`  ✅ Total inventory: 3-5 attempts. Each one MUST have at least 1 cost dimension above.`)
    lines.push(`  ⛔ FORBIDDEN openers / phrasings for this block:`)
    lines.push(`     - "Tôi đã thử đủ mọi cách" (no specifics following)`)
    lines.push(`     - "Thử nhiều loại / Dùng viên ngậm hoặc..." (no brand, no number)`)
    lines.push(`     - Bullet-only lists without one micro-detail per item`)
    lines.push(`  ✅ Optional close: a 1-line total cost summary, e.g. "Cộng lại, hơn 900 RM ném vào những thứ không giải quyết gốc rễ."`)
  }

  // (P2: proof blocks reviewSlot handled separately — not generated by main pass,
  //  content interleaved post-generation from proof Gemini call.)

  // ─── D: Block 10 — 3-BEAT STRUCTURE (emotion → curiosity → understanding) ──
  if (block.id === 'why-this-felt-different') {
    lines.push(`  📐 BLOCK 10 — 3-BEAT SEQUENCE (locked, ordered):`)
    lines.push(``)
    lines.push(`  [BEAT 1] EMOTION FIRST — start with FELT difference`)
    lines.push(`    "Cảm giác/cái khác là [felt change reader can recognize]"`)
    lines.push(`    KHÔNG mở bằng mechanism. KHÔNG ingredient. KHÔNG "Sản phẩm...".`)
    lines.push(``)
    lines.push(`  [BEAT 2] CURIOSITY SECOND — surface "vì sao khác"`)
    lines.push(`    "Tôi bắt đầu tò mò vì sao lần này khác / tại sao không quay lại"`)
    lines.push(`    KHÔNG feature dump. KHÔNG pseudo-science.`)
    lines.push(``)
    lines.push(`  [BEAT 3] UNDERSTANDING THIRD — mechanism THROUGH emotional context`)
    lines.push(`    "Hoá ra [single-axis mechanism in plain felt terms]"`)
    lines.push(`    📌 STATE MEMORY ANCHOR HERE — anchor lives in BEAT 3:`)
    lines.push(`        Frame: ${selection.memoryAnchor.frame}`)
    lines.push(`        Posture: ${selection.memoryAnchor.posture}`)
    lines.push(`        Generate niche-fit version (NEVER verbatim copy example).`)
    lines.push(``)
    lines.push(`  ⛔ Block 10 forbids: ingredient lists, pseudo-science authority,`)
    lines.push(`     ad-copy mechanism tone, "Sản phẩm chứa X, Y, Z", "công thức tiên tiến".`)
    lines.push(`  ✅ Block 10 allows: felt experience → curiosity → realization sequence only.`)
  }

  // ─── C2: Commercial memory anchor — ECHO in sampled echo block ──────
  if (block.id === selection.memoryAnchor.echoBlock) {
    lines.push(`  🔁 ECHO MEMORY ANCHOR lightly here — callback to Block 10\'s differentiator.`)
    lines.push(`  Brief mention or reframe — reader recognizes it returning, memory locks.`)
    lines.push(`  KHÔNG repeat verbatim. KHÔNG re-explain. Just trigger recognition.`)
  }

  // ─── Soft CTA (future-self-cta block) ─────────────────────────────
  if (block.samplingHooks.softCta) {
    lines.push(`  💌 ${buildSoftCtaDirective()}`)
    lines.push(`  Length: 60-100 từ. KHÔNG benefit push. KHÔNG urgency. KHÔNG "buy now".`)
    lines.push(`  Reader feels "maybe I should finally take care of myself" — NOT "buy now".`)
    lines.push(`  Self-test: thay product bằng "cuốn sách tôi đọc" — vẫn make sense → PASS.`)
  }

  return lines.join('\n')
}

/** Top-level user prompt builder.
 *
 *  POST-FIX (2026-05-27): accepts optional `synthesizedReaderSymptoms` —
 *  when provided, the nicheDomainLockBrief switches to synthesis-aware
 *  mode (product-specific symptoms replace generic niche-pool symptoms).
 *  This resolves the two-competing-pools conflict that caused niche drift
 *  in kitchen-sink niches like 'health-functional'. */
export function buildPackGenUserPrompt(
  input: StorytellingInput,
  plan: BlockPlan[],
  selection: NarratorDnaSelection,
  retryFeedback?: string,
  synthesizedReaderSymptoms?: string[],
  /** CP-SYNTHESIS (2026-05-28) — Commercial psychology overrides niche
   *  defaults in desire / cta / objections / proof texture briefs.
   *  When provided, the niche-table values become fallback baseline. */
  commercialPsychology?: import('../../productSynthesis').SynthesizedCommercialPsychology,
  /** Sprint 5 — E2/E3 (2026-05-28): pass brainstorm into block directives
   *  so Phase 1-2 blocks can pin specific agitate beats. */
  brainstorm?: PackBrainstorm,
): string {
  const lines: string[] = []

  lines.push(ENGINE_CORE_PHILOSOPHY)
  lines.push('')

  // ─── C2: Niche-domain lock (synthesis-aware, anti-contamination) ────
  // When synthesis brief provides product-specific symptoms, the brief
  // uses THOSE as the authoritative pain symptom list and downgrades the
  // niche-generic pools to "supporting cues, filter to current product".
  lines.push(nicheDomainLockBrief(selection.domainLock, synthesizedReaderSymptoms))
  lines.push('')

  // ─── C2: Niche desire architecture (anti-flattening, synthesis-aware) ────
  // CP-SYNTHESIS: commercial psychology overrides niche-baseline desire.
  lines.push(nicheDesireBrief(
    selection.desireArchitecture,
    commercialPsychology ? {
      primaryDesire: commercialPsychology.primaryDesire,
      desireTensions: commercialPsychology.desireTensions,
      emotionalGravity: commercialPsychology.emotionalGravity,
    } : undefined,
  ))
  lines.push('')

  // ─── C2: Niche mechanism vocab (anti-generic-wellness) ──────────────
  lines.push(nicheMechanismBrief(selection.domainLock.niche, selection.mechanismFrame))
  lines.push('')

  // ─── C2: Commercial memory anchor (anti-product-forgetting) ─────────
  lines.push(memoryAnchorBrief(selection.memoryAnchor))
  lines.push('')

  // ─── P3: CTA orchestration (lightweight, sampling-driven, synthesis-aware) ─
  // CP-SYNTHESIS: commercial psychology overrides niche-baseline CTA vibe.
  lines.push(buildCtaMomentsBrief(
    selection.ctaFlow,
    commercialPsychology ? {
      ctaEnergyVibe: commercialPsychology.ctaEnergyVibe,
      ctaAvoidPatterns: commercialPsychology.ctaAvoidPatterns,
    } : undefined,
  ))
  lines.push('')

  // ─── Per-pack archetype + DNA briefs ─────────────────────────────
  lines.push(payoffArchetypeBrief(selection.payoffArchetype))
  lines.push('')

  lines.push('═══ NARRATOR DNA (per-pack — sampled deterministically) ═══')
  lines.push(narratorBrief(selection.narrator))
  if (selection.emotionalDna) {
    lines.push('')
    lines.push(emotionalDnaBrief(selection.emotionalDna))
  }
  lines.push('')
  lines.push(energyCurveBrief(selection.energyCurve))
  lines.push('')
  lines.push(snapshotsBrief(selection.memorySnapshots))
  lines.push('')

  // ─── Per-block directives (skip proof blocks — separate proof call) ──
  const storyBlocks = plan.filter((p) => !isProofBlock(p.blueprint.id))
  lines.push(`═══ ${storyBlocks.length} BLOCKS — generate ALL in order ═══`)
  for (const bp of storyBlocks) {
    lines.push('')
    lines.push(buildBlockDirective(bp, input, selection, brainstorm))
  }

  // ─── Optional retry feedback ─────────────────────────────────────
  if (retryFeedback && retryFeedback.trim().length > 0) {
    lines.push('')
    lines.push('═══ RETRY FEEDBACK ═══')
    lines.push(retryFeedback)
  }

  // ─── Closing reminders (minimal — output schema only) ──────────────
  // OPT-DIAG Fix 1 (2026-05-28): trimmed redundant repeats. The
  // "reader is emotional center" + global bans are already in the
  // system prompt's CORE TARGET + GLOBAL BANS sections — repeating
  // them here adds ~80 tokens of noise per call. Kept only the
  // OUTPUT SCHEMA reminder (Gemini sometimes drops it).
  lines.push('')
  lines.push(`═══ OUTPUT ═══
JSON only. ${storyBlocks.length} blocks in order. Schema: { id, title, paragraphs: [string, ...] }.`)

  return lines.join('\n')
}

/** OPT-DIAG Fix 2 (2026-05-28) — Sharpen retry feedback.
 *
 *  Old behavior: pasted raw violation strings + generic "fix the violations"
 *  instruction. Gemini saw a wall of issues without knowing WHICH block was
 *  the worst offender or HOW to vary it — retry attempt frequently produced
 *  the SAME content with even more violations (observed 13 → 21).
 *
 *  New behavior:
 *    1. Parse violation strings to extract (failing block, validator,
 *       similarity %, ref block).
 *    2. Group by failing block — collapse multiple duplicate complaints
 *       about one block into ONE focused instruction.
 *    3. Per-validator actionable instructions:
 *       - duplicateContent → name BOTH blocks + similarity %, tell Gemini
 *         to use a DIFFERENT scene/object/sensory channel for the failing
 *         block (psychological function is unchanged — the SCENE around
 *         it must change).
 *       - adjacentRhythm → name the PREV block + tell Gemini to vary
 *         sentence-length distribution + opening word patterns.
 *       - selfInsertion / memoryAnchor / phaseOneSpecificity → quote the
 *         exact rule with the block id.
 *    4. Block ids NOT mentioned in any violation are explicitly listed
 *       as "keep these as they are" — Gemini doesn't accidentally rewrite
 *       passing blocks during retry.
 *
 *  Zero logic change to validators or the main generator — this is purely
 *  retry-prompt phrasing.
 */
export function buildRetryFeedback(items: string[]): string {
  if (items.length === 0) return ''

  // ── Parse violations into structured form ──
  interface ParsedViolation {
    blockId: string
    validator: string
    refBlock?: string
    similarity?: number
    raw: string
  }
  const parsed: ParsedViolation[] = []
  for (const raw of items) {
    // Pattern: `Block "X" failed VALIDATOR: ...`
    const blockMatch = raw.match(/Block\s+"([^"]+)"\s+failed\s+(\w+):\s*(.*)/i)
    if (!blockMatch) {
      // Non-block-tagged violation (e.g. JSON error) — keep as-is
      parsed.push({ blockId: '_global', validator: 'misc', raw })
      continue
    }
    const blockId = blockMatch[1]
    const validator = blockMatch[2]
    const rest = blockMatch[3] ?? ''
    // For duplicateContent: extract ref block + similarity
    let refBlock: string | undefined
    let similarity: number | undefined
    if (validator === 'duplicateContent') {
      const dupMatch = rest.match(/section\s+"([^"]+)"\s*\((\d+)%/)
      if (dupMatch) {
        refBlock = dupMatch[1]
        similarity = parseInt(dupMatch[2], 10)
      }
    } else if (validator === 'adjacentRhythm') {
      const adjMatch = rest.match(/\(([^)]+)\)/)
      if (adjMatch) refBlock = adjMatch[1]
    }
    parsed.push({ blockId, validator, refBlock, similarity, raw })
  }

  // ── Group by failing block ──
  const byBlock = new Map<string, ParsedViolation[]>()
  for (const v of parsed) {
    const arr = byBlock.get(v.blockId) ?? []
    arr.push(v)
    byBlock.set(v.blockId, arr)
  }

  // ── Emit focused per-block instructions ──
  const lines: string[] = []
  lines.push('Previous attempt had validator violations. Fix ONLY the blocks listed below — keep every other block exactly as in attempt 1.')
  lines.push('')

  for (const [blockId, violations] of byBlock) {
    if (blockId === '_global') {
      lines.push('GLOBAL ISSUES:')
      for (const v of violations) lines.push(`  - ${v.raw}`)
      lines.push('')
      continue
    }
    lines.push(`▸ BLOCK "${blockId}" — REWRITE this block. Specific instructions:`)

    // Group by validator within this block
    const dupViolations = violations.filter((v) => v.validator === 'duplicateContent')
    const adjViolations = violations.filter((v) => v.validator === 'adjacentRhythm')
    const others = violations.filter((v) => v.validator !== 'duplicateContent' && v.validator !== 'adjacentRhythm')

    if (dupViolations.length > 0) {
      const refs = dupViolations
        .filter((v) => v.refBlock)
        .map((v) => `"${v.refBlock}"${v.similarity ? ` (${v.similarity}%)` : ''}`)
        .join(', ')
      lines.push(`  • DUPLICATE CONTENT — your draft is too similar to: ${refs}. `)
      lines.push(`    Keep this block's psychological function the same, but CHANGE:`)
      lines.push(`    1. The SCENE / setting (different time of day, place, posture).`)
      lines.push(`    2. The OBJECT in focus (different daily item, different sensory channel).`)
      lines.push(`    3. The OPENING phrasing (different first 4-5 words).`)
      lines.push(`    Cut any phrase that appeared in the referenced block(s).`)
    }
    if (adjViolations.length > 0) {
      const refs = adjViolations.map((v) => v.refBlock ?? 'previous block').join(', ')
      lines.push(`  • ADJACENT RHYTHM — your draft echoes the rhythm of: ${refs}.`)
      lines.push(`    Vary sentence lengths (mix short + medium + longer). Vary opening words.`)
    }
    for (const v of others) {
      lines.push(`  • [${v.validator}] ${v.raw.replace(/^Block\s+"[^"]+"\s+failed\s+\w+:\s*/, '')}`)
    }
    lines.push('')
  }

  lines.push('Output the SAME JSON structure (same block ids in the same order). Do NOT touch blocks that pass — they are already good.')
  return lines.join('\n')
}

/** Log prompt stats for telemetry/debugging. */
export function logPromptStats(systemPrompt: string, userPrompt: string, plan: BlockPlan[]): void {
  const sysTokens = Math.round(systemPrompt.length / 4)
  const userTokens = Math.round(userPrompt.length / 4)
  console.info(
    `[storytelling/buildPackGenPrompt] prompt stats — system≈${sysTokens}tok, user≈${userTokens}tok, total≈${sysTokens + userTokens}tok, blocks=${plan.length}`,
  )
}
