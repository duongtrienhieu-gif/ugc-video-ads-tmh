// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — VISUAL STORY COUPLING (v5.5)
//
// Coherence helper for Phase 4 image generation pipeline.
// Combines narrator archetype + section's emotional state + image purpose
// role + camera language → coherent image prompt fragment.
//
// Current Phase = data layer only. Phase 4 image gen will CONSUME these
// helpers when wiring KIE image generation per section.
// ─────────────────────────────────────────────────────────────────────

import type {
  CameraLanguage, ImagePurposeRole, NarratorArchetype, SectionId,
} from '../types'
import { IMAGE_PURPOSE_ROLES } from './imagePurposeRoles'
import { CAMERA_LANGUAGES } from './cameraLanguage'
import { SECTION_BLUEPRINTS } from './sectionBlueprints'

export interface VisualPromptFragment {
  /** Subject description — derived from narrator. */
  subject: string
  /** Setting / environment hint. */
  setting: string
  /** Image purpose role. */
  purposeRole: ImagePurposeRole
  /** Camera language style. */
  cameraStyle: CameraLanguage
  /** 1-line emotional mood. */
  mood: string
  /** Composition guidance. */
  framing: string
  /** Lighting guidance. */
  lighting: string
}

/** Compose image prompt fragment from narrator + section. */
export function composeVisualPrompt(
  narrator: NarratorArchetype,
  sectionId: SectionId,
  purposeRole: ImagePurposeRole,
  cameraStyle: CameraLanguage,
): VisualPromptFragment {
  const roleSpec = IMAGE_PURPOSE_ROLES[purposeRole]
  const cameraSpec = CAMERA_LANGUAGES[cameraStyle]
  const blueprint = SECTION_BLUEPRINTS[sectionId]

  // Subject derived from narrator
  const subject = `${narrator.gender === 'female' ? 'Vietnamese woman' : 'Vietnamese man'} ` +
                  `age ${narrator.ageRange}, ${narrator.personalityVibe} vibe`

  // Setting from narrator lifestyle (extract key element)
  const setting = narrator.lifestyle

  // Mood from blueprint's emotionalBeat
  const mood = `mood: ${blueprint.emotionalBeat}`

  return {
    subject,
    setting,
    purposeRole,
    cameraStyle,
    mood,
    framing: roleSpec.framingHint,
    lighting: cameraSpec.lightHint,
  }
}

/** Compose 1-line summary for prompt injection (text gen consume too). */
export function visualCoherenceSummary(narrator: NarratorArchetype, sectionId: SectionId): string {
  const blueprint = SECTION_BLUEPRINTS[sectionId]
  const roles = blueprint.imagePurposeRoles ?? []
  const cameras = blueprint.cameraLanguage ?? []
  if (roles.length === 0 || cameras.length === 0) {
    return `(no visual plan for this section)`
  }
  return `Image coherence: ${narrator.gender === 'female' ? 'female' : 'male'} ${narrator.ageRange} in ${narrator.lifestyle.split(',')[0]}, ` +
         `role=[${roles.join(', ')}], camera=[${cameras.join(', ')}], mood=${blueprint.emotionalBeat}`
}

export const VISUAL_COHERENCE_PROMPT =
  `═══ VISUAL STORY COUPLING (v5.5) ═══

Mỗi image must be consistent với:
1. NARRATOR identity (gender / age / lifestyle / personality vibe)
2. Section emotional state (mood from blueprint)
3. Image purpose role (anchor-face / environment / emotion-detail / etc.)
4. Camera language (partial-face / static-quiet / softer-wider / etc.)

Image gen pipeline (Phase 4) consumes:
- composeVisualPrompt(narrator, sectionId, role, camera) → VisualPromptFragment
- visualCoherenceSummary(narrator, sectionId) → 1-line summary

For text gen NOW: align text mood + setting với narrator's lifestyle context.
KHÔNG describe a scene that contradicts narrator's identity (vd: narrator là
female-driver-fatigue-45 NHƯNG text mô tả ngồi office sang trọng).`
