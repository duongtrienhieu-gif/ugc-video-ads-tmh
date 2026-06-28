// ── Lõi tính LÃI THẬT từng SP — dùng chung cho tab "Lãi thật/SP" + feed việc gấp ─
// Công thức khớp máy tính giá: lãi% = 1 − ads% − vốn(trừ hoàn)% − ship − VH − hoàn%.
// Tỷ giá 5800 CỐ ĐỊNH (app cho nhân viên — doanh thu ×5800; dashboard là chuyện riêng).
export const TY_GIA = 5800
export const SHIP = 0.09, VH = 0.08, LN_TARGET = 0.10
export const PACK_FACTOR = (name: string) => (name.trim().toUpperCase() === 'KNEE PAD' ? 2 : 1)
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export type Tone = 'red' | 'amber' | 'green' | 'muted'
export interface Prod { name: string; rmRevenue: number; cpqc: number; pctCpqc: number; pctHoan: number; c2: number }
export interface InvItem { ten: string; ton: number; ban: number; giaVonRM: number; giaVonVnd: number }
export interface ProfitRow {
  name: string; aov: number; adsPct: number; cogsPct: number; vonNetPct: number; hoanPct: number
  laiPct: number; laiDon: number; laiNgay: number; cpqcTarget: number
  den: { t: string; tone: Tone; rank: number }; viec: string; giaReal: boolean
}

function denOf(laiPct: number, hoanPct: number, adsPct: number, target: number): { t: string; tone: Tone; rank: number } {
  if (laiPct < 0 || hoanPct > 0.45) return { t: 'Cắt', tone: 'red', rank: 0 }
  if (adsPct > target + 1e-9 || hoanPct > 0.30) return { t: 'Sửa', tone: 'amber', rank: 1 }
  if (laiPct > 0 && hoanPct < 0.25 && adsPct < target * 0.85) return { t: 'Scale', tone: 'green', rank: 2 }
  return { t: 'Giữ', tone: 'muted', rank: 3 }
}
function viecOf(den: string, hoanPct: number, adsPct: number, target: number): string {
  const pct = (n: number) => (n * 100).toFixed(1) + '%'
  if (den === 'Cắt') return hoanPct > 0.45 ? `Hoàn ${pct(hoanPct)} — cắt / ép cọc` : 'Lỗ — cắt hoặc sửa giá/combo'
  if (den === 'Sửa') return adsPct > target ? `Ads ${pct(adsPct)} > ngưỡng ${pct(target)} — ghìm ads` : `Hoàn ${pct(hoanPct)} cao — chặn tỉnh bom`
  if (den === 'Scale') return 'Lãi tốt, còn dư địa — đẩy ads'
  return 'Ổn định — giữ nhịp'
}

export function computeProfit(products: Prod[], inv: InvItem[], velocity: Record<string, number>, priceVnd: Record<string, number>): ProfitRow[] {
  const invMap = new Map(inv.map((it) => [it.ten.trim().toUpperCase(), it]))
  const days = new Date().getDate() || 24
  const out: ProfitRow[] = []
  for (const p of products) {
    const key = p.name.trim().toUpperCase()
    const c2 = p.c2
    if (c2 <= 0 || p.rmRevenue <= 0) continue
    const it = invMap.get(key)
    const aov = (p.rmRevenue * TY_GIA) / c2
    const giaThucTe = (priceVnd[key] ?? 0) / PACK_FACTOR(key)
    const giaKhoRM = it?.giaVonRM ?? 0
    const giaVonUnit = giaThucTe > 0 ? giaThucTe : giaKhoRM > 0 ? giaKhoRM * TY_GIA : 0
    const giaReal = giaVonUnit > 0
    const dtTotal = p.rmRevenue * TY_GIA
    const cogsTotal = giaVonUnit * (it?.ban ?? 0)
    let cogsPct = dtTotal > 0 && cogsTotal > 0 ? cogsTotal / dtTotal : 0
    cogsPct = giaReal ? clamp(cogsPct, 0.03, 0.6) : 0.25 // ước 25% nếu chưa có giá thật
    const adsPct = p.pctCpqc
    const hoanPct = p.pctHoan
    const vonNetPct = cogsPct * (1 - hoanPct)
    const laiPct = 1 - adsPct - vonNetPct - SHIP - VH - hoanPct
    const laiDon = laiPct * aov
    const vel = velocity[key] ?? c2 / days
    const laiNgay = laiDon * vel
    const cpqcTarget = 1 - LN_TARGET - vonNetPct - SHIP - VH - hoanPct
    const den = denOf(laiPct, hoanPct, adsPct, cpqcTarget)
    out.push({ name: p.name, aov, adsPct, cogsPct, vonNetPct, hoanPct, laiPct, laiDon, laiNgay, cpqcTarget, den, viec: viecOf(den.t, hoanPct, adsPct, cpqcTarget), giaReal })
  }
  return out.sort((a, b) => a.den.rank - b.den.rank || Math.abs(b.laiNgay) - Math.abs(a.laiNgay))
}
