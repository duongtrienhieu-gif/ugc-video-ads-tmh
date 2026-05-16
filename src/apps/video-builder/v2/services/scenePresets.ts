// ── Scene Preset Library ─────────────────────────────────────────────────────
// Each preset = a partial SceneBlueprint that pre-fills the dominant fields
// for a common UGC ad shot type. User picks presets (or auto-picked by
// Gemini for diversity) → Gemini enriches → Prompt Compiler converts.
//
// All presets target ecommerce / landing-page / social-proof / advertorial.
// NO cinematic, NO studio commercial, NO fashion editorial.
// ─────────────────────────────────────────────────────────────────────────────

import type { SceneBlueprint } from '../types'

/** Subset of fields a preset prefills. Gemini fills the rest from script context. */
export type ScenePresetTemplate = Pick<
  SceneBlueprint,
  | 'composition'
  | 'cameraAngle'
  | 'shotType'
  | 'pose'
  | 'handUsage'
  | 'productVisibility'
  | 'backgroundType'
  | 'lightingStyle'
  | 'motionIntent'
  | 'overlayDensity'
>

export interface ScenePreset {
  /** Unique id for the preset */
  id: string
  /** Tiếng Việt label for UI */
  labelVi: string
  /** Short English internal label (used in Gemini prompt) */
  labelEn: string
  /** What this preset is good for (Vietnamese, shown in tooltip) */
  hintVi: string
  /** Pre-filled fields */
  template: ScenePresetTemplate
}

export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: 'product-showcase',
    labelVi: 'Cầm sản phẩm trước camera',
    labelEn: 'product-showcase-hold',
    hintVi: 'Sản phẩm cầm chính diện, label hướng camera — chuẩn ảnh hero ecommerce',
    template: {
      composition: 'medium close-up',
      cameraAngle: 'iphone eye-level',
      shotType: 'ugc handheld arms-extended',
      pose: 'holding product up at chest level facing camera',
      handUsage: 'both hands cradling the product, label towards lens',
      productVisibility: 'high',
      backgroundType: 'real lived-in home interior softly out of focus on far walls only',
      lightingStyle: 'soft natural daylight from window-side',
      motionIntent: 'subtle handheld realism, slight breath motion',
      overlayDensity: 'low',
    },
  },
  {
    id: 'selfie-review',
    labelVi: 'Selfie review',
    labelEn: 'selfie-review',
    hintVi: 'Avatar nói trực tiếp với camera như selfie video — UGC TikTok feel',
    template: {
      composition: 'tight close-up, head + upper-shoulder',
      cameraAngle: 'iphone selfie eye-level',
      shotType: 'selfie arm-extended, vertical',
      pose: 'looking directly at camera while gesturing slightly with one hand',
      handUsage: 'one hand holding the product low in frame, label partially visible',
      productVisibility: 'medium',
      backgroundType: 'real home background, kitchen or bedroom visible',
      lightingStyle: 'soft window light hitting one side of face',
      motionIntent: 'natural slight selfie handheld motion',
      overlayDensity: 'medium',
    },
  },
  {
    id: 'multi-product-desk',
    labelVi: 'Ngồi trước nhiều sản phẩm',
    labelEn: 'multi-product-tabletop',
    hintVi: 'Bàn 3-5 sản phẩm cùng loại xếp gọn, avatar review từng cái',
    template: {
      composition: 'medium shot, waist-up with desk in foreground',
      cameraAngle: 'iphone slight high-angle looking down on table',
      shotType: 'tripod-static feel, casual home setup',
      pose: 'sitting at desk, leaning slightly forward, picking up one unit',
      handUsage: 'one hand holding the picked unit at chest, others arranged on desk',
      productVisibility: 'high',
      backgroundType: 'home desk with cozy ambient props softly visible',
      lightingStyle: 'soft side daylight from window',
      motionIntent: 'static phone mount feel, minimal motion',
      overlayDensity: 'low',
    },
  },
  {
    id: 'using-product',
    labelVi: 'Đang sử dụng sản phẩm',
    labelEn: 'product-in-use',
    hintVi: 'Mở nắp, lấy ra, áp lên da/mặt — moment dùng thật',
    template: {
      composition: 'medium close-up, focus on hands + product',
      cameraAngle: 'iphone slight tilt down toward hands',
      shotType: 'ugc handheld, demonstrating',
      pose: 'opening the product / dispensing a small amount / applying to hand',
      handUsage: 'two hands operating the product naturally (one holds, one opens / scoops)',
      productVisibility: 'high',
      backgroundType: 'bathroom counter or kitchen counter matching product type',
      lightingStyle: 'soft daylight overhead + ambient',
      motionIntent: 'gentle handheld with subtle hand motion',
      overlayDensity: 'low',
    },
  },
  {
    id: 'before-after-reaction',
    labelVi: 'Before / After reaction',
    labelEn: 'before-after-reaction',
    hintVi: 'Khuôn mặt biểu cảm trước-sau khi dùng — proof shot',
    template: {
      composition: 'tight head + shoulders portrait',
      cameraAngle: 'iphone eye-level direct',
      shotType: 'static phone mount feel, mirror look',
      pose: 'looking at camera with shifted expression (relieved / amazed / calm)',
      handUsage: 'product held subtly at chin level OR not in frame',
      productVisibility: 'medium',
      backgroundType: 'neutral bathroom mirror or bedroom soft background',
      lightingStyle: 'soft front daylight, even on face',
      motionIntent: 'still / subtle micro-expressions',
      overlayDensity: 'medium',
    },
  },
  {
    id: 'lifestyle-kitchen',
    labelVi: 'Lifestyle bếp',
    labelEn: 'lifestyle-kitchen',
    hintVi: 'Sinh hoạt buổi sáng / sau bữa ăn — sản phẩm xuất hiện tự nhiên',
    template: {
      composition: 'wide-medium, kitchen counter visible',
      cameraAngle: 'iphone eye-level / waist-level',
      shotType: 'ugc handheld lifestyle moment',
      pose: 'standing at kitchen counter, drinking water / preparing breakfast',
      handUsage: 'product visible on the counter beside them or held casually',
      productVisibility: 'medium',
      backgroundType: 'real lived-in kitchen with utensils, fruits, soft clutter',
      lightingStyle: 'morning window light, warm tones',
      motionIntent: 'natural lifestyle movement',
      overlayDensity: 'low',
    },
  },
  {
    id: 'bathroom-routine',
    labelVi: 'Routine phòng tắm',
    labelEn: 'bathroom-routine',
    hintVi: 'Buổi sáng skincare/grooming — phù hợp sản phẩm beauty/care',
    template: {
      composition: 'medium close-up, mirror reflection style',
      cameraAngle: 'iphone slight up-angle, mirror view',
      shotType: 'phone-on-shelf POV',
      pose: 'looking in mirror while applying or holding the product',
      handUsage: 'one hand holds product, other touches face / hair',
      productVisibility: 'high',
      backgroundType: 'clean white tile bathroom with everyday clutter (toothbrush, plant)',
      lightingStyle: 'cool morning bathroom daylight',
      motionIntent: 'subtle natural reach motion',
      overlayDensity: 'low',
    },
  },
  {
    id: 'cafe-lifestyle',
    labelVi: 'Cafe lifestyle',
    labelEn: 'cafe-lifestyle',
    hintVi: 'Quán cafe, làm việc / nghỉ trưa — relatable urban lifestyle',
    template: {
      composition: 'medium shot, cafe scene around',
      cameraAngle: 'iphone eye-level',
      shotType: 'ugc handheld observational',
      pose: 'sitting at cafe table, sipping drink, product on table beside coffee',
      handUsage: 'one hand on coffee cup, product visible standing on table',
      productVisibility: 'medium',
      backgroundType: 'cozy cafe interior softly out of focus on far walls',
      lightingStyle: 'warm cafe ambient + side window',
      motionIntent: 'still ambient cafe atmosphere',
      overlayDensity: 'low',
    },
  },
  {
    id: 'tiktok-pov',
    labelVi: 'TikTok UGC POV',
    labelEn: 'tiktok-pov',
    hintVi: 'Pattern interrupt hook — POV trực tiếp với camera, năng lượng cao',
    template: {
      composition: 'close-up arm-extended selfie',
      cameraAngle: 'iphone slight low-angle, very close',
      shotType: 'selfie POV high-energy',
      pose: 'looking straight at camera with surprised or hook-grabbing expression',
      handUsage: 'product held up close to lens, label hero',
      productVisibility: 'high',
      backgroundType: 'real home corner or street, doesn\'t matter much, fast cut feel',
      lightingStyle: 'natural daylight, slightly contrasty',
      motionIntent: 'energetic handheld with mini camera shake',
      overlayDensity: 'high',
    },
  },
  {
    id: 'desk-review',
    labelVi: 'Review bàn làm việc',
    labelEn: 'desk-review-callout',
    hintVi: 'Bàn làm việc gọn gàng, review chỉ ngón tay vào label / chi tiết',
    template: {
      composition: 'medium close-up, desk in lower frame',
      cameraAngle: 'iphone slight downward angle on desk',
      shotType: 'static phone-on-tripod feel',
      pose: 'one hand holding product, other index finger pointing at a feature on the label',
      handUsage: 'two hands engaging product directly, callout gesture',
      productVisibility: 'high',
      backgroundType: 'clean home desk with laptop edge / notebook softly visible',
      lightingStyle: 'soft side daylight',
      motionIntent: 'still pointing gesture',
      overlayDensity: 'medium',
    },
  },
]

/**
 * Visual tone safety clamp — appended to every scene's visualTone field.
 * Prevents Gemini/image-gen from drifting into cinematic / studio / fashion territory.
 */
export const VISUAL_TONE_CLAMP = 'warm authentic ecommerce UGC — realistic landing-page / advertorial / social-proof lifestyle imagery. NOT cinematic movie scene. NOT studio commercial. NOT fashion editorial. NOT stock-photo corporate.'

/** Default tone string used by Gemini when no preset specifies otherwise. */
export const DEFAULT_VISUAL_TONE = 'warm authentic ecommerce lifestyle'

/** Get preset by id, or null. */
export function getPreset(id: string): ScenePreset | null {
  return SCENE_PRESETS.find((p) => p.id === id) ?? null
}

/** Default rotation: gives Gemini a diverse starting set of 9 presets. */
export const DEFAULT_PRESET_ROTATION: string[] = [
  'tiktok-pov',           // 1 — hook
  'selfie-review',        // 2 — claim
  'product-showcase',     // 3 — hero
  'using-product',        // 4 — proof / demo
  'desk-review',          // 5 — ingredient / feature callout
  'before-after-reaction',// 6 — result
  'lifestyle-kitchen',    // 7 — lifestyle context
  'multi-product-desk',   // 8 — social proof / stock visual
  'product-showcase',     // 9 — CTA hero (will be marked ctaFocus=true)
]
