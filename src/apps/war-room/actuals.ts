// ── Số THỰC TẾ per nhân sự — gộp từ dữ liệu per-SP (tái dùng endpoint kho + computeProfit) ──
import { computeProfit, type Prod, type InvItem } from '../inventory-board/profitCalc'

const RATE = 5800 // ĐỒNG BỘ với profitCalc.TY_GIA — app nhân viên luôn ×5800, KHÔNG 6500
export interface SpStat { dt: number; lai: number; cpqc: number; hoan: number; aov: number; chot: number }
export interface SpProfit { name: string; laiPct: number; hoanPct: number; adsPct: number; den: string }

interface BoardResp {
  products?: Prod[]; inv?: InvItem[]; velocity?: Record<string, number>; priceVnd?: Record<string, number>
}

// Tải 1 lần số kho → map theo TÊN SP (UPPER): doanh thu · lãi · %CPQC · %hoàn + bảng đèn
export async function fetchSpStats(): Promise<{ stats: Record<string, SpStat>; profit: SpProfit[] }> {
  const r = await fetch('/api/inventory-board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ links: {} }), cache: 'no-store' })
  const j = (await r.json()) as BoardResp
  const products = j.products ?? []
  const rows = computeProfit(products, j.inv ?? [], j.velocity ?? {}, j.priceVnd ?? {})
  const laiPctByName: Record<string, number> = {}
  const aovByName: Record<string, number> = {}
  const profit: SpProfit[] = rows.map((row) => {
    const k = row.name.trim().toUpperCase()
    laiPctByName[k] = row.laiPct
    aovByName[k] = row.aov // AOV (VND) = doanh thu/đơn chốt, đã ×5800 trong computeProfit
    return { name: row.name, laiPct: row.laiPct, hoanPct: row.hoanPct, adsPct: row.adsPct, den: row.den.t }
  })
  const stats: Record<string, SpStat> = {}
  for (const p of products) {
    const key = p.name.trim().toUpperCase()
    const dt = p.rmRevenue * RATE
    stats[key] = { dt, lai: (laiPctByName[key] ?? 0) * dt, cpqc: p.pctCpqc, hoan: p.pctHoan, aov: aovByName[key] ?? 0, chot: p.pctChot }
  }
  return { stats, profit }
}

// Map marketer → các mã SP họ phụ trách (từ file Ghép quà sheet 4 cột marketer) → để TỰ GÁN
export async function fetchMarketerSp(): Promise<Record<string, string[]>> {
  const r = await fetch('/api/inventory-board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ giftOnly: true }), cache: 'no-store' })
  const j = (await r.json()) as { giftCatalog?: { maChinh: string; marketer: string }[] }
  const map: Record<string, string[]> = {}
  for (const c of j.giftCatalog ?? []) {
    if (!c.marketer || !c.maChinh) continue
    const k = c.marketer.trim().toUpperCase()
    ;(map[k] ??= [])
    if (!map[k].includes(c.maChinh)) map[k].push(c.maChinh)
  }
  return map
}

// Gộp các mã của 1 nhân sự → DT · lãi · %CPQC · %hoàn · AOV · %chốt (đều weighted theo DT)
export function aggregate(spCodes: string[], stats: Record<string, SpStat>): SpStat {
  let dt = 0, lai = 0, cpqcW = 0, hoanW = 0, aovW = 0, chotW = 0
  for (const code of spCodes) {
    const s = stats[code.trim().toUpperCase()]
    if (!s) continue
    dt += s.dt; lai += s.lai
    cpqcW += s.cpqc * s.dt; hoanW += s.hoan * s.dt; aovW += s.aov * s.dt; chotW += s.chot * s.dt
  }
  const w = dt > 0 ? dt : 1
  return { dt, lai, cpqc: cpqcW / w, hoan: hoanW / w, aov: aovW / w, chot: chotW / w }
}
