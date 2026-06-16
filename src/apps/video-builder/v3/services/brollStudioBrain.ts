// ── B-roll Studio (Mode 2) — the per-scene BRAIN (P6, Phase 1) ───────────────
// Reads the product (deep vision-brief) and produces ONE grounded IDEA per angle in a
// SINGLE batch Gemini call (NOT 11 calls). Each idea carries: a VN/MS one-liner shown on
// the card, the i2v conceptPrompt (English) the renderer will animate, and a suggested
// spoken line (used only if the user enables voice). The 11 ANGLE configs also define the
// conditional toggle locks + model routing the Phase-2 UI uses, so a scene can never be
// mis-configured into a weird render.
// ─────────────────────────────────────────────────────────────────────────────

import { directGeminiText } from '../../../../utils/gemini'
import { generateProductVisualBrief } from './productVisionBrief'
import { buildProductContextBlock } from './insertSuggester'
import { SCRIPT_LANG_GEMINI_NAME, type ScriptLang } from '../types'
import type { Product } from '../../../../stores/types'
import type { StudioModelTier } from './brollStudioModels'

export type StudioAngleId =
  | 'hook' | 'problem' | 'reveal' | 'demo' | 'closeup' | 'mechanism3d'
  | 'before_after' | 'social_proof' | 'ingredient' | 'lifestyle' | 'comparison'

/** Toggle availability per angle: 'on'|'off'|'lock-on'|'lock-off' (locked = user can't
 *  change it; the brain enforces it so the scene stays coherent). */
export type ToggleState = 'on' | 'off' | 'lock-on' | 'lock-off'

export interface StudioAngle {
  id: StudioAngleId
  labelVi: string
  descVi: string
  /** Conditional toggles (the lock table) — Phase-2 UI shows/locks accordingly. */
  toggles: { avatar: ToggleState; voice: ToggleState; product: ToggleState; line: ToggleState }
  /** Default render model tier. */
  model: StudioModelTier
  /** Product-present scene → gpt-4o-image faithful first-frame before i2v (anti-drift). */
  faithfulFrame: boolean
  /** Rendered as the static FB-post card (gpt-4o-image), not i2v. */
  isCard?: boolean
}

// The 11 angles (offer/CTA dropped per user). Lock rules = the discussion we agreed.
export const STUDIO_ANGLES: StudioAngle[] = [
  { id: 'hook',         labelVi: 'Hook chặn lướt',   descVi: 'Mở màn bắt mắt 1-2s', toggles: { avatar: 'on', voice: 'on', product: 'on', line: 'on' }, model: 'seedance', faithfulFrame: true },
  { id: 'problem',      labelVi: 'Vấn đề / nỗi đau',  descVi: 'Tình huống trước khi có sản phẩm', toggles: { avatar: 'on', voice: 'on', product: 'lock-off', line: 'on' }, model: 'seedance', faithfulFrame: false },
  { id: 'reveal',       labelVi: 'Reveal sản phẩm',  descVi: 'Mở hộp / lần đầu thấy', toggles: { avatar: 'on', voice: 'on', product: 'lock-on', line: 'on' }, model: 'seedance', faithfulFrame: true },
  { id: 'demo',         labelVi: 'Dùng sản phẩm',    descVi: 'Tay/avatar thao tác sản phẩm', toggles: { avatar: 'on', voice: 'on', product: 'lock-on', line: 'on' }, model: 'seedance', faithfulFrame: true },
  { id: 'closeup',      labelVi: 'Cận cảnh / chất liệu', descVi: 'Macro chi tiết hero', toggles: { avatar: 'lock-off', voice: 'on', product: 'lock-on', line: 'on' }, model: 'seedance', faithfulFrame: true },
  { id: 'mechanism3d',  labelVi: '3D cơ chế',         descVi: 'Animation bên trong hoạt động', toggles: { avatar: 'lock-off', voice: 'on', product: 'lock-off', line: 'on' }, model: 'seedance', faithfulFrame: false },
  { id: 'before_after', labelVi: 'Before → After',    descVi: 'Kết quả / chuyển biến', toggles: { avatar: 'on', voice: 'on', product: 'on', line: 'on' }, model: 'seedance', faithfulFrame: false },
  { id: 'social_proof', labelVi: 'Social proof',      descVi: 'Thẻ review / đám đông (ảnh)', toggles: { avatar: 'lock-off', voice: 'on', product: 'lock-on', line: 'on' }, model: 'seedance', faithfulFrame: false, isCard: true },
  { id: 'ingredient',   labelVi: 'Thành phần / spec', descVi: 'Sản phẩm + callout chữ', toggles: { avatar: 'lock-off', voice: 'on', product: 'lock-on', line: 'on' }, model: 'seedance', faithfulFrame: true },
  { id: 'lifestyle',    labelVi: 'Bối cảnh đời thường', descVi: 'Sản phẩm trong setting thật', toggles: { avatar: 'on', voice: 'on', product: 'on', line: 'on' }, model: 'seedance', faithfulFrame: true },
  { id: 'comparison',   labelVi: 'So sánh',           descVi: 'Đối chiếu cách cũ / hàng thường', toggles: { avatar: 'on', voice: 'on', product: 'lock-on', line: 'on' }, model: 'seedance', faithfulFrame: true },
]

export interface StudioIdea {
  angle: StudioAngleId
  ideaVi: string          // one-liner shown on the card (output language)
  conceptPromptEn: string // the i2v concept the renderer animates
  suggestedLine: string   // a spoken line if the user turns voice on (output language)
}

const IDEA_SCHEMA = {
  type: 'object',
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          angle: { type: 'string' },
          ideaVi: { type: 'string' },
          conceptPromptEn: { type: 'string' },
          suggestedLine: { type: 'string' },
        },
        required: ['angle', 'ideaVi', 'conceptPromptEn', 'suggestedLine'],
      },
    },
  },
  required: ['ideas'],
} as const

/** Generate ONE grounded idea per angle in a single batch call. Ensures the deep vision
 *  brief first (1 cached call if missing). Returns ideas keyed by angle. */
export async function generateStudioIdeas(
  product: Product, lang: ScriptLang, geminiKey: string,
): Promise<{ ideas: Record<string, StudioIdea>; product: Product }> {
  // Deep vision-brief (product fidelity foundation) — generate + cache if absent.
  let p = product
  if (!p.visualBrief && geminiKey) {
    try {
      const vb = await generateProductVisualBrief(p, geminiKey)
      if (vb) p = { ...p, visualBrief: vb }
    } catch { /* fall back to text-only context */ }
  }
  const langName = SCRIPT_LANG_GEMINI_NAME[lang]
  const productContext = buildProductContextBlock(p)
  const angleList = STUDIO_ANGLES.map((a) => `- ${a.id}: ${a.labelVi} — ${a.descVi}`).join('\n')

  const systemInstruction =
`You are a UGC ad B-ROLL DIRECTOR. For the product below, write ONE scene IDEA for EACH of
these ${STUDIO_ANGLES.length} angles — grounded in the REAL product (use the visual brief), never generic.${productContext}

ANGLES:
${angleList}

For EACH angle output:
- angle: the exact id.
- ideaVi: ONE short line in ${langName} describing the scene (what the viewer sees).
- conceptPromptEn: ONE vivid ENGLISH i2v prompt — SHOT TYPE (macro / POV-hands / wide /
  over-the-shoulder) + a concrete ACTION + the real SETTING, grounded in the product. For
  '3d' = a clean 3D cross-section animation, NO people/packaging/text. For 'social_proof' =
  describe a realistic Facebook review screenshot. NEVER ask the video model to render text.
- suggestedLine: ONE short spoken line in ${langName} that fits this scene (used only if
  voice is on). Native, punchy.

Output STRICT JSON { "ideas": [ ${STUDIO_ANGLES.length} objects, SAME order ] }. No markdown.`

  const raw = await directGeminiText({
    apiKey: geminiKey,
    systemInstruction,
    prompt: 'Generate the idea for every angle now. Return the JSON.',
    maxOutputTokens: 4096,
    temperature: 0.7,
    thinkingBudget: 0,
    responseMimeType: 'application/json',
    responseSchema: IDEA_SCHEMA,
  })

  const ideas: Record<string, StudioIdea> = {}
  try {
    let s = raw.trim()
    if (s.startsWith('```')) s = s.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()
    const parsed = JSON.parse(s) as { ideas?: StudioIdea[] }
    for (const it of parsed.ideas ?? []) {
      if (it.angle && STUDIO_ANGLES.some((a) => a.id === it.angle)) ideas[it.angle] = it
    }
  } catch (e) {
    console.warn('[STUDIO_BRAIN] parse ideas lỗi:', e)
  }
  return { ideas, product: p }
}

// ── Per-scene: toggle resolver + prompt engineer (Phase 2) ───────────────────

export interface SceneToggles { avatar: boolean; voice: boolean; product: boolean; line: boolean }
export interface SceneSpec {
  role: 'broll' | 'lips' | 'mechanism3d' | 'social_proof'
  tier: StudioModelTier
  framing: 'creator' | 'hands_noface' | 'none'
  withFaithfulFrame: boolean
  isCard: boolean
}

/** DETERMINISTIC: turn (angle + toggles) into the render spec (role/model/framing/frame).
 *  This is the "brain locks" — a scene can never resolve into an incoherent render. */
export function resolveSceneSpec(angle: StudioAngle, t: SceneToggles): SceneSpec {
  if (angle.isCard) return { role: 'social_proof', tier: 'seedance', framing: 'none', withFaithfulFrame: false, isCard: true }
  if (angle.id === 'mechanism3d') return { role: 'mechanism3d', tier: 'seedance', framing: 'none', withFaithfulFrame: false, isCard: false }
  if (t.avatar && t.voice && t.line) return { role: 'lips', tier: 'infinitalk', framing: 'creator', withFaithfulFrame: false, isCard: false }
  return { role: 'broll', tier: 'seedance', framing: t.avatar ? 'creator' : 'hands_noface', withFaithfulFrame: !!angle.faithfulFrame && t.product, isCard: false }
}

const ENGINEER_SCHEMA = {
  type: 'object',
  properties: { conceptPromptEn: { type: 'string' }, noteVi: { type: 'string' } },
  required: ['conceptPromptEn', 'noteVi'],
} as const

// Anti-drift rules learned from mode-1 — baked into every scene prompt so the i2v render
// comes out clean (the user's quality-first stance: spend calls, avoid bad renders).
const ANTI_DRIFT = `
DRIFT-PROOF RULES (the video model fails on these — engineer the prompt to AVOID them):
- The product must look EXACTLY like the reference (same colour/shape/label) — never invent packaging.
- NO floating objects: anything held is gripped firmly with both hands or rests on a surface (no "floating bowl/head").
- A person: ONE consistent identity; if no avatar, hands-only (no face) to avoid warped faces.
- NEVER ask the model to render TEXT/numbers (it garbles them) — text is added later as an overlay.
- 3D = clean cross-section animation, NO people / NO packaging / NO text.
- Copy any correct ORIENTATION (how it's worn/placed) so it's never shown backwards.`

/** QUALITY-FIRST per-scene prompt: AI writes a drift-resistant i2v prompt for THIS exact
 *  config, then a SECOND self-critique pass fixes any drift risk. Returns the final prompt
 *  + a short VN NOTE (what the rendered clip will be). ~2 Gemini calls (paid key — fine). */
export async function engineerScenePrompt(args: {
  angle: StudioAngle; idea?: StudioIdea; toggles: SceneToggles; line?: string
  durationSec: number; product: Product; lang: ScriptLang; geminiKey: string
}): Promise<{ conceptPromptEn: string; noteVi: string; spec: SceneSpec }> {
  const spec = resolveSceneSpec(args.angle, args.toggles)
  const langName = SCRIPT_LANG_GEMINI_NAME[args.lang]
  const productContext = buildProductContextBlock(args.product)
  const cfg =
    `Scene angle: ${args.angle.labelVi} (${args.angle.id}). Render role: ${spec.role}. ` +
    `Person: ${spec.framing === 'creator' ? 'a creator visible' : spec.framing === 'hands_noface' ? 'hands only, NO face' : 'no person'}. ` +
    `Product in frame: ${args.toggles.product ? 'YES (must match the reference exactly)' : 'NO'}. ` +
    `Duration: ${args.durationSec}s.` +
    (args.toggles.line && args.line ? ` Spoken line (for context only, NOT shown as text): "${args.line}".` : '')

  // Pass 1 — draft.
  const draftRaw = await directGeminiText({
    apiKey: args.geminiKey,
    systemInstruction:
      `You are a UGC ad B-ROLL prompt engineer. Write ONE vivid ENGLISH image-to-video prompt — ` +
      `SHOT TYPE + concrete ACTION + real SETTING — grounded in the product, for the scene below.${productContext}\n${ANTI_DRIFT}\n` +
      `Output STRICT JSON {"conceptPromptEn":"…","noteVi":"<1 short ${langName} line: what the clip shows>"}.`,
    prompt: `${cfg}\nIdea seed: ${args.idea?.conceptPromptEn ?? args.idea?.ideaVi ?? args.angle.descVi}\nWrite the prompt.`,
    maxOutputTokens: 700, temperature: 0.6, thinkingBudget: 0, responseMimeType: 'application/json', responseSchema: ENGINEER_SCHEMA,
  })
  let draft = safeParseEngineer(draftRaw)

  // Pass 2 — self-critique for drift, then fix.
  try {
    const fixRaw = await directGeminiText({
      apiKey: args.geminiKey,
      systemInstruction:
        `You review an image-to-video prompt for DRIFT RISK (floating objects, garbled text, ` +
        `warped faces, wrong/redesigned product, people in a 3D shot). Rewrite it to remove every ` +
        `risk while keeping the intent.${ANTI_DRIFT}\n` +
        `Output STRICT JSON {"conceptPromptEn":"<fixed prompt>","noteVi":"<1 short ${langName} line>"}.`,
      prompt: `Scene: ${cfg}\nPROMPT TO REVIEW:\n"""${draft.conceptPromptEn}"""`,
      maxOutputTokens: 700, temperature: 0.3, thinkingBudget: 0, responseMimeType: 'application/json', responseSchema: ENGINEER_SCHEMA,
    })
    const fixed = safeParseEngineer(fixRaw)
    if (fixed.conceptPromptEn) draft = fixed
  } catch { /* keep the draft if the critique pass fails */ }

  return { conceptPromptEn: draft.conceptPromptEn, noteVi: draft.noteVi, spec }
}

function safeParseEngineer(raw: string): { conceptPromptEn: string; noteVi: string } {
  try {
    let s = raw.trim()
    if (s.startsWith('```')) s = s.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()
    const p = JSON.parse(s) as { conceptPromptEn?: string; noteVi?: string }
    return { conceptPromptEn: (p.conceptPromptEn ?? '').trim(), noteVi: (p.noteVi ?? '').trim() }
  } catch { return { conceptPromptEn: '', noteVi: '' } }
}
