// ── MÔ HÌNH P&L (port nguyên văn từ bao-cao-cty/lib/model.ts) ────────────────
// Tỷ giá CHỈ nhân vào doanh thu. Hoàn "Cách A" (bỏ Pending). CPVC/CPVH = % × DT gửi (gốc BOOK_RATE).
export interface Inputs {
  tyGia: number   // VNĐ / RM  (mặc định 6500)
  cpvcPct: number // 0..1      (mặc định 0.07)
  cpvhPct: number // 0..1      (mặc định 0.08)
}

export const DEFAULT_INPUTS: Inputs = { tyGia: 6500, cpvcPct: 0.07, cpvhPct: 0.08 }
export const BOOK_RATE = 5800 // tỷ giá GỐC trong file (tính lương + gốc chi phí VNĐ cố định)

/** Số liệu gốc 1 thực thể (1 SP / 1 MKT / toàn công ty). */
export interface RawEntity {
  name: string
  rmRevenue: number
  returnDS?: number
  returnedDS?: number
  pendingDS?: number
  totalDS?: number
  hoanRateOverride?: number
  cogs: number
  cpqc: number
  luong: number
  contact?: number
  c2?: number
}

export interface PnL {
  name: string
  dtGuiVnd: number
  hoanRate: number
  hoanVnd: number
  dtSauHoan: number
  cogs: number
  cpqc: number
  cpvc: number
  cpvh: number
  luong: number
  tongChiPhi: number
  loiNhuan: number
  tySuat: number
  pctCpqc: number
}

/** Cách A: % hoàn = (đang hoàn + đã về kho) / (tổng − đang giao). */
export function hoanRateCachA(r: RawEntity): number {
  if (r.hoanRateOverride != null) return r.hoanRateOverride
  const total = r.totalDS ?? 0, pending = r.pendingDS ?? 0
  const resolved = total - pending
  if (resolved <= 0) return 0
  return ((r.returnDS ?? 0) + (r.returnedDS ?? 0)) / resolved
}

export function computePnL(r: RawEntity, inp: Inputs): PnL {
  const dtGuiVnd = r.rmRevenue * inp.tyGia
  const hoanRate = hoanRateCachA(r)
  const hoanVnd = dtGuiVnd * hoanRate
  const dtSauHoan = dtGuiVnd - hoanVnd
  const cogsAdj = (r.cogs * inp.tyGia) / BOOK_RATE
  const cpvc = r.rmRevenue * BOOK_RATE * inp.cpvcPct
  const cpvh = r.rmRevenue * BOOK_RATE * inp.cpvhPct
  const tongChiPhi = hoanVnd + cogsAdj + r.cpqc + cpvc + cpvh + r.luong
  const loiNhuan = dtGuiVnd - tongChiPhi
  return {
    name: r.name, dtGuiVnd, hoanRate, hoanVnd, dtSauHoan,
    cogs: cogsAdj, cpqc: r.cpqc, cpvc, cpvh, luong: r.luong,
    tongChiPhi, loiNhuan,
    tySuat: dtGuiVnd ? loiNhuan / dtGuiVnd : 0,
    pctCpqc: dtGuiVnd ? r.cpqc / dtGuiVnd : 0,
  }
}
