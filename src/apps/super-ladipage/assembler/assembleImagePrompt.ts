import type { ProductIdentity, ImageSlotConcept, LandingLanguage } from '../types'
import { RECIPE_TEMPLATES } from '../prompts/recipeTemplates'

// ─────────────────────────────────────────────────────────────────────
// Prompt Assembler — chỗ DUY NHẤT lắp prompt ảnh ENG.
//
// PURE FUNCTION. No AI call. No state. Same input → same output.
// Đây là chỗ thay thế "system prompt + ad-hoc overrides" của Ladipage cũ.
// ─────────────────────────────────────────────────────────────────────

export function assembleImagePrompt(args: {
  identity: ProductIdentity
  concept:  ImageSlotConcept
  language: LandingLanguage
}): string {
  const { identity, concept, language } = args
  const template = RECIPE_TEMPLATES[concept.recipeId]
  if (!template) {
    throw new Error(
      `assembleImagePrompt: unknown recipeId="${concept.recipeId}". ` +
      `Valid: ${Object.keys(RECIPE_TEMPLATES).join(', ')}`,
    )
  }
  return template({ identity, concept, language })
}

/** Map aspect ratio Super Ladipage → aspect ratio mà KIE gpt-image-2
 *  hỗ trợ (chỉ 1:1, 3:2, 2:3). */
export function mapAspectToKie(aspect: '1:1' | '4:5' | '16:9' | '9:16'): '1:1' | '3:2' | '2:3' {
  switch (aspect) {
    case '1:1':  return '1:1'
    case '4:5':  return '2:3' // portrait, gần nhất
    case '9:16': return '2:3' // portrait, gần nhất
    case '16:9': return '3:2' // landscape, gần nhất
    default:     return '1:1'
  }
}
