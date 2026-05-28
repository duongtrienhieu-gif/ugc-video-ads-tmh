// ── Creator Presets ──────────────────────────────────────────────────────────
// Z32 §9 — reusable shortcuts that combine setting + energy + wardrobe.
// One click → fills 3 fields at once. User can still override individually.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CreatorPresetId, CreatorSettingId, CreatorEnergyLevel,
} from '../types'

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
