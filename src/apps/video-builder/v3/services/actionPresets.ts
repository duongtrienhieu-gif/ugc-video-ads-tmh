// ── Action Preset Engine ─────────────────────────────────────────────────────
// Z30 PHASE 1 — controlled motion primitives for action inserts.
//
// Replaces the v2 "freeform motion blueprint" matrix. Every action insert
// in v3 picks ONE preset from this catalogue — the renderer reads the
// preset to produce a stable, consistent prompt + framing + duration.
//
// Each preset encodes:
//   • motionPreset   — Kling-safe motion verb
//   • framingPreset  — shot composition (closeup / medium / handheld / etc)
//   • promptPreset   — base English prompt sent to Kling
//   • durationPreset — clip length (seconds)
//   • cameraPreset   — static / handheld / locked-off
//
// Stability over creativity. No "punch zoom into bottle", no "orbit
// around hero" — those produced unstable hands + drifting product in
// previous tests. Every preset here is a SAFE motion that Kling reliably
// renders without identity drift.
// ─────────────────────────────────────────────────────────────────────────────

import type { ActionPresetId } from '../types'
import type { KlingSafeMotion } from '../../v2/types'

export interface ActionPresetConfig {
  id: ActionPresetId
  /** Vietnamese user-facing label */
  labelVi: string
  /** What the insert shows (Vietnamese) */
  descriptionVi: string
  /** Emoji shown on the picker card */
  emoji: string
  /** Kling-safe motion */
  motionPreset: KlingSafeMotion
  /** Framing — composition cue inserted into the prompt */
  framingPreset: 'closeup' | 'medium' | 'wide' | 'handheld' | 'macro' | 'top_down'
  /** Base prompt fragment in English. Caller appends product-specific
   *  detail (e.g. product name + label) before Kling submission. */
  promptPreset: string
  /** Default clip duration in seconds. Kling minimum is 5s — but the
   *  compositor trims to this value during auto-edit. */
  durationPreset: number
  /** Camera style — drives motion intensity */
  cameraPreset: 'static' | 'handheld' | 'subtle_drift'
  /** Whether this preset NEEDS the product image as a reference (vs
   *  the avatar shot). Some inserts are scene-only — e.g. phone scroll
   *  doesn't need a product on screen. */
  needsProduct: boolean
  /** UI tint */
  tone: 'amber' | 'violet' | 'emerald' | 'rose' | 'sky'
}

export const ACTION_PRESETS: Record<ActionPresetId, ActionPresetConfig> = {
  HOLD_PRODUCT: {
    id: 'HOLD_PRODUCT',
    labelVi: 'Cầm sản phẩm',
    descriptionVi: 'Creator giơ sản phẩm ngang ngực, ánh mắt nhìn camera',
    emoji: '🤲',
    motionPreset: 'static',
    framingPreset: 'medium',
    promptPreset:
      'Person holds product steadily at chest level, eyes looking at camera, ' +
      'natural smile, subtle micro-movements, identical face and packaging as input image. ' +
      'No camera movement, locked-off framing.',
    durationPreset: 3.0,
    cameraPreset: 'static',
    needsProduct: true,
    tone: 'violet',
  },

  OPEN_CAP: {
    id: 'OPEN_CAP',
    labelVi: 'Mở nắp',
    descriptionVi: 'Tay xoay mở nắp chai/lọ sản phẩm',
    emoji: '🔓',
    motionPreset: 'handheld',
    framingPreset: 'closeup',
    promptPreset:
      'Hands rotate and remove the cap of the product bottle, smooth controlled motion, ' +
      'product label fully readable, fingers do not obscure the brand name, ' +
      'natural daylight, identical packaging as input image.',
    durationPreset: 2.5,
    cameraPreset: 'handheld',
    needsProduct: true,
    tone: 'emerald',
  },

  POINT_LABEL: {
    id: 'POINT_LABEL',
    labelVi: 'Chỉ vào nhãn',
    descriptionVi: 'Ngón tay chỉ vào label sản phẩm, nhấn mạnh tên thương hiệu',
    emoji: '👉',
    motionPreset: 'zoom_in',
    framingPreset: 'closeup',
    promptPreset:
      'Index finger taps and points at the product label, drawing attention to brand text, ' +
      'subtle slow zoom toward the label, every letter on the label remains readable, ' +
      'identical packaging as input image.',
    durationPreset: 2.5,
    cameraPreset: 'subtle_drift',
    needsProduct: true,
    tone: 'amber',
  },

  DRINK: {
    id: 'DRINK',
    labelVi: 'Uống / Nếm thử',
    descriptionVi: 'Creator uống/nếm sản phẩm, vẻ mặt hài lòng',
    emoji: '🥤',
    motionPreset: 'static',
    framingPreset: 'medium',
    promptPreset:
      'Person takes a calm sip from the product, swallows, expression of satisfaction, ' +
      'natural pacing, no exaggerated reaction, identical face as input image.',
    durationPreset: 3.0,
    cameraPreset: 'static',
    needsProduct: true,
    tone: 'sky',
  },

  TAKE_PILL: {
    id: 'TAKE_PILL',
    labelVi: 'Uống thuốc / viên',
    descriptionVi: 'Đổ viên ra tay rồi uống cùng nước',
    emoji: '💊',
    motionPreset: 'static',
    framingPreset: 'medium',
    promptPreset:
      'Person pours one pill from the bottle into open palm, picks it up, places into mouth, ' +
      'sips water, swallows, calm satisfied expression. No close-up of mouth. ' +
      'Identical face and product as input image.',
    durationPreset: 3.5,
    cameraPreset: 'static',
    needsProduct: true,
    tone: 'rose',
  },

  UNBOX: {
    id: 'UNBOX',
    labelVi: 'Mở hộp',
    descriptionVi: 'Mở hộp sản phẩm lần đầu, lộ bao bì bên trong',
    emoji: '📦',
    motionPreset: 'handheld',
    framingPreset: 'top_down',
    promptPreset:
      'Hands open the product box from the top, lifting the inner product into frame, ' +
      'overhead top-down view, soft natural light, packaging looks new and pristine, ' +
      'identical product design as input image.',
    durationPreset: 3.0,
    cameraPreset: 'handheld',
    needsProduct: true,
    tone: 'amber',
  },

  PHONE_SCROLL: {
    id: 'PHONE_SCROLL',
    labelVi: 'Lướt điện thoại',
    descriptionVi: 'Cảnh tay vuốt màn hình điện thoại — không cần sản phẩm',
    emoji: '📱',
    motionPreset: 'static',
    framingPreset: 'closeup',
    promptPreset:
      'Hands hold a phone, thumb scrolls smoothly through a vertical feed, ' +
      'natural phone-grip pose, slight glare on screen, ' +
      'subtle handheld micro-shake, no logos visible.',
    durationPreset: 2.0,
    cameraPreset: 'subtle_drift',
    needsProduct: false,
    tone: 'sky',
  },

  BEFORE_AFTER_REACTION: {
    id: 'BEFORE_AFTER_REACTION',
    labelVi: 'Phản ứng before/after',
    descriptionVi: 'Khuôn mặt thay đổi từ mệt mỏi sang tươi tỉnh',
    emoji: '🎭',
    motionPreset: 'zoom_in',
    framingPreset: 'closeup',
    promptPreset:
      'Person face starts with tired weary expression, then transitions to relieved energetic ' +
      'expression, subtle camera push toward face, natural lighting throughout, ' +
      'identical face as input image — same person, two emotional states.',
    durationPreset: 3.5,
    cameraPreset: 'subtle_drift',
    needsProduct: false,
    tone: 'rose',
  },
}

/** Ordered list of presets — cheap/safe first, narrative-heavy last.
 *  This ordering drives the default insert picker in QUICK mode. */
export const ACTION_PRESET_ORDER: ActionPresetId[] = [
  'HOLD_PRODUCT',
  'POINT_LABEL',
  'OPEN_CAP',
  'DRINK',
  'TAKE_PILL',
  'UNBOX',
  'PHONE_SCROLL',
  'BEFORE_AFTER_REACTION',
]

/** Recommended insert presets for a given cost mode. The TEST mode
 *  picks the absolute safest set; FULL mode picks the full variety. */
export function recommendInsertsForMode(
  insertCount: number,
): ActionPresetId[] {
  if (insertCount <= 3) {
    // TEST mode — only the most reliable / cheapest motions
    const picks: ActionPresetId[] = ['HOLD_PRODUCT', 'POINT_LABEL', 'OPEN_CAP']
    return picks.slice(0, insertCount)
  }
  if (insertCount <= 5) {
    // STANDARD mode — add product interaction
    const picks: ActionPresetId[] = [
      'HOLD_PRODUCT', 'POINT_LABEL', 'OPEN_CAP',
      'DRINK', 'UNBOX',
    ]
    return picks.slice(0, insertCount)
  }
  // FULL mode — full variety
  return ACTION_PRESET_ORDER.slice(0, insertCount)
}
