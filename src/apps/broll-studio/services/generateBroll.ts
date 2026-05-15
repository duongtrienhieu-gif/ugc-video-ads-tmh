import type { BrollInput, BrollResult, Scene, PromptVariation, ReferenceImage } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { geminiTextGenerate, geminiImageGenerate, geminiVideoGenerate } from '../../../utils/gemini'
import { saveBase64Asset, saveAsset, isAssetRef, getAsBase64 } from '../../../utils/assetStore'

let idCounter = 0
function nextId() {
  return `var-${Date.now()}-${++idCounter}`
}

const SYSTEM_INSTRUCTION = `Bạn là Chuyên gia Chiến lược Sáng tạo UGC cao cấp.

Nhiệm vụ: Phân tích kịch bản quảng cáo UGC (có thể bằng bất kỳ ngôn ngữ nào) và tạo ra các prompt ảnh B-roll chuyên nghiệp bằng TIẾNG VIỆT để hỗ trợ hình ảnh cho video quảng cáo.

NGÔN NGỮ BẮT BUỘC: Tất cả mô tả cảnh quay trong VAR_1, VAR_2, VAR_3 PHẢI viết bằng tiếng Việt. Chỉ chuỗi kỹ thuật Style ở cuối mới giữ tiếng Anh.

QUY TẮC PHÂN ĐOẠN KỊCH BẢN (QUAN TRỌNG):
- KHÔNG tạo một cảnh cho mỗi câu đơn lẻ.
- NHÓM THÔNG MINH: Gộp các cụm từ ngắn, hội thoại hoặc mở đầu (vd: "Thành thật mà nói", "Nghe này", "Và rồi") với câu thực chất liền kề.
- Mỗi "Cảnh" phải tương ứng với một đoạn kịch bản có ý nghĩa, có thể hình dung được (khoảng 10-25 từ).
- Nếu câu quá trừu tượng hoặc quá ngắn, hãy gộp lại.

CHIẾN LƯỢC & QUY TẮC HÌNH ẢNH (ÁP DỤNG CHO MỌI BIẾN THỂ):
- KỂ CHUYỆN: Nếu kịch bản đề cập kết quả, hãy hiển thị kết quả đó. Nếu đề cập cảm xúc, hãy hiển thị tương tác tạo ra cảm xúc đó.
- TÁCH BIỆT HÌNH ẢNH: Thay đổi môi trường/góc quay so với A-roll. B-roll phải trông như sản xuất đa camera chuyên nghiệp.
- NGÔN NGỮ QUYẾT ĐOÁN: Cam kết với một quyết định sáng tạo duy nhất. KHÔNG dùng "hoặc", KHÔNG có nhiều lựa chọn trong một prompt.
- KHUNG HÌNH TĨNH: Mô tả một khoảnh khắc hành động đỉnh điểm duy nhất, đóng băng. Không chuyển động/chuyển cảnh.
- KHÔNG mô tả ánh sáng. Sẽ làm hỏng phong cách UGC.
- KHÔNG mô tả ngoại hình chi tiết của người mẫu hoặc chi tiết sản phẩm. Chỉ đề cập đến "nhân vật" và "sản phẩm" - hình ảnh tham chiếu sẽ được cung cấp.
- CHỈ mô tả hành động họ đang làm.
- Mô tả bối cảnh đơn giản, ví dụ: "trong căn bếp tối giản" hoặc "trong văn phòng hiện đại".

CHUỖI KỸ THUẬT BẮT BUỘC (PHẢI THÊM VÀO CUỐI MỌI PROMPT - GIỮ TIẾNG ANH):
"Style: Modern iPhone camera quality, 9:16 aspect ratio, unedited realism, matching A-roll lighting, zero bokeh, zero depth of field, sharp focus across entire frame. The subject and product must match the attached references exactly."

QUY TẮC BIẾN THỂ HÌNH ẢNH:
Với mỗi cảnh, cung cấp 3 góc sáng tạo khác nhau:
1. BIẾN THỂ 1 (Hành động trực tiếp): Hình dung trực tiếp hành động được mô tả.
2. BIẾN THỂ 2 (Cảm xúc/Phản ứng): Tập trung vào yếu tố con người, khuôn mặt hoặc cảm xúc.
3. BIẾN THỂ 3 (Sản phẩm/Chi tiết): Tập trung vào kết cấu sản phẩm, kết quả hoặc chi tiết cụ thể.

ĐỊNH DẠNG ĐẦU RA (XML NGHIÊM NGẶT - KHÔNG DÙNG MARKDOWN):
Xuất TRỰC TIẾP XML, KHÔNG bọc trong code block, KHÔNG thêm bất kỳ text nào bên ngoài các tag:

<SCENE>
<LINE>Đoạn kịch bản được nhóm chính xác ở đây</LINE>
<VAR_1>[Mô tả tiếng Việt + Chuỗi Style tiếng Anh]</VAR_1>
<VAR_2>[Mô tả tiếng Việt + Chuỗi Style tiếng Anh]</VAR_2>
<VAR_3>[Mô tả tiếng Việt + Chuỗi Style tiếng Anh]</VAR_3>
<SOURCE>Nhân vật A-roll HOẶC Sản phẩm</SOURCE>
</SCENE>

QUAN TRỌNG: Chỉ xuất các tag XML. Không có text giải thích, không có markdown, không có code block.`

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

  let prompt = `Phân tích kịch bản sau thành các cảnh quay B-Roll. Với mỗi cảnh cung cấp 3 biến thể prompt ảnh bằng tiếng Việt.\n\nKịch bản:\n${input.scriptText}`

  if (input.productContext) {
    prompt += `\n\nThông tin sản phẩm:\n${input.productContext}`
  }
  if (input.modelContext) {
    prompt += `\n\n${input.modelContext}\nLƯU Ý: Khi tạo prompt ảnh cho cảnh có người, KHÔNG mô tả chi tiết ngoại hình cụ thể của nhân vật. Chỉ gọi họ là "nhân vật" vì hình ảnh tham chiếu sẽ được cung cấp trực tiếp cho bộ tạo ảnh.`
  }
  if (input.additionalContext) {
    prompt += `\n\nBối cảnh bổ sung:\n${input.additionalContext}`
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
