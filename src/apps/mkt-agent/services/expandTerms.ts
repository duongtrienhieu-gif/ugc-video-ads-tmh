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
Sinh 6-8 TỪ KHÓA NGẮN tiếng Malay để search quảng cáo COD cho SP này trên FB/TikTok Ad Library ở Malaysia. Phủ NHIỀU GÓC mà đối thủ hay target: LOẠI sản phẩm · NỖI ĐAU người mua · LỢI ÍCH · THÀNH PHẦN chính · 1-2 từ tiếng Anh. Mỗi từ 2-3 chữ, generic (KHÔNG kèm tên thương hiệu riêng).
CHỈ trả JSON mảng chuỗi: ["minyak urut","sakit sendi","minyak halia",...]`
  try {
    const raw = await directGeminiText({ apiKey, prompt, responseMimeType: 'application/json', temperature: 0.4 })
    const arr = JSON.parse(stripFences(raw)) as unknown
    const terms = Array.isArray(arr) ? arr.map((x) => String(x).trim()).filter(Boolean) : []
    const all = [...fallback, ...terms]
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
