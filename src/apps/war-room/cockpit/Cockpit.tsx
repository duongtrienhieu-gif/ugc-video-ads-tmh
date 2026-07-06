// ── 🛰 ĐIỀU HÀNH (Cockpit) — dashboard Quản trị TMH Group, port từ bao-cao-cty ──
// CHỈ OWNER thấy (gate ở WarRoom). 3 mục: Tổng quan · Marketing · Tổng lương công ty.
// Data đọc qua /api/inventory-board (mode cockpit: data/daily/salary) + /api/qlhb (hoàn Cách A).
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { computePnL, DEFAULT_INPUTS, BOOK_RATE, type Inputs, type RawEntity } from './model'
import { loadBoardLinks } from '../../inventory-board/boardConfig'

const C = {
  bg: '#070a12', panel: '#0c111c', panel2: '#0a0f19', line: '#1b2233', line2: '#161d2c',
  gold: '#f5c451', goldDim: '#c9a24a', text: '#eef1f7', muted: '#74809a', muted2: '#aeb8cc',
  red: '#ff4d5e', amber: '#fbbf24', green: '#4ade80',
}
const fmtMoney = (n: number) => Math.round(n).toLocaleString('vi-VN') + 'đ'
const fmtPct = (n: number) => (n * 100).toFixed(1) + '%'
const fmtAOV = (n: number) => Math.round(n).toLocaleString('vi-VN') + 'đ'
const panelStyle: React.CSSProperties = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 20px', marginBottom: 14, position: 'relative' }
const eyebrowStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, letterSpacing: 0.3, color: C.gold }

// 5 file marketer + tong + luongsale (KHỚP KEY với mode cockpit trong api/inventory-board.ts)
const MKT_KEYS = [
  { key: 'm_HANT', name: 'HANT', label: 'Marketer — Hà (HANT)' },
  { key: 'm_DUYNG', name: 'DUYNG', label: 'Marketer — Duy (DUYNG)' },
  { key: 'm_KHANHTQ', name: 'KHANHTQ', label: 'Marketer — Khánh (KHANHTQ)' },
  { key: 'm_TUANNV', name: 'TUANNV', label: 'Marketer — Tuấn (TUANNV)' },
  { key: 'm_ANHND', name: 'ANHND', label: 'Marketer — ANHND' },
]
const SOURCE_DEFS: { key: string; label: string }[] = [
  ...MKT_KEYS.map((m) => ({ key: m.key, label: m.label })),
  { key: 'tong', label: 'File TỔNG (MAR_TH · MAR_NGÀY · SẢN PHẨM_TH)' },
  { key: 'luongsale', label: 'File LƯƠNG SALE (sheet Salary table)' },
  { key: 'qlhb', label: 'File QLHB (hoàn Cách A theo SP)' },
]
// Mặc định = link đang chạy (dự phòng). Owner dán link tháng mới ở ⚙ Cấu hình.
const DEFAULT_SOURCES: Record<string, string> = {
  m_HANT: 'https://docs.google.com/spreadsheets/d/18c_BtFLdGB7EBaN06rWKJiFLiZogdDNS_O_0xVccV6s/edit',
  m_DUYNG: 'https://docs.google.com/spreadsheets/d/1LRsxCJ4JVxlN9yBIdAVtndxggfAem9wf58BE2iMdAKM/edit',
  m_KHANHTQ: 'https://docs.google.com/spreadsheets/d/1vHiLS3V85wL6rWvnmCOZB8bfR5lu_sw0ZAuy8xUczSA/edit',
  m_TUANNV: 'https://docs.google.com/spreadsheets/d/1cKMfUPJ67Q6b1TGynqjyCZm5GTupbQ_sNO1J4eDxl9I/edit',
  m_ANHND: 'https://docs.google.com/spreadsheets/d/1gUG9JgO0cC-zYkvTePXfcFYIlS2CXzMUL4n0o8mmDbA/edit',
  tong: 'https://docs.google.com/spreadsheets/d/19KaRjRgg0YhT8RBFfDbI25iF9wp7HKxaFZaqiS6ObfU/edit',
  luongsale: 'https://docs.google.com/spreadsheets/d/1E5SDrQ78IwYzs4NCaJSU2G0slR2Dx8TMBagCS5eNkzk/edit',
}
const STORAGE_KEY = 'cockpit_sources'
// marketer HANT = Hà+Phy → lương ×2; hoàn theo team (map 5 người → 3 team để đè hoàn Cách A từ QLHB)
const TEAM_OF: Record<string, string> = { HANT: 'SUMMIT', DUYNG: 'APEX', KHANHTQ: 'APEX', TUANNV: 'TITAN', ANHND: 'TITAN' }

// Lương bộ phận cố định (VNĐ) — theo cài đặt hiện tại, không đổi theo tháng.
const FIXED_DEPTS: { ten: string; vnd: number }[] = [
  { ten: 'Vận hành — Ngọc An', vnd: 14_000_000 },
  { ten: 'Nhập hàng — Việt', vnd: 4_000_000 },
  { ten: 'Cổ đông — Nguyễn My', vnd: 10_000_000 },
  { ten: 'Cổ đông — Nguyễn Thảo', vnd: 10_000_000 },
  { ten: 'CEO — Hồ Trung Hiếu', vnd: 30_000_000 },
  { ten: 'Thuê văn phòng', vnd: 10_000_000 },
  { ten: 'Kho — NV Nam', vnd: 16_250_000 },
  { ten: 'Kho — Thủ kho Nữ', vnd: 16_250_000 },
]
const SALARY_RATE = 6500

type SaleRaw = { ten: string; base: number; workday: number; tele: number; revenue: number; returnPct: number; data: number; c2: number; advance: number; rmFile: number }
// ENGINE LƯƠNG SALE (Rules_NEW): cứng + hoa hồng %C2 + thưởng hoàn thấp; hoàn >15% mất hoa hồng.
function saleSalary1(s: SaleRaw) {
  const pctC2 = s.data > 0 ? s.c2 / s.data : 0
  const actualRev = s.revenue * (1 - s.returnPct)
  const lvl = s.revenue >= 200_000 ? 4 : s.revenue >= 150_000 ? 3 : s.revenue >= 100_000 ? 2 : 1
  let pctCom = 0
  if (s.returnPct <= 0.15) {
    if (pctC2 > 0.85) pctCom = 0.01
    else if (pctC2 > 0.75) pctCom = 0.007
    else if (pctC2 > 0.70) pctCom = 0.005
    else pctCom = lvl === 4 ? 0.003 : lvl === 3 ? 0.002 : 0
  }
  const com = pctCom * actualRev
  const retBonus = s.returnPct < 0.07 ? Math.round((0.07 - s.returnPct) * 100) * 100 : 0
  const cung = s.workday > 0 ? (s.base / 26) * s.workday : s.base
  const net = cung + s.tele + com + retBonus - s.advance
  return { cung, tele: s.tele, com, retBonus, advance: s.advance, net, pctCom, pctC2 }
}

type Prod = { name: string; rmRevenue: number; cpqc: number; pctCpqc: number; pctHoan: number; c2: number }
type ProdRow = Prod & { rev: number; profit: number; breakeven: number; tySuat: number }
function prodStatus(r: ProdRow): { tag: string; color: string } {
  if (r.profit < 0 || r.pctHoan > 0.45) return { tag: 'Cắt', color: C.red }
  if (r.pctCpqc > r.breakeven - 0.05 || r.pctHoan > 0.35) return { tag: 'Sửa', color: C.amber }
  if (r.profit > 0 && r.pctHoan > 0 && r.pctHoan < 0.25 && r.pctCpqc < r.breakeven * 0.7) return { tag: 'Scale', color: C.green }
  return { tag: 'Giữ', color: C.muted2 }
}

type Col<T> = { label: string; node: (r: T) => ReactNode; center?: boolean }
function RespTable<T>({ cols, data, mobile }: { cols: Col<T>[]; data: T[]; mobile: boolean }) {
  if (mobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map((r, i) => (
          <div key={i} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 8 }}>{cols[0].node(r)}</div>
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
            {cols.map((c, j) => <th key={j} style={{ padding: '6px 0', fontWeight: 400, textAlign: c.center ? 'center' : j === 0 ? 'left' : 'right' }}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${C.line2}` }}>
              {cols.map((c, j) => <td key={j} style={{ padding: '9px 0', textAlign: c.center ? 'center' : j === 0 ? 'left' : 'right', fontWeight: j === 0 ? 500 : 400 }}>{c.node(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function mktLinks(s: Record<string, string>) {
  const o: Record<string, string> = {}
  for (const m of MKT_KEYS) if (s[m.key]) o[m.key] = s[m.key]
  if (s.tong) o.tong = s.tong
  if (s.luongsale) o.luongsale = s.luongsale
  return o
}

export default function Cockpit() {
  const [inp, setInp] = useState<Inputs>(DEFAULT_INPUTS)
  const set = (k: keyof Inputs, v: number) => setInp((s) => ({ ...s, [k]: v }))
  const [tab, setTab] = useState<'tong' | 'mkt' | 'luong'>('tong')
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => { const f = () => setIsMobile(window.innerWidth < 700); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])

  const [mkts, setMkts] = useState<RawEntity[]>([])
  const [cogsByProduct, setCogsByProduct] = useState<Record<string, number>>({})
  const [products, setProducts] = useState<Prod[]>([])
  const [saleSalary, setSaleSalary] = useState<SaleRaw[]>([])
  type Day = { date: string; rm: number; cpqc: number; contact: number; c2: number }
  const [daily, setDaily] = useState<{ company: Day[]; marketers: Record<string, Day[]> }>({ company: [], marketers: {} })
  const [rangeMode, setRangeMode] = useState<'thang' | '7' | 'homqua' | 'homtruoc' | 'custom'>('7')
  const [cFrom, setCFrom] = useState(''); const [cTo, setCTo] = useState('')
  const [sources, setSources] = useState<Record<string, string>>(() => {
    try { const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); return { ...DEFAULT_SOURCES, ...s } } catch { return { ...DEFAULT_SOURCES } }
  })
  const [qlhbLink, setQlhbLink] = useState('')
  const [showCfg, setShowCfg] = useState(false)
  const [saved, setSaved] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'live' | 'error'>('idle')
  const [lastUpdate, setLastUpdate] = useState('')

  const POST = (body: unknown) => fetch('/api/inventory-board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' }).then((r) => r.json())

  async function loadAll(s: Record<string, string>, ql: string) {
    setStatus('loading')
    const links = mktLinks(s)
    try {
      const [d, day, sal] = await Promise.all([
        POST({ cockpit: 'data', links }),
        POST({ cockpit: 'daily', links }),
        POST({ cockpit: 'salary', links }),
      ])
      if (d?.ok) {
        const rawMkts: RawEntity[] = d.mkts || []
        const prods: Prod[] = d.products || []
        setCogsByProduct(d.cogsByProduct || {})
        // Hoàn Cách A từ QLHB: đè %hoàn SP + %hoàn marketer (map người→team). QLHB nặng → fetch riêng.
        try {
          const q = await fetch(`/api/qlhb`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ link: ql }), cache: 'no-store' }).then((r) => r.json())
          const hoanMap: Record<string, number> = q?.hoanMap || {}
          const hoanTeam: Record<string, number> = q?.hoanByTeam || {}
          prods.forEach((p) => { const h = hoanMap[p.name.trim().toUpperCase()]; if (h != null) p.pctHoan = h })
          rawMkts.forEach((m) => { const t = TEAM_OF[m.name.toUpperCase()]; if (t && hoanTeam[t] != null) m.hoanRateOverride = hoanTeam[t] })
        } catch { /* QLHB lỗi → giữ hoàn file */ }
        setMkts(rawMkts); setProducts(prods)
        setStatus('live'); setLastUpdate(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }))
      } else setStatus('error')
      if (day?.ok) setDaily({ company: day.company || [], marketers: day.marketers || {} })
      if (sal?.ok) setSaleSalary(sal.sales || [])
    } catch { setStatus('error') }
  }

  // Seed link QLHB dùng chung (board_config) + load lần đầu.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const shared = (await loadBoardLinks()) ?? {}
      const ql = shared.qlhb || sources.qlhb || ''
      if (cancelled) return
      setQlhbLink(ql)
      void loadAll(sources, ql)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function saveSources() {
    const clean: Record<string, string> = {}
    for (const k of Object.keys(sources)) if (k !== 'qlhb') clean[k] = sources[k]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
    setSaved(true); setTimeout(() => setSaved(false), 2000)
    const ql = sources.qlhb || qlhbLink
    setQlhbLink(ql); void loadAll(sources, ql)
  }

  // ── COMPUTE (port từ dashboard) ──────────────────────────────────────────────
  const rows = useMemo(() => mkts.map((m) => computePnL(m, inp)).sort((a, b) => b.loiNhuan - a.loiNhuan), [inp, mkts])
  const co = useMemo(() => {
    const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0)
    const dt = sum((r) => r.dtGuiVnd)
    return { dt, ln: sum((r) => r.loiNhuan), hoan: sum((r) => r.hoanVnd), cpqc: sum((r) => r.cpqc), pctCpqc: dt ? sum((r) => r.cpqc) / dt : 0, pctHoan: dt ? sum((r) => r.hoanVnd) / dt : 0, tySuat: dt ? sum((r) => r.loiNhuan) / dt : 0 }
  }, [rows])

  const alerts = useMemo(() => {
    const a: { level: 'red' | 'amber'; text: string }[] = []
    for (const r of rows) {
      if (r.pctCpqc > 0.45) a.push({ level: 'red', text: `${r.name} đốt ads ${fmtPct(r.pctCpqc)} — vượt ngưỡng an toàn` })
      else if (r.pctCpqc > 0.4) a.push({ level: 'amber', text: `${r.name} ads ${fmtPct(r.pctCpqc)} — cần để mắt` })
      if (r.loiNhuan < 0) a.push({ level: 'red', text: `${r.name} đang LỖ ${fmtMoney(r.loiNhuan)}` })
      if (r.hoanRate > 0.3) a.push({ level: 'amber', text: `${r.name} tỷ lệ hoàn cao ${fmtPct(r.hoanRate)}` })
    }
    return a.slice(0, 5)
  }, [rows])

  const actions = useMemo(() => {
    const a: { icon: string; color: string; title: string; reason: string; score: number }[] = []
    products.forEach((p) => { if (p.pctHoan > 0.45 || p.pctCpqc > 0.55) a.push({ icon: '✕', color: C.red, title: `Cắt ${p.name}`, reason: `hoàn ${fmtPct(p.pctHoan)}, ads ${fmtPct(p.pctCpqc)} — lỗ kép`, score: 100 + p.rmRevenue / 1e4 }) })
    rows.forEach((r) => {
      if (r.loiNhuan < 0) a.push({ icon: '!', color: C.red, title: `${r.name} đang lỗ`, reason: `lỗ ${fmtMoney(r.loiNhuan)} — soi lại gấp`, score: 120 })
      else if (r.pctCpqc > 0.45) a.push({ icon: '▼', color: C.amber, title: `Ghìm ads ${r.name}`, reason: `đốt ${fmtPct(r.pctCpqc)} doanh thu — sát ngưỡng lỗ`, score: 90 + r.pctCpqc * 100 })
    })
    const scale = products.filter((p) => p.pctHoan > 0 && p.pctHoan < 0.25 && p.pctCpqc < 0.38).sort((x, y) => y.rmRevenue - x.rmRevenue)[0]
    if (scale) a.push({ icon: '▲', color: C.green, title: `Đẩy mạnh ${scale.name}`, reason: `hoàn thấp ${fmtPct(scale.pctHoan)}, ads ${fmtPct(scale.pctCpqc)} — còn dư địa scale`, score: 80 + scale.rmRevenue / 1e4 })
    return a.sort((x, y) => y.score - x.score).slice(0, 4)
  }, [rows, products])

  const prodRows = useMemo<ProdRow[]>(() => {
    const totalCogs = mkts.reduce((s, m) => s + m.cogs, 0)
    const totalRm = mkts.reduce((s, m) => s + m.rmRevenue, 0)
    const cogsPerRm = totalRm > 0 ? totalCogs / totalRm : 0
    return products.map((p) => {
      const rev = p.rmRevenue * inp.tyGia
      const cogs = (cogsByProduct[p.name.trim().toUpperCase()] ?? p.rmRevenue * cogsPerRm) * inp.tyGia / BOOK_RATE
      const hoan = rev * p.pctHoan
      const cpvc = p.rmRevenue * BOOK_RATE * inp.cpvcPct
      const cpvh = p.rmRevenue * BOOK_RATE * inp.cpvhPct
      const profit = rev - hoan - cogs - p.cpqc - cpvc - cpvh
      const breakeven = rev > 0 ? 1 - p.pctHoan - (cogs + cpvc + cpvh) / rev : 0
      return { ...p, rev, profit, breakeven, tySuat: rev > 0 ? profit / rev : 0 }
    })
  }, [products, mkts, inp, cogsByProduct])

  const saleRows = useMemo(() => mkts.map((m) => { const ct = m.contact || 0, c2 = m.c2 || 0; return { name: m.name, c2, closeRate: ct > 0 ? c2 / ct : 0, aov: c2 > 0 ? (m.rmRevenue * inp.tyGia) / c2 : 0 } }).sort((a, b) => b.c2 - a.c2), [mkts, inp.tyGia])
  const saleCo = useMemo(() => { const ct = mkts.reduce((s, m) => s + (m.contact || 0), 0); const c2 = mkts.reduce((s, m) => s + (m.c2 || 0), 0); const rev = mkts.reduce((s, m) => s + m.rmRevenue * inp.tyGia, 0); return { ct, c2, closeRate: ct > 0 ? c2 / ct : 0, aov: c2 > 0 ? rev / c2 : 0 } }, [mkts, inp.tyGia])

  const abc = useMemo(() => {
    const sorted = [...prodRows].sort((a, b) => b.rev - a.rev)
    const total = sorted.reduce((s, p) => s + p.rev, 0) || 1
    let cum = 0
    return sorted.map((p) => { cum += p.rev; const c = cum / total; return { name: p.name, rev: p.rev, grp: c <= 0.8 ? 'A' : c <= 0.95 ? 'B' : 'C' } })
  }, [prodRows])

  const luong = useMemo(() => {
    const lrows: { ten: string; vnd: number; nhom: string; note?: string }[] = []
    mkts.forEach((m) => { const x2 = m.name === 'HANT' ? 2 : 1; lrows.push({ ten: 'MKT — ' + m.name + (x2 > 1 ? ' (Hà+Phy)' : ''), vnd: m.luong * x2, nhom: 'Marketing' }) })
    saleSalary.forEach((s) => {
      const x = saleSalary1(s)
      const note = `cứng ${Math.round(x.cung)} + HH ${Math.round(x.com)}${x.retBonus ? ' + thưởng ' + x.retBonus : ''} RM · %C2 ${(x.pctC2 * 100).toFixed(0)}% · hoàn ${(s.returnPct * 100).toFixed(0)}%${s.returnPct > 0.15 ? ' (mất HH)' : ''}`
      lrows.push({ ten: 'Sale — ' + s.ten, vnd: x.net * SALARY_RATE, nhom: 'Sale', note })
    })
    FIXED_DEPTS.forEach((d) => lrows.push({ ten: d.ten, vnd: d.vnd, nhom: 'Bộ phận' }))
    return { rows: lrows, total: lrows.reduce((s, r) => s + r.vnd, 0) }
  }, [mkts, saleSalary])

  const daysElapsed = Math.max(1, new Date().getDate())
  const fcDT = (co.dt / daysElapsed) * 30
  const fcLN = (co.ln / daysElapsed) * 30

  const rangeStats = useMemo(() => {
    const days = daily.company
    if (!days.length) return null
    const toISO = (d: string) => { const [dd, mm, yy] = d.split('/'); return `${yy}-${mm}-${dd}` }
    const ld = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
    const now = new Date()
    const y1 = new Date(now); y1.setDate(now.getDate() - 1)
    const y2 = new Date(now); y2.setDate(now.getDate() - 2)
    let sel: string[]
    if (rangeMode === 'thang') sel = days.map((d) => d.date)
    else if (rangeMode === 'homqua') sel = days.filter((d) => toISO(d.date) === ld(y1)).map((d) => d.date)
    else if (rangeMode === 'homtruoc') sel = days.filter((d) => toISO(d.date) === ld(y2)).map((d) => d.date)
    else if (rangeMode === 'custom' && cFrom && cTo) sel = days.map((d) => d.date).filter((d) => toISO(d) >= cFrom && toISO(d) <= cTo)
    else sel = days.slice(-7).map((d) => d.date)
    const selSet = new Set(sel)
    const tg = inp.tyGia, BOOK = BOOK_RATE
    const totalCogs = mkts.reduce((s, m) => s + m.cogs, 0), totalRm = mkts.reduce((s, m) => s + m.rmRevenue, 0)
    const cogsPerRm = totalRm > 0 ? totalCogs / totalRm : 0
    const calc = (rm: number, cpqc: number, hr: number, cr: number) => { const dt = rm * tg, hoan = dt * hr, von = cr * rm * tg / BOOK; const cpvc = inp.cpvcPct * rm * BOOK, cpvh = inp.cpvhPct * rm * BOOK; return { dt, hoan, von, cpqc, cpvc, cpvh, lai: dt - hoan - von - cpqc - cpvc - cpvh } }
    const selDays = days.filter((d) => selSet.has(d.date))
    const adsPendingDates = selDays.filter((d) => d.rm > 0 && d.cpqc === 0).map((d) => d.date.slice(0, 5))
    const series = selDays.map((d) => { const x = calc(d.rm, d.cpqc, co.pctHoan, cogsPerRm); return { date: d.date.slice(0, 5), dt: x.dt, lai: x.lai, adsPending: d.rm > 0 && d.cpqc === 0 } })
    const kpi = selDays.reduce((a, d) => { const x = calc(d.rm, d.cpqc, co.pctHoan, cogsPerRm); return { dt: a.dt + x.dt, hoan: a.hoan + x.hoan, von: a.von + x.von, cpqc: a.cpqc + x.cpqc, cpvc: a.cpvc + x.cpvc, cpvh: a.cpvh + x.cpvh, lai: a.lai + x.lai, c2: a.c2 + d.c2 } }, { dt: 0, hoan: 0, von: 0, cpqc: 0, cpvc: 0, cpvh: 0, lai: 0, c2: 0 })
    const byMkt = Object.entries(daily.marketers).map(([name, arr]) => {
      const m = mkts.find((x) => x.name === name)
      const hr = m?.hoanRateOverride ?? co.pctHoan
      const cr = m && m.rmRevenue > 0 ? m.cogs / m.rmRevenue : cogsPerRm
      const t = arr.filter((d) => selSet.has(d.date)).reduce((a, d) => { const x = calc(d.rm, d.cpqc, hr, cr); return { dt: a.dt + x.dt, hoan: a.hoan + x.hoan, von: a.von + x.von, cpqc: a.cpqc + x.cpqc, cpvc: a.cpvc + x.cpvc, cpvh: a.cpvh + x.cpvh, lai: a.lai + x.lai, c2: a.c2 + d.c2 } }, { dt: 0, hoan: 0, von: 0, cpqc: 0, cpvc: 0, cpvh: 0, lai: 0, c2: 0 })
      return { name, ...t }
    }).filter((x) => x.dt > 0).sort((a, b) => b.lai - a.lai)
    return { series, kpi, byMkt, nDays: sel.length, adsPendingDates }
  }, [daily, rangeMode, cFrom, cTo, mkts, inp, co])

  // ── COLS ─────────────────────────────────────────────────────────────────────
  const mktCols: Col<(typeof rows)[number]>[] = [
    { label: 'MARKETER', node: (r) => r.name },
    { label: 'DOANH THU', node: (r) => <span style={{ color: C.gold }}>{fmtMoney(r.dtGuiVnd)}</span> },
    { label: '% CPQC', node: (r) => <span style={{ color: r.pctCpqc > 0.45 ? C.red : r.pctCpqc > 0.4 ? C.amber : C.muted2 }}>{fmtPct(r.pctCpqc)}</span> },
    { label: '% HOÀN', node: (r) => <span style={{ color: r.hoanRate > 0.3 ? C.amber : C.muted2 }}>{fmtPct(r.hoanRate)}</span> },
    { label: 'LƯƠNG', node: (r) => <span style={{ color: C.muted2 }}>{fmtMoney(r.luong)}</span> },
    { label: 'LỢI NHUẬN', node: (r) => <span style={{ color: r.loiNhuan < 0 ? C.red : C.green }}>{fmtMoney(r.loiNhuan)}</span> },
    { label: 'TỶ SUẤT', node: (r) => <span style={{ color: C.muted2 }}>{fmtPct(r.tySuat)}</span> },
  ]
  const saleCols: Col<(typeof saleRows)[number]>[] = [
    { label: 'MARKETER', node: (r) => r.name },
    { label: 'ĐƠN CHỐT', node: (r) => <span style={{ color: C.muted2 }}>{Math.round(r.c2).toLocaleString('vi-VN')}</span> },
    { label: 'TỶ LỆ CHỐT', node: (r) => <span style={{ color: r.closeRate >= 0.78 ? C.green : r.closeRate >= 0.7 ? C.muted2 : C.amber }}>{fmtPct(r.closeRate)}</span> },
    { label: 'AOV', node: (r) => <span style={{ color: C.gold }}>{fmtAOV(r.aov)}</span> },
  ]
  const prodCols: Col<ProdRow>[] = [
    { label: 'SẢN PHẨM', node: (p) => p.name },
    { label: 'DOANH THU', node: (p) => <span style={{ color: C.gold }}>{fmtMoney(p.rev)}</span> },
    { label: '% CPQC', node: (p) => <span style={{ color: p.pctCpqc > p.breakeven ? C.red : p.pctCpqc > p.breakeven - 0.05 ? C.amber : C.muted2 }}>{fmtPct(p.pctCpqc)}</span> },
    { label: 'NGƯỠNG ADS', node: (p) => <span style={{ color: C.muted }}>{fmtPct(Math.max(0, p.breakeven))}</span> },
    { label: '% HOÀN', node: (p) => <span style={{ color: p.pctHoan > 0.45 ? C.red : p.pctHoan > 0.35 ? C.amber : C.muted2 }}>{fmtPct(p.pctHoan)}</span> },
    { label: 'LỢI NHUẬN', node: (p) => <span style={{ color: p.profit < 0 ? C.red : C.green }}>{fmtMoney(p.profit)}</span> },
    { label: 'ĐÁNH GIÁ', center: true, node: (p) => { const st = prodStatus(p); return <span style={{ color: st.color, border: `1px solid ${st.color}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, whiteSpace: 'nowrap' }}>{st.tag}</span> } },
  ]
  type TimeRow = { name: string; dt: number; hoan: number; von: number; cpqc: number; cpvc: number; cpvh: number; c2: number; lai: number }
  const timeCols: Col<TimeRow>[] = [
    { label: 'MARKETER', node: (r) => r.name },
    { label: 'DOANH THU', node: (r) => <span style={{ color: C.gold }}>{fmtMoney(r.dt)}</span> },
    { label: 'HOÀN', node: (r) => <span style={{ color: C.muted2 }}>{fmtMoney(r.hoan)}</span> },
    { label: 'VỐN', node: (r) => <span style={{ color: C.muted2 }}>{fmtMoney(r.von)}</span> },
    { label: 'ADS', node: (r) => <span style={{ color: r.cpqc === 0 && r.dt > 0 ? C.amber : C.muted2 }}>{r.cpqc === 0 && r.dt > 0 ? '⚠ ' : ''}{fmtMoney(r.cpqc)}</span> },
    { label: 'CHỐT', node: (r) => <span style={{ color: C.muted2 }}>{Math.round(r.c2).toLocaleString('vi-VN')}</span> },
    { label: 'LÃI TẠM', node: (r) => <span style={{ color: r.lai < 0 ? C.red : C.green }}>{fmtMoney(r.lai)}</span> },
  ]
  const luongCols: Col<(typeof luong.rows)[number]>[] = [
    { label: 'KHOẢN LƯƠNG', node: (r) => r.ten },
    { label: 'NHÓM', node: (r) => <span style={{ color: C.muted2 }}>{r.nhom}</span> },
    { label: 'VNĐ', node: (r) => <span style={{ color: C.text }}>{Math.round(r.vnd).toLocaleString('vi-VN')}</span> },
    { label: 'RM', node: (r) => <span style={{ color: C.gold }}>{Math.round(r.vnd / SALARY_RATE).toLocaleString('vi-VN')}</span> },
    { label: 'CƠ CHẾ', node: (r) => <span style={{ color: C.muted, fontSize: 11 }}>{r.note ?? '—'}</span> },
  ]

  const kpis = [
    { label: 'DOANH THU', val: fmtMoney(co.dt), accent: false, sub: '' },
    { label: 'LỢI NHUẬN THẬT', val: fmtMoney(co.ln), accent: true, sub: `tỷ suất ${fmtPct(co.tySuat)}` },
    { label: '% CPQC', val: fmtPct(co.pctCpqc), accent: false, sub: '' },
    { label: '% HOÀN (CÁCH A)', val: fmtPct(co.pctHoan), accent: false, sub: '' },
  ]

  const numInput: React.CSSProperties = { background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 8, padding: '8px 10px', fontSize: 14 }

  return (
    <div>
      {/* header: 3 ô tỷ giá / CPVC / CPVH + trạng thái + cấu hình */}
      <div style={{ ...panelStyle, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.gold }}>🛰 Điều hành — Quản trị TMH Group</div>
          <div style={{ fontSize: 11, color: status === 'live' ? C.green : status === 'error' ? C.red : C.muted, marginTop: 3 }}>
            {status === 'live' ? `● Số thật · cập nhật ${lastUpdate} · chỉ CEO thấy` : status === 'loading' ? '● Đang tải số liệu…' : status === 'error' ? '● Lỗi tải — bấm ⟳ Tải lại' : '● Đang tải…'}
          </div>
        </div>
        <label style={{ fontSize: 11, color: C.muted2 }}>Tỷ giá<br /><input type="number" step={100} value={inp.tyGia} onChange={(e) => set('tyGia', +e.target.value)} style={{ ...numInput, width: 90, marginTop: 4 }} /></label>
        <label style={{ fontSize: 11, color: C.muted2 }}>CPVC %<br /><input type="number" step={0.5} value={+(inp.cpvcPct * 100).toFixed(1)} onChange={(e) => set('cpvcPct', +e.target.value / 100)} style={{ ...numInput, width: 80, marginTop: 4 }} /></label>
        <label style={{ fontSize: 11, color: C.muted2 }}>CPVH %<br /><input type="number" step={0.5} value={+(inp.cpvhPct * 100).toFixed(1)} onChange={(e) => set('cpvhPct', +e.target.value / 100)} style={{ ...numInput, width: 80, marginTop: 4 }} /></label>
        <button onClick={() => void loadAll(sources, sources.qlhb || qlhbLink)} disabled={status === 'loading'} style={{ background: 'transparent', color: C.muted2, border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>⟳ Tải lại</button>
        <button onClick={() => setShowCfg((v) => !v)} style={{ background: 'transparent', color: C.gold, border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>⚙ Link {showCfg ? '▲' : '▼'}</button>
      </div>

      {showCfg && (
        <div style={panelStyle}>
          <div style={{ ...eyebrowStyle, marginBottom: 4 }}>⚙ CẤU HÌNH NGUỒN DỮ LIỆU (tháng mới dán vào đây)</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Dán link Google Sheet đã công khai. Lưu trên máy này. Chỉ CEO thấy.</div>
          {SOURCE_DEFS.map((d) => (
            <div key={d.key} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: C.gold, marginBottom: 5 }}>{d.label}</div>
              <input value={sources[d.key] || ''} onChange={(e) => setSources((s) => ({ ...s, [d.key]: e.target.value }))} placeholder="https://docs.google.com/spreadsheets/d/..." style={{ width: '100%', ...numInput, fontSize: 13 }} />
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <button onClick={saveSources} style={{ background: C.gold, color: '#1a1405', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Lưu &amp; tải lại</button>
            {saved && <span style={{ color: C.green, fontSize: 13 }}>✓ Đã lưu</span>}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {([['tong', '🏠 Tổng quan'], ['mkt', '📣 Marketing'], ['luong', '💰 Tổng lương']] as const).map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)} style={{ background: tab === k ? C.gold : 'transparent', color: tab === k ? '#0a0a0a' : C.muted2, border: `1px solid ${tab === k ? C.gold : C.line}`, borderRadius: 10, padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{lbl}</button>
        ))}
      </div>

      {/* ── TỔNG QUAN ── */}
      {tab === 'tong' && (<>
        <div style={panelStyle}>
          <div style={{ ...eyebrowStyle, marginBottom: 4 }}><span style={{ color: C.red }}>●</span> KẾT QUẢ KINH DOANH · KỲ GẦN NHẤT</div>
          <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 600, margin: '4px 0 16px' }}>Tổng quan <span style={{ fontStyle: 'italic', color: C.gold }}>kinh doanh</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
            {kpis.map((k) => (
              <div key={k.label} style={{ background: C.panel2, border: `1px solid ${k.accent ? '#3a3414' : C.line}`, borderRadius: 10, padding: '12px 14px', minWidth: 0 }}>
                <div style={{ fontSize: 10, letterSpacing: 1.5, color: C.muted, marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 600, color: k.accent ? C.gold : C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.val}</div>
                {k.sub && <div style={{ fontSize: 10, color: C.green, marginTop: 3 }}>{k.sub}</div>}
              </div>
            ))}
          </div>
        </div>

        {rangeStats && (
          <div style={panelStyle}>
            <div style={{ ...eyebrowStyle, marginBottom: 12 }}>📅 THEO THỜI GIAN</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
              {([['7', 'Tuần (7 ngày)'], ['homqua', 'Hôm qua'], ['homtruoc', 'Hôm trước'], ['thang', 'Cả tháng'], ['custom', 'Tùy chọn']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setRangeMode(k)} style={{ background: rangeMode === k ? C.gold : 'transparent', color: rangeMode === k ? '#0a0a0a' : C.muted2, border: `1px solid ${rangeMode === k ? C.gold : C.line}`, borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
              ))}
              {rangeMode === 'custom' && (
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="date" value={cFrom} onChange={(e) => setCFrom(e.target.value)} style={{ ...numInput, fontSize: 13 }} />
                  <span style={{ color: C.muted }}>→</span>
                  <input type="date" value={cTo} onChange={(e) => setCTo(e.target.value)} style={{ ...numInput, fontSize: 13 }} />
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 14 }}>
              {[
                { label: `DOANH THU (${rangeStats.nDays} NGÀY)`, val: fmtMoney(rangeStats.kpi.dt), gold: true },
                { label: 'HOÀN (DỰ KIẾN)', val: fmtMoney(rangeStats.kpi.hoan) },
                { label: 'VỐN (TRỪ HOÀN)', val: fmtMoney(rangeStats.kpi.von) },
                { label: rangeStats.adsPendingDates.length ? 'CHI ADS ⚠' : 'CHI ADS', val: fmtMoney(rangeStats.kpi.cpqc), c: rangeStats.adsPendingDates.length ? C.amber : undefined },
                { label: 'CPVC', val: fmtMoney(rangeStats.kpi.cpvc) },
                { label: 'CPVH', val: fmtMoney(rangeStats.kpi.cpvh) },
                { label: 'ĐƠN CHỐT', val: Math.round(rangeStats.kpi.c2).toLocaleString('vi-VN') },
                { label: rangeStats.adsPendingDates.length ? 'LÃI TẠM TÍNH ⚠' : 'LÃI TẠM TÍNH', val: fmtMoney(rangeStats.kpi.lai), c: rangeStats.adsPendingDates.length ? C.amber : rangeStats.kpi.lai < 0 ? C.red : C.green },
              ].map((k) => (
                <div key={k.label} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '12px 14px', minWidth: 0 }}>
                  <div style={{ fontSize: 10, letterSpacing: 1.2, color: C.muted, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: k.c || (k.gold ? C.gold : C.text), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.val}</div>
                </div>
              ))}
            </div>
            {rangeStats.adsPendingDates.length > 0 && (
              <div style={{ background: 'rgba(251,191,36,0.10)', border: `1px solid ${C.amber}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: C.amber, fontWeight: 500 }}>
                ⚠ {rangeStats.adsPendingDates.length} ngày chưa nhập ads ({rangeStats.adsPendingDates.join(', ')}) — team thường nhập ads trễ ~1 ngày. <span style={{ color: C.muted2 }}>Lãi các ngày này đang CAO hơn thực tế.</span>
              </div>
            )}
            {rangeStats.series.length > 1 && (() => {
              const maxDt = Math.max(...rangeStats.series.map((x) => x.dt), 1)
              return (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 210, marginBottom: 8, overflowX: 'auto', paddingTop: 22 }}>
                  {rangeStats.series.map((s, i) => (
                    <div key={i} title={`${s.date}: DT ${fmtMoney(s.dt)} · lãi ${fmtMoney(s.lai)}`} style={{ flex: '1 0 auto', minWidth: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: s.adsPending ? C.amber : s.lai >= 0 ? C.green : C.red, whiteSpace: 'nowrap' }}>{s.adsPending ? '⚠ ' : ''}{fmtMoney(s.lai)}</div>
                      <div style={{ width: 34, height: Math.round((s.dt / maxDt) * 150) + 'px', background: s.adsPending ? `linear-gradient(${C.amber},${C.goldDim})` : `linear-gradient(${C.gold},${C.goldDim})`, borderRadius: '4px 4px 0 0', minHeight: 3, opacity: s.adsPending ? 0.65 : 1 }} />
                      <div style={{ fontSize: 9, color: C.muted2, whiteSpace: 'nowrap' }}>{fmtMoney(s.dt)}</div>
                      <div style={{ fontSize: 9, color: C.muted }}>{s.date}</div>
                    </div>
                  ))}
                </div>
              )
            })()}
            <div style={{ fontSize: 11, color: C.muted, margin: '8px 0 12px' }}>Cột vàng = doanh thu/ngày · số trên = lãi tạm tính ngày đó. Lãi theo CPVC/CPVH/tỷ giá đang đặt; vốn đã trừ hoàn; ads ngày sát hôm nay có thể chưa nhập đủ.</div>
            {rangeStats.byMkt.length > 0 && <RespTable cols={timeCols} data={rangeStats.byMkt} mobile={isMobile} />}
          </div>
        )}

        <div style={panelStyle}>
          <div style={{ ...eyebrowStyle, marginBottom: 10 }}>◔ DỰ BÁO CUỐI THÁNG (theo đà hiện tại)</div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div><span style={{ fontSize: 12, color: C.muted }}>Doanh thu dự báo: </span><span style={{ fontSize: 18, fontWeight: 600, color: C.gold }}>{fmtMoney(fcDT)}</span></div>
            <div><span style={{ fontSize: 12, color: C.muted }}>Lợi nhuận dự báo: </span><span style={{ fontSize: 18, fontWeight: 600, color: fcLN < 0 ? C.red : C.green }}>{fmtMoney(fcLN)}</span></div>
          </div>
        </div>

        {actions.length > 0 && (
          <div style={panelStyle}>
            <div style={{ ...eyebrowStyle, marginBottom: 12 }}>★ VIỆC NÊN LÀM HÔM NAY</div>
            {actions.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderTop: i ? `1px solid ${C.line2}` : 'none' }}>
                <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 6, background: a.color, color: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{a.icon}</span>
                <div><div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{a.title}</div><div style={{ fontSize: 12.5, color: C.muted2 }}>{a.reason}</div></div>
              </div>
            ))}
          </div>
        )}

        <div style={panelStyle}>
          <div style={{ ...eyebrowStyle, marginBottom: 12 }}>▲ ĐÈN CẢNH BÁO</div>
          {alerts.length === 0 && <div style={{ fontSize: 13, color: C.green }}>● Không có cảnh báo — mọi chỉ số trong ngưỡng an toàn.</div>}
          {alerts.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: i ? `1px solid ${C.line2}` : 'none' }}>
              <span style={{ color: a.level === 'red' ? C.red : C.amber, fontSize: 13 }}>●</span>
              <span style={{ fontSize: 13, color: '#d5dbe8' }}>{a.text}</span>
            </div>
          ))}
        </div>
      </>)}

      {/* ── MARKETING ── */}
      {tab === 'mkt' && (<>
        <div style={panelStyle}>
          <div style={{ ...eyebrowStyle, marginBottom: 10 }}>◆ KẾT QUẢ THEO MARKETER</div>
          {rows.length === 0 ? <div style={{ fontSize: 13, color: C.muted }}>Đang tải số marketer… (bấm ⟳ Tải lại nếu lâu)</div> : <RespTable cols={mktCols} data={rows} mobile={isMobile} />}
        </div>

        {saleRows.length > 0 && (
          <div style={panelStyle}>
            <div style={{ ...eyebrowStyle, marginBottom: 12 }}>☎ SALE · CHỐT ĐƠN &amp; AOV</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr 1fr' : 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'TỶ LỆ CHỐT', val: fmtPct(saleCo.closeRate) },
                { label: 'AOV TRUNG BÌNH', val: fmtAOV(saleCo.aov), gold: true },
                { label: 'TỔNG ĐƠN CHỐT', val: Math.round(saleCo.c2).toLocaleString('vi-VN') },
              ].map((k) => (
                <div key={k.label} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, letterSpacing: 1.5, color: C.muted, marginBottom: 6 }}>{k.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: k.gold ? C.gold : C.text }}>{k.val}</div>
                </div>
              ))}
            </div>
            <RespTable cols={saleCols} data={saleRows} mobile={isMobile} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>AOV = doanh thu ÷ số đơn chốt · Tỷ lệ chốt = đơn chốt ÷ tổng contact.</div>
          </div>
        )}

        {products.length > 0 && (
          <div style={panelStyle}>
            <div style={{ ...eyebrowStyle, marginBottom: 10 }}>■ THEO SẢN PHẨM · {products.length} SP</div>
            <RespTable cols={prodCols} data={prodRows} mobile={isMobile} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>NGƯỠNG ADS = %CPQC tối đa trước khi lỗ. 🟢 Scale · 🟡 Giữ · 🟠 Sửa · 🔴 Cắt. Giá vốn THẬT từng SP cộng từ file marketer.</div>
          </div>
        )}

        {abc.length > 0 && (
          <div style={panelStyle}>
            <div style={{ ...eyebrowStyle, marginBottom: 12 }}>◰ PHÂN TÍCH ABC (PARETO)</div>
            {[
              { g: 'A', color: C.green, desc: 'tạo 80% doanh thu — DỒN LỰC ads + giữ hàng' },
              { g: 'B', color: C.amber, desc: '15% tiếp theo — duy trì' },
              { g: 'C', color: C.muted2, desc: 'đuôi dài ~5% — cân nhắc cắt' },
            ].map((b) => {
              const list = abc.filter((x) => x.grp === b.g)
              return (
                <div key={b.g} style={{ padding: '8px 0', borderTop: b.g !== 'A' ? `1px solid ${C.line2}` : 'none' }}>
                  <span style={{ color: b.color, fontWeight: 600 }}>Nhóm {b.g} ({list.length} mã)</span>
                  <span style={{ fontSize: 12, color: C.muted }}> — {b.desc}</span>
                  <div style={{ fontSize: 12.5, color: C.muted2, marginTop: 3 }}>{list.map((x) => x.name).join(' · ') || '—'}</div>
                </div>
              )
            })}
          </div>
        )}
      </>)}

      {/* ── TỔNG LƯƠNG ── */}
      {tab === 'luong' && (luong.rows.length > 0 ? (() => {
        const pctL = co.dt > 0 ? luong.total / co.dt : 0
        const gap = pctL - inp.cpvhPct
        return (
          <div style={panelStyle}>
            <div style={{ ...eyebrowStyle, marginBottom: 12 }}>💰 LƯƠNG TỔNG (tham khảo · chi phí vận hành thực)</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 12 }}>
              {[
                { label: 'TỔNG LƯƠNG (VNĐ)', val: fmtMoney(luong.total), gold: true },
                { label: 'TỔNG LƯƠNG (RM)', val: Math.round(luong.total / SALARY_RATE).toLocaleString('vi-VN') },
                { label: '% LƯƠNG / DOANH THU', val: fmtPct(pctL) },
                { label: 'CPVH ĐANG ĐỂ', val: fmtPct(inp.cpvhPct) },
              ].map((k) => (
                <div key={k.label} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, letterSpacing: 1.5, color: C.muted, marginBottom: 6 }}>{k.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: k.gold ? C.gold : C.text }}>{k.val}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12.5, color: Math.abs(gap) > 0.01 ? C.amber : C.green, marginBottom: 12 }}>
              {Math.abs(gap) <= 0.01 ? '✓ CPVH đang để khá sát lương thực tế.' : `Lương thực ≈ ${fmtPct(pctL)} doanh thu, CPVH đang để ${fmtPct(inp.cpvhPct)} → nên chỉnh ô CPVH ≈ ${fmtPct(pctL)} cho sát.`}
            </div>
            <RespTable cols={luongCols} data={luong.rows} mobile={isMobile} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>MKT lấy từ file (HANT = Hà+Phy ×2) · <b style={{ color: C.muted2 }}>Sale TÍNH THEO CƠ CHẾ</b> (cứng F/26×công + hoa hồng %C2×DT sau hoàn + thưởng hoàn thấp; hoàn &gt;15% mất hoa hồng) · bộ phận cố định theo cài đặt · RM @6.500. <span style={{ color: C.amber }}>Chưa gồm</span> thưởng KPI/team tháng hiện tại; cuối tháng đối chiếu file thật.</div>
          </div>
        )
      })() : <div style={{ ...panelStyle, color: C.muted, textAlign: 'center' }}>Đang tải bảng lương… (cần file LƯƠNG SALE — bấm ⟳ Tải lại)</div>)}
    </div>
  )
}
