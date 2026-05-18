// ─────────────────────────────────────────────────────────────────────
// Ingredient UI Card — public entry point.
//
// renderIngredientCard()      — pure render from a fully-resolved spec.
// renderForLandingSlot()      — high-level helper that generates the
//                                photographic scene + parses ingredient
//                                content from the section's bullets +
//                                renders + saves.
// ─────────────────────────────────────────────────────────────────────

import { drawIngredientCard } from './cardRenderer'
import { generateIngredientScene } from './sceneGen'
import { parseIngredientBullet, lookupBenefit } from './ingredientBenefitMap'
import { loadImage } from '../chat-proof/canvasUtils'
import { postProcess } from '../chat-proof/postProcess'
import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'
import type {
  IngredientCardSpec, IngredientCardResult, IngredientCardVariant,
  IngredientCardContent, IngredientItem,
} from './types'

// Variant rotation per slot index — 4 ingredient images get 4 different
// variants if the section has that many slots.
const VARIANT_ROTATION: IngredientCardVariant[] = [
  'minimal-wellness',
  'tiktok-ad',
  'clinical-clean',
  'premium-supplement',
]

export async function renderIngredientCard(spec: IngredientCardSpec): Promise<IngredientCardResult> {
  const width = spec.width ?? 1080
  const height = spec.height ?? 1080

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  let sceneImage: HTMLImageElement | null = null
  if (spec.sceneRef) {
    const src = isAssetRef(spec.sceneRef) ? await getUrl(spec.sceneRef) : spec.sceneRef
    if (src) {
      try { sceneImage = await loadImage(src) } catch (err) {
        console.warn('[ingredient-card] scene image load failed:', err)
      }
    }
  }

  drawIngredientCard(ctx, width, height, spec.variant, spec.content, sceneImage)

  const { blob, mimeType } = await postProcess(canvas, spec.realism ?? 'subtle')
  return { blob, mimeType, width, height }
}

export interface RenderForLandingSlotArgs {
  slotIdx: number
  productName: string
  /** Section bullets — parsed as ingredient → benefit pairs. */
  sectionBullets: string[]
  /** Optional brand wordmark for the chrome (defaults to productName trimmed). */
  brandWordmark?: string
  /** Optional brand domain for the chrome. */
  brandDomain?: string
  /** Total slide count (used for "1 / N" indicator). */
  totalSlides?: number
  /** Reference URLs for the product (absolute URLs only). */
  productRefUrls: string[]
  kieApiKey: string
  variationSeed?: string
}

/** Parse the section's bullets into a clean ingredient list. Falls back
 *  to a generic ingredient set if parsing fails. */
export function parseIngredientsFromBullets(bullets: string[]): IngredientItem[] {
  const items: IngredientItem[] = []
  for (const b of bullets) {
    const parsed = parseIngredientBullet(b)
    if (parsed) {
      items.push({ name: parsed.name, benefit: parsed.benefit })
    }
  }
  // Fill from lookup if we got fewer than 3 — try splitting bullets
  // differently (whole bullet as ingredient name)
  if (items.length < 3) {
    for (const b of bullets) {
      const cleaned = b.replace(/^[•\-*]\s*/, '').trim()
      const firstTwoWords = cleaned.split(/\s+/).slice(0, 2).join(' ')
      const benefit = lookupBenefit(firstTwoWords) ?? lookupBenefit(cleaned)
      if (benefit && !items.some((it) => it.name.toLowerCase().includes(firstTwoWords.toLowerCase()))) {
        items.push({ name: firstTwoWords, benefit })
      }
      if (items.length >= 5) break
    }
  }
  return items.slice(0, 5)
}

function deriveDomain(productName: string): string {
  return productName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 14) + '.com'
}

export async function renderForLandingSlot(args: RenderForLandingSlotArgs): Promise<{
  assetRef: string
  mimeType: string
}> {
  const variant = VARIANT_ROTATION[args.slotIdx % VARIANT_ROTATION.length]
  const ingredients = parseIngredientsFromBullets(args.sectionBullets)

  if (ingredients.length === 0) {
    throw new Error('Không phân tích được ingredient từ bullets — vui lòng kiểm tra section copy.')
  }

  const seed = args.variationSeed ?? `slot${args.slotIdx}`

  // 1) Generate photographic scene
  const sceneRef = await generateIngredientScene({
    productName: args.productName,
    ingredients,
    variant,
    productRefUrls: args.productRefUrls,
    kieApiKey: args.kieApiKey,
    variationSeed: seed,
  })

  // 2) Render canvas overlay
  const totalSlides = args.totalSlides ?? 5
  const content: IngredientCardContent = {
    ingredients,
    carousel: {
      slideIndex: `${args.slotIdx + 1} / ${totalSlides}`,
      brandWordmark: args.brandWordmark ?? args.productName.split(/\s+/)[0],
      brandDomain: args.brandDomain ?? deriveDomain(args.productName),
    },
  }

  const result = await renderIngredientCard({
    variant,
    content,
    sceneRef,
    realism: 'subtle',
  })

  const assetRef = await saveAsset(result.blob, result.mimeType)
  return { assetRef, mimeType: result.mimeType }
}

export type { IngredientCardSpec, IngredientCardContent, IngredientItem, IngredientCardVariant } from './types'
export { parseIngredientBullet, lookupBenefit } from './ingredientBenefitMap'
