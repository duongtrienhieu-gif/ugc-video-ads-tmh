// ── Số THỰC TẾ per nhân sự — gộp từ dữ liệu per-SP (tái dùng endpoint kho + computeProfit) ──
import { computeProfit, type Prod, type InvItem } from '../inventory-board/profitCalc'
import { loadBoardLinks } from '../inventory-board/boardConfig'

const RATE = 5800 // ĐỒNG BỘ với profitCalc.TY_GIA — app nhân viên luôn ×5800, KHÔNG 6500
export interface SpStat { dt: number; lai: number; cpqc: number; hoan: number; aov: number; chot: number }
export interface SpProfit { name: string; laiPct: number; hoanPct: number; adsPct: number; den: string }

interface BoardResp {
  products?: Prod[]; inv?: InvItem[]; velocity?: Record<string, number>; priceVnd?: Record<string, number>
}

// Cache "số tốt gần nhất" trên máy: nếu lần load sau bị Google chặn (hoàn/aov rớt),
// vẫn hiện số cũ thay vì để trống — nhân viên/CEO luôn có gì đó để theo dõi.
const CACHE_KEY = 'war_spstats_v1'
export interface SpStatsResult { stats: Record<string, SpStat>; profit: SpProfit[]; stale: boolean; at: number }
// "Tốt" = có sản phẩm + có ÍT NHẤT 1 mã ra %hoàn (QLHB tải được) + 1 mã ra AOV (SALE tải được)
function isGood(stats: Record<string, SpStat>, profit: SpProfit[]): boolean {
  if (!profit.length) return false
  const v = Object.values(stats)
  return v.some((s) => s.hoan > 0) && v.some((s) => s.aov > 0)
}

// Tải 1 lần số kho → map theo TÊN SP (UPPER): doanh thu · lãi · %CPQC · %hoàn · AOV · chốt + bảng đèn
export async function fetchSpStats(): Promise<SpStatsResult> {
  let products: Prod[] = [], inv: InvItem[] = [], velocity: Record<string, number> = {}, priceVnd: Record<string, number> = {}
  let hoanMap: Record<string, number> = {}
  // Đọc link DÙNG CHUNG (board_config Supabase) để War Room theo đúng file tháng đang dán — giống
  // app Kho. Trước đây gửi links rỗng → bám default cứng → tháng mới đổi link mà War Room không theo.
  const links = (await loadBoardLinks()) ?? {}
  // Gọi SONG SONG: /api/inventory-board (5 file nhẹ) + /api/qlhb (file nặng, function riêng).
  const [boardR, qlhbR] = await Promise.allSettled([
    fetch('/api/inventory-board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ links }), cache: 'no-store' }).then((r) => r.json() as Promise<BoardResp>),
    fetch('/api/qlhb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ link: links.qlhb ?? '' }), cache: 'no-store' }).then((r) => r.json() as Promise<{ hoanMap?: Record<string, number> }>),
  ])
  if (boardR.status === 'fulfilled') { const j = boardR.value; products = j.products ?? []; inv = j.inv ?? []; velocity = j.velocity ?? {}; priceVnd = j.priceVnd ?? {} }
  if (qlhbR.status === 'fulfilled') hoanMap = qlhbR.value.hoanMap ?? {}
  // Đè %hoàn từ QLHB vào products TRƯỚC khi tính lãi (computeProfit dùng pctHoan).
  for (const p of products) { const h = hoanMap[p.name.trim().toUpperCase()]; if (h != null) p.pctHoan = h }

  const rows = computeProfit(products, inv, velocity, priceVnd)
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

  if (isGood(stats, profit)) {
    const fresh: SpStatsResult = { stats, profit, stale: false, at: Date.now() }
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ stats, profit, at: fresh.at })) } catch { /* quota */ }
    return fresh
  }
  // Load này thiếu (Google chặn) → dùng số tốt đã cache nếu có
  try {
    const c = localStorage.getItem(CACHE_KEY)
    if (c) {
      const cached = JSON.parse(c) as { stats: Record<string, SpStat>; profit: SpProfit[]; at: number }
      if (cached.profit?.length) return { stats: cached.stats, profit: cached.profit, stale: true, at: cached.at }
    }
  } catch { /* parse lỗi */ }
  return { stats, profit, stale: false, at: Date.now() } // chưa từng có cache → trả số hiện có (có thể thiếu)
}

// Đọc NGAY cache trên máy (đồng bộ) — để F5/mở lại hiện số liền, khỏi chờ ~1 phút tải Google.
export function readCachedSpStats(): SpStatsResult | null {
  try {
    const c = localStorage.getItem(CACHE_KEY)
    if (c) { const cached = JSON.parse(c) as { stats: Record<string, SpStat>; profit: SpProfit[]; at: number }; if (cached.profit?.length) return { stats: cached.stats, profit: cached.profit, stale: true, at: cached.at } }
  } catch { /* ignore */ }
  return null
}

// Map TEAM → ĐẦY ĐỦ mã SP team chạy (đọc 3 file team APEX/TITAN/SUMMIT, sheet BÁO CÁO SẢN PHẨM).
// Key = token team (APEX/TITAN/SUMMIT); spForMember map người→team rồi khớp. Truyền link team
// từ board_config (Supabase) để đọc đúng file tháng đang dán; lỗi → backend dùng default tháng.
export async function fetchMarketerSp(): Promise<Record<string, string[]>> {
  const links = (await loadBoardLinks()) ?? {}
  const r = await fetch('/api/inventory-board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ marketerSp: true, links }), cache: 'no-store' })
  const j = (await r.json()) as { marketerSp?: Record<string, string[]> }
  return j.marketerSp ?? {}
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
