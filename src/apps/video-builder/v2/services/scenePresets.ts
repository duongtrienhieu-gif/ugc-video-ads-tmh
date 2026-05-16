// ── Scene Preset Library ─────────────────────────────────────────────────────
// Each preset = a partial SceneBlueprint that pre-fills the dominant fields
// for a common UGC ad shot type. User picks presets (or auto-picked by
// Gemini for diversity) → Gemini enriches → Prompt Compiler converts.
//
// All presets target ecommerce / landing-page / social-proof / advertorial.
// NO cinematic, NO studio commercial, NO fashion editorial.
// ─────────────────────────────────────────────────────────────────────────────

import type { SceneBlueprint, SceneType, ShotEnergy } from '../types'

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
  /** Short English internal label (used in Gemini prompt + presetLabel matching) */
  labelEn: string
  /** What this preset is good for (Vietnamese, shown in tooltip) */
  hintVi: string
  /** Pre-filled fields */
  template: ScenePresetTemplate
  /** ── Auto Preset Inference Engine metadata (Phase A) ────────────────────
   *  Each preset represents a TIMELINE MOMENT (emotional visual pattern),
   *  not "girl holding product". These fields drive the auto-selector that
   *  matches the right preset to each scene based on script beat. */
  sceneTypes: SceneType[]
  /** Vietnamese + English keywords found in script that activate this preset */
  emotionalKeywords: string[]
  /** Semantic tags (pain / trust / recovery / authority / social-proof / etc.) */
  narrativeTags: string[]
  /** Canonical environmentType for this preset */
  environmentType: string
  /** Wardrobe style associated with this preset */
  wardrobeStyle: string
  /** Shot energy / mood of this preset */
  shotEnergy: ShotEnergy
  /** Facial expression archetype — drives auto-emotion clamp downstream */
  facialExpressionType: string
}

export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: 'product-showcase',
    labelVi: 'Cầm sản phẩm trước camera',
    labelEn: 'product-showcase-hold',
    hintVi: 'Sản phẩm cầm chính diện, label hướng camera — chuẩn ảnh hero ecommerce',
    sceneTypes: ['cta', 'discovery'],
    emotionalKeywords: ['mua ngay', 'đặt hàng', 'order now', 'buy now', 'link bio', 'kẹo này', 'sản phẩm này', 'this product', 'cta'],
    narrativeTags: ['cta', 'hero', 'product-reveal', 'closing'],
    environmentType: 'living room',
    wardrobeStyle: 'polished confident',
    shotEnergy: 'energetic',
    facialExpressionType: 'confident smile direct eye-contact',
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
    sceneTypes: ['social_proof', 'discovery', 'explanation'],
    emotionalKeywords: ['review', 'đánh giá', 'thử', 'i tried', 'nói thật', 'honestly'],
    narrativeTags: ['testimonial', 'review', 'direct-address'],
    environmentType: 'living room',
    wardrobeStyle: 'home casual',
    shotEnergy: 'dynamic',
    facialExpressionType: 'engaged honest talking',
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
    sceneTypes: ['failed_solution', 'discovery'],
    emotionalKeywords: ['thử đủ loại', 'tried everything', 'so many', 'nhiều loại', 'compare', 'so sánh'],
    narrativeTags: ['failed-solution', 'compare', 'medicine-overload', 'evaluation'],
    environmentType: 'home office desk',
    wardrobeStyle: 'home casual',
    shotEnergy: 'calm',
    facialExpressionType: 'evaluating skeptical',
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
    sceneTypes: ['explanation', 'discovery'],
    emotionalKeywords: ['dùng', 'sử dụng', 'apply', 'using', 'mở', 'open', 'lấy ra', 'scoop', 'uống'],
    narrativeTags: ['demo', 'product-in-use', 'how-it-works'],
    environmentType: 'kitchen',
    wardrobeStyle: 'home casual',
    shotEnergy: 'calm',
    facialExpressionType: 'focused gentle',
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
    sceneTypes: ['recovery', 'social_proof'],
    emotionalKeywords: ['sau khi', 'after using', 'kết quả', 'result', 'cải thiện', 'improved', 'trở lại', 'feel better'],
    narrativeTags: ['result', 'transformation', 'proof', 'after-result'],
    environmentType: 'bathroom',
    wardrobeStyle: 'home casual',
    shotEnergy: 'relief',
    facialExpressionType: 'relieved glowing',
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
    sceneTypes: ['lifestyle', 'recovery'],
    emotionalKeywords: ['bữa sáng', 'breakfast', 'gia đình', 'family', 'ăn ngon', 'enjoy eating', 'morning'],
    narrativeTags: ['lifestyle', 'family-meal', 'morning-routine', 'happy-eating'],
    environmentType: 'kitchen',
    wardrobeStyle: 'weekend relaxed',
    shotEnergy: 'energetic',
    facialExpressionType: 'happy content smile',
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
    sceneTypes: ['lifestyle', 'explanation'],
    emotionalKeywords: ['skincare', 'rửa mặt', 'morning routine', 'sáng dậy', 'soi gương', 'mirror'],
    narrativeTags: ['routine', 'skincare', 'mirror', 'morning'],
    environmentType: 'bathroom',
    wardrobeStyle: 'pajama',
    shotEnergy: 'calm',
    facialExpressionType: 'focused refreshed',
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
    sceneTypes: ['lifestyle', 'recovery'],
    emotionalKeywords: ['cafe', 'quán', 'cuối tuần', 'weekend', 'làm việc', 'work', 'gặp bạn', 'meeting friends'],
    narrativeTags: ['cafe', 'urban', 'lifestyle', 'social'],
    environmentType: 'cafe',
    wardrobeStyle: 'cafe outfit',
    shotEnergy: 'calm',
    facialExpressionType: 'relaxed content',
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
    sceneTypes: ['hook', 'discovery'],
    emotionalKeywords: ['bí quyết', 'secret', 'rahsia', 'wait until', 'đợi đã', 'pov', 'check this'],
    narrativeTags: ['hook', 'pattern-interrupt', 'direct-camera', 'high-energy'],
    environmentType: 'living room',
    wardrobeStyle: 'home casual',
    shotEnergy: 'dynamic',
    facialExpressionType: 'engaging hook expression',
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
    sceneTypes: ['explanation', 'discovery'],
    emotionalKeywords: ['thành phần', 'ingredient', 'công thức', 'formula', 'denmark', 'nhập khẩu', 'imported'],
    narrativeTags: ['ingredient', 'callout', 'authority', 'label-reveal'],
    environmentType: 'home office desk',
    wardrobeStyle: 'office casual',
    shotEnergy: 'calm',
    facialExpressionType: 'expert confident pointing',
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
  {
    id: 'vulnerable-hook',
    labelVi: 'Hook "I almost gave up"',
    labelEn: 'vulnerable-hook',
    hintVi: 'Cận mặt buồn/mệt mỏi đầu video — emotional pattern interrupt',
    sceneTypes: ['hook', 'pain', 'frustration'],
    emotionalKeywords: ['suýt bỏ cuộc', 'almost gave up', 'mệt mỏi', 'tired', 'kiệt sức', 'exhausted', 'từng nghĩ', 'used to'],
    narrativeTags: ['pain', 'vulnerable', 'emotional-hook'],
    environmentType: 'bedroom',
    wardrobeStyle: 'pajama',
    shotEnergy: 'emotional',
    facialExpressionType: 'tired honest vulnerable',
    template: {
      composition: 'tight close-up, head + shoulders only',
      cameraAngle: 'iphone slight low-angle eye-level',
      shotType: 'selfie arm-extended, intimate',
      pose: 'slight downward gaze then looking up at camera with tired honest expression',
      handUsage: 'product visible at bottom of frame held loosely in one hand',
      productVisibility: 'low',
      backgroundType: 'real bedroom or living room — slightly messy, not staged',
      lightingStyle: 'overcast daylight from window, slightly flat',
      motionIntent: 'subtle handheld with micro-pause',
      overlayDensity: 'low',
    },
  },
  {
    id: 'doctor-explanation',
    labelVi: 'Doctor-style explanation',
    labelEn: 'doctor-authority-shot',
    hintVi: 'Giọng điệu chuyên môn — chỉ vào label đọc thành phần',
    sceneTypes: ['explanation'],
    emotionalKeywords: ['bác sĩ', 'doctor', 'nghiên cứu', 'research', 'lâm sàng', 'clinical', 'chuyên gia', 'expert', 'cơ chế', 'mechanism'],
    narrativeTags: ['authority', 'expert', 'credibility', 'ingredient-callout'],
    environmentType: 'kitchen',
    wardrobeStyle: 'office casual',
    shotEnergy: 'calm',
    facialExpressionType: 'serious credible explaining',
    template: {
      composition: 'medium close-up, hands + product center',
      cameraAngle: 'iphone slight side-angle, eye-level',
      shotType: 'static phone-on-shelf with small movement',
      pose: 'rotating the product to show label, examining a specific ingredient line',
      handUsage: 'two hands — one holds, one points or rotates product',
      productVisibility: 'high',
      backgroundType: 'home kitchen or bookshelf, soft credibility context',
      lightingStyle: 'soft daylight + ambient warm interior',
      motionIntent: 'slow controlled rotation gesture',
      overlayDensity: 'high',
    },
  },
  {
    id: 'mom-kitchen-recommendation',
    labelVi: 'Mom recommendation',
    labelEn: 'mom-kitchen-trust',
    hintVi: 'Mẹ bếp warm trust — phù hợp female-30+ audience',
    sceneTypes: ['social_proof', 'lifestyle', 'recovery'],
    emotionalKeywords: ['mẹ', 'mom', 'gia đình', 'family', 'mẹ tôi', 'my mom', 'recommend', 'giới thiệu'],
    narrativeTags: ['mom', 'trust', 'recommendation', 'family-warmth'],
    environmentType: 'kitchen',
    wardrobeStyle: 'home casual',
    shotEnergy: 'calm',
    facialExpressionType: 'warm trustworthy smile',
    template: {
      composition: 'medium shot, kitchen counter visible',
      cameraAngle: 'iphone waist-level eye-contact',
      shotType: 'ugc handheld lifestyle',
      pose: 'standing at kitchen counter, gentle smile, holding product at chest level naturally',
      handUsage: 'one hand on the product, other resting on counter',
      productVisibility: 'high',
      backgroundType: 'lived-in family kitchen — fruit bowl, breakfast prep, slight clutter',
      lightingStyle: 'warm morning daylight from kitchen window',
      motionIntent: 'natural lifestyle moment',
      overlayDensity: 'low',
    },
  },
  {
    id: 'office-worker-pain',
    labelVi: 'Office worker pain point',
    labelEn: 'office-burnout-pain',
    hintVi: 'Mệt mỏi giờ làm việc — relatable cho dân văn phòng',
    sceneTypes: ['pain', 'frustration'],
    emotionalKeywords: ['văn phòng', 'office', 'làm việc', 'work stress', 'deadline', 'mệt mỏi', 'burnout', 'overload', 'đau đầu'],
    narrativeTags: ['pain', 'office-fatigue', 'work-stress', 'burnout'],
    environmentType: 'home office desk',
    wardrobeStyle: 'office casual',
    shotEnergy: 'tension',
    facialExpressionType: 'tired stressed strained',
    template: {
      composition: 'medium shot from desk, laptop in foreground edge',
      cameraAngle: 'iphone eye-level looking across desk',
      shotType: 'static phone propped against laptop',
      pose: 'sitting at desk, slight slump, rubbing forehead or looking at product with tired interest',
      handUsage: 'one hand holds product, other rests near laptop',
      productVisibility: 'low',
      backgroundType: 'real home office or coworking — laptop, coffee, notebook',
      lightingStyle: 'office overhead + side natural light',
      motionIntent: 'still casual desk pose',
      overlayDensity: 'medium',
    },
  },
  {
    id: 'night-routine-bedroom',
    labelVi: 'Night routine bedroom',
    labelEn: 'night-routine',
    hintVi: 'Trước khi ngủ — phù hợp supplement/skincare evening use',
    sceneTypes: ['lifestyle', 'pain', 'explanation'],
    emotionalKeywords: ['trước khi ngủ', 'before bed', 'tối', 'evening', 'night', 'mất ngủ', 'insomnia', 'khó ngủ'],
    narrativeTags: ['night-routine', 'bedroom', 'evening-use', 'sleep'],
    environmentType: 'bedroom',
    wardrobeStyle: 'pajama',
    shotEnergy: 'intimate',
    facialExpressionType: 'calm intimate honest',
    template: {
      composition: 'medium close-up, bed lamp glow',
      cameraAngle: 'iphone slight high-angle, looking down at lap',
      shotType: 'selfie POV in bed',
      pose: 'sitting up in bed in casual pajamas, holding product up to read the label',
      handUsage: 'both hands holding the product near chest',
      productVisibility: 'high',
      backgroundType: 'cozy bedroom — bedsheets, nightstand with lamp, plant',
      lightingStyle: 'warm bedside lamp + soft window backlight',
      motionIntent: 'still relaxed bed pose',
      overlayDensity: 'low',
    },
  },
  {
    id: 'partner-recommendation',
    labelVi: 'Husband/wife recommendation',
    labelEn: 'partner-rec',
    hintVi: 'Có người thứ 2 thấp thoáng — social proof từ couple',
    sceneTypes: ['social_proof', 'lifestyle'],
    emotionalKeywords: ['chồng tôi', 'my husband', 'vợ tôi', 'my wife', 'bạn đời', 'partner', 'cả hai'],
    narrativeTags: ['couple', 'partner-trust', 'social-proof'],
    environmentType: 'kitchen',
    wardrobeStyle: 'home casual',
    shotEnergy: 'calm',
    facialExpressionType: 'relaxed warm smile',
    template: {
      composition: 'medium shot, second person blurred in background',
      cameraAngle: 'iphone eye-level',
      shotType: 'ugc handheld casual',
      pose: 'foreground person holding product with relaxed smile, partner softly out of focus making coffee or reading behind',
      handUsage: 'one hand showing product to camera',
      productVisibility: 'high',
      backgroundType: 'real shared apartment or kitchen, partner clearly visible but soft-focus',
      lightingStyle: 'warm home ambient daylight',
      motionIntent: 'natural domestic moment',
      overlayDensity: 'low',
    },
  },
  {
    id: 'reaction-shocked',
    labelVi: 'Reaction "nobody told me this"',
    labelEn: 'reaction-shocked',
    hintVi: 'Mắt mở to ngạc nhiên cầm product — pattern interrupt strong',
    sceneTypes: ['discovery', 'hook'],
    emotionalKeywords: ['không ngờ', 'never expected', 'wow', 'shocked', 'bất ngờ', 'kỳ diệu', 'amazing', 'không ai nói'],
    narrativeTags: ['reaction', 'shock', 'pattern-interrupt', 'discovery'],
    environmentType: 'living room',
    wardrobeStyle: 'home casual',
    shotEnergy: 'dynamic',
    facialExpressionType: 'wide-eyed surprised',
    template: {
      composition: 'tight close-up face + product near cheek',
      cameraAngle: 'iphone selfie eye-level very close',
      shotType: 'selfie POV, dramatic close',
      pose: 'wide-eyed surprised reaction, mouth slightly open, holding product right at cheek level',
      handUsage: 'one hand holding product up close to lens, label visible',
      productVisibility: 'high',
      backgroundType: 'real home corner softly out of focus, neutral',
      lightingStyle: 'natural daylight slightly contrasty for energy',
      motionIntent: 'tiny shake of disbelief',
      overlayDensity: 'high',
    },
  },
  {
    id: 'comment-reply-pov',
    labelVi: 'Comment-reply POV',
    labelEn: 'comment-reply',
    hintVi: 'Trả lời comment dạng TikTok — cầm phone đáp lại câu hỏi',
    sceneTypes: ['social_proof', 'explanation'],
    emotionalKeywords: ['câu hỏi', 'question', 'bạn hỏi', 'you asked', 'reply', 'trả lời', 'comment'],
    narrativeTags: ['reply', 'qa', 'creator-direct'],
    environmentType: 'living room',
    wardrobeStyle: 'home casual',
    shotEnergy: 'dynamic',
    facialExpressionType: 'engaged conversational',
    template: {
      composition: 'medium close-up phone-talking-to-phone',
      cameraAngle: 'iphone selfie eye-level',
      shotType: 'selfie POV, conversational',
      pose: 'looking directly at camera as if replying to a viewer comment, gesturing slightly with one hand',
      handUsage: 'one hand holding product near shoulder, casual point-show',
      productVisibility: 'high',
      backgroundType: 'real home or office corner, casual native creator vibe',
      lightingStyle: 'soft window daylight',
      motionIntent: 'animated gesture handheld',
      overlayDensity: 'high',
    },
  },
]

// ─── AUTO PRESET INFERENCE ENGINE ──────────────────────────────────────────
// Scores each preset against a SceneBlueprint to pick the best emotional/visual
// pattern match. The matcher uses 4 axes weighted by importance:
//   sceneType (40 pts) > emotionalKeywords (25) > narrativeTags (15) >
//   visibility (10) + environmentType (5) + shotEnergy (5)
// Returns the preset with the highest score + a 0-100 confidence value.
//
// Fallback: if no preset scores above 30, returns 'product-showcase' (safe hero
// CTA preset) — guarantees the dropdown is NEVER empty.

export interface PresetMatch {
  preset: ScenePreset
  confidence: number
  score: number
  reasons: string[]
}

/** Normalize a string for substring matching (lowercase, drop diacritics). */
function normalizeForMatch(s: string | undefined): string {
  if (!s) return ''
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Auto-infer the best preset for a SceneBlueprint based on sceneType, script
 * speech, narrative purpose, and visual fields. Returns top match + confidence.
 *
 * @param blueprint the partially-filled scene (post-Gemini, post-normalize)
 * @param opts.usedPresetIds set of preset ids already assigned to earlier scenes
 *        (gentle anti-repetition penalty so 9 scenes spread across the library)
 */
export function inferPresetForScene(
  blueprint: SceneBlueprint,
  opts?: { usedPresetIds?: Set<string> },
): PresetMatch {
  const used = opts?.usedPresetIds ?? new Set<string>()

  // Build a single searchable string from all script-derived fields
  const searchHaystack = normalizeForMatch([
    blueprint.speech,
    blueprint.narrativePurpose,
    blueprint.visualObjective,
    blueprint.subjectAction,
    blueprint.sceneGoal,
    blueprint.emotion,
    blueprint.pose,
  ].filter(Boolean).join(' '))

  let best: PresetMatch | null = null

  for (const preset of SCENE_PRESETS) {
    let score = 0
    const reasons: string[] = []

    // [40 pts] sceneType match (primary axis)
    if (blueprint.sceneType && preset.sceneTypes.includes(blueprint.sceneType)) {
      score += 40
      reasons.push(`sceneType=${blueprint.sceneType}`)
    } else if (blueprint.sceneType && preset.sceneTypes.length > 0) {
      // Partial credit if any preset sceneType is "adjacent" (e.g. pain<->frustration)
      const adjacent: Record<string, string[]> = {
        pain: ['frustration', 'failed_solution'],
        frustration: ['pain', 'failed_solution'],
        failed_solution: ['pain', 'frustration'],
        discovery: ['hook', 'explanation'],
        explanation: ['discovery', 'social_proof'],
        recovery: ['lifestyle', 'social_proof'],
        lifestyle: ['recovery', 'social_proof'],
        social_proof: ['lifestyle', 'explanation'],
        cta: ['discovery'],
        hook: ['discovery'],
      }
      const adj = adjacent[blueprint.sceneType] ?? []
      if (adj.some((t) => preset.sceneTypes.includes(t as SceneType))) {
        score += 15
        reasons.push(`sceneType≈${blueprint.sceneType}`)
      }
    }

    // [up to 25 pts] emotional keyword matches in script-derived fields
    let kwHits = 0
    for (const kw of preset.emotionalKeywords) {
      if (searchHaystack.includes(normalizeForMatch(kw))) {
        kwHits++
        reasons.push(`kw:${kw}`)
      }
    }
    score += Math.min(25, kwHits * 8)

    // [up to 15 pts] narrative tag overlap with blueprint.narrativePurpose
    const np = normalizeForMatch(blueprint.narrativePurpose)
    let tagHits = 0
    for (const tag of preset.narrativeTags) {
      if (np.includes(normalizeForMatch(tag))) {
        tagHits++
      }
    }
    score += Math.min(15, tagHits * 6)

    // [10 pts] product visibility match (preset.template.productVisibility vs blueprint)
    if (preset.template.productVisibility === blueprint.productVisibility) {
      score += 10
      reasons.push('vis-match')
    }

    // [5 pts] environmentType match
    if (blueprint.environmentType && normalizeForMatch(blueprint.environmentType) === normalizeForMatch(preset.environmentType)) {
      score += 5
      reasons.push('env-match')
    }

    // [5 pts] shotEnergy match
    if (blueprint.shotEnergy && blueprint.shotEnergy === preset.shotEnergy) {
      score += 5
      reasons.push('energy-match')
    }

    // Anti-repetition: gentle -8 pts penalty if preset already used in this storyboard
    if (used.has(preset.id)) {
      score -= 8
    }

    if (!best || score > best.score) {
      best = {
        preset,
        score,
        confidence: Math.max(0, Math.min(100, score)),
        reasons,
      }
    }
  }

  // Fallback — if no preset scored > 30 (very weak signal), use a safe default
  // based on sceneType so the dropdown is NEVER empty.
  if (!best || best.score < 30) {
    const fallback = pickFallbackBySceneType(blueprint.sceneType)
    return {
      preset: fallback,
      score: best?.score ?? 0,
      confidence: Math.max(35, best?.confidence ?? 35),
      reasons: ['fallback-by-sceneType'],
    }
  }
  return best
}

/** Safe fallback preset for each sceneType — guarantees dropdown is filled. */
function pickFallbackBySceneType(t: SceneType | undefined): ScenePreset {
  const map: Record<string, string> = {
    hook: 'vulnerable-hook',
    pain: 'office-burnout-pain',
    frustration: 'office-burnout-pain',
    failed_solution: 'multi-product-tabletop',
    discovery: 'reaction-shocked',
    explanation: 'doctor-authority-shot',
    recovery: 'before-after-reaction',
    lifestyle: 'lifestyle-kitchen',
    social_proof: 'mom-kitchen-trust',
    cta: 'product-showcase-hold',
  }
  const targetLabelEn = map[t ?? ''] ?? 'product-showcase-hold'
  return SCENE_PRESETS.find((p) => p.labelEn === targetLabelEn) ?? SCENE_PRESETS[0]
}

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

/** Default rotation: gives Gemini a diverse starting set of 9 presets.
 *  Updated for optimization phase — maximize composition/pose/environment variety. */
export const DEFAULT_PRESET_ROTATION: string[] = [
  'vulnerable-hook',         // 1 — emotional hook (NEW)
  'reaction-shocked',        // 2 — pattern interrupt (NEW)
  'doctor-explanation',      // 3 — credibility / mechanism (NEW)
  'desk-review',             // 4 — ingredient callout
  'using-product',           // 5 — proof / demo
  'mom-kitchen-recommendation',  // 6 — trust + lifestyle (NEW)
  'before-after-reaction',   // 7 — result reveal
  'comment-reply-pov',       // 8 — social proof reply (NEW)
  'product-showcase',        // 9 — CTA hero
]

/** Alternative rotations — Gemini can swap based on script topic. */
export const PRESET_ROTATIONS_BY_VIBE: Record<string, string[]> = {
  'female-30+-supplement': [
    'vulnerable-hook', 'office-worker-pain', 'doctor-explanation',
    'using-product', 'desk-review', 'mom-kitchen-recommendation',
    'before-after-reaction', 'night-routine-bedroom', 'product-showcase',
  ],
  'young-tiktok': [
    'reaction-shocked', 'tiktok-pov', 'selfie-review',
    'using-product', 'desk-review', 'comment-reply-pov',
    'before-after-reaction', 'lifestyle-kitchen', 'product-showcase',
  ],
  'beauty-skincare': [
    'vulnerable-hook', 'bathroom-routine', 'doctor-explanation',
    'using-product', 'desk-review', 'before-after-reaction',
    'night-routine-bedroom', 'mom-kitchen-recommendation', 'product-showcase',
  ],
  'couple-family': [
    'partner-recommendation', 'office-worker-pain', 'doctor-explanation',
    'using-product', 'mom-kitchen-recommendation', 'lifestyle-kitchen',
    'before-after-reaction', 'partner-recommendation', 'product-showcase',
  ],
}
