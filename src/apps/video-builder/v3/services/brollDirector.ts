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
import type { GeneratedScript, ScriptLang, CameraFraming, VoiceAlignment } from '../types'
import type { Product } from '../../../../stores/types'
import { buildProductContextBlock } from './insertSuggester'
import { computeQuoteTimestampFromAlignment, computeQuoteTimestamp } from './insertTimingEngine'

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

// ── Density floor (deterministic) ───────────────────────────────────────────
// Gemini is non-deterministic about scene COUNT: the same script can come back
// as 8 sparse cuts one run and 14 the next. A sparse plan stretched over the
// whole voice yields long, flat ~6s holds that feel slow. We enforce a minimum
// cut density two ways: (1) RE-ROLL the director ONCE if the first plan is sparse,
// and (2) a hard post-timing floor that splits the LONGEST cuts until the floor
// is met — splitting longest-first keeps the short snappy cuts intact (variety),
// never a uniform metronome. ~4.5s/cut → a 55s ad floors at ~12 cuts.
const TARGET_AVG_CUT_SEC = 4.5
function densityFloor(dur: number): number {
  return Math.max(8, Math.round(dur / TARGET_AVG_CUT_SEC))
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
  const minScenes = densityFloor(dur)
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
old overlays). Be GENEROUS — stickers are FREE and do NOT compete with the cuts,
so pop one on EVERY beat where the voice names something concrete: a number, a
spec, a measurement, a feature, a benefit, a time, a price, a discount, a free
gift, a safety/result claim. Cover MOST such moments, not just two or three — a
spec/feature-heavy product (gadget, tool, appliance) should get MANY stickers; an
emotional/abstract script naturally gets fewer. Scale to what THIS script actually
names — never pad with vague stickers, but never leave a concrete callout bare.
  • single callout → {style:"number"|"price"|"badge"|"countdown"|…, text:"2kg" /
    "tự ngắt" / "mấy giây", quote, wordAnchor}. Prepend a fitting emoji to text.
  • a line listing SEVERAL specs/claims (e.g. "20000mAh, 4 hours, 30 min", or
    "tiết kiệm thời gian, không cần trạm xăng") → ONE {style:"list", items:["🔋
    20000mAh","⏱ 4 tiếng","⚡ 30 phút"], quote} — a stacked card (each item may
    start with its own emoji).
  Stickers carry the info the old hand-drawn overlays used to; do NOT make overlay
  scenes. Keep ALL sticker text in ${langName}.

RULES:
- COVER 100%: the scenes' durations sum to ~${dur}s; every spoken beat has a cut;
  NO empty span. Give each DISTINCT beat its OWN cut with its OWN visual — only merge
  sentences that are truly one single thought; lean toward MORE distinct cuts, not fewer.
- PACING — vary cut LENGTH by PURPOSE so the ad has rhythm, NEVER a flat ~4s
  metronome (consecutive cuts must NOT be the same length):
    • SHORT punchy cuts (2-3s): the hook, a quick callout, a rapid run of feature/
      use-case shots, a snappy reaction — keep the open and the listy parts FAST.
    • MEDIUM (3-4s): most supporting B-roll and transitions.
    • LONGER holds (4-6s): the main product demo / usage moment, a satisfying
      reveal or result, the CTA close — let these breathe.
  Aim for a mix (e.g. fast-fast-slow), not uniform durations. NO single cut may
  cover more than ~6s of voice — if a stretch of the script runs longer, SPLIT it
  into MORE scenes (more cuts) instead of one long shot. LIPS cuts stay 4-5s. Make
  ENOUGH scenes that the voice is densely covered — for THIS ${dur}s video return AT
  LEAST ${minScenes} distinct cuts (each a DIFFERENT visual grounded in a real line,
  never a repeat or vague filler to pad the count).
- Each scene's "quote" MUST be text that actually appears in the script.
- VARIETY: mix lips + no-face hands-action + product close-ups + (some) 3D, so the
  ad feels like a real hand-held review, not a slideshow or a single locked shot.
- The CTA close should be a "lips" cut (creator endorsing) when the script has one.
- Universal: infer setting/usage from the product context; never hardcode a niche.

SCRIPT (cover all of it):
${scriptDump}

OUTPUT strict JSON only (no markdown fences):
{ "scenes": [ {"role":"lips","quote":"…","durationSec":4}, {"role":"broll","quote":"…","durationSec":5,"kind":"product_action","cameraFraming":"hands_noface","conceptPrompt":"…"} ], "stickers": [ {"style":"list","items":["…","…"],"quote":"…"} ] }`

  const call = (schema = true, denserHint?: { have: number; want: number }) =>
    directGeminiText({
      apiKey: params.geminiKey,
      systemInstruction,
      prompt: denserHint
        ? `Your last plan had only ${denserHint.have} cuts for a ${dur}s video — too sparse; you GROUPED several lines into long cuts. Re-plan with at least ${denserHint.want} cuts: give EACH distinct line/beat its OWN cut with its OWN visual (a new action, angle, or detail grounded in that exact line) — do NOT pad with repeats or vague filler. Keep the hook / callouts / feature runs as fast 2-3s cuts; only the main demo / reveal / CTA breathe at 4-6s. Cover every second. Return the JSON.`
        : 'Plan the full-coverage hybrid shot list now. Return the JSON.',
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
  let scenes = enforceLipsCount(sanitizeScenes(parsed.scenes), lipsCount)

  // Density floor (1/2) — REAL content density comes from the DIRECTOR, not from
  // mechanically cutting one cut in half. If the plan is sparse, re-roll (up to 2×)
  // asking it to give each distinct line its OWN grounded visual; keep whichever
  // roll has the most scenes. The mechanical floor in assignSceneTiming is only the
  // last-resort backstop and should rarely fire once the director cooperates.
  for (let attempt = 1; attempt <= 2 && scenes.length < minScenes; attempt++) {
    // eslint-disable-next-line no-console
    console.log(`[BROLL_DIRECTOR] plan thưa (${scenes.length}<${minScenes}) — re-roll ${attempt}/2 cho cảnh riêng, dày hơn`)
    const raw2 = await call(true, { have: scenes.length, want: minScenes })
    const parsed2 = tryParse(raw2)
    if (parsed2) {
      const scenes2 = enforceLipsCount(sanitizeScenes(parsed2.scenes), lipsCount)
      if (scenes2.length > scenes.length) { scenes = scenes2; parsed = parsed2 }
    }
  }
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

// ── P3a — Scene timing (derive the REAL timeline from the voice) ────────────
// The director's per-scene durationSec is only a HINT; the real timeline comes
// from WHERE each scene's quote is actually spoken. We locate each quote in the
// voice (real word-alignment first, estimate fallback), then each scene spans
// [its anchor .. the next scene's anchor], so the cuts cover the voice EXACTLY
// (sum = voiceDurationSec, no gaps, no hang past the voice). Unanchored scenes
// (quote not locatable) are interpolated between their anchored neighbours.

export interface TimedBrollScene extends BrollScene {
  startSec: number
  endSec: number
}

const round2 = (x: number) => Math.round(x * 100) / 100

export function assignSceneTiming(
  scenes: BrollScene[],
  alignment: VoiceAlignment | null | undefined,
  script: GeneratedScript,
  voiceDurationSec: number,
): TimedBrollScene[] {
  const n = scenes.length
  if (n === 0) return []
  const dur = Math.max(1, voiceDurationSec)

  // 1. Locate each scene's quote → raw anchor second (null if not locatable).
  const raw: (number | null)[] = scenes.map((s) => {
    const t = alignment ? computeQuoteTimestampFromAlignment(alignment, s.quote) : null
    return t !== null ? t : computeQuoteTimestamp(script, s.quote)
  })

  // 2. Collect KNOWN anchors (monotonic, clamped) + virtual ends at 0 and dur.
  const known: { idx: number; t: number }[] = [{ idx: -1, t: 0 }]
  for (let i = 0; i < n; i++) {
    if (raw[i] !== null) {
      const t = Math.max(known[known.length - 1].t, Math.min(dur, Math.max(0, raw[i]!)))
      known.push({ idx: i, t })
    }
  }
  known.push({ idx: n, t: dur })

  // 3. Start second per scene — anchored scenes keep their anchor; the runs of
  //    unanchored scenes between two anchors are spread evenly.
  const starts = new Array<number>(n).fill(0)
  for (let k = 0; k < known.length - 1; k++) {
    const a = known[k]
    const b = known[k + 1]
    if (a.idx >= 0 && a.idx < n) starts[a.idx] = a.t
    for (let i = a.idx + 1; i < b.idx; i++) {
      starts[i] = a.t + ((b.t - a.t) * (i - a.idx)) / (b.idx - a.idx)
    }
  }
  starts[0] = 0  // the first cut always opens the video

  // 4. Build spans: scene i runs until the next scene's start (last → dur).
  const out: TimedBrollScene[] = []
  for (let i = 0; i < n; i++) {
    const startSec = round2(starts[i])
    const rawEnd = i < n - 1 ? starts[i + 1] : dur
    const endSec = round2(Math.max(startSec + 0.2, rawEnd))
    out.push({ ...scenes[i], startSec, endSec })
  }
  return enforceDensityFloor(capSplitScenes(out), densityFloor(dur))
}

// Hard cut-length caps (deterministic — independent of how many scenes the model
// returned). A sparse plan stretched to fill the voice can otherwise produce a 12s
// monster cut. LIPS are kept to 4-5s (a talking-head shouldn't hold longer); the
// overflow voice becomes a product close-up B-roll (cheaper + more dynamic than a
// 2nd lipsync). B-ROLL longer than the cap is split into equal sub-cuts.
const MAX_LIPS_SEC = 5
const MAX_BROLL_SEC = 6.5
const MIN_CUT_SEC = 1.5

function capSplitScenes(timed: TimedBrollScene[]): TimedBrollScene[] {
  const out: TimedBrollScene[] = []
  // Fill [start,end] with product-closeup B-roll cut(s), each ≤ MAX_BROLL_SEC.
  const fillBroll = (start: number, end: number, quote: string) => {
    const L = end - start
    if (L < MIN_CUT_SEC) {
      // Too small for its own cut — extend the PREVIOUS cut, but NEVER a lips cut
      // (that would push the lips past its hard cap). Absorb into the last broll if
      // there is one; otherwise emit a short broll rather than violate the lips cap.
      const last = out[out.length - 1]
      if (last && last.role !== 'lips') {
        last.endSec = round2(end); last.durationSec = round2(end - last.startSec)
      } else {
        out.push({ role: 'broll', kind: 'product_closeup', quote, conceptPrompt: '', durationSec: round2(L), startSec: round2(start), endSec: round2(end) })
      }
      return
    }
    const parts = Math.max(1, Math.ceil(L / MAX_BROLL_SEC))
    const step = L / parts
    for (let k = 0; k < parts; k++) {
      const a = round2(start + k * step)
      const b = round2(k === parts - 1 ? end : start + (k + 1) * step)
      out.push({ role: 'broll', kind: 'product_closeup', quote, conceptPrompt: '', durationSec: round2(b - a), startSec: a, endSec: b })
    }
  }
  for (const s of timed) {
    const L = s.endSec - s.startSec
    if (s.role === 'lips') {
      if (L <= MAX_LIPS_SEC + 0.4) { out.push(s); continue }
      // Hard-cap the lips ABSOLUTELY: cut it at MAX_LIPS_SEC, but pull the cut a
      // touch earlier when needed so the overflow is ≥ MIN_CUT — that way the
      // leftover always becomes its own broll and we never extend the lips past 5s.
      const lipsEnd = round2(Math.min(s.startSec + MAX_LIPS_SEC, s.endSec - MIN_CUT_SEC))
      out.push({ ...s, endSec: lipsEnd, durationSec: round2(lipsEnd - s.startSec) })
      fillBroll(lipsEnd, s.endSec, s.quote)  // overflow → product close-up
    } else {
      if (L <= MAX_BROLL_SEC + 0.4) { out.push(s); continue }
      const parts = Math.ceil(L / MAX_BROLL_SEC)
      const step = L / parts
      for (let k = 0; k < parts; k++) {
        const a = round2(s.startSec + k * step)
        const b = round2(k === parts - 1 ? s.endSec : s.startSec + (k + 1) * step)
        out.push({
          ...s, startSec: a, endSec: b, durationSec: round2(b - a),
          conceptPrompt: k > 0 && s.conceptPrompt ? `${s.conceptPrompt} (a slightly different angle / closer)` : s.conceptPrompt,
        })
      }
    }
  }
  return out
}

// Density floor (2/2) — the deterministic backstop. After capping, if the plan is
// still below `minScenes` (a stubborn-sparse director that the re-roll didn't fix),
// split the LONGEST cut in half, repeatedly, until the floor is met. Splitting
// longest-first preserves the short snappy cuts (variety) instead of chopping
// everything to a uniform ~4s metronome. A long lips splits into lips + a
// product-closeup broll (keep one face beat, don't make two lipsync renders).
function enforceDensityFloor(scenes: TimedBrollScene[], minScenes: number): TimedBrollScene[] {
  const out = scenes.slice()
  let guard = 0
  let split = 0
  while (out.length < minScenes && guard++ < 64) {
    let li = -1
    let lLen = 2 * MIN_CUT_SEC   // only split cuts that yield two ≥ MIN_CUT halves
    for (let i = 0; i < out.length; i++) {
      const L = out[i].endSec - out[i].startSec
      if (L > lLen) { lLen = L; li = i }
    }
    if (li < 0) break   // nothing long enough to split — accept the current density
    const s = out[li]
    const mid = round2(s.startSec + (s.endSec - s.startSec) / 2)
    const first: TimedBrollScene = { ...s, endSec: mid, durationSec: round2(mid - s.startSec) }
    const second: TimedBrollScene = s.role === 'lips'
      ? { role: 'broll', kind: 'product_closeup', quote: s.quote, conceptPrompt: '', startSec: mid, endSec: s.endSec, durationSec: round2(s.endSec - mid) }
      : { ...s, startSec: mid, durationSec: round2(s.endSec - mid),
          conceptPrompt: s.conceptPrompt ? `${s.conceptPrompt} (a slightly different angle / closer)` : s.conceptPrompt }
    out.splice(li, 1, first, second)
    split++
  }
  if (split > 0) {
    // eslint-disable-next-line no-console
    console.log(`[BROLL_DIRECTOR] density floor: chẻ ${split} cảnh dài → tổng ${out.length} cảnh (sàn ${minScenes})`)
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
