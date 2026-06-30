// ── LÃI THẬT TỪNG SẢN PHẨM (flagship) ────────────────────────────────────────
// Bảng lãi thật/đơn + lãi/ngày + đèn Scale/Giữ/Sửa/Cắt cho từng SP + ô giả lập.
// Lõi tính ở profitCalc.ts (dùng chung với feed việc gấp ở tab Kho).
import { useEffect, useMemo, useState } from 'react'
import { computeProfit, LN_TARGET, type Prod, type InvItem, type Tone } from './profitCalc'

const C = {
  panel: '#0c111c', panel2: '#0a0f19', line: '#1b2233', line2: '#161d2c',
  gold: '#f5c451', text: '#eef1f7', muted: '#74809a', muted2: '#aeb8cc',
  red: '#ff4d5e', amber: '#fbbf24', green: '#4ade80',
}
const tc = (t: Tone) => (t === 'red' ? C.red : t === 'amber' ? C.amber : t === 'green' ? C.green : C.muted2)
const fmtMoney = (n: number) => (n >= 0 ? '+' : '') + Math.round(n).toLocaleString('vi-VN') + 'đ'
const fmtPlain = (n: number) => Math.round(n).toLocaleString('vi-VN') + 'đ'
const fmtPct = (n: number) => (n * 100).toFixed(1) + '%'
const panelStyle: React.CSSProperties = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 20px', marginBottom: 14 }
const eyebrowStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, letterSpacing: 0.3, color: C.gold }

export default function ProfitTruth({ products, inv, velocity, priceVnd, feed, cockpit }: {
  products: Prod[]; inv: InvItem[]; velocity: Record<string, number>; priceVnd: Record<string, number>
  feed: { tone: 'red' | 'amber'; title: string; reason: string }[]
  cockpit: { vonNhap: number; eDong: number }
}) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const f = () => setIsMobile(window.innerWidth < 700)
    f(); window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])

  const rows = useMemo(() => computeProfit(products, inv, velocity, priceVnd), [products, inv, velocity, priceVnd])

  const stat = useMemo(() => ({
    laiNgay: rows.reduce((s, r) => s + r.laiNgay, 0),
    lo: rows.filter((r) => r.laiPct < 0).length,
    scale: rows.filter((r) => r.den.t === 'Scale').length,
    sua: rows.filter((r) => r.den.t === 'Sửa' || r.den.t === 'Cắt').length,
  }), [rows])

  const cell: React.CSSProperties = { padding: '11px 8px', textAlign: 'right' }
  if (!rows.length) {
    return <div style={{ ...panelStyle, textAlign: 'center', color: C.muted, fontSize: 14 }}>Chưa đủ dữ liệu để tính lãi từng SP (cần sản phẩm có đơn chốt + giá vốn). Kiểm tra ⚙ Cấu hình link ở tab Kho.</div>
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 14 }}>
        {[
          { l: 'Lãi thật / ngày (tổng)', v: fmtMoney(stat.laiNgay), c: stat.laiNgay < 0 ? C.red : C.green },
          { l: 'Đang LỖ ngầm', v: stat.lo + ' mã', c: stat.lo > 0 ? C.red : C.muted2 },
          { l: 'Nên SCALE', v: stat.scale + ' mã', c: C.green },
          { l: 'Cần sửa / cắt', v: stat.sua + ' mã', c: stat.sua > 0 ? C.amber : C.muted2 },
        ].map((k) => (
          <div key={k.l} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '12px 14px', minWidth: 0 }}>
            <div style={{ fontSize: 10, letterSpacing: 1, color: C.muted, marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.c, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* ⚡ VIỆC CẦN LÀM GẤP — nối kho × ads × lãi */}
      {feed.length > 0 && (
        <div style={panelStyle}>
          <div style={eyebrowStyle}>⚡ VIỆC CẦN LÀM GẤP · {feed.length}</div>
          <div style={{ fontSize: 12, color: C.muted, margin: '6px 0 4px' }}>Nối kho × ads × lãi — xếp theo độ cháy túi.</div>
          {feed.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 0', borderTop: i ? `1px solid ${C.line2}` : 'none' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0, background: a.tone === 'red' ? C.red : C.amber }} />
              <div><div style={{ fontSize: 13.5, fontWeight: 500, color: C.text }}>{a.title}</div><div style={{ fontSize: 12.5, color: C.muted2 }}>{a.reason}</div></div>
            </div>
          ))}
        </div>
      )}

      {/* 💰 BUỒNG LÁI VỐN — KHÔNG hiện tiền COD (không cho nhân viên thấy dòng tiền công ty) */}
      {(cockpit.vonNhap > 0 || cockpit.eDong > 0) && (
        <div style={panelStyle}>
          <div style={eyebrowStyle}>💰 BUỒNG LÁI VỐN</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, margin: '10px 0 0' }}>
            {[
              { l: 'Vốn CẦN nhập', v: fmtPlain(cockpit.vonNhap), c: C.gold, sub: 'để không đứt hàng' },
              { l: 'Vốn ĐỌNG ở hàng ế', v: fmtPlain(cockpit.eDong), c: C.muted2, sub: 'thanh lý để lấy vốn' },
            ].map((k) => (
              <div key={k.l} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '12px 14px', minWidth: 0 }}>
                <div style={{ fontSize: 10, letterSpacing: 1, color: C.muted, marginBottom: 5 }}>{k.l}</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: k.c, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.v}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{k.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>Cần nhập <b style={{ color: C.muted2 }}>{fmtPlain(cockpit.vonNhap)}</b> · đọng <b style={{ color: C.muted2 }}>{fmtPlain(cockpit.eDong)}</b> ở hàng ế. Mẹo: thanh lý hàng ế để có vốn nhập thay vì bơm thêm tiền.</div>
        </div>
      )}

      <div style={panelStyle}>
        <div style={eyebrowStyle}>🔥 LÃI THẬT TỪNG SẢN PHẨM · {rows.length} mã</div>
        <div style={{ fontSize: 12, color: C.muted, margin: '6px 0 10px' }}>Ghép giá vốn thật + %hoàn thật + %CPQC thật → lãi/đơn (tỷ giá 5.800). Đèn suy ra tự động, không AI.</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 680 }}>
            <thead>
              <tr style={{ color: C.muted, fontSize: 10, letterSpacing: 1 }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 400 }}>SẢN PHẨM</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 400 }}>%CPQC THẬT / NGƯỠNG</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 400 }}>% HOÀN</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 400 }}>LÃI THẬT / ĐƠN</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 400 }}>LÃI / NGÀY</th>
                <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 400 }}>ĐÈN</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 400 }}>VIỆC NÊN LÀM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${C.line2}` }}>
                  <td style={{ padding: '11px 8px', fontWeight: 500 }}>{r.name}{!r.giaReal && <span style={{ color: C.amber }} title="chưa có giá vốn thật — ước tính 25%"> *</span>}</td>
                  <td style={cell}><span style={{ color: r.adsPct > r.cpqcTarget ? C.red : C.green }}>{fmtPct(r.adsPct)}</span><span style={{ color: C.muted }}> / {fmtPct(Math.max(0, r.cpqcTarget))}</span></td>
                  <td style={{ ...cell, color: r.hoanPct > 0.4 ? C.red : r.hoanPct > 0.3 ? C.amber : C.muted2 }}>{fmtPct(r.hoanPct)}{r.hoanEstimated && <span style={{ color: C.amber }} title="hoàn ước tính tháng trước — đơn tháng này chưa về đủ"> ~ƯT</span>}</td>
                  <td style={{ ...cell, color: r.laiDon < 0 ? C.red : C.green, fontWeight: 500 }}>{fmtMoney(r.laiDon)}</td>
                  <td style={{ ...cell, color: r.laiNgay < 0 ? C.red : C.muted2 }}>{fmtMoney(r.laiNgay)}</td>
                  <td style={{ padding: '11px 8px', textAlign: 'center' }}><span style={{ color: tc(r.den.tone), border: `1px solid ${tc(r.den.tone)}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, whiteSpace: 'nowrap' }}>{r.den.t}</span></td>
                  <td style={{ padding: '11px 8px', textAlign: 'left', color: C.muted2, fontSize: 12 }}>{r.viec}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>🟢 Scale = lãi tốt &amp; hoàn thấp &amp; ads còn dư địa · ⚪ Giữ = ổn định · 🟡 Sửa = ads vượt ngưỡng hoặc hoàn cao · 🔴 Cắt = lỗ hoặc hoàn &gt;45%. NGƯỠNG = %CPQC tối đa để còn đạt lãi mục tiêu {fmtPct(LN_TARGET)}. <span style={{ color: C.amber }}>*</span> = chưa có giá vốn thật, tạm ước 25%.</div>
      </div>
    </div>
  )
}
