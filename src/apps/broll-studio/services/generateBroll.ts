import type { BrollInput, BrollResult, Scene, PromptVariation, ReferenceImage } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { geminiTextGenerate, geminiImageGenerate, geminiVideoGenerate } from '../../../utils/gemini'
import { saveBase64Asset, saveAsset, isAssetRef, getAsBase64 } from '../../../utils/assetStore'

let idCounter = 0
function nextId() {
  return `var-${Date.now()}-${++idCounter}`
}

const STYLE_STRING =
  'Style: Modern iPhone camera quality, 9:16 aspect ratio, unedited realism, matching A-roll lighting, zero bokeh, zero depth of field, sharp focus across entire frame.'

// ─── System instruction: English + short = most reliable on KIE.ai models ───
const SYSTEM_INSTRUCTION = `You are a UGC B-roll creative strategist. Given an ad script (any language), break it into visual scenes and write image generation prompts IN VIETNAMESE for each scene.

Rules:
- Group short filler lines with adjacent sentences so each scene is ~10-25 words.
- Write all descriptions in Vietnamese (Tiếng Việt).
- Each prompt must end with this English style string: "${STYLE_STRING}"
- Do NOT describe lighting, actor appearance, or product details. Only describe action and setting.
- Commit to one creative choice per prompt. No alternatives within a prompt.

For each scene produce 3 prompts:
1. literal_action: directly visualise the described action
2. emotional_reaction: focus on face/emotion/human element
3. product_detail: focus on product texture, result, or close-up detail

source field: "character" if the scene involves a person, "product" if product-only.

Return ONLY a JSON array — no markdown, no explanation:
[{"line":"...","source":"character|product","literal_action":"Vietnamese prompt. ${STYLE_STRING}","emotional_reaction":"Vietnamese prompt. ${STYLE_STRING}","product_detail":"Vietnamese prompt. ${STYLE_STRING}"}]`

// ─── Strip markdown fences that models sometimes add ───
function cleanJSON(raw: string): string {
  return raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
}

// ─── Main generation ───────────────────────────────────────────────────────
export async function generateBroll(input: BrollInput): Promise<BrollResult> {
  const apiKey = useSettingsStore.getState().getApiKey()

  let prompt = `Script:\n${input.scriptText}`
  if (input.productContext) prompt += `\n\nProduct: ${input.productContext}`
  if (input.modelContext)   prompt += `\nCharacter (call "the subject" only): ${input.modelContext}`
  if (input.additionalContext) prompt += `\nExtra context: ${input.additionalContext}`

  const raw = await geminiTextGenerate(apiKey, prompt, SYSTEM_INSTRUCTION)
  console.log('[generateBroll] raw length:', raw.length, '| preview:', raw.slice(0, 200))

  const cleaned = cleanJSON(raw)

  // Parse JSON array
  let parsed: Array<{
    line: string
    source?: string
    literal_action: string
    emotional_reaction: string
    product_detail: string
  }>

  try {
    parsed = JSON.parse(cleaned) as typeof parsed
    if (!Array.isArray(parsed)) throw new Error('not an array')
  } catch (e) {
    console.error('[generateBroll] JSON parse failed. Raw:\n', cleaned)
    throw new Error(`AI trả về định dạng không hợp lệ — vui lòng thử lại. (${String(e).slice(0, 80)})`)
  }

  if (parsed.length === 0) {
    throw new Error('AI không tạo được cảnh nào — thử lại hoặc kiểm tra kịch bản.')
  }

  const scenes: Scene[] = parsed.map((item, i) => {
    const src = (item.source ?? '').toLowerCase()
    let type: Scene['type'] = 'B-ROLL LIFESTYLE'
    if (src === 'character' || src.includes('character') || src.includes('subject')) type = 'A-ROLL CHARACTER'
    else if (src === 'product' || src.includes('product')) type = 'A-ROLL PRODUCT'

    return {
      number: i + 1,
      type,
      scriptLine: item.line ?? '',
      variations: [
        { id: nextId(), label: 'Lựa chọn 1', tag: 'LITERAL / ACTION',    prompt: item.literal_action ?? '' },
        { id: nextId(), label: 'Lựa chọn 2', tag: 'EMOTIONAL / REACTION', prompt: item.emotional_reaction ?? '' },
        { id: nextId(), label: 'Lựa chọn 3', tag: 'PRODUCT / DETAIL',    prompt: item.product_detail ?? '' },
      ],
    }
  })

  console.log('[generateBroll] scenes parsed:', scenes.length)
  return { scenes }
}

// ─── Image generation ──────────────────────────────────────────────────────
function parseDataUrl(dataUrl: string): { base64: string; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return { mimeType: match[1], base64: match[2] }
}

export async function generateImage(
  prompt: string,
  referenceImages?: ReferenceImage[],
  aspectRatio: string = '9:16',
): Promise<string> {
  const apiKey = useSettingsStore.getState().getApiKey()

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

// ─── Animate frame to video ────────────────────────────────────────────────
export async function animateFrame(imageUrl: string, prompt: string, aspectRatio: string = '9:16'): Promise<string> {
  const apiKey = useSettingsStore.getState().getApiKey()

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

// ─── Generate one new variation for a scene ───────────────────────────────
export async function generateNewVariation(
  sceneNumber: number,
  sceneType: string,
  scriptLine: string,
): Promise<PromptVariation> {
  const apiKey = useSettingsStore.getState().getApiKey()

  const prompt = `Generate one new B-roll image prompt in Vietnamese for:
Scene ${sceneNumber} (${sceneType}): "${scriptLine}"

Rules: Vietnamese description, no lighting, no actor appearance, action + setting only.
End with: "${STYLE_STRING}"

Respond ONLY with valid JSON (no markdown):
{"tag":"LITERAL / ACTION","prompt":"<Vietnamese prompt>"}`

  const raw = await geminiTextGenerate(apiKey, prompt)
  const cleaned = cleanJSON(raw)
  const p = JSON.parse(cleaned) as { tag?: PromptVariation['tag']; prompt: string }

  return {
    id: nextId(),
    label: `Lựa chọn mới`,
    tag: p.tag ?? 'LITERAL / ACTION',
    prompt: p.prompt,
  }
}
