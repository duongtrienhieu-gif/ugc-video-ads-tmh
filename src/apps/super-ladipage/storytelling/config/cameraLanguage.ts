// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — CAMERA LANGUAGE SYSTEM (v4.3)
//
// Visual grammar per emotional beat. Storyselling realism — KHÔNG để
// engine drift sang Pinterest / luxury editorial / cinematic
// overcomposition / influencer aesthetic.
//
// Each section gets 1-2 camera language styles in blueprint. Image gen
// prompt injects these as visual treatment directives.
// ─────────────────────────────────────────────────────────────────────

import type { CameraLanguage, EmotionalBeat } from '../types'

export interface CameraLanguageSpec {
  style: CameraLanguage
  description: string
  /** Vietnamese visual notes — for prompt context. */
  notes: string
  /** Aspect ratio preference. */
  aspectHint: '1:1' | '4:5' | '3:4' | '9:16' | '16:9'
  /** Light direction / temperature hint. */
  lightHint: string
}

export const CAMERA_LANGUAGES: Record<CameraLanguage, CameraLanguageSpec> = {
  'partial-face-observational': {
    style: 'partial-face-observational',
    description: 'Pain/friction sections — observational distance, không full face',
    notes: 'Chụp từ phía sau / lệch vai / khuôn mặt 3/4. Không direct camera contact. Không posed.',
    aspectHint: '4:5',
    lightHint: 'Soft side light, slightly cool — morning window or overhead fluorescent. NOT golden hour.',
  },

  'static-quiet-frame': {
    style: 'static-quiet-frame',
    description: 'Reflection / belief-shift — still, contemplative',
    notes: 'Khung hình tĩnh. Không motion. Subject ngồi yên / đứng yên. Có khoảng trống quanh.',
    aspectHint: '4:5',
    lightHint: 'Ambient natural light, low contrast. Late afternoon hoặc indoor window light.',
  },

  'softer-wider-composition': {
    style: 'softer-wider-composition',
    description: 'Hope/discovery — wider breathing room, softer light',
    notes: 'Wider framing — subject smaller in frame. Background visible. Less compression.',
    aspectHint: '3:4',
    lightHint: 'Soft warm natural light, slightly diffused. Morning hoặc late afternoon.',
  },

  'breathing-warm-space': {
    style: 'breathing-warm-space',
    description: 'Relief/payoff — warm tone, lifestyle ease',
    notes: 'Warmer color palette. Lifestyle composition. Subject doing something natural (cooking, walking).',
    aspectHint: '4:5',
    lightHint: 'Warm afternoon light. Slight haze OK. Natural skin tone.',
  },

  'environmental-distance': {
    style: 'environmental-distance',
    description: 'Internal-fear — observed from outside, subject smaller in frame',
    notes: 'Wide environmental shot. Subject occupies <30% of frame. Surroundings carry mood.',
    aspectHint: '16:9',
    lightHint: 'Available light, low-key. Slight shadow OK. NOT dramatic.',
  },

  'domestic-realism': {
    style: 'domestic-realism',
    description: 'Micro-reward / soft-reveal — kitchen / home everyday',
    notes: 'Indoor home setting. Familiar objects. Lived-in feel — slight clutter OK.',
    aspectHint: '4:5',
    lightHint: 'Indoor mixed light (window + lamp). Real domestic conditions, không stylized.',
  },

  'over-shoulder-peripheral': {
    style: 'over-shoulder-peripheral',
    description: 'Discovery / belief-shift — not center, casual catch',
    notes: 'Subject in peripheral / over-shoulder angle. Like phone catch / candid. NOT planned framing.',
    aspectHint: '4:5',
    lightHint: 'Whatever ambient available. Slight blur OK. Imperfection adds realism.',
  },
}

/** Map emotional beat → preferred camera languages. Section blueprint
 *  override available — this is fallback when blueprint doesn't specify. */
export const CAMERA_LANGUAGE_BY_BEAT: Record<EmotionalBeat, CameraLanguage[]> = {
  'calm-curious':         ['domestic-realism', 'partial-face-observational'],
  'subtle-unease':        ['partial-face-observational', 'environmental-distance'],
  'recurring-discomfort': ['static-quiet-frame', 'environmental-distance'],
  'frustration':          ['domestic-realism'],
  'quiet-reflection':     ['static-quiet-frame', 'over-shoulder-peripheral'],
  'hesitant-curiosity':   ['over-shoulder-peripheral', 'softer-wider-composition'],
  'tentative':            ['domestic-realism'],
  'first-hope':           ['softer-wider-composition', 'breathing-warm-space'],
  'acceptance-joy':       ['breathing-warm-space', 'domestic-realism'],
  'settled-resolve':      ['breathing-warm-space', 'static-quiet-frame'],
}

/** Compose 1-line directive for prompt injection per camera language. */
export function cameraLanguageInstruction(style: CameraLanguage): string {
  const spec = CAMERA_LANGUAGES[style]
  return `${style}: ${spec.notes} (${spec.lightHint})`
}

/** Anti-camera-drift guardrail. */
export const CAMERA_ANTI_DRIFT_PROMPT =
  `Camera language anti-drift rules:

BANNED visual styles (always reject):
- Pinterest aesthetic perfection
- Luxury editorial composition
- Fashion campaign poses
- Catalog symmetry
- Stock photo cleanliness
- Influencer aesthetic vibe
- Hyper golden-hour everything
- Commercial hero center-frame
- Smiling-at-camera in every image
- Same framing repeated across sections

ENFORCE:
- Documentary observational distance during pain/friction
- Wider breathing room during hope/relief
- Over-shoulder / peripheral during discovery
- Same primary character (anchor-face) across emotional / relief sections
- Different framing per section (NOT uniform composition)

Self-test: Does this look like a Vietnamese family album moment? Or like a brand stylist's portfolio? Family album = PASS. Portfolio = FAIL.`
