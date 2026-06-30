// ── MKT Agent · Phân loại SP (3 bậc + biến thể) ──────────────────────────────
// Mô hình COD: nhập hàng từ 1688 + dán nhãn/bán lại. KHÔNG bỏ mù quáng mọi
// "branded" — nhãn xưởng Trung/Anh (1688 stock) NHẬP ĐƯỢC NGAY. Chỉ bỏ brand
// BẢO HỘ (nổi/đăng ký, bán lậu bị gỡ/ban). + cờ variantRisk (thời trang/giày
// nhiều size-màu = sai số/hoàn). Gemini đọc TÊN (batch ≤50/call). Rẻ, 1-3 call.
import { directGeminiText } from '../../../utils/gemini'

export interface BrandingResult {
  tier: 'generic' | 'oem' | 'brand'
  brand?: string
  variantRisk: 'high' | 'low'
}

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
}

async function classifyBatch(
  apiKey: string,
  items: { id: string; title: string }[],
): Promise<Record<string, BrandingResult>> {
  const list = items.map((it, i) => `${i}. ${it.title}`).join('\n')
  const prompt = `Phân loại sản phẩm cho mô hình COD Malaysia (nhập hàng từ 1688 rồi dán nhãn/bán lại).

Mỗi SP trả 3 trường:
1. "tier":
   - "generic": không thương hiệu, chỉ mô tả công dụng (vd "minyak urut halia", "acne pimple patch", "posture corrector belt") → clone tự do.
   - "oem": có một cái tên/nhãn kiểu XƯỞNG TRUNG/ANH chung chung, LẠ, KHÔNG nổi tiếng (vd "QUSTERE", "BIDARA HQ", "VELA", tên tự chế) → xưởng TQ bán sẵn trên 1688, nhập về bán ngay được. GIỮ.
   - "brand": THƯƠNG HIỆU NỔI TIẾNG / ĐĂNG KÝ thật (vd COSRX, SKINTIFIC, Cetaphil, Garnier, Hada Labo, Watsons, Blackmores, dược phẩm chính hãng...) → bán lậu bị kiện/gỡ/ban. BỎ.
2. "brand": tên thương hiệu/nhãn nếu có (oem hoặc brand), bỏ trống nếu generic.
3. "variantRisk": "high" nếu là THỜI TRANG/GIÀY/PHỤ KIỆN nhiều size-màu (áo, quần, giày, túi, đồng hồ, váy, tudung...) → nhiều biến thể, sai số, hoàn cao. "low" nếu SP đơn (mỹ phẩm, TPCN, gia dụng, miếng dán, máy nhỏ...).

PHÂN BIỆT oem vs brand: oem = tên lạ/nhãn xưởng AI CŨNG NHẬP ĐƯỢC; brand = thương hiệu có tiếng/đăng ký mà bán lậu sẽ bị xử lý. Nếu phân vân tên lạ không rõ nổi tiếng → ưu tiên "oem" (nhập được).

Danh sách:
${list}

CHỈ trả JSON: {"results":[{"i":0,"tier":"generic","variantRisk":"low"},{"i":1,"tier":"oem","brand":"QUSTERE","variantRisk":"low"}]}`
  const raw = await directGeminiText({ apiKey, prompt, responseMimeType: 'application/json', temperature: 0 })
  const out: Record<string, BrandingResult> = {}
  try {
    const parsed = JSON.parse(stripFences(raw)) as { results?: { i: number; tier?: string; brand?: string; variantRisk?: string }[] }
    for (const r of parsed.results ?? []) {
      const it = items[r.i]
      if (!it) continue
      const tier: BrandingResult['tier'] = r.tier === 'brand' ? 'brand' : r.tier === 'oem' ? 'oem' : 'generic'
      out[it.id] = {
        tier,
        brand: r.brand?.trim() || undefined,
        variantRisk: r.variantRisk === 'high' ? 'high' : 'low',
      }
    }
  } catch { /* parse fail → batch này để chưa-lọc, không vỡ */ }
  return out
}

export async function classifyBranding(
  apiKey: string,
  items: { id: string; title: string }[],
): Promise<Record<string, BrandingResult>> {
  if (!items.length) return {}
  const CHUNK = 50
  const batches: { id: string; title: string }[][] = []
  for (let i = 0; i < items.length; i += CHUNK) batches.push(items.slice(i, i + CHUNK))
  const results = await Promise.all(batches.map((b) => classifyBatch(apiKey, b)))
  return Object.assign({}, ...results)
}
