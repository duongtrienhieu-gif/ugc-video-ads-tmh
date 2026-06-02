// ── Insert Suggester ─────────────────────────────────────────────────────────
// Z33 §11 — auto-suggest which action presets fit the current Phase 2
// script. Scans every script block's text for each preset's
// triggerKeywords; returns ranked suggestions.
//
// Example: script line "I just opened the bottle and it smelled amazing"
//   → matches OPEN_CAP (triggers: "open", "opened", "bottle")
//   → matches POINT_LABEL (triggers: "label" — not in this line)
//   → returns [OPEN_CAP score=2]
//
// The user PICKS from the suggestions — auto-application happens only
// in QUICK mode workflow (Z30 §5).
// ─────────────────────────────────────────────────────────────────────────────

import { directGeminiText } from '../../../../utils/gemini'
import type {
  ActionPresetId, GeneratedScript, ScriptBlockId, ScriptLang,
} from '../types'
import { SCRIPT_LANG_GEMINI_NAME } from '../types'
import { ACTION_PRESETS, ACTION_PRESET_ORDER } from './actionPresets'

export interface InsertSuggestion {
  presetId: ActionPresetId
  /** Number of keyword matches across the whole script (keyword path only) */
  matchCount: number
  /** Specific block ids where matches occurred (for timing engine) */
  matchedBlocks: ScriptBlockId[]
  /** Specific matched keywords (lowercased, deduped) — diagnostic */
  matchedKeywords: string[]
  /** First-match block id — used by timing engine as anchor */
  anchorBlock: ScriptBlockId | null
  /** Confidence score 0-1. Keyword path = matchCount/keywords; Gemini path = fit. */
  confidence: number
  /** Gemini path — one short phrase (in the script language) explaining the fit. */
  reason?: string
  /** Z37/Z42 — Scene Director path only. The free visual prompt (English, for
   *  the image/video model) describing the scene that illustrates this dialogue
   *  span. Used by BOTH free scene kinds:
   *    • CONCEPT_SCENE     — no product on screen (mechanism / emotion / lifestyle)
   *    • PRODUCT_IN_ACTION — product on screen, free real-world action/demo
   *  Undefined for the 12 fixed product presets (they use their own promptPreset). */
  conceptPrompt?: string
  /** Z37 — Scene Director path only. The director's chosen scene length. Free
   *  per scene (~2s to ~6s+) — the director matches it to how much dialogue the
   *  scene covers. Falls back to the preset's durationPreset when absent. */
  durationSec?: number
  /** Z42 — Scene Director path only. The VERBATIM line of dialogue (in the
   *  script's own language) this scene illustrates. Used to anchor the scene to
   *  the exact second the words are spoken (computeQuoteTimestamp), instead of
   *  the coarse block-start. Undefined for the keyword path. */
  quote?: string
}

/**
 * Z33 — Suggest preset inserts for a given script. Returns ALL presets
 * ranked by relevance. Caller decides how many to pull.
 *
 * Sorted by:
 *   1. matchCount descending  (more keyword hits = better fit)
 *   2. ACTION_PRESET_ORDER     (tiebreaker — safer presets first)
 */
export function suggestInsertsForScript(script: GeneratedScript): InsertSuggestion[] {
  const suggestions: InsertSuggestion[] = []

  for (const presetId of ACTION_PRESET_ORDER) {
    const preset = ACTION_PRESETS[presetId]
    const keywords = preset.triggerKeywords

    const matchedBlocks = new Set<ScriptBlockId>()
    const matchedKeywords = new Set<string>()
    let firstMatchBlock: ScriptBlockId | null = null

    for (const block of script.blocks) {
      const text = block.text.toLowerCase()
      for (const kw of keywords) {
        // Whole-word-ish match using regex with word boundaries — handles
        // both English ("open"/"opened") and Vietnamese (no word boundaries
        // in Vietnamese script, so we fall back to includes() for short kw)
        const matched = kw.length <= 3 || /[À-ỹ]/.test(kw)
          ? text.includes(kw)
          : new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i').test(text)
        if (matched) {
          matchedBlocks.add(block.id)
          matchedKeywords.add(kw)
          if (firstMatchBlock === null) firstMatchBlock = block.id
        }
      }
    }

    const matchCount = matchedKeywords.size
    if (matchCount === 0) continue

    const confidence = Math.min(1, matchCount / Math.max(1, keywords.length))

    suggestions.push({
      presetId,
      matchCount,
      matchedBlocks: Array.from(matchedBlocks),
      matchedKeywords: Array.from(matchedKeywords),
      anchorBlock: firstMatchBlock,
      confidence,
    })
  }

  // Sort by matchCount desc, then by preset order
  suggestions.sort((a, b) => {
    if (a.matchCount !== b.matchCount) return b.matchCount - a.matchCount
    return ACTION_PRESET_ORDER.indexOf(a.presetId) - ACTION_PRESET_ORDER.indexOf(b.presetId)
  })

  return suggestions
}

/**
 * Z33 — Keyword fallback: pick the TOP N keyword-matched suggestions.
 * Used only when no Gemini key is available. NO confidence=0 padding —
 * a weak/empty suggestion list is more honest than fake "safe default"
 * inserts that don't actually match the script.
 */
export function pickTopInsertsForBudget(
  script: GeneratedScript,
  insertBudget: number,
): InsertSuggestion[] {
  return suggestInsertsForScript(script).slice(0, insertBudget)
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ── Gemini semantic suggester (primary path) ───────────────────────────────
// Keyword matching breaks the moment the script is in a language whose
// trigger words aren't in the bag (e.g. Bahasa Malaysia). This path reads the
// MEANING of each block in the script's own language and maps it to the
// inserts that visually support it — no keyword dependency, no language lock.

export interface GeminiSuggestParams {
  geminiKey: string
  script: GeneratedScript
  lang: ScriptLang
  budget: number
  /** Z40 — soft lower bound for full-auto mode: the director should aim for at
   *  least this many scenes (a finished ad almost always needs several
   *  cutaways). Default 3. Does NOT force padding — it just stops the model
   *  from being over-shy and returning zero. */
  floor?: number
}

const SUGGEST_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    inserts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          presetId:    { type: 'string', enum: ACTION_PRESET_ORDER },
          anchorBlock: { type: 'string', enum: ['hook', 'pain', 'discovery', 'benefit', 'cta'] },
          fit:         { type: 'number' },
          reason:      { type: 'string' },
        },
        required: ['presetId', 'anchorBlock', 'fit'],
      },
    },
  },
  required: ['inserts'],
}

export async function suggestInsertsWithGemini(
  params: GeminiSuggestParams,
): Promise<InsertSuggestion[]> {
  const langName = SCRIPT_LANG_GEMINI_NAME[params.lang]
  const catalogue = ACTION_PRESET_ORDER
    .map((id) => `- ${id}: ${ACTION_PRESETS[id].descriptionVi} (needsProduct=${ACTION_PRESETS[id].needsProduct})`)
    .join('\n')
  const scriptDump = params.script.blocks
    .map((b) => `[${b.id}] ${b.text}`)
    .join('\n')

  const systemInstruction = `You are a UGC ad video editor. The script is written in ${langName}.
You choose which B-roll "action insert" clips visually support the script.
Read the MEANING of each block (do NOT keyword-match) and pick inserts that
illustrate what is being said at that moment.

AVAILABLE INSERT PRESETS (id: what it shows):
${catalogue}

RULES:
- Pick AT MOST ${params.budget} inserts, ranked best-first.
- Anchor each insert to the ONE block (hook/pain/discovery/benefit/cta) it best supports.
- Only suggest an insert if it genuinely fits. Fewer strong inserts > padding with weak ones.
- Never suggest the same presetId twice.
- "fit" = 0..1 strength of the match. "reason" = one short phrase in ${langName}.

OUTPUT strict JSON, no fences:
{ "inserts": [ { "presetId": "...", "anchorBlock": "...", "fit": 0.0, "reason": "..." } ] }`

  const userPrompt = `SCRIPT (block id in brackets):\n${scriptDump}\n\nPick the inserts now.`

  const raw = await directGeminiText({
    apiKey: params.geminiKey,
    systemInstruction,
    prompt: userPrompt,
    maxOutputTokens: 1024,
    responseMimeType: 'application/json',
    responseSchema: SUGGEST_RESPONSE_SCHEMA,
  })

  const parsed = parseSuggestOutput(raw)
  const seen = new Set<ActionPresetId>()
  const validPresets = new Set<string>(ACTION_PRESET_ORDER)
  const validBlocks = new Set<string>(['hook', 'pain', 'discovery', 'benefit', 'cta'])

  const out: InsertSuggestion[] = []
  for (const item of parsed) {
    if (!validPresets.has(item.presetId)) continue
    if (seen.has(item.presetId as ActionPresetId)) continue
    const anchor = validBlocks.has(item.anchorBlock) ? (item.anchorBlock as ScriptBlockId) : null
    const fit = Math.max(0, Math.min(1, Number(item.fit) || 0))
    if (fit <= 0) continue  // drop non-matches — no padding
    seen.add(item.presetId as ActionPresetId)
    out.push({
      presetId: item.presetId as ActionPresetId,
      matchCount: 0,
      matchedBlocks: anchor ? [anchor] : [],
      matchedKeywords: [],
      anchorBlock: anchor,
      confidence: fit,
      reason: typeof item.reason === 'string' ? item.reason : undefined,
    })
  }
  out.sort((a, b) => b.confidence - a.confidence)
  return out.slice(0, params.budget)
}

// ── Z37 Scene Director (primary path when own-script / brainstorm wanted) ──
// The suggester above only maps the script to the 12 PRODUCT presets. The
// Scene Director goes further: it READS the whole script, brainstorms a
// variable scene breakdown (grouping same-content sentences into one 3-7s
// clip), and for each visual moment decides between:
//   • a PRODUCT preset (one of the 12 — product is on screen, fidelity-locked)
//   • a CONCEPT_SCENE  (no product on screen — a free B-roll prompt the model
//                       can render however it likes to illustrate the meaning;
//                       no fidelity risk because the product never appears).
// Talking-head moments produce NO insert (the creator video already covers
// them — inserts only LAYER over it). So the director's job is: where to cut
// away, and to what.

const DIRECTOR_PRESET_ENUM = [...ACTION_PRESET_ORDER, 'CONCEPT_SCENE', 'PRODUCT_IN_ACTION']

const DIRECTOR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          presetId:      { type: 'string', enum: DIRECTOR_PRESET_ENUM },
          anchorBlock:   { type: 'string', enum: ['hook', 'pain', 'discovery', 'benefit', 'cta'] },
          quote:         { type: 'string' },
          durationSec:   { type: 'number' },
          fit:           { type: 'number' },
          reason:        { type: 'string' },
          conceptPrompt: { type: 'string' },
        },
        required: ['presetId', 'anchorBlock', 'quote', 'durationSec', 'fit'],
      },
    },
  },
  required: ['scenes'],
}

export async function directScenesWithGemini(
  params: GeminiSuggestParams,
): Promise<InsertSuggestion[]> {
  const langName = SCRIPT_LANG_GEMINI_NAME[params.lang]
  // Full-auto baseline: aim for at least `floor` scenes (default 3) but never
  // more than the budget. Keeps the director from returning an empty list.
  const floor = Math.max(1, Math.min(params.floor ?? 3, params.budget))
  const catalogue = ACTION_PRESET_ORDER
    .map((id) => `- ${id}: ${ACTION_PRESETS[id].descriptionVi} (needsProduct=${ACTION_PRESETS[id].needsProduct})`)
    .join('\n')
  const scriptDump = params.script.blocks
    .map((b) => `[${b.id}] ${b.text}`)
    .join('\n')

  const systemInstruction = `You are a senior UGC ad video DIRECTOR with full creative freedom. The
script is written in ${langName}. This is NOT a fixed storytelling template —
read the actual script, understand the product and the niche, and decide the
B-roll like a real director would. The product can be ANYTHING (health
supplement, cosmetics, kitchen appliance, power tool, machine, gadget, apparel…)
— never assume it is a supplement.

A single talking-head "creator video" of the person speaking already covers the
whole script. Your job: decide WHERE to cut away to a supporting visual (a
B-roll insert that LAYERS over the talking head) and WHAT to show there.

You have THREE kinds of scene:

1. FIXED PRODUCT presets — product ON SCREEN, fidelity-locked, with a fixed safe
   action. Use when the line is about a simple product handling moment that one
   of these already describes:
${catalogue}

2. PRODUCT_IN_ACTION — product ON SCREEN, fidelity-locked, but YOU write the
   action. Use this for any real-world use / demo / test the fixed presets can't
   express — e.g. a blender crushing ice, a drill driving a screw, cream rubbed
   into skin, a bottle dunked in water to prove it's waterproof, a machine
   running on a workbench, the product used outdoors. For PRODUCT_IN_ACTION you
   MUST write a "conceptPrompt": one vivid English sentence describing the action
   + setting. The product itself stays on screen (a reference image locks its
   look) — so describe the ACTION around it, do NOT redescribe the packaging.

3. CONCEPT_SCENE — NO product on screen. Use when the line describes a FEELING,
   a PROBLEM, a MECHANISM / how-it-works, an INGREDIENT or cause, or a lifestyle
   moment that is better shown WITHOUT the product. For CONCEPT_SCENE you MUST
   write a "conceptPrompt": one vivid English sentence (subject, setting, mood,
   action). NEVER put product packaging in a CONCEPT_SCENE conceptPrompt.

DIRECTING RULES:
- Read the MEANING. Ground EVERY scene in a real line of the script — never
  invent a visual for something the script doesn't say. If a beat has no
  worthwhile visual, skip it.
- For EVERY scene, copy the exact line of dialogue it illustrates into "quote"
  (verbatim, in ${langName}, one sentence or clause — this is how the scene is
  timed to the voice). The quote MUST be text that actually appears in the script.
- COVER THE WHOLE SCRIPT, not just the obvious beats. If the script explains
  INGREDIENTS or a MECHANISM / how-it-works, you MUST give those lines their own
  scene (usually CONCEPT_SCENE or PRODUCT_IN_ACTION) — do not leave them with no
  visual. This is the most common miss.
- Group sentences describing the SAME idea into ONE scene; don't cut every line.
- Duration is FREE per scene — YOU decide based on how much dialogue it covers.
  A quick punch ≈ 2s, a normal beat ≈ 3-4s, a dense idea ≈ 5-6s. Use whatever
  fits; do NOT force everything to one length.
- Anchor each scene to the ONE block (hook/pain/discovery/benefit/cta) whose
  dialogue it illustrates (used only as a coarse fallback).
- A finished UGC ad cuts to a supporting visual on most key beats. Propose
  between ${floor} and ${params.budget} scenes covering the arc. Returning zero
  or one scene is only right for an unusually short script.
- "fit" = 0..1 how strongly the visual supports the line. "reason" = one short
  phrase in ${langName} explaining the choice (shown to the user).

OUTPUT strict JSON, no fences:
{ "scenes": [ { "presetId": "...", "anchorBlock": "...", "quote": "(verbatim line)",
  "durationSec": 4, "fit": 0.0, "reason": "...",
  "conceptPrompt": "(required for CONCEPT_SCENE and PRODUCT_IN_ACTION)" } ] }`

  const userPrompt = `SCRIPT (block id in brackets):\n${scriptDump}\n\nDirect the scenes now.`

  const raw = await directGeminiText({
    apiKey: params.geminiKey,
    systemInstruction,
    prompt: userPrompt,
    maxOutputTokens: 2048,
    responseMimeType: 'application/json',
    responseSchema: DIRECTOR_RESPONSE_SCHEMA,
  })

  const parsed = parseDirectorOutput(raw)
  const validPresets = new Set<string>(DIRECTOR_PRESET_ENUM)
  const validBlocks = new Set<string>(['hook', 'pain', 'discovery', 'benefit', 'cta'])

  const out: InsertSuggestion[] = []
  for (const item of parsed) {
    if (!validPresets.has(item.presetId)) continue
    // Both free-scene kinds carry a director-written prompt and are useless
    // without one — drop them if the prompt is missing.
    const isFreeScene = item.presetId === 'CONCEPT_SCENE' || item.presetId === 'PRODUCT_IN_ACTION'
    const conceptPrompt = typeof item.conceptPrompt === 'string' ? item.conceptPrompt.trim() : ''
    if (isFreeScene && conceptPrompt.length === 0) continue
    const anchor = validBlocks.has(item.anchorBlock) ? (item.anchorBlock as ScriptBlockId) : null
    const fit = Math.max(0, Math.min(1, Number(item.fit) || 0))
    if (fit <= 0) continue  // drop non-matches — no padding
    const durationSec = clampDuration(item.durationSec, item.presetId as ActionPresetId)
    const quote = typeof item.quote === 'string' && item.quote.trim().length > 0
      ? item.quote.trim()
      : undefined
    out.push({
      presetId: item.presetId as ActionPresetId,
      matchCount: 0,
      matchedBlocks: anchor ? [anchor] : [],
      matchedKeywords: [],
      anchorBlock: anchor,
      confidence: fit,
      reason: typeof item.reason === 'string' ? item.reason : undefined,
      conceptPrompt: isFreeScene ? conceptPrompt : undefined,
      durationSec,
      quote,
    })
  }
  // Keep the director's ORDER (narrative sequence), not a fit sort — scenes
  // should play in script order. Cap to budget.
  const directed = out.slice(0, params.budget)
  if (directed.length > 0) return directed
  // Z40 full-auto safety net — Gemini returned nothing usable (over-shy, parse
  // miss, or a thin script). Fall back to the keyword suggester so the engine
  // still proposes a baseline instead of dumping the work back on the user.
  // (If the keyword path is ALSO empty, the script genuinely has no matchable
  // moment — that's an honest empty, not a shy one.)
  return suggestInsertsForScript(params.script).slice(0, params.budget)
}

function clampDuration(v: unknown, presetId: ActionPresetId): number {
  // Z42 — free duration, but bounded by what each render mode can actually
  // produce:
  //   • CONCEPT_SCENE renders as Ken Burns (local zoom over a still) — the clip
  //     length is synthetic, so it can hold up to ~8s.
  //   • Everything else renders as a Kling i2v clip whose footage is a fixed 5s
  //     (insertRenderer duration:5) — a longer overlay would have no footage to
  //     fill it, so cap at 5s.
  // Floor is 2s for all (the director may want a quick punch cut).
  const ceiling = presetId === 'CONCEPT_SCENE' ? 8 : 5
  const n = Number(v)
  if (!Number.isFinite(n)) return 4
  return Math.max(2, Math.min(ceiling, Math.round(n * 10) / 10))
}

interface RawDirectorScene {
  presetId: string
  anchorBlock: string
  quote?: string
  durationSec: number
  fit: number
  reason?: string
  conceptPrompt?: string
}

function parseDirectorOutput(raw: string): RawDirectorScene[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return []
    }
  }
  const obj = parsed as { scenes?: unknown }
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.scenes)) return []
  return obj.scenes as RawDirectorScene[]
}

interface RawSuggestItem {
  presetId: string
  anchorBlock: string
  fit: number
  reason?: string
}

function parseSuggestOutput(raw: string): RawSuggestItem[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return []
    }
  }
  const obj = parsed as { inserts?: unknown }
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.inserts)) return []
  return obj.inserts as RawSuggestItem[]
}
