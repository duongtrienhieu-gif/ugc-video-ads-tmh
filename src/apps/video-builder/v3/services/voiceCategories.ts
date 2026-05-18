// ── Voice Categories ─────────────────────────────────────────────────────────
// Z31 §7 — abstract voice categories the matcher uses. Each category maps
// to a recommended ElevenLabs voice id (or other TTS provider id).
//
// The mapping is INTENTIONALLY soft — ElevenLabs voice IDs change, voices
// get deprecated, users may use their own cloned voices. The matcher picks
// the CATEGORY (deterministic) and the voice picker UI lets the user
// choose a specific voice within that category.
// ─────────────────────────────────────────────────────────────────────────────

import type { VoiceCategoryId } from '../types'

export interface VoiceCategoryConfig {
  id: VoiceCategoryId
  labelVi: string
  descriptionVi: string
  emoji: string
  /** Default ElevenLabs voice id for this category. May be a placeholder
   *  string until the user picks a specific voice from the picker. */
  defaultVoiceId: string
  /** Pacing hint — affects voice-timing estimation. Calm voices read slower. */
  wpmHint: number
  /** UI tone */
  tone: 'rose' | 'pink' | 'amber' | 'sky' | 'emerald' | 'violet'
}

/**
 * Voice category catalogue. The defaultVoiceId values here are ElevenLabs
 * pre-made voice IDs that are widely available — caller can override these
 * via the voice picker later.
 */
export const VOICE_CATEGORIES: Record<VoiceCategoryId, VoiceCategoryConfig> = {
  calm_female: {
    id: 'calm_female',
    labelVi: 'Nữ điềm tĩnh',
    descriptionVi: 'Giọng nữ nhẹ, mềm, có khoảng nghỉ — phù hợp tone tâm sự, educational.',
    emoji: '🌸',
    defaultVoiceId: 'EXAVITQu4vr4xnSDxMaL',  // ElevenLabs Bella
    wpmHint: 145,
    tone: 'rose',
  },

  energetic_creator: {
    id: 'energetic_creator',
    labelVi: 'Creator năng động',
    descriptionVi: 'Tone bùng nổ, nhanh, native TikTok — phù hợp direct response + curiosity.',
    emoji: '⚡',
    defaultVoiceId: 'pNInz6obpgDQGcFmaJgB',  // ElevenLabs Adam (placeholder — swap to energetic voice)
    wpmHint: 170,
    tone: 'pink',
  },

  authority_male: {
    id: 'authority_male',
    labelVi: 'Nam chuyên gia',
    descriptionVi: 'Giọng nam tự tin, có kiến thức — bác sĩ, dược sĩ, huấn luyện viên.',
    emoji: '🩺',
    defaultVoiceId: 'TxGEqnHWrfWFTfGW9XjX',  // ElevenLabs Josh
    wpmHint: 150,
    tone: 'sky',
  },

  emotional_mom: {
    id: 'emotional_mom',
    labelVi: 'Mẹ tâm sự',
    descriptionVi: 'Giọng nữ ấm áp, kiểu mẹ kể chuyện — phù hợp emotional / parenting / wellness.',
    emoji: '🤱',
    defaultVoiceId: 'AZnzlk1XvdvUeBnXmlld',  // ElevenLabs Domi
    wpmHint: 140,
    tone: 'rose',
  },

  skincare_influencer: {
    id: 'skincare_influencer',
    labelVi: 'Influencer skincare',
    descriptionVi: 'Tone trẻ trung, "girly", confident — beauty / cosmetics niche.',
    emoji: '💄',
    defaultVoiceId: 'EXAVITQu4vr4xnSDxMaL',  // ElevenLabs Bella (re-used for now)
    wpmHint: 160,
    tone: 'pink',
  },

  gym_creator: {
    id: 'gym_creator',
    labelVi: 'Creator gym',
    descriptionVi: 'Tone nam mạnh, motivational — fitness / supplement / sport.',
    emoji: '💪',
    defaultVoiceId: 'pNInz6obpgDQGcFmaJgB',  // ElevenLabs Adam
    wpmHint: 165,
    tone: 'amber',
  },
}

export const VOICE_CATEGORY_ORDER: VoiceCategoryId[] = [
  'energetic_creator',
  'calm_female',
  'emotional_mom',
  'authority_male',
  'skincare_influencer',
  'gym_creator',
]
