// ═════════════════════════════════════════════════════════════════════
// Prompt Translation — type definitions (P10 deterministic translator)
//
// Translates ImageIntent → ImagePromptContract. Pure translation, NOT
// prompt engineering. NO aesthetic invention. NO model-specific syntax.
// NO Midjourney magic words. NO cinematic poetry.
//
// LOCKED: fragments are short neutral descriptors. The prompt builder
// is a TRANSLATOR, not a creative writer.
//
// LOCKED: 6 buckets (user-specified, no expansion):
//   positiveFragments / negativeFragments / realismFragments /
//   compositionFragments / atmosphereFragments / avoidanceFragments
//
// LOCKED: renderer-agnostic. Future model adapters (Midjourney/SDXL/
// Flux/etc.) consume fragments independently — no model lock-in here.
// ═════════════════════════════════════════════════════════════════════

import type { ImageIntentSection, ImageIntentPage } from '../imageSemantics'

// ─── ImagePromptContract — 6 fragment buckets (user-specified) ─────

export interface ImagePromptContract {
  /** Union of realism + composition + atmosphere — renderer convenience. */
  positiveFragments: string[]
  /** Alias of avoidanceFragments — renderer convenience for neg-prompt models. */
  negativeFragments: string[]
  /** Fragments from realismLevel + polishLevel. */
  realismFragments: string[]
  /** Fragments from framingStyle + compositionTension + subjectDistance. */
  compositionFragments: string[]
  /** Fragments from lightingMood + visualNoise + emotionalState. */
  atmosphereFragments: string[]
  /** Anti-aesthetic governance block — static global + role-conditional. */
  avoidanceFragments: string[]
}

// ─── ImagePromptSection extends ImageIntentSection ────────────────

export interface ImagePromptSection extends ImageIntentSection {
  /** Present only when imageIntent exists (imageRole !== 'none'). */
  imagePromptContract?: ImagePromptContract
}

// ─── ImagePromptPage extends ImageIntentPage ──────────────────────

export interface ImagePromptPage extends ImageIntentPage {
  sections: ImagePromptSection[]
  /** Soft warnings from promptContractValidator. */
  promptContractWarnings: string[]
  /** Count of sections that received an imagePromptContract. */
  promptBearingSectionCount: number
}
