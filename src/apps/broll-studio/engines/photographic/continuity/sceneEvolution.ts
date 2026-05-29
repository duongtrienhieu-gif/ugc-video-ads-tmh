// ── Scene Evolution (P4) ───────────────────────────────────────────────────
//
// Higher-order pass that orchestrates outfit + emotion + realism so the
// pack reads as a real narrative arc, not a series of disconnected shots.
// Each section is annotated with what "stage" of the story it belongs to;
// the prompt builder then composes blocks that reflect the progression.

import type { CharacterMemory, RealismLevel } from '../../../types/continuity'
import type { SectionRole, EmotionalState } from '../../../types/narrative'
import { suggestEmotion, buildEmotionBlock } from '../../../shared/intent/emotionTimeline'
import { pickOutfit, buildOutfitBlock } from './outfitVariation'
import { getRealismPrompt } from '../../../shared/metadata/realismLevels'

/** Pre-computed evolution annotations for a single section. */
export interface SceneEvolution {
  role: SectionRole
  emotion: EmotionalState
  realism: RealismLevel
  outfitDescription: string
  /** Combined prompt fragment ready to be appended to the module prompt. */
  promptBlock: string
}

/**
 * Compute the evolution annotations for a section. Pure / deterministic.
 */
export function computeSceneEvolution(args: {
  memory: CharacterMemory
  role: SectionRole
  sectionIndex?: number
  totalSections?: number
  emotionOverride?: EmotionalState
  realismOverride?: RealismLevel
}): SceneEvolution {
  const emotion = args.emotionOverride
    ?? suggestEmotion(args.role, args.sectionIndex, args.totalSections)
  const realism = args.realismOverride ?? args.memory.realismLevel

  const outfit = pickOutfit(args.memory, args.role, args.sectionIndex ?? 0)

  const promptBlock = [
    buildEmotionBlock(emotion),
    buildOutfitBlock(outfit),
    `[REALISM]\n${getRealismPrompt(realism)}`,
  ].join('\n\n')

  return {
    role: args.role,
    emotion,
    realism,
    outfitDescription: outfit.description,
    promptBlock,
  }
}
