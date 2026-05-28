// ═════════════════════════════════════════════════════════════════════
// Image Scene Synthesis — type definitions (POST-PRUNE 2026-05-27)
//
// REPLACEMENT for the prior fragment-stacking pipeline (intentMaps +
// fragmentMaps + 3 renderer adapters). Single-source-of-truth per image:
// read the section's narrative text + locked visual genre → produce ONE
// coherent scene prompt. No layered fragment concatenation.
//
// ARCHITECTURE LOCK:
//   - 1 Gemini call per image (cheap — gemini-2.5-flash)
//   - System instruction carries LOCKED visual genre (ladi-storytelling
//     diary aesthetic). Cannot be re-interpreted by Gemini.
//   - User prompt carries section text + imageRole + niche + protagonist
//     + (optional) product brief
//   - Output: SceneDescription with a SINGLE prompt string. No fragments,
//     no avoidance tail to concatenate later.
//
// ROUTING LOCK:
//   - 'gptImage'  (KIE gpt-image-2)      → object-trace WITHOUT product ref
//                                          (cheap flat-lay no-person, no-product)
//   - 'gpt4o'     (KIE gpt-4o-image)     → ALL OTHER imageRoles (need character
//                                          continuity reference + product lock)
//
// SEQUENCING LOCK:
//   - imageRole='hero-anchor' generates FIRST (no reference), produces the
//     character identity URL.
//   - Subsequent character-bearing roles RECEIVE that URL as a reference,
//     ensuring face/body continuity across 13-15 images.
// ═════════════════════════════════════════════════════════════════════

import type { ImageRole } from '../composer'
import type { NicheKey, LandingLanguage } from '../storytelling/types'

export type { ImageRole }

// ─── Renderer key (replaces old 3-renderer taxonomy) ──────────────────

/** Renderer routing key.
 *  - 'gptImage' = KIE gpt-image-2 (no-person no-product flat-lays)
 *  - 'gpt4o'    = KIE gpt-4o-image (character/product reference lock) */
export type SceneRendererKey = 'gptImage' | 'gpt4o'

// ─── Scene synthesis input (per section) ──────────────────────────────

export interface ProtagonistVisualContext {
  /** Short archetype label, e.g. "Malaysian Muslim woman, mid-30s". */
  archetype: string
  /** Full 80-120 word appearance description (locked across all images). */
  appearanceLock: string
  /** Optional 40-80 word environment description (home/room context). */
  environmentLock?: string
}

export interface ProductVisualContext {
  /** 1-sentence product identity from synthesis (color, shape, label). */
  productIdentityForImage: string
}

export interface SceneSynthesisInput {
  sectionId: string
  imageRole: ImageRole
  /** Plain narrative text of the section — concatenated paragraphs. */
  sectionText: string
  /** Optional heading / context for Gemini. */
  sectionHeading?: string
  /** Story phase 1-4 (recognition / trust / solution / future) — mood hint. */
  storyPhase?: 1 | 2 | 3 | 4
  niche: NicheKey
  protagonist: ProtagonistVisualContext
  /** Present when imageRole is product-visible AND user uploaded product images. */
  productContext: ProductVisualContext | null
  /** Output language for image scene — used for cultural anchors only. */
  targetLanguage: LandingLanguage
}

// ─── Scene description (output per section) ──────────────────────────

export interface RouterDecision {
  renderer: SceneRendererKey
  /** True if this image should receive the locked product reference URL. */
  requiresProductReference: boolean
  /** True if this image should receive the character anchor URL. */
  requiresCharacterReference: boolean
  /** True if this is the anchor-face image itself (generated first, becomes
   *  the character reference for subsequent sections). */
  isCharacterAnchorSource: boolean
}

export interface SceneDescription {
  sectionId: string
  imageRole: ImageRole
  /** Single coherent prompt — ~80-150 words. NO fragments to concatenate. */
  prompt: string
  routing: RouterDecision
  /** When this scene was synthesized (ms). */
  synthesizedAt: number
  /** Source: 'gemini' = Gemini call, 'fallback' = static role-based fallback. */
  source: 'gemini' | 'fallback'
}

// ─── Page-level synthesis output ──────────────────────────────────────

export interface PageSceneSynthesis {
  /** Map of sectionId → SceneDescription. Sections with imageRole='none' absent. */
  scenes: Record<string, SceneDescription>
  /** Total successful syntheses. */
  succeeded: number
  /** Sections that fell back to static role-based prompt. */
  fallbackCount: number
  /** Total ms wall-clock for parallel batch. */
  durationMs: number
}
