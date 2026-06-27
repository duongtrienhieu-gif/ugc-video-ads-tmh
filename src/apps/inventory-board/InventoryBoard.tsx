// ── KHO & ĐỀ XUẤT NHẬP HÀNG ──────────────────────────────────────────────────
// Bê cụm "Hàng hóa & Vận hành" (Đề xuất nhập hàng + Bom tỉnh + Tồn kho cảnh báo)
// từ dashboard bao-cao-cty sang UGC Lab cho nhân viên xem. Read-only.
// Dữ liệu lấy qua serverless /api/inventory-board (đọc 6 Google Sheet công khai).
// Logic restock + invRows port nguyên văn từ dashboard.tsx (đã verify ~20 vòng).
// Tỷ giá cố định 6500, giá vốn gốc file 5800 (BOOK_RATE) — bỏ 3 ô input của dashboard.
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import PriceCalc from './PriceCalc'

const TY_GIA = 6500
const PACK_FACTOR = (name: string) => (name.trim().toUpperCase() === 'KNEE PAD' ? 2 : 1)

const C = {
  bg: '#070a12', panel: '#0c111c', panel2: '#0a0f19', line: '#1b2233', line2: '#161d2c',
  gold: '#f5c451', text: '#eef1f7', muted: '#74809a', muted2: '#aeb8cc',
  red: '#ff4d5e', amber: '#fbbf24', green: '#4ade80',
}

const fmtMoney = (n: number) => Math.round(n).toLocaleString('vi-VN') + 'đ'
const fmtPct = (n: number) => (n * 100).toFixed(1) + '%'

// ── nguồn dữ liệu (có ô sửa link như dashboard) ──────────────────────────────
const SOURCE_DEFS: { key: string; label: string }[] = [
  { key: 'tong', label: 'File TỔNG (theo sản phẩm)' },
  { key: 'qlhb', label: 'File QLHB (hoàn / tỉnh)' },
  { key: 'kho', label: 'File KHO (tồn kho)' },
  { key: 'sale', label: 'File SALE (chốt theo ngày — tốc độ bán)' },
  { key: 'nhaphang', label: 'File NHẬP HÀNG (đơn đang về — sheet Báo giá & thanh toán)' },
  { key: 'noton', label: 'File SALE NỢ ĐƠN (sheet Tồn kho dự kiến — SP nợ chưa gửi)' },
]
const DEFAULT_SOURCES: Record<string, string> = {
  tong: 'https://docs.google.com/spreadsheets/d/19KaRjRgg0YhT8RBFfDbI25iF9wp7HKxaFZaqiS6ObfU/edit',
  qlhb: 'https://docs.google.com/spreadsheets/d/1pUpdOh1mzJDtbaRRfQ55AciUJibqtRSYp1atRyW6_PM/edit',
  kho: 'https://docs.google.com/spreadsheets/d/1Bf5KPkPkM5VXs_W5xzjSpsri0YmdmxqguMbZZxkC9Fs/edit',
  sale: 'https://docs.google.com/spreadsheets/d/1vSy4LHxx6WeFysdMJNT0c7473RNmpo8bKuRZvMueqtE/edit',
  nhaphang: 'https://docs.google.com/spreadsheets/d/1amJrEI5Z279_4ALWIco3oZETrB4F77cpkD1zSXENrg8/edit',
  noton: 'https://docs.google.com/spreadsheets/d/18OdPLkDSLuzKhuO1VheLzkAM0K7xHEoepxhy4JNlYAI/edit',
}
const STORAGE_KEY = 'inv_board_sources'

// ── kiểu dữ liệu trả về từ endpoint ──────────────────────────────────────────
interface Prod { name: string; rmRevenue: number; cpqc: number; pctCpqc: number; pctHoan: number; c2: number }
interface InvItem { ten: string; ton: number; ban: number; giaVonRM: number; giaVonVnd: number }
interface Incoming { ma: string; qty: number; order: string; eta: string }
interface BackorderItem { ma: string; donNo: number; spNo: number; ton: number; tonDuKien: number }
interface Province { ten: string; doanhSoRM: number; hoanRate: number }
interface BoardData {
  ok: boolean
  products: Prod[]
  inv: InvItem[]
  velocity: Record<string, number>
  incoming: Incoming[]
  priceVnd: Record<string, number>
  backorder: BackorderItem[]
  provinces: Province[]
  errors: string[]
}

// ── bảng responsive (port từ dashboard) ──────────────────────────────────────
type Col<T> = { label: string; node: (r: T) => ReactNode; center?: boolean }
function RespTable<T>({ cols, data, mobile }: { cols: Col<T>[]; data: T[]; mobile: boolean }) {
  if (mobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map((r, i) => (
          <div key={i} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{cols[0].node(r)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px' }}>
              {cols.slice(1).map((c, j) => (
                <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, gap: 6 }}>
                  <span style={{ color: C.muted }}>{c.label}</span>
                  <span style={{ textAlign: 'right' }}>{c.node(r)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ color: C.muted, fontSize: 10, letterSpacing: 1 }}>
            {cols.map((c, j) => (
              <th key={j} style={{ padding: '6px 0', fontWeight: 400, textAlign: c.center ? 'center' : j === 0 ? 'left' : 'right' }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${C.line2}` }}>
              {cols.map((c, j) => (
                <td key={j} style={{ padding: '9px 0', textAlign: c.center ? 'center' : j === 0 ? 'left' : 'right', fontWeight: j === 0 ? 600 : 400 }}>{c.node(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const panelStyle: React.CSSProperties = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 20px', marginBottom: 14 }
const eyebrowStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, letterSpacing: 0.3, color: C.gold }

export default function InventoryBoard() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const f = () => setIsMobile(window.innerWidth < 700)
    f(); window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])

  const [tab, setTab] = useState<'kho' | 'calc'>('kho')
  const [sources, setSources] = useState<Record<string, string>>({})
  const [showCfg, setShowCfg] = useState(false)
  const [saved, setSaved] = useState(false)
  const [data, setData] = useState<BoardData | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'live' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')
  const [lastUpdate, setLastUpdate] = useState('')

  async function load(s: Record<string, string>) {
    setStatus('loading'); setErrMsg('')
    try {
      const r = await fetch('/api/inventory-board', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: s }), cache: 'no-store',
      })
      const j: BoardData = await r.json()
      if (!j.ok && !j.products?.length && !j.inv?.length) throw new Error(j.errors?.join(' · ') || 'Không tải được dữ liệu')
      setData(j)
      setStatus('live')
      setLastUpdate(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }))
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Lỗi tải dữ liệu')
      setStatus('error')
    }
  }

  useEffect(() => {
    let saved: Record<string, string> = {}
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { /* ignore */ }
    const s = { ...DEFAULT_SOURCES, ...saved }
    setSources(s)
    void load(s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // tự làm mới mỗi 5 phút
  useEffect(() => {
    if (!Object.keys(sources).length) return
    const id = setInterval(() => void load(sources), 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [sources])

  function saveSources() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sources))
    setSaved(true); setTimeout(() => setSaved(false), 2000)
    void load(sources)
  }

  const products = data?.products ?? []
  const inv = data?.inv ?? []
  const velocity = data?.velocity ?? {}
  const incoming = data?.incoming ?? []
  const priceVnd = data?.priceVnd ?? {}
  const provinces = data?.provinces ?? []
  const backorder = useMemo(() => {
    const m: Record<string, { donNo: number; spNo: number }> = {}
    ;(data?.backorder ?? []).forEach((x) => { m[x.ma] = { donNo: x.donNo, spNo: x.spNo } })
    return m
  }, [data])

  // ── TỒN KHO: cảnh báo sắp hết / ế (port từ dashboard invRows) ──────────────
  const invRows = useMemo(() => {
    const order = (t: string) => (t === 'Sắp hết' ? 0 : 1)
    return inv.map((it) => {
      const value = it.ton * it.giaVonRM * TY_GIA
      const st = it.ban > 0 && it.ton < it.ban * 0.3 ? { t: 'Sắp hết', c: C.red } : it.ban === 0 && it.ton > 0 ? { t: 'Ế/đọng', c: C.muted2 } : { t: 'OK', c: C.green }
      return { ...it, value, st }
    }).filter((r) => r.st.t !== 'OK').sort((a, b) => order(a.st.t) - order(b.st.t) || b.value - a.value).slice(0, 20)
  }, [inv])

  // ── ĐỀ XUẤT NHẬP HÀNG (port nguyên văn từ dashboard restock) ───────────────
  const restock = useMemo(() => {
    const LEAD = 8, SAFETY = 7, CYCLE = 30
    const days = new Date().getDate() || 24
    const invMap = new Map(inv.map((it) => [it.ten.trim().toUpperCase(), it]))
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const etaDays = (iso: string) => { if (!iso) return 999; const d = new Date(iso + 'T00:00:00'); return Math.round((d.getTime() - today.getTime()) / 86400000) }
    const incMap = new Map<string, { qty: number; etaDays: number; eta: string }[]>()
    incoming.forEach((x) => { const k = x.ma.trim().toUpperCase(); const a = incMap.get(k) || []; a.push({ qty: x.qty * PACK_FACTOR(k), etaDays: etaDays(x.eta), eta: x.eta }); incMap.set(k, a) })
    return products.map((p) => {
      const key = p.name.trim().toUpperCase()
      const it = invMap.get(key)
      const ton = it ? it.ton : 0
      const spNo = backorder[key]?.spNo ?? 0
      const donNo = backorder[key]?.donNo ?? 0
      const effTon = ton - spNo
      const vel = velocity[key] ?? (p.c2 > 0 ? p.c2 / days : 0)
      const cover = vel > 0 ? effTon / vel : effTon > 0 ? 999 : 0
      // GIÁ VỐN/CÁI — ưu tiên: GIÁ THỰC TẾ (cột E file nhập) → KHO cột N × tỷ giá. (Bỏ ước tính cogs vì không đọc file marketer.)
      const giaThucTe = (priceVnd[key] ?? 0) / PACK_FACTOR(key)
      const giaKhoRM = it?.giaVonRM ?? 0
      const giaReal = giaThucTe > 0 || giaKhoRM > 0
      const giaVonUnit = giaThucTe > 0 ? giaThucTe : giaKhoRM > 0 ? giaKhoRM * TY_GIA : 0
      const incList = incMap.get(key) || []
      const incQty = incList.reduce((s, x) => s + x.qty, 0)
      const etaMin = incList.length ? Math.min(...incList.map((x) => x.etaDays)) : null
      const incEta = incList.length ? incList.slice().sort((a, b) => a.etaDays - b.etaDays)[0].eta : ''
      const incLate = incList.some((x) => x.etaDays < 0)
      let act = 'Đủ', color = C.green, qty = 0, von = 0
      if (p.pctHoan > 0.4 && spNo === 0) { act = 'Hoàn cao — đẩy nốt / bỏ'; color = C.red }
      else if (vel > 0 && cover <= LEAD + SAFETY) {
        const need = Math.max(0, Math.round(vel * (LEAD + CYCLE) - effTon - incQty))
        if (incQty > 0) {
          if (incLate) { act = '⚠ Đơn về trễ — hỏi NCC'; color = C.red; qty = need }
          else if (etaMin != null && cover >= etaMin) { act = '📦 Đang về — chờ'; color = C.amber; qty = 0 }
          else { act = spNo > 0 ? '⚠ Nợ hàng — đặt bù gấp' : '⚠ Đứt trước khi về'; color = C.red; qty = need }
        } else { act = spNo > 0 ? '⚠ Nợ hàng — nhập gấp' : 'NHẬP GẤP'; color = C.red; qty = need }
        von = qty * giaVonUnit
      } else if (vel === 0 && effTon > 0) { act = 'Ế — thanh lý'; color = C.muted2 }
      return { name: p.name, ton, spNo, donNo, vel, cover, pctHoan: p.pctHoan, qty, von, giaUnit: giaVonUnit, giaReal, incQty, incEta, incLate, act, color }
    }).filter((r) => r.vel > 0 || r.ton > 0 || r.incQty > 0 || r.spNo > 0)
      .sort((a, b) => { const u = (x: string) => (x === 'NHẬP GẤP' || x.startsWith('⚠') ? 0 : 1); return u(a.act) - u(b.act) || a.cover - b.cover })
  }, [products, inv, velocity, incoming, priceVnd, backorder])

  // ── cột bảng (port từ dashboard) ───────────────────────────────────────────
  const restockCols: Col<(typeof restock)[number]>[] = [
    { label: 'SẢN PHẨM', node: (r) => r.name },
    { label: 'TỒN', node: (r) => <span style={{ color: C.muted2 }}>{Math.round(r.ton).toLocaleString('vi-VN')}</span> },
    { label: 'SP NỢ', node: (r) => r.spNo > 0 ? <span style={{ color: C.red, whiteSpace: 'nowrap' }} title={`${r.donNo} đơn chờ hàng`}>{Math.round(r.spNo).toLocaleString('vi-VN')}</span> : <span style={{ color: C.muted }}>—</span> },
    { label: 'BÁN/NGÀY', node: (r) => <span style={{ color: C.muted2 }}>{r.vel.toFixed(1)}</span> },
    { label: 'CÒN ~NGÀY', node: (r) => <span style={{ color: r.cover < 0 ? C.red : r.cover <= 15 ? C.red : r.cover <= 25 ? C.amber : C.muted2 }}>{r.cover < 0 ? 'ÂM' : r.cover >= 999 ? '∞' : Math.round(r.cover)}</span> },
    { label: '% HOÀN', node: (r) => <span style={{ color: r.pctHoan > 0.4 ? C.red : C.muted2 }}>{fmtPct(r.pctHoan)}</span> },
    { label: 'ĐANG VỀ', node: (r) => r.incQty > 0 ? <span style={{ color: r.incLate ? C.red : C.amber, fontSize: 12, whiteSpace: 'nowrap' }}>{r.incQty.toLocaleString('vi-VN')} · {r.incEta ? r.incEta.slice(8, 10) + '/' + r.incEta.slice(5, 7) : '?'}{r.incLate ? ' ⚠trễ' : ''}</span> : <span style={{ color: C.muted }}>—</span> },
    { label: 'ĐỀ XUẤT', center: true, node: (r) => <span style={{ color: r.color, border: `1px solid ${r.color}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, whiteSpace: 'nowrap' }}>{r.act}</span> },
    { label: 'NHẬP (CÁI)', node: (r) => <span style={{ color: r.qty > 0 ? C.gold : C.muted }}>{r.qty > 0 ? r.qty.toLocaleString('vi-VN') : '—'}</span> },
    { label: 'GIÁ/CÁI', node: (r) => <span style={{ color: r.qty > 0 ? (r.giaReal ? C.muted2 : C.amber) : C.muted }} title={r.giaReal ? 'giá vốn thật (giá thực tế file nhập / KHO)' : 'ước tính (chưa có giá thực tế)'}>{r.qty > 0 && r.giaUnit > 0 ? fmtMoney(r.giaUnit) + (r.giaReal ? '' : ' *') : '—'}</span> },
    { label: 'VỐN CẦN', node: (r) => <span style={{ color: r.von > 0 ? C.gold : C.muted }}>{r.von > 0 ? fmtMoney(r.von) : '—'}</span> },
  ]
  const invCols: Col<(typeof invRows)[number]>[] = [
    { label: 'SẢN PHẨM', node: (r) => r.ten },
    { label: 'TỒN', node: (r) => <span style={{ color: C.muted2 }}>{Math.round(r.ton).toLocaleString('vi-VN')}</span> },
    { label: 'ĐÃ BÁN', node: (r) => <span style={{ color: C.muted2 }}>{Math.round(r.ban).toLocaleString('vi-VN')}</span> },
    { label: 'GIÁ TRỊ TỒN', node: (r) => <span style={{ color: C.gold }}>{fmtMoney(r.value)}</span> },
    { label: 'TRẠNG THÁI', center: true, node: (r) => <span style={{ color: r.st.c, border: `1px solid ${r.st.c}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, whiteSpace: 'nowrap' }}>{r.st.t}</span> },
  ]
  const provCols: Col<Province>[] = [
    { label: 'TỈNH', node: (p) => p.ten },
    { label: 'DOANH SỐ', node: (p) => <span style={{ color: C.gold }}>{fmtMoney(p.doanhSoRM * TY_GIA)}</span> },
    { label: '% HOÀN', node: (p) => <span style={{ color: p.hoanRate > 0.45 ? C.red : p.hoanRate > 0.35 ? C.amber : C.muted2 }}>{fmtPct(p.hoanRate)}</span> },
    { label: 'KHUYẾN NGHỊ', center: true, node: (p) => {
        const st = p.hoanRate > 0.45 ? { t: 'Chặn COD / cọc', c: C.red } : p.hoanRate > 0.35 ? { t: 'Bắt cọc', c: C.amber } : p.hoanRate > 0.28 ? { t: 'Theo dõi', c: C.amber } : { t: 'OK', c: C.green }
        return <span style={{ color: st.c, border: `1px solid ${st.c}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, whiteSpace: 'nowrap' }}>{st.t}</span>
      } },
  ]

  const canXuLy = restock.filter((r) => r.act.includes('NHẬP') || r.act.startsWith('⚠')).length
  const soNo = restock.filter((r) => r.spNo > 0).length
  const tongVon = restock.reduce((s, r) => s + r.von, 0)

  return (
    <div style={{ minHeight: '100%', background: C.bg, color: C.text, fontFamily: 'inherit' }}>
      <div style={{ width: '100%', maxWidth: 1280, margin: '0 auto', padding: isMobile ? '16px 12px 50px' : '24px 24px 60px' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gold, fontSize: 18 }}>◉</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: 1 }}>Kho &amp; Đề xuất nhập hàng</div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: C.muted }}>TMH GROUP · HÀNG HÓA &amp; VẬN HÀNH</div>
          </div>
        </div>

        {/* tab switcher */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {([['kho', '📦 Kho & Nhập hàng'], ['calc', '🧮 Máy tính giá']] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)} style={{ background: tab === k ? C.gold : 'transparent', color: tab === k ? '#0a0a0a' : C.muted2, border: `1px solid ${tab === k ? C.gold : C.line}`, borderRadius: 10, padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{lbl}</button>
          ))}
        </div>

        {tab === 'kho' && (<>
        {/* nguồn dữ liệu + cấu hình */}
        <div style={{ ...panelStyle, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, letterSpacing: 1.5, color: C.muted }}>NGUỒN DỮ LIỆU</span>
          <span style={{ flex: 1, minWidth: 160, fontSize: 12, color: status === 'live' ? C.green : status === 'error' ? C.red : C.muted }}>
            {status === 'live' ? `● Số thật · cập nhật ${lastUpdate} · tự làm mới mỗi 5'` : status === 'loading' ? '● Đang tải...' : status === 'error' ? `● ${errMsg}` : '● Đang tải...'}
          </span>
          <button onClick={() => void load(sources)} disabled={status === 'loading'}
            style={{ background: 'transparent', color: C.muted2, border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>
            ⟳ Tải lại
          </button>
          <button onClick={() => setShowCfg((v) => !v)}
            style={{ background: 'transparent', color: C.gold, border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>
            ⚙ Cấu hình link {showCfg ? '▲' : '▼'}
          </button>
        </div>

        {showCfg && (
          <div style={{ ...panelStyle, padding: '18px 20px' }}>
            <div style={eyebrowStyle}>⚙ CẤU HÌNH NGUỒN DỮ LIỆU</div>
            <div style={{ fontSize: 12, color: C.muted, margin: '4px 0 14px' }}>Dán link Google Sheet (đã để công khai) cho từng file. Bấm Lưu là nhớ trên máy này.</div>
            {SOURCE_DEFS.map((d) => (
              <div key={d.key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: C.gold, marginBottom: 5 }}>{d.label}</div>
                <input value={sources[d.key] || ''} onChange={(e) => setSources((s) => ({ ...s, [d.key]: e.target.value }))}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  style={{ width: '100%', background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 8, padding: '9px 11px', fontSize: 13 }} />
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
              <button onClick={saveSources} style={{ background: C.gold, color: '#1a1405', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Lưu</button>
              {saved && <span style={{ color: C.green, fontSize: 13 }}>✓ Đã lưu</span>}
              <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto' }}>Lưu trên trình duyệt máy này.</span>
            </div>
          </div>
        )}

        {data?.errors && data.errors.length > 0 && (
          <div style={{ ...panelStyle, borderColor: '#3a3414', padding: '10px 16px', fontSize: 12.5, color: C.amber }}>
            ⚠ Một vài nguồn chưa đọc được: {data.errors.join(' · ')}. Kiểm tra link đã công khai chưa ở ⚙ Cấu hình.
          </div>
        )}

        {status === 'loading' && !data && (
          <div style={{ ...panelStyle, textAlign: 'center', color: C.muted, fontSize: 14 }}>● Đang tải dữ liệu kho từ Google Sheet...</div>
        )}

        {/* ĐỀ XUẤT NHẬP HÀNG */}
        {restock.length > 0 && (
          <div style={panelStyle}>
            <div style={eyebrowStyle}>🧠 ĐỀ XUẤT NHẬP HÀNG · {canXuLy} mã cần xử lý · {soNo} mã đang NỢ HÀNG · {incoming.length} đơn đang về · tổng vốn ~{fmtMoney(tongVon)}</div>
            <div style={{ fontSize: 12, color: C.muted, margin: '6px 0 10px' }}>Nhập TQ 8 ngày + đệm an toàn 7 ngày · trữ đủ 30 ngày · tốc độ = đơn chốt TB/ngày của 7 ngày gần nhất · đã TRỪ hàng đang về.</div>
            <RespTable cols={restockCols} data={restock} mobile={isMobile} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>🔴 NHẬP GẤP = sắp hết &amp; chưa có đơn về · 📦 Đang về = đơn về KỊP, đừng đặt thêm · ⚠ Nợ hàng = đã chốt đơn nhưng chưa có hàng gửi, phải nhập bù gấp · ⚠ Đứt/Đơn trễ = thúc NCC · Hoàn cao = ĐỪNG nhập. <b style={{ color: C.muted2 }}>CÒN ~NGÀY tính trên tồn THỰC DỤNG = tồn − SP nợ; số NHẬP đã gồm trả nợ &amp; trừ hàng đang về.</b> Giá/cái ưu tiên GIÁ THỰC TẾ (cột E file nhập) → KHO (cột N × tỷ giá); <span style={{ color: C.amber }}>*</span> = ước tính.</div>
          </div>
        )}

        {/* BOM HÀNG THEO TỈNH */}
        {provinces.length > 0 && (
          <div style={panelStyle}>
            <div style={eyebrowStyle}>⚑ BOM HÀNG THEO TỈNH · {provinces.length} tỉnh</div>
            <div style={{ height: 10 }} />
            <RespTable cols={provCols} data={provinces} mobile={isMobile} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>Tỉnh hoàn cao = khách hay bom hàng. 🔴 &gt;45%: nên chặn COD hoặc bắt đặt cọc · 🟠 &gt;35%: bắt cọc/đổi shipper · cắt hoàn từ gốc thay vì đốt thêm ads.</div>
          </div>
        )}

        {/* TỒN KHO · CẢNH BÁO */}
        {invRows.length > 0 && (
          <div style={panelStyle}>
            <div style={eyebrowStyle}>▦ TỒN KHO · CẢNH BÁO ({invRows.filter((r) => r.st.t === 'Sắp hết').length} sắp hết · {invRows.filter((r) => r.st.t === 'Ế/đọng').length} ế)</div>
            <div style={{ height: 10 }} />
            <RespTable cols={invCols} data={invRows} mobile={isMobile} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>🔴 Sắp hết = tồn &lt; 30% lượng bán kỳ này (SP đang chạy, lo đứt hàng) · Ế/đọng = còn tồn nhưng kỳ này không bán được (vốn chôn).</div>
          </div>
        )}

        {status === 'live' && !restock.length && !invRows.length && !provinces.length && (
          <div style={{ ...panelStyle, textAlign: 'center', color: C.muted, fontSize: 14 }}>Chưa có dữ liệu hiển thị. Kiểm tra link nguồn ở ⚙ Cấu hình.</div>
        )}
        </>)}

        {tab === 'calc' && <PriceCalc products={products} priceVnd={priceVnd} inv={inv} />}
      </div>
    </div>
  )
}
