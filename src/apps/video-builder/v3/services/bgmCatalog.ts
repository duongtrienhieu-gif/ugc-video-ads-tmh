// ── BGM Catalog ──────────────────────────────────────────────────────────────
// Z34 §7 — 5 background music styles (+ 'none'). Voice is ALWAYS prioritised
// (BGM volume capped at 0.25 universally; styles vary 0.08-0.22).
//
// Placeholder URLs for development — bundle / CDN-host real tracks later.
// Preview player gracefully no-ops if URL fails.
// ─────────────────────────────────────────────────────────────────────────────

import type { BgmStyleId } from '../types'

export interface BgmConfig {
  id: BgmStyleId
  labelVi: string
  emoji: string
  descriptionVi: string
  /** UI tint */
  tone: 'violet' | 'amber' | 'rose' | 'sky' | 'emerald' | 'pink'
  /** Default loop volume (voice priority — max 0.25) */
  defaultVolume: number
  /** Track URL (placeholder for now) */
  url: string | null
  /** Fade-in seconds at video start */
  fadeInSec: number
  /** Fade-out seconds before video end */
  fadeOutSec: number
}

export const BGM_CATALOG: Record<BgmStyleId, BgmConfig> = {
  none: {
    id: 'none',
    labelVi: 'Tắt BGM',
    emoji: '🔇',
    descriptionVi: 'Không có nhạc nền — chỉ voice + SFX.',
    tone: 'sky',
    defaultVolume: 0,
    url: null,
    fadeInSec: 0,
    fadeOutSec: 0,
  },

  tiktok_upbeat: {
    id: 'tiktok_upbeat',
    labelVi: 'TikTok upbeat',
    emoji: '🎵',
    descriptionVi: 'Nhịp nhanh viral TikTok — cho hook mạnh / direct response.',
    tone: 'pink',
    defaultVolume: 0.18,
    url: '/bgm/tiktok-upbeat.mp3',
    fadeInSec: 0.5,
    fadeOutSec: 1.0,
  },

  emotional_soft: {
    id: 'emotional_soft',
    labelVi: 'Cảm xúc nhẹ',
    emoji: '💗',
    descriptionVi: 'Piano + strings mềm — cho confession / vulnerability.',
    tone: 'rose',
    defaultVolume: 0.20,
    url: '/bgm/emotional-soft.mp3',
    fadeInSec: 1.0,
    fadeOutSec: 1.5,
  },

  authority_clean: {
    id: 'authority_clean',
    labelVi: 'Chuyên gia clean',
    emoji: '🩺',
    descriptionVi: 'Beat nhẹ + clean piano — cho expert / educational.',
    tone: 'sky',
    defaultVolume: 0.10,
    url: '/bgm/authority-clean.mp3',
    fadeInSec: 0.5,
    fadeOutSec: 1.0,
  },

  energetic_creator: {
    id: 'energetic_creator',
    labelVi: 'Creator năng động',
    emoji: '⚡',
    descriptionVi: 'EDM nhẹ + drum kick — cho aggressive sales / shock hook.',
    tone: 'amber',
    defaultVolume: 0.22,
    url: '/bgm/energetic-creator.mp3',
    fadeInSec: 0.3,
    fadeOutSec: 0.8,
  },

  ambient_lifestyle: {
    id: 'ambient_lifestyle',
    labelVi: 'Ambient lifestyle',
    emoji: '🌸',
    descriptionVi: 'Lo-fi / ambient — cho beauty / wellness / luxury soft.',
    tone: 'violet',
    defaultVolume: 0.15,
    url: '/bgm/ambient-lifestyle.mp3',
    fadeInSec: 1.5,
    fadeOutSec: 2.0,
  },
}

export const BGM_ORDER: BgmStyleId[] = [
  'tiktok_upbeat',
  'energetic_creator',
  'authority_clean',
  'emotional_soft',
  'ambient_lifestyle',
  'none',
]
