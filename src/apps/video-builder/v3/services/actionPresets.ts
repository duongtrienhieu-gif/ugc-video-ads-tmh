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
  tone: 'amber' | 'violet' | 'emerald' | 'rose' | 'sky' | 'pink'
  /** Z33 §6 — explicit hand-behavior rule for the keyframe prompt.
   *  Helps the model avoid malformed fingers / unrealistic grips. */
  handBehavior: string
  /** Z33 §6 — explicit object-interaction rule. Reinforces the
   *  product-consistency lock (label / shape / scale preservation). */
  objectInteraction: string
  /** Z33 §11 — script keywords (lowercased, English + Vietnamese + Bahasa
   *  Malaysia) that auto-suggest this preset when found in the script. BM is
   *  the default output language, so the offline (no-Gemini) keyword path must
   *  carry BM terms or it returns empty suggestions for default scripts. */
  triggerKeywords: string[]
}

// Shared product-consistency rule appended to EVERY needsProduct preset
// (Z33 §9 — label/color/shape/scale lock).
const PRODUCT_LOCK =
  'Preserve EXACT label typography, color, shape, and scale of the product ' +
  'from reference image #1. The product must read as the same physical object ' +
  'across all inserts — no redesigned packaging, no resized bottle, no colour drift.'

// Shared hand-behavior baseline — applied to all hand-driven inserts to
// avoid the AI-typical malformed-finger / extra-thumb / wrong-grip failure modes.
const HAND_BASELINE =
  'Hands shown with 5 anatomically correct fingers and normal nail shape. ' +
  'Natural grip — not stiff, not floating. Fingers do not pass through the product. ' +
  'No malformed knuckles or extra digits.'

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
    handBehavior: HAND_BASELINE + ' Both hands cradle the product at chest level, palms supporting bottom.',
    objectInteraction: PRODUCT_LOCK,
    triggerKeywords: [
      'hold', 'holding', 'show', 'cầm', 'giữ', 'lấy ra', 'this is', 'this product', 'sản phẩm này',
      'pegang', 'tunjuk', 'produk ini', 'produk ni',
    ],
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
    handBehavior: HAND_BASELINE + ' One hand grips bottle, other rotates cap with thumb + index finger. SLOW rotation.',
    objectInteraction: PRODUCT_LOCK + ' Cap unscrews cleanly — no deformation of bottle neck.',
    triggerKeywords: [
      'open', 'opened', 'easy to open', 'unscrew', 'mở', 'mở ra', 'mở nắp', 'pop the cap', 'twist',
      'buka', 'buka penutup', 'putar', 'pusing',
    ],
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
    handBehavior: HAND_BASELINE + ' Single index finger extends and points at label area. Other fingers neutral.',
    objectInteraction: PRODUCT_LOCK + ' Finger does NOT cover the brand name. Label text fully readable.',
    triggerKeywords: [
      'look at', 'check', 'see this', 'label', 'ingredient', 'tag', 'nhìn', 'thành phần', 'nhãn', 'xem',
      'tengok', 'lihat', 'bahan', 'kandungan',
    ],
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
    handBehavior: HAND_BASELINE + ' One hand brings product to lips, calm motion. No spillage.',
    objectInteraction: PRODUCT_LOCK + ' Bottle / cup tilted only slightly — no extreme angles.',
    triggerKeywords: [
      'drink', 'sip', 'taste', 'tasty', 'uống', 'nếm', 'thử', 'ngon', 'thơm',
      'minum', 'rasa', 'sedap',
    ],
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
    handBehavior: HAND_BASELINE + ' One hand pours, other catches in open palm. Calm pace.',
    objectInteraction: PRODUCT_LOCK + ' Pill is a single visible tablet — same size + colour throughout.',
    triggerKeywords: [
      'pill', 'tablet', 'capsule', 'supplement', 'vitamin', 'viên', 'thuốc', 'uống thuốc',
      'pil', 'kapsul', 'suplemen', 'ubat',
    ],
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
    handBehavior: HAND_BASELINE + ' Both hands lift inner product out of box. Calm, controlled.',
    objectInteraction: PRODUCT_LOCK + ' Outer box + inner product both intact, no crumpling.',
    triggerKeywords: [
      'unbox', 'unboxing', 'new', 'just arrived', 'received', 'opening', 'mở hộp', 'vừa nhận', 'mới',
      'buka kotak', 'baru', 'baru sampai', 'baru terima',
    ],
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
    handBehavior: HAND_BASELINE + ' One hand grips phone, thumb scrolls vertically. Other hand out of frame.',
    objectInteraction: 'Phone screen shows blurred social feed. No specific brand logos visible.',
    triggerKeywords: [
      'scroll', 'scrolling', 'tiktok', 'instagram', 'feed', 'phone', 'điện thoại', 'lướt', 'mạng xã hội',
      'skrol', 'telefon', 'media sosial',
    ],
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
    handBehavior: 'Hands largely out of frame — face is the subject.',
    objectInteraction: 'No product in frame — pure facial reaction shot.',
    triggerKeywords: [
      'before', 'after', 'changed', 'difference', 'now i feel', 'trước', 'sau', 'khác', 'khoẻ hơn', 'tỉnh hơn',
      'sebelum', 'selepas', 'berubah', 'beza',
    ],
  },

  // ── Z33 — Phase 4 additions ────────────────────────────────────────────

  PRODUCT_CLOSEUP: {
    id: 'PRODUCT_CLOSEUP',
    labelVi: 'Closeup sản phẩm',
    descriptionVi: 'Macro shot sản phẩm trên bàn, không có tay — chỉ sản phẩm.',
    emoji: '🔍',
    motionPreset: 'zoom_in',
    framingPreset: 'macro',
    promptPreset:
      'Extreme macro closeup of the product on a clean surface, slow camera push toward label, ' +
      'sharp focus on brand name, soft natural daylight, identical packaging as input image. ' +
      'No hands in frame — product alone.',
    durationPreset: 2.5,
    cameraPreset: 'subtle_drift',
    needsProduct: true,
    tone: 'violet',
    handBehavior: 'No hands in frame. Product alone is the subject.',
    objectInteraction: PRODUCT_LOCK + ' Macro detail — every label letter sharply readable.',
    triggerKeywords: [
      'this product', 'check it out', 'closer look', 'detail', 'gần hơn', 'chi tiết', 'cận cảnh', 'macro',
      'lebih dekat', 'perincian', 'dekat sini',
    ],
  },

  SHOW_PACKAGE: {
    id: 'SHOW_PACKAGE',
    labelVi: 'Khoe bao bì',
    descriptionVi: 'Cầm sản phẩm xoay nhẹ để show 360 bao bì.',
    emoji: '🎁',
    motionPreset: 'pan_right',
    framingPreset: 'medium',
    promptPreset:
      'Person holds the product and slowly rotates it to show all sides — front label, side, back. ' +
      'Calm controlled rotation, product centred, identical packaging design as input image. ' +
      'No fast spin. No drops.',
    durationPreset: 3.5,
    cameraPreset: 'subtle_drift',
    needsProduct: true,
    tone: 'pink',
    handBehavior: HAND_BASELINE + ' One hand holds product, slowly rotates it — speed of a calm display, not a flourish.',
    objectInteraction: PRODUCT_LOCK + ' All sides of packaging visible during rotation — no deformation.',
    triggerKeywords: [
      'package', 'packaging', 'box', 'design', 'bao bì', 'hộp', 'thiết kế', 'mặt sau',
      'pakej', 'kotak', 'reka bentuk', 'pembungkusan',
    ],
  },

  DESK_PRODUCT: {
    id: 'DESK_PRODUCT',
    labelVi: 'Sản phẩm trên bàn',
    descriptionVi: 'Sản phẩm đặt trên bàn với coffee/laptop xung quanh — lifestyle.',
    emoji: '☕',
    motionPreset: 'static',
    framingPreset: 'medium',
    promptPreset:
      'Product sits on a desk among lifestyle props (coffee mug, laptop edge, notebook). ' +
      'Soft window daylight from the side. Static composition with very subtle camera drift. ' +
      'Identical packaging as input image. NOT a studio flatlay — real desk vibe.',
    durationPreset: 2.5,
    cameraPreset: 'subtle_drift',
    needsProduct: true,
    tone: 'amber',
    handBehavior: 'No hands in frame — product staged on desk.',
    objectInteraction: PRODUCT_LOCK + ' Product upright on desk surface — not floating, not tilted.',
    triggerKeywords: [
      'desk', 'morning', 'routine', 'every day', 'bàn', 'sáng', 'thói quen', 'hằng ngày',
      'meja', 'pagi', 'rutin', 'setiap hari',
    ],
  },

  BAG_PRODUCT_PULL: {
    id: 'BAG_PRODUCT_PULL',
    labelVi: 'Lấy sản phẩm từ túi',
    descriptionVi: 'Tay với vào túi xách rút sản phẩm ra.',
    emoji: '👜',
    motionPreset: 'handheld',
    framingPreset: 'medium',
    promptPreset:
      'A hand reaches into a handbag and pulls the product out into view, lifting it toward chest level. ' +
      'Smooth controlled motion, product fully visible once out of bag. ' +
      'Identical packaging as input image. Natural daylight indoor.',
    durationPreset: 3.0,
    cameraPreset: 'handheld',
    needsProduct: true,
    tone: 'rose',
    handBehavior: HAND_BASELINE + ' One hand reaches into bag, grasps product, lifts out. Smooth controlled pull.',
    objectInteraction: PRODUCT_LOCK + ' Product emerges from bag without deformation or scale shift.',
    triggerKeywords: [
      'bring', 'carry', 'in my bag', 'always with me', 'trong túi', 'mang theo', 'mang đi',
      'beg', 'bawa', 'dalam beg', 'bawa ke mana',
    ],
  },

  // ── Z37 — script-driven concept scene ──────────────────────────────────
  // A free B-roll scene with NO product on screen (ingredient / mechanism /
  // lifestyle illustration). Its prompt is written per-scene by the AI scene
  // director and carried on ActionInsertClip.conceptPrompt — the fields here
  // are only neutral fallbacks. Because the product is not shown, there is no
  // fidelity lock to break, which is why free generation is safe here.
  // NOT added to ACTION_PRESET_ORDER (never shown in the product preset picker
  // or keyword suggester).
  CONCEPT_SCENE: {
    id: 'CONCEPT_SCENE',
    labelVi: 'Cảnh minh hoạ (concept)',
    descriptionVi: 'Cảnh không có sản phẩm — minh hoạ cơ chế / cảm xúc / lifestyle khớp lời thoại.',
    emoji: '🎞️',
    motionPreset: 'static',
    framingPreset: 'medium',
    promptPreset:
      'Authentic lifestyle B-roll scene that illustrates the narration. ' +
      'No product packaging visible in frame.',
    durationPreset: 3.0,
    cameraPreset: 'subtle_drift',
    needsProduct: false,
    tone: 'sky',
    handBehavior: 'Hands only if naturally part of the scene; otherwise out of frame.',
    objectInteraction: 'No specific product on screen — concept / mood illustration only.',
    triggerKeywords: [],
  },
}

/** Ordered list of presets — cheap/safe first, narrative-heavy last.
 *  This ordering drives the default insert picker in QUICK mode. */
export const ACTION_PRESET_ORDER: ActionPresetId[] = [
  'HOLD_PRODUCT',
  'PRODUCT_CLOSEUP',  // Z33
  'POINT_LABEL',
  'OPEN_CAP',
  'SHOW_PACKAGE',     // Z33
  'DESK_PRODUCT',     // Z33
  'DRINK',
  'TAKE_PILL',
  'UNBOX',
  'BAG_PRODUCT_PULL', // Z33
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
