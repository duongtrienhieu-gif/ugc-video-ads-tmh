// ── Số THỰC TẾ per nhân sự — gộp từ dữ liệu per-SP (tái dùng endpoint kho + computeProfit) ──
import { computeProfit, type Prod, type InvItem } from '../inventory-board/profitCalc'

const RATE = 5800
export interface SpStat { dt: number; lai: number; cpqc: number; hoan: number }
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
  const profit: SpProfit[] = rows.map((row) => {
    laiPctByName[row.name.trim().toUpperCase()] = row.laiPct
    return { name: row.name, laiPct: row.laiPct, hoanPct: row.hoanPct, adsPct: row.adsPct, den: row.den.t }
  })
  const stats: Record<string, SpStat> = {}
  for (const p of products) {
    const key = p.name.trim().toUpperCase()
    const dt = p.rmRevenue * RATE
    stats[key] = { dt, lai: (laiPctByName[key] ?? 0) * dt, cpqc: p.pctCpqc, hoan: p.pctHoan }
  }
  return { stats, profit }
}

// Gộp các mã của 1 nhân sự → DT · lãi · %CPQC (weighted) · %hoàn (weighted)
export function aggregate(spCodes: string[], stats: Record<string, SpStat>): SpStat {
  let dt = 0, lai = 0, cpqcW = 0, hoanW = 0
  for (const code of spCodes) {
    const s = stats[code.trim().toUpperCase()]
    if (!s) continue
    dt += s.dt; lai += s.lai; cpqcW += s.cpqc * s.dt; hoanW += s.hoan * s.dt
  }
  return { dt, lai, cpqc: dt > 0 ? cpqcW / dt : 0, hoan: dt > 0 ? hoanW / dt : 0 }
}
