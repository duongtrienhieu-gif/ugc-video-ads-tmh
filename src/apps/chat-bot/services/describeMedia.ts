// ─────────────────────────────────────────────────────────────────────────
// CHAT BOT — đọc ảnh tự động (Gemini Vision) để gợi ý role + caption.
//
// Chạy 1 LẦN lúc tải/chọn ảnh (KHÔNG phải lúc chat) → không đụng ngân sách chat.
// Trả { role, caption } để MediaMapEditor tự điền; user vẫn sửa được.
// ─────────────────────────────────────────────────────────────────────────

import { directGeminiVision } from '../../../utils/gemini'
import { getAsBase64, isAssetRef } from '../../../utils/assetStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { ROLE_ORDER } from '../labels'
import type { MediaRole } from '../types'

const SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    role: { type: 'string', enum: ROLE_ORDER },
    caption: { type: 'string' },
  },
  required: ['role', 'caption'],
}

const PROMPT = `Đây là 1 ảnh dùng để bán hàng/quảng cáo. Phân loại + MÔ TẢ để 1 chatbot bán hàng biết ảnh THỂ HIỆN GÌ và KHI NÀO nên gửi.
Trả JSON { role, caption }:
- role: chọn 1 ĐÚNG nội dung ảnh (nhìn kỹ, đừng đoán bừa 'feature'):
  hook (giật tít/thu hút) · pain (vấn đề/nỗi đau/triệu chứng) · feature (tính năng/thành phần) · mechanism (cơ chế hoạt động/vì sao hiệu quả) · usage (hướng dẫn dùng) · compare (so sánh/before-after) · proof (review/feedback/chat khách thật) · authority (báo chí/bác sĩ/chuyên gia/chứng nhận KKM) · promo (khuyến mãi/combo/giá) · unboxing (mở hộp/dùng thử) · other.
- caption: TIẾNG VIỆT, ≤25 từ, BẮT BUỘC đúng format 2 vế:
  "<tả CỤ THỂ ảnh thể hiện gì> — GỬI KHI: <tình huống chat cụ thể>"
  Vế 1 tả thật chi tiết đắt giá nhất trong ảnh (triệu chứng gì, khách kiểu nào, số liệu gì). Vế 2 là tình huống khách nhắn để bot biết lúc rút ảnh.
  KHÔNG chép nguyên câu chữ/headline in trên ảnh. KHÔNG bịa thông tin không có trong ảnh.
  Ví dụ tốt:
  "khách nữ lớn tuổi đau gối khi leo cầu thang — GỬI KHI: khách than đau lúc lên xuống cầu thang/ngồi xổm"
  "review 5 sao kèm ảnh chat WhatsApp khách dùng 2 tuần — GỬI KHI: khách do dự, nghi ngờ, hoặc im lặng"
  "sơ đồ cơ chế xịt làm sạch khoang mũi giảm viêm — GỬI KHI: giải thích vì sao hết nghẹt/khách hỏi có hiệu quả không"`

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/** Lấy base64 từ assetRef (asset-UUID) hoặc URL trực tiếp. */
async function refToBase64(ref: string): Promise<{ base64: string; mime: string } | null> {
  try {
    if (isAssetRef(ref)) {
      const r = await getAsBase64(ref)
      return r ? { base64: r.base64, mime: r.mimeType } : null
    }
    const res = await fetch(ref)
    const blob = await res.blob()
    return { base64: await blobToBase64(blob), mime: blob.type || 'image/jpeg' }
  } catch {
    return null
  }
}

/** Đọc 1 ảnh → { role, caption }. Trả null nếu không có Gemini key / không đọc được. */
export async function describeMediaRef(assetRef: string): Promise<{ role: MediaRole; caption: string } | null> {
  const s = useSettingsStore.getState()
  if (!s.hasGeminiKey()) return null

  const img = await refToBase64(assetRef)
  if (!img) return null

  try {
    const text = await directGeminiVision({
      apiKey: s.getGeminiApiKey(),
      parts: [
        { inlineData: { mimeType: img.mime, data: img.base64 } },
        { text: PROMPT },
      ],
      responseMimeType: 'application/json',
      responseSchema: SCHEMA,
      maxOutputTokens: 200,
      thinkingBudget: 0,
    })
    const parsed = JSON.parse(text) as { role?: string; caption?: string }
    const role = (ROLE_ORDER as string[]).includes(parsed.role ?? '') ? (parsed.role as MediaRole) : 'other'
    return { role, caption: (parsed.caption ?? '').trim() }
  } catch {
    return null
  }
}
