import { saveAsset, isAssetRef } from '../../../utils/assetStore'
import { generateGpt4oImage } from '../../../utils/kieai'
import type { AvatarVariant } from '../../../stores/types'

// ── IDENTITY-LOCKED VARIATIONS ──────────────────────────────────────────────
//
// We pass the original avatar via `filesUrl` to KIE's GPT-image-1 edit endpoint
// and rely on IMAGE conditioning for identity preservation. The prompt is kept
// deliberately SHORT — long verbose identity-lock paragraphs dilute image
// conditioning weight and push the model toward "imagining a similar-looking
// different person" from text alone. The shorter the prompt, the more the
// model trusts the reference image.
//
// Failure mode this design fixes: previous implementation sent a ~350-token
// wall of text ("KEEP face shape, eyes, eyebrows, nose, lips, jawline, ...")
// plus a Gemini-Vision-generated description block. The model treated that as
// the primary identity source and generated "a person matching that text
// description" instead of "the exact person in the reference image".

const CONSISTENCY_SUFFIX =
  'Maintain identical facial identity and bone structure. Do not change ethnicity, hairstyle, age, facial proportions, or skin texture. Same outfit. Only alter angle and expression. Photorealistic consistency.'

export interface VariantRecipe {
  angleType: AvatarVariant['label']
  /** SHORT (one sentence) description of the visual change — angle + expression only.
   *  The image reference does the identity heavy-lifting; this is just the "what changes" hint. */
  prompt: string
}

// ── 4-angle variant pack (used by VariantsModal for saved Models) ───────────

export const DEFAULT_VARIANT_RECIPES: VariantRecipe[] = [
  { angleType: '3/4 trái',     prompt: 'Same exact person, head turned slightly to the left (about 30° 3/4 angle), natural neutral expression.' },
  { angleType: '3/4 phải',     prompt: 'Same exact person, head turned slightly to the right (about 30° 3/4 angle), natural neutral expression.' },
  { angleType: 'cười',         prompt: 'Same exact person, front-facing, warm natural smile with slight teeth, eyes relaxed.' },
  { angleType: 'side profile', prompt: 'Same exact person, full side profile — head turned 90° showing one full side of the face.' },
]

// ── 3-angle integrated workflow (used inline in Avatar AI Studio output) ────

export const EXTRA_3_RECIPES: VariantRecipe[] = [
  { angleType: '3/4 trái', prompt: 'Same exact person, slight 3/4 left angle (head turned ~30° camera-left), natural relaxed expression.' },
  { angleType: '3/4 phải', prompt: 'Same exact person, slight 3/4 right angle (head turned ~30° camera-right), natural relaxed expression.' },
  { angleType: 'cười',     prompt: 'Same exact person, front-facing, gentle natural smile (slight teeth), eyes relaxed.' },
]

/**
 * Generate ONE identity-locked variant via KIE GPT-image-1 image-edit endpoint.
 * The original avatar is passed as the reference image via `filesUrl[0]` so
 * the model uses it as the identity anchor.
 *
 * Prompt = short variation hint + a one-line consistency clause. That's it.
 */
export async function generateOneVariant(params: {
  apiKey: string            // KIE.ai API key
  originalImageUrl: string  // PUBLIC URL the KIE backend can fetch (signed Supabase URL is fine)
  recipe: VariantRecipe
  /** @deprecated kept for backwards-compat — no longer used; image reference is the anchor. */
  avatarDescription?: string
  /** @deprecated kept for backwards-compat — outfit is now always locked. */
  mode?: 'strict' | 'flex-outfit'
}): Promise<AvatarVariant | null> {
  const { apiKey, originalImageUrl, recipe } = params

  const prompt = `${recipe.prompt}\n\n${CONSISTENCY_SUFFIX}`

  try {
    const imageUrl = await generateGpt4oImage({
      apiKey,
      prompt,
      filesUrl: [originalImageUrl],
      size: '2:3',  // closest to 9:16 (KIE gpt4o supports only 1:1, 3:2, 2:3)
      timeoutMs: 4 * 60 * 1000,
    })

    let storedRef: string
    if (isAssetRef(imageUrl)) {
      storedRef = imageUrl
    } else {
      const resp = await fetch(imageUrl)
      if (!resp.ok) throw new Error(`fetch variant failed: ${resp.status}`)
      const blob = await resp.blob()
      storedRef = await saveAsset(blob, blob.type || 'image/png')
    }

    return {
      id: crypto.randomUUID(),
      imageUrl: storedRef,
      label: recipe.angleType,
      source: 'ai-generated',
      createdAt: Date.now(),
    }
  } catch (err) {
    console.error(`[generateOneVariant] ${recipe.angleType} failed:`, err)
    return null
  }
}

/** Generate all 4 default angles (used by Project → Avatar AI → ✨ on saved model). */
export async function generateAllVariants(params: {
  apiKey: string
  originalImageUrl: string
  /** @deprecated no longer used — image reference is the identity anchor. */
  avatarDescription?: string
  onProgress?: (done: number, total: number, currentLabel: string) => void
}): Promise<AvatarVariant[]> {
  const { apiKey, originalImageUrl, onProgress } = params
  const variants: AvatarVariant[] = []
  for (let i = 0; i < DEFAULT_VARIANT_RECIPES.length; i++) {
    const recipe = DEFAULT_VARIANT_RECIPES[i]
    onProgress?.(i, DEFAULT_VARIANT_RECIPES.length, recipe.angleType)
    const v = await generateOneVariant({ apiKey, originalImageUrl, recipe })
    if (v) variants.push(v)
    if (i < DEFAULT_VARIANT_RECIPES.length - 1) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  onProgress?.(DEFAULT_VARIANT_RECIPES.length, DEFAULT_VARIANT_RECIPES.length, 'done')
  return variants
}

/** Generate the 3 extra angles for the integrated Avatar AI workflow. */
export async function generateExtra3Angles(params: {
  apiKey: string
  originalImageUrl: string
  /** @deprecated no longer used. */
  avatarDescription?: string
  onProgress?: (done: number, total: number, currentLabel: string) => void
}): Promise<AvatarVariant[]> {
  const { apiKey, originalImageUrl, onProgress } = params
  const out: AvatarVariant[] = []
  for (let i = 0; i < EXTRA_3_RECIPES.length; i++) {
    const recipe = EXTRA_3_RECIPES[i]
    onProgress?.(i, EXTRA_3_RECIPES.length, recipe.angleType)
    const v = await generateOneVariant({ apiKey, originalImageUrl, recipe })
    if (v) out.push(v)
    if (i < EXTRA_3_RECIPES.length - 1) {
      await new Promise((r) => setTimeout(r, 800))
    }
  }
  onProgress?.(EXTRA_3_RECIPES.length, EXTRA_3_RECIPES.length, 'done')
  return out
}

/** Build an AvatarVariant from a user-uploaded image file (no AI gen). */
export async function addManualVariant(file: File, label: string): Promise<AvatarVariant> {
  const assetId = await saveAsset(file, file.type || 'image/jpeg')
  return {
    id: crypto.randomUUID(),
    imageUrl: assetId,
    label: label || file.name.replace(/\.[^.]+$/, ''),
    source: 'manual-upload',
    createdAt: Date.now(),
  }
}

/**
 * @deprecated Avatar description from Gemini Vision is no longer used as an
 * identity anchor — the image reference (via filesUrl) is far more reliable
 * and the description block was actively hurting identity consistency by
 * pulling the model toward "a person matching this description" instead of
 * "the person in this image". Kept exported for backwards compat with any
 * lingering imports; will be removed in a future cleanup.
 */
export async function describeAvatarFromImage(): Promise<string | null> {
  return null
}
