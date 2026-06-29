// ── MKT Agent · Bung từ khóa spy ─────────────────────────────────────────────
// 1 từ khóa = NGHÈO: đối thủ target nhiều góc khác nhau (loại SP / nỗi đau /
// lợi ích / thành phần). Gemini đẻ 6-8 từ MY đa trục → search rộng, gộp lại
// nhiều ad hơn. Dùng chung cho Soi sâu (đếm ads) + Spy harvest (lấy 10 video).
import { directGeminiText } from '../../../utils/gemini'

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
}

export async function expandSearchTerms(
  apiKey: string,
  c: { title: string; niche?: string },
): Promise<string[]> {
  const fallback = [c.niche, c.title.split(/\s+/).slice(0, 2).join(' ')].filter(Boolean) as string[]
  const prompt = `Sản phẩm: "${c.title}"${c.niche ? ` (ngách: ${c.niche})` : ''}.
Sinh 6-8 TỪ KHÓA NGẮN tiếng Malay để search QUẢNG CÁO COD của ĐÚNG LOẠI sản phẩm này trên FB/TikTok Ad Library (Malaysia).
QUY TẮC QUAN TRỌNG:
- ƯU TIÊN từ chỉ LOẠI/DẠNG sản phẩm (vd "spray sakit gigi", "pemutih gigi", "minyak urut", "gel sendi") — sắp lên ĐẦU danh sách.
- TRÁNH từ TRIỆU CHỨNG TRẦN ("sakit gigi", "sakit sendi") vì ra phòng khám/dịch vụ/brand lớn, KHÔNG phải hàng COD clone được.
- KHÔNG kèm tên thương hiệu riêng. Mỗi từ 2-3 chữ.
CHỈ trả JSON mảng (cụ thể-sản-phẩm TRƯỚC): ["spray sakit gigi","ubat gigi","pemutih gigi",...]`
  try {
    const raw = await directGeminiText({ apiKey, prompt, responseMimeType: 'application/json', temperature: 0.4 })
    const arr = JSON.parse(stripFences(raw)) as unknown
    const terms = Array.isArray(arr) ? arr.map((x) => String(x).trim()).filter(Boolean) : []
    // Từ loại-SP (Gemini) TRƯỚC, niche/triệu-chứng SAU → terms[0] là từ loại-SP (ít drift).
    const all = terms.length ? [...terms, ...(c.niche ? [c.niche] : [])] : fallback
    // khử trùng theo lowercase, giữ thứ tự, cap 8
    const seen = new Set<string>()
    const uniq: string[] = []
    for (const t of all) {
      const k = t.toLowerCase()
      if (!seen.has(k) && t.length <= 40) { seen.add(k); uniq.push(t) }
    }
    return uniq.slice(0, 8).length ? uniq.slice(0, 8) : fallback
  } catch {
    return fallback.length ? fallback : [c.title.slice(0, 30)]
  }
}
