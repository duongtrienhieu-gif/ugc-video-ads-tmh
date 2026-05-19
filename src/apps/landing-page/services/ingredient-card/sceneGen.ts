// ─────────────────────────────────────────────────────────────────────
// Photographic scene generator — single KIE gpt-4o-image call that
// produces the photographic composition (product centered, ingredients
// arranged around it on a clean background). NO text in this image —
// text labels are drawn on top by the canvas renderer.
//
// 2026-05-20 — switched from submitGptImage2 → submitGpt4oImage to lock
// product identity. gpt-image-2 is TEXT-ONLY and silently ignores the
// filesUrl product refs we send, causing the ingredient-card backdrop
// to render a random brand (Shaklee/PHARMANEX) instead of the user's
// actual product. /gpt4o-image/generate is TRUE i2i and consumes refs.
// ─────────────────────────────────────────────────────────────────────

import { submitGpt4oImage, pollGpt4oUntilDone } from '../../../../utils/kieai'
import { saveAsset } from '../../../../utils/assetStore'
import type { IngredientCardVariant, IngredientItem } from './types'

interface GenerateSceneArgs {
  productName: string
  ingredients: IngredientItem[]
  variant: IngredientCardVariant
  /** Reference URLs for the actual product (locks identity). */
  productRefUrls: string[]
  kieApiKey: string
  variationSeed?: string
}

// Per-variant aesthetic envelope. Layered on top of a shared core spec so
// the photographic style matches the canvas chrome variant.
const VARIANT_AESTHETIC: Record<IngredientCardVariant, string> = {
  'minimal-wellness':
    'AESTHETIC: minimal wellness brand still-life. Off-white / linen background, soft natural daylight from above, gentle shadows. Generous whitespace. Aman / Tatcha / Aesop visual register.',
  'clinical-clean':
    'AESTHETIC: clinical magazine still-life. Pale cool background (soft blue-grey or warm white), even diffused studio light, low contrast. Reference: scientific health magazine still-life.',
  'tiktok-ad':
    'AESTHETIC: TikTok ad creative frame. Warmer light, slightly punchier contrast, modern e-commerce campaign feel. Off-white background with subtle shadow. Reference: Arcads / Huel creative ad frame.',
  'premium-supplement':
    'AESTHETIC: premium supplement brand still-life. Warm cream / soft beige background, golden-hour natural daylight, soft cinematic shadow. Reference: Aman wellness / luxury supplement campaign.',
}

const SCENE_PROMPT = (args: GenerateSceneArgs): string => {
  const ingredientList = args.ingredients
    .map((i) => i.name)
    .filter(Boolean)
    .slice(0, 5)
    .join(', ')

  return [
    'INGREDIENT CARD COMPOSITION — wellness brand still-life:',
    '',
    `PRODUCT (must be centered, dominant, exact identity from reference image): ${args.productName}.`,
    '  • Pixel-for-pixel same brand label, typography, bottle/can/jar shape, cap, colors as the uploaded reference image. NEVER invent a different brand. NEVER swap to a similar product.',
    '  • Premium product lighting — soft natural light, clean isolated shadow under the product.',
    '',
    `INGREDIENTS arranged ORBITING around the product (real photography, NOT CGI, NOT cartoon): ${ingredientList}.`,
    '  • Asymmetrical floating composition — ingredients placed around the product with breathing room, NOT in a flat grid.',
    '  • Examples of arrangement: one ingredient top-left of product, one mid-right, one bottom-right, one bottom-left, one upper-right.',
    '  • Each ingredient is a single realistic specimen on the surface (eg a small pile of blueberries, one lemon wedge, a thyme sprig, a small piece of mushroom, a small kale leaf).',
    '  • Soft contact shadow under each ingredient — looks photographed, NOT pasted.',
    '  • Ingredients DO NOT touch or overlap the product.',
    '',
    VARIANT_AESTHETIC[args.variant],
    '',
    'CRITICAL RULES:',
    '  • NO text, NO labels, NO callouts, NO numbers, NO arrows, NO connector lines, NO brand wordmark TEXT in this image (text will be added by a separate post-process layer).',
    '  • NO additional bottles, NO multiple product copies, NO packaging box.',
    '  • NO person, NO hands, NO body parts.',
    '  • NO marketplace UI, NO discount badges, NO emoji rendered into image.',
    '  • Square 1:1 composition with the product visually centered.',
    `  • Seed: ${args.variationSeed ?? Math.random().toString(36).slice(2, 8)}.`,
  ].join('\n')
}

export async function generateIngredientScene(args: GenerateSceneArgs): Promise<string> {
  if (args.productRefUrls.length === 0) {
    throw new Error('Cần ít nhất 1 ảnh sản phẩm để lock identity — vui lòng upload ảnh sản phẩm vào Visual Memory.')
  }

  const prompt = SCENE_PROMPT(args)

  const { taskId } = await submitGpt4oImage({
    apiKey: args.kieApiKey,
    prompt,
    filesUrl: args.productRefUrls.slice(0, 3),
    size: '1:1',
    enableFallback: true,
  })

  const remoteUrl = await pollGpt4oUntilDone({
    apiKey: args.kieApiKey,
    taskId,
    timeoutMs: 100_000,
  })

  const resp = await fetch(remoteUrl)
  if (!resp.ok) throw new Error(`Fetch scene image failed: ${resp.status}`)
  const blob = await resp.blob()
  if (blob.size < 1000) throw new Error('Scene response too small — possibly corrupt')

  return await saveAsset(blob, blob.type || 'image/png')
}
