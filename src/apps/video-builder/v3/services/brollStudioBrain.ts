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
