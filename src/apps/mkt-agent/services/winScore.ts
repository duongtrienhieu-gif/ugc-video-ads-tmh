// ── MKT Agent · Điểm WIN (deterministic) ─────────────────────────────────────
// Chấm SP theo mô hình COD MY: generic + sourceable 1688 + cầu + ĐỐI THỦ ĐANG
// SCALE ADS (proof có lời, nặng nhất) + biên lời + rủi ro hoàn thấp.
// Đầy đủ chỉ sau khi Soi sâu (ads/video/1688). Trước đó = 'partial' (chỉ số bán).
import type { SpCandidate } from '../store'

export interface WinScore {
  score: number
  tier: 'strong' | 'good' | 'weak' | 'reject' | 'partial'
  risks: string[]
  full: boolean
}

const CNY_TO_RM = 0.65 // 1元 ≈ 0.65 RM (thô — chỉ để ước biên lời)

export function computeWinScore(c: SpCandidate): WinScore {
  if (c.isBranded === true) {
    return { score: 0, tier: 'reject', risks: ['Branded — không clone-test được'], full: false }
  }
  const risks: string[] = []
  const d = c.deep
  let score = 0

  // Cầu — số bán (0-28)
  score += c.sale >= 100000 ? 28 : c.sale >= 50000 ? 22 : c.sale >= 10000 ? 15 : c.sale >= 3000 ? 8 : 3

  // Rủi ro nền (luôn tính)
  if (c.shipFrom && !/MY|malaysia/i.test(c.shipFrom)) risks.push('Cross-border — hoàn cao hơn')
  if (c.rating && c.rating > 0 && c.rating < 4.3) risks.push(`Rating ${c.rating.toFixed(1)} — coi chừng hoàn`)

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
  }

  const tier: WinScore['tier'] = !d ? 'partial' : score >= 70 ? 'strong' : score >= 50 ? 'good' : 'weak'
  return { score: Math.round(score), tier, risks, full: !!d }
}
