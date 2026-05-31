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
  /** Z37 — Scene Director path only. When presetId === 'CONCEPT_SCENE', this is
   *  the free visual prompt (English, for the image/video model) describing the
   *  concept B-roll that illustrates this dialogue span. Undefined for the 12
   *  product presets. */
  conceptPrompt?: string
  /** Z37 — Scene Director path only. The director's chosen scene length (3-7s),
   *  grouping same-content sentences into one clip. Falls back to the preset's
   *  durationPreset when absent. */
  durationSec?: number
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

const DIRECTOR_PRESET_ENUM = [...ACTION_PRESET_ORDER, 'CONCEPT_SCENE']

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
          durationSec:   { type: 'number' },
          fit:           { type: 'number' },
          reason:        { type: 'string' },
          conceptPrompt: { type: 'string' },
        },
        required: ['presetId', 'anchorBlock', 'durationSec', 'fit'],
      },
    },
  },
  required: ['scenes'],
}

export async function directScenesWithGemini(
  params: GeminiSuggestParams,
): Promise<InsertSuggestion[]> {
  const langName = SCRIPT_LANG_GEMINI_NAME[params.lang]
  const catalogue = ACTION_PRESET_ORDER
    .map((id) => `- ${id}: ${ACTION_PRESETS[id].descriptionVi} (needsProduct=${ACTION_PRESETS[id].needsProduct})`)
    .join('\n')
  const scriptDump = params.script.blocks
    .map((b) => `[${b.id}] ${b.text}`)
    .join('\n')

  const systemInstruction = `You are a UGC ad video DIRECTOR. The script is written in ${langName}.
A single talking-head "creator video" of the person speaking already covers the
whole script. Your job is to decide WHERE to cut away to a supporting visual
(a B-roll insert that LAYERS over the talking head) and WHAT to show there.

You have TWO kinds of insert:

1. PRODUCT presets — the real product is ON SCREEN (fidelity-locked to the
   reference image). Use these when the dialogue is about handling / using /
   showing the product itself. Pick from this catalogue:
${catalogue}

2. CONCEPT_SCENE — a free concept B-roll with NO product on screen. Use this
   when the dialogue describes a FEELING, a PROBLEM, a MECHANISM / how-it-works,
   a lifestyle moment, or an ingredient/cause — anything that is better shown by
   an illustrative scene than by the product. For CONCEPT_SCENE you MUST write a
   "conceptPrompt": one vivid English sentence describing the shot (subject,
   setting, mood, action). NEVER put product packaging in a conceptPrompt.

DIRECTING RULES:
- Read the MEANING of the script, not keywords. Group sentences that describe
  the SAME idea into ONE scene (do not cut every sentence).
- Each scene is 3-7 seconds ("durationSec"). Match length to how much dialogue
  it covers — one short line ≈ 3s, a few sentences on one idea ≈ 5-7s.
- Anchor each scene to the ONE block (hook/pain/discovery/benefit/cta) whose
  dialogue it illustrates.
- Cut away only when a visual genuinely helps. Leave plain talking-head moments
  alone (just omit them). Quality of cuts > quantity. Max ${params.budget} scenes.
- Prefer CONCEPT_SCENE for emotion / problem / mechanism / lifestyle; prefer a
  PRODUCT preset only when the product itself is the subject of that line.
- "fit" = 0..1 how strongly the visual supports the line. "reason" = one short
  phrase in ${langName} explaining the choice (shown to the user).

OUTPUT strict JSON, no fences:
{ "scenes": [ { "presetId": "...", "anchorBlock": "...", "durationSec": 4,
  "fit": 0.0, "reason": "...", "conceptPrompt": "(only for CONCEPT_SCENE)" } ] }`

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
    const isConcept = item.presetId === 'CONCEPT_SCENE'
    // A concept scene with no prompt is useless — drop it.
    const conceptPrompt = typeof item.conceptPrompt === 'string' ? item.conceptPrompt.trim() : ''
    if (isConcept && conceptPrompt.length === 0) continue
    const anchor = validBlocks.has(item.anchorBlock) ? (item.anchorBlock as ScriptBlockId) : null
    const fit = Math.max(0, Math.min(1, Number(item.fit) || 0))
    if (fit <= 0) continue  // drop non-matches — no padding
    const durationSec = clampDuration(item.durationSec)
    out.push({
      presetId: item.presetId as ActionPresetId,
      matchCount: 0,
      matchedBlocks: anchor ? [anchor] : [],
      matchedKeywords: [],
      anchorBlock: anchor,
      confidence: fit,
      reason: typeof item.reason === 'string' ? item.reason : undefined,
      conceptPrompt: isConcept ? conceptPrompt : undefined,
      durationSec,
    })
  }
  // Keep the director's ORDER (narrative sequence), not a fit sort — scenes
  // should play in script order. Cap to budget.
  return out.slice(0, params.budget)
}

function clampDuration(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return 4
  return Math.max(3, Math.min(7, Math.round(n * 10) / 10))
}

interface RawDirectorScene {
  presetId: string
  anchorBlock: string
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
