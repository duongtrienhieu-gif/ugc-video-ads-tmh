// ── Creator Presets ──────────────────────────────────────────────────────────
// Z32 §9 — reusable shortcuts that combine setting + energy + wardrobe.
// One click → fills 3 fields at once. User can still override individually.
//
// Z41 — AI Stylist: styleCreatorWithGemini() reads the product + market +
// ad angle + avatar + hook and AUTO-COMPOSES the best believable creator
// persona (setting + energy + wardrobe). Mirrors the Bước 2 director: a single
// cheap Gemini text call, NO image/video render, so it spends zero KIE credit.
// ─────────────────────────────────────────────────────────────────────────────

import { directGeminiText } from '../../../../utils/gemini'
import type { Product } from '../../../../stores/types'
import type {
  CreatorPresetId, CreatorSettingId, CreatorEnergyLevel,
  AdAngle, ScriptLang,
} from '../types'
import { SCRIPT_LANG_GEMINI_NAME } from '../types'
import {
  CREATOR_SETTINGS, CREATOR_SETTING_ORDER,
} from './creatorSettings'
import {
  CREATOR_ENERGIES, CREATOR_ENERGY_ORDER, recommendEnergyForAngle,
} from './creatorEnergy'

export interface CreatorPresetConfig {
  id: CreatorPresetId
  labelVi: string
  descriptionVi: string
  emoji: string
  setting: CreatorSettingId
  energy: CreatorEnergyLevel
  /** Wardrobe + style note appended to the keyframe prompt */
  wardrobeNote: string
  /** UI tint */
  tone: 'rose' | 'pink' | 'amber' | 'sky' | 'violet' | 'emerald'
}

export const CREATOR_PRESETS: Record<CreatorPresetId, CreatorPresetConfig> = {
  malay_mom_casual: {
    id: 'malay_mom_casual',
    labelVi: 'Mẹ Malay casual',
    descriptionVi: 'Mẹ Hồi giáo Malaysia, hijab pastel, ngồi bếp / sofa nhà.',
    emoji: '🧕',
    setting: 'kitchen_talking',
    energy: 'conversational',
    wardrobeNote:
      'Soft pastel hijab (lilac, blush, or sage), simple cotton home blouse, ' +
      'minimal jewelry. Natural makeup. Mid-30s Malay Muslim mother vibe.',
    tone: 'rose',
  },

  skincare_creator: {
    id: 'skincare_creator',
    labelVi: 'Creator skincare',
    descriptionVi: 'Selfie phòng tắm gương, vibe morning routine.',
    emoji: '🪞',
    setting: 'bathroom_mirror',
    energy: 'conversational',
    wardrobeNote:
      'Fresh-faced, hair down or in casual top knot. Light camisole or silk robe. ' +
      'Minimal makeup, dewy skin (real, not filter). Late-20s feminine creator vibe.',
    tone: 'pink',
  },

  gym_coach: {
    id: 'gym_coach',
    labelVi: 'Huấn luyện gym',
    descriptionVi: 'Selfie gym sau workout, tone authority.',
    emoji: '💪',
    setting: 'gym_selfie',
    energy: 'authority',
    wardrobeNote:
      'Athletic compression top or tank, slight sweat sheen. Hair pulled back. ' +
      'Lean fit build, late-20s to early-30s. Subtle gym-rat confidence.',
    tone: 'amber',
  },

  office_woman: {
    id: 'office_woman',
    labelVi: 'Nhân viên văn phòng',
    descriptionVi: 'Ngồi bàn làm việc, blouse + tóc gọn, conversational.',
    emoji: '💼',
    setting: 'desk_talking',
    energy: 'conversational',
    wardrobeNote:
      'Crisp light blouse or soft blazer over a tee. Hair tucked behind ear. ' +
      'Subtle gold/silver accent (small earrings). Late-20s to mid-30s working professional.',
    tone: 'sky',
  },

  tech_reviewer: {
    id: 'tech_reviewer',
    labelVi: 'Tech reviewer',
    descriptionVi: 'Ngồi bàn, sản phẩm trên tay, tone authority + excited.',
    emoji: '📱',
    setting: 'product_demo',
    energy: 'excited',
    wardrobeNote:
      'Plain dark t-shirt or hoodie, headphones around neck or on desk. ' +
      'Hair slightly messy / casual. Late-20s gadget-enthusiast vibe.',
    tone: 'violet',
  },

  young_tiktok_girl: {
    id: 'young_tiktok_girl',
    labelVi: 'Gen Z TikTok',
    descriptionVi: 'Selfie phòng ngủ, high-energy, aggressive TikTok creator.',
    emoji: '⚡',
    setting: 'selfie_handheld',
    energy: 'aggressive_tiktok',
    wardrobeNote:
      'Trendy crop top or oversized tee, hair down with chunky claw clip or low pony. ' +
      'Heavy eyeliner / glossy lip but skin still real. Early-20s TikTok creator vibe.',
    tone: 'pink',
  },
}

export const CREATOR_PRESET_ORDER: CreatorPresetId[] = [
  'malay_mom_casual',
  'skincare_creator',
  'office_woman',
  'gym_coach',
  'tech_reviewer',
  'young_tiktok_girl',
]

// ── Z41 AI Stylist ─────────────────────────────────────────────────────────
// Reads the campaign context and auto-composes the most believable creator
// persona. Output maps straight into CreatorVideoConfig (setting / energy /
// wardrobeNote). The avatar's FACE is locked by the keyframe reference, so the
// stylist only decides environment, expression energy, and clothing/style — it
// must NOT redescribe the person's face or identity.

export interface CreatorStyleParams {
  geminiKey: string
  product: Product | null
  avatarName?: string
  avatarNotes?: string
  angle: AdAngle
  /** The hook / opening line — gives the stylist the tone of the script. */
  scriptHook?: string
  lang: ScriptLang
}

export interface CreatorStyleResult {
  setting: CreatorSettingId
  energy: CreatorEnergyLevel
  /** English style note for the keyframe prompt (clothing / styling only). */
  wardrobeNote: string
  /** One short phrase in the script language explaining the choice. */
  reason: string
}

const STYLE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    setting:      { type: 'string', enum: CREATOR_SETTING_ORDER },
    energy:       { type: 'string', enum: CREATOR_ENERGY_ORDER },
    wardrobeNote: { type: 'string' },
    reason:       { type: 'string' },
  },
  required: ['setting', 'energy', 'wardrobeNote', 'reason'],
}

export async function styleCreatorWithGemini(
  params: CreatorStyleParams,
): Promise<CreatorStyleResult> {
  const langName = SCRIPT_LANG_GEMINI_NAME[params.lang]
  const settingCatalogue = CREATOR_SETTING_ORDER
    .map((id) => `- ${id}: ${CREATOR_SETTINGS[id].descriptionVi}`)
    .join('\n')
  const energyCatalogue = CREATOR_ENERGY_ORDER
    .map((id) => `- ${id}: ${CREATOR_ENERGIES[id].descriptionVi}`)
    .join('\n')

  const p = params.product
  const productBlock = p
    ? [
        `Product name: ${p.productName}`,
        p.productDescription && `Description: ${p.productDescription}`,
        p.targetMarket && `Target market: ${p.targetMarket}`,
        p.painPoints && `Pain points: ${p.painPoints}`,
        p.benefits && `Benefits: ${p.benefits}`,
      ].filter(Boolean).join('\n')
    : '(no product details provided)'

  const avatarBlock = [
    params.avatarName && `Avatar name: ${params.avatarName}`,
    params.avatarNotes && `Avatar notes: ${params.avatarNotes}`,
  ].filter(Boolean).join('\n') || '(no avatar notes)'

  const systemInstruction = `You are a UGC ad CREATIVE DIRECTOR / stylist. You cast the most
believable creator persona for a short vertical (9:16) talking-head ad.

You decide THREE things only:
1. setting — the room / framing the creator films in (pick ONE id):
${settingCatalogue}
2. energy — the creator's expression + pacing (pick ONE id):
${energyCatalogue}
3. wardrobeNote — a short ENGLISH note describing clothing + styling ONLY
   (fabric, garment, accessories, hair styling, grooming vibe). It is appended
   to an image prompt. The creator's FACE and IDENTITY are already locked by a
   reference photo — so DO NOT describe facial features, ethnicity, or identity.
   Make it realistic and market-appropriate, NOT a fashion-shoot look.

RULES:
- Match the persona to the PRODUCT, its TARGET MARKET, and the ad ANGLE so it
  feels like a real customer of this product filmed themselves. (e.g. a Muslim
  Malaysia health-supplement audience → modest home setting + soft hijab styling.)
- The reason must be ONE short phrase written in ${langName} (shown to the user).
- Output strict JSON, no fences:
{ "setting": "...", "energy": "...", "wardrobeNote": "...", "reason": "..." }`

  const userPrompt = [
    `PRODUCT:\n${productBlock}`,
    `\nAD ANGLE: ${params.angle}`,
    `\nCREATOR AVATAR:\n${avatarBlock}`,
    params.scriptHook ? `\nSCRIPT HOOK (tone reference): ${params.scriptHook}` : '',
    `\nCast the persona now.`,
  ].join('\n')

  const raw = await directGeminiText({
    apiKey: params.geminiKey,
    systemInstruction,
    prompt: userPrompt,
    maxOutputTokens: 512,
    responseMimeType: 'application/json',
    responseSchema: STYLE_RESPONSE_SCHEMA,
  })

  return parseStyleOutput(raw, params.angle)
}

function parseStyleOutput(raw: string, angle: AdAngle): CreatorStyleResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()
    try { parsed = JSON.parse(cleaned) } catch { parsed = {} }
  }
  const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>

  const validSettings = new Set<string>(CREATOR_SETTING_ORDER)
  const validEnergies = new Set<string>(CREATOR_ENERGY_ORDER)

  const setting = typeof obj.setting === 'string' && validSettings.has(obj.setting)
    ? (obj.setting as CreatorSettingId)
    : 'selfie_handheld'
  // Fall back to the rule-based angle→energy map if the model returned junk.
  const energy = typeof obj.energy === 'string' && validEnergies.has(obj.energy)
    ? (obj.energy as CreatorEnergyLevel)
    : recommendEnergyForAngle(angle)
  const wardrobeNote = typeof obj.wardrobeNote === 'string' ? obj.wardrobeNote.trim() : ''
  const reason = typeof obj.reason === 'string' ? obj.reason.trim() : ''

  return { setting, energy, wardrobeNote, reason }
}
