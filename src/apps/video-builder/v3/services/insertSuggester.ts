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
