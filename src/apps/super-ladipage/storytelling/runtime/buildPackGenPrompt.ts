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

/** Per-block directive block. Lean — only what this block's
 *  psychologicalFunction + samplingHooks call for. */
function buildBlockDirective(
  plan: BlockPlan,
  input: StorytellingInput,
  selection: NarratorDnaSelection,
): string {
  const block = plan.blueprint

  const lines: string[] = []
  lines.push(`BLOCK ${plan.order} — id="${block.id}" (phase=${block.phase})`)
  lines.push(`  PSYCHOLOGICAL FUNCTION: ${block.psychologicalFunction}`)
  lines.push(`  INTENT: ${block.intent}`)
  lines.push(`  YOU/I BALANCE: ${block.youIBalance}`)
  lines.push(`  ${balanceFramingDirective(block.youIBalance)}`)
  lines.push(`  PARAGRAPHS: ${block.paragraphTarget.min}-${block.paragraphTarget.max}`)

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

  // ─── Social proof (separate review-only call) ────────────────────
  if (block.samplingHooks.reviewSlot) {
    lines.push(`  📋 OUTPUT: { id: "social-proof", title, paragraphs: ["[5-15 từ intro]"] }`)
    lines.push(`  paragraphs: 1 short intro string (5-15 từ) phù hợp tone narrator dẫn vào quotes.`)
    lines.push(`  reviews: DO NOT generate here — omit field. Reviews come from separate generation pass.`)
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

/** Top-level user prompt builder. */
export function buildPackGenUserPrompt(
  input: StorytellingInput,
  plan: BlockPlan[],
  selection: NarratorDnaSelection,
  retryFeedback?: string,
): string {
  const lines: string[] = []

  lines.push(ENGINE_CORE_PHILOSOPHY)
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

  // ─── Per-block directives ────────────────────────────────────────
  lines.push(`═══ ${plan.length} BLOCKS — generate ALL in order ═══`)
  for (const bp of plan) {
    lines.push('')
    lines.push(buildBlockDirective(bp, input, selection))
  }

  // ─── Optional retry feedback ─────────────────────────────────────
  if (retryFeedback && retryFeedback.trim().length > 0) {
    lines.push('')
    lines.push('═══ RETRY FEEDBACK ═══')
    lines.push(retryFeedback)
  }

  // ─── Closing reminders (brief) ───────────────────────────────────
  lines.push('')
  lines.push(`═══ CLOSING REMINDERS ═══
- Output JSON ONLY (no markdown fences, no prose outside JSON).
- Exactly ${plan.length} blocks in this exact order.
- Each block: { id, title, paragraphs: [string, ...] }
- social-proof block: paragraphs = [1 short intro], reviews field absent.
- Reader is emotional center — narrator validates, doesn't dominate.
- KHÔNG "buy now" / KHÔNG aspirational copywriter bait / KHÔNG fake empathy.`)

  return lines.join('\n')
}

/** Build retry feedback string for second-attempt prompt injection. */
export function buildRetryFeedback(items: string[]): string {
  if (items.length === 0) return ''
  return [
    'Previous attempt had violations. Fix the following and regenerate:',
    ...items.map((it) => `  - ${it}`),
    'Output the SAME structure (same block ids in same order). Only fix the violations.',
  ].join('\n')
}

/** Log prompt stats for telemetry/debugging. */
export function logPromptStats(systemPrompt: string, userPrompt: string, plan: BlockPlan[]): void {
  const sysTokens = Math.round(systemPrompt.length / 4)
  const userTokens = Math.round(userPrompt.length / 4)
  console.info(
    `[storytelling/buildPackGenPrompt] prompt stats — system≈${sysTokens}tok, user≈${userTokens}tok, total≈${sysTokens + userTokens}tok, blocks=${plan.length}`,
  )
}
