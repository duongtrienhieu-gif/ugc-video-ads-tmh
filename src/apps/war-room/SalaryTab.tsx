// ── Tab 💰 Lương (trong War Room) ────────────────────────────────────────────
// Net/DT/CPQC đọc THẲNG từ dòng TỔNG file team (BÁO CÁO SẢN PHẨM) → số kế toán THẬT, khớp sheet
// (gồm +%hoàn theo công thức sheet). Marketer: CHỈ team mình. CEO: tất cả + lớp ẩn (6500/buffer).
import { useMemo, useState } from 'react'
import type { Member } from './store'
import type { TeamFin } from './actuals'
import { tinhLuong, realNet, realRevenue, DEFAULT_CEO } from './salary'

const C = {
  panel: '#0c111c', panel2: '#0a0f19', line: '#1b2233', line2: '#161d2c',
  gold: '#f5c451', text: '#eef1f7', muted: '#74809a', muted2: '#aeb8cc',
  red: '#ff4d5e', amber: '#fbbf24', green: '#4ade80', blue: '#7aa9ef',
}
const TR = 1_000_000
const panelStyle: React.CSSProperties = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 20px', marginBottom: 14 }
const eyebrowStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, letterSpacing: 0.3, color: C.gold, marginBottom: 10 }
const fmtTr = (n: number) => Math.round(n).toLocaleString('vi-VN') + 'đ' // FULL từng đồng (vd 21.654.564đ)
const fmtPct = (n: number) => (n * 100).toFixed(1) + '%'
const heColor = (c: number) => (c <= 0.34 ? C.green : c <= 0.38 ? C.muted2 : C.red)

// Tên nhân sự → token team (data file team keyed APEX/TITAN/SUMMIT).
const TEAM_OF: Record<string, string> = { DUY: 'APEX', KHÁNH: 'APEX', KHANH: 'APEX', TUẤN: 'TITAN', TUAN: 'TITAN', ANH: 'TITAN', HÀ: 'SUMMIT', HA: 'SUMMIT', PHY: 'SUMMIT' }
function teamTokenOf(name: string): string | null {
  const toks = name.toUpperCase().split(/[\s+,/]+/).filter(Boolean)
  for (const t of toks) { if (t === 'APEX' || t === 'TITAN' || t === 'SUMMIT') return t; if (TEAM_OF[t]) return TEAM_OF[t] }
  return null
}

interface Row { id: string; name: string; fin?: TeamFin }

export default function SalaryTab({ members, teamFin, isCEO, myMember }: {
  members: Member[]; teamFin: Record<string, TeamFin>; isCEO: boolean; myMember?: Member
}) {
  const rows = useMemo<Row[]>(() => {
    let mkt = members.filter((m) => m.role === 'marketer')
    if (!isCEO) mkt = mkt.filter((m) => m.id === myMember?.id)
    return mkt.map((m) => ({ id: m.id, name: m.name, fin: teamTokenOf(m.name) ? teamFin[teamTokenOf(m.name) as string] : undefined }))
  }, [members, teamFin, isCEO, myMember])

  const hasData = (f?: TeamFin) => !!f && (f.dt > 0 || f.net !== 0 || f.dtSauHoan > 0)

  const ceo = useMemo(() => {
    let rev = 0, rn = 0, luong = 0
    for (const r of rows) {
      if (!hasData(r.fin)) continue
      const f = r.fin as TeamFin
      rev += realRevenue(f.dt); rn += realNet(f.dt, f.net)
      luong += tinhLuong({ dtSauHoan: f.dtSauHoan, net: f.net, cpqc: f.cpqc }).luongTeam
    }
    const giu = rn - luong - DEFAULT_CEO.overhead
    return { rev, rn, luong, overhead: DEFAULT_CEO.overhead, giu, bufferPct: rev > 0 ? giu / rev : 0 }
  }, [rows])

  return (
    <div>
      <div style={panelStyle}>
        <div style={eyebrowStyle}>💰 LƯƠNG {isCEO ? '· TẤT CẢ TEAM' : '· TEAM CỦA TÔI'}</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
          Lương/người = <b style={{ color: C.muted2 }}>Cứng</b> (theo DT team sau hoàn) + <b style={{ color: C.muted2 }}>( Thưởng net /2 ) × Hệ số CPQC</b>. Net âm → sàn 8tr. <span style={{ color: C.green }}>Net/DT lấy THẲNG từ sheet kế toán file team</span> (số thật, gồm %hoàn).
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ ...panelStyle, textAlign: 'center', color: C.muted }}>Chưa có team (chưa gán nhân sự).</div>
      ) : rows.map((r) => {
        if (!hasData(r.fin)) return (
          <div key={r.id} style={panelStyle}>
            <span style={{ fontWeight: 600, fontSize: 16 }}>{r.name}</span>
            <span style={{ marginLeft: 10, fontSize: 12.5, color: C.amber }}>— chưa có số tháng này (file team chưa có doanh thu)</span>
          </div>
        )
        const f = r.fin as TeamFin
        const hoan = f.dt > 0 ? Math.max(0, 1 - f.dtSauHoan / f.dt) : 0
        const L = tinhLuong({ dtSauHoan: f.dtSauHoan, net: f.net, cpqc: f.cpqc })
        const loss = f.net < 0
        return (
          <div key={r.id} style={panelStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 16 }}>{r.name}</span>
              <span style={{ fontSize: 11, color: C.green, background: 'rgba(74,222,128,0.1)', padding: '2px 8px', borderRadius: 6 }}>✓ số thật từ sheet</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(168px,1fr))', gap: 10, marginBottom: 12 }}>
              {[
                { l: 'Doanh thu', v: fmtTr(f.dt), c: C.text },
                { l: 'DT sau hoàn', v: fmtTr(f.dtSauHoan), c: C.text },
                { l: 'Tiền ads', v: fmtTr(f.dt * f.cpqc), c: heColor(f.cpqc), sub: 'CPQC ' + fmtPct(f.cpqc) },
                { l: '% Hoàn', v: fmtPct(hoan), c: hoan > 0.4 ? C.red : hoan > 0.3 ? C.amber : C.muted2 },
                { l: 'NET (lợi nhuận)', v: fmtTr(f.net), c: f.net < 0 ? C.red : C.green, big: true },
              ].map((k) => (
                <div key={k.l} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '11px 13px' }}>
                  <div style={{ fontSize: 10.5, letterSpacing: 0.5, color: C.muted, marginBottom: 5 }}>{k.l}</div>
                  <div style={{ fontSize: k.big ? 17 : 15, fontWeight: 700, color: k.c, whiteSpace: 'nowrap' }}>{k.v}</div>
                  {k.sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{k.sub}</div>}
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(175px,1fr))', gap: 10 }}>
              {[
                { l: '① Cứng / người', v: fmtTr(L.cung) },
                { l: '② Thưởng / người', v: loss ? '0đ' : fmtTr(L.thuongNguoi), sub: loss ? 'net âm' : `pool ${fmtTr(L.pool)} /2 ${L.heLabel}` },
                { l: '→ LƯƠNG / người', v: fmtTr(L.luongNguoi), gold: true },
              ].map((k) => (
                <div key={k.l} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.muted, marginBottom: 4 }}>{k.l}</div>
                  <div style={{ fontSize: k.gold ? 18 : 16, fontWeight: 700, color: k.gold ? C.gold : C.text, whiteSpace: 'nowrap' }}>{k.v}</div>
                  {k.sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{k.sub}</div>}
                </div>
              ))}
            </div>
            {isCEO && (
              <div style={{ marginTop: 10, padding: '9px 12px', background: 'rgba(122,169,239,0.07)', border: '1px solid #25324a', borderRadius: 10, fontSize: 12, color: C.blue }}>
                🔒 Thật (6500): doanh thu ~{fmtTr(realRevenue(f.dt))} · <b>net thật ~{fmtTr(realNet(f.dt, f.net))}</b> · trả lương team {fmtTr(L.luongTeam)}
              </div>
            )}
          </div>
        )
      })}

      {isCEO && ceo.rev > 0 && (
        <div style={{ ...panelStyle, border: `1px solid ${ceo.bufferPct < DEFAULT_CEO.buffer ? C.red : '#25324a'}` }}>
          <div style={{ ...eyebrowStyle, color: C.blue }}>🔒 BUỒNG LÁI CEO (toàn công ty · số thật)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(168px,1fr))', gap: 10 }}>
            {[
              { l: 'Net thật', v: fmtTr(ceo.rn) },
              { l: '− Lương trả', v: fmtTr(ceo.luong) },
              { l: '− Overhead', v: fmtTr(ceo.overhead) },
              { l: '= CEO giữ', v: fmtTr(ceo.giu), c: ceo.giu < 0 ? C.red : C.green },
              { l: 'Buffer / DT', v: fmtPct(ceo.bufferPct), c: ceo.bufferPct < DEFAULT_CEO.buffer ? C.red : C.green },
            ].map((k) => (
              <div key={k.l} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.muted, marginBottom: 4 }}>{k.l}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: k.c ?? C.text, whiteSpace: 'nowrap' }}>{k.v}</div>
              </div>
            ))}
          </div>
          {ceo.bufferPct < DEFAULT_CEO.buffer && (
            <div style={{ marginTop: 8, fontSize: 12, color: C.red, fontWeight: 600 }}>⚠ Buffer dưới 12% — lương + overhead ăn quá sâu vào lãi thật. Cần đẩy DT hoặc ghìm chi phí.</div>
          )}
        </div>
      )}

      {/* 3 bảng mốc đối chiếu */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 14 }}>
        {[
          { t: '① CỨNG / NGƯỜI (DT team)', rows: [['< 500tr', '8tr'], ['500tr–1 tỷ', '10tr'], ['1–1,5 tỷ', '12tr'], ['1,5–2 tỷ', '14tr'], ['2–2,5 tỷ', '16tr'], ['2,5–3 tỷ', '18tr'], ['≥ 3 tỷ', '20tr']] },
          { t: '② THƯỞNG LŨY TIẾN (net)', rows: [['0–20tr', '10%'], ['20–50tr', '15%'], ['50–100tr', '20%'], ['100tr +', '25%']] },
          { t: '③ HỆ SỐ CPQC', rows: [['< 31%', '×1.5'], ['31–34%', '×1.2'], ['34–38%', '×1.0'], ['> 38%', '×0.8']] },
        ].map((tb) => (
          <div key={tb.t} style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 14px' }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: C.muted2, marginBottom: 6 }}>{tb.t}</div>
            <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
              <tbody>{tb.rows.map(([a, b]) => <tr key={a}><td style={{ padding: '2px 0', color: C.muted }}>{a}</td><td style={{ textAlign: 'right' }}>{b}</td></tr>)}</tbody>
            </table>
          </div>
        ))}
      </div>

      <Scratch />
    </div>
  )
}

// Bảng nháp tự điền
function Scratch() {
  const [dt, setDt] = useState(1000)
  const [net, setNet] = useState(60)
  const [cpqc, setCpqc] = useState(31)
  const L = tinhLuong({ dtSauHoan: dt * TR, net: net * TR, cpqc: cpqc / 100 })
  const inp: React.CSSProperties = { width: '100%', background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 8, padding: '9px 11px', fontSize: 14 }
  return (
    <div style={panelStyle}>
      <div style={eyebrowStyle}>🧮 BẢNG NHÁP — tự điền thử</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 12 }}>
        <label style={{ fontSize: 12, color: C.muted2 }}>DT team sau hoàn (triệu)<input type="number" value={dt} step={100} onChange={(e) => setDt(+e.target.value)} style={{ ...inp, marginTop: 4 }} /></label>
        <label style={{ fontSize: 12, color: C.muted2 }}>Net team (triệu)<input type="number" value={net} step={10} onChange={(e) => setNet(+e.target.value)} style={{ ...inp, marginTop: 4 }} /></label>
        <label style={{ fontSize: 12, color: C.muted2 }}>CPQC team (%)<input type="number" value={cpqc} step={1} onChange={(e) => setCpqc(+e.target.value)} style={{ ...inp, marginTop: 4 }} /></label>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 12px', background: C.panel2, borderRadius: 10 }}>
        <span style={{ fontSize: 13, color: C.muted2 }}>Cứng {fmtTr(L.cung)} + Thưởng {net < 0 ? '0đ' : fmtTr(L.thuongNguoi)} ({net < 0 ? 'net âm' : `${L.heLabel}`})</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: C.gold, whiteSpace: 'nowrap' }}>{fmtTr(L.luongNguoi)} /người</span>
      </div>
    </div>
  )
}
