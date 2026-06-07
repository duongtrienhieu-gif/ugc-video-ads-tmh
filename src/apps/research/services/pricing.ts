// Research module — máy tính giá / CPA tối đa (logic đảo chiều).
// Given giá bán + % lợi nhuận mong muốn → CPA tối đa/đơn (VND).
// Tỷ giá fix 5500 (business intent). Khớp mô hình trong giáo án Google Sheet.

import type { ComboPricing, PricingInput } from './../types'
import { COMBO_MULTIPLIERS } from './../constants'

/**
 * Tính breakdown + CPA tối đa cho 1 SKU / combo 2 / combo 3.
 *   Giá bán = Vốn + Phí sàn + Affiliate + Vận hành + Lợi nhuận + Ads
 *   → Ads tối đa = Giá bán − tất cả phần còn lại
 */
export function computeCombos(input: PricingInput): ComboPricing[] {
  const {
    capitalVnd,
    sellingPriceMyr,
    feeRatePct,
    affiliateRatePct,
    opsRatePct,
    profitTargetPct,
    exchangeRate,
  } = input

  const capitalMyrUnit = exchangeRate > 0 ? capitalVnd / exchangeRate : 0

  return [1, 2, 3].map((n) => {
    const revenueMyr = sellingPriceMyr * (COMBO_MULTIPLIERS[n] ?? n)
    const capitalMyr = capitalMyrUnit * n
    const feeMyr = revenueMyr * feeRatePct
    const affiliateMyr = revenueMyr * affiliateRatePct
    const opsMyr = revenueMyr * opsRatePct
    const profitMyr = revenueMyr * profitTargetPct
    const cpaMaxMyr = revenueMyr - capitalMyr - feeMyr - affiliateMyr - opsMyr - profitMyr
    return {
      n,
      revenueMyr,
      capitalMyr,
      feeMyr,
      affiliateMyr,
      opsMyr,
      profitMyr,
      cpaMaxMyr,
      cpaMaxVnd: cpaMaxMyr * exchangeRate,
      profitVnd: profitMyr * exchangeRate,
      marginPct: profitTargetPct,
      ok: cpaMaxMyr > 0,
    }
  })
}

export function formatVnd(n: number): string {
  return Math.round(n).toLocaleString('vi-VN') + 'đ'
}

export function formatMyr(n: number): string {
  return 'RM' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
