import type { BrollInput, BrollResult, Scene, PromptVariation, ReferenceImage } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { directGeminiText, geminiImageGenerate, geminiVideoGenerate } from '../../../utils/gemini'
import { kieTextGenerate } from '../../../utils/kieai'
import { saveBase64Asset, saveAsset, isAssetRef, getAsBase64 } from '../../../utils/assetStore'

let idCounter = 0
function nextId() {
  return `var-${Date.now()}-${++idCounter}`
}

// ─── Style string appended to every image prompt ─────────────────────────────
const STYLE_STRING =
  'Style: Modern iPhone camera quality, 9:16 aspect ratio, unedited realism, matching A-roll lighting, zero bokeh, zero depth of field, sharp focus across entire frame.'

// ─── System instruction (sent to Gemini directly — very reliable for JSON) ───
const SYSTEM_INSTRUCTION = `You are a UGC B-roll creative director. Given an ad script in ANY language (Vietnamese, English, Malay, or mixed), break it into visual scenes and write 3 image prompt variations per scene IN ENGLISH.

Rules:
- Group short filler lines with adjacent sentences so each scene covers ~10-25 words of the original script.
- Write ALL image descriptions in English only.
- Each prompt must end with this exact string: "${STYLE_STRING}"
- Describe only the visible ACTION and SETTING. No brand names, no actor appearance details, no lighting.
- Commit to one specific visual per prompt — no alternatives within a prompt.
- source = "character" if a person appears in the scene, "product" if product-only.

For each scene produce 3 prompt variations:
1. literal_action — directly visualise the described action
2. emotional_reaction — focus on face/emotion/human element
3. product_detail — focus on product texture, result, or close-up detail

Return ONLY a raw JSON array — no markdown fences, no explanation:
[{"line":"original script excerpt","source":"character|product","literal_action":"English prompt. ${STYLE_STRING}","emotional_reaction":"English prompt. ${STYLE_STRING}","product_detail":"English prompt. ${STYLE_STRING}"}]`

// ─── Strip markdown fences that models sometimes add ─────────────────────────
function cleanJSON(raw: string): string {
  return raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
}

// ─── Text generation: Gemini direct API → fallback to KIE.ai ─────────────────
async function generateText(prompt: string): Promise<string> {
  const geminiKey = useSettingsStore.getState().geminiApiKey
  if (geminiKey) {
    try {
      return await directGeminiText({ apiKey: geminiKey, prompt, systemInstruction: SYSTEM_INSTRUCTION })
    } catch (e) {
      console.warn('[generateBroll] Gemini direct failed, trying KIE.ai:', e)
    }
  }
  // Fallback: KIE.ai text (may fail for complex JSON but worth trying)
  const kieKey = useSettingsStore.getState().kieApiKey
  if (!kieKey) throw new Error('Cần Gemini API key hoặc KIE.ai API key trong Cài đặt')
  return kieTextGenerate(kieKey, prompt, SYSTEM_INSTRUCTION)
}

// ─── Main generation ──────────────────────────────────────────────────────────
export async function generateBroll(input: BrollInput): Promise<BrollResult> {
  let prompt = `Script:\n${input.scriptText}`
  if (input.productContext)    prompt += `\n\nProduct context: ${input.productContext}`
  if (input.modelContext)      prompt += `\nCharacter (always call "the subject"): ${input.modelContext}`
  if (input.additionalContext) prompt += `\nExtra context: ${input.additionalContext}`

  const raw = await generateText(prompt)
  console.log('[generateBroll] raw length:', raw.length, '| preview:', raw.slice(0, 200))

  const cleaned = cleanJSON(raw)

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
        { id: nextId(), label: 'Lựa chọn 1', tag: 'LITERAL / ACTION',     prompt: item.literal_action ?? '' },
        { id: nextId(), label: 'Lựa chọn 2', tag: 'EMOTIONAL / REACTION', prompt: item.emotional_reaction ?? '' },
        { id: nextId(), label: 'Lựa chọn 3', tag: 'PRODUCT / DETAIL',     prompt: item.product_detail ?? '' },
      ],
    }
  })

  console.log('[generateBroll] scenes parsed:', scenes.length)
  return { scenes }
}

// ─── Image generation ─────────────────────────────────────────────────────────
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

// ─── Animate frame to video ───────────────────────────────────────────────────
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

// ─── Generate one new variation for a scene ───────────────────────────────────
export async function generateNewVariation(
  sceneNumber: number,
  sceneType: string,
  scriptLine: string,
): Promise<PromptVariation> {
  const varPrompt = `Generate ONE new B-roll image prompt in English for this scene.

Scene ${sceneNumber} (${sceneType}): "${scriptLine}"

Rules: English description only, no brand names, no actor appearance, describe action + setting.
End with: "${STYLE_STRING}"

Return ONLY valid JSON, no markdown:
{"tag":"LITERAL / ACTION","prompt":"<English image prompt. ${STYLE_STRING}"}`

  const raw = await generateText(varPrompt)
  const cleaned = cleanJSON(raw)
  const p = JSON.parse(cleaned) as { tag?: PromptVariation['tag']; prompt: string }

  return {
    id: nextId(),
    label: `Lựa chọn mới`,
    tag: p.tag ?? 'LITERAL / ACTION',
    prompt: p.prompt,
  }
}
