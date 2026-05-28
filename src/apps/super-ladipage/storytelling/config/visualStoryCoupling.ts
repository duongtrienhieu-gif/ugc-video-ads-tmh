// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — VISUAL STORY COUPLING (Chunk E rebuilds)
//
// Coherence helper for image generation pipeline. Post-Reader-Immersion
// rebuild: block-keyed instead of section-keyed. Per-block image plan now
// lives in SECTION_VISUAL_MAP (visualLanguage.ts). Detailed per-block
// image purpose roles + camera language assignments deferred to Chunk E
// (visual system rebuild).
// ─────────────────────────────────────────────────────────────────────

import type {
  BlockId, CameraLanguage, ImagePurposeRole, NarratorArchetype,
} from '../types'
import { IMAGE_PURPOSE_ROLES } from './imagePurposeRoles'
import { CAMERA_LANGUAGES } from './cameraLanguage'
import { BLOCK_POOL } from './blockPool'

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

/** Compose image prompt fragment from narrator + block. */
export function composeVisualPrompt(
  narrator: NarratorArchetype,
  blockId: BlockId,
  purposeRole: ImagePurposeRole,
  cameraStyle: CameraLanguage,
): VisualPromptFragment {
  const roleSpec = IMAGE_PURPOSE_ROLES[purposeRole]
  const cameraSpec = CAMERA_LANGUAGES[cameraStyle]
  const blueprint = BLOCK_POOL[blockId]

  const subject = `${narrator.gender === 'female' ? 'Vietnamese woman' : 'Vietnamese man'} ` +
                  `age ${narrator.ageRange}, ${narrator.personalityVibe} vibe`

  const setting = narrator.lifestyle

  // Mood derived from block phase + psychologicalFunction (Chunk E will refine).
  const mood = `mood: ${blueprint?.phase ?? 'recognition'}/${blueprint?.psychologicalFunction ?? ''}`

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

/** Compose 1-line visual coherence summary — text gen consume too. */
export function visualCoherenceSummary(narrator: NarratorArchetype, blockId: BlockId): string {
  const blueprint = BLOCK_POOL[blockId]
  if (!blueprint) return `(no visual plan for block "${blockId}")`
  return `Image coherence: ${narrator.gender === 'female' ? 'female' : 'male'} ${narrator.ageRange} in ${narrator.lifestyle.split(',')[0]}, ` +
         `phase=${blueprint.phase}, function=${blueprint.psychologicalFunction}`
}

export const VISUAL_COHERENCE_PROMPT =
  `═══ VISUAL STORY COUPLING ═══

Mỗi image must be consistent với:
1. NARRATOR identity (gender / age / lifestyle / personality vibe)
2. Block phase + psychologicalFunction
3. Image purpose role (anchor-face / environment / emotion-detail / etc.)
4. Camera language (partial-face / static-quiet / softer-wider / etc.)

For text gen NOW: align text mood + setting với narrator's lifestyle context.
KHÔNG describe a scene that contradicts narrator's identity.

Chunk E (visual rebuild) will replace per-block visual taxonomy with
psychological mirror visual archetypes — POV/candid/handheld/everyday-mess.`
