import type { CharacterProfile } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { generateImage, pollImageUntilDone } from '../../../utils/kieai'
import type { ImageResolution } from '../../../utils/kieai'
import { saveAsset } from '../../../utils/assetStore'

export interface GenerationResult {
  imageUrl: string
  jsonPrompt: Record<string, Record<string, string>>
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
 */
function buildImagePrompt(profile: CharacterProfile, hasProduct?: boolean): string {
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

  // Pose & action
  const poseParts = [
    profile.pose,
    profile.action,
    hasProduct && 'holding a product bottle in their hands, product clearly visible',
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
  const kieApiKey = useSettingsStore.getState().kieApiKey
  if (!kieApiKey) throw new Error('NO_KIE_KEY')

  const hasProduct = !!productImageUrl
  const prompt = buildImagePrompt(profile, hasProduct)
  const aspectRatio = profile.aspectRatio?.includes('1:1')
    ? '1:1'
    : profile.aspectRatio === 'Landscape (16:9)'
    ? '16:9'
    : '9:16'

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
