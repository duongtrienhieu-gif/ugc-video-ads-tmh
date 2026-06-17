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
  | 'before_after' | 'reaction' | 'ingredient' | 'lifestyle' | 'comparison'
  | 'freeform'

/** Toggle availability per angle: 'on'|'off'|'lock-on'|'lock-off' (locked = user can't
 *  change it; the brain enforces it so the scene stays coherent). */
export type ToggleState = 'on' | 'off' | 'lock-on' | 'lock-off'

export interface StudioAngle {
  id: StudioAngleId
  labelVi: string
  descVi: string
  /** 1-2 câu hướng dẫn user: cảnh này để LÀM GÌ + nên cấu hình ra sao (hiện trên thẻ). */
  howToVi: string
  /** Conditional toggles (the lock table) — Phase-2 UI shows/locks accordingly.
   *  (No `line` here: a spoken line is purely a consequence of `voice` being on —
   *  the UI reveals a "Câu thoại" box when the user picks a voice.) */
  toggles: { avatar: ToggleState; voice: ToggleState; product: ToggleState }
  /** Default render model tier. */
  model: StudioModelTier
  /** Product-present scene → gpt-4o-image faithful first-frame before i2v (anti-drift). */
  faithfulFrame: boolean
  /** Rendered as the static FB-post card (gpt-4o-image), not i2v. */
  isCard?: boolean
}

// The 11 angles (offer/CTA dropped per user). Lock rules = the discussion we agreed.
export const STUDIO_ANGLES: StudioAngle[] = [
  { id: 'hook',         labelVi: 'Hook chặn lướt',   descVi: 'Mở màn bắt mắt 1-2s',
    howToVi: 'Cảnh 1-2s đầu để chặn người lướt: chuyển động mạnh hoặc khoảnh khắc gây tò mò. Bật avatar nếu muốn người thật xuất hiện ngay.',
    toggles: { avatar: 'on', voice: 'on', product: 'on' }, model: 'seedance', faithfulFrame: true },
  { id: 'problem',      labelVi: 'Vấn đề / nỗi đau',  descVi: 'Tình huống trước khi có sản phẩm',
    howToVi: 'Diễn lại nỗi đau/tình huống bực bội TRƯỚC khi có sản phẩm để người xem thấy mình trong đó. Chưa lộ sản phẩm.',
    toggles: { avatar: 'on', voice: 'on', product: 'lock-off' }, model: 'seedance', faithfulFrame: false },
  { id: 'reveal',       labelVi: 'Reveal sản phẩm',  descVi: 'Mở hộp / lần đầu thấy',
    howToVi: 'Khoảnh khắc lần đầu thấy / mở hộp sản phẩm, tạo cảm giác "đây rồi". Sản phẩm luôn xuất hiện.',
    toggles: { avatar: 'on', voice: 'on', product: 'lock-on' }, model: 'seedance', faithfulFrame: true },
  { id: 'demo',         labelVi: 'Dùng sản phẩm',    descVi: 'Avatar thao tác sản phẩm',
    howToVi: 'Avatar trực tiếp dùng/thao tác sản phẩm thật — bằng chứng "xài được". Nên bật avatar + giọng để vừa làm vừa nói.',
    toggles: { avatar: 'on', voice: 'on', product: 'lock-on' }, model: 'seedance', faithfulFrame: true },
  { id: 'closeup',      labelVi: 'Cận cảnh / chất liệu', descVi: 'Macro chi tiết hero',
    howToVi: 'Macro cận chất liệu/kết cấu sản phẩm (gel, hạt, vân...) để tôn độ "xịn". Không có người, chỉ sản phẩm.',
    toggles: { avatar: 'lock-off', voice: 'on', product: 'lock-on' }, model: 'seedance', faithfulFrame: true },
  { id: 'mechanism3d',  labelVi: '3D cơ chế',         descVi: 'Animation bên trong hoạt động',
    howToVi: 'Animation 3D cắt lớp mô tả cơ chế hoạt động bên trong. Không người, không bao bì, không chữ.',
    toggles: { avatar: 'lock-off', voice: 'on', product: 'lock-off' }, model: 'seedance', faithfulFrame: false },
  { id: 'before_after', labelVi: 'Before → After',    descVi: 'Kết quả / chuyển biến',
    howToVi: 'Đối chiếu trạng thái trước ↔ sau khi dùng để nhấn chuyển biến. Có thể tắt sản phẩm, tập trung vào kết quả.',
    toggles: { avatar: 'on', voice: 'on', product: 'on' }, model: 'seedance', faithfulFrame: false },
  { id: 'reaction',     labelVi: 'Khoảnh khắc "wow"', descVi: 'Phản ứng hài lòng sau khi dùng',
    howToVi: 'Cận biểu cảm hài lòng/bất ngờ ngay sau khi dùng — social proof dạng cảm xúc thật. Nên bật avatar + giọng để thốt lên 1 câu.',
    toggles: { avatar: 'on', voice: 'on', product: 'on' }, model: 'seedance', faithfulFrame: true },
  { id: 'ingredient',   labelVi: 'Thành phần / spec', descVi: 'Sản phẩm + callout chữ',
    howToVi: 'Khoe thành phần/điểm mạnh kỹ thuật quanh sản phẩm (chữ callout thêm ở bước overlay sau). Không người.',
    toggles: { avatar: 'lock-off', voice: 'on', product: 'lock-on' }, model: 'seedance', faithfulFrame: true },
  { id: 'lifestyle',    labelVi: 'Bối cảnh đời thường', descVi: 'Sản phẩm trong setting thật',
    howToVi: 'Sản phẩm đặt trong bối cảnh đời thật (bàn bếp, túi xách...) tạo cảm giác quen thuộc, dễ mua.',
    toggles: { avatar: 'on', voice: 'on', product: 'on' }, model: 'seedance', faithfulFrame: true },
  { id: 'comparison',   labelVi: 'So sánh',           descVi: 'Đối chiếu cách cũ / hàng thường',
    howToVi: 'Đặt sản phẩm cạnh cách cũ / hàng thường để bật ưu thế. Sản phẩm luôn có mặt.',
    toggles: { avatar: 'on', voice: 'on', product: 'lock-on' }, model: 'seedance', faithfulFrame: true },
]

// Free-form scene — NOT in the 11-grid. The user types a Vietnamese description; all toggles
// are free (no locks). Rendered through the SAME pipeline as the angle cards.
export const FREEFORM_ANGLE: StudioAngle = {
  id: 'freeform', labelVi: 'Cảnh tự do', descVi: 'Mô tả bằng lời',
  howToVi: 'Gõ mô tả cảnh bằng tiếng Việt — AI hiểu và tự dựng prompt bám sản phẩm. Bật avatar/giọng/sản phẩm tuỳ ý.',
  toggles: { avatar: 'on', voice: 'on', product: 'on' }, model: 'seedance', faithfulFrame: true,
}

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
  product: Product, _lang: ScriptLang, geminiKey: string,   // _lang: ideas are always Vietnamese now
): Promise<{ ideas: Record<string, StudioIdea>; product: Product }> {
  // Deep vision-brief (product fidelity foundation) — generate + cache if absent.
  let p = product
  if (!p.visualBrief && geminiKey) {
    try {
      const vb = await generateProductVisualBrief(p, geminiKey)
      if (vb) p = { ...p, visualBrief: vb }
    } catch { /* fall back to text-only context */ }
  }
  // NOTE: operator-facing text (ideaVi / suggestedLine) is ALWAYS Vietnamese — the operator
  // works in VN regardless of target market. Market language only materialises in the FINAL
  // audio (translateLineForMarket runs at TTS time).
  const productContext = buildProductContextBlock(p)
  const angleList = STUDIO_ANGLES.map((a) => `- ${a.id}: ${a.labelVi} — ${a.descVi}`).join('\n')

  const systemInstruction =
`You are a UGC ad B-ROLL DIRECTOR. For the product below, write ONE scene IDEA for EACH of
these ${STUDIO_ANGLES.length} angles — grounded in the REAL product (use the visual brief), never generic.${productContext}

ANGLES:
${angleList}

For EACH angle output:
- angle: the exact id.
- ideaVi: ONE short line in VIETNAMESE describing the scene (for the Vietnamese operator to read — ALWAYS Vietnamese, NEVER the target-market language).
- conceptPromptEn: ONE vivid ENGLISH i2v prompt — SHOT TYPE (macro / POV-hands / wide /
  over-the-shoulder) + a concrete ACTION + the real SETTING, grounded in the product. For
  'mechanism3d' = a clean 3D cross-section animation, NO people/packaging/text. For 'reaction' =
  a tight shot of a genuine delighted/surprised facial reaction right after using the product.
  NEVER ask the video model to render text.
- suggestedLine: ONE short spoken line in VIETNAMESE that fits this scene (the operator reads/
  edits it in VN; it is auto-translated to the target market language at voice time). Natural, punchy.

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

export interface SceneToggles { avatar: boolean; voice: boolean; product: boolean }
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
  // avatar + voice = a talking creator → lipsync (the spoken line is required, enforced by the UI)
  if (t.avatar && t.voice) return { role: 'lips', tier: 'infinitalk', framing: 'creator', withFaithfulFrame: true, isCard: false }
  // Faithful frame whenever the PRODUCT is in frame (anti-drift lock) — not just when the
  // angle opted in. Any scene showing the product must lock it to the real reference image.
  return { role: 'broll', tier: 'seedance', framing: t.avatar ? 'creator' : 'hands_noface', withFaithfulFrame: t.product || t.avatar, isCard: false }
}

const ENGINEER_SCHEMA = {
  type: 'object',
  properties: { conceptPromptEn: { type: 'string' }, noteVi: { type: 'string' } },
  required: ['conceptPromptEn', 'noteVi'],
} as const

// Anti-drift rules learned from mode-1 — baked into every scene prompt so the i2v render
// comes out clean (the user's quality-first stance: spend calls, avoid bad renders).
const ANTI_DRIFT = `
DRIFT-PROOF RULES (keep the render clean WITHOUT dodging the point of the scene):
- The product must look EXACTLY like the reference (same colour/shape/label) — never invent or redesign packaging.
- IF AN AVATAR IS CHOSEN: the avatar's FACE IS CLEARLY VISIBLE and the avatar uses the product with THEIR OWN HANDS,
  performing the real, specific action of the scene. This is the WHOLE POINT — do NOT hide the face, do NOT cut away to
  anonymous disembodied hands, do NOT switch to a product-only shot to "play it safe". A real creator genuinely using
  the product is exactly what we want. (The faithful first-frame image + Seedance keep the identity/product stable, so
  there is no need to avoid faces — never use "consistency" or "avoid distortion" as an excuse to remove the person.)
- ONLY when NO avatar is chosen: use a clean hands-only or macro framing — a deliberate close-up choice, not an escape.
- ONE consistent person identity throughout the clip.
- NO floating objects: anything held is gripped firmly or rests on a surface (no "floating bowl/jar").
- NEVER ask the model to render TEXT/numbers (it garbles them) — spoken lines are voiced later, captions overlaid later.
- 3D = clean cross-section animation, NO people / NO packaging / NO text.
- Copy the correct ORIENTATION (how it's worn/placed/applied) so nothing is shown backwards.`

// Same drift rules, but for a NO-PRODUCT beat (operator turned the product toggle OFF):
// the scene is a feeling / problem / lifestyle moment and the product object must NEVER appear.
const ANTI_DRIFT_NOPRODUCT = `
DRIFT-PROOF RULES (keep the render clean WITHOUT dodging the point of the scene):
- ⛔ NO PRODUCT: the product and its packaging must NOT appear, be held, opened, applied, peeled off, or be referenced ANYWHERE in the frame. This is a no-product beat — render only the feeling / problem / lifestyle moment described, never the product object.
- IF AN AVATAR IS CHOSEN: the avatar's FACE IS CLEARLY VISIBLE, performing the real, specific action of the scene. Do NOT hide the face, do NOT cut away to anonymous disembodied hands. (The faithful first-frame image + Seedance keep the identity stable — never use "consistency" or "avoid distortion" as an excuse to remove the person.)
- ONLY when NO avatar is chosen: use a clean hands-only or macro framing — a deliberate close-up choice, not an escape.
- ONE consistent person identity throughout the clip.
- NO floating objects: anything held is gripped firmly or rests on a surface.
- NEVER ask the model to render TEXT/numbers (it garbles them) — spoken lines are voiced later, captions overlaid later.
- 3D = clean cross-section animation, NO people / NO text.`

// When NO avatar is chosen, the global market toggle is allowed to shape the SETTING + the
// look of any incidental people (the avatar pick handles identity when one IS chosen).
const LOCALE_HINT: Record<ScriptLang, string> = {
  vi: 'a Vietnamese real-life setting; any incidental people look Vietnamese / Southeast-Asian',
  ms: 'a Malaysian / Southeast-Asian real-life setting; any incidental people look Malay / Southeast-Asian',
  en: 'a clean, neutral modern setting',
}

/** QUALITY-FIRST per-scene prompt: AI writes a drift-resistant i2v prompt for THIS exact
 *  config, then a SECOND self-critique pass fixes any drift risk. Returns the final prompt
 *  + a short VN NOTE (what the rendered clip will be). ~2 Gemini calls (paid key — fine).
 *  `variant` > 0 → push for a DIFFERENT creative take (so "tạo lại" never returns the same). */
export async function engineerScenePrompt(args: {
  angle: StudioAngle; idea?: StudioIdea; toggles: SceneToggles; line?: string
  durationSec: number; product: Product; lang: ScriptLang; geminiKey: string; variant?: number
  /** Free-form scene: a Vietnamese description the AI must understand + build the scene from. */
  briefVi?: string
}): Promise<{ conceptPromptEn: string; noteVi: string; spec: SceneSpec }> {
  const spec = resolveSceneSpec(args.angle, args.toggles)
  const showProduct = args.toggles.product
  // When the operator turned the product toggle OFF, the product object must NOT appear.
  // Feed the niche context only as background understanding, clearly marked off-screen — and
  // swap the drift rules + grounding language so Gemini never re-introduces the product.
  const productContext = showProduct
    ? buildProductContextBlock(args.product)
    : (() => {
        const ctx = buildProductContextBlock(args.product)
        return ctx ? `\n[NICHE CONTEXT — for understanding the topic ONLY; the product itself must NEVER appear in this shot]${ctx}` : ''
      })()
  const driftRules = showProduct ? ANTI_DRIFT : ANTI_DRIFT_NOPRODUCT
  const groundingClause = showProduct
    ? 'grounded in the product'
    : 'for the scene below — a NO-PRODUCT beat (feeling / problem / lifestyle); the product object and its packaging must NOT appear'
  const localeHint = (!args.toggles.avatar && spec.role !== 'mechanism3d')
    ? ` Setting / casting locale: ${LOCALE_HINT[args.lang]}.` : ''
  // Identity lock for the creator: the ONE person in this scene IS the avatar reference image.
  // The brief (if any) describes the SITUATION/emotion/setting — it must NOT spawn a new
  // generic person or override the avatar's face/ethnicity/age (that comes from the ref image).
  const personClause = spec.framing === 'creator'
    ? `the chosen avatar/creator — THIS single person IS the avatar reference image: keep that EXACT face / hair / identity / ethnicity / age, do NOT invent a different-looking person and do NOT assign any new ethnicity or age from words in the description. FACE CLEARLY VISIBLE${showProduct ? ', actively using the product with their own hands' : ", performing the scene's real action/expression (no product in this shot)"}`
    : spec.framing === 'hands_noface' ? 'hands only, NO face (no avatar was chosen)' : 'no person'
  const cfg =
    `Scene angle: ${args.angle.labelVi} (${args.angle.id}). Render role: ${spec.role}. ` +
    `Person: ${personClause}. ` +
    `Product in frame: ${showProduct ? 'YES (must match the reference exactly)' : 'NO — the physical product / its packaging must NOT appear, be held, or be referenced in this shot'}. ` +
    `Duration: ${args.durationSec}s.` + localeHint +
    (args.toggles.voice && args.line ? ` Spoken line (for mood/context only, NOT rendered as on-screen text): "${args.line}".` : '')

  const variantNudge = args.variant ? `\nThis is RE-GENERATION #${args.variant} — give a DISTINCTLY DIFFERENT creative take (new shot/angle/action) from a typical version, same intent.` : ''

  // Pass 1 — draft.
  const draftRaw = await directGeminiText({
    apiKey: args.geminiKey,
    systemInstruction:
      `You are a UGC ad B-ROLL prompt engineer. Write ONE vivid ENGLISH image-to-video prompt — ` +
      `SHOT TYPE + concrete ACTION + real SETTING — ${groundingClause}.${productContext}\n${driftRules}\n` +
      `Output STRICT JSON {"conceptPromptEn":"…","noteVi":"<1 short VIETNAMESE line for the operator: what the clip shows>"}.`,
    prompt: `${cfg}\n${args.briefVi
      ? `User scene description (written in VIETNAMESE — understand it and build THIS exact scene${showProduct ? ', grounded in the product' : '. ⛔ Render ONLY what the description says — do NOT add the product or its packaging into the shot'}): "${args.briefVi}"`
        + (args.toggles.avatar ? ` ⚠ The description gives the SITUATION / emotion / setting only — the PERSON in this scene IS the chosen avatar (keep that exact face/identity from the reference); do NOT create a new generic person and do NOT take the person's ethnicity/age/appearance from words in the description.` : '')
      : `Idea seed: ${args.idea?.conceptPromptEn ?? args.idea?.ideaVi ?? args.angle.descVi}`}${variantNudge}\nWrite the prompt.`,
    maxOutputTokens: 700, temperature: args.variant ? 0.95 : 0.6, thinkingBudget: 0, responseMimeType: 'application/json', responseSchema: ENGINEER_SCHEMA,
  })
  let draft = safeParseEngineer(draftRaw)

  // Pass 2 — self-critique for drift, then fix.
  try {
    const fixRaw = await directGeminiText({
      apiKey: args.geminiKey,
      systemInstruction: (showProduct
        ? `You review an image-to-video prompt and enforce these, rewriting only as needed: the product matches the ` +
          `reference EXACTLY; no floating objects; no rendered text/numbers; a 3D shot has no people/packaging. ` +
          `CRITICAL: if an avatar is present its FACE STAYS VISIBLE and it keeps actively using the product — you must ` +
          `NOT remove the person, NOT replace them with anonymous hands, NOT turn it into a product-only shot. Keep the ` +
          `creator performing the real action.`
        : `You review an image-to-video prompt for a NO-PRODUCT beat and rewrite as needed: ⛔ the product and its ` +
          `packaging must NOT appear, be held, opened, applied, peeled, or referenced anywhere — if the prompt shows or ` +
          `mentions the product, REMOVE it and keep only the feeling / problem / lifestyle moment. No floating objects; ` +
          `no rendered text/numbers. CRITICAL: if an avatar is present its FACE STAYS VISIBLE — do NOT replace it with ` +
          `anonymous hands.`) +
        `${driftRules}\n` +
        `Output STRICT JSON {"conceptPromptEn":"<fixed prompt>","noteVi":"<1 short VIETNAMESE line for the operator>"}.`,
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

/** The user always writes/thinks in Vietnamese. Right before TTS, normalise the spoken line
 *  into the chosen MARKET language (natural native spoken style, NOT a literal translation).
 *  No-op when the market is Vietnamese or the line is empty. ~1 tiny Gemini call. */
export async function translateLineForMarket(line: string, lang: ScriptLang, geminiKey: string): Promise<string> {
  const text = line.trim()
  if (!text || lang === 'vi' || !geminiKey) return text
  const langName = SCRIPT_LANG_GEMINI_NAME[lang]
  try {
    const raw = await directGeminiText({
      apiKey: geminiKey,
      systemInstruction:
        `Rewrite the user's line into ${langName} as a NATIVE, natural spoken line for a short UGC ad ` +
        `(localise the meaning + tone, do NOT translate word-for-word, keep it punchy and the same length feel). ` +
        `Keep brand names and numbers as-is. Output ONLY the final line — no quotes, no notes, no alternatives.`,
      prompt: text,
      maxOutputTokens: 200, temperature: 0.4, thinkingBudget: 0,
    })
    const out = raw.trim().replace(/^["'“”]|["'“”]$/g, '').trim()
    return out || text
  } catch {
    return text   // on failure, fall back to the original line (better than blocking the render)
  }
}
