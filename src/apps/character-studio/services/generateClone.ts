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
  headscarf: string   // optional — recolor an EXISTING hijab only
}

/** Curated chip suggestions for the Clone fields. */
export const CLONE_FIELD_CHIPS: Record<keyof CloneFields, string[]> = {
  expression: ['Natural smile', 'Genuine warm smile', 'Excited', 'Surprised', 'Confident', 'Mid-sentence talking', 'Soft laughing', 'Thoughtful', 'Serious/focused'],
  outfit: ['Casual athleisure', 'White tee + denim', 'Cozy knit sweater', 'Smart casual blazer', 'Minimalist beige set', 'Modest casual hijab outfit', 'Summer dress', 'Hoodie streetwear', 'Office business casual'],
  background: ['Soft blurred bedroom', 'Bright kitchen counter', 'Neutral studio wall', 'Cozy living room with plants', 'Coffee shop window light', 'Outdoor park, golden hour', 'Minimalist office', 'Car interior', 'Beach, soft daylight'],
  headscarf: ['Coral pink', 'Dusty rose', 'Beige / cream', 'Ivory white', 'Smoky grey', 'Sage green', 'Terracotta', 'Black', 'Lavender', 'Navy blue', 'Soft brown'],
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
    headscarf: '',  // keep original scarf colour unless the user picks one
  }
}

// Locks ONLY the identity (face) — NOT the whole image. v1 also said
// "everything else stays identical", which made gpt-4o-image (an EDIT endpoint,
// already very faithful to the input) just reproduce the reference unchanged.
const CLONE_LOCK =
  'KEEP the identity exactly: same face, bone structure, skin tone, eyes, nose, lips, eyebrows and ethnicity — it must clearly be the same individual. Keep her headscarf/hijab STYLE if she wears one (only recolor it when a headscarf color is requested above; never add a headscarf if she has none). Re-pose naturally to fit the new scene. Photorealistic, natural casual phone-selfie look.'

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
  onStatus?: (status: string, progress?: number) => void
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
  if (params.fields.expression.trim()) changes.push(`Expression: ${params.fields.expression.trim()}`)
  if (params.fields.outfit.trim()) changes.push(`New outfit / clothing: ${params.fields.outfit.trim()}`)
  if (params.fields.background.trim()) changes.push(`New background / setting: ${params.fields.background.trim()}`)
  if (params.fields.headscarf.trim()) changes.push(`Headscarf / hijab color: ${params.fields.headscarf.trim()} (recolor the EXISTING headscarf only — do NOT add one if she has none)`)
  const changeBlock = changes.length
    ? changes.map((c) => `- ${c}`).join('\n')
    : '- A fresh, natural everyday look'

  // Frame it as generating a NEW photo (not a faithful edit) so the model
  // actually changes outfit/background/expression — identity is locked to the
  // FACE only (see CLONE_LOCK).
  const prompt = `Create a NEW photorealistic UGC selfie of the SAME person shown in the reference image.

CHANGE the following — these MUST visibly differ from the reference image:
${changeBlock}

${CLONE_LOCK}`

  const imageUrl = await generateGpt4oImage({
    apiKey: params.apiKey,
    prompt,
    filesUrl: [faceUrl],
    size: params.portrait === false ? '3:2' : '2:3',  // KIE gpt4o: 1:1 | 3:2 | 2:3
    onStatusChange: params.onStatus,
    timeoutMs: 4 * 60 * 1000,
  })

  if (isAssetRef(imageUrl)) return imageUrl
  const resp = await fetch(imageUrl)
  if (!resp.ok) throw new Error(`fetch clone failed: ${resp.status}`)
  const blob = await resp.blob()
  return saveAsset(blob, blob.type || 'image/png')
}
