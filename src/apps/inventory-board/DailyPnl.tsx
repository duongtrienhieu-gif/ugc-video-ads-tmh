// ── 📊 LÃI/LỖ NGÀY — SỐ THẬT (đơn WhatsApp bot chốt) ─────────────────────────
// Vòng lặp hằng ngày: app tự đọc Sheet ĐƠN WHATSAPP (qua /api/inventory-board
// {waOrders:true}) → ra số đơn + tổng RM + số HỘP giao; user chỉ dán 1 ô TIỀN ADS
// hôm nay (copy từ Ads Manager) → tính lãi/lỗ bằng ĐÚNG công thức + hằng số của
// Máy tính giá bên dưới (giá vốn/%hoàn/%ship/%VH/tỷ giá — không chế công thức mới).
// Lịch sử lưu board_cache(id='daily-pnl') dùng chung mọi máy (best-effort + localStorage).
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { type InvItem } from './profitCalc'

const C = {
  panel: '#0c111c', panel2: '#0a0f19', line: '#1b2233', line2: '#161d2c',
  gold: '#f5c451', text: '#eef1f7', muted: '#74809a', muted2: '#aeb8cc',
  red: '#ff4d5e', amber: '#fbbf24', green: '#4ade80',
}
const fmtMoney = (n: number) => Math.round(n).toLocaleString('vi-VN') + 'đ'
const fmtPct = (n: number) => (n * 100).toFixed(1) + '%'

interface WaOrder { team: string; product: string; date: string; totalRM: number; units: number | null; items: string }
export interface PnlHistRow {
  date: string; product: string; spend: number; soDon: number; rm: number; units: number
  dtVnd: number; lnVnd: number; lnPct: number; adsPct: number; savedAt: string
}

const LS_KEY = 'tmh_daily_pnl_hist'
const FALLBACK_UNITS = 2 // đơn không đọc được combo → tạm tính 2 hộp (gói phổ biến nhất) + hiện cảnh báo

async function loadHist(): Promise<PnlHistRow[]> {
  try {
    const { data, error } = await supabase.from('board_cache').select('payload').eq('id', 'daily-pnl').maybeSingle()
    const rows = (data?.payload as { rows?: PnlHistRow[] } | null)?.rows
    if (!error && Array.isArray(rows)) {
      try { localStorage.setItem(LS_KEY, JSON.stringify(rows)) } catch { /* quota */ }
      return rows
    }
  } catch { /* fall through */ }
  try { const s = localStorage.getItem(LS_KEY); if (s) return JSON.parse(s) as PnlHistRow[] } catch { /* parse */ }
  return []
}
async function saveHist(rows: PnlHistRow[]): Promise<boolean> {
  try { localStorage.setItem(LS_KEY, JSON.stringify(rows)) } catch { /* quota */ }
  try {
    const { error } = await supabase.from('board_cache').upsert({ id: 'daily-pnl', payload: { rows }, updated_at: new Date().toISOString() })
    return !error
  } catch { return false }
}

const CFG_KEY = 'tmh_daily_pnl_cfg' // nhớ SP kho + giá vốn + %hoàn đã chọn — hôm sau mở là sẵn

export default function DailyPnl({ inv, priceVnd, shipPct, vanHanhPct, lnTargetPct, tyGia, isMobile }: {
  inv: InvItem[]; priceVnd: Record<string, number>; shipPct: number; vanHanhPct: number; lnTargetPct: number; tyGia: number; isMobile: boolean
}) {
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  const [orders, setOrders] = useState<WaOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [date, setDate] = useState(todayISO())
  const [prodFilter, setProdFilter] = useState('')
  const [spend, setSpend] = useState(0)
  const [hist, setHist] = useState<PnlHistRow[]>([])
  const [saveMsg, setSaveMsg] = useState('')

  // Giá vốn + %hoàn CỦA RIÊNG khối này (không phụ thuộc Máy tính giá bên dưới):
  // chọn SP kho → tự điền giá vốn từ file KHO (đủ full catalog, kể cả SP mới chưa lên báo cáo);
  // %hoàn chỉnh tay ngay tại chỗ (mặc định 30% ước tính kênh WhatsApp).
  const [khoPick, setKhoPick] = useState('')
  const [giaVon, setGiaVon] = useState(0)
  const [hoanPct, setHoanPct] = useState(0.30)
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(CFG_KEY) || 'null') as { khoPick?: string; giaVon?: number; hoanPct?: number } | null
      if (s) { if (s.khoPick) setKhoPick(s.khoPick); if (s.giaVon && s.giaVon > 0) setGiaVon(s.giaVon); if (s.hoanPct && s.hoanPct > 0) setHoanPct(s.hoanPct) }
    } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    try { localStorage.setItem(CFG_KEY, JSON.stringify({ khoPick, giaVon, hoanPct })) } catch { /* quota */ }
  }, [khoPick, giaVon, hoanPct])
  function pickKho(ten: string) {
    setKhoPick(ten)
    if (!ten) return
    const key = ten.trim().toUpperCase()
    const it = inv.find((x) => x.ten.trim().toUpperCase() === key)
    const gv = (priceVnd[key] ?? 0) || it?.giaVonVnd || (it ? it.giaVonRM * tyGia : 0)
    if (gv > 0) setGiaVon(Math.round(gv))
  }

  async function fetchOrders() {
    setLoading(true); setErr('')
    try {
      const r = await fetch('/api/inventory-board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ waOrders: true }) })
      const j = (await r.json()) as { ok: boolean; orders?: WaOrder[]; errors?: string[] }
      setOrders(j.orders ?? [])
      if (j.errors?.length) setErr(j.errors.join(' · '))
      else if (!j.ok) setErr('Chưa đọc được đơn nào từ Sheet')
    } catch (e) { setErr((e as Error).message) }
    setLoading(false)
  }
  useEffect(() => { fetchOrders(); loadHist().then(setHist) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // đơn của ngày đang chọn (+ lọc SP nếu có)
  const dayAll = useMemo(() => orders.filter((o) => o.date === date), [orders, date])
  const prods = useMemo(() => Array.from(new Set(dayAll.map((o) => o.product).filter(Boolean))), [dayAll])
  const rows = useMemo(() => (prodFilter ? dayAll.filter((o) => o.product === prodFilter) : dayAll), [dayAll, prodFilter])

  const r = useMemo(() => {
    const soDon = rows.length
    const rm = rows.reduce((s, o) => s + o.totalRM, 0)
    const unknown = rows.filter((o) => o.units == null).length
    const units = rows.reduce((s, o) => s + (o.units ?? FALLBACK_UNITS), 0)
    const dtVnd = rm * tyGia
    const adsPct = dtVnd > 0 ? spend / dtVnd : 0
    const vonAfter = units * giaVon * (1 - hoanPct)
    const vonPct = dtVnd > 0 ? vonAfter / dtVnd : 0
    const lnPct = soDon > 0 ? 1 - adsPct - vonPct - shipPct - vanHanhPct - hoanPct : 0
    const lnVnd = lnPct * dtVnd
    const cpqcTarget = 1 - lnTargetPct - vonPct - shipPct - vanHanhPct - hoanPct
    const cpa = soDon > 0 ? spend / soDon : 0
    let den: { t: string; c: string }
    if (soDon === 0) den = { t: 'Chưa có đơn ngày này', c: C.muted }
    else if (spend <= 0) den = { t: 'Dán tiền ads để ra kết luận', c: C.muted }
    else if (lnPct < 0) den = { t: 'LỖ — giảm budget / đổi creative', c: C.red }
    else if (adsPct > cpqcTarget + 1e-9) den = { t: 'Có lãi nhưng dưới mục tiêu — tối ưu ads', c: C.amber }
    else den = { t: 'Đạt mục tiêu ✓ — giữ / scale được', c: C.green }
    return { soDon, rm, units, unknown, dtVnd, adsPct, vonPct, lnPct, lnVnd, cpqcTarget, cpa, den }
  }, [rows, spend, giaVon, hoanPct, shipPct, vanHanhPct, lnTargetPct, tyGia])

  async function onSave() {
    const row: PnlHistRow = {
      date, product: prodFilter || 'TẤT CẢ', spend, soDon: r.soDon, rm: r.rm, units: r.units,
      dtVnd: r.dtVnd, lnVnd: r.lnVnd, lnPct: r.lnPct, adsPct: r.adsPct, savedAt: new Date().toISOString(),
    }
    // upsert theo (ngày + SP) — lưu lại lần 2 trong ngày là đè, không nhân đôi
    const next = [...hist.filter((h) => !(h.date === row.date && h.product === row.product)), row]
      .sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 200)
    setHist(next)
    const ok = await saveHist(next)
    setSaveMsg(ok ? '✓ đã lưu (mọi máy đều thấy)' : '✓ lưu máy này (Supabase lỗi — sẽ đồng bộ lần sau)')
    setTimeout(() => setSaveMsg(''), 4000)
  }

  const histShow = hist.slice(0, 7)
  const hist7Ln = histShow.reduce((s, h) => s + h.lnVnd, 0)

  const cellInput: React.CSSProperties = { width: '100%', background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 8, padding: '9px 11px', fontSize: 14 }
  const kpi = (l: string, v: string, c?: string) => (
    <div key={l} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, letterSpacing: 1, color: C.muted, marginBottom: 5 }}>{l}</div>
      <div style={{ fontSize: 17, fontWeight: 600, color: c ?? C.text }}>{v}</div>
    </div>
  )

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 20px', marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.3, color: C.gold }}>📊 LÃI/LỖ NGÀY — số THẬT từ đơn WhatsApp</div>
        <button onClick={fetchOrders} disabled={loading} style={{ background: 'transparent', color: C.muted2, border: `1px solid ${C.line}`, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
          {loading ? 'đang đọc Sheet…' : '↻ Tải lại đơn'}
        </button>
      </div>

      {/* chọn ngày + SP + dán tiền ads */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 12 }}>
        <label style={{ fontSize: 12, color: C.muted2 }}>Ngày
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...cellInput, marginTop: 4, colorScheme: 'dark' }} />
        </label>
        <label style={{ fontSize: 12, color: C.muted2 }}>Sản phẩm (theo Sheet)
          <select value={prodFilter} onChange={(e) => setProdFilter(e.target.value)} style={{ ...cellInput, marginTop: 4 }}>
            <option value="">— tất cả ({dayAll.length} đơn) —</option>
            {prods.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, color: C.muted2, gridColumn: isMobile ? '1 / -1' : undefined }}>⭐ Tiền ads hôm đó (VNĐ — copy từ Ads Manager)
          <input type="number" value={spend || ''} step={10000} placeholder="ví dụ 781908" onChange={(e) => setSpend(+e.target.value || 0)}
            style={{ ...cellInput, marginTop: 4, background: 'rgba(245,196,81,0.06)', border: '1px solid #3a3414' }} />
        </label>
      </div>

      {/* giá vốn từ KHO + %hoàn chỉnh tay — của riêng khối này, app tự nhớ cho lần sau */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 12 }}>
        <label style={{ fontSize: 12, color: C.muted2, gridColumn: isMobile ? '1 / -1' : undefined }}>📦 SP trong KHO (lấy giá vốn — đủ cả SP mới)
          <select value={khoPick} onChange={(e) => pickKho(e.target.value)} style={{ ...cellInput, marginTop: 4 }}>
            <option value="">— chọn để tự điền giá vốn từ file KHO —</option>
            {[...inv].sort((a, b) => a.ten.localeCompare(b.ten)).map((it) => <option key={it.ten} value={it.ten}>{it.ten}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, color: C.muted2 }}>Giá vốn / 1 hộp (VNĐ)
          <input type="number" value={giaVon || ''} step={1000} placeholder="chọn SP kho ↑" onChange={(e) => setGiaVon(+e.target.value || 0)}
            style={{ ...cellInput, marginTop: 4, background: 'rgba(245,196,81,0.06)', border: '1px solid #3a3414' }} />
        </label>
        <label style={{ fontSize: 12, color: C.muted2 }}>Tỷ lệ HOÀN ước tính (%)
          <input type="number" value={+(hoanPct * 100).toFixed(1)} step={1} onChange={(e) => setHoanPct((+e.target.value || 0) / 100)}
            style={{ ...cellInput, marginTop: 4, background: 'rgba(245,196,81,0.06)', border: '1px solid #3a3414' }} />
        </label>
      </div>
      {giaVon <= 0 && <div style={{ fontSize: 12, color: C.amber, marginBottom: 10 }}>⚠ Chưa có giá vốn — chọn SP trong KHO ở trên (hoặc gõ tay) thì lãi/lỗ mới đúng.</div>}

      {err && <div style={{ fontSize: 12, color: C.amber, marginBottom: 10 }}>⚠ {err}</div>}

      {/* số đọc từ Sheet */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 12 }}>
        {kpi('SỐ ĐƠN CHỐT', String(r.soDon), C.gold)}
        {kpi('DOANH SỐ (RM)', `RM${r.rm}`)}
        {kpi('HỘP GIAO (tính vốn)', String(r.units))}
        {kpi('DOANH SỐ (VNĐ)', fmtMoney(r.dtVnd))}
        {kpi('CPA THẬT / ĐƠN', r.cpa > 0 ? fmtMoney(r.cpa) : '—', C.gold)}
      </div>
      {r.unknown > 0 && <div style={{ fontSize: 11, color: C.amber, marginBottom: 10 }}>⚠ {r.unknown} đơn không đọc được combo → tạm tính {FALLBACK_UNITS} hộp/đơn.</div>}

      {/* kết luận */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.4fr', gap: 10, alignItems: 'stretch' }}>
        <div style={{ background: C.panel2, border: '1px solid #4a4015', borderRadius: 10, padding: '12px 14px' }}>
          {[
            ['🎯 %CPQC thật', fmtPct(r.adsPct), r.adsPct > r.cpqcTarget ? C.red : C.green],
            ['ngưỡng mục tiêu', fmtPct(Math.max(0, r.cpqcTarget)), C.muted2],
            ['= LỢI NHUẬN (%)', fmtPct(r.lnPct), r.lnPct < 0 ? C.red : r.lnPct < lnTargetPct ? C.amber : C.green],
          ].map(([l, v, c]) => (
            <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13.5 }}>
              <span style={{ color: C.muted2 }}>{l}</span><span style={{ color: c as string, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 0', borderTop: `1px solid ${C.line2}`, fontSize: 15 }}>
            <span style={{ color: C.text, fontWeight: 600 }}>→ LÃI/LỖ ngày (VNĐ)</span>
            <span style={{ color: r.lnVnd < 0 ? C.red : C.green, fontWeight: 700, fontSize: 18 }}>{r.soDon > 0 && spend > 0 ? fmtMoney(r.lnVnd) : '—'}</span>
          </div>
        </div>
        <div style={{ border: `1px solid ${r.den.c}`, borderRadius: 10, padding: '12px 14px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1, color: C.muted, marginBottom: 5 }}>KẾT LUẬN NGÀY</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: r.den.c }}>● {r.den.t}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
              Đang tính: giá vốn {fmtMoney(giaVon)}/hộp{khoPick ? ` (${khoPick})` : ''} · hoàn {fmtPct(hoanPct)} · ship {fmtPct(shipPct)} · VH {fmtPct(vanHanhPct)} (ship/VH theo Máy tính giá bên dưới).
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={onSave} disabled={r.soDon === 0 || spend <= 0}
              style={{ background: r.soDon > 0 && spend > 0 ? C.gold : C.line, color: '#1a1405', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              💾 Lưu ngày này
            </button>
            {saveMsg && <span style={{ fontSize: 12, color: C.green }}>{saveMsg}</span>}
          </div>
        </div>
      </div>

      {/* lịch sử 7 dòng gần nhất */}
      {histShow.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: 1, color: C.muted, marginBottom: 6 }}>
            LỊCH SỬ ĐÃ LƯU (7 gần nhất) · tổng lãi: <b style={{ color: hist7Ln < 0 ? C.red : C.green }}>{fmtMoney(hist7Ln)}</b>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 560 }}>
              <thead>
                <tr style={{ color: C.muted, fontSize: 10, letterSpacing: 1 }}>
                  {['NGÀY', 'SP', 'ĐƠN', 'RM', 'ADS (VNĐ)', '%CPQC', 'LÃI/LỖ (VNĐ)'].map((h) => <th key={h} style={{ textAlign: h === 'NGÀY' || h === 'SP' ? 'left' : 'right', padding: '5px 8px', fontWeight: 400 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {histShow.map((h) => (
                  <tr key={`${h.date}|${h.product}`} style={{ borderTop: `1px solid ${C.line2}` }}>
                    <td style={{ padding: '6px 8px', color: C.muted2 }}>{h.date.slice(5)}</td>
                    <td style={{ padding: '6px 8px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.product}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{h.soDon}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{h.rm}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmtMoney(h.spend)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: C.muted2 }}>{fmtPct(h.adsPct)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: h.lnVnd < 0 ? C.red : C.green }}>{fmtMoney(h.lnVnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
