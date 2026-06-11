import { getUrl, saveAsset, isAssetRef } from '../../../utils/assetStore'
import { generateGpt4oImage } from '../../../utils/kieai'

// ── AVATAR CLONE — identity-locked restyle ──────────────────────────────────
//
// Upload a real face → keep that EXACT face (i2i via gpt-4o-image filesUrl) and
// restyle ONLY expression + outfit + background. Mirrors the proven 4-angle
// path in generateVariants.ts (image reference does the identity heavy-lifting;
// the prompt is kept SHORT so the model trusts the reference over text).
//
// Backend = gpt-4o-image (NOT nano-banana / gpt-image-2). Per the project's
// hard-won lesson (CLAUDE.md TikTok Shop §): for "keep X, change the scene"
// features, gpt-4o-image (filesUrl) gives the strongest reference preservation
// at the same 6-credit cost.

export interface CloneFields {
  expression: string
  outfit: string
  background: string
}

/** Curated chip suggestions for the 3 Clone fields. */
export const CLONE_FIELD_CHIPS: Record<keyof CloneFields, string[]> = {
  expression: ['Natural smile', 'Genuine warm smile', 'Excited', 'Surprised', 'Confident', 'Mid-sentence talking', 'Soft laughing', 'Thoughtful', 'Serious/focused'],
  outfit: ['Casual athleisure', 'White tee + denim', 'Cozy knit sweater', 'Smart casual blazer', 'Minimalist beige set', 'Modest casual hijab outfit', 'Summer dress', 'Hoodie streetwear', 'Office business casual'],
  background: ['Soft blurred bedroom', 'Bright kitchen counter', 'Neutral studio wall', 'Cozy living room with plants', 'Coffee shop window light', 'Outdoor park, golden hour', 'Minimalist office', 'Car interior', 'Beach, soft daylight'],
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** UGC Creator button: random, coherent values for the 3 fields. */
export function randomCloneFields(): CloneFields {
  return {
    expression: pickRandom(CLONE_FIELD_CHIPS.expression),
    outfit: pickRandom(CLONE_FIELD_CHIPS.outfit),
    background: pickRandom(CLONE_FIELD_CHIPS.background),
  }
}

// Kept SHORT on purpose — a long identity-lock paragraph dilutes the image
// reference's conditioning weight and pushes the model toward inventing a
// similar-looking different person. The reference image IS the identity source.
const CLONE_LOCK =
  'Keep the EXACT same person from the reference image: identical face, bone structure, skin tone, hair and ethnicity. Do not change their identity, age or facial proportions. Photorealistic, same individual, natural UGC look.'

/**
 * Generate ONE identity-locked clone. Uploads the face (if a raw File is given)
 * to get a public URL the KIE backend can fetch, then runs gpt-4o-image i2i.
 * Returns a saved asset ref.
 */
export async function generateClone(params: {
  apiKey: string
  faceFile?: File          // raw uploaded face — uploaded here if no ref yet
  faceImageRef?: string    // existing asset ref or public URL (alternative to faceFile)
  fields: CloneFields
  portrait?: boolean       // 9:16 portrait (default) vs landscape
}): Promise<string> {
  // Resolve a PUBLIC url the KIE backend can fetch (signed Supabase URL).
  let ref = params.faceImageRef
  if (!ref && params.faceFile) {
    ref = await saveAsset(params.faceFile, params.faceFile.type || 'image/jpeg')
  }
  if (!ref) throw new Error('Chưa có ảnh khuôn mặt')
  const faceUrl = isAssetRef(ref) ? await getUrl(ref) : ref
  if (!faceUrl) throw new Error('Không lấy được URL ảnh khuôn mặt (upload chưa xong)')

  const changes: string[] = []
  if (params.fields.expression.trim()) changes.push(`facial expression → ${params.fields.expression.trim()}`)
  if (params.fields.outfit.trim()) changes.push(`outfit / clothing → ${params.fields.outfit.trim()}`)
  if (params.fields.background.trim()) changes.push(`background / scene → ${params.fields.background.trim()}`)
  const changeLine = changes.length
    ? `Restyle ONLY: ${changes.join('; ')}. Everything else about the person stays identical.`
    : 'Natural neutral restyle, identity unchanged.'

  const prompt = `Same person as the reference image. ${changeLine}\n\n${CLONE_LOCK}`

  const imageUrl = await generateGpt4oImage({
    apiKey: params.apiKey,
    prompt,
    filesUrl: [faceUrl],
    size: params.portrait === false ? '3:2' : '2:3',  // KIE gpt4o: 1:1 | 3:2 | 2:3
    timeoutMs: 4 * 60 * 1000,
  })

  if (isAssetRef(imageUrl)) return imageUrl
  const resp = await fetch(imageUrl)
  if (!resp.ok) throw new Error(`fetch clone failed: ${resp.status}`)
  const blob = await resp.blob()
  return saveAsset(blob, blob.type || 'image/png')
}
