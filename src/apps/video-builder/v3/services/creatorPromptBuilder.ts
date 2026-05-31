// ── Creator Prompt Builder ───────────────────────────────────────────────────
// Z32 — Composes the KEYFRAME prompt + LIPSYNC prompt from the creator
// config + the avatar + the product. Stability over creativity.
//
// IDENTITY LOCK is the most important rule — we explicitly tell the
// model to preserve face, hair, skin tone, body type from the avatar
// reference image. Setting / wardrobe / energy override the rest.
// ─────────────────────────────────────────────────────────────────────────────

import type { Model, Product } from '../../../../stores/types'
import type { CreatorVideoConfig } from '../types'
import { CREATOR_SETTINGS, CREATOR_KEYFRAME_NEGATIVE } from './creatorSettings'
import { CREATOR_ENERGIES } from './creatorEnergy'

export interface BuildKeyframeParams {
  config: CreatorVideoConfig
  avatar: Model
  /** Product is optional — not every creator video shot needs the product in frame */
  product: Product | null
  /** Whether to include the product physically in the keyframe (for product_demo setting) */
  showProductInFrame: boolean
  /** 1-based position of the avatar image inside filesUrl (identity reference). */
  avatarRefIndex: number
  /** 1-based position of the product image inside filesUrl, or 0 if not sent. */
  productRefIndex: number
}

export interface BuildLipsyncPromptParams {
  config: CreatorVideoConfig
  /** Optional emphasis hints for tricky moments (e.g. "around 2.5s the speaker hesitates") */
  emphasisNotes?: string
}

// ── Keyframe prompt builder ────────────────────────────────────────────────

/**
 * Z32 — Build the prompt that gets sent to KIE GPT-4o image-edit to produce
 * the still keyframe the lipsync stage will animate.
 *
 * Hard structure:
 *   1. IDENTITY LOCK (face, hair, skin from avatar ref)
 *   2. ENVIRONMENT (from setting)
 *   3. FRAMING (from setting)
 *   4. WARDROBE (from config.wardrobeNote)
 *   5. EXPRESSION (from energy)
 *   6. OPTIONAL PRODUCT (if showProductInFrame)
 *   7. STYLE/REALISM cues
 *   8. NEGATIVE prompt (avoid cinematic / studio look)
 */
export function buildKeyframePrompt(params: BuildKeyframeParams): string {
  const setting = CREATOR_SETTINGS[params.config.setting]
  const energy = CREATOR_ENERGIES[params.config.energy]
  const avatarName = params.avatar.name ?? 'the speaker'

  const paragraphs: string[] = []

  // 1. Identity lock — most important
  paragraphs.push(
    `IDENTITY LOCK: This is ${avatarName} from reference image #${params.avatarRefIndex}. Preserve EXACTLY their ` +
    `face shape, eye colour, eyebrow shape, nose, lip shape, jaw line, skin tone, hair ` +
    `colour + length + texture, and body proportions. Do NOT redesign the face. The person ` +
    `in the output MUST be unambiguously the same individual as the reference.`,
  )

  // 2. Environment
  paragraphs.push(`ENVIRONMENT: ${setting.environmentPrompt}`)

  // 3. Framing
  paragraphs.push(`FRAMING: ${setting.framingPrompt}`)

  // 4. Wardrobe
  if (params.config.wardrobeNote.trim()) {
    paragraphs.push(`WARDROBE: ${params.config.wardrobeNote.trim()}`)
  } else {
    paragraphs.push('WARDROBE: casual home-appropriate outfit, simple natural colours.')
  }

  // 5. Expression
  paragraphs.push(`EXPRESSION: ${energy.expressionPrompt}`)

  // 6. Optional product — only reference it when we actually sent its image
  if (params.showProductInFrame && params.product && params.productRefIndex > 0) {
    const productName = params.product.productName ?? 'the product'
    paragraphs.push(
      `PRODUCT IN FRAME: ${productName} from reference image #${params.productRefIndex} is held naturally in the ` +
      `speaker's hand or visible on the surface near them. Preserve EXACT packaging design, ` +
      `label typography, and overall shape from reference image #${params.productRefIndex}. Do NOT redesign the ` +
      `product. Hands holding the product look natural — no malformed fingers.`,
    )
  }

  // 7. Style realism
  paragraphs.push(
    'STYLE: Authentic UGC iPhone photo — real lived-in moment, NOT a studio photoshoot. ' +
    'Natural light, real skin texture (pores visible, slight imperfection), believable ' +
    'casual aesthetic. Subtle grain. NOT cinematic, NOT editorial, NOT magazine.',
  )

  // 8. Negative
  paragraphs.push(CREATOR_KEYFRAME_NEGATIVE)

  return paragraphs.join('\n\n')
}

// ── Lipsync prompt builder ─────────────────────────────────────────────────

/**
 * Z32 — Build the prompt sent to the Kling Avatar / InfiniteTalk lipsync
 * endpoint along with the keyframe + audio.
 *
 * The lipsync prompt is SHORT — Kling Avatar reads pose + camera grammar
 * from the prompt while syncing lips to the audio. We DON'T re-describe
 * identity (the keyframe already locks it) — we describe MOTION only.
 */
export function buildLipsyncPrompt(params: BuildLipsyncPromptParams): string {
  const setting = CREATOR_SETTINGS[params.config.setting]
  const energy = CREATOR_ENERGIES[params.config.energy]

  const parts: string[] = []

  // Motion / camera grammar
  parts.push(setting.cameraPrompt)

  // Expression / pacing
  parts.push(
    `Speaker maintains the expression and pacing in the reference image. ${energy.expressionPrompt}`,
  )

  // Emphasis notes (optional)
  if (params.emphasisNotes && params.emphasisNotes.trim()) {
    parts.push(`Emphasis cues: ${params.emphasisNotes.trim()}`)
  }

  // Stability anchor — MOST IMPORTANT for lipsync renders
  parts.push(
    'Lip movement must precisely match the audio. Face identity, hair, outfit, lighting, ' +
    'and background remain IDENTICAL to the reference image throughout. No identity drift, ' +
    'no changing wardrobe mid-clip, no scene swaps. ONE continuous shot.',
  )

  return parts.join(' ')
}

// ── Preview-motion mini prompt (1-2s test) ─────────────────────────────────

/** A minimal prompt for the 1-2s motion test. Goal: validate identity +
 *  motion style cheap before paying for the full lipsync render. */
export function buildPreviewMotionPrompt(config: CreatorVideoConfig): string {
  const setting = CREATOR_SETTINGS[config.setting]
  return (
    `${setting.cameraPrompt} Speaker takes a subtle natural breath and small head ` +
    `movement. Face identity, hair, outfit, and background stay identical to the input image.`
  )
}
