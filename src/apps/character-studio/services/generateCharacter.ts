import type { CharacterProfile } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { generateImage, pollImageUntilDone } from '../../../utils/kieai'
import type { ImageResolution } from '../../../utils/kieai'
import { saveAsset } from '../../../utils/assetStore'
import { directGeminiVision } from '../../../utils/gemini'

export interface GenerationResult {
  imageUrl: string
  jsonPrompt: Record<string, Record<string, string>>
}

/**
 * Use Gemini Vision to describe the uploaded product image in detail.
 * This description is embedded in the image gen prompt so the avatar holds
 * the EXACT product (correct shape, color, label) — relying on referenceImageUrls
 * alone is unreliable (model often invents a generic bottle instead).
 */
async function describeProductFromImage(imageUrl: string, geminiKey: string): Promise<string | null> {
  try {
    let base64: string
    let mimeType: string

    if (imageUrl.startsWith('data:')) {
      // data:image/jpeg;base64,XXXXX
      const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/)
      if (!match) return null
      mimeType = match[1]
      base64 = match[2]
    } else {
      // http(s):// or asset URL → fetch + convert to base64
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
        { text: `Describe this product in 1-2 SHORT sentences for an image-generation prompt. Focus ONLY on visual appearance:
- Container type: bottle / jar / tube / box / sachet / pouch / can / blister pack / etc.
- Container color + cap/lid color
- Container shape (tall vs short, slim vs wide, round vs square)
- Container material (clear plastic / opaque plastic / glass / cardboard / metal / foil)
- Label background color + brand text if visible
- Approximate size relative to a human hand

Output: ONLY the visual description, no preamble, no markdown. Example: "A short, squat white plastic jar with a gold metallic screw-top lid, dark blue rectangular label with white brand text, roughly palm-sized."` },
      ],
      maxOutputTokens: 250,
      model: 'gemini-2.5-flash',
    })

    return response.trim().replace(/^["']|["']$/g, '')
  } catch (err) {
    console.error('[describeProductFromImage] failed:', err)
    return null
  }
}

/**
 * Groups a flat profile into tab-based JSON sections for display.
 */
export function buildJsonPrompt(profile: CharacterProfile): Record<string, Record<string, string>> {
  const physical: Record<string, string> = {}
  const style: Record<string, string> = {}
  const scene: Record<string, string> = {}
  const pose: Record<string, string> = {}
  const camera: Record<string, string> = {}

  const mapping: Record<string, Record<string, string>> = {
    gender: physical, age: physical, ethnicity: physical, bodyType: physical,
    skinTone: physical, skinTexture: physical, eyeColor: physical, eyeShape: physical,
    hairColor: physical, hairStyle: physical, hairTexture: physical,
    facialFeatures: physical, facialHair: physical, distinguishingMarks: physical,
    clothingStyle: style, accessories: style, makeup: style,
    location: scene, background: scene, lighting: scene, weather: scene, timeOfDay: scene,
    pose: pose, action: pose, expression: pose,
    shotType: camera, cameraAngle: camera, cameraDevice: camera,
  }

  for (const [key, value] of Object.entries(profile)) {
    if (value && mapping[key]) {
      mapping[key][key] = value
    }
  }

  const result: Record<string, Record<string, string>> = {}
  if (Object.keys(physical).length) result['Physical'] = physical
  if (Object.keys(style).length) result['Style'] = style
  if (Object.keys(scene).length) result['Scene'] = scene
  if (Object.keys(pose).length) result['Pose & Action'] = pose
  if (Object.keys(camera).length) result['Camera'] = camera
  return result
}

/**
 * Builds a natural language image generation prompt from the character profile.
 * If productDescription is provided (from Gemini Vision analysis of the uploaded
 * product image), it's embedded with strong identity-lock instructions so the
 * generated avatar holds the EXACT product, not a generic invented bottle.
 */
function buildImagePrompt(profile: CharacterProfile, productDescription?: string): string {
  const parts: string[] = []

  // Physical description
  const physicalParts = [
    profile.gender,
    profile.age && `aged ${profile.age}`,
    profile.ethnicity,
    profile.bodyType && `${profile.bodyType} build`,
    profile.skinTone && `${profile.skinTone} skin tone`,
    profile.skinTexture,
    profile.eyeColor && `${profile.eyeColor} eyes`,
    profile.eyeShape && `${profile.eyeShape} eye shape`,
    profile.hairColor && `${profile.hairColor} hair`,
    profile.hairStyle && `${profile.hairStyle}`,
    profile.hairTexture && `${profile.hairTexture} texture`,
    profile.facialFeatures,
    profile.facialHair && profile.facialHair !== 'None' && profile.facialHair,
    profile.distinguishingMarks && profile.distinguishingMarks !== 'None' && profile.distinguishingMarks,
  ].filter(Boolean)
  if (physicalParts.length) parts.push(`A ${physicalParts.join(', ')}.`)

  // Style
  const styleParts = [
    profile.clothingStyle && `Wearing ${profile.clothingStyle} style`,
    profile.accessories && profile.accessories !== 'None' && `with ${profile.accessories}`,
    profile.makeup && profile.makeup !== 'No makeup' && `${profile.makeup} makeup`,
  ].filter(Boolean)
  if (styleParts.length) parts.push(styleParts.join(', ') + '.')

  // Pose & action — with EXACT product description if uploaded
  const productLine = productDescription
    ? `holding the EXACT specific product described here in their hand at chest level, label/branding clearly facing the camera: ${productDescription}. The product MUST match this description precisely — same container shape, same color, same label, same size. Do NOT substitute a generic bottle or invent a different product`
    : null

  const poseParts = [
    profile.pose,
    profile.action,
    productLine,
    profile.expression && `${profile.expression} expression`,
  ].filter(Boolean)
  if (poseParts.length) parts.push(poseParts.join(', ') + '.')

  // Scene
  const sceneParts = [
    profile.location,
    profile.background,
    profile.lighting,
    profile.weather && profile.weather !== 'Indoor (N/A)' && profile.weather,
    profile.timeOfDay,
  ].filter(Boolean)
  if (sceneParts.length) parts.push(sceneParts.join(', ') + '.')

  // Camera
  const cameraParts = [
    profile.shotType,
    profile.cameraAngle && `${profile.cameraAngle} angle`,
    profile.cameraDevice && `shot on ${profile.cameraDevice}`,
  ].filter(Boolean)
  if (cameraParts.length) parts.push(cameraParts.join(', ') + '.')

  // For UGC / selfie / mirror scenarios: reinforce direct eye contact in the prompt
  const actionLower = (profile.action ?? '').toLowerCase()
  const poseLower = (profile.pose ?? '').toLowerCase()
  if (
    actionLower.includes('camera') ||
    actionLower.includes('lens') ||
    actionLower.includes('selfie') ||
    poseLower.includes('camera') ||
    poseLower.includes('mirror')
  ) {
    parts.push('Subject is making direct, confident eye contact with the camera lens. Face is fully visible, looking straight ahead at the viewer.')
  }

  return parts.join(' ')
}

export async function generateCharacter(
  profile: CharacterProfile,
  modelId: string,
  resolution: ImageResolution,
  productImageUrl?: string,
): Promise<GenerationResult> {
  const settings = useSettingsStore.getState()
  const kieApiKey = settings.kieApiKey
  if (!kieApiKey) throw new Error('NO_KIE_KEY')

  // ── Step 1: If product image uploaded, describe it via Gemini Vision FIRST ──
  // This gives the image-gen model a specific textual description of the
  // exact product (shape/color/label/branding) to render, rather than guessing.
  let productDescription: string | undefined
  if (productImageUrl) {
    const geminiKey = settings.geminiApiKey
    if (geminiKey) {
      productDescription = (await describeProductFromImage(productImageUrl, geminiKey)) ?? undefined
    }
    // If no Gemini key OR description failed: fall through with generic phrasing
    if (!productDescription) {
      productDescription = 'a product container (matching the reference image)'
    }
  }

  const prompt = buildImagePrompt(profile, productDescription)
  const aspectRatio = profile.aspectRatio?.includes('1:1')
    ? '1:1'
    : profile.aspectRatio === 'Landscape (16:9)'
    ? '16:9'
    : '9:16'

  // ── Step 2: Generate image. Pass product image as reference too — models that
  //    support it (Nano Banana 2) will use both textual + visual identity locks.
  //    Models without ref-image support (gpt-image-1) rely on the textual description.
  const referenceImageUrls = productImageUrl ? [productImageUrl] : undefined
  const { taskId } = await generateImage({ apiKey: kieApiKey, model: modelId, prompt, resolution, aspectRatio, referenceImageUrls })
  const remoteUrl = await pollImageUntilDone({ apiKey: kieApiKey, taskId, timeoutMs: 3 * 60 * 1000 })

  // Download and persist to IndexedDB so the image survives page reloads
  const fetchRes = await fetch(remoteUrl)
  const blob = await fetchRes.blob()
  const assetId = await saveAsset(blob, blob.type || 'image/jpeg')

  return {
    imageUrl: assetId,
    jsonPrompt: buildJsonPrompt(profile),
  }
}
