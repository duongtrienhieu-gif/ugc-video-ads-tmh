// ── Scene conceptPrompt fixer (P6a) ──────────────────────────────────────────
// A surgical, per-scene "thợ sửa prompt": when the director got ONE scene wrong
// (a generic/macro shot on an emotion line, a duplicate, the wrong framing…), this
// rewrites JUST that scene's render plan — WITHOUT re-running the whole director
// (so the other good scenes are never re-rolled). It is NOT a chatbot: its single
// job is to return a corrected { conceptPrompt, kind, cameraFraming } for ONE scene.
//
// Why it can succeed where the director "ngu": the director only had the FACTS
// (the line + product + script) and inferred wrong. This call adds the one signal
// the director never had — the USER'S INTENT (what they actually wanted) — plus the
// director's BAD prompt as a negative example ("you did this, it's wrong"). The three
// fields come from ONE model call so they are internally consistent — the chosen
// cameraFraming always matches the prompt (a 'creator' fix never says "no person"),
// which is the exact contradiction that breaks renders. Universal VN/MY/EN, no niche.
// ─────────────────────────────────────────────────────────────────────────────

import { directGeminiText } from '../../../../utils/gemini'
import { buildProductContextBlock } from './insertSuggester'
import { SCRIPT_LANG_GEMINI_NAME } from '../types'
import type { TimedBrollScene, BrollSceneKind } from './brollDirector'
import type { Product } from '../../../../stores/types'
import type { ScriptLang, GeneratedScript } from '../types'

export interface SceneFix {
  conceptPrompt: string
  kind: BrollSceneKind
  cameraFraming: 'creator' | 'hands_noface'
}

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    conceptPrompt: { type: 'string' },
    kind:          { type: 'string', enum: ['product_action', 'product_closeup', 'concept'] },
    cameraFraming: { type: 'string', enum: ['creator', 'hands_noface'] },
  },
  required: ['conceptPrompt', 'kind', 'cameraFraming'],
}

const SYSTEM = (langName: string) =>
`You are a single-purpose SCENE FIXER for a vertical 9:16 UGC ad video. You are NOT a
chatbot — you do ONE thing: rewrite the render plan for ONE scene that the auto-director
got wrong, and return ONLY the JSON { conceptPrompt, kind, cameraFraming }. No chatter.

The director only had the facts and inferred a shot the user did NOT want. You are given
the line, the director's WRONG plan (a negative example — do NOT reproduce its mistake),
the product, and the USER'S INTENT — the user's intent is the ground truth of what this
scene must show. Honor it above all.

HARD RULES (the output must obey ALL — these match the renderer, breaking them breaks the clip):
1. The shot MUST illustrate the EXACT spoken line of THIS scene — concrete + filmable, never generic.
2. person vs no-person MUST match the cameraFraming you choose, with NO contradiction:
   • cameraFraming:"creator" → a PERSON is in frame. It is the SAME creator as the avatar
     reference — NEVER describe their gender / age / ethnicity / face; just what they DO + feel.
   • cameraFraming:"hands_noface" → hands-only product-in-use, NO face, NO head, NO full person.
3. kind decides the shot family — pick the one that fits the line:
   • "concept" — NO product packaging on screen; a feeling / desire / fear / hesitation /
     objection / reaction / a real-life moment. An emotion/desire/fear line is ALWAYS this
     (creator living the feeling), NEVER a product macro. concept almost always pairs with
     cameraFraming:"creator".
   • "product_action" — the product being USED in its real setting (the backbone).
   • "product_closeup" — a clean macro of the product / a texture / a feature / a result.
4. NEVER describe the packaging's appearance (color/shape/tube-bottle-jar/label text) and
   NEVER invent a package — the real product image is the lock.
5. NEVER mention a price / money / discount, and NEVER invent a cert, a % or a number.
6. The conceptPrompt MUST specify: SHOT TYPE + the concrete ACTION + WHICH PART is in frame
   + the real-world SETTING. One single shot, vivid, ≤ ~240 characters. Write it in ENGLISH
   (it is the literal instruction the image/video model renders), even though the spoken
   line is in ${langName}.

Output STRICT JSON only.`

/** Rewrite ONE scene's render plan from the user's intent + the director's bad plan as a
 *  negative example. Returns a self-consistent { conceptPrompt, kind, cameraFraming }.
 *  Throws on failure (no key / Gemini / parse) so the caller can surface it. */
export async function fixSceneConceptPrompt(params: {
  geminiKey: string
  scene: TimedBrollScene
  product?: Product | null
  lang: ScriptLang
  fullScript?: GeneratedScript | null
  /** Chips + free-text combined — what the user wants / what's wrong. May be empty. */
  userIntent: string
}): Promise<SceneFix> {
  if (!params.geminiKey) throw new Error('Thiếu Gemini key')
  const langName = SCRIPT_LANG_GEMINI_NAME[params.lang] ?? 'Vietnamese'
  const s = params.scene
  const productContext = buildProductContextBlock(params.product)
  const scriptDump = params.fullScript?.blocks?.length
    ? params.fullScript.blocks.map((b) => b.text).join(' / ').slice(0, 600)
    : ''
  const intent = params.userIntent.trim()

  const userMsg =
`THIS SCENE'S SPOKEN LINE (${langName}): "${s.quote ?? ''}"

DIRECTOR'S CURRENT PLAN — this is WRONG, do NOT reproduce it:
- conceptPrompt: ${s.conceptPrompt?.trim() || '(empty)'}
- kind: ${s.kind ?? '(none)'}
- cameraFraming: ${s.cameraFraming ?? '(none)'}

USER'S INTENT (the ground truth — what this scene must become):
${intent || '(none given — infer the most fitting correct shot for the line; if the current plan is a product macro on a feeling/desire/fear line, switch it to a creator emotion moment)'}
${productContext}
${scriptDump ? `\nFULL VOICEOVER (context only — for the scene's role in the arc):\n${scriptDump}` : ''}

Return the corrected { conceptPrompt, kind, cameraFraming } as JSON now.`

  const raw = await directGeminiText({
    apiKey: params.geminiKey,
    prompt: userMsg,
    systemInstruction: SYSTEM(langName),
    responseMimeType: 'application/json',
    responseSchema: FIX_SCHEMA,
    maxOutputTokens: 512,
    temperature: 0.7,
    thinkingBudget: 0,
  })
  const fix = JSON.parse(raw) as Partial<SceneFix>
  const conceptPrompt = (fix.conceptPrompt ?? '').trim()
  if (!conceptPrompt) throw new Error('AI trả về prompt rỗng — thử lại')
  const kind: BrollSceneKind = (['product_action', 'product_closeup', 'concept'] as const)
    .includes(fix.kind as BrollSceneKind) ? (fix.kind as BrollSceneKind) : 'product_action'
  const cameraFraming: 'creator' | 'hands_noface' = fix.cameraFraming === 'hands_noface' ? 'hands_noface' : 'creator'
  // Safety net (same invariant the director uses): a concept shot is never face-less here —
  // a feeling/reaction needs the person. Keep the two fields from ever contradicting.
  return { conceptPrompt, kind, cameraFraming: kind === 'concept' ? 'creator' : cameraFraming }
}
