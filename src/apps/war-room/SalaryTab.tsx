// ── Tab 💰 Lương (trong War Room) ────────────────────────────────────────────
// Net/DT/CPQC đọc THẲNG từ dòng TỔNG file team (BÁO CÁO SẢN PHẨM) → số kế toán THẬT, khớp sheet
// (gồm +%hoàn theo công thức sheet). Marketer: CHỈ team mình. CEO: tất cả + lớp ẩn (6500/buffer).
import { useEffect, useMemo, useState } from 'react'
import type { Member } from './store'
import type { TeamFin } from './actuals'
import { tinhLuong, realNet, realRevenue, DEFAULT_CEO, type CeoCfg } from './salary'
import { loadCeoCfg, saveCeoCfg, loadTonEle, saveTonEle, type TonEleMap } from './salaryConfig'

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

interface Row { id: string; name: string; team: string | null; fin?: TeamFin }

export default function SalaryTab({ members, teamFin, isCEO, myMember }: {
  members: Member[]; teamFin: Record<string, TeamFin>; isCEO: boolean; myMember?: Member
}) {
  // Config CEO (số thật ẩn) — load Supabase 1 lần; chỉ CEO mới chỉnh/lưu.
  const [cfg, setCfg] = useState<CeoCfg>(DEFAULT_CEO)
  useEffect(() => { void loadCeoCfg().then(setCfg) }, [])
  // Tồn ế / team (VNĐ) — CEO nhập tay, cả team cùng thấy phạt.
  const [tonEle, setTonEle] = useState<TonEleMap>({})
  useEffect(() => { void loadTonEle().then(setTonEle) }, [])

  const rows = useMemo<Row[]>(() => {
    let mkt = members.filter((m) => m.role === 'marketer')
    if (!isCEO) mkt = mkt.filter((m) => m.id === myMember?.id)
    return mkt.map((m) => { const tk = teamTokenOf(m.name); return { id: m.id, name: m.name, team: tk, fin: tk ? teamFin[tk] : undefined } })
  }, [members, teamFin, isCEO, myMember])
  const teamTokens = useMemo(() => Array.from(new Set(rows.map((r) => r.team).filter((t): t is string => !!t))), [rows])
  const teOf = (team: string | null) => (team && tonEle[team]) || { von: 0, loXa: 0 }

  const hasData = (f?: TeamFin) => !!f && (f.dt > 0 || f.net !== 0 || f.dtSauHoan > 0)

  const ceo = useMemo(() => {
    let rev = 0, rn = 0, luong = 0
    for (const r of rows) {
      if (!hasData(r.fin)) continue
      const f = r.fin as TeamFin
      const te = teOf(r.team)
      rev += realRevenue(f.dt, cfg); rn += realNet(f.dt, f.net, cfg)
      luong += tinhLuong({ dtSauHoan: f.dtSauHoan, net: f.net, cpqc: f.cpqc, vonTonEle: te.von, loXa: te.loXa }).luongTeam
    }
    const giu = rn - luong - cfg.overhead
    return { rev, rn, luong, overhead: cfg.overhead, giu, bufferPct: rev > 0 ? giu / rev : 0 }
  }, [rows, cfg, tonEle]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div style={panelStyle}>
        <div style={eyebrowStyle}>💰 LƯƠNG {isCEO ? '· TẤT CẢ TEAM' : '· TEAM CỦA TÔI'}</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
          Lương/người = <b style={{ color: C.muted2 }}>Cứng</b> (theo DT team sau hoàn) + <b style={{ color: C.muted2 }}>( Thưởng net /2 ) × Hệ số CPQC</b> − <b style={{ color: C.red }}>Phạt tồn ế</b>. Net âm → sàn 8tr. <span style={{ color: C.green }}>Net/DT lấy THẲNG từ sheet kế toán file team</span> (số thật, gồm %hoàn). <span style={{ color: C.red }}>Hàng nhập &gt;45 ngày còn kẹt → trừ 8%/tháng vào thưởng; bán ≥ hoà vốn mới hết trừ.</span>
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
        const te = teOf(r.team)
        const hoan = f.dt > 0 ? Math.max(0, 1 - f.dtSauHoan / f.dt) : 0
        const L = tinhLuong({ dtSauHoan: f.dtSauHoan, net: f.net, cpqc: f.cpqc, vonTonEle: te.von, loXa: te.loXa })
        const loss = f.net < 0
        const grossNguoi = loss ? 0 : L.thuongTeamGross / 2
        const luongBoxes: Array<{ l: string; v: string; sub?: string; gold?: boolean; c?: string }> = [
          { l: '① Cứng / người', v: fmtTr(L.cung) },
          { l: L.phatTon > 0 ? '② Thưởng gộp / người' : '② Thưởng / người', v: loss ? '0đ' : fmtTr(grossNguoi), sub: loss ? 'net âm' : `pool ${fmtTr(L.pool)} /2 ${L.heLabel}` },
        ]
        if (L.phatTon > 0) luongBoxes.push({ l: '− Phạt tồn ế / người', v: '−' + fmtTr(L.phatTon / 2), c: C.red, sub: 'hàng >45 ngày còn kẹt' })
        luongBoxes.push({ l: '→ LƯƠNG / người', v: fmtTr(L.luongNguoi), gold: true })
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
              {luongBoxes.map((k) => (
                <div key={k.l} style={{ background: C.panel2, border: `1px solid ${k.c ? 'rgba(255,77,94,0.35)' : C.line}`, borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.muted, marginBottom: 4 }}>{k.l}</div>
                  <div style={{ fontSize: k.gold ? 18 : 16, fontWeight: 700, color: k.gold ? C.gold : (k.c ?? C.text), whiteSpace: 'nowrap' }}>{k.v}</div>
                  {k.sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{k.sub}</div>}
                </div>
              ))}
            </div>
            {L.phatTon > 0 && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(255,77,94,0.07)', border: '1px solid rgba(255,77,94,0.25)', borderRadius: 10, fontSize: 11.5, color: C.red }}>
                ⚠ Trừ tồn ế team {fmtTr(L.phatTon)} {L.phatTon >= L.thuongTeamGross * 0.5 - 1 ? '(chạm trần 50% thưởng)' : ''} — hàng nhập &gt;45 ngày còn kẹt {fmtTr(te.von)}{te.loXa > 0 ? ` + lỗ xả ${fmtTr(te.loXa)}` : ''}. Bán ≥ hoà vốn để hết trừ.
              </div>
            )}
            {isCEO && (
              <div style={{ marginTop: 10, padding: '9px 12px', background: 'rgba(122,169,239,0.07)', border: '1px solid #25324a', borderRadius: 10, fontSize: 12, color: C.blue }}>
                🔒 Thật ({cfg.tgReal}): doanh thu ~{fmtTr(realRevenue(f.dt, cfg))} · <b>net thật ~{fmtTr(realNet(f.dt, f.net, cfg))}</b> · trả lương team {fmtTr(L.luongTeam)}
              </div>
            )}
          </div>
        )
      })}

      {isCEO && <CeoConfigPanel cfg={cfg} onSave={setCfg} by={myMember?.email} />}

      {isCEO && teamTokens.length > 0 && <TonElePanel teams={teamTokens} map={tonEle} onSave={setTonEle} by={myMember?.email} />}

      {isCEO && ceo.rev > 0 && (
        <div style={{ ...panelStyle, border: `1px solid ${ceo.bufferPct < cfg.buffer ? C.red : '#25324a'}` }}>
          <div style={{ ...eyebrowStyle, color: C.blue }}>🔒 BUỒNG LÁI CEO (toàn công ty · số thật)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(168px,1fr))', gap: 10 }}>
            {[
              { l: 'Net thật', v: fmtTr(ceo.rn) },
              { l: '− Lương trả', v: fmtTr(ceo.luong) },
              { l: '− Overhead', v: fmtTr(ceo.overhead) },
              { l: '= CEO giữ', v: fmtTr(ceo.giu), c: ceo.giu < 0 ? C.red : C.green },
              { l: 'Buffer / DT', v: fmtPct(ceo.bufferPct), c: ceo.bufferPct < cfg.buffer ? C.red : C.green },
            ].map((k) => (
              <div key={k.l} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.muted, marginBottom: 4 }}>{k.l}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: k.c ?? C.text, whiteSpace: 'nowrap' }}>{k.v}</div>
              </div>
            ))}
          </div>
          {ceo.bufferPct < cfg.buffer && (
            <div style={{ marginTop: 8, fontSize: 12, color: C.red, fontWeight: 600 }}>⚠ Buffer dưới {fmtPct(cfg.buffer)} — lương + overhead ăn quá sâu vào lãi thật. Cần đẩy DT hoặc ghìm chi phí.</div>
          )}
        </div>
      )}

      {/* 3 bảng mốc đối chiếu */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 14 }}>
        {[
          { t: '① CỨNG / NGƯỜI (DT team)', rows: [['< 500tr', '8tr'], ['500tr–1 tỷ', '10tr'], ['1–1,5 tỷ', '12tr'], ['1,5–2 tỷ', '14tr'], ['2–2,5 tỷ', '16tr'], ['2,5–3 tỷ', '18tr'], ['≥ 3 tỷ', '20tr']] },
          { t: '② THƯỞNG LŨY TIẾN (net)', rows: [['0–20tr', '10%'], ['20–50tr', '15%'], ['50–100tr', '20%'], ['100tr +', '25%']] },
          { t: '③ HỆ SỐ CPQC', rows: [['< 30%', '×1.2'], ['30–34%', '×1.1'], ['34–38%', '×1.0'], ['> 38%', '×0.8']] },
          { t: '④ PHẠT TỒN Ế (trừ thưởng)', rows: [['Hàng >45 ngày còn kẹt', '−8%/tháng'], ['Bán DƯỚI vốn (xả lỗ)', '−50% lỗ'], ['Bán ≥ hoà vốn', 'hết trừ ✓'], ['Trần trừ tối đa', '50% thưởng']] },
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
  const [von, setVon] = useState(0)
  const [loXa, setLoXa] = useState(0)
  const L = tinhLuong({ dtSauHoan: dt * TR, net: net * TR, cpqc: cpqc / 100, vonTonEle: von * TR, loXa: loXa * TR })
  const inp: React.CSSProperties = { width: '100%', background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 8, padding: '9px 11px', fontSize: 14 }
  return (
    <div style={panelStyle}>
      <div style={eyebrowStyle}>🧮 BẢNG NHÁP — tự điền thử</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 12 }}>
        <label style={{ fontSize: 12, color: C.muted2 }}>DT team sau hoàn (triệu)<input type="number" value={dt} step={100} onChange={(e) => setDt(+e.target.value)} style={{ ...inp, marginTop: 4 }} /></label>
        <label style={{ fontSize: 12, color: C.muted2 }}>Net team (triệu)<input type="number" value={net} step={10} onChange={(e) => setNet(+e.target.value)} style={{ ...inp, marginTop: 4 }} /></label>
        <label style={{ fontSize: 12, color: C.muted2 }}>CPQC team (%)<input type="number" value={cpqc} step={1} onChange={(e) => setCpqc(+e.target.value)} style={{ ...inp, marginTop: 4 }} /></label>
        <label style={{ fontSize: 12, color: C.red }}>Vốn tồn &gt;45 ngày (triệu)<input type="number" value={von} step={5} onChange={(e) => setVon(+e.target.value)} style={{ ...inp, marginTop: 4 }} /></label>
        <label style={{ fontSize: 12, color: C.red }}>Lỗ xả bán dưới vốn (triệu)<input type="number" value={loXa} step={5} onChange={(e) => setLoXa(+e.target.value)} style={{ ...inp, marginTop: 4 }} /></label>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 12px', background: C.panel2, borderRadius: 10 }}>
        <span style={{ fontSize: 13, color: C.muted2 }}>Cứng {fmtTr(L.cung)} + Thưởng {net < 0 ? '0đ' : fmtTr(L.thuongNguoi)} ({net < 0 ? 'net âm' : `${L.heLabel}`}){L.phatTon > 0 ? <span style={{ color: C.red }}> − phạt tồn ế {fmtTr(L.phatTon / 2)}/người</span> : ''}</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: C.gold, whiteSpace: 'nowrap' }}>{fmtTr(L.luongNguoi)} /người</span>
      </div>
    </div>
  )
}

// ── Ô CEO nhập tồn ế / team (giá vốn hàng >45 ngày còn kẹt + lỗ xả) ───────────
function TonElePanel({ teams, map, onSave, by }: { teams: string[]; map: TonEleMap; onSave: (m: TonEleMap) => void; by?: string }) {
  const [open, setOpen] = useState(false)
  const [d, setD] = useState<TonEleMap>(map)
  const [state, setState] = useState<'idle' | 'saving' | 'ok' | 'local'>('idle')
  useEffect(() => { if (!open) setD(map) }, [map, open])

  const dirty = JSON.stringify(d) !== JSON.stringify(map)
  const get = (t: string) => d[t] ?? { von: 0, loXa: 0 }
  const set = (t: string, patch: Partial<{ von: number; loXa: number }>) => setD({ ...d, [t]: { ...get(t), ...patch } })
  const inp: React.CSSProperties = { width: '100%', background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 8, padding: '8px 10px', fontSize: 14, marginTop: 4 }
  const lbl: React.CSSProperties = { fontSize: 11.5, color: C.muted2 }

  async function save() { setState('saving'); const ok = await saveTonEle(d, by); onSave(d); setState(ok ? 'ok' : 'local') }

  return (
    <div style={{ ...panelStyle, border: `1px solid ${dirty ? '#4a2015' : C.line}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <div style={{ ...eyebrowStyle, color: C.red, marginBottom: 0 }}>⚠ TỒN Ế / TEAM (CEO nhập — trừ 8%/tháng vào thưởng)</div>
        <span style={{ fontSize: 12, color: C.muted }}>{open ? '▲ thu gọn' : '▼ mở nhập'}</span>
      </div>
      {open && (
        <>
          <div style={{ fontSize: 11.5, color: C.muted, margin: '10px 0 12px', lineHeight: 1.6 }}>
            Nhập <b style={{ color: C.muted2 }}>giá vốn hàng team đề xuất nhập, quá 45 ngày còn kẹt kho</b> → tự trừ 8%/tháng vào thưởng team. Nếu team <b style={{ color: C.muted2 }}>bán DƯỚI vốn để xả</b> thì nhập phần lỗ → trừ thêm 50%. Bán ≥ hoà vốn thì để 0. Số VNĐ nhập theo <b>triệu</b>.
          </div>
          {teams.map((t) => (
            <div key={t} style={{ display: 'grid', gridTemplateColumns: '80px repeat(auto-fit,minmax(140px,1fr))', gap: 12, alignItems: 'end', marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.gold, paddingBottom: 8 }}>{t}</div>
              <label style={lbl}>Vốn tồn &gt;45 ngày (triệu)
                <input type="number" step={5} value={+(get(t).von / TR).toFixed(2)} onChange={(e) => set(t, { von: +e.target.value * TR })} style={inp} /></label>
              <label style={lbl}>Lỗ xả bán dưới vốn (triệu)
                <input type="number" step={5} value={+(get(t).loXa / TR).toFixed(2)} onChange={(e) => set(t, { loXa: +e.target.value * TR })} style={inp} /></label>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            <button onClick={() => void save()} disabled={!dirty || state === 'saving'}
              style={{ background: dirty ? C.gold : '#2a2f3d', color: dirty ? '#1a1205' : C.muted, border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: dirty ? 'pointer' : 'default' }}>
              {state === 'saving' ? 'Đang lưu…' : 'Lưu tồn ế'}
            </button>
            {dirty && <button onClick={() => setD(map)} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.line}`, borderRadius: 8, padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}>Hoàn tác</button>}
            {!dirty && state === 'ok' && <span style={{ fontSize: 12.5, color: C.green }}>✓ Đã lưu — cả team thấy phạt</span>}
            {!dirty && state === 'local' && <span style={{ fontSize: 12.5, color: C.amber }}>⚠ Supabase lỗi — chỉ lưu máy này (kiểm tra cột ton_ele)</span>}
          </div>
        </>
      )}
    </div>
  )
}

// ── Ô chỉnh config CEO (số thật ẩn) — chỉ CEO render ─────────────────────────
function CeoConfigPanel({ cfg, onSave, by }: { cfg: CeoCfg; onSave: (c: CeoCfg) => void; by?: string }) {
  const [open, setOpen] = useState(false)
  const [d, setD] = useState<CeoCfg>(cfg)
  const [state, setState] = useState<'idle' | 'saving' | 'ok' | 'local'>('idle')
  // cfg đổi (load xong) → đồng bộ draft khi chưa mở chỉnh.
  useEffect(() => { if (!open) setD(cfg) }, [cfg, open])

  const dirty = JSON.stringify(d) !== JSON.stringify(cfg)
  const inp: React.CSSProperties = { width: '100%', background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 8, padding: '8px 10px', fontSize: 14, marginTop: 4 }
  const ro: React.CSSProperties = { ...inp, color: C.muted, background: '#0a0d15', cursor: 'not-allowed' }
  const lbl: React.CSSProperties = { fontSize: 11.5, color: C.muted2 }

  async function save() {
    setState('saving')
    const ok = await saveCeoCfg(d, by)
    onSave(d)
    setState(ok ? 'ok' : 'local')
  }

  return (
    <div style={{ ...panelStyle, border: `1px solid ${dirty ? '#4a4015' : C.line}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <div style={{ ...eyebrowStyle, color: C.blue, marginBottom: 0 }}>🔧 CẤU HÌNH CEO (ẩn · số thật)</div>
        <span style={{ fontSize: 12, color: C.muted }}>{open ? '▲ thu gọn' : '▼ mở chỉnh'}</span>
      </div>
      {open && (
        <>
          <div style={{ fontSize: 11.5, color: C.muted, margin: '10px 0 12px', lineHeight: 1.6 }}>
            Số <b style={{ color: C.muted2 }}>THẬT</b> chỉ CEO thấy & chỉnh — dùng cho Buồng lái + dòng khoá thật mỗi team. Nhóm <b style={{ color: C.muted2 }}>"thổi"</b> (nhân viên xem) khoá theo sheet kế toán.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
            <label style={lbl}>Tỷ giá thật (VNĐ/RM)
              <input type="number" step={50} value={d.tgReal} onChange={(e) => setD({ ...d, tgReal: +e.target.value })} style={inp} /></label>
            <label style={lbl}>CPVC thật (%)
              <input type="number" step={0.5} value={+(d.cpvcThat * 100).toFixed(2)} onChange={(e) => setD({ ...d, cpvcThat: +e.target.value / 100 })} style={inp} /></label>
            <label style={lbl}>CPVH thật (%)
              <input type="number" step={0.5} value={+(d.cpvhThat * 100).toFixed(2)} onChange={(e) => setD({ ...d, cpvhThat: +e.target.value / 100 })} style={inp} /></label>
            <label style={lbl}>Buffer mục tiêu (%)
              <input type="number" step={1} value={+(d.buffer * 100).toFixed(2)} onChange={(e) => setD({ ...d, buffer: +e.target.value / 100 })} style={inp} /></label>
            <label style={lbl}>Overhead / tháng (triệu)
              <input type="number" step={10} value={+(d.overhead / TR).toFixed(2)} onChange={(e) => setD({ ...d, overhead: +e.target.value * TR })} style={inp} /></label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginTop: 12 }}>
            <label style={lbl}>Tỷ giá thổi (NV xem)
              <input type="number" value={d.tgVisible} readOnly disabled style={ro} /></label>
            <label style={lbl}>CPVC thổi (%)
              <input type="number" value={+(d.cpvcThoi * 100).toFixed(2)} readOnly disabled style={ro} /></label>
            <label style={lbl}>CPVH thổi (%)
              <input type="number" value={+(d.cpvhThoi * 100).toFixed(2)} readOnly disabled style={ro} /></label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
            <button onClick={() => void save()} disabled={!dirty || state === 'saving'}
              style={{ background: dirty ? C.gold : '#2a2f3d', color: dirty ? '#1a1205' : C.muted, border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: dirty ? 'pointer' : 'default' }}>
              {state === 'saving' ? 'Đang lưu…' : 'Lưu cấu hình'}
            </button>
            {dirty && <button onClick={() => setD(cfg)} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.line}`, borderRadius: 8, padding: '9px 14px', fontSize: 13, cursor: 'pointer' }}>Hoàn tác</button>}
            {!dirty && state === 'ok' && <span style={{ fontSize: 12.5, color: C.green }}>✓ Đã lưu — đồng bộ mọi máy CEO</span>}
            {!dirty && state === 'local' && <span style={{ fontSize: 12.5, color: C.amber }}>⚠ Supabase lỗi — chỉ lưu máy này (kiểm tra cột ceo_cfg)</span>}
          </div>
        </>
      )}
    </div>
  )
}
