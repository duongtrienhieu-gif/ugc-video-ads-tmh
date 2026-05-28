// ── Editing Styles ───────────────────────────────────────────────────────────
// Z34 §10 — 7 preset editing styles. Each style is a bundle of pacing,
// caption emphasis, SFX density, BGM volume, and punch-zoom intensity
// rules that the autoEditPlanner reads.
//
// Style selection drives EVERY decision in the planner — there's no
// "default mix" of features. Pick ONE style, get a coherent edit.
//
// Anti-pattern (Z34 §11): DO NOT over-edit. Every style has a
// `breathingFactor` (0-1) that preserves natural pauses. Hyperactive
// chaos editing kills retention even faster than slow pacing does.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  EditingStyleId, SubtitleStyleId, BgmStyleId,
} from '../types'

export interface EditingStyleConfig {
  id: EditingStyleId
  labelVi: string
  descriptionVi: string
  emoji: string
  /** UI tint */
  tone: 'violet' | 'amber' | 'emerald' | 'sky' | 'rose' | 'pink'
  /** Target cut frequency — how often a cut happens (seconds between cuts) */
  cutEverySec: number
  /** Punch-zoom intensity 0-1 (0 = no zooms, 1 = every emphasis) */
  zoomIntensity: number
  /** SFX density 0-1 (0 = silent, 1 = SFX on every transition) */
  sfxDensity: number
  /** BGM volume 0-1 (voice always priority — most stay 0.1-0.2) */
  bgmVolume: number
  /** Caption emphasis frequency 0-1 (how often words get highlighted) */
  captionEmphasisRate: number
  /** Breathing factor 0-1. Higher = preserve more pauses, less aggressive */
  breathingFactor: number
  /** Recommended subtitle style (user can override) */
  defaultSubtitleStyle: SubtitleStyleId
  /** Recommended BGM style (user can override) */
  defaultBgmStyle: BgmStyleId
  /** Insert overlay duration (how long each B-roll insert plays over creator video) */
  insertOverlayDurationSec: number
  /** Whether to apply hook-emphasis treatment to the first 1-3s (Z34 §8) */
  applyHookEmphasis: boolean
  /** Whether to apply CTA overlay at the end (Z34 §9) */
  applyCtaOverlay: boolean
}

export const EDITING_STYLES: Record<EditingStyleId, EditingStyleConfig> = {
  native_tiktok: {
    id: 'native_tiktok',
    labelVi: 'Native TikTok',
    descriptionVi: 'Mặc định — pacing tự nhiên, caption bold creator, SFX vừa phải. An toàn cho mọi ad.',
    emoji: '📱',
    tone: 'violet',
    cutEverySec: 3.0,
    zoomIntensity: 0.5,
    sfxDensity: 0.3,
    bgmVolume: 0.15,
    captionEmphasisRate: 0.3,
    breathingFactor: 0.6,
    defaultSubtitleStyle: 'bold_creator',
    defaultBgmStyle: 'tiktok_upbeat',
    insertOverlayDurationSec: 2.0,
    applyHookEmphasis: true,
    applyCtaOverlay: true,
  },

  fast_ugc: {
    id: 'fast_ugc',
    labelVi: 'Fast UGC',
    descriptionVi: 'Cuts dày, caption nhiều, SFX cao — đập vào mặt, dừng scroll mạnh.',
    emoji: '⚡',
    tone: 'amber',
    cutEverySec: 1.5,
    zoomIntensity: 0.7,
    sfxDensity: 0.6,
    bgmVolume: 0.2,
    captionEmphasisRate: 0.5,
    breathingFactor: 0.3,
    defaultSubtitleStyle: 'aggressive_tiktok',
    defaultBgmStyle: 'energetic_creator',
    insertOverlayDurationSec: 1.5,
    applyHookEmphasis: true,
    applyCtaOverlay: true,
  },

  emotional_story: {
    id: 'emotional_story',
    labelVi: 'Câu chuyện cảm xúc',
    descriptionVi: 'Pacing chậm, breathing nhiều, caption mềm, BGM emotional. Cho confession / vulnerability.',
    emoji: '💗',
    tone: 'rose',
    cutEverySec: 4.5,
    zoomIntensity: 0.3,
    sfxDensity: 0.1,
    bgmVolume: 0.18,
    captionEmphasisRate: 0.15,
    breathingFactor: 0.9,
    defaultSubtitleStyle: 'clean_ugc',
    defaultBgmStyle: 'emotional_soft',
    insertOverlayDurationSec: 2.5,
    applyHookEmphasis: false,
    applyCtaOverlay: true,
  },

  authority_review: {
    id: 'authority_review',
    labelVi: 'Review chuyên gia',
    descriptionVi: 'Pacing đều, caption sạch, SFX thưa, BGM clean — tone bác sĩ / chuyên gia.',
    emoji: '🩺',
    tone: 'sky',
    cutEverySec: 3.5,
    zoomIntensity: 0.4,
    sfxDensity: 0.15,
    bgmVolume: 0.1,
    captionEmphasisRate: 0.25,
    breathingFactor: 0.7,
    defaultSubtitleStyle: 'minimal',
    defaultBgmStyle: 'authority_clean',
    insertOverlayDurationSec: 2.2,
    applyHookEmphasis: true,
    applyCtaOverlay: true,
  },

  soft_lifestyle: {
    id: 'soft_lifestyle',
    labelVi: 'Lifestyle nhẹ',
    descriptionVi: 'Gentle, BGM ambient, caption tối thiểu — cho beauty / wellness premium.',
    emoji: '🌸',
    tone: 'pink',
    cutEverySec: 5.0,
    zoomIntensity: 0.2,
    sfxDensity: 0.05,
    bgmVolume: 0.22,
    captionEmphasisRate: 0.1,
    breathingFactor: 0.95,
    defaultSubtitleStyle: 'minimal',
    defaultBgmStyle: 'ambient_lifestyle',
    insertOverlayDurationSec: 3.0,
    applyHookEmphasis: false,
    applyCtaOverlay: true,
  },

  aggressive_sales: {
    id: 'aggressive_sales',
    labelVi: 'Bán hàng mạnh',
    descriptionVi: 'Cuts mỗi 1-2s, ALL-CAPS caption, hard SFX. Cho direct response / COD / promo nóng.',
    emoji: '🔥',
    tone: 'pink',
    cutEverySec: 1.2,
    zoomIntensity: 0.9,
    sfxDensity: 0.8,
    bgmVolume: 0.25,
    captionEmphasisRate: 0.7,
    breathingFactor: 0.2,
    defaultSubtitleStyle: 'aggressive_tiktok',
    defaultBgmStyle: 'tiktok_upbeat',
    insertOverlayDurationSec: 1.2,
    applyHookEmphasis: true,
    applyCtaOverlay: true,
  },

  clean_minimal: {
    id: 'clean_minimal',
    labelVi: 'Tinh giản',
    descriptionVi: 'Không SFX, không zoom, caption thưa — cho premium / luxury / quiet authority.',
    emoji: '⚪',
    tone: 'sky',
    cutEverySec: 6.0,
    zoomIntensity: 0,
    sfxDensity: 0,
    bgmVolume: 0.08,
    captionEmphasisRate: 0,
    breathingFactor: 1.0,
    defaultSubtitleStyle: 'minimal',
    defaultBgmStyle: 'none',
    insertOverlayDurationSec: 3.0,
    applyHookEmphasis: false,
    applyCtaOverlay: false,
  },
}

export const EDITING_STYLE_ORDER: EditingStyleId[] = [
  'native_tiktok',
  'fast_ugc',
  'aggressive_sales',
  'authority_review',
  'emotional_story',
  'soft_lifestyle',
  'clean_minimal',
]

// ── Subtitle style configs (visual rendering hints) ───────────────────────

export interface SubtitleStyleConfig {
  id: SubtitleStyleId
  labelVi: string
  /** CSS-friendly font weight + size hint for the player */
  fontWeight: 'normal' | 'bold' | 'extrabold'
  fontSizePx: number
  /** Text color */
  color: string
  /** Stroke / shadow color */
  outlineColor: string
  /** ALL CAPS? */
  uppercase: boolean
  /** Position from bottom (px) */
  bottomOffsetPx: number
}

export const SUBTITLE_STYLES: Record<SubtitleStyleId, SubtitleStyleConfig> = {
  bold_creator: {
    id: 'bold_creator',
    labelVi: 'Bold creator',
    fontWeight: 'bold',
    fontSizePx: 48,
    color: '#FFFFFF',
    outlineColor: '#000000',
    uppercase: false,
    bottomOffsetPx: 180,
  },
  minimal: {
    id: 'minimal',
    labelVi: 'Tối giản',
    fontWeight: 'normal',
    fontSizePx: 32,
    color: '#FFFFFF',
    outlineColor: '#000000',
    uppercase: false,
    bottomOffsetPx: 140,
  },
  aggressive_tiktok: {
    id: 'aggressive_tiktok',
    labelVi: 'TikTok mạnh',
    fontWeight: 'extrabold',
    fontSizePx: 56,
    color: '#FBBF24',  // tailwind amber-400
    outlineColor: '#000000',
    uppercase: true,
    bottomOffsetPx: 200,
  },
  clean_ugc: {
    id: 'clean_ugc',
    labelVi: 'UGC sạch',
    fontWeight: 'bold',
    fontSizePx: 40,
    color: '#F8FAFC',  // tailwind slate-50
    outlineColor: '#1E293B',
    uppercase: false,
    bottomOffsetPx: 160,
  },
  none: {
    id: 'none',
    labelVi: 'Tắt',
    fontWeight: 'normal',
    fontSizePx: 0,
    color: 'transparent',
    outlineColor: 'transparent',
    uppercase: false,
    bottomOffsetPx: 0,
  },
}
