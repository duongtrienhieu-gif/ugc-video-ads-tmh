// ── B-roll Director (HYBRID mode) ────────────────────────────────────────────
// The NEW director for the hybrid rebuild. Unlike the frozen mode-1 director
// (directScenesWithGemini), there is NO continuous talking-head base: the whole
// ${dur}s voice is covered by a SEQUENCE of full-screen cuts —
//   • a few short LIPS cuts (the creator on camera, lip-synced to that span),
//   • B-ROLL cuts (product-in-use / close-up / concept, often no-face),
//   • 3D MECHANISM cuts (how it works inside),
// plus 0-credit STICKER pops for short text/number callouts (replacing overlays).
//
// Design (per the agreed plan):
//   • COVER 100% of the timeline — every spoken line gets a visual, NO gaps.
//   • LIPS placement: a fixed count by length (3/<50s, 4/<60s, 5/<70s), the FIRST
//     within the opening third (so the hook is a face — never a 19s empty open),
//     then spread (a mid beat + the CTA) to keep the creator's trust-thread.
//   • NO overlays, NO hand-drawn graphics — callouts become stickers (incl. LIST).
//   • KEEP 3D mechanism.
//   • Universal: the setting/usage is INFERRED from the product context, never
//     hardcoded per niche.
//
// REUSE (read-only import, not modified): buildProductContextBlock,
// detectProductNiche from insertSuggester. The mode-1 director is NOT touched.
// This module is plan-only — it does NOT render; the assembler/render is Phase 3.
// ─────────────────────────────────────────────────────────────────────────────

import { directGeminiText } from '../../../../utils/gemini'
import { SCRIPT_LANG_GEMINI_NAME } from '../types'
import type { GeneratedScript, ScriptLang, CameraFraming } from '../types'
import type { Product } from '../../../../stores/types'
import { buildProductContextBlock } from './insertSuggester'

// ── Output types ────────────────────────────────────────────────────────────

export type BrollSceneRole = 'lips' | 'broll' | 'mechanism3d'
export type BrollSceneKind = 'product_action' | 'product_closeup' | 'concept'

export interface BrollScene {
  /** lips = creator on camera (lip-synced); broll = product/concept cut;
   *  mechanism3d = clean 3D internal animation. */
  role: BrollSceneRole
  /** The verbatim spoken line this cut covers (anchor — drives voice sync). */
  quote: string
  /** Cut length (3-6s, flexible for pacing). */
  durationSec: number
  /** broll/3d only — the vivid English visual prompt (action + setting). */
  conceptPrompt?: string
  /** broll only — face vs no-face framing (reused from the D1-D3 capability). */
  cameraFraming?: CameraFraming
  /** broll only — which kind of B-roll shot. */
  kind?: BrollSceneKind
  /** one short phrase explaining the choice (debug / UI). */
  reason?: string
}

export interface BrollSticker {
  style: string
  /** single-line callout (when not a list) */
  text?: string
  /** LIST sticker — multiple stacked items (replaces the old multi-row overlay). */
  items?: string[]
  /** the spoken line this sticker rides on */
  quote: string
  /** the word within the quote to pop on */
  wordAnchor?: string
}

export interface BrollDirectorResult {
  scenes: BrollScene[]
  stickers: BrollSticker[]
}

export interface BrollDirectorParams {
  geminiKey: string
  script: GeneratedScript
  lang: ScriptLang
  product?: Product | null
  /** Real measured voice duration (preferred) — the timeline length to cover. */
  voiceDurationSec: number
}

// ── Lips count ladder (user spec — NOT a niche hardcode) ────────────────────
function lipsCountForDuration(sec: number): number {
  if (sec < 50) return 3
  if (sec < 60) return 4
  if (sec < 70) return 5
  return 6
}

// ── Gemini response schema ──────────────────────────────────────────────────
const BROLL_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          role:          { type: 'string', enum: ['lips', 'broll', 'mechanism3d'] },
          quote:         { type: 'string', maxLength: 200 },
          durationSec:   { type: 'number' },
          conceptPrompt: { type: 'string', maxLength: 240 },
          cameraFraming: { type: 'string', enum: ['creator', 'hands_noface'] },
          kind:          { type: 'string', enum: ['product_action', 'product_closeup', 'concept'] },
          reason:        { type: 'string', maxLength: 80 },
        },
        required: ['role', 'quote', 'durationSec'],
      },
    },
    stickers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          style:      { type: 'string', enum: ['number', 'countdown', 'pill', 'flag', 'badge', 'warning', 'price', 'highlight', 'arrow', 'list'] },
          text:       { type: 'string', maxLength: 24 },
          items:      { type: 'array', items: { type: 'string', maxLength: 24 } },
          quote:      { type: 'string', maxLength: 200 },
          wordAnchor: { type: 'string', maxLength: 40 },
        },
        required: ['style', 'quote'],
      },
    },
  },
  required: ['scenes'],
}

// ── Public: plan a full-coverage hybrid shot list ───────────────────────────
export async function directBrollScenes(
  params: BrollDirectorParams,
): Promise<BrollDirectorResult> {
  const langName = SCRIPT_LANG_GEMINI_NAME[params.lang]
  const dur = Math.round(params.voiceDurationSec || params.script.totalDurationSec || 50)
  const lipsCount = lipsCountForDuration(dur)
  const productContext = buildProductContextBlock(params.product)
  const scriptDump = params.script.blocks.map((b) => `[${b.id}] ${b.text}`).join('\n')

  const systemInstruction = `You are a senior UGC ad video DIRECTOR cutting a ${dur}-second TikTok ad written
in ${langName}. There is NO continuous talking-head — you build the WHOLE video as
a SEQUENCE of full-screen cuts that together COVER EVERY SECOND of the voice, with
NO gaps and no dead air. Read the actual script + the product, and direct like a
real creator. The product can be ANYTHING (gadget, tool, cosmetic, food, apparel,
appliance, accessory…) — never assume a niche.${productContext}

THREE cut ROLES (set "role"):
1. "lips" — the creator ON CAMERA saying a specific line (face visible, will be
   lip-synced to that exact voice span). Give the "quote" (verbatim spoken line)
   + durationSec (~3-5s). NO conceptPrompt needed.
   *** Use EXACTLY ${lipsCount} lips cuts. The FIRST lips cut MUST be the opening
   HOOK and sit in the FIRST THIRD of the video (the viewer must see a real face
   in the first ~3s or they scroll). Then SPREAD the rest — a mid beat and the
   CTA close — so the creator's face re-appears and carries the trust thread. ***
2. "broll" — a full-screen product/concept cut, usually NO face. Write a vivid
   "conceptPrompt" (one English sentence: action + real-world SETTING) and set:
     • "kind": "product_action" (the product being USED — infer WHERE/HOW from the
       product's usageGuide/description, put it in its real setting), or
       "product_closeup" (a clean close-up showing a feature/the product itself),
       or "concept" (no product — a feeling / problem / ingredient / proof).
     • "cameraFraming": "hands_noface" (only hands + product in its setting, NO
       face — use GENEROUSLY for usage/demo) or "creator" (a person/reaction).
   The setting is INFERRED, never hardcoded — examples across niches: seasoning →
   hands sprinkling over food in a kitchen; tyre inflator → pumping a tyre at the
   roadside; serum → dabbed on at a bathroom mirror; watch → on a wrist; seeds →
   scattered onto garden soil; perfume → sprayed on the wrist. Read THIS product.
3. "mechanism3d" — for a line describing a process INSIDE the product/body a phone
   can't film (an ingredient acting inside, airflow inside a device, a coating at
   molecular level…). Write the conceptPrompt; it renders as a clean 3D animation.

STICKERS (separate array — 0-credit text pops that ride on a cut, REPLACING the
old overlays). For short callouts the voice names — a number/spec/claim — emit a
sticker on that line:
  • single callout → {style:"number"|"price"|"badge"|…, text, quote, wordAnchor}.
  • a line listing SEVERAL specs/claims (e.g. "20000mAh, 4 hours, 30 min") → ONE
    {style:"list", items:["20000mAh","4 tiếng","30 phút"], quote} — stacked card.
  Stickers carry the info the old hand-drawn overlays used to; do NOT make overlay
  scenes. Keep sticker text in ${langName}.

RULES:
- COVER 100%: the scenes' durations sum to ~${dur}s; every spoken beat has a cut;
  NO empty span. Group sentences about the SAME idea into one cut; don't over-cut.
- DURATIONS are flexible 3-6s (vary them for rhythm — don't lock every cut to 4s).
- Each scene's "quote" MUST be text that actually appears in the script.
- VARIETY: mix lips + no-face hands-action + product close-ups + (some) 3D, so the
  ad feels like a real hand-held review, not a slideshow or a single locked shot.
- The CTA close should be a "lips" cut (creator endorsing) when the script has one.
- Universal: infer setting/usage from the product context; never hardcode a niche.

SCRIPT (cover all of it):
${scriptDump}

OUTPUT strict JSON only (no markdown fences):
{ "scenes": [ {"role":"lips","quote":"…","durationSec":4}, {"role":"broll","quote":"…","durationSec":5,"kind":"product_action","cameraFraming":"hands_noface","conceptPrompt":"…"} ], "stickers": [ {"style":"list","items":["…","…"],"quote":"…"} ] }`

  const call = (schema = true) =>
    directGeminiText({
      apiKey: params.geminiKey,
      systemInstruction,
      prompt: 'Plan the full-coverage hybrid shot list now. Return the JSON.',
      maxOutputTokens: 4096,
      temperature: 0.6,
      thinkingBudget: 0,   // structured JSON — keep the whole list, no truncation
      responseMimeType: 'application/json',
      ...(schema ? { responseSchema: BROLL_RESPONSE_SCHEMA } : {}),
    })

  let raw = await call()
  let parsed = tryParse(raw)
  if (!parsed) { raw = await call(false); parsed = tryParse(raw) }
  if (!parsed) {
    throw new Error('Director (hybrid) trả về JSON không đọc được. Thử lại.')
  }

  // Enforce the lips ladder DETERMINISTICALLY — the prompt asks for exactly N but
  // Gemini sometimes returns fewer; promote evenly-spread broll cuts to lips to hit N.
  const scenes = enforceLipsCount(sanitizeScenes(parsed.scenes), lipsCount)
  const stickers = sanitizeStickers(parsed.stickers)

  const coveredSec = scenes.reduce((s, x) => s + x.durationSec, 0)
  const lipsScenes = scenes.filter((s) => s.role === 'lips')
  // eslint-disable-next-line no-console
  console.log(
    `[BROLL_DIRECTOR] dur=${dur}s scenes=${scenes.length} covered≈${coveredSec.toFixed(0)}s ` +
    `lips=${lipsScenes.length}/${lipsCount} broll=${scenes.filter((s) => s.role === 'broll').length} ` +
    `3d=${scenes.filter((s) => s.role === 'mechanism3d').length} ` +
    `noface=${scenes.filter((s) => s.cameraFraming === 'hands_noface').length} stickers=${stickers.length}`,
  )
  return { scenes, stickers }
}

// ── Parse + sanitize ────────────────────────────────────────────────────────

interface RawScene {
  role?: string; quote?: string; durationSec?: number
  conceptPrompt?: string; cameraFraming?: string; kind?: string; reason?: string
}
interface RawSticker {
  style?: string; text?: string; items?: unknown; quote?: string; wordAnchor?: string
}

function tryParse(raw: string): { scenes?: RawScene[]; stickers?: RawSticker[] } | null {
  let s = raw.trim()
  if (s.startsWith('```')) s = s.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()
  try {
    const obj = JSON.parse(s)
    if (obj && typeof obj === 'object' && Array.isArray(obj.scenes)) return obj
  } catch { /* fall through */ }
  return null
}

const SCENE_ROLES: BrollSceneRole[] = ['lips', 'broll', 'mechanism3d']
const SCENE_KINDS: BrollSceneKind[] = ['product_action', 'product_closeup', 'concept']

// Guarantee the lips ladder: if fewer "lips" than `target`, convert the broll cuts
// sitting in the LARGEST gaps between existing lips into lips, so the creator's face
// re-appears at evenly-spread points (hook + middle(s) + CTA). Never drops below the
// model's choice; only tops up. If there are MORE lips than target, leaves them.
function enforceLipsCount(scenes: BrollScene[], target: number): BrollScene[] {
  const lipsIdx = scenes.map((s, i) => (s.role === 'lips' ? i : -1)).filter((i) => i >= 0)
  if (lipsIdx.length >= target) return scenes
  const brollIdx = scenes.map((s, i) => (s.role === 'broll' ? i : -1)).filter((i) => i >= 0)
  const need = target - lipsIdx.length
  const chosen: number[] = []
  const n = scenes.length
  for (let k = 0; k < need; k++) {
    const occupied = [...lipsIdx, ...chosen].sort((a, b) => a - b)
    const bounds = [-1, ...occupied, n]
    let gapMid = 0, gapSize = -1
    for (let g = 0; g < bounds.length - 1; g++) {
      const size = bounds[g + 1] - bounds[g]
      if (size > gapSize) { gapSize = size; gapMid = Math.round((bounds[g] + bounds[g + 1]) / 2) }
    }
    const cand = brollIdx.filter((i) => !chosen.includes(i))
    if (cand.length === 0) break
    cand.sort((a, b) => Math.abs(a - gapMid) - Math.abs(b - gapMid))
    chosen.push(cand[0])
  }
  for (const i of chosen) {
    scenes[i] = {
      role: 'lips',
      quote: scenes[i].quote,
      durationSec: scenes[i].durationSec,
      reason: 'promoted to lips (enforce ladder)',
    }
  }
  return scenes
}

function sanitizeScenes(raw: RawScene[] | undefined): BrollScene[] {
  if (!Array.isArray(raw)) return []
  const out: BrollScene[] = []
  for (const r of raw) {
    const role = SCENE_ROLES.includes(r.role as BrollSceneRole) ? (r.role as BrollSceneRole) : 'broll'
    const quote = typeof r.quote === 'string' ? r.quote.trim() : ''
    if (!quote) continue
    const durationSec = Math.max(2, Math.min(6, Number(r.durationSec) || 4))
    const scene: BrollScene = { role, quote, durationSec }
    if (role !== 'lips') {
      scene.conceptPrompt = typeof r.conceptPrompt === 'string' ? r.conceptPrompt.trim() : ''
      // No-face only makes sense for a real product-action cut; otherwise creator.
      scene.kind = SCENE_KINDS.includes(r.kind as BrollSceneKind) ? (r.kind as BrollSceneKind) : 'product_action'
      const wantsNoFace = r.cameraFraming === 'hands_noface'
      scene.cameraFraming = wantsNoFace && role === 'broll' && scene.kind !== 'concept' ? 'hands_noface' : 'creator'
    }
    scene.reason = typeof r.reason === 'string' ? r.reason : undefined
    out.push(scene)
  }
  return out
}

function sanitizeStickers(raw: RawSticker[] | undefined): BrollSticker[] {
  if (!Array.isArray(raw)) return []
  const out: BrollSticker[] = []
  for (const r of raw) {
    const quote = typeof r.quote === 'string' ? r.quote.trim() : ''
    if (!quote) continue
    const items = Array.isArray(r.items)
      ? (r.items as unknown[]).map((x) => String(x).trim()).filter((x) => x.length > 0 && x.length <= 24).slice(0, 4)
      : []
    const text = typeof r.text === 'string' ? r.text.trim() : ''
    if (items.length === 0 && !text) continue
    out.push({
      style: typeof r.style === 'string' ? r.style : 'highlight',
      ...(items.length > 0 ? { items } : { text }),
      quote,
      wordAnchor: typeof r.wordAnchor === 'string' ? r.wordAnchor.trim() : undefined,
    })
  }
  return out
}
