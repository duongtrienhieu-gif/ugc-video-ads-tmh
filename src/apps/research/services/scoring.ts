// Research module — chấm điểm 8 tín hiệu → score 0-100 + verdict + lý do.
// Pure logic, không phụ thuộc UI/Supabase. Mọi ngưỡng đọc từ constants để dễ tune.

import type { ResearchProduct, ScoredProduct, SignalResult, Verdict } from './../types'
import { SIGNAL_WEIGHTS, VERDICT_THRESHOLDS } from './../constants'

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

function statusFromFrac(frac: number): SignalResult['status'] {
  if (frac >= 0.6) return 'pass'
  if (frac >= 0.3) return 'warn'
  return 'fail'
}

export function classifyVerdict(score: number, skuHigh: boolean): Verdict {
  if (skuHigh) return 'avoid'
  if (score >= VERDICT_THRESHOLDS.go) return 'go'
  if (score >= VERDICT_THRESHOLDS.consider) return 'consider'
  return 'avoid'
}

export function scoreProduct(p: ResearchProduct): ScoredProduct {
  const isMY = p.market === 'MY'
  const hotElsewhere = (p.hotIn ?? []).filter((m) => m !== p.market)

  // ── từng tín hiệu: frac 0..1 ──
  const fGrowth = clamp01(p.growthRate / 150)
  const fSaturation = clamp01((30 - p.competitionShops) / 30)
  const fPrice = clamp01((60 - p.unitPrice) / 50)
  const fCommission = clamp01((p.commissionRate - 5) / 20)
  const fRating = clamp01((p.rating - 3.5) / 1.5)
  const fCreators = clamp01(p.creatorNum / 15)
  const fVideo = (p.videoRevenue ?? 0) > 0 ? 1 : 0
  const fCross =
    isMY && hotElsewhere.length > 0
      ? clamp01((hotElsewhere.length / 2) * (p.competitionShops < 15 ? 1 : 0.5))
      : p.growthRate > 80
        ? 0.5
        : 0.2

  const W = SIGNAL_WEIGHTS
  const score = Math.round(
    fGrowth * W.growth +
      fSaturation * W.saturation +
      fPrice * W.price +
      fCommission * W.commission +
      fRating * W.rating +
      fCreators * W.creators +
      fVideo * W.videoAngle +
      fCross * W.crossMarket,
  )

  const signals: SignalResult[] = [
    {
      key: 'growth',
      label: '% Tăng trưởng',
      display: `${p.growthRate > 0 ? '+' : ''}${Math.round(p.growthRate)}%`,
      status: statusFromFrac(fGrowth),
      detail: p.growthRate >= 50 ? 'Đang tăng tốt' : p.growthRate >= 0 ? 'Tăng nhẹ' : 'Đang giảm — coi chừng đỉnh đã qua',
    },
    {
      key: 'saturation',
      label: 'Độ bão hòa',
      display: `${p.competitionShops} shop`,
      status: statusFromFrac(fSaturation),
      detail: p.competitionShops < 10 ? 'Ít shop bán — còn cửa vào' : p.competitionShops < 20 ? 'Cạnh tranh vừa' : 'Đông shop — đỏ máu',
    },
    {
      key: 'price',
      label: 'Giá bán',
      display: `RM${p.unitPrice}`,
      status: statusFromFrac(fPrice),
      detail: p.unitPrice <= 40 ? 'Hàng rẻ — hợp mô hình + dễ combo' : 'Giá hơi cao so với khẩu vị hàng rẻ',
    },
    {
      key: 'commission',
      label: 'Hoa hồng',
      display: `${Math.round(p.commissionRate)}%`,
      status: statusFromFrac(fCommission),
      detail: p.commissionRate >= 20 ? 'Đủ hút creator' : p.commissionRate >= 15 ? 'Tạm ổn, nên ≥20%' : 'Hơi thấp — creator ít mặn',
    },
    {
      key: 'rating',
      label: 'Đánh giá',
      display: `${p.rating.toFixed(1)}★`,
      status: statusFromFrac(fRating),
      detail: p.rating >= 4.5 ? 'Chất lượng ổn, ít rủi ro hoàn' : 'Rating thường — coi chừng hoàn',
    },
    {
      key: 'creators',
      label: 'Creator sẵn có',
      display: `${p.creatorNum}`,
      status: statusFromFrac(fCreators),
      detail: p.creatorNum > 0 ? 'Đã có creator đang đẩy — dễ tuyển' : 'Chưa có creator — phải tự tuyển từ đầu',
    },
    {
      key: 'video',
      label: 'Video đang đẩy',
      display: (p.videoRevenue ?? 0) > 0 ? 'Có' : 'Không',
      status: fVideo ? 'pass' : 'warn',
      detail: fVideo ? 'Có góc video thắng để bắt chước' : 'Chưa có video nổi bật',
    },
    {
      key: 'cross',
      label: 'Cross-market',
      display: hotElsewhere.length > 0 ? `Nổ ở ${hotElsewhere.join(', ')}` : '—',
      status: statusFromFrac(fCross),
      detail:
        isMY && hotElsewhere.length > 0
          ? `Đang nổ ở ${hotElsewhere.join('/')}, MY chưa nóng — cơ hội vào sớm`
          : 'Không có tín hiệu cross-market rõ',
    },
  ]

  const skuHigh = p.skuVarianceRisk === 'high'
  const verdict = classifyVerdict(score, skuHigh)

  // Lý do gọn cho thẻ: ưu tiên tín hiệu pass nổi bật + cảnh báo nếu có
  const reasons: string[] = []
  if (isMY && hotElsewhere.length > 0 && p.competitionShops < 15) {
    reasons.push(`Nổ ở ${hotElsewhere.join('/')}, MY mới ${p.competitionShops} shop`)
  }
  if (p.commissionRate >= 20) reasons.push(`Hoa hồng ${Math.round(p.commissionRate)}% · giá RM${p.unitPrice}`)
  else reasons.push(`Giá RM${p.unitPrice} · hoa hồng ${Math.round(p.commissionRate)}%`)
  if (p.creatorNum > 0) reasons.push(`${p.creatorNum} creator sẵn`)
  if (skuHigh) reasons.unshift('⚠ Ngách nhiều biến thể SKU — rủi ro tồn')
  if (p.growthRate < 0) reasons.unshift('⚠ Đang giảm tốc')

  return { ...p, score, verdict, signals, reasons: reasons.slice(0, 3) }
}

export function scoreMany(products: ResearchProduct[]): ScoredProduct[] {
  return products.map(scoreProduct)
}
