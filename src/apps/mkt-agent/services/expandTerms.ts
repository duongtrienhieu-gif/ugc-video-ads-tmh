// ── MKT Agent · Bung từ khóa spy ─────────────────────────────────────────────
// 1 từ khóa = NGHÈO: đối thủ target nhiều góc khác nhau (loại SP / nỗi đau /
// lợi ích / thành phần). Gemini đẻ 6-8 từ MY đa trục → search rộng, gộp lại
// nhiều ad hơn. Dùng chung cho Soi sâu (đếm ads) + Spy harvest (lấy 10 video).
import { directGeminiText } from '../../../utils/gemini'

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
}

// ── Bung 1 NGÁCH rộng → N từ khóa loại-SP (Malay) phủ cả bề rộng ngách ────────
// Dùng khi user pick ngách (không muốn tự gõ từ khóa). Ra danh từ-SP để tìm SP bán
// trên TikTok Shop, KHÔNG phải triệu chứng (tránh phòng khám/dịch vụ).
export async function expandNicheToProducts(
  apiKey: string,
  nicheText: string,
  count = 15,
): Promise<string[]> {
  const seed = nicheText.split(',').map((s) => s.trim()).filter(Boolean)
  const n = Math.max(6, Math.min(30, count))
  const prompt = `Ngách sản phẩm COD (Malaysia): "${nicheText}".
Sinh ${n} TỪ KHÓA tiếng Malay để tìm SẢN PHẨM ĐANG BÁN thuộc ngách này trên TikTok Shop — phủ RỘNG các LOẠI sản phẩm khác nhau trong ngách (đa dạng, không lặp 1 loại).
QUY TẮC:
- Mỗi từ là DANH TỪ SẢN PHẨM / dạng SP (vd "minyak urut", "gel sendi", "brace lutut", "koyo panas") — KHÔNG phải triệu chứng trần ("sakit lutut") vì ra phòng khám/dịch vụ.
- KHÔNG tên thương hiệu riêng. Mỗi từ 2-3 chữ. Đa dạng, không trùng nghĩa.
CHỈ trả JSON mảng ${n} chuỗi: ["minyak urut","gel sendi",...]`
  try {
    const raw = await directGeminiText({ apiKey, prompt, responseMimeType: 'application/json', temperature: 0.5 })
    const arr = JSON.parse(stripFences(raw)) as unknown
    const terms = Array.isArray(arr) ? arr.map((x) => String(x).trim()).filter(Boolean) : []
    const seen = new Set<string>()
    const uniq: string[] = []
    for (const t of [...terms, ...seed]) {
      const k = t.toLowerCase()
      if (!seen.has(k) && t.length >= 2 && t.length <= 40) { seen.add(k); uniq.push(t) }
    }
    return uniq.slice(0, n).length ? uniq.slice(0, n) : seed
  } catch {
    return seed
  }
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
