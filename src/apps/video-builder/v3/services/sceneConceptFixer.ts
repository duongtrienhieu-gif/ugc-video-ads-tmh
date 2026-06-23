// ── Scene conceptPrompt fixer (P6a → P6t) ────────────────────────────────────
// A surgical, per-scene "thợ sửa": when the director got ONE scene wrong (mis-tagged
// archetype, a generic shot on an emotion line, a duplicate, wrong framing…), this
// rewrites JUST that scene's render plan — WITHOUT re-running the whole director (the
// other good scenes are never re-rolled). It is NOT a chatbot: its single job is to
// return a corrected, self-consistent { shotIntent, conceptPrompt, kind, cameraFraming }.
//
// P6t — UNIFIED ON THE SPINE: the fixer now speaks the SAME vocabulary as the director —
// `shotIntent`. The user picks the right archetype (the director's own 10) and/or types an
// intent; the fixer re-declares shotIntent + derives a consistent shot from it (mirroring
// the director's P2 archetype→shot mapping), and RETURNS shotIntent so the scene stays on
// the trục (the displayed tag never lies again). Universal VN/MY/EN, no niche.
// ─────────────────────────────────────────────────────────────────────────────

import { directGeminiText } from '../../../../utils/gemini'
import { buildProductContextBlock } from './insertSuggester'
import { SCRIPT_LANG_GEMINI_NAME } from '../types'
import type { TimedBrollScene, BrollSceneKind, ShotIntent } from './brollDirector'
import { SHOT_INTENTS } from './brollDirector'
import type { Product } from '../../../../stores/types'
import type { ScriptLang, GeneratedScript } from '../types'

export interface SceneFix {
  conceptPrompt: string
  kind: BrollSceneKind
  cameraFraming: 'creator' | 'hands_noface'
  shotIntent: ShotIntent
}

// Mirrors the director's P2 archetype→shot mapping so a MANUAL fix lands on the SAME spine
// the auto-director uses (one brain, not a second taxonomy). Framing here is the default the
// archetype implies; the model may still describe the action, but these win on contradiction.
const INTENT_DEFAULT: Record<ShotIntent, { kind: BrollSceneKind; cameraFraming: 'creator' | 'hands_noface' }> = {
  lips:            { kind: 'concept',         cameraFraming: 'creator' },
  reaction:        { kind: 'concept',         cameraFraming: 'creator' },
  result_behavior: { kind: 'concept',         cameraFraming: 'creator' },
  before_after:    { kind: 'concept',         cameraFraming: 'creator' },
  product_demo:    { kind: 'product_action',  cameraFraming: 'creator' },
  product_macro:   { kind: 'product_closeup', cameraFraming: 'hands_noface' },
  mechanism3d:     { kind: 'concept',         cameraFraming: 'hands_noface' },
  social_proof:    { kind: 'concept',         cameraFraming: 'creator' },
  // F-3 — offer cut = PRODUCT-HERO close-up, NO hands (matches the director: product/units + gift
  // on a surface). endorsement = creator holds the product (face).
  offer:           { kind: 'product_closeup', cameraFraming: 'hands_noface' },
  endorsement:     { kind: 'product_action',  cameraFraming: 'creator' },
}
// Archetypes whose framing is HARD (the render breaks otherwise): macro/3D/offer = no face.
const FORCE_NOFACE = new Set<ShotIntent>(['product_macro', 'mechanism3d', 'offer'])
// Archetypes that MUST show the person living the beat.
const FORCE_CREATOR = new Set<ShotIntent>(['lips', 'reaction', 'result_behavior', 'before_after'])

/** P6ap — the DEFAULT render LOCK (kind + face/no-face framing) for an archetype, applying the
 *  same INTENT_DEFAULT + FORCE rules the AI fixer snaps to. Exported so the UI can apply the lock
 *  the MOMENT the user picks an archetype in the dropdown (closeup → no creator, emotion → creator)
 *  — without waiting for an AI call — so the pick has immediate effect on the scene. ONE source of
 *  truth: a manual pick and an AI fix land the same face/product lock. */
export function planForIntent(intent: ShotIntent): { kind: BrollSceneKind; cameraFraming: 'creator' | 'hands_noface' } {
  const def = INTENT_DEFAULT[intent]
  let kind: BrollSceneKind = def.kind
  let cameraFraming: 'creator' | 'hands_noface' = def.cameraFraming
  if (FORCE_NOFACE.has(intent)) cameraFraming = 'hands_noface'
  if (FORCE_CREATOR.has(intent)) { cameraFraming = 'creator'; kind = 'concept' }
  return { kind, cameraFraming }
}

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    shotIntent:    { type: 'string', enum: SHOT_INTENTS as unknown as string[] },
    conceptPrompt: { type: 'string' },
    kind:          { type: 'string', enum: ['product_action', 'product_closeup', 'concept'] },
    cameraFraming: { type: 'string', enum: ['creator', 'hands_noface'] },
  },
  required: ['shotIntent', 'conceptPrompt', 'kind', 'cameraFraming'],
}

const SYSTEM = (langName: string) =>
`You are a single-purpose SCENE FIXER for a vertical 9:16 UGC ad video. You are NOT a
chatbot — you do ONE thing: rewrite the render plan for ONE scene the auto-director got
wrong, and return ONLY the JSON { shotIntent, conceptPrompt, kind, cameraFraming }. No chatter.

The director only had the facts and inferred a shot the user did NOT want. You are given the
line, the director's WRONG plan (a negative example — do NOT reproduce it), the product, and
the USER'S INTENT (ground truth — honor it above all).

shotIntent — the ONE archetype this scene is (the SAME vocabulary the director uses). Pick the
one that fits the line + the user's intent (default framing in []):
- "reaction"        a feeling / desire / fear / delight on the creator's face [creator, no product packaging]
- "result_behavior" the creator DOING the thing the result enables — walk/cook/move freely [creator]
- "before_after"    split-screen transformation, SAME creator before vs after [creator]
- "product_demo"    the product being USED in its real setting [creator or hands]
- "product_macro"   clean macro of the product / a texture / a key detail / named INGREDIENTS [no face]
- "mechanism3d"     a 3D cross-section animation of how it works inside [no face, no people]
- "social_proof"    a crowd / sold-count / reviews beat
- "offer" / "endorsement"  the deal / CTA — creator presents the product
- "lips"            creator simply talking to camera
If the USER chose a TARGET archetype, you MUST output that exact shotIntent.

HARD RULES (must obey ALL — these match the renderer; breaking them breaks the clip):
1. The shot must be concrete + filmable, never generic. BY DEFAULT it illustrates the spoken line —
   BUT if the USER'S NOTE describes a specific shot, the NOTE WINS: build the conceptPrompt around
   the note (you may go beyond the literal line to honor it).
2. person vs no-person MUST match cameraFraming with NO contradiction:
   • "creator" → the SAME creator as the avatar reference is in frame — NEVER describe their
     gender/age/ethnicity/face; only what they DO + feel.
   • "hands_noface" → hands-only product-in-use, NO face, NO head, NO full person.
3. kind follows the archetype: emotion/desire/result/before_after → "concept"; product-in-use →
   "product_action"; a clean macro/texture/ingredient detail → "product_closeup".
4. INGREDIENT lines → "product_macro": show the REAL raw ingredients NAMED in the line (herbs/
   fruit/roots/spices/etc) arranged around the product as the hero, natural flat-lay, no face.
5. NEVER describe the packaging's look (color/shape/label), NEVER invent a package, and NEVER write
   the product's NAME or brand — refer to it ONLY as "the product". The real product image is the
   lock; its name + label come from that reference at render. Putting the NAME into words makes the
   image model render a garbled FAKE label ("Hawthorn Prime" → "Havrtvion Drie"). NEVER mention
   price/money/discount, a cert, a %, or a number.
6. conceptPrompt MUST specify: SHOT TYPE + the concrete ACTION + WHICH PART is in frame + the
   real SETTING. One vivid shot, ≤ ~240 chars, written in ENGLISH (it is the literal render
   instruction) even though the spoken line is in ${langName}.

Output STRICT JSON only.`

/** Rewrite ONE scene's render plan from the user's intent (+ an optional target archetype) and
 *  the director's bad plan as a negative example. Returns a self-consistent
 *  { shotIntent, conceptPrompt, kind, cameraFraming } that stays on the director's spine.
 *  Throws on failure (no key / Gemini / parse) so the caller can surface it. */
export async function fixSceneConceptPrompt(params: {
  geminiKey: string
  scene: TimedBrollScene
  product?: Product | null
  lang: ScriptLang
  fullScript?: GeneratedScript | null
  /** Free-text + archetype hint combined — what the user wants / what's wrong. May be empty. */
  userIntent: string
  /** The archetype the user explicitly picked (a chip). When set, the output shotIntent is forced to it. */
  targetIntent?: ShotIntent
}): Promise<SceneFix> {
  if (!params.geminiKey) throw new Error('Thiếu Gemini key')
  const langName = SCRIPT_LANG_GEMINI_NAME[params.lang] ?? 'Vietnamese'
  const s = params.scene
  const productContext = buildProductContextBlock(params.product)
  const scriptDump = params.fullScript?.blocks?.length
    ? params.fullScript.blocks.map((b) => b.text).join(' / ').slice(0, 600)
    : ''
  const intent = params.userIntent.trim()
  // F-1/2 — keep the scene's gift / multi-unit context so a fix never silently drops them.
  const giftLine = s.giftRef
    ? '\nGIFT (keep it): this scene shows the product TOGETHER WITH a bundled FREE GIFT — a SEPARATE object. Your conceptPrompt MUST keep BOTH the product and the free gift in frame (do NOT drop the gift).'
    : ''
  const unitsLine = (s.productUnits && s.productUnits > 1)
    ? `\nUNITS (keep it): show ${s.productUnits} identical units of the product (a buy-X-get-Y deal) — not a single one.`
    : ''

  const userMsg =
`THIS SCENE'S SPOKEN LINE (${langName}): "${s.quote ?? ''}"

DIRECTOR'S CURRENT PLAN — this is WRONG, do NOT reproduce it:
- shotIntent: ${s.shotIntent ?? '(none)'}
- conceptPrompt: ${s.conceptPrompt?.trim() || '(empty)'}
- kind: ${s.kind ?? '(none)'} · cameraFraming: ${s.cameraFraming ?? '(none)'}
${params.targetIntent ? `\nTARGET ARCHETYPE the user chose: "${params.targetIntent}" — you MUST output this exact shotIntent.` : ''}${giftLine}${unitsLine}
USER'S NOTE — THE #1 PRIORITY (this is EXACTLY the shot the user wants; build the conceptPrompt
AROUND it; it WINS over the default archetype shot and you MAY go beyond the literal spoken line
to honor it; only fall back to inferring from the line when this is empty):
${intent || '(none given — infer the most fitting archetype for the line; if the current plan is a product macro on a feeling/desire/fear line, switch it to a creator emotion moment)'}
${productContext}
${scriptDump ? `\nFULL VOICEOVER (context only):\n${scriptDump}` : ''}

Return the corrected { shotIntent, conceptPrompt, kind, cameraFraming } as JSON now.`

  const raw = await directGeminiText({
    apiKey: params.geminiKey,
    prompt: userMsg,
    systemInstruction: SYSTEM(langName),
    responseMimeType: 'application/json',
    responseSchema: FIX_SCHEMA,
    maxOutputTokens: 512,
    temperature: 0.5,
    thinkingBudget: 0,
  })
  const fix = JSON.parse(raw) as Partial<SceneFix>
  const conceptPrompt = (fix.conceptPrompt ?? '').trim()
  if (!conceptPrompt) throw new Error('AI trả về prompt rỗng — thử lại')

  // shotIntent: a user-forced target wins; else the model's pick; else a safe default.
  const modelIntent = SHOT_INTENTS.includes(fix.shotIntent as ShotIntent) ? (fix.shotIntent as ShotIntent) : undefined
  const shotIntent: ShotIntent = params.targetIntent ?? modelIntent ?? 'product_demo'
  const def = INTENT_DEFAULT[shotIntent]

  // kind/framing: keep the model's if valid, else fall back to the archetype default; then snap
  // framing to the archetype's HARD rule so the prompt never fights the framing.
  let kind: BrollSceneKind = (['product_action', 'product_closeup', 'concept'] as const)
    .includes(fix.kind as BrollSceneKind) ? (fix.kind as BrollSceneKind) : def.kind
  let cameraFraming: 'creator' | 'hands_noface' = fix.cameraFraming === 'hands_noface' ? 'hands_noface' : 'creator'
  if (FORCE_NOFACE.has(shotIntent)) cameraFraming = 'hands_noface'
  if (FORCE_CREATOR.has(shotIntent)) { cameraFraming = 'creator'; kind = 'concept' }

  return { conceptPrompt, kind, cameraFraming, shotIntent }
}
