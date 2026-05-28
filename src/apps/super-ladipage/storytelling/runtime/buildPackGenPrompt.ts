// ═════════════════════════════════════════════════════════════════════
// Storytelling Engine — v6 user prompt builder
//
// REBUILD 2026-05-29:
//   - Removed ENGINE_CORE_PHILOSOPHY duplication (lived in system prompt;
//     repeated here was creating contradictions vs mode-conditional role).
//   - Removed Sprint 5/6/7 "HARD RULE" inline escalation in block directives.
//   - Removed dual mirrorBeat / brainstorm-beat competing logic.
//   - Per-block directives are now lean — name the function + assigned
//     beat (when present) + paragraph target. No "FORBIDDEN" inline walls.
//   - Block 10 2-beat structure preserved (still needed) but trimmed.
//   - Concrete-cost rule for failed-attempts kept but condensed.
//   - buildRetryFeedback: simplified to "vary scene of these blocks";
//     elaborate diff parsing removed (was compensating for weak prompt).
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
import {
  payoffArchetypeBrief, payoffSectionFlavor,
} from '../config/payoffArchetypes'
import { sampleMirrorBeat, readerMirrorBeatDirective } from '../config/readerMirrorMoments'
import { nicheDomainLockBrief } from '../config/nicheDomainLock'
import { nicheMechanismBrief } from '../config/nicheMechanismVocab'
import { nicheDesireBrief } from '../config/nicheDesireArchitecture'
import { memoryAnchorBrief } from '../config/commercialMemoryAnchors'
import { dissolutionBrief } from '../config/productDissolutionPatterns'
import { softCompareBrief } from '../config/softComparePatterns'
import { buildCtaMomentsBrief } from '../../cta'
import type { NarratorDnaSelection } from './selectNarratorDna'
import type { PackBrainstorm } from '../../packBrainstorm'
import type { LengthMode } from '../../narrativeMode'
import { LENGTH_MODE_SPEC } from '../../narrativeMode'

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

/** YOU/I balance directive — 1 line per balance. */
function balanceFramingDirective(balance: YouIBalance): string {
  switch (balance) {
    case 'reader-heavy':
      return 'YOU dominant. Narrator absent / implicit. Reader emotions = center.'
    case 'narrator-validation':
      return 'Narrator validates ("tôi cũng từng X"). Reader still center, không monologue.'
    case 'future-reader':
      return 'YOU projected forward. Narrator recedes.'
  }
}

/** Phase 1-2 block → which agitate beat from brainstorm to execute.
 *  Each block centers on ONE assigned beat (no blur). */
const PHASE12_BEAT_ASSIGNMENT: Record<string, number> = {
  'daily-micro-friction':   0,
  'hidden-emotional-truth': 1,
  'not-alone-bridge':       2,
}

/** Per-block directive. Lean by design — only what this block needs. */
function buildBlockDirective(
  plan: BlockPlan,
  input: StorytellingInput,
  selection: NarratorDnaSelection,
  brainstorm?: PackBrainstorm,
  /** 2026-05-29 — When provided, overrides default paragraphTarget with
   *  length-mode-aware bounds + injects explicit per-block word cap. */
  lengthMode?: LengthMode,
): string {
  const block = plan.blueprint
  const lines: string[] = []

  // 2026-05-29 — Per-block paragraph + word cap from length mode (if set).
  // SHORT mode tightens both for mobile-friendly output.
  const lengthSpec = lengthMode ? LENGTH_MODE_SPEC[lengthMode] : null
  const paragraphMin = lengthSpec ? lengthSpec.paragraphMin : block.paragraphTarget.min
  const paragraphMax = lengthSpec ? lengthSpec.paragraphMax : block.paragraphTarget.max

  lines.push(`BLOCK ${plan.order} — id="${block.id}" (phase=${block.phase})`)
  lines.push(`  Function: ${block.psychologicalFunction}`)
  lines.push(`  Intent: ${block.intent}`)
  lines.push(`  POV: ${block.youIBalance} — ${balanceFramingDirective(block.youIBalance)}`)
  lines.push(`  Paragraphs: ${paragraphMin}-${paragraphMax}`)
  if (lengthSpec) {
    // 2026-05-29 (re-cal) — Strong MIN floor language; previous "60-100"
    // phrasing made Gemini write 30-word blocks. New version treats MIN
    // as a HARD FLOOR.
    lines.push(`  ⚠️ Words: MIN ${lengthSpec.wordCapMin} (FLOOR — do NOT go below), MAX ${lengthSpec.wordCapMax}. Aim ${Math.round((lengthSpec.wordCapMin + lengthSpec.wordCapMax) / 2)}-${lengthSpec.wordCapMax}.`)
    lines.push(`  Sentences per paragraph: 1-${lengthSpec.sentencesPerParagraphMax} MAX (1-sentence paragraphs OK for impact).`)
    lines.push(`  Sentence length: ≤ ${lengthSpec.wordsPerSentenceMax} words avg — mobile reader scrolls fast.`)
  }

  // ─── Phase 1-2 agitate beat assignment (from brainstorm) ────────────
  // Each Phase 1-2 block gets ONE beat to execute (no blur across blocks).
  const hasAssignedBeat = brainstorm && block.id in PHASE12_BEAT_ASSIGNMENT
  if (hasAssignedBeat) {
    const beatIndex = PHASE12_BEAT_ASSIGNMENT[block.id]
    const beat = brainstorm.agitateBeats[beatIndex] ?? brainstorm.agitateBeats[0]
    if (beat) {
      lines.push(`  Agitate beat (center on THIS): "${beat}"`)
      lines.push(`  Use concrete sensory cue / number / micro-moment — not vague abstraction.`)
    }
  }

  // ─── Block 1 opening (brainstorm hookDraft is sole source) ──────────
  if (block.samplingHooks.performanceHookLayer) {
    if (brainstorm?.hookDraft) {
      lines.push(`  Block 1 opening: use brainstorm hookDraft (see PACK BRAINSTORM in system prompt).`)
      lines.push(`  After the opening, may use opener "${selection.youFirstOpener}" or bridge "${selection.bridgePhrase}" for connective tissue.`)
    } else {
      lines.push(`  Block 1 opening: YOU-first, anchor reader's pain in first 2 sentences. Opener hint: "${selection.youFirstOpener}".`)
    }
  }

  // ─── Reader mirror beat (only when no brainstorm beat already assigned) ──
  if (block.samplingHooks.readerMirrorBeat && !hasAssignedBeat) {
    const beat = sampleMirrorBeat(selection.seed, block.id)
    if (beat) {
      lines.push(`  Mirror beat: ${readerMirrorBeatDirective(beat).replace(/\n/g, ' ').slice(0, 220)}`)
    }
  }

  // ─── Discovery channel (Phase 3 natural-product-discovery) ──────────
  if (block.samplingHooks.discoveryChannel) {
    for (const line of discoveryChannelBrief(selection.discoveryChannel).split('\n')) {
      lines.push(`  ${line}`)
    }
  }

  // ─── Product dissolution (Block 9) ──────────────────────────────────
  if (block.samplingHooks.productDissolution) {
    for (const line of dissolutionBrief(selection.dissolutionPattern).split('\n')) {
      lines.push(`  ${line}`)
    }
  }

  // ─── Soft compare (Block 11) ─────────────────────────────────────────
  if (block.samplingHooks.softCompare) {
    for (const line of softCompareBrief(selection.comparePattern).split('\n')) {
      lines.push(`  ${line}`)
    }
  }

  // ─── Belief shift block ─────────────────────────────────────────────
  if (block.samplingHooks.beliefCatalyst) {
    const reframe = getReframeForNiche(input.niche)
    const catalystSpec = BELIEF_SHIFT_CATALYSTS[selection.beliefCatalystType]
    lines.push(`  Belief shift — catalyst: ${selection.beliefCatalystType} (${catalystSpec.description})`)
    lines.push(`  Reframe shape: "Có thể vấn đề không phải [old], mà là [new — body-system-level cause]"`)
    lines.push(`  Topic hint (do NOT quote): "${reframe.oldBelief.slice(0, 50)}"`)
    lines.push(`  KHÔNG mention product name (reveal lives in Phase-3 discovery block).`)
  }

  // ─── Payoff archetype (Phase 4 blocks) ──────────────────────────────
  if (block.samplingHooks.payoffArchetype) {
    if (block.id === 'micro-transformation' || block.id === 'emotional-wins' || block.id === 'future-self-cta') {
      for (const line of payoffSectionFlavor(selection.payoffArchetype, block.id).split('\n')) {
        lines.push(`  ${line}`)
      }
    }
  }

  // ─── Failed-attempts block: concrete cost rule (full enforcement) ──
  // 2026-05-29: restored full Sprint 5 E2 enforcement after v6 condensed
  // version got ignored by Gemini (output stayed generic — "thuốc kháng
  // histamine" without brand/cost/duration). Block-specific rule does not
  // contradict any architecture; condensing it was over-pruning.
  if (block.id === 'shared-failed-attempts') {
    lines.push(`  💸 CONCRETE COST RULE — STRICT (this is the strongest signal in this block):`)
    lines.push(`  HARD RULE: Each failed attempt MUST include a CONCRETE COST signal in at least ONE of these dimensions.`)
    lines.push(`  Generic phrasing without specifics WILL be rejected.`)
    lines.push(`    1. MONEY — specific amount, real or plausibly invented`)
    lines.push(`         e.g. "4 thang nước thuốc Bắc × 80 RM = 320 RM"`)
    lines.push(`         e.g. "máy xịt mũi 180 RM, dùng 2 tháng đã hỏng"`)
    lines.push(`         e.g. "3 hộp viên uống × 65 RM = gần 200 RM"`)
    lines.push(`    2. TIME WASTED — specific duration the attempt was tried`)
    lines.push(`         e.g. "uống đều 3 tháng, không kết quả"`)
    lines.push(`         e.g. "kiên trì xông hơi 6 tuần liền"`)
    lines.push(`         e.g. "dùng liên tục nửa năm rồi từ bỏ"`)
    lines.push(`    3. BRAND / METHOD NAME — concrete real or plausibly local reference`)
    lines.push(`         e.g. "siro Bisolvon — vị ngọt, không hiệu quả"`)
    lines.push(`         e.g. "Otrivin xịt mũi, làm khô niêm mạc"`)
    lines.push(`         e.g. "miếng dán Trung Quốc trên Shopee 35 RM"`)
    lines.push(`  ✅ Total inventory: 3-5 attempts. EACH one MUST carry at least 1 cost dimension above.`)
    lines.push(`  ⛔ FORBIDDEN openers / phrasings — REJECT these patterns:`)
    lines.push(`     - "Tôi đã thử đủ mọi cách" (no specifics following)`)
    lines.push(`     - "Thử nhiều loại / Dùng viên ngậm hoặc..." (no brand, no number)`)
    lines.push(`     - "thuốc kháng histamine" / "thuốc xịt mũi" / "nước muối sinh lý" alone (category-only, NO brand, NO RM, NO duration)`)
    lines.push(`     - Bullet-only lists without one micro-detail per item`)
    lines.push(`  ✅ STRONGLY recommended close: 1-line total cost summary —`)
    lines.push(`     e.g. "Cộng lại, hơn 900 RM ném vào những thứ không giải quyết gốc rễ."`)
    lines.push(`     e.g. "Tính ra gần 1.500 RM cho những thứ chỉ đỡ tạm thời."`)
  }

  // ─── Block 10 (why-this-felt-different): 2-beat + tease handoff to PI ──
  if (block.id === 'why-this-felt-different') {
    lines.push(`  Block 10 structure (2 beats + 1-line tease):`)
    lines.push(`    Beat 1 — EMOTION FIRST: start with felt difference ("Cảm giác/cái khác là...").`)
    lines.push(`    Beat 2 — CURIOSITY: surface "vì sao khác". State memory anchor here.`)
    lines.push(`      Anchor frame: ${selection.memoryAnchor.frame}`)
    lines.push(`      Anchor posture: ${selection.memoryAnchor.posture}`)
    lines.push(`    Beat 3 — TEASE ONLY (1-2 sentences): hand off to next block.`)
    lines.push(`      Example: "Sau khi tôi hỏi anh em rể dược sĩ, anh ấy giải thích rõ hơn — tôi viết lại ở chương tiếp."`)
    lines.push(`  Block 10 forbids: ingredient lists, pseudo-science, "công thức tiên tiến",`)
    lines.push(`    full mechanism explanation. Mechanism deep-dive happens in PI block (next).`)
  }

  // ─── Echo memory anchor (sampled echo block) ────────────────────────
  if (block.id === selection.memoryAnchor.echoBlock) {
    lines.push(`  Echo memory anchor lightly — callback to Block 10 differentiator.`)
    lines.push(`  Brief mention / reframe — reader recognizes it returning. KHÔNG verbatim repeat.`)
  }

  // ─── Soft CTA block ─────────────────────────────────────────────────
  if (block.samplingHooks.softCta) {
    lines.push(`  ${buildSoftCtaDirective()}`)
    lines.push(`  Length 60-100 từ. KHÔNG benefit push, KHÔNG urgency, KHÔNG "buy now".`)
    lines.push(`  Self-test: thay product bằng "cuốn sách tôi đọc" — vẫn make sense → PASS.`)
  }

  return lines.join('\n')
}

/** Top-level user prompt builder.
 *  Composes: niche briefs → narrator DNA → per-block directives. */
export function buildPackGenUserPrompt(
  input: StorytellingInput,
  plan: BlockPlan[],
  selection: NarratorDnaSelection,
  retryFeedback?: string,
  synthesizedReaderSymptoms?: string[],
  commercialPsychology?: import('../../productSynthesis').SynthesizedCommercialPsychology,
  brainstorm?: PackBrainstorm,
  /** 2026-05-29 — Length mode for per-block word cap + mobile rhythm. */
  lengthMode?: LengthMode,
): string {
  const lines: string[] = []

  // ─── Niche domain lock (single-source resolution: synthesis OR niche) ──
  lines.push(nicheDomainLockBrief(selection.domainLock, synthesizedReaderSymptoms))
  lines.push('')

  // ─── Niche desire (commercial-psych override when present) ──────────
  lines.push(nicheDesireBrief(
    selection.desireArchitecture,
    commercialPsychology ? {
      primaryDesire: commercialPsychology.primaryDesire,
      desireTensions: commercialPsychology.desireTensions,
      emotionalGravity: commercialPsychology.emotionalGravity,
    } : undefined,
  ))
  lines.push('')

  // ─── Niche mechanism vocab (anti-generic-wellness) ──────────────────
  lines.push(nicheMechanismBrief(selection.domainLock.niche, selection.mechanismFrame))
  lines.push('')

  // ─── Memory anchor (anti-product-forgetting) ────────────────────────
  lines.push(memoryAnchorBrief(selection.memoryAnchor))
  lines.push('')

  // ─── CTA orchestration (commercial-psych override when present) ─────
  lines.push(buildCtaMomentsBrief(
    selection.ctaFlow,
    commercialPsychology ? {
      ctaEnergyVibe: commercialPsychology.ctaEnergyVibe,
      ctaAvoidPatterns: commercialPsychology.ctaAvoidPatterns,
    } : undefined,
  ))
  lines.push('')

  // ─── Per-pack archetype + narrator DNA ──────────────────────────────
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
    lines.push(buildBlockDirective(bp, input, selection, brainstorm, lengthMode))
  }

  // ─── Optional retry feedback ────────────────────────────────────────
  if (retryFeedback && retryFeedback.trim().length > 0) {
    lines.push('')
    lines.push('═══ RETRY NOTE ═══')
    lines.push(retryFeedback)
  }

  // ─── Output schema reminder (minimal) ───────────────────────────────
  lines.push('')
  lines.push(`═══ OUTPUT ═══
JSON only. ${storyBlocks.length} blocks in order. Schema per block: { id, title, paragraphs: [string, ...] }.`)

  return lines.join('\n')
}

/** Simplified retry feedback. v5 elaborate per-violation parser was
 *  compensating for a weak prompt — it generated dense per-block diffs
 *  that often confused Gemini (saw 13→21 violation escalation in
 *  testing). v6 keeps it short and focused on the blocks that failed.
 *
 *  The mode-conditional system prompt + flat block directives should now
 *  produce passing output on attempt 1 more often, so retry feedback is
 *  the exception, not the rule. */
export function buildRetryFeedback(items: string[]): string {
  if (items.length === 0) return ''

  // Group violations by block id.
  const byBlock = new Map<string, string[]>()
  const globals: string[] = []
  for (const raw of items) {
    const m = raw.match(/Block\s+"([^"]+)"\s+failed\s+(\w+):\s*(.*)/i)
    if (!m) {
      globals.push(raw)
      continue
    }
    const blockId = m[1]
    const summary = `${m[2]}: ${m[3].slice(0, 140)}`
    const arr = byBlock.get(blockId) ?? []
    arr.push(summary)
    byBlock.set(blockId, arr)
  }

  const lines: string[] = []
  lines.push('Attempt 1 had issues in the blocks below. Rewrite ONLY these blocks; keep all other blocks identical to attempt 1.')
  lines.push('')

  for (const [blockId, summaries] of byBlock) {
    lines.push(`▸ Block "${blockId}":`)
    for (const s of summaries) lines.push(`    - ${s}`)
    lines.push(`    Fix: vary scene/object/sensory channel + opening phrasing. Keep psychological function intact.`)
    lines.push('')
  }

  if (globals.length > 0) {
    lines.push('Global issues:')
    for (const g of globals) lines.push(`  - ${g}`)
    lines.push('')
  }

  lines.push('Output the SAME JSON schema (same block ids in same order).')
  return lines.join('\n')
}

/** Log prompt stats — telemetry only. */
export function logPromptStats(systemPrompt: string, userPrompt: string, plan: BlockPlan[]): void {
  const sysTokens = Math.round(systemPrompt.length / 4)
  const userTokens = Math.round(userPrompt.length / 4)
  console.info(
    `[storytelling/buildPackGenPrompt] prompt stats — system≈${sysTokens}tok, user≈${userTokens}tok, total≈${sysTokens + userTokens}tok, blocks=${plan.length}`,
  )
}
