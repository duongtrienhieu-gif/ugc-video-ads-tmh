// ── Creator Settings ─────────────────────────────────────────────────────────
// Z32 §4-5 — 8 environment + framing presets for the main creator video.
//
// Each setting defines:
//   • room/environment prompt fragment (kitchen / desk / couch / etc)
//   • framing/composition (selfie 9:16 vertical, mid-shot, etc)
//   • camera grammar (handheld micro-shake / locked-off / subtle drift)
//
// CAMERA RULES (Z32 §5):
//   Motion MUST feel handheld + subtle + imperfect + natural.
//   Allowed: slight sway, micro head movement, tiny zoom, phone reposition,
//            blink / expression shifts.
//   FORBIDDEN: cinematic moves, crane shots, dramatic pans, excessive
//              motion. NO cinematic AI filmmaking — believable UGC only.
// ─────────────────────────────────────────────────────────────────────────────

import type { CreatorSettingId } from '../types'

export interface CreatorSettingConfig {
  id: CreatorSettingId
  labelVi: string
  descriptionVi: string
  emoji: string
  /** Prompt fragment describing the environment — appended to keyframe prompt */
  environmentPrompt: string
  /** Framing description — what the camera sees */
  framingPrompt: string
  /** Camera grammar — appended to lipsync prompt to control motion style */
  cameraPrompt: string
  /** Recommended aspect ratio (vertical TikTok by default) */
  aspectRatio: '9:16' | '16:9' | '1:1'
  /** UI tint */
  tone: 'rose' | 'violet' | 'amber' | 'emerald' | 'sky' | 'pink'
}

export const CREATOR_SETTINGS: Record<CreatorSettingId, CreatorSettingConfig> = {
  selfie_handheld: {
    id: 'selfie_handheld',
    labelVi: 'Selfie tự cầm',
    descriptionVi: 'Cầm điện thoại tự quay, chest-up framing, casual nhất.',
    emoji: '🤳',
    environmentPrompt:
      'Natural home interior background, slightly out-of-focus, warm afternoon ambient light. ' +
      'Wall + small details visible behind the speaker — NOT a studio backdrop.',
    framingPrompt:
      'Front-facing selfie composition, chest-up frame, vertical 9:16, eyes meet camera lens. ' +
      'Phone held at arm length, very slight downward tilt natural for selfie grip.',
    cameraPrompt:
      'Hand-held phone selfie. Subtle natural sway from holding the phone — not cinematic, ' +
      'not stable rig. Micro-shake throughout. NO camera moves, NO crane, NO dramatic pan.',
    aspectRatio: '9:16',
    tone: 'rose',
  },

  desk_talking: {
    id: 'desk_talking',
    labelVi: 'Ngồi bàn làm việc',
    descriptionVi: 'Phone đặt trên giá, người ngồi ghế, mid-shot.',
    emoji: '💻',
    environmentPrompt:
      'Home office desk, warm tungsten lamp + soft window daylight mix. Laptop, notebook, ' +
      'plant or coffee mug visible at edge of frame — lived-in, NOT a YouTube studio.',
    framingPrompt:
      'Mid-shot front-facing, shoulders + chest in frame, vertical 9:16, eye-level camera. ' +
      'Speaker seated at desk, hands occasionally enter the frame to gesture.',
    cameraPrompt:
      'Camera locked on a phone tripod with subtle micro-drift. Almost-still, but with the ' +
      'tiny imperfections of a UGC setup — NOT a perfectly stabilised cinema rig.',
    aspectRatio: '9:16',
    tone: 'violet',
  },

  couch_talking: {
    id: 'couch_talking',
    labelVi: 'Ngồi sofa',
    descriptionVi: 'Lounge tư thế thoải mái, vibe tâm sự.',
    emoji: '🛋️',
    environmentPrompt:
      'Cozy living room couch, soft blanket or cushion visible, warm evening ambient light. ' +
      'Background slightly blurred — TV or window faintly visible.',
    framingPrompt:
      'Chest-up framing, slight tilt as the speaker leans into couch. Vertical 9:16. ' +
      'Casual posture — one elbow propped, head slightly tilted toward camera.',
    cameraPrompt:
      'Phone leaned against a cushion or held loose. Very slow gentle drift — like someone ' +
      'almost forgot they\'re filming. Allow tiny re-framing motion every few seconds.',
    aspectRatio: '9:16',
    tone: 'amber',
  },

  bathroom_mirror: {
    id: 'bathroom_mirror',
    labelVi: 'Gương phòng tắm',
    descriptionVi: 'Selfie qua gương — morning routine / skincare niche.',
    emoji: '🪞',
    environmentPrompt:
      'Clean bathroom with a large mirror, soft cool morning daylight from a side window. ' +
      'Towel, plant, or skincare bottle visible in mirror reflection — lived-in.',
    framingPrompt:
      'Mirror selfie — phone visible in hand, body framed from waist up via mirror. ' +
      'Vertical 9:16, slight angle from holding phone at chest level pointing at mirror.',
    cameraPrompt:
      'Hand-held selfie WITH the bounce of a mirror reflection — very slight sway as the ' +
      'speaker shifts weight. NO orbit. NO cinematic move. Like a real morning vlog.',
    aspectRatio: '9:16',
    tone: 'pink',
  },

  kitchen_talking: {
    id: 'kitchen_talking',
    labelVi: 'Bếp / quầy bếp',
    descriptionVi: 'Standing tại bếp, casual lifestyle.',
    emoji: '🍳',
    environmentPrompt:
      'Home kitchen with morning daylight from a window, counter visible with subtle details ' +
      '(coffee mug, fruit bowl, cutting board). Natural and lived-in, NOT a magazine shoot.',
    framingPrompt:
      'Chest-up framing, speaker standing at kitchen counter. Vertical 9:16, eye-level camera. ' +
      'Phone on a counter stand or held by another hand briefly.',
    cameraPrompt:
      'Phone-on-counter framing with extremely subtle micro-shake. Allow a single gentle ' +
      'reposition mid-clip. NO cinematic motion.',
    aspectRatio: '9:16',
    tone: 'emerald',
  },

  gym_selfie: {
    id: 'gym_selfie',
    labelVi: 'Selfie gym',
    descriptionVi: 'Sau workout, vibe khoẻ khoắn, gym bg blurred.',
    emoji: '🏋️',
    environmentPrompt:
      'Gym interior background, slightly out of focus — equipment, weights, machines visible ' +
      'but soft. Mixed gym lighting (industrial overhead + window). Speaker may have light sweat sheen.',
    framingPrompt:
      'Chest-up selfie framing, vertical 9:16, speaker recently active. Phone held at slight ' +
      'upward tilt — typical post-workout grip.',
    cameraPrompt:
      'Hand-held phone selfie with a TINY breath rhythm — speaker still recovering from movement. ' +
      'NO cinematic camera. NO drone. Just UGC gym selfie energy.',
    aspectRatio: '9:16',
    tone: 'amber',
  },

  walking_vlog: {
    id: 'walking_vlog',
    labelVi: 'Vừa đi vừa nói',
    descriptionVi: 'Walking + talking outdoor — vlogger pace.',
    emoji: '🚶',
    environmentPrompt:
      'Outdoor sidewalk or park path, natural daylight, soft motion blur in background as the ' +
      'speaker walks. Trees, buildings, or street details slightly out of focus.',
    framingPrompt:
      'Selfie framing, chest-up, vertical 9:16. Speaker walking toward / past camera held in hand. ' +
      'Subtle background parallax as movement progresses.',
    cameraPrompt:
      'Hand-held vlogger pace — bouncier than indoor selfie. Visible walking rhythm in the ' +
      'camera. Still UGC, NOT a Steadicam shot.',
    aspectRatio: '9:16',
    tone: 'sky',
  },

  product_demo: {
    id: 'product_demo',
    labelVi: 'Demo sản phẩm',
    descriptionVi: 'Cầm sản phẩm và giải thích — closer framing.',
    emoji: '🎬',
    environmentPrompt:
      'Same as desk or couch setting — calm interior background with soft natural light. ' +
      'Product visible in speaker\'s hands or on desk in front. Background slightly blurred.',
    framingPrompt:
      'Closer framing — chest-up but tighter to make product readable. Vertical 9:16. Speaker ' +
      'holds product in one hand, occasionally turns it to show the label.',
    cameraPrompt:
      'Phone on tripod or held by an assistant — almost-still with subtle drift. Slight ' +
      'natural shift when the speaker repositions the product. NO macro-zoom, NO cinematic move.',
    aspectRatio: '9:16',
    tone: 'violet',
  },
}

export const CREATOR_SETTING_ORDER: CreatorSettingId[] = [
  'selfie_handheld',
  'desk_talking',
  'couch_talking',
  'bathroom_mirror',
  'kitchen_talking',
  'gym_selfie',
  'walking_vlog',
  'product_demo',
]

/** Universal negative prompt fragment for the keyframe — same across all
 *  settings. Prevents the model from going cinematic / studio / fake. */
export const CREATOR_KEYFRAME_NEGATIVE =
  'Avoid: studio backdrop, cinematic lighting, dramatic spotlight, ' +
  'professional photoshoot look, perfect skin retouch, beauty filter, ' +
  'magazine-cover aesthetic, fake-bokeh, low-quality plastic skin, ' +
  '3D-render look, cartoon, anime, distorted hands, malformed face.'
