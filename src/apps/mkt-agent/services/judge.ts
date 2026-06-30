// ── MKT Agent · Giám khảo Gemini ─────────────────────────────────────────────
// Đưa TOÀN BỘ hồ sơ SP (số bán/ads/video/1688/margin/ship) cho Gemini → không
// chỉ ra điểm mà ra LẬP LUẬN + rủi ro (vd "bán cao nhưng 0 ad = organic, rủi ro
// cho COD chạy ads"). Bổ sung cho điểm WIN số. 1 Gemini call/SP (sau Soi sâu).
import { directGeminiText } from '../../../utils/gemini'
import type { SpCandidate, JudgeResult } from '../store'

export async function judgeSp(apiKey: string, c: SpCandidate): Promise<JudgeResult> {
  const d = c.deep
  const profile = [
    `Tên: ${c.title}`,
    `Ngách: ${c.niche ?? '—'}`,
    `Loại: ${c.tier === 'generic' ? 'generic (clone tự do)' : c.tier === 'oem' ? 'nhãn xưởng (nhập sẵn 1688)' : c.tier === 'brand' ? 'BRAND BẢO HỘ (không bán được)' : 'chưa rõ'}`,
    `Số bán: ${c.sale} · Giá: ${c.price ? 'RM' + c.price : '—'} · Rating: ${c.rating ?? '—'}`,
    `Ship: ${c.shipFrom ?? '—'}`,
    d ? `Video TikTok: ${d.videoCount} (view cao nhất ${d.maxViews})` : 'Chưa Soi sâu video',
    d ? `Ads đối thủ FB: ${d.adCount} · ad chạy lâu nhất ${d.adTopDays} ngày · advertiser nhiều ad nhất ${d.adTopScale}` : '',
    d ? `1688: ${d.on1688 ? `khớp ${d.count1688} · giá vốn từ ¥${d.cost1688}` : 'không khớp ảnh'}` : '',
  ].filter(Boolean).join('\n')

  const prompt = `Bạn là chuyên gia chọn SP để TEST ADS COD ở Malaysia. Mô hình: nhập hàng GENERIC từ 1688 + tự dán nhãn + chạy ads COD.

Tiêu chí (theo thứ tự quan trọng): (1) generic clone được + có nguồn 1688 ready; (2) ĐỐI THỦ đang chạy ads COD lâu ngày + scale = đã có lời (tín hiệu MẠNH NHẤT); (3) biên lời dày; (4) hoàn thấp (cross-border + rating thấp = rủi ro). Cảnh giác: số bán cao nhưng 0 ad đối thủ có thể là organic/mùa vụ → rủi ro cho COD chạy ads.

HỒ SƠ SP:
${profile}

Đánh giá ngắn gọn, thực chiến. CHỈ trả JSON:
{"verdict":"NÊN TEST | CÂN NHẮC | BỎ","score":<0-100>,"reasons":["lý do ngắn",...],"risks":["rủi ro ngắn",...]}`

  const raw = await directGeminiText({ apiKey, prompt, responseMimeType: 'application/json', temperature: 0.3 })
  try {
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
    const p = JSON.parse(clean) as Partial<JudgeResult>
    return {
      verdict: typeof p.verdict === 'string' ? p.verdict : '—',
      score: Number(p.score) || 0,
      reasons: Array.isArray(p.reasons) ? p.reasons.slice(0, 5).map(String) : [],
      risks: Array.isArray(p.risks) ? p.risks.slice(0, 5).map(String) : [],
    }
  } catch {
    return { verdict: '—', score: 0, reasons: ['Gemini trả JSON lỗi — thử lại'], risks: [] }
  }
}
