// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — IMAGE PURPOSE ROLES (v4.3)
//
// Every generated image MUST belong to ONE purpose role. Necessity test:
// nếu image không có purpose role rõ → DROP, không generate.
//
// Goal: avoid "minh họa text" syndrome. Images amplify emotion / create
// atmosphere / support pacing — không phải explain literally.
//
// "Would a real family member post this photo on Facebook?" hard test.
// ─────────────────────────────────────────────────────────────────────

import type { ImagePurposeRole } from '../types'

export interface ImagePurposeRoleSpec {
  role: ImagePurposeRole
  description: string
  /** Vietnamese visual examples / framing notes. */
  examples: string[]
  /** Continuity required? Face must match anchor. */
  facialContinuity: 'required' | 'optional' | 'none'
  /** Composition guideline. */
  framingHint: string
}

export const IMAGE_PURPOSE_ROLES: Record<ImagePurposeRole, ImagePurposeRoleSpec> = {
  'anchor-face': {
    role: 'anchor-face',
    description: 'Identity anchor — sets face/age/ethnicity/hair lock for entire pack',
    examples: [
      'Người phụ nữ ngồi mép giường lúc sáng sớm, ánh sáng lạnh qua rèm',
      'Khuôn mặt nghỉ ngơi nhìn ngang, ánh sáng cửa sổ tự nhiên',
      'Ngồi tại bàn ăn, gương mặt 3/4, không nhìn camera',
    ],
    facialContinuity: 'required',
    framingHint: 'Medium close-up, 3/4 face, eye-line dropped, soft natural light. NO direct camera contact.',
  },

  'environment': {
    role: 'environment',
    description: 'Wide place sense — kitchen / living room / bedroom. Atmosphere only',
    examples: [
      'Phòng bếp buổi sáng, khói nhẹ từ ly cà phê',
      'Hành lang căn hộ với ánh sáng từ ban công',
      'Bàn ăn gia đình đã ăn xong, dĩa còn lại',
    ],
    facialContinuity: 'none',
    framingHint: 'Wide / medium shot of environment. No primary subject. Light + objects tell story.',
  },

  'emotion-detail': {
    role: 'emotion-detail',
    description: 'Partial face / hands / micro physical discomfort — NOT full face',
    examples: [
      'Tay đặt lên đầu gối, chân blur background',
      'Bàn tay cầm điện thoại hơi run, chăn giường blur',
      'Khuôn miệng thoáng nhếch — không thấy mắt',
      'Tay vịn cầu thang, chụp từ phía sau lệch vai',
    ],
    facialContinuity: 'optional',
    framingHint: 'Close-up of body part / partial face. Anonymous enough to project reader self.',
  },

  'memory-snapshot': {
    role: 'memory-snapshot',
    description: 'Candid moment, slightly blurred — like phone catch',
    examples: [
      'Hai người ngồi quán cà phê, góc chụp như ai đó chụp lén',
      'Em gái nói chuyện trong sân nhà, ly trà giữa khung',
      'Đứa em họ kể chuyện ở bếp, hơi out-focus',
    ],
    facialContinuity: 'optional',
    framingHint: 'Slight motion blur / shallow depth / casual angle. Like a real iPhone snap. NOT staged.',
  },

  'object-symbol': {
    role: 'object-symbol',
    description: 'Flat-lay objects telling story — failed attempts collection',
    examples: [
      'Trên bàn: dầu nóng, miếng dán, ly nước, khăn cũ — hơi messy tự nhiên',
      'Kệ bếp: vitamin, viên gừng, gel massage — vài món chưa dùng hết',
      'Bàn ngủ: cốc trà, sách đọc dở, đồng hồ — buổi tối',
    ],
    facialContinuity: 'none',
    framingHint: 'Flat-lay / overhead. Natural surface (wood, marble, fabric). NO infographic style. NO arrow / label overlay.',
  },

  'product-presence': {
    role: 'product-presence',
    description: 'Product in domestic context — ~15% of frame, NOT hero shot',
    examples: [
      'Sản phẩm trên kệ bếp, cạnh bình cà phê — góc rộng',
      'Hộp sản phẩm trên bàn ăn buổi sáng, ánh nắng tự nhiên',
      'Trên bàn ngủ, cạnh ly nước, không center-frame',
    ],
    facialContinuity: 'none',
    framingHint: 'Product occupies ~15% of frame. Domestic context dominates. NO commercial hero shot, NO center symmetry, NO branded backdrop.',
  },

  'relief-lifestyle': {
    role: 'relief-lifestyle',
    description: 'Post-recovery candid — daily life resumed, energy returned',
    examples: [
      'Đi chợ sáng, cầm túi rau — wide candid, không pose',
      'Nấu ăn trong bếp, ánh sáng chiều — slight smile',
      'Đi bộ với con / bạn ngoài công viên — back/side angle',
      'Cắm hoa trên bàn ăn, không nhìn camera',
    ],
    facialContinuity: 'required',
    framingHint: 'Same person from anchor. Candid action shots. Quality-of-life detail. NO fitness vibe, NO influencer pose.',
  },

  'silence-frame': {
    role: 'silence-frame',
    description: 'Landscape / window / no character — breathing pause',
    examples: [
      'Cửa sổ phòng khách buổi chiều, không người',
      'Cảnh ngoài ban công nhìn ra ngõ',
      'Landscape — trời chiều, ánh sáng cuối ngày',
      'Cây xanh, ghế trống trong sân',
    ],
    facialContinuity: 'none',
    framingHint: 'Empty space / view / landscape. NO character. Emotional anchor only. Pause / closure moment.',
  },
}

/** Compose 1-line directive for prompt injection per image. */
export function imagePurposeRoleInstruction(role: ImagePurposeRole): string {
  const spec = IMAGE_PURPOSE_ROLES[role]
  return `${role}: ${spec.description}. Framing: ${spec.framingHint}`
}

/** Necessity test prompt — image gen pipeline self-check. */
export const NECESSITY_TEST_PROMPT =
  `Image necessity test — for each image generated:

GOAL: image AMPLIFIES emotion / atmosphere / pacing — KHÔNG explain text literally.

REQUIRED:
- Belong to ONE of 8 purpose roles (anchor-face / environment / emotion-detail /
  memory-snapshot / object-symbol / product-presence / relief-lifestyle / silence-frame)
- Add narrative value the text alone doesn't carry
- "Would a real family member post this photo on Facebook?" → YES

DROP IMAGE IF:
- No clear purpose role assignment
- Just illustrates what text already said
- Pinterest aesthetic / luxury editorial / fashion campaign / catalog vibe
- Center-frame commercial composition
- Over-aestheticized lighting (hyper golden hour)
- Identity drift risk (face uncertain)
- Smiling-at-camera commercial pose

Better NO image than wrong identity / aesthetic drift.`
