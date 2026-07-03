// ── MKT Agent · Điểm WIN (deterministic) ─────────────────────────────────────
// Chấm SP theo mô hình COD MY. 2 mức:
//   • LITE (lúc quét, sau khi dò video): cầu (bán) + video ĐÚNG SP đang được đẩy
//     + author-match (video chính chủ) + đối thủ ngách chạy ads → RANK cả rổ mà
//     KHÔNG cần Soi sâu.
//   • FULL (sau Soi sâu): thêm 1688 sourceable + biên lời + đối thủ paid scale.
import type { SpCandidate } from '../store'

export interface WinScore {
  score: number
  tier: 'strong' | 'good' | 'weak' | 'reject' | 'partial'
  risks: string[]
  full: boolean
}

const CNY_TO_RM = 0.65 // 1元 ≈ 0.65 RM (thô — chỉ để ước biên lời)

export function computeWinScore(c: SpCandidate): WinScore {
  if (c.tier === 'brand') {
    return { score: 0, tier: 'reject', risks: ['Brand bảo hộ — bán lậu bị gỡ/ban'], full: false }
  }
  const risks: string[] = []
  const d = c.deep
  let score = 0

  // Nhãn xưởng = nhập được nhưng cần xác nhận 1688. Biến thể cao = sai số/hoàn.
  if (c.tier === 'oem') risks.push('Nhãn xưởng — xác nhận 1688 nhập được')
  if (c.variantRisk === 'high') risks.push('Nhiều biến thể (thời trang/giày) — sai số + hoàn cao')

  // Cầu — số bán (0-28) — LUÔN tính.
  score += c.sale >= 100000 ? 28 : c.sale >= 50000 ? 22 : c.sale >= 10000 ? 15 : c.sale >= 3000 ? 8 : 3

  // Rủi ro nền (luôn tính). (Bỏ phạt "cross-border theo nơi ship" — sai bản chất;
  // nội địa/nhập-sẵn giờ xét theo NGÔN NGỮ NHÃN, không phạt điểm.)
  if (c.rating && c.rating > 0 && c.rating < 4.3) risks.push(`Rating ${c.rating.toFixed(1)} — coi chừng hoàn`)

  // ── FULL (sau Soi sâu): dùng số thật ads/1688/margin ──
  if (d) {
    // Video TikTok đẩy (0-14)
    score += d.maxViews >= 1e6 ? 14 : d.maxViews >= 1e5 ? 9 : d.videoCount >= 5 ? 5 : d.videoCount > 0 ? 2 : 0
    if (d.videoCount === 0) risks.push('Chưa thấy video TikTok đẩy')

    // ĐỐI THỦ COD đang ăn (0-30) — nặng nhất
    let ad = 0
    if (d.adCount > 0) ad += 8
    ad += (Math.min(d.adTopDays, 60) / 60) * 12 // chạy lâu = đã có lời
    ad += (Math.min(d.adTopScale, 10) / 10) * 10 // advertiser nhiều ad = đang scale
    score += Math.round(ad)
    if (d.adCount === 0) risks.push('Không thấy đối thủ chạy ads COD — cầu paid chưa chứng minh')
    if (d.exactChecked && (d.exactCount ?? 0) < 5) risks.push(`Đối thủ COD ít (${d.exactCount ?? 0} ad đúng SP, cần ≥5)`)

    // Sourceable 1688 (0-12)
    if (d.on1688) score += 12
    else risks.push('Không khớp ảnh trên 1688 — nguồn chưa chủ động')

    // Biên lời ước tính (0-16)
    if (c.price > 0 && d.cost1688) {
      const costRM = parseFloat(d.cost1688) * CNY_TO_RM
      const marginPct = costRM > 0 ? (c.price - costRM) / c.price : 0
      score += marginPct >= 0.75 ? 16 : marginPct >= 0.6 ? 11 : marginPct >= 0.45 ? 6 : 0
      if (marginPct < 0.45) risks.push('Biên lời mỏng (ước tính) — dễ lỗ sau ads+hoàn')
    }

    const tier: WinScore['tier'] = score >= 70 ? 'strong' : score >= 50 ? 'good' : 'weak'
    return { score: Math.round(score), tier, risks, full: true }
  }

  // ── LITE (lúc quét, đã dò video): cầu + video đúng SP + author-match + đối thủ ngách ──
  if (c.vids) {
    const list = c.vids.list
    const tk = list.filter((v) => v.platform !== 'fb')
    const fb = list.filter((v) => v.platform === 'fb')
    const authorMatch = tk.some((v) => v.authorMatch)

    // Video ĐÚNG SP đang được đẩy (0-22): view cao nhất + số video
    score += c.vids.maxViews >= 1e6 ? 18 : c.vids.maxViews >= 1e5 ? 12 : tk.length >= 5 ? 8 : tk.length > 0 ? 4 : 0
    if (authorMatch) score += 4 // video của chính người bán = gần chắc ĐÚNG SP
    if (tk.length === 0) risks.push('Chưa thấy video TikTok bán SP (khó rip creative)')

    // Đối thủ cùng ngách chạy ads FB (0-8) — nhiệt ngách (niche-level, cùng ngách = như nhau)
    const maxFbDays = fb.reduce((m, v) => Math.max(m, v.days ?? 0), 0)
    score += fb.length >= 5 ? (maxFbDays >= 30 ? 8 : 5) : fb.length > 0 ? 2 : 0

    const tier: WinScore['tier'] = score >= 45 ? 'strong' : score >= 28 ? 'good' : 'weak'
    return { score: Math.round(score), tier, risks, full: false }
  }

  // ── Chưa dò video → sơ bộ (chỉ số bán) ──
  return { score: Math.round(score), tier: 'partial', risks, full: false }
}
