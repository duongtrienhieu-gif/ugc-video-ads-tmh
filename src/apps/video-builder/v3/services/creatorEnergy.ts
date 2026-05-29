// ── Creator Energy Levels ────────────────────────────────────────────────────
// Z32 §13 — 6 energy presets that affect expression / pacing / head
// movement / speech behaviour. Applied as a prompt fragment on top of
// the setting's environment prompt.
//
// The energy ALSO influences the chosen ad angle from Phase 2 — the UI
// auto-suggests an energy that matches the picked AdAngle, but the user
// can override.
// ─────────────────────────────────────────────────────────────────────────────

import type { CreatorEnergyLevel, AdAngle } from '../types'

export interface CreatorEnergyConfig {
  id: CreatorEnergyLevel
  labelVi: string
  descriptionVi: string
  emoji: string
  /** Prompt fragment describing expression + pacing + body language */
  expressionPrompt: string
  /** Suggested motion intensity 0-100 — lipsync wrapper can use as hint */
  motionIntensity: number
  /** UI tint */
  tone: 'rose' | 'sky' | 'amber' | 'pink' | 'violet' | 'emerald'
}

export const CREATOR_ENERGIES: Record<CreatorEnergyLevel, CreatorEnergyConfig> = {
  calm: {
    id: 'calm',
    labelVi: 'Điềm tĩnh',
    descriptionVi: 'Tone nhẹ, chậm rãi — phù hợp wellness, emotional, educational.',
    emoji: '🌿',
    expressionPrompt:
      'Speaker has a calm, soft expression. Measured pacing. Minimal head movement. ' +
      'Eyes hold gaze with camera. Slow blinks. Small relaxed smile at the corners. ' +
      'No dramatic gestures, no shifting around.',
    motionIntensity: 20,
    tone: 'sky',
  },

  conversational: {
    id: 'conversational',
    labelVi: 'Tự nhiên',
    descriptionVi: 'Tone đời thường, vừa phải — mặc định, hợp đa số ad.',
    emoji: '💬',
    expressionPrompt:
      'Speaker has a natural conversational expression. Normal pacing — like chatting with ' +
      'a friend. Occasional head nod or tilt. Hands enter frame to gesture briefly. ' +
      'Eye contact with camera throughout, occasional micro-glance away. Natural blinks.',
    motionIntensity: 35,
    tone: 'violet',
  },

  excited: {
    id: 'excited',
    labelVi: 'Hào hứng',
    descriptionVi: 'Upbeat, energetic — cho hook / curiosity / discovery moment.',
    emoji: '✨',
    expressionPrompt:
      'Speaker is genuinely excited — slight smile, eyes wider than usual, eyebrows up briefly ' +
      'at key moments. Faster pacing. More visible hand gestures entering frame. Head moves ' +
      'with the rhythm of speech. Still natural, NOT exaggerated TV-host energy.',
    motionIntensity: 55,
    tone: 'amber',
  },

  emotional: {
    id: 'emotional',
    labelVi: 'Cảm xúc',
    descriptionVi: 'Vulnerable, chân thật — cho confession / pain-point / testimonial.',
    emoji: '💗',
    expressionPrompt:
      'Speaker has a vulnerable, sincere expression. Slower pacing with micro-pauses. ' +
      'Occasionally looks away briefly (processing). Slight head tilt downward. Soft eye ' +
      'contact. Eyebrows may furrow slightly during the heavier lines. Subtle, not theatrical.',
    motionIntensity: 25,
    tone: 'rose',
  },

  authority: {
    id: 'authority',
    labelVi: 'Chuyên gia',
    descriptionVi: 'Tự tin, có kiến thức — cho expert / authority angle.',
    emoji: '🎓',
    expressionPrompt:
      'Speaker has a confident, measured expression. Direct steady eye contact. Minimal but ' +
      'precise gestures — uses hands to count off points. Posture upright. Voice steady, ' +
      'pauses are deliberate, not hesitant. Slight smile occasionally — friendly authority, ' +
      'NOT cold lecturing.',
    motionIntensity: 30,
    tone: 'sky',
  },

  aggressive_tiktok: {
    id: 'aggressive_tiktok',
    labelVi: 'TikTok mạnh',
    descriptionVi: 'High-energy creator vibe — cho direct response / shock hook.',
    emoji: '⚡',
    expressionPrompt:
      'Speaker has a high-energy TikTok creator vibe. Faster pacing — almost cutting their ' +
      'own sentences. Wide eyes, eyebrows up frequently. Lots of gestures entering frame. ' +
      'Head movement, slight body lean toward camera. Occasionally taps the screen edge. ' +
      'Still believable as one person on a phone, NOT a stage performer.',
    motionIntensity: 65,
    tone: 'pink',
  },
}

export const CREATOR_ENERGY_ORDER: CreatorEnergyLevel[] = [
  'conversational',
  'excited',
  'emotional',
  'calm',
  'authority',
  'aggressive_tiktok',
]

// ── Ad-angle → recommended energy mapping ────────────────────────────────
// Used by the UI to AUTO-SUGGEST the energy after the user picks an angle
// in Phase 2. User can override in Phase 3.

const ANGLE_ENERGY_DEFAULTS: Record<AdAngle, CreatorEnergyLevel> = {
  emotional:        'emotional',
  authority:        'authority',
  testimonial:      'conversational',
  problem_solution: 'conversational',
  curiosity:        'excited',
  direct_response:  'aggressive_tiktok',
  native_tiktok:    'conversational',
  educational:      'authority',
}

export function recommendEnergyForAngle(angle: AdAngle): CreatorEnergyLevel {
  return ANGLE_ENERGY_DEFAULTS[angle] ?? 'conversational'
}
