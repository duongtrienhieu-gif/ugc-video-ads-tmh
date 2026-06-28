// ── ENGINE: tự đề xuất kế hoạch QUÀ + COMBO cho từng SP ──────────────────────
// Lấy hàng tồn chết CÙNG NGÁCH làm quà chéo → thoát kho + upsell + đẩy lãi.
// Vốn quà = theo BẬC giá vốn của chính nó (user chốt); vốn SP chính = thật; tỷ giá 5800.
// Trả `tone` (không hex) để UI map màu. Tier mặc định = thang Mốc như sheet 5.
export const RATE = 5800, SHIP = 0.09, VH = 0.08, LN_TARGET = 0.10
const GIFT_ROLES = new Set(['CỨU', 'QUÀ', 'NGỦ']) // hàng cần thoát (không lấy SCALE làm quà)
// Vốn quà tính theo giá vốn/sp của quà: 0-20k→10k · 21-30k→12k · 31-40k→15k · 41-50k→20k · >50k→25k
export function giftCostOf(vonSp: number): number {
  const k = vonSp / 1000
  if (k <= 20) return 10000
  if (k <= 30) return 12000
  if (k <= 40) return 15000
  if (k <= 50) return 20000
  return 25000
}

export interface GiftMaster { name: string; vaiTro: string; ngach: string; ton: number; vonSp: number }
export interface GiftCat { ngach: string; maChinh: string; quaCheo: string; vonQua: number; tonQua: number; marketer: string }
export interface Live { hoanPct: number; adsPct: number; vonReal: number; chotPct: number }
export type Tone = 'red' | 'amber' | 'green' | 'muted'

export interface Tier { loai: string; mua: number; tangChinh: number; quaCheo: number; pctDon: number; giaRM: number }
export const DEFAULT_TIERS: Tier[] = [
  { loai: 'Lẻ / 1 tặng 1', mua: 1, tangChinh: 1, quaCheo: 0, pctDon: 0.50, giaRM: 59 },
  { loai: '2 mua + 1 quà', mua: 2, tangChinh: 0, quaCheo: 1, pctDon: 0.30, giaRM: 89 },
  { loai: '3 mua + 2 quà', mua: 3, tangChinh: 0, quaCheo: 2, pctDon: 0.15, giaRM: 119 },
  { loai: '4 mua + 3 quà', mua: 4, tangChinh: 0, quaCheo: 3, pctDon: 0.05, giaRM: 149 },
]
export const cloneTiers = () => DEFAULT_TIERS.map((t) => ({ ...t }))

export interface GiftOption { name: string; ton: number; vonKet: number; vonSp: number; stuck: boolean; sameNiche: boolean; ngach: string }
// quà ứng viên = TẤT CẢ hàng còn tồn; ưu tiên CÙNG NGÁCH + hàng cần thoát (vốn kẹt cao) lên đầu
export function giftOptions(ngach: string, master: GiftMaster[], excludeUpper: string): GiftOption[] {
  const rank = (o: { sameNiche: boolean; stuck: boolean }) => (o.sameNiche ? 0 : 2) + (o.stuck ? 0 : 1)
  return master
    .filter((m) => m.name.trim().toUpperCase() !== excludeUpper && m.ton > 0)
    .map((m) => ({ name: m.name, ton: m.ton, vonKet: m.ton * m.vonSp, vonSp: m.vonSp, stuck: GIFT_ROLES.has(m.vaiTro.toUpperCase()), sameNiche: m.ngach === ngach, ngach: m.ngach }))
    .sort((a, b) => rank(a) - rank(b) || b.vonKet - a.vonKet)
}

export interface TierCalc extends Tier { aov: number; vonGiao: number; laiDon: number; laiPct: number }
export interface Plan {
  main: string; ngach: string; marketer: string
  hoan: number; ads: number; vonChinh: number; mainTon: number
  gift: GiftOption | null
  options: GiftOption[]
  tiers: TierCalc[]
  aovW: number; laiDonW: number; laiPctW: number; cpqcTarget: number; cpaTarget: number; chot: number
  quaTB: number; chinhTB: number; soDonMaxQua: number; soDonMaxChinh: number; soDonMax: number
  den: { t: string; tone: Tone }
}

function den(laiPct: number, hoan: number, ads: number, target: number): { t: string; tone: Tone } {
  if (laiPct < 0 || hoan > 0.45) return { t: 'Cắt', tone: 'red' }
  if (ads > target + 1e-9 || hoan > 0.30) return { t: 'Sửa', tone: 'amber' }
  if (laiPct > 0 && hoan < 0.25 && ads < target * 0.85) return { t: 'Scale', tone: 'green' }
  return { t: 'Giữ', tone: 'muted' }
}

// Tính kế hoạch 1 SP. giftName = quà đang chọn (mặc định = ứng viên #1). tiers = thang Mốc (sửa được).
export function computePlan(cat: GiftCat, master: GiftMaster[], live: Live | undefined, tiers: Tier[], giftName?: string): Plan {
  const upper = cat.maChinh.trim().toUpperCase()
  const mainM = master.find((m) => m.name.trim().toUpperCase() === upper)
  const hoan = live?.hoanPct && live.hoanPct > 0 ? live.hoanPct : 0.35 // hoàn=0 (QLHB chưa tải) → 0.35 thay vì phình target
  const ads = live?.adsPct && live.adsPct > 0 ? live.adsPct : 0.30
  const chot = live?.chotPct && live.chotPct > 0 ? live.chotPct : 0.7 // tỉ lệ chốt — để suy CPA/lead
  const vonChinh = mainM?.vonSp || live?.vonReal || 0
  const mainTon = mainM?.ton ?? 0
  const options = giftOptions(cat.ngach, master, upper)
  const gift = (giftName ? options.find((o) => o.name === giftName) : null) || options[0] || null
  const giftCost = gift ? giftCostOf(gift.vonSp) : 10000 // vốn quà theo bậc giá vốn của quà

  const tc: TierCalc[] = tiers.map((t) => {
    const aov = t.giaRM * RATE
    const spChinh = t.mua + t.tangChinh
    const vonGiao = vonChinh * spChinh + giftCost * t.quaCheo
    const adsDon = ads * aov
    const vonNet = vonGiao * (1 - hoan)
    const laiDon = aov - adsDon - vonNet - SHIP * aov - VH * aov - hoan * aov
    return { ...t, aov, vonGiao, laiDon, laiPct: aov > 0 ? laiDon / aov : 0 }
  })
  const sumP = tc.reduce((s, t) => s + t.pctDon, 0) || 1
  const aovW = tc.reduce((s, t) => s + t.pctDon * t.aov, 0) / sumP
  const laiDonW = tc.reduce((s, t) => s + t.pctDon * t.laiDon, 0) / sumP
  const vonNetW = tc.reduce((s, t) => s + t.pctDon * t.vonGiao * (1 - hoan), 0) / sumP
  const laiPctW = aovW > 0 ? laiDonW / aovW : 0
  const cpqcTarget = 1 - LN_TARGET - (aovW > 0 ? vonNetW / aovW : 0) - SHIP - VH - hoan
  // CPA/lead mục tiêu = (ads/đơn chốt tối đa) × tỉ lệ chốt = %CPQC ngưỡng × AOV × chốt%
  const cpaTarget = Math.max(0, cpqcTarget) * aovW * chot
  const quaTB = tc.reduce((s, t) => s + t.pctDon * t.quaCheo, 0) / sumP
  const chinhTB = tc.reduce((s, t) => s + t.pctDon * (t.mua + t.tangChinh), 0) / sumP
  const soDonMaxQua = gift && quaTB > 0 ? Math.max(0, Math.floor(gift.ton / quaTB)) : Infinity
  const soDonMaxChinh = chinhTB > 0 ? Math.max(0, Math.floor(mainTon / chinhTB)) : Infinity // tồn chính ≤ 0 (nợ) → 0 đơn
  const soDonMax = Math.min(soDonMaxQua, soDonMaxChinh)

  return {
    main: cat.maChinh, ngach: cat.ngach, marketer: cat.marketer || '—',
    hoan, ads, vonChinh, mainTon, gift, options, tiers: tc,
    aovW, laiDonW, laiPctW, cpqcTarget, cpaTarget, chot, quaTB, chinhTB, soDonMaxQua, soDonMaxChinh, soDonMax,
    den: den(laiPctW, hoan, ads, cpqcTarget),
  }
}
