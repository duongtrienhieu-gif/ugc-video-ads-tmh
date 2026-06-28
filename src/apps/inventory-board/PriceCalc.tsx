// ── MÁY TÍNH GIÁ & LỢI NHUẬN (bản gọn, port từ Tab-MAY-TINH-GIA_gon_TMH) ──────
// Tính live: nhập giá vốn + combo + CPA → ra %lợi nhuận, %CPQC mục tiêu, tổng.
// Công thức khớp 100% file Excel: AOV RM = Σ(giá×%đơn); ads/đơn = CPA/chốt%;
// giá vốn trừ hoàn = upsell×giá vốn×(1−hoàn); LN% = 100% − ads − vốn − ship − VH − hoàn.
// Có nối data kho (chọn SP tự điền giá vốn + %hoàn) + mục Nâng cao (giá bán tối thiểu).
import { useEffect, useMemo, useState } from 'react'

const C = {
  bg: '#070a12', panel: '#0c111c', panel2: '#0a0f19', line: '#1b2233', line2: '#161d2c',
  gold: '#f5c451', text: '#eef1f7', muted: '#74809a', muted2: '#aeb8cc',
  red: '#ff4d5e', amber: '#fbbf24', green: '#4ade80',
}
const fmtMoney = (n: number) => Math.round(n).toLocaleString('vi-VN') + 'đ'
const fmtPct = (n: number) => (n * 100).toFixed(1) + '%'
const fmtRM = (n: number) => n.toFixed(1)
const panelStyle: React.CSSProperties = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 20px', marginBottom: 14 }
const eyebrowStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, letterSpacing: 0.3, color: C.gold, marginBottom: 10 }
const PACK_FACTOR = (name: string) => (name.trim().toUpperCase() === 'KNEE PAD' ? 2 : 1)

interface Channel { name: string; chot: number; hoan: number }
const DEFAULT_CHANNELS: Channel[] = [
  { name: 'Ladipage', chot: 0.73, hoan: 0.20 },
  { name: 'Mess', chot: 0.15, hoan: 0.35 },
]
interface Combo { loai: string; spGiao: number; giaRM: number; pctDon: number }
const DEFAULT_COMBOS: Combo[] = [
  { loai: 'Lẻ 1', spGiao: 1, giaRM: 35, pctDon: 0 },
  { loai: '1 tặng 1', spGiao: 2, giaRM: 69, pctDon: 0.7 },
  { loai: '2 tặng 2', spGiao: 4, giaRM: 89, pctDon: 0.2 },
  { loai: '3 tặng 3', spGiao: 6, giaRM: 109, pctDon: 0.1 },
  { loai: '(trống)', spGiao: 1, giaRM: 0, pctDon: 0 },
  { loai: '(trống)', spGiao: 1, giaRM: 0, pctDon: 0 },
]
const CH_KEY = 'inv_calc_channels'

// data kho truyền từ board sang để auto-fill
interface ProdLite { name: string; pctHoan: number }
interface InvLite { ten: string; giaVonRM: number; giaVonVnd: number }

function NumField({ label, value, onChange, suffix, step = 1, tint }: { label: string; value: number; onChange: (n: number) => void; suffix?: string; step?: number; tint?: boolean }) {
  return (
    <label style={{ fontSize: 12, color: C.muted2, display: 'block' }}>
      {label}
      <div style={{ position: 'relative', marginTop: 4 }}>
        <input type="number" value={Number.isFinite(value) ? value : 0} step={step} onChange={(e) => onChange(+e.target.value)}
          style={{ width: '100%', background: tint ? 'rgba(245,196,81,0.06)' : C.panel2, border: `1px solid ${tint ? '#3a3414' : C.line}`, color: C.text, borderRadius: 8, padding: '9px 11px', fontSize: 14 }} />
        {suffix && <span style={{ position: 'absolute', right: 10, top: 10, fontSize: 12, color: C.muted }}>{suffix}</span>}
      </div>
    </label>
  )
}

export default function PriceCalc({ products, priceVnd, inv }: { products: ProdLite[]; priceVnd: Record<string, number>; inv: InvLite[] }) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const f = () => setIsMobile(window.innerWidth < 700)
    f(); window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])

  const [channels, setChannels] = useState<Channel[]>(() => {
    try { const s = JSON.parse(localStorage.getItem(CH_KEY) || 'null'); if (Array.isArray(s) && s.length) return s } catch { /* ignore */ }
    return DEFAULT_CHANNELS
  })
  const [channel, setChannel] = useState(DEFAULT_CHANNELS[0].name)

  const [giaVonSp, setGiaVonSp] = useState(50000)
  const [chotPct, setChotPct] = useState(0.73)
  const [hoanPct, setHoanPct] = useState(0.20)
  const [shipPct, setShipPct] = useState(0.09)
  const [vanHanhPct, setVanHanhPct] = useState(0.08)
  const [lnTargetPct, setLnTargetPct] = useState(0.10)
  const [cpaLead, setCpaLead] = useState(100000)
  const [tyGia, setTyGia] = useState(5800)
  const [combos, setCombos] = useState<Combo[]>(DEFAULT_COMBOS)
  const [soDon, setSoDon] = useState(1000)
  const [showAdv, setShowAdv] = useState(false)
  const [showCh, setShowCh] = useState(false)
  const [fromProd, setFromProd] = useState('')

  // đổi kênh → tỷ lệ chốt + hoàn nhảy theo preset (vẫn sửa tay được sau)
  function pickChannel(name: string) {
    setChannel(name)
    const c = channels.find((x) => x.name === name)
    if (c) { setChotPct(c.chot); setHoanPct(c.hoan) }
  }
  // chọn SP trong kho → tự điền giá vốn/sp + %hoàn
  function pickProduct(name: string) {
    setFromProd(name)
    if (!name) return
    const key = name.trim().toUpperCase()
    const it = inv.find((x) => x.ten.trim().toUpperCase() === key)
    const gv = (priceVnd[key] ?? 0) / PACK_FACTOR(key) || it?.giaVonVnd || (it ? it.giaVonRM * tyGia : 0)
    if (gv > 0) setGiaVonSp(Math.round(gv))
    const p = products.find((x) => x.name.trim().toUpperCase() === key)
    if (p && p.pctHoan > 0) setHoanPct(+p.pctHoan.toFixed(3))
  }
  function saveChannels() { localStorage.setItem(CH_KEY, JSON.stringify(channels)) }

  const r = useMemo(() => {
    const tongPct = combos.reduce((s, c) => s + c.pctDon, 0)
    const aovRM = combos.reduce((s, c) => s + c.giaRM * c.pctDon, 0)
    const aovVnd = aovRM * tyGia
    const upsell = combos.reduce((s, c) => s + c.spGiao * c.pctDon, 0)
    const giaVonDon = upsell * giaVonSp
    const adsPerDon = chotPct > 0 ? cpaLead / chotPct : 0
    const adsPct = aovVnd > 0 ? adsPerDon / aovVnd : 0
    const vonAfterReturn = giaVonDon * (1 - hoanPct)
    const vonPct = aovVnd > 0 ? vonAfterReturn / aovVnd : 0
    const lnPct = 1 - adsPct - vonPct - shipPct - vanHanhPct - hoanPct
    const lnPerDon = lnPct * aovVnd
    const cpqcTarget = 1 - lnTargetPct - vonPct - shipPct - vanHanhPct - hoanPct
    // KẾT LUẬN ADS
    let ket: { t: string; c: string }
    if (lnPct < 0) ket = { t: 'LỖ — sửa giá / combo / ads', c: C.red }
    else if (adsPct > cpqcTarget + 1e-9) ket = { t: 'Có lãi nhưng dưới mục tiêu — tối ưu ads', c: C.amber }
    else ket = { t: 'Đạt mục tiêu ✓', c: C.green }
    // Nâng cao: AOV (RM) tối thiểu để hòa vốn / đạt lãi mục tiêu — giữ nguyên combo mix
    const denomBE = 1 - shipPct - vanHanhPct - hoanPct
    const aovVndBE = denomBE > 0 ? (adsPerDon + vonAfterReturn) / denomBE : 0
    const denomTG = denomBE - lnTargetPct
    const aovVndTG = denomTG > 0 ? (adsPerDon + vonAfterReturn) / denomTG : 0
    // CPA tối đa (theo lead) giữ giá hiện tại
    const adsMaxBE = aovVnd * denomBE - vonAfterReturn // ads/đơn chốt tối đa để hòa vốn
    const adsMaxTG = aovVnd * (denomBE - lnTargetPct) - vonAfterReturn
    return {
      tongPct, aovRM, aovVnd, upsell, giaVonDon, adsPerDon, adsPct, vonPct, lnPct, lnPerDon, cpqcTarget, ket,
      aovRmBE: aovVndBE / tyGia, aovRmTG: aovVndTG / tyGia,
      cpaMaxBE: adsMaxBE * chotPct, cpaMaxTG: adsMaxTG * chotPct,
      tongDoanhSo: aovVnd * soDon, tongLN: lnPerDon * soDon, tongAds: adsPerDon * soDon,
    }
  }, [combos, tyGia, giaVonSp, chotPct, hoanPct, shipPct, vanHanhPct, lnTargetPct, cpaLead, soDon])

  const pnlRows: { label: string; val: string; c?: string; bold?: boolean }[] = [
    { label: 'Doanh số chốt đơn', val: '100%' },
    { label: '− Quảng cáo (%CPQC)', val: fmtPct(r.adsPct), c: r.adsPct > r.cpqcTarget ? C.amber : C.muted2 },
    { label: '− Giá vốn (đã trừ hoàn về)', val: fmtPct(r.vonPct), c: C.muted2 },
    { label: '− Vận chuyển', val: fmtPct(shipPct), c: C.muted2 },
    { label: '− Vận hành', val: fmtPct(vanHanhPct), c: C.muted2 },
    { label: '− Tỉ lệ hoàn', val: fmtPct(hoanPct), c: C.muted2 },
    { label: '= LỢI NHUẬN (%)', val: fmtPct(r.lnPct), c: r.lnPct < 0 ? C.red : r.lnPct < lnTargetPct ? C.amber : C.green, bold: true },
    { label: '→ Lợi nhuận / đơn (VNĐ)', val: fmtMoney(r.lnPerDon), c: r.lnPerDon < 0 ? C.red : C.gold, bold: true },
  ]

  return (
    <div>
      {/* ① NHẬP LIỆU */}
      <div style={panelStyle}>
        <div style={eyebrowStyle}>① NHẬP LIỆU</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: C.muted2 }}>🔻 Chọn kênh
            <select value={channel} onChange={(e) => pickChannel(e.target.value)}
              style={{ display: 'block', marginTop: 4, background: C.panel2, border: `1px solid ${C.gold}`, color: C.gold, borderRadius: 8, padding: '9px 11px', fontSize: 14, minWidth: 140, fontWeight: 600 }}>
              {channels.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </label>
          {products.length > 0 && (
            <label style={{ fontSize: 12, color: C.muted2 }}>📦 Lấy từ SP trong kho
              <select value={fromProd} onChange={(e) => pickProduct(e.target.value)}
                style={{ display: 'block', marginTop: 4, background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 8, padding: '9px 11px', fontSize: 14, minWidth: 180 }}>
                <option value="">— chọn để tự điền giá vốn + %hoàn —</option>
                {products.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </label>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
          <NumField label="Giá vốn nhập / 1 sp (VNĐ)" value={giaVonSp} onChange={setGiaVonSp} step={1000} tint />
          <NumField label="Tỷ lệ chốt đơn (%)" value={+(chotPct * 100).toFixed(1)} onChange={(n) => setChotPct(n / 100)} suffix="%" step={1} />
          <NumField label="Tỷ lệ HOÀN (%)" value={+(hoanPct * 100).toFixed(1)} onChange={(n) => setHoanPct(n / 100)} suffix="%" step={1} />
          <NumField label="% Ship (cố định)" value={+(shipPct * 100).toFixed(1)} onChange={(n) => setShipPct(n / 100)} suffix="%" step={0.5} />
          <NumField label="% Vận hành (cố định)" value={+(vanHanhPct * 100).toFixed(1)} onChange={(n) => setVanHanhPct(n / 100)} suffix="%" step={0.5} />
          <NumField label="Lợi nhuận MỤC TIÊU (%)" value={+(lnTargetPct * 100).toFixed(1)} onChange={(n) => setLnTargetPct(n / 100)} suffix="%" step={1} tint />
          <NumField label="⭐ CPA / 1 data-lead (VNĐ)" value={cpaLead} onChange={setCpaLead} step={5000} tint />
          <NumField label="Tỷ giá RM → VNĐ" value={tyGia} onChange={setTyGia} step={100} />
        </div>
      </div>

      {/* ②③④⑤ lưới 2×2 — ô cùng hàng tự cao bằng nhau cho gọn */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.25fr 1fr', gap: 14, marginBottom: 14, alignItems: 'stretch' }}>
      {/* ② COMBO */}
      <div style={{ ...panelStyle, marginBottom: 0 }}>
        <div style={eyebrowStyle}>② COMBO — SP giao (gồm tặng) · Giá khách trả (RM) · % đơn</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 460 }}>
            <thead>
              <tr style={{ color: C.muted, fontSize: 10, letterSpacing: 1 }}>
                <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 400 }}>LOẠI COMBO</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 400 }}>SP GIAO</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 400 }}>GIÁ (RM)</th>
                <th style={{ textAlign: 'right', padding: '6px 0', fontWeight: 400 }}>% ĐƠN</th>
              </tr>
            </thead>
            <tbody>
              {combos.map((c, i) => {
                const upd = (patch: Partial<Combo>) => setCombos((arr) => arr.map((x, j) => j === i ? { ...x, ...patch } : x))
                const cellInput: React.CSSProperties = { width: 70, background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 6, padding: '5px 7px', fontSize: 13, textAlign: 'right' }
                return (
                  <tr key={i} style={{ borderTop: `1px solid ${C.line2}` }}>
                    <td style={{ padding: '6px 0' }}>
                      <input value={c.loai} onChange={(e) => upd({ loai: e.target.value })} style={{ width: isMobile ? 90 : 130, background: 'transparent', border: 'none', color: C.text, fontSize: 13 }} />
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}><input type="number" value={c.spGiao} step={1} onChange={(e) => upd({ spGiao: +e.target.value })} style={cellInput} /></td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}><input type="number" value={c.giaRM} step={1} onChange={(e) => upd({ giaRM: +e.target.value })} style={cellInput} /></td>
                    <td style={{ padding: '6px 0', textAlign: 'right' }}><input type="number" value={+(c.pctDon * 100).toFixed(0)} step={5} onChange={(e) => upd({ pctDon: +e.target.value / 100 })} style={cellInput} /></td>
                  </tr>
                )
              })}
              <tr style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={{ padding: '8px 0', color: C.muted2 }}>Tổng % (phải = 100%)</td>
                <td /><td />
                <td style={{ padding: '8px 0', textAlign: 'right', color: Math.abs(r.tongPct - 1) < 0.001 ? C.green : C.red, fontWeight: 600 }}>{(r.tongPct * 100).toFixed(0)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 14 }}>
          {[
            { l: 'AOV thực tế (RM/đơn)', v: fmtRM(r.aovRM) },
            { l: 'AOV = Doanh số chốt/đơn', v: fmtMoney(r.aovVnd), gold: true },
            { l: 'Upsell thực tế (SP/đơn)', v: r.upsell.toFixed(2) },
            { l: 'Giá vốn thực tế / đơn', v: fmtMoney(r.giaVonDon) },
          ].map((k) => (
            <div key={k.l} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, letterSpacing: 1, color: C.muted, marginBottom: 5 }}>{k.l}</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: k.gold ? C.gold : C.text }}>{k.v}</div>
            </div>
          ))}
        </div>
        {Math.abs(r.tongPct - 1) >= 0.001 && <div style={{ fontSize: 12, color: C.red, marginTop: 10 }}>⚠ Tổng % đơn đang là {(r.tongPct * 100).toFixed(0)}% — chỉnh cho đủ 100% thì số mới chuẩn.</div>}
      </div>

      {/* ③ BẢNG LỢI NHUẬN */}
      <div style={{ ...panelStyle, marginBottom: 0 }}>
        <div style={eyebrowStyle}>③ ⭐ BẢNG LỢI NHUẬN DỰ KIẾN (% trên doanh số chốt)</div>
        {pnlRows.map((row, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: i ? `1px solid ${C.line2}` : 'none', fontSize: row.bold ? 15 : 13.5 }}>
            <span style={{ color: row.bold ? C.text : C.muted2, fontWeight: row.bold ? 600 : 400 }}>{row.label}</span>
            <span style={{ color: row.c ?? C.text, fontWeight: row.bold ? 700 : 500 }}>{row.val}</span>
          </div>
        ))}
      </div>

      {/* ④ THAM CHIẾU — care ads · order:1 → đứng sau ⑤ trên desktop (swap ④↔⑤), mobile giữ thứ tự gốc */}
      <div style={{ ...panelStyle, marginBottom: 0, order: isMobile ? 0 : 1 }}>
        <div style={eyebrowStyle}>④ THAM CHIẾU — care ads</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 10, letterSpacing: 1, color: C.muted, marginBottom: 5 }}>🎯 %CPQC MỤC TIÊU (để đạt lãi mục tiêu)</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.gold }}>{fmtPct(Math.max(0, r.cpqcTarget))}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>đang chạy thực tế: {fmtPct(r.adsPct)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 200, border: `1px solid ${r.ket.c}`, borderRadius: 10, padding: '12px 16px', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ fontSize: 10, letterSpacing: 1, color: C.muted, marginBottom: 5 }}>KẾT LUẬN ADS</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: r.ket.c }}>● {r.ket.t}</div>
          </div>
        </div>
        <button onClick={() => setShowAdv((v) => !v)} style={{ marginTop: 14, background: 'transparent', color: C.gold, border: `1px solid ${C.line}`, borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>
          ⊕ Nâng cao — set giá bán &amp; CPA tối đa {showAdv ? '▲' : '▼'}
        </button>
        {showAdv && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit,minmax(170px,1fr))', gap: 10, marginTop: 12 }}>
            {[
              { l: '🎯 AOV (RM) tối thiểu — HÒA VỐN', v: fmtRM(r.aovRmBE), sub: 'giữ nguyên tỉ lệ combo' },
              { l: '🎯 AOV (RM) tối thiểu — LÃI mục tiêu', v: fmtRM(r.aovRmTG), sub: `để đạt ${fmtPct(lnTargetPct)}` },
              { l: '💰 CPA tối đa / lead — HÒA VỐN', v: fmtMoney(Math.max(0, r.cpaMaxBE)), sub: 'giữ giá hiện tại' },
              { l: '🎯 CPA / lead — LÃI mục tiêu', v: fmtMoney(Math.max(0, r.cpaMaxTG)), sub: `để đạt ${fmtPct(lnTargetPct)}` },
            ].map((k) => (
              <div key={k.l} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.muted, marginBottom: 5 }}>{k.l}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.gold }}>{k.v}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{k.sub}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 11, color: C.muted, marginTop: 12, lineHeight: 1.5 }}>%CPQC = tiền ads ÷ doanh số chốt (gross). Giá vốn ĐÃ trừ hoàn về kho (chỉ mất vốn trên đơn giao thành công). Ship &amp; Vận hành cố định theo %. Đổi giá combo / CPA / giá vốn → mọi số tự cập nhật.</div>
      </div>

      {/* ⑤ TỔNG */}
      <div style={{ ...panelStyle, marginBottom: 0 }}>
        <div style={eyebrowStyle}>⑤ TỔNG — nhập số đơn</div>
        <div style={{ maxWidth: 240, marginBottom: 14 }}>
          <NumField label="Số đơn chốt dự kiến" value={soDon} onChange={setSoDon} step={100} tint />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          {[
            { l: 'Tổng doanh số chốt (VNĐ)', v: fmtMoney(r.tongDoanhSo), gold: true },
            { l: 'TỔNG LỢI NHUẬN (VNĐ)', v: fmtMoney(r.tongLN), c: r.tongLN < 0 ? C.red : C.green },
            { l: 'Tổng chi phí ads (VNĐ)', v: fmtMoney(r.tongAds) },
          ].map((k) => (
            <div key={k.l} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, letterSpacing: 1, color: C.muted, marginBottom: 6 }}>{k.l}</div>
              <div style={{ fontSize: 19, fontWeight: 600, color: k.c ?? (k.gold ? C.gold : C.text) }}>{k.v}</div>
            </div>
          ))}
        </div>
      </div>
      </div>

      {/* ⑥ CÀI ĐẶT KÊNH */}
      <div style={panelStyle}>
        <button onClick={() => setShowCh((v) => !v)} style={{ background: 'transparent', color: C.muted2, border: 'none', fontSize: 13, fontWeight: 700, letterSpacing: 0.3, cursor: 'pointer', padding: 0 }}>
          ⚙ CÀI ĐẶT KÊNH — sửa tỷ lệ chốt / hoàn mặc định {showCh ? '▲' : '▼'}
        </button>
        {showCh && (
          <div style={{ marginTop: 12 }}>
            {channels.map((c, i) => {
              const upd = (patch: Partial<Channel>) => setChannels((arr) => arr.map((x, j) => j === i ? { ...x, ...patch } : x))
              const inp: React.CSSProperties = { width: 80, background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 6, padding: '6px 8px', fontSize: 13, textAlign: 'right' }
              return (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', flexWrap: 'wrap' }}>
                  <input value={c.name} onChange={(e) => upd({ name: e.target.value })} style={{ width: 130, background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 6, padding: '6px 8px', fontSize: 13 }} />
                  <label style={{ fontSize: 12, color: C.muted }}>chốt <input type="number" value={+(c.chot * 100).toFixed(0)} step={1} onChange={(e) => upd({ chot: +e.target.value / 100 })} style={inp} /> %</label>
                  <label style={{ fontSize: 12, color: C.muted }}>hoàn <input type="number" value={+(c.hoan * 100).toFixed(0)} step={1} onChange={(e) => upd({ hoan: +e.target.value / 100 })} style={inp} /> %</label>
                </div>
              )
            })}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={() => setChannels((a) => [...a, { name: 'Kênh mới', chot: 0.5, hoan: 0.3 }])} style={{ background: 'transparent', color: C.muted2, border: `1px solid ${C.line}`, borderRadius: 8, padding: '7px 12px', fontSize: 13, cursor: 'pointer' }}>+ Thêm kênh</button>
              <button onClick={saveChannels} style={{ background: C.gold, color: '#1a1405', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Lưu cài đặt kênh</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: C.muted, marginTop: 4, textAlign: 'center' }}>Máy tính giá test sản phẩm · số nhảy tức thì khi bạn chỉnh · không lưu, mở ra tính rồi đóng</div>
    </div>
  )
}
