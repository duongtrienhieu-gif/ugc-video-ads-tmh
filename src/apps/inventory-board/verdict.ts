// ── ENGINE VERDICT — gộp LÃI THẬT × TỒN KHO × TREND thành 1 đề xuất / mã ────────
// Mỗi mã rơi vào đúng 1 việc: NHẬP/VÍT · CHỜ SỐ THẬT · SỬA/NỢ · CẮT THẬT.
// Điểm cốt lõi chống cắt nhầm đầu tháng: tách "lỗ THẬT" (cấu trúc @hoàn=0 vẫn âm)
// khỏi "lỗ vì hoàn ƯỚC TÍNH tháng trước" (cấu trúc dương, chỉ âm khi cộng hoàn T6).
// Verdict là ĐỀ XUẤT — người chốt. App không tự động tắt ads / đặt hàng.
import { computeProfit, SHIP, VH, TY_GIA, PACK_FACTOR } from './profitCalc'
import type { Prod, InvItem } from './profitCalc'

const LEAD = 8, SAFETY = 7, CYCLE = 30 // nhập TQ 8 ngày + đệm 7 + trữ 30
const ROP_DAYS = LEAD + SAFETY // điểm đặt lại tính theo số ngày này

export type VGroup = 'nhap' | 'cho' | 'suano' | 'cat'
export type VTone = 'green' | 'amber' | 'gray' | 'red'
export type TrendState = 'up' | 'flat' | 'tut' | 'gay'

export interface VerdictRow {
  name: string
  kind: string          // mã verdict (xa/cat/cho/sua/no/dangve/khoan/nhap/vit/du)
  group: VGroup
  tone: VTone
  label: string         // chữ trên pill
  noAction: boolean     // ĐỦ — không cần làm gì (display có thể thu gọn)
  // số quyết định
  laiDon: number; laiPct: number; laiStruct: number
  hoanPct: number; hoanEst: boolean
  adsPct: number; cpqcTarget: number
  // tồn / nhịp
  ton: number; effTon: number; spNo: number; donNo: number
  vel: number; v3: number; cover: number; rop: number; sapDut: boolean
  trend: TrendState; drop: number
  chayDat: boolean
  // hành động
  nhapQty: number; von: number; giaUnit: number; giaReal: boolean
  tranAds: number
  incQty: number; incEta: string; incLate: boolean
}

// Trend từ chuỗi NGÀY (cũ→mới). "Gãy" cần 2 tín hiệu cùng lúc (chống nhiễu COD cuối tuần):
// đơn tụt ≥30% so với TB tuần VÀ biên đang mỏng VÀ 2 ngày liên tiếp xuống. Tụt 1 ngày lẻ = bỏ qua.
function trendOf(v7: number, daily: number[] | undefined, bienMong: boolean): { state: TrendState; v3: number; drop: number } {
  const arr = (daily ?? []).filter((x) => typeof x === 'number')
  const n = arr.length
  const v3 = n >= 3 ? (arr[n - 1] + arr[n - 2] + arr[n - 3]) / 3 : n > 0 ? arr.reduce((s, x) => s + x, 0) / n : v7
  const drop = v7 > 0 ? 1 - v3 / v7 : 0
  const decline2 = n >= 3 && arr[n - 1] < arr[n - 2] && arr[n - 2] < arr[n - 3]
  let state: TrendState = 'flat'
  if (decline2 && drop >= 0.3 && bienMong) state = 'gay'
  else if (decline2 && drop >= 0.2) state = 'tut'
  else if (v7 > 0 && v3 > v7 * 1.15) state = 'up'
  return { state, v3, drop }
}

export function computeVerdicts(
  products: Prod[],
  inv: InvItem[],
  velocity: Record<string, number>,
  velDaily: Record<string, number[]>,
  priceVnd: Record<string, number>,
  incoming: { ma: string; qty: number; eta: string }[],
  backorder: Record<string, { donNo: number; spNo: number }>,
): VerdictRow[] {
  const profitRows = computeProfit(products, inv, velocity, priceVnd)
  const prodMap = new Map(products.map((p) => [p.name.trim().toUpperCase(), p]))
  const invMap = new Map(inv.map((it) => [it.ten.trim().toUpperCase(), it]))
  const days = new Date().getDate() || 24
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const etaDays = (iso: string) => { if (!iso) return 999; const d = new Date(iso + 'T00:00:00'); return Math.round((d.getTime() - today.getTime()) / 86400000) }
  const incMap = new Map<string, { qty: number; etaDays: number; eta: string }[]>()
  incoming.forEach((x) => { const k = x.ma.trim().toUpperCase(); const a = incMap.get(k) || []; a.push({ qty: x.qty * PACK_FACTOR(k), etaDays: etaDays(x.eta), eta: x.eta }); incMap.set(k, a) })

  const out: VerdictRow[] = []
  for (const pr of profitRows) {
    const key = pr.name.trim().toUpperCase()
    const p = prodMap.get(key)
    const it = invMap.get(key)
    const ton = it ? it.ton : 0
    const spNo = backorder[key]?.spNo ?? 0
    const donNo = backorder[key]?.donNo ?? 0
    const effTon = ton - spNo

    const vel = velocity[key] ?? (p && p.c2 > 0 ? p.c2 / days : 0)
    // lãi CẤU TRÚC = lãi nếu bỏ hoàn ra (chỉ ads + vốn + ship + vận hành) — toàn số tháng này thật
    const laiStruct = 1 - pr.adsPct - pr.cogsPct - SHIP - VH
    const bienMong = laiStruct < 0.05
    const adsBE = Math.max(0, 1 - pr.cogsPct - SHIP - VH) // ads hòa vốn cấu trúc
    const chayDat = adsBE > 0 && pr.adsPct >= 0.85 * adsBE

    const tr = trendOf(vel, velDaily[key], bienMong)
    const rop = vel * ROP_DAYS
    const cover = vel > 0 ? effTon / vel : effTon > 0 ? 999 : 0
    const sapDut = vel > 0 && effTon <= rop

    const incList = incMap.get(key) || []
    const incQty = incList.reduce((s, x) => s + x.qty, 0)
    const incEta = incList.length ? incList.slice().sort((a, b) => a.etaDays - b.etaDays)[0].eta : ''
    const incLate = incList.some((x) => x.etaDays < 0)

    const giaThucTe = (priceVnd[key] ?? 0) / PACK_FACTOR(key)
    const giaKhoRM = it?.giaVonRM ?? 0
    const giaReal = giaThucTe > 0 || giaKhoRM > 0
    const giaUnit = giaThucTe > 0 ? giaThucTe : giaKhoRM > 0 ? giaKhoRM * TY_GIA : 0
    // số nhập: khi đang tụt → tính theo tốc độ GẦN NHẤT (v3), không theo đỉnh tuần (v7)
    const planVel = (tr.state === 'tut' || tr.state === 'gay') ? tr.v3 : vel
    const nhapQtyRaw = Math.max(0, Math.round(planVel * (LEAD + CYCLE) - effTon - incQty))
    const tranAds = (effTon + incQty) / ROP_DAYS

    const structuralLoss = laiStruct < 0
    const lai = pr.laiPct
    let kind = 'du', group: VGroup = 'nhap', tone: VTone = 'green', label = 'ĐỦ', noAction = false
    let nhapQty = 0, von = 0

    if (vel < 0.1 && effTon > 0) {
      kind = 'xa'; group = 'cat'; tone = 'red'; label = 'XẢ — thanh lý lấy vốn'
    } else if (structuralLoss || (pr.hoanPct > 0.45 && !pr.hoanEstimated)) {
      kind = 'cat'; group = 'cat'; tone = 'red'
      label = tr.state === 'gay' ? 'CẮT — gãy' : structuralLoss ? 'CẮT — tắt ads ngay' : 'CẮT — bom hàng'
    } else if (pr.hoanEstimated && lai < 0.05) {
      kind = 'cho'; group = 'cho'; tone = 'gray'
      label = spNo > 0 ? 'CHỜ + NỢ — đặt bù' : laiStruct < 0.05 ? 'CHỜ — biên mỏng' : 'CHỜ SỐ THẬT'
    } else if (!pr.hoanEstimated && lai >= 0 && (pr.hoanPct > 0.3 || pr.adsPct > pr.cpqcTarget)) {
      kind = 'sua'; group = 'suano'; tone = 'amber'
      label = pr.adsPct > pr.cpqcTarget ? 'SỬA — ghìm ads' : 'SỬA — chặn tỉnh bom'
    } else if (sapDut) {
      group = 'nhap'
      // hàng đang về đã che đủ (nhập cần ≤ 0) → ĐỪNG đặt thêm, hàng về tự bù nợ
      if (incQty > 0 && nhapQtyRaw <= 0 && !incLate) {
        kind = 'dangve'; tone = 'amber'; label = spNo > 0 ? '📦 ĐANG VỀ — bù nợ khi về' : '📦 ĐANG VỀ — đừng đặt thêm'
      } else if (tr.state === 'tut' || tr.state === 'gay') {
        kind = 'khoan'; tone = 'amber'; label = 'KHOAN NHẬP — đơn tụt'; nhapQty = Math.round(nhapQtyRaw * 0.5)
      } else {
        kind = 'nhap'; tone = 'green'
        label = incLate ? '⚠ NHẬP — đơn về trễ' : spNo > 0 ? 'NHẬP + bù gấp' : 'NHẬP ĐỂ VÍT'
        nhapQty = nhapQtyRaw
      }
      von = nhapQty * giaUnit
    } else if (spNo > 0) {
      kind = 'no'; group = 'suano'; tone = 'amber'; label = 'NỢ HÀNG — đặt bù'
    } else if (lai > 0 && pr.hoanPct < 0.25 && pr.adsPct < pr.cpqcTarget * 0.85) {
      kind = 'vit'; group = 'nhap'; tone = 'green'; label = 'VÍT MẠNH'
    } else {
      kind = 'du'; group = 'nhap'; tone = 'green'; label = 'ĐỦ'; noAction = true
    }

    out.push({
      name: pr.name, kind, group, tone, label, noAction,
      laiDon: pr.laiDon, laiPct: lai, laiStruct, hoanPct: pr.hoanPct, hoanEst: pr.hoanEstimated,
      adsPct: pr.adsPct, cpqcTarget: pr.cpqcTarget,
      ton, effTon, spNo, donNo, vel, v3: tr.v3, cover, rop, sapDut, trend: tr.state, drop: tr.drop, chayDat,
      nhapQty, von, giaUnit, giaReal, tranAds, incQty, incEta, incLate,
    })
  }

  // xếp: cắt → chờ → sửa/nợ → nhập; trong nhóm theo độ cháy túi
  const rank: Record<VGroup, number> = { cat: 0, cho: 1, suano: 2, nhap: 3 }
  return out.sort((a, b) => rank[a.group] - rank[b.group] || Math.abs(b.laiDon * b.vel) - Math.abs(a.laiDon * a.vel))
}

// "Hoàn T7 đủ chín còn ~mấy ngày" — đơn đầu tháng qua cửa sổ hoàn (~lead về + giao + 10 ngày)
// thì %hoàn tháng này mới đáng tin. Mốc ~ngày 13. Chỉ để hiển thị ở nhóm CHỜ.
export const HOAN_MATURE_DAY = 13
export function hoanMatureDaysLeft(dayOfMonth = new Date().getDate()): number {
  return Math.max(0, HOAN_MATURE_DAY - dayOfMonth)
}
