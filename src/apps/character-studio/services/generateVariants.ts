import { saveAsset, isAssetRef } from '../../../utils/assetStore'
import { directGeminiVision } from '../../../utils/gemini'
import { generateImage, pollImageUntilDone } from '../../../utils/kieai'
import type { AvatarVariant } from '../../../stores/types'

/**
 * Use Gemini Vision to describe the avatar's face + style in detail.
 * This description anchors the identity lock when generating angle variants —
 * reference-image alone is unreliable (model often invents a different person).
 */
export async function describeAvatarFromImage(imageUrl: string, geminiKey: string): Promise<string | null> {
  try {
    let base64: string
    let mimeType: string

    if (imageUrl.startsWith('data:')) {
      const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/)
      if (!match) return null
      mimeType = match[1]
      base64 = match[2]
    } else {
      const res = await fetch(imageUrl)
      if (!res.ok) return null
      const blob = await res.blob()
      mimeType = blob.type || 'image/jpeg'
      const buf = await blob.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
      base64 = btoa(binary)
    }

    const response = await directGeminiVision({
      apiKey: geminiKey,
      parts: [
        { inlineData: { mimeType, data: base64 } },
        { text: `Describe this person's face and identifying features in 2-3 SHORT sentences for an image-generation prompt. Focus ONLY on:
- Gender, approximate age range (e.g. "late 40s-50s")
- Ethnicity / regional appearance (e.g. "Malaysian", "Vietnamese", "Caucasian", "Middle Eastern")
- Skin tone, face shape, distinctive features (cheekbones, jaw, smile, wrinkles)
- Eye color, eye shape, eyebrow style
- Hairstyle OR hijab (color, style, how it's worn) — be specific
- Any facial hair (beard, stubble, clean-shaven, mustache style)
- Outfit colors and style (top color, pattern if any)
- Any visible accessories (glasses, jewelry, earrings, bracelet)

Be VERY specific so the same person can be reliably re-rendered at a different angle.
Output: only the description, no preamble, no markdown, no lists, just flowing sentences.

Example output: "A Malaysian woman in her late 40s with warm tan skin, soft rounded face shape, warm brown almond-shaped eyes, gentle smile lines, wearing a soft lavender hijab pinned modestly under chin, lavender floral top, and a thin gold bracelet on her wrist."` },
      ],
      maxOutputTokens: 350,
      model: 'gemini-2.5-flash',
    })

    return response.trim().replace(/^["']|["']$/g, '')
  } catch (err) {
    console.error('[describeAvatarFromImage] failed:', err)
    return null
  }
}

/**
 * Generate alternate angle variants of an existing avatar.
 *
 * Why: Single-reference identity preservation is unreliable — when B-roll
 * gen needs to render the avatar in 3/4 angles or expressions, AI has to
 * "imagine" the new view and often drifts away from the original face.
 * With 3-5 reference images covering different angles, the model has a
 * proper "identity manifold" and stays much more consistent.
 *
 * Uses Nano Banana 2 (Google) in edit-mode with strong identity-lock prompts
 * and the original avatar passed as reference image. Generates 4 angles
 * sequentially (not parallel) to avoid rate limits on free Gemini tier.
 */

export interface VariantRecipe {
  angleType: AvatarVariant['label']
  prompt: string
}

/** The 4 angle variants we generate by default. Designed to give image-gen
 *  models a complete view of the avatar's face from multiple perspectives. */
export const DEFAULT_VARIANT_RECIPES: VariantRecipe[] = [
  {
    angleType: '3/4 trái',
    prompt: 'Same identical person from the reference image, now photographed from a 3/4 LEFT angle (head turned slightly to camera-left, about 30-45 degrees). Same neutral expression, same hijab/hair style, same outfit, same lighting setup as reference. Keep face shape, eyes, eyebrows, nose, lips, jawline, skin tone EXACTLY as in reference. Studio portrait shot, vertical 9:16, photorealistic.',
  },
  {
    angleType: '3/4 phải',
    prompt: 'Same identical person from the reference image, now photographed from a 3/4 RIGHT angle (head turned slightly to camera-right, about 30-45 degrees). Same neutral expression, same hijab/hair style, same outfit, same lighting setup as reference. Keep face shape, eyes, eyebrows, nose, lips, jawline, skin tone EXACTLY as in reference. Studio portrait shot, vertical 9:16, photorealistic.',
  },
  {
    angleType: 'cười',
    prompt: 'Same identical person from the reference image, now with a gentle warm smile showing slight teeth, eyes still naturally relaxed. Front-facing. Same hijab/hair style, same outfit, same lighting setup as reference. Keep face shape, eye shape + color, eyebrows, nose, lips (just smiling now), jawline, skin tone EXACTLY as in reference. Studio portrait shot, vertical 9:16, photorealistic.',
  },
  {
    angleType: 'side profile',
    prompt: 'Same identical person from the reference image, now photographed in SIDE PROFILE (head turned 90 degrees so we see the side of the face — nose, lips, chin silhouette). Same neutral expression, same hijab/hair style, same outfit, same lighting setup as reference. Keep skin tone, nose shape, lip shape, chin/jaw EXACTLY as in reference. Studio portrait shot, vertical 9:16, photorealistic.',
  },
]

/**
 * Generate ONE variant via KIE.ai's GPT Image 2 (same model used by Avatar AI gen).
 * The original avatar image is passed via referenceImageUrls for identity lock.
 *
 * mode:
 *   - 'strict' (default): keep face + hair + outfit + lighting all from reference
 *   - 'flex-outfit': keep face + hair + facial hair, allow slight outfit variation
 *
 * The `apiKey` param is the KIE.ai API key.
 */
export async function generateOneVariant(params: {
  apiKey: string  // KIE.ai API key
  originalImageUrl: string
  recipe: VariantRecipe
  avatarDescription?: string  // optional locked physical description
  mode?: 'strict' | 'flex-outfit'
}): Promise<AvatarVariant | null> {
  const { apiKey, originalImageUrl, recipe, avatarDescription, mode = 'strict' } = params

  const descBlock = avatarDescription
    ? `\nTHE PERSON IN THE REFERENCE IMAGE:\n${avatarDescription}\n`
    : ''

  const allowOutfitVariation = mode === 'flex-outfit'

  const identityLockText = `Re-render the EXACT SAME PERSON from the reference image, viewed from a different angle.
${descBlock}
KEEP IDENTICAL (this is the SAME individual, not a similar-looking different person):
• Same face: eyes, eyebrows, nose, lips, jawline, cheekbones, skin tone, age
• Same gender, ethnicity, age range
• Same hijab style and color if present, OR same hairstyle/hair color/hair length
• Same facial hair (beard, stubble, mustache) if present
• Same accessories on face/neck (glasses, earrings)

${allowOutfitVariation
  ? 'CAN VARY: outfit color/style (same modesty level), background scenery'
  : 'KEEP THE SAME: outfit, lighting, background style'}

CHANGE: ${recipe.prompt}

Output: photorealistic vertical 9:16 image, authentic natural lighting, no text, no watermark. The output MUST be the same individual as the reference image, only the head pose and angle change.`

  try {
    // Use KIE.ai's GPT Image 2 — pass reference 2x for stronger identity weight
    const { taskId } = await generateImage({
      apiKey,
      model: 'gpt-image-2-text-to-image',
      prompt: identityLockText,
      resolution: '1K',
      aspectRatio: '9:16',
      referenceImageUrls: [originalImageUrl, originalImageUrl],
    })
    const imageUrl = await pollImageUntilDone({ apiKey, taskId, timeoutMs: 4 * 60 * 1000 })

    // Upload to asset store so it persists like the rest of the bank
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

/**
 * Generate all 4 default angle variants. Returns the variants that succeeded.
 * Runs sequentially with a small delay to be gentle on rate limits.
 */
export async function generateAllVariants(params: {
  apiKey: string
  originalImageUrl: string
  avatarDescription?: string
  onProgress?: (done: number, total: number, currentLabel: string) => void
}): Promise<AvatarVariant[]> {
  const { apiKey, originalImageUrl, avatarDescription, onProgress } = params
  const variants: AvatarVariant[] = []
  for (let i = 0; i < DEFAULT_VARIANT_RECIPES.length; i++) {
    const recipe = DEFAULT_VARIANT_RECIPES[i]
    onProgress?.(i, DEFAULT_VARIANT_RECIPES.length, recipe.angleType)
    const v = await generateOneVariant({ apiKey, originalImageUrl, recipe, avatarDescription })
    if (v) variants.push(v)
    // Small pause to avoid burst-rate limits
    if (i < DEFAULT_VARIANT_RECIPES.length - 1) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  onProgress?.(DEFAULT_VARIANT_RECIPES.length, DEFAULT_VARIANT_RECIPES.length, 'done')
  return variants
}

/**
 * Build an AvatarVariant from a user-uploaded image file (no AI gen — pure upload).
 * This is the "manual upload" fallback for users who have real-life photos.
 */
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

// ── EXTRA 3 ANGLES (integrated Avatar AI workflow — outfit-flex mode) ────────
// Used right after main avatar generation. Keeps face + hair + facial hair
// from original, allows slight outfit variation for natural photo-series feel.

export const EXTRA_3_RECIPES: VariantRecipe[] = [
  {
    angleType: '3/4 trái',
    prompt: 'Same person photographed from a 3/4 LEFT angle (head turned ~35° to camera-left). Natural relaxed expression. Same hairstyle and any facial hair as the reference. Outfit may differ slightly (different shirt color or top is OK) but same casual UGC modesty level. Same natural ambient lighting.',
  },
  {
    angleType: '3/4 phải',
    prompt: 'Same person photographed from a 3/4 RIGHT angle (head turned ~35° to camera-right). Natural relaxed expression. Same hairstyle and any facial hair as the reference. Outfit may differ slightly (different shirt color or top is OK) but same casual UGC modesty level. Same natural ambient lighting.',
  },
  {
    angleType: 'cười',
    prompt: 'Same person front-facing with a gentle warm genuine smile (slight teeth visible). Eyes naturally relaxed. Same hairstyle and any facial hair as the reference. Outfit may differ slightly (different shirt color or top is OK) but same casual UGC modesty level. Same natural ambient lighting.',
  },
]

/**
 * Generate the 3 extra angles for the integrated Avatar AI workflow.
 * Uses flex-outfit mode (keep face + hair + facial hair, allow outfit variation).
 */
export async function generateExtra3Angles(params: {
  apiKey: string
  originalImageUrl: string
  avatarDescription?: string
  onProgress?: (done: number, total: number, currentLabel: string) => void
}): Promise<AvatarVariant[]> {
  const { apiKey, originalImageUrl, avatarDescription, onProgress } = params
  const out: AvatarVariant[] = []
  for (let i = 0; i < EXTRA_3_RECIPES.length; i++) {
    const recipe = EXTRA_3_RECIPES[i]
    onProgress?.(i, EXTRA_3_RECIPES.length, recipe.angleType)
    const v = await generateOneVariant({
      apiKey,
      originalImageUrl,
      recipe,
      avatarDescription,
      mode: 'flex-outfit',
    })
    if (v) out.push(v)
    if (i < EXTRA_3_RECIPES.length - 1) {
      await new Promise((r) => setTimeout(r, 800))
    }
  }
  onProgress?.(EXTRA_3_RECIPES.length, EXTRA_3_RECIPES.length, 'done')
  return out
}
