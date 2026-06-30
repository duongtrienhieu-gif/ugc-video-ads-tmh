// ── GIẢ LẬP %CPQC trên nền số THẬT của 1 SP — đặt trong tab Máy tính giá ──────
// Chọn 1 SP đang bán → giá vốn/%hoàn/AOV tự nạp số thật, kéo %CPQC xem lãi/đơn đổi.
import { useEffect, useMemo, useState } from 'react'
import { computeProfit, SHIP, VH, LN_TARGET, type Prod, type InvItem } from './profitCalc'

const C = {
  panel: '#0c111c', panel2: '#0a0f19', line: '#1b2233',
  gold: '#f5c451', text: '#eef1f7', muted: '#74809a', muted2: '#aeb8cc',
  red: '#ff4d5e', amber: '#fbbf24', green: '#4ade80',
}
const fmtMoney = (n: number) => (n >= 0 ? '+' : '') + Math.round(n).toLocaleString('vi-VN') + 'đ'
const fmtPlain = (n: number) => Math.round(n).toLocaleString('vi-VN') + 'đ'
const fmtPct = (n: number) => (n * 100).toFixed(1) + '%'
const panelStyle: React.CSSProperties = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 20px', marginBottom: 14 }
const eyebrowStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, letterSpacing: 0.3, color: C.gold }

export default function ProfitSim({ products, inv, velocity, priceVnd }: {
  products: Prod[]; inv: InvItem[]; velocity: Record<string, number>; priceVnd: Record<string, number>
}) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const f = () => setIsMobile(window.innerWidth < 700)
    f(); window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])

  const rows = useMemo(() => computeProfit(products, inv, velocity, priceVnd), [products, inv, velocity, priceVnd])
  const [pick, setPick] = useState('')
  const sel = rows.find((r) => r.name === pick) || rows[0]
  const [adsSim, setAdsSim] = useState<number | null>(null)
  const simAds = adsSim ?? (sel ? sel.adsPct : 0)
  const simLaiPct = sel ? 1 - simAds - sel.vonNetPct - SHIP - VH - sel.hoanPct : 0
  const simLaiDon = sel ? simLaiPct * sel.aov : 0
  const simSt = simLaiPct < 0 ? { t: 'Lỗ — sửa', c: C.red } : sel && simAds > sel.cpqcTarget ? { t: 'Lãi, dưới mục tiêu', c: C.amber } : { t: 'Đạt mục tiêu', c: C.green }
  // CPA TRÊN CAMP (mỗi DATA) = %CPQC × AOV × tỉ lệ chốt. (%CPQC×AOV = chi phí/ĐƠN chốt; ×chốt% → về
  // chi phí/DATA vì 1 đơn = 1/chốt data). Tỉ lệ chốt lấy từ số thật của mã (pctChot trong products).
  const selChot = sel ? (products.find((p) => p.name === sel.name)?.pctChot ?? 0) : 0
  const cpaData = sel && selChot > 0 ? simAds * sel.aov * selChot : 0
  if (!sel) return null

  return (
    <div style={panelStyle}>
      <div style={eyebrowStyle}>🎛 GIẢ LẬP — kéo %CPQC trên nền số THẬT của 1 SP</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0 14px' }}>
        <select value={sel.name} onChange={(e) => { setPick(e.target.value); setAdsSim(null) }}
          style={{ background: C.panel2, border: `1px solid ${C.gold}`, color: C.gold, borderRadius: 8, padding: '9px 11px', fontSize: 14, minWidth: 200, fontWeight: 600 }}>
          {rows.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
        </select>
        <div style={{ flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: C.muted, whiteSpace: 'nowrap' }}>%CPQC</span>
          <input type="range" min={5} max={70} step={1} value={+(simAds * 100).toFixed(0)} onChange={(e) => setAdsSim(+e.target.value / 100)} style={{ flex: 1 }} />
          <span style={{ fontSize: 14, fontWeight: 600, minWidth: 52, textAlign: 'right', color: simAds > sel.cpqcTarget ? C.red : C.green }}>{fmtPct(simAds)}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        {[
          { l: 'Lãi thật / đơn', v: fmtMoney(simLaiDon), c: simLaiDon < 0 ? C.red : C.green },
          { l: '% Lợi nhuận', v: fmtPct(simLaiPct), c: simLaiPct < 0 ? C.red : C.green },
          { l: '%CPQC ngưỡng (đạt mục tiêu)', v: fmtPct(Math.max(0, sel.cpqcTarget)), c: C.gold },
          { l: 'CPA / data chia sale (trừ số trùng)', v: selChot > 0 ? fmtPlain(cpaData) : '—', c: C.gold },
          { l: 'Trạng thái', v: simSt.t, c: simSt.c },
        ].map((k) => (
          <div key={k.l} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '11px 13px', minWidth: 0 }}>
            <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.muted, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.l}</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
        {sel.hoanPct === 0 && <span style={{ color: C.red, fontWeight: 600 }}>⚠ %hoàn = 0 (QLHB chưa tải / file tháng mới chưa có số) → lãi đang ẢO, ĐỪNG tin tới khi có %hoàn. </span>}
        Giá vốn / %hoàn ({fmtPct(sel.hoanPct)}) / AOV ({fmtPlain(sel.aov)}/đơn) lấy từ số THẬT của mã; chỉ kéo %CPQC để thấy lãi/đơn đổi. Hạ %CPQC xuống dưới ngưỡng {fmtPct(Math.max(0, sel.cpqcTarget))} là đạt lãi mục tiêu {fmtPct(LN_TARGET)}.
        {' '}<b style={{ color: C.muted2 }}>CPA / data chia sale (trừ số trùng)</b> = %CPQC × AOV × tỉ lệ chốt{selChot > 0 ? ` (${fmtPct(selChot)})` : ''} = chi phí ÷ data sale thực nhận (đã trừ trùng) — khớp cột CPQC/CNT trong file báo cáo. <b style={{ color: C.amber }}>Chạy ads thật nên ghìm CPA rẻ hơn ~10% số này</b> cho chắc lãi.
      </div>
    </div>
  )
}
