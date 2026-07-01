// ── Cơ chế lương TMH (T7/2026) — logic thuần, dùng cho tab Lương ────────────────
// Lương/người = Cứng(DT sau hoàn) + ( Thưởng_net_lũy_tiến ÷ 2 × Hệ_số_CPQC ).
// Net < 0 → sàn 8tr (không thưởng, không nhân hệ số). Hệ số CHỈ nhân thưởng, KHÔNG nhân cứng.
const TR = 1_000_000

export interface SalaryInput {
  dtSauHoan: number // VNĐ (visible, 5800)
  net: number       // VNĐ lợi nhuận net team (visible)
  cpqc: number      // tỉ lệ 0..1 (vd 0.31)
}
export interface SalaryOut {
  cung: number; pool: number; thuongNguoi: number; heSo: number; heLabel: string; luongNguoi: number; luongTeam: number
}

// ① Cứng / NGƯỜI theo DT team sau hoàn (flat, không lũy tiến). net < 0 → sàn 8tr.
export function cungNguoi(dtSauHoan: number, net: number): number {
  if (net < 0) return 8 * TR
  const d = dtSauHoan
  if (d < 500 * TR) return 8 * TR
  if (d < 1000 * TR) return 10 * TR
  if (d < 1500 * TR) return 12 * TR
  if (d < 2000 * TR) return 14 * TR
  if (d < 2500 * TR) return 16 * TR
  if (d < 3000 * TR) return 18 * TR
  return 20 * TR
}

// ② Thưởng pool (lũy tiến BIÊN trên net team): 10/15/20/25%.
export function thuongPool(net: number): number {
  if (net <= 0) return 0
  const n = net
  return 0.10 * Math.min(n, 20 * TR)
    + 0.15 * Math.max(0, Math.min(n, 50 * TR) - 20 * TR)
    + 0.20 * Math.max(0, Math.min(n, 100 * TR) - 50 * TR)
    + 0.25 * Math.max(0, n - 100 * TR)
}

// ③ Hệ số CPQC team (chỉ nhân THƯỞNG): <30→1.2 · 30-34→1.1 · 34-38→1.0 · >38→0.8.
export function heSoCpqc(cpqc: number): { he: number; label: string } {
  const c = cpqc * 100
  if (c < 30) return { he: 1.2, label: '×1.2' }
  if (c <= 34) return { he: 1.1, label: '×1.1' }
  if (c <= 38) return { he: 1.0, label: '×1.0' }
  return { he: 0.8, label: '×0.8' }
}

export function tinhLuong(inp: SalaryInput): SalaryOut {
  const cung = cungNguoi(inp.dtSauHoan, inp.net)
  const pool = thuongPool(inp.net)
  const { he, label } = heSoCpqc(inp.cpqc)
  const thuongNguoi = inp.net < 0 ? 0 : (pool / 2) * he
  const luongNguoi = cung + thuongNguoi
  return { cung, pool, thuongNguoi, heSo: he, heLabel: label, luongNguoi, luongTeam: luongNguoi * 2 }
}

// ── Lớp CEO ẩn (số THẬT) — chỉ CEO thấy ──────────────────────────────────────
// Nhân viên tính ở 5800 + CPVC 9%/CPVH 8% (thổi). Thật = 6500 + CPVC 7.5%/CPVH 7%.
// real net ≈ visible net + DT×(tỷ giá thật/visible − 1) + DT×(CPVC thổi−thật + CPVH thổi−thật).
export interface CeoCfg {
  tgVisible: number; tgReal: number
  cpvcThoi: number; cpvcThat: number; cpvhThoi: number; cpvhThat: number
  buffer: number; overhead: number
}
export const DEFAULT_CEO: CeoCfg = {
  tgVisible: 5800, tgReal: 6500,
  cpvcThoi: 0.09, cpvcThat: 0.075, cpvhThoi: 0.08, cpvhThat: 0.07,
  buffer: 0.12, overhead: 250 * TR,
}

export function realRevenue(dtVisible: number, cfg: CeoCfg = DEFAULT_CEO): number {
  return dtVisible * (cfg.tgReal / cfg.tgVisible)
}
export function realNet(dtVisible: number, netVisible: number, cfg: CeoCfg = DEFAULT_CEO): number {
  const tyGiaUplift = dtVisible * (cfg.tgReal / cfg.tgVisible - 1)
  const costSave = dtVisible * ((cfg.cpvcThoi - cfg.cpvcThat) + (cfg.cpvhThoi - cfg.cpvhThat))
  return netVisible + tyGiaUplift + costSave
}
