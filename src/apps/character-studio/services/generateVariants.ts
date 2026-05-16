import { generateImage, pollImageUntilDone } from '../../../utils/kieai'
import { saveAsset, isAssetRef } from '../../../utils/assetStore'
import { directGeminiVision } from '../../../utils/gemini'
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
 * Generate ONE variant. Returns the variant object or null on failure.
 * Uses Nano Banana 2 with the original image as reference for identity lock.
 *
 * mode:
 *   - 'strict' (default): keep face + hair + outfit + lighting all from reference
 *   - 'flex-outfit': keep face + hair + facial hair, allow slight outfit variation
 */
export async function generateOneVariant(params: {
  apiKey: string
  originalImageUrl: string
  recipe: VariantRecipe
  avatarDescription?: string  // optional locked physical description
  mode?: 'strict' | 'flex-outfit'
}): Promise<AvatarVariant | null> {
  const { apiKey, originalImageUrl, recipe, avatarDescription, mode = 'strict' } = params

  // ── Prompt designed for Nano Banana 2 (Gemini image edit) ────────────────
  // Direct structure works better than emoji/all-caps shouting. The avatar
  // description is the PRIMARY identity anchor — reference image is secondary.
  const descBlock = avatarDescription
    ? `\nTHE PERSON IN THE REFERENCE IMAGE:\n${avatarDescription}\n`
    : ''

  const allowOutfitVariation = mode === 'flex-outfit'

  const identityLockText = `TASK: Re-render the EXACT SAME PERSON from the reference image, viewed from a different angle.
${descBlock}
WHAT MUST STAY IDENTICAL (this is the same individual, NOT a similar-looking different person):
• Same face: same eye color, eye shape, eyebrows, nose, lips, jawline, cheekbones, skin tone, age
• Same gender, same ethnicity, same approximate age (do NOT make older younger or vice versa)
• Same hijab style and color if wearing one, OR same hairstyle/hair color/hair length
• Same facial hair if any (beard, stubble, mustache) — same style and color
• Same accessories visible on face/neck (glasses, earrings)

WHAT CAN ${allowOutfitVariation ? 'VARY' : 'STAY THE SAME'}:
${allowOutfitVariation
  ? '• Outfit/clothing — different top color or style is OK, but same modesty level (e.g. modest hijab outfit stays modest)\n• Background — can be slightly different setting'
  : '• Outfit and lighting should match the reference closely'}

WHAT CHANGES (apply this transformation):
${recipe.prompt}

CRITICAL RULE: This MUST be the SAME individual as the reference. Do not invent a different person — even one who "looks similar". If you produce a different person, the output is a failure. Use the reference image as the primary identity anchor.

Output: photorealistic, vertical 9:16, authentic natural lighting, no text overlay, no watermark.`

  try {
    const { taskId } = await generateImage({
      apiKey,
      model: 'nano-banana-2',
      prompt: identityLockText,
      resolution: '1K',
      aspectRatio: '9:16',
      referenceImageUrls: [originalImageUrl, originalImageUrl],  // duplicate for stronger weight
    })
    const imageUrl = await pollImageUntilDone({ apiKey, taskId, timeoutMs: 3 * 60 * 1000 })

    // Upload to Supabase so it persists like the rest of the bank
    let storedRef: string
    if (isAssetRef(imageUrl)) {
      storedRef = imageUrl
    } else {
      const resp = await fetch(imageUrl)
      if (!resp.ok) throw new Error(`fetch variant failed: ${resp.status}`)
      const blob = await resp.blob()
      storedRef = await saveAsset(blob, blob.type || 'image/jpeg')
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
