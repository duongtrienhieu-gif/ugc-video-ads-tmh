// ── ENGINE THƯỞNG & CẤP NHẬP — winner · cấp-độ-nhập · bounty xả tồn chết ───────
// Đối chiếu KHO (tồn + vốn) × DOANH THU mỗi mã (file TỔNG) để biết:
//  · ĐANG CHẠY = DT ≥ 10tr → không động.    · TỒN CHẾT = còn tồn nhưng DT < 10tr → treo bounty.
// Cấp nhập theo ĐƠN SAU HOÀN + cấu trúc dương. Winner (Cấp 2) = ≥500 đơn sau hoàn + cấu trúc dương.
// Tái dùng computeProfit (đã verify) — KHÔNG đụng verdict.ts. Tất cả là ĐỀ XUẤT, người chốt.
import { computeProfit, TY_GIA, SHIP, VH } from './profitCalc'
import type { Prod, InvItem } from './profitCalc'
import { isComboName } from './verdict'

export const RUNNING_DT = 10_000_000  // ≥10tr doanh thu = đang chạy (không tính tồn chết)
export const TIER1_ORDERS = 100       // ≥100 đơn sau hoàn = nhập đều
export const WINNER_ORDERS = 500      // ≥500 đơn sau hoàn + cấu trúc dương = winner
export const BOUNTY_PCT = 0.08        // bounty xả tồn chết = 8% vốn kẹt (chia MKT + Sale)
export const WINNER_BONUS = 4_000_000 // thưởng winner = 4tr / team (chỉ 1 lần, tháng lần đầu đạt)

export interface SkuLevel {
  name: string
  doanhThu: number      // VNĐ (rmRevenue ×5800)
  donSauHoan: number    // c2 × (1 − %hoàn)
  laiStruct: number     // cấu trúc = 1 − ads − vốn − ship − VH (bỏ hoàn ra)
  giaReal: boolean      // có giá vốn thật chưa (chưa → cấu trúc không chắc → Cấp 0)
  running: boolean      // DT ≥ 10tr
  tier: 0 | 1 | 2
  winner: boolean
  teams: string[]       // team sở hữu mã (từ marketerSp), rỗng nếu chưa rõ
}
export interface DeadStock {
  name: string
  ton: number
  vonKet: number        // ton × giá vốn / đơn vị (VNĐ)
  doanhThu: number      // DT mã đó tháng này (để thấy vì sao xếp tồn chết)
  bounty: number        // 8% × vốn kẹt
}
export interface IncentiveResult {
  levels: SkuLevel[]    // toàn bộ mã có đơn, xếp theo cấp giảm dần
  winners: SkuLevel[]
  dead: DeadStock[]
  totalVonKet: number
  totalBounty: number
}

// Mã → các team đang chạy nó (marketerSp keyed theo team APEX/TITAN/SUMMIT → [mã]).
function teamsOf(name: string, teamSp: Record<string, string[]>): string[] {
  const k = name.trim().toUpperCase()
  const out: string[] = []
  for (const [team, codes] of Object.entries(teamSp)) {
    if (codes.some((c) => c.trim().toUpperCase() === k)) out.push(team)
  }
  return out
}

export function computeIncentives(
  products: Prod[],
  inv: InvItem[],
  velocity: Record<string, number>,
  priceVnd: Record<string, number>,
  teamSp: Record<string, string[]> = {},
): IncentiveResult {
  const base = products.filter((p) => !isComboName(p.name))
  const rows = computeProfit(base, inv, velocity, priceVnd)
  const prodMap = new Map(base.map((p) => [p.name.trim().toUpperCase(), p]))

  const levels: SkuLevel[] = rows.map((r) => {
    const k = r.name.trim().toUpperCase()
    const p = prodMap.get(k)
    const doanhThu = (p?.rmRevenue ?? 0) * TY_GIA
    const donSauHoan = Math.round((p?.c2 ?? 0) * (1 - r.hoanPct))
    const laiStruct = 1 - r.adsPct - r.cogsPct - SHIP - VH
    const structOk = laiStruct > 0 && r.giaReal // cấu trúc dương + có giá vốn thật
    let tier: 0 | 1 | 2 = 0
    if (donSauHoan >= WINNER_ORDERS && structOk) tier = 2
    else if (donSauHoan >= TIER1_ORDERS && structOk) tier = 1
    const winner = tier === 2
    return {
      name: r.name, doanhThu, donSauHoan, laiStruct, giaReal: r.giaReal,
      running: doanhThu >= RUNNING_DT, tier, winner,
      teams: winner ? teamsOf(r.name, teamSp) : [],
    }
  })
  levels.sort((a, b) => b.tier - a.tier || b.donSauHoan - a.donSauHoan)
  const winners = levels.filter((l) => l.winner)

  // Tồn chết = mã KHO còn tồn nhưng DT < 10tr (không nằm trong nhóm đang chạy).
  const dtByName = new Map(levels.map((l) => [l.name.trim().toUpperCase(), l.doanhThu]))
  const dead: DeadStock[] = []
  for (const it of inv) {
    if (isComboName(it.ten) || it.ton <= 0) continue
    const doanhThu = dtByName.get(it.ten.trim().toUpperCase()) ?? 0
    if (doanhThu >= RUNNING_DT) continue // đang chạy → không phải tồn chết
    const giaVon = it.giaVonVnd > 0 ? it.giaVonVnd : it.giaVonRM * TY_GIA
    const vonKet = it.ton * giaVon
    if (vonKet <= 0) continue // chưa có giá vốn → không tính được bounty
    dead.push({ name: it.ten, ton: it.ton, vonKet, doanhThu, bounty: vonKet * BOUNTY_PCT })
  }
  dead.sort((a, b) => b.vonKet - a.vonKet)
  const totalVonKet = dead.reduce((s, d) => s + d.vonKet, 0)
  return { levels, winners, dead, totalVonKet, totalBounty: totalVonKet * BOUNTY_PCT }
}
