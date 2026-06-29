// ── MKT Agent · Bộ lọc TEST ĐƯỢC (branded vs generic) ────────────────────────
// Mô hình COD của user: nhập hàng GENERIC sẵn trên 1688 + tự dán nhãn (rebrand)
// → test. Hàng BRANDED (COSRX/SKINTIFIC/OXY...) KHÔNG clone được, nguồn bị khoá.
// Gemini đọc TÊN (batch ≤50/call) → branded? + tên brand. Rẻ, 1-3 call.
import { directGeminiText } from '../../../utils/gemini'

export interface BrandingResult { isBranded: boolean; brand?: string }

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
}

async function classifyBatch(
  apiKey: string,
  items: { id: string; title: string }[],
): Promise<Record<string, BrandingResult>> {
  const list = items.map((it, i) => `${i}. ${it.title}`).join('\n')
  const prompt = `Phân loại sản phẩm theo TÊN để quyết CLONE-TEST được không (mô hình COD: nhập hàng generic từ 1688 rồi tự dán nhãn).

branded=true nếu tên chứa NHÃN HIỆU riêng/thương hiệu (vd COSRX, SKINTIFIC, OXY, Benzac, SimplyHeal, Cetaphil, SKINTIFIC, Garnier...). branded=false nếu GENERIC mô tả công dụng, không thương hiệu (vd "minyak urut halia", "acne pimple patch", "L-Carnitine 1000mg", "minyak bidara") — loại này nhà máy TQ bán sẵn, clone được.

Danh sách:
${list}

CHỈ trả JSON: {"results":[{"i":0,"branded":true,"brand":"COSRX"},{"i":1,"branded":false}]}`
  const raw = await directGeminiText({ apiKey, prompt, responseMimeType: 'application/json', temperature: 0 })
  const out: Record<string, BrandingResult> = {}
  try {
    const parsed = JSON.parse(stripFences(raw)) as { results?: { i: number; branded: boolean; brand?: string }[] }
    for (const r of parsed.results ?? []) {
      const it = items[r.i]
      if (it) out[it.id] = { isBranded: !!r.branded, brand: r.brand?.trim() || undefined }
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
