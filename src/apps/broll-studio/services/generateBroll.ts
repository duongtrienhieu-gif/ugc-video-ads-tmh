import type { BrollInput, BrollResult, Scene, PromptVariation, ReferenceImage } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { geminiTextGenerate, geminiImageGenerate, geminiVideoGenerate } from '../../../utils/gemini'
import { saveBase64Asset, saveAsset, isAssetRef, getAsBase64 } from '../../../utils/assetStore'

let idCounter = 0
function nextId() {
  return `var-${Date.now()}-${++idCounter}`
}

const STYLE_STRING = 'Style: Modern iPhone camera quality, 9:16 aspect ratio, unedited realism, matching A-roll lighting, zero bokeh, zero depth of field, sharp focus across entire frame.'

const SYSTEM_INSTRUCTION = `You are a Senior UGC Creative Strategist. Analyze ad scripts in any language and output B-roll image prompts.

CRITICAL: Write all image descriptions (VAR_1, VAR_2, VAR_3) in Vietnamese (Tiếng Việt). Only the Style string at the end stays in English.

RULES:
- Group short filler phrases with adjacent sentences (10-25 words per scene). Merge if too short.
- Describe a single frozen action moment. No lighting description. No model appearance details.
- Each VAR must end with: "${STYLE_STRING}"
- 3 variations per scene: VAR_1=action/literal, VAR_2=emotional/face, VAR_3=product/detail

OUTPUT FORMAT — respond with ONLY this XML, no markdown, no extra text:
<SCENE>
<LINE>exact script segment</LINE>
<VAR_1>Vietnamese description. ${STYLE_STRING}</VAR_1>
<VAR_2>Vietnamese description. ${STYLE_STRING}</VAR_2>
<VAR_3>Vietnamese description. ${STYLE_STRING}</VAR_3>
<SOURCE>Character or Product</SOURCE>
</SCENE>`

/** Strip markdown code fences and normalise whitespace before XML parsing */
function cleanLLMResponse(raw: string): string {
  return raw
    .replace(/```xml\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/^\s+|\s+$/g, '')
}

/** Extract inner text of an XML-like tag (case-insensitive, multiline) */
function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  return block.match(re)?.[1]?.trim() ?? ''
}

export async function generateBroll(input: BrollInput): Promise<BrollResult> {
  const apiKey = useSettingsStore.getState().getApiKey()

  let prompt = `Break this script into B-Roll scenes with 3 Vietnamese image prompt variations each.\n\nSCRIPT:\n${input.scriptText}`

  if (input.productContext) {
    prompt += `\n\nPRODUCT INFO: ${input.productContext}`
  }
  if (input.modelContext) {
    prompt += `\n\nCHARACTER INFO: ${input.modelContext}. Do not describe physical appearance — just say "the subject".`
  }
  if (input.additionalContext) {
    prompt += `\n\nADDITIONAL CONTEXT: ${input.additionalContext}`
  }

  const rawResponse = await geminiTextGenerate(apiKey, prompt, SYSTEM_INSTRUCTION)
  console.log('[generateBroll] raw response length:', rawResponse.length)
  console.log('[generateBroll] raw preview:', rawResponse.slice(0, 300))

  // Strip markdown code blocks the LLM sometimes adds despite instructions
  const responseText = cleanLLMResponse(rawResponse)

  const scenes: Scene[] = []
  // Case-insensitive match for <SCENE>...</SCENE> blocks
  const sceneRegex = /<SCENE[^>]*>([\s\S]*?)<\/SCENE>/gi

  let match
  let number = 1
  while ((match = sceneRegex.exec(responseText)) !== null) {
    const block = match[1]
    const scriptLine = extractTag(block, 'LINE')
    const var1 = extractTag(block, 'VAR_1')
    const var2 = extractTag(block, 'VAR_2')
    const var3 = extractTag(block, 'VAR_3')
    const source = extractTag(block, 'SOURCE')

    // Skip empty blocks
    if (!scriptLine && !var1 && !var2 && !var3) continue

    let type: Scene['type'] = 'B-ROLL LIFESTYLE'
    const sLow = source.toLowerCase()
    if (sLow.includes('nhân vật') || sLow.includes('character') || sLow.includes('model') || sLow.includes('subject')) type = 'A-ROLL CHARACTER'
    else if (sLow.includes('sản phẩm') || sLow.includes('product')) type = 'A-ROLL PRODUCT'

    scenes.push({
      number: number++,
      type,
      scriptLine,
      variations: [
        { id: nextId(), label: 'Lựa chọn 1', tag: 'LITERAL / ACTION', prompt: var1 },
        { id: nextId(), label: 'Lựa chọn 2', tag: 'EMOTIONAL / REACTION', prompt: var2 },
        { id: nextId(), label: 'Lựa chọn 3', tag: 'PRODUCT / DETAIL', prompt: var3 },
      ],
    })
  }

  console.log('[generateBroll] parsed scenes:', scenes.length)

  // Fallback: if XML parsing failed entirely, log the raw response for debugging
  if (scenes.length === 0) {
    console.error('[generateBroll] XML parse failed. Full response:\n', responseText)
    throw new Error(`AI không trả về đúng định dạng. Thử lại lần nữa. (Phản hồi: ${responseText.slice(0, 200)}...)`)
  }

  return { scenes }
}

/**
 * Parse a data URL into base64 + mimeType for API submission.
 */
function parseDataUrl(dataUrl: string): { base64: string; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return { mimeType: match[1], base64: match[2] }
}

/**
 * Generate an image from a B-Roll prompt using Nano Banana 2.
 * Optionally includes reference images (model/product) for visual consistency.
 * Reference image dataUrls can be asset IDs or data URLs.
 */
export async function generateImage(
  prompt: string,
  referenceImages?: ReferenceImage[],
  aspectRatio: string = '9:16',
): Promise<string> {
  const apiKey = useSettingsStore.getState().getApiKey()

  // Build reference image parts for multimodal input
  const refParts: Array<{ base64: string; mimeType: string }> = []
  if (referenceImages?.length) {
    for (const ref of referenceImages) {
      if (isAssetRef(ref.dataUrl)) {
        const asset = await getAsBase64(ref.dataUrl)
        if (asset) refParts.push(asset)
      } else {
        const parsed = parseDataUrl(ref.dataUrl)
        if (parsed) refParts.push(parsed)
      }
    }
  }

  const result = await geminiImageGenerate(apiKey, prompt, aspectRatio, refParts.length > 0 ? refParts : undefined)
  return saveBase64Asset(result.base64, result.mimeType)
}

/**
 * Animate a still frame into video using Veo 3.1 frame-to-video.
 * The still image is used as the first frame; Veo generates the rest.
 * Returns a persistent asset ID.
 */
export async function animateFrame(imageUrl: string, prompt: string, aspectRatio: string = '9:16'): Promise<string> {
  const apiKey = useSettingsStore.getState().getApiKey()

  // Convert image source to base64 + mimeType for the API
  let base64: string
  let mimeType: string

  if (isAssetRef(imageUrl)) {
    const asset = await getAsBase64(imageUrl)
    if (!asset) throw new Error('Asset not found')
    base64 = asset.base64
    mimeType = asset.mimeType
  } else if (imageUrl.startsWith('data:')) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) throw new Error('Invalid image data URL')
    mimeType = match[1]
    base64 = match[2]
  } else {
    const res = await fetch(imageUrl)
    const blob = await res.blob()
    mimeType = blob.type
    const buffer = await blob.arrayBuffer()
    base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
  }

  const videoBlob = await geminiVideoGenerate(apiKey, prompt, base64, mimeType, aspectRatio)
  return saveAsset(videoBlob)
}

/**
 * Generate a new prompt variation for a scene using Gemini 3 Flash.
 */
export async function generateNewVariation(
  sceneNumber: number,
  sceneType: string,
  scriptLine: string,
): Promise<PromptVariation> {
  const apiKey = useSettingsStore.getState().getApiKey()

  const prompt = `Generate a single new creative image generation prompt for this B-Roll scene:

Scene ${sceneNumber}: ${sceneType}
Script line: "${scriptLine}"

Provide a fresh creative angle.
RULES:
1. DO NOT describe lighting. It messes up the UGC style.
2. DO NOT describe the model's appearance or product details. Mention the product and the model/subject.
3. ONLY describe the action they're doing. Describe the scene simply, e.g., 'in a minimalist kitchen'.
4. Append this exactly to the end of the prompt: "Style: Modern iPhone camera quality, 9:16 aspect ratio, unedited realism, matching A-roll lighting, zero bokeh, zero depth of field, sharp focus across entire frame. The subject and product must match the attached references exactly."

Respond with ONLY valid JSON (no markdown):
{
  "label": "Option N",
  "tag": "LITERAL / ACTION" | "EMOTIONAL / REACTION" | "PRODUCT / DETAIL",
  "prompt": "<the detailed prompt>"
}`

  const responseText = await geminiTextGenerate(apiKey, prompt)
  const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const parsed = JSON.parse(cleaned) as { label: string; tag: PromptVariation['tag']; prompt: string }

  return {
    id: nextId(),
    label: parsed.label,
    tag: parsed.tag,
    prompt: parsed.prompt,
  }
}
