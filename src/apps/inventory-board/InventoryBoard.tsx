// ── KHO & ĐỀ XUẤT NHẬP HÀNG ──────────────────────────────────────────────────
// Bê cụm "Hàng hóa & Vận hành" (Đề xuất nhập hàng + Bom tỉnh + Tồn kho cảnh báo)
// từ dashboard bao-cao-cty sang UGC Lab cho nhân viên xem. Read-only.
// Dữ liệu lấy qua serverless /api/inventory-board (đọc 6 Google Sheet công khai).
// Logic restock + invRows port nguyên văn từ dashboard.tsx (đã verify ~20 vòng).
// Tỷ giá cố định 5800 (app cho nhân viên — doanh thu ×5800; dashboard là chuyện riêng).
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import PriceCalc from './PriceCalc'
import ProfitTruth from './ProfitTruth'
import { computeProfit } from './profitCalc'
import { computeVerdicts, hoanMatureDaysLeft, isComboName } from './verdict'
import type { VerdictRow, VGroup } from './verdict'
import GiftCombo from './GiftCombo'
import type { GiftMaster } from './giftPlan'
import RewardTab from './RewardTab'
import { useAppStore } from '../../stores/appStore'
import { loadBoardLinks, saveBoardLinks, loadSpTeam, saveSpTeam } from './boardConfig'

const TY_GIA = 5800
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
  { key: 'tong', label: 'File CPQC TỔNG các TEAM (sheet SẢN PHẨM_TH)' },
  { key: 'qlhb', label: 'File QLHB (hoàn / dòng tiền / bom tỉnh)' },
  { key: 'kho', label: 'File KHO (tồn kho + giá vốn)' },
  { key: 'sale', label: 'File SALE (chốt theo ngày — tốc độ bán)' },
  { key: 'nhaphang', label: 'File NHẬP HÀNG (đơn đang về — sheet Báo giá & thanh toán)' },
  { key: 'noton', label: 'File SALE NỢ ĐƠN (sheet Tồn kho dự kiến — SP nợ chưa gửi)' },
  { key: 'giftplan', label: 'File KẾ HOẠCH QUÀ (sheet 3 Tồn + 4 Kho quà — cho tab Ghép Quà)' },
  { key: 'team_apex', label: 'File TEAM APEX (Duy + Khánh — sheet BÁO CÁO SẢN PHẨM)' },
  { key: 'team_titan', label: 'File TEAM TITAN (Tuấn + Anh — sheet BÁO CÁO SẢN PHẨM)' },
  { key: 'team_summit', label: 'File TEAM SUMMIT (Hà + Phy — sheet BÁO CÁO SẢN PHẨM)' },
  { key: 'luongsale', label: 'File LƯƠNG SALE (sheet Salary table — cho Cockpit Điều hành)' },
]
// Default = link THÁNG 7/2026. Chỉ là dự phòng — link chính lấy từ board_config (Supabase),
// chủ dán tháng mới là cả công ty nhảy tháng. Đổi tháng: dán ở ⚙ Cấu hình → Lưu.
const DEFAULT_SOURCES: Record<string, string> = {
  tong: 'https://docs.google.com/spreadsheets/d/1ZOYU59Dyrwmm7w2Iw-BXAZFX_BL5XFsofFyqWQ2zShQ/edit',
  qlhb: 'https://docs.google.com/spreadsheets/d/1gci7u1_aTX_xutnSbCf7t-fu-2wowTqBdjHaa4dQTBQ/edit',
  kho: 'https://docs.google.com/spreadsheets/d/1m3L6WQnB9Eto9Gugs5PgycYUs-x3YZieP-4vpzbIv7A/edit',
  sale: 'https://docs.google.com/spreadsheets/d/145HZHGdZpwTXmzyMiXsnGfrgKOM-jtjrIWoJkQrgD7s/edit',
  nhaphang: 'https://docs.google.com/spreadsheets/d/1amJrEI5Z279_4ALWIco3oZETrB4F77cpkD1zSXENrg8/edit',
  noton: 'https://docs.google.com/spreadsheets/d/1cRjjRr8DKK16Nkwx7bhBBWyhCGwhqNroouZ8DBqAbsY/edit',
  giftplan: 'https://docs.google.com/spreadsheets/d/1NiCESFek8BYyycTHUMvcMhxpuNDsCI7KplpIxERhOW8/edit',
  team_apex: 'https://docs.google.com/spreadsheets/d/1BFGlk9lDGqjmpsiG4p813ExdDZL90tVLXqy7izoGKw8/edit',
  team_titan: 'https://docs.google.com/spreadsheets/d/1YEgGsUjiWYHCYv5bpxspoRMhDPe6sUhfRBDrcxrj--I/edit',
  team_summit: 'https://docs.google.com/spreadsheets/d/1A4Mz7aRWM9hYLE9ISqlIyAJoLKY8fjN_XiHtB7czLtQ/edit',
  luongsale: 'https://docs.google.com/spreadsheets/d/1E5SDrQ78IwYzs4NCaJSU2G0slR2Dx8TMBagCS5eNkzk/edit',
}
const STORAGE_KEY = 'inv_board_sources'
const GOOD_KEY = 'inv_board_lastgood' // cache "số tốt gần nhất" để load lỗi vẫn hiện đủ số

// Màu TEAM — 4 hệ màu TÁCH HẲN nhau (cyan · tím · xanh lá · cam) để liếc là phân biệt được.
// Dùng CHUNG cho dropdown cột Team + dải vốn kẹt theo team.
const TEAM_COLOR: Record<string, { fg: string; bg: string }> = {
  APEX: { fg: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },   // cyan
  TITAN: { fg: '#c084fc', bg: 'rgba(192,132,252,0.12)' }, // tím
  SUMMIT: { fg: '#4ade80', bg: 'rgba(74,222,128,0.12)' }, // xanh lá
  '': { fg: '#fbbf24', bg: 'rgba(251,191,36,0.10)' },     // chưa gán — cam
}
const teamColor = (t: string) => TEAM_COLOR[t] ?? TEAM_COLOR['']

// ── kiểu dữ liệu trả về từ endpoint ──────────────────────────────────────────
interface Prod { name: string; rmRevenue: number; cpqc: number; pctCpqc: number; pctHoan: number; c2: number; pctChot: number; hoanEstimated?: boolean }
interface InvItem { ten: string; ton: number; ban: number; giaVonRM: number; giaVonVnd: number }
interface Incoming { ma: string; qty: number; order: string; eta: string }
interface BackorderItem { ma: string; donNo: number; spNo: number; ton: number; tonDuKien: number }
interface Province { ten: string; doanhSoRM: number; hoanRate: number }
interface BoardData {
  ok: boolean
  products: Prod[]
  inv: InvItem[]
  velocity: Record<string, number>
  velDaily: Record<string, number[]>
  saleStats: Record<string, { chot: number; upsell: number }>
  incoming: Incoming[]
  priceVnd: Record<string, number>
  backorder: BackorderItem[]
  provinces: Province[]
  cashflow: { pendingDS: number; returnDS: number; returnedDS: number; deliveryDS: number; paidDS: number } | null
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

  const [tab, setTab] = useState<'kho' | 'calc' | 'profit' | 'gift' | 'reward'>('kho')
  const [view, setView] = useState<'ceo' | 'nv'>(() => (localStorage.getItem('inv_board_view') === 'nv' ? 'nv' : 'ceo'))
  const [nvTeam, setNvTeam] = useState<'APEX' | 'TITAN' | 'SUMMIT'>(() => {
    const t = localStorage.getItem('inv_board_team'); return t === 'TITAN' || t === 'SUMMIT' ? t : 'APEX'
  })
  const [teamSp, setTeamSp] = useState<Record<string, string[]>>({})
  const [teamLoading, setTeamLoading] = useState(false)
  const [showCho, setShowCho] = useState(false) // nhóm CHỜ (do-nothing) gập mặc định cho gọn
  const [sources, setSources] = useState<Record<string, string>>({})
  const [showCfg, setShowCfg] = useState(false)
  const [saved, setSaved] = useState(false)
  const [data, setData] = useState<BoardData | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'live' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')
  const [lastUpdate, setLastUpdate] = useState('')
  const [boardStale, setBoardStale] = useState(false) // đang hiện số cache (load mới bị chặn)

  // "Tốt" = TỔNG + KHO về (5 file nhẹ). QLHB (hoàn/tỉnh/dòng tiền) tải riêng /api/qlhb.
  function isGoodBoard(j: BoardData) { return (j.products?.length ?? 0) > 0 && (j.inv?.length ?? 0) > 0 }
  function readGood(): { data: BoardData; at: string } | null {
    try { const c = localStorage.getItem(GOOD_KEY); if (c) { const p = JSON.parse(c); if (p?.data?.products?.length) return p } } catch { /* ignore */ }
    return null
  }
  const nowHM = () => new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  async function load(s: Record<string, string>) {
    setStatus('loading'); setErrMsg('')
    // Gọi SONG SONG: board (5 file nhẹ, nhanh) + qlhb (file nặng, function riêng 60s).
    type QlhbResp = { hoanMap?: Record<string, number>; hoanEst?: Record<string, boolean>; provinces?: BoardData['provinces']; cashflow?: BoardData['cashflow'] }
    const [boardRes, qlhbRes] = await Promise.allSettled([
      fetch('/api/inventory-board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ links: s }), cache: 'no-store' }).then((r) => r.json() as Promise<BoardData>),
      fetch('/api/qlhb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ link: s.qlhb || '' }), cache: 'no-store' }).then((r) => r.json() as Promise<QlhbResp>),
    ])
    const q = qlhbRes.status === 'fulfilled' ? qlhbRes.value : null
    // Gộp hoàn (đè per-SP) + tỉnh + dòng tiền từ /api/qlhb vào dữ liệu board.
    const merge = (d: BoardData): BoardData => {
      if (!q) return d
      if (q.hoanMap) for (const p of d.products ?? []) { const k = p.name.trim().toUpperCase(); const h = q.hoanMap[k]; if (h != null) { p.pctHoan = h; p.hoanEstimated = q.hoanEst?.[k] ?? false } }
      if (Array.isArray(q.provinces)) d.provinces = q.provinces
      if (q.cashflow) d.cashflow = q.cashflow
      return d
    }
    try {
      if (boardRes.status !== 'fulfilled') throw new Error('Không tải được dữ liệu kho')
      const j = merge(boardRes.value)
      if (isGoodBoard(j)) {
        const at = nowHM()
        setData(j); setBoardStale(false); setStatus('live'); setLastUpdate(at)
        try { localStorage.setItem(GOOD_KEY, JSON.stringify({ data: j, at })) } catch { /* quota */ }
        return
      }
      const cached = readGood()
      if (cached) { setData(merge(cached.data)); setBoardStale(true); setStatus('live'); setLastUpdate(cached.at); return }
      if ((j.products?.length ?? 0) > 0 || (j.inv?.length ?? 0) > 0) { setData(j); setBoardStale(false); setStatus('live'); setLastUpdate(nowHM()) }
      else throw new Error(j.errors?.join(' · ') || 'Không tải được dữ liệu')
    } catch (e) {
      const cached = readGood()
      if (cached) { setData(merge(cached.data)); setBoardStale(true); setStatus('live'); setLastUpdate(cached.at); return }
      setErrMsg(e instanceof Error ? e.message : 'Lỗi tải dữ liệu')
      setStatus('error')
    }
  }

  useEffect(() => {
    let saved: Record<string, string> = {}
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { /* ignore */ }
    const local = { ...DEFAULT_SOURCES, ...saved }
    setSources(local)
    // F5 / mở lại → hiện NGAY số tốt đã cache (khỏi chờ ~1 phút), rồi tải mới ngầm.
    const cached = readGood()
    if (cached) { setData(cached.data); setBoardStale(true); setStatus('live'); setLastUpdate(cached.at) }
    // Link DÙNG CHUNG (Supabase) đè link máy này → đầu tháng chủ dán 1 lần là cả công ty
    // nhảy tháng. Supabase lỗi/chưa cấu hình → dùng local/default. Chỉ load 1 lần sau khi có link.
    void (async () => {
      const shared = await loadBoardLinks()
      const s = shared ? { ...local, ...shared } : local
      if (shared) { setSources(s); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* quota */ } }
      void load(s)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Deep-link: app khác (nút Ghép quà / Máy tính giá ở Tác Chiến) đặt localStorage 'inv_board_tab'
  // rồi mở app này. Theo dõi activeApp để mở đúng tab KỂ CẢ khi app đã mount sẵn (shell giữ app sống).
  const activeApp = useAppStore((s) => s.activeApp)
  useEffect(() => {
    if (activeApp !== 'inventory-board') return
    try {
      const t = localStorage.getItem('inv_board_tab')
      if (t && ['kho', 'calc', 'profit', 'gift', 'reward'].includes(t)) { setTab(t as 'kho' | 'calc' | 'profit' | 'gift' | 'reward'); localStorage.removeItem('inv_board_tab') }
    } catch { /* ignore */ }
  }, [activeApp])

  // tự làm mới mỗi 5 phút
  useEffect(() => {
    if (!Object.keys(sources).length) return
    const id = setInterval(() => void load(sources), 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [sources])

  // nhớ lựa chọn view/team trên máy này
  useEffect(() => { try { localStorage.setItem('inv_board_view', view) } catch { /* quota */ } }, [view])
  useEffect(() => { try { localStorage.setItem('inv_board_team', nvTeam) } catch { /* quota */ } }, [nvTeam])
  // Nạp map TEAM→[mã SP] (cùng endpoint, nhánh marketerSp) — lazy khi mở view nhân viên
  // HOẶC tab Thưởng (gán winner) HOẶC tab Kho (cột Team ở bảng tồn). Tải 1 lần, dùng chung.
  useEffect(() => {
    if ((view !== 'nv' && tab !== 'reward' && tab !== 'kho') || Object.keys(teamSp).length || !Object.keys(sources).length) return
    setTeamLoading(true)
    fetch('/api/inventory-board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ marketerSp: true, links: sources }), cache: 'no-store' })
      .then((r) => r.json()).then((j) => { if (j?.marketerSp) setTeamSp(j.marketerSp) }).catch(() => { /* để rỗng → hiện báo thiếu */ }).finally(() => setTeamLoading(false))
  }, [view, tab, sources, teamSp])

  function saveSources() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sources))
    void saveBoardLinks(sources) // dán DÙNG CHUNG → mọi máy/điện thoại nhảy tháng theo
    setSaved(true); setTimeout(() => setSaved(false), 2000)
    void load(sources)
  }

  const productsAll = data?.products ?? []
  // combo "+ GIFT" không phải SKU kho riêng (số thật ở mã gốc) → lọc khỏi board, Lãi thật, máy tính giá
  const products = useMemo(() => productsAll.filter((p) => !isComboName(p.name)), [productsAll])
  const inv = data?.inv ?? []
  const velocity = data?.velocity ?? {}
  const velDaily = data?.velDaily ?? {}
  const saleStats = data?.saleStats ?? {}
  const incoming = data?.incoming ?? []
  const priceVnd = data?.priceVnd ?? {}
  const provinces = data?.provinces ?? []
  const backorder = useMemo(() => {
    const m: Record<string, { donNo: number; spNo: number }> = {}
    ;(data?.backorder ?? []).forEach((x) => { m[x.ma] = { donNo: x.donNo, spNo: x.spNo } })
    return m
  }, [data])

  // lãi thật từng SP (lõi dùng chung) — cho feed việc gấp + buồng lái vốn
  const profitRows = useMemo(() => computeProfit(products, inv, velocity, priceVnd), [products, inv, velocity, priceVnd])

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

  // ⚡ VIỆC CẦN LÀM GẤP — nối kho × ads × lãi, 1 việc gắt nhất / mã, xếp theo độ cháy túi
  const feed = useMemo(() => {
    const rMap = new Map(restock.map((r) => [r.name.trim().toUpperCase(), r]))
    type A = { tone: 'red' | 'amber'; title: string; reason: string; score: number }
    const acts: A[] = []
    for (const p of profitRows) {
      const r = rMap.get(p.name.trim().toUpperCase())
      const urgent = !!r && (r.act === 'NHẬP GẤP' || r.act.startsWith('⚠'))
      const ngay = r && r.cover < 0 ? 0 : r ? Math.round(r.cover) : 0
      const mag = Math.abs(p.laiNgay)
      if (urgent && p.adsPct > 0.2) acts.push({ tone: 'red', title: `${p.name} — đốt ads mà sắp đứt`, reason: `đang chạy ads ${fmtPct(p.adsPct)} mà chỉ còn ~${ngay} ngày hàng → nhập gấp hoặc ghìm ads`, score: 120 + mag / 1e4 })
      else if (p.laiPct < 0 && p.adsPct > 0.3) acts.push({ tone: 'red', title: `${p.name} — lỗ kép đang đốt ads`, reason: `lỗ ${fmtMoney(p.laiDon)}/đơn mà vẫn đốt ads ${fmtPct(p.adsPct)} → cắt hoặc sửa giá/combo gấp`, score: 100 + mag / 1e4 })
      else if (r && r.spNo > 0) acts.push({ tone: 'amber', title: `${p.name} — nợ hàng chưa gửi`, reason: `nợ ${Math.round(r.spNo).toLocaleString('vi-VN')} cái → đặt bù gấp`, score: 70 })
      else if (p.hoanPct > 0.45) acts.push({ tone: 'amber', title: `${p.name} — hoàn ${fmtPct(p.hoanPct)}`, reason: `khách bom nặng → chặn COD tỉnh bom / ép cọc`, score: 60 + mag / 1e4 })
      else if (urgent) acts.push({ tone: 'amber', title: `${p.name} — sắp đứt hàng`, reason: `còn ~${ngay} ngày → nhập bù`, score: 50 })
    }
    return acts.sort((a, b) => b.score - a.score).slice(0, 6)
  }, [restock, profitRows])

  // 💰 BUỒNG LÁI VỐN — vốn cần nhập + vốn đọng hàng ế (KHÔNG tính tiền COD — đã bỏ vì không cho nhân viên thấy)
  const cockpit = useMemo(() => {
    const vonNhap = restock.reduce((s, r) => s + r.von, 0)
    const eDong = invRows.filter((r) => r.st.t === 'Ế/đọng').reduce((s, r) => s + r.value, 0)
    return { vonNhap, eDong }
  }, [restock, invRows])

  // ── BẢNG TỒN KHO ────────────────────────────────────────────────────────────
  // TỒN + GIÁ VỐN lấy từ file KHO (inv — LIVE, đã tải sẵn ở load chính). KHÔNG lấy tồn từ file
  // KẾ HOẠCH: sheet đó ghi "LIVE" nhưng thực là SNAPSHOT cũ (verify: 28/55 mã lệch, vd KIDNEY
  // PATCH 10.783 vs 8.498 thật). File kế hoạch CHỈ dùng để mượn cột Ngách (nhãn, cũ vẫn đúng).
  // Vốn kẹt = tồn × vốn/sp. KHÔNG lấy cột Vai trò. Tải lười ngách: chỉ khi mở tab Kho.
  const [tonMaster, setTonMaster] = useState<GiftMaster[]>([])
  const [tonLoading, setTonLoading] = useState(false)
  const [tonOpen, setTonOpen] = useState(false) // thu gọn: header hiện sẵn tổng vốn kẹt, bấm mới mở bảng
  useEffect(() => {
    if (tab !== 'kho' || tonMaster.length || tonLoading || !sources.giftplan) return
    setTonLoading(true)
    fetch('/api/inventory-board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ giftOnly: true, links: { giftplan: sources.giftplan } }), cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setTonMaster(j.giftMaster || []))
      .catch(() => { /* giữ trống, hiện thông báo */ })
      .finally(() => setTonLoading(false))
  }, [tab, sources.giftplan, tonMaster.length, tonLoading])

  // TEAM phụ trách: ưu tiên bản ĐÈ TAY (board_config, dùng chung) → tự suy từ file team
  // (marketerSp). MỖI MÃ CHỈ 1 TEAM (mã ở nhiều team → lấy team khớp đầu tiên) nên tổng
  // vốn theo team KHÔNG bị đếm trùng.
  const TEAMS = ['APEX', 'TITAN', 'SUMMIT'] as const
  const [spTeam, setSpTeam] = useState<Record<string, string>>({})
  const [teamFilter, setTeamFilter] = useState<string>('ALL')
  useEffect(() => {
    let alive = true
    void (async () => {
      const shared = await loadSpTeam()
      if (!alive) return
      if (shared) { setSpTeam(shared); try { localStorage.setItem('inv_sp_team', JSON.stringify(shared)) } catch { /* quota */ } }
      else { try { const c = JSON.parse(localStorage.getItem('inv_sp_team') || 'null'); if (c) setSpTeam(c) } catch { /* ignore */ } }
    })()
    return () => { alive = false }
  }, [])

  const autoTeamOf = useMemo(() => {
    const m: Record<string, string> = {}
    for (const t of TEAMS) for (const code of teamSp[t] ?? []) { const k = code.trim().toUpperCase(); if (!m[k]) m[k] = t }
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamSp])

  function setTeamFor(name: string, team: string) {
    const k = name.trim().toUpperCase()
    const next = { ...spTeam }
    if (team) next[k] = team; else delete next[k]
    setSpTeam(next)
    try { localStorage.setItem('inv_sp_team', JSON.stringify(next)) } catch { /* quota */ }
    void saveSpTeam(next) // dùng chung cả công ty
  }

  const tonRows = useMemo(() => {
    const ngachOf = new Map(tonMaster.map((m) => [m.name.trim().toUpperCase(), m.ngach]))
    return inv
      .map((it) => {
        const k = it.ten.trim().toUpperCase()
        const vonSp = it.giaVonVnd > 0 ? it.giaVonVnd : it.giaVonRM * TY_GIA
        return { name: it.ten, ngach: ngachOf.get(k) ?? '', team: spTeam[k] ?? autoTeamOf[k] ?? '', ton: it.ton, vonSp, vonKet: it.ton * vonSp }
      })
      .sort((a, b) => b.vonKet - a.vonKet)
  }, [inv, tonMaster, spTeam, autoTeamOf])

  // Vốn kẹt theo TEAM — hiện LUÔN (không cần lọc), bấm để lọc nhanh.
  const tonByTeam = useMemo(() => {
    const keys = [...TEAMS, ''] as string[]
    return keys.map((t) => {
      const rows = tonRows.filter((r) => r.team === t)
      return { team: t, count: rows.length, vonKet: rows.reduce((s, r) => s + r.vonKet, 0) }
    }).filter((x) => x.count > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tonRows])

  const tonShown = useMemo(
    () => (teamFilter === 'ALL' ? tonRows : tonRows.filter((r) => r.team === (teamFilter === 'NONE' ? '' : teamFilter))),
    [tonRows, teamFilter],
  )
  const tonTotal = useMemo(() => ({ ton: tonShown.reduce((s, r) => s + r.ton, 0), vonKet: tonShown.reduce((s, r) => s + r.vonKet, 0) }), [tonShown])

  // ── BẢNG ĐIỀU PHỐI: 1 verdict/mã (lãi thật × tồn × trend), gom theo việc cần làm ──
  const verdicts = useMemo(
    () => computeVerdicts(products, inv, velocity, velDaily, priceVnd, incoming, backorder),
    [products, inv, velocity, velDaily, priceVnd, incoming, backorder],
  )
  const byGroup = useMemo(() => {
    const g: Record<VGroup, VerdictRow[]> = { nhap: [], cho: [], suano: [], cat: [] }
    verdicts.forEach((v) => g[v.group].push(v))
    return g
  }, [verdicts])
  const triage = useMemo(() => ({
    rotVon: byGroup.nhap.filter((v) => !v.noAction).length,
    cho: byGroup.cho.length,
    cat: byGroup.cat.length,
    suano: byGroup.suano.length,
    vonNhap: verdicts.reduce((s, v) => s + v.von, 0),
    eDong: cockpit.eDong,
    matLeft: hoanMatureDaysLeft(),
  }), [byGroup, verdicts, cockpit])
  // NV: chỉ mã của team đang chọn (map TEAM→SP từ marketerSp, tên mã UPPERCASE)
  const nvByGroup = useMemo(() => {
    const set = new Set((teamSp[nvTeam] ?? []).map((s) => s.trim().toUpperCase()))
    const g: Record<VGroup, VerdictRow[]> = { nhap: [], cho: [], suano: [], cat: [] }
    if (set.size) verdicts.forEach((v) => { if (set.has(v.name.trim().toUpperCase())) g[v.group].push(v) })
    return g
  }, [verdicts, teamSp, nvTeam])

  // ── render verdict (dùng cho cả CEO; thẻ đã sẵn dạng card → mobile chạy luôn) ──
  const toneCol = (t: VerdictRow['tone']) => (t === 'green' ? C.green : t === 'red' ? C.red : t === 'gray' ? C.muted2 : C.amber)
  const num = (n: number) => Math.round(n).toLocaleString('vi-VN')
  const signPct = (n: number) => (n >= 0 ? '+' : '') + Math.round(n * 100) + '%'
  const coverTxt = (c: number) => (c <= 0 ? 'gãy hàng' : c >= 999 ? '∞' : Math.round(c) + ' ngày')
  const STRUCT_TIP = 'lãi nếu bỏ hoàn ra — đo sức khỏe thật của mã'
  const stat = (label: string, val: string, valCol: string, sub?: string, titleAttr?: string) => (
    <div style={{ minWidth: 62 }}>
      <div style={{ fontSize: 9.5, letterSpacing: 0.5, color: C.muted }} title={titleAttr}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: valCol, lineHeight: 1.15 }}>{val}</div>
      {sub ? <div style={{ fontSize: 10.5, color: C.muted }}>{sub}</div> : null}
    </div>
  )
  // lãi%: to + xanh (lãi) / đỏ (lỗ) cho nổi
  const laiTag = (laiPct: number) => <b style={{ color: laiPct >= 0 ? C.green : C.red, fontSize: 14 }}>{signPct(laiPct)}</b>
  // dòng "vì sao / làm gì" — lãi quy về %, không VNĐ
  const noteOf = (v: VerdictRow): ReactNode => {
    const hoan = fmtPct(v.hoanPct)
    if (v.group === 'cho') return <>hoàn ƯT(T6) <b style={{ color: C.muted2 }}>{hoan}</b> · {v.laiStruct >= 0.05 ? 'bỏ hoàn ra vẫn lãi → chờ đơn T7 về mới chốt' : 'cấu trúc mỏng, hoàn T7 còn cao là cắt'}</>
    if (v.group === 'cat') return <>lãi {laiTag(v.laiPct)} · hoàn <b style={{ color: C.red }}>{hoan}</b> · {v.chayDat ? '🔥 chạy đắt · ' : ''}{v.kind === 'xa' ? 'thanh lý lấy vốn' : 'tắt ads, ép cọc/chặn tỉnh'}</>
    if (v.group === 'suano') return v.kind === 'no' ? <>nợ <b style={{ color: C.red }}>{num(v.donNo)}</b> đơn chưa gửi → bù gấp hoặc huỷ đơn</> : <>hoàn <b style={{ color: C.amber }}>{hoan}</b> · ads cao → sửa giá-combo-chặn tỉnh trước khi nhập</>
    if (v.kind === 'dangve') return <>đang về <b style={{ color: C.amber }}>{num(v.incQty)}</b>{v.incEta ? ` (${v.incEta.slice(8, 10)}/${v.incEta.slice(5, 7)})` : ''} — đừng đặt thêm · lãi {laiTag(v.laiPct)}</>
    if (v.kind === 'khoan') return <>đơn đang tụt → nhập lô nhỏ, theo dõi 3-5 ngày · lãi {laiTag(v.laiPct)}</>
    return <>lãi {laiTag(v.laiPct)} · hoàn <b style={{ color: C.muted2 }}>{hoan}</b>{v.nhapQty > 0 ? ' · nhập xong đủ chạy ~38 ngày' : ' · còn dư địa'}</>
  }
  const vCard = (v: VerdictRow) => {
    const tc = toneCol(v.tone)
    const tonShow = Math.max(0, Math.round(v.ton)).toLocaleString('vi-VN')
    const stockCol = v.cover <= 0 ? C.red : v.sapDut ? C.amber : C.muted2
    const coverCol = v.cover <= 15 ? C.red : v.cover <= 25 ? C.amber : C.muted2
    const tSub = v.trend === 'gay' ? '⚠ gãy' : v.trend === 'tut' ? `↘ ${Math.round(v.vel)}→${Math.round(v.v3)}` : v.trend === 'up' ? '↗ tăng' : ''
    let s4: ReactNode
    if (v.group === 'nhap') s4 = stat('NHẬP', v.nhapQty > 0 ? num(v.nhapQty) : '—', v.nhapQty > 0 ? C.gold : C.muted, v.von > 0 ? fmtMoney(v.von) : (v.kind === 'dangve' ? 'đang về' : ''))
    else if (v.group === 'cho') s4 = stat('CẤU TRÚC', signPct(v.laiStruct), v.laiStruct >= 0 ? C.green : C.red, 'chờ hoàn T7', STRUCT_TIP)
    else if (v.group === 'cat') s4 = stat('CẤU TRÚC', signPct(v.laiStruct), C.red, 'ads ' + fmtPct(v.adsPct), STRUCT_TIP)
    else s4 = v.kind === 'no' ? stat('NỢ', num(v.spNo), C.red, 'cái') : stat('ADS', fmtPct(v.adsPct), C.amber, 'hoàn ' + fmtPct(v.hoanPct))
    return (
      <div key={v.name} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {v.name}
            {v.hoanEst && <span title="hoàn đang lấy số tháng trước — chưa chốt" style={{ background: '#23262e', color: C.muted2, borderRadius: 6, padding: '1px 6px', fontSize: 10.5, marginLeft: 5 }}>~ƯT</span>}
          </div>
          <span style={{ color: tc, border: `1px solid ${tc}`, borderRadius: 20, padding: '3px 11px', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>{v.label}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))', gap: 10 }}>
          {stat('TỒN', tonShow, stockCol, v.spNo > 0 ? `nợ ${num(v.spNo)}` : (v.ton < 0 ? 'âm kho' : 'cái'))}
          {stat('ĐANG BÁN', (Math.round(v.vel * 10) / 10) + '/ngày', C.muted2, tSub)}
          {stat('CÒN', coverTxt(v.cover), coverCol, 'đặt thêm khi tồn còn ' + num(v.rop))}
          {s4}
        </div>
        <div style={{ display: 'flex', gap: 18, marginTop: 10, fontSize: 12, flexWrap: 'wrap' }}>
          <span style={{ color: C.muted }}>DOANH THU <b style={{ color: C.text }}>{fmtMoney(v.doanhThu)}</b></span>
          <span style={{ color: C.muted }}>CPQC <b style={{ color: C.amber }}>{fmtMoney(v.cpqc)}</b> - <b style={{ color: v.laiPct >= 0 ? C.green : C.red }}>{Math.round(v.adsPct * 100)}%</b></span>
        </div>
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>{noteOf(v)}</div>
      </div>
    )
  }
  const groupSection = (title: string, dotCol: string, rows: VerdictRow[], sub?: string) => {
    if (!rows.length) return null
    return (
      <div key={title}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0 9px', flexWrap: 'wrap' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotCol }} />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: dotCol }}>{title}</span>
          {sub && <span style={{ fontSize: 11, color: C.muted }}>· {sub}</span>}
        </div>
        {rows.map(vCard)}
        <div style={{ height: 10 }} />
      </div>
    )
  }
  // ── 🛒 CẦN ĐẶT HÀNG — danh sách gọn để nhân viên canh đề xuất (chỉ mã có số nhập) ──
  const reorderList = (rows: VerdictRow[]) => (
    <div style={{ background: C.panel2, border: `1px solid ${C.gold}`, borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.gold }}>🛒 CẦN ĐẶT HÀNG · {rows.length} mã</div>
      {rows.length === 0
        ? <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Chưa mã nào tới điểm đặt lại — cứ chạy, chưa cần đặt.</div>
        : rows.map((v) => (
          <div key={v.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '8px 0 2px', borderTop: `1px solid ${C.line2}`, flexWrap: 'wrap', marginTop: 7 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{v.name}</span>
            <span style={{ fontSize: 12.5, color: C.muted2 }}>
              <b style={{ color: C.gold, fontSize: 15 }}>đặt {num(v.nhapQty)}</b>
              {' · '}{v.kind === 'khoan' ? 'lô nhỏ (đơn tụt)' : v.cover <= 0 ? 'đang gãy hàng' : `còn ${Math.round(v.cover)} ngày`}
              {v.von > 0 ? ` · vốn ~${fmtMoney(v.von)}` : ''}
            </span>
          </div>
        ))}
    </div>
  )
  // ── NV: thẻ gọn — TỒN + CÒN ngày + việc (số to, ít chữ) ────────────────────
  const miniFact = (v: VerdictRow): string => {
    const tonS = Math.max(0, Math.round(v.ton)).toLocaleString('vi-VN')
    if (v.group === 'nhap') {
      if (v.kind === 'dangve') return `tồn ${tonS} · đang về ${num(v.incQty)}`
      if (v.nhapQty > 0) return `tồn ${tonS} · còn ${coverTxt(v.cover)} · nhập ${num(v.nhapQty)}`
      return `tồn ${tonS} · còn ${coverTxt(v.cover)} · đủ chạy`
    }
    if (v.group === 'cho') return `cấu trúc ${signPct(v.laiStruct)} · chờ hoàn T7`
    if (v.group === 'suano') return v.kind === 'no' ? `nợ ${num(v.spNo)} cái → đặt bù` : `hoàn ${fmtPct(v.hoanPct)} — sửa`
    return `tồn ${tonS} · cắt (ads ${fmtPct(v.adsPct)})`
  }
  const vCardMini = (v: VerdictRow) => {
    const tc = toneCol(v.tone)
    return (
      <div key={v.name} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '9px 12px', marginBottom: 7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <span style={{ color: tc, border: `1px solid ${tc}`, borderRadius: 20, padding: '2px 8px', fontSize: 10.5, whiteSpace: 'nowrap' }}>{v.label}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{v.name}{v.hoanEst ? ' ~ƯT' : ''}</span>
          </div>
          <span style={{ fontSize: 11.5, color: C.muted2, whiteSpace: 'nowrap' }}>{miniFact(v)}</span>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>DT <b style={{ color: C.muted2 }}>{fmtMoney(v.doanhThu)}</b> · CPQC <b style={{ color: C.amber }}>{fmtMoney(v.cpqc)}</b> - <b style={{ color: v.laiPct >= 0 ? C.green : C.red }}>{Math.round(v.adsPct * 100)}%</b></div>
      </div>
    )
  }
  const groupSectionMini = (title: string, dotCol: string, rows: VerdictRow[]) => {
    if (!rows.length) return null
    return (
      <div key={title}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0 8px' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotCol }} />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: dotCol }}>{title} · {rows.length}</span>
        </div>
        {rows.map(vCardMini)}
        <div style={{ height: 10 }} />
      </div>
    )
  }

  const provCols: Col<Province>[] = [
    { label: 'TỈNH', node: (p) => p.ten },
    { label: 'DOANH SỐ', node: (p) => <span style={{ color: C.gold }}>{fmtMoney(p.doanhSoRM * TY_GIA)}</span> },
    { label: '% HOÀN', node: (p) => <span style={{ color: p.hoanRate > 0.45 ? C.red : p.hoanRate > 0.35 ? C.amber : C.muted2 }}>{fmtPct(p.hoanRate)}</span> },
    { label: 'KHUYẾN NGHỊ', center: true, node: (p) => {
        const st = p.hoanRate > 0.45 ? { t: 'Chặn COD / cọc', c: C.red } : p.hoanRate > 0.35 ? { t: 'Bắt cọc', c: C.amber } : p.hoanRate > 0.28 ? { t: 'Theo dõi', c: C.amber } : { t: 'OK', c: C.green }
        return <span style={{ color: st.c, border: `1px solid ${st.c}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, whiteSpace: 'nowrap' }}>{st.t}</span>
      } },
  ]

  const tonCols: Col<(typeof tonRows)[number]>[] = [
    { label: 'SẢN PHẨM', node: (r) => r.name },
    { label: 'TEAM', node: (r) => {
      const tc = teamColor(r.team)
      return (
        <select
          value={r.team}
          onChange={(e) => setTeamFor(r.name, e.target.value)}
          title="Gán team phụ trách (dùng chung cả công ty)"
          style={{ background: tc.bg, border: `1px solid ${tc.fg}`, color: tc.fg, borderRadius: 6, padding: '3px 6px', fontSize: 12, fontWeight: 700 }}
        >
          <option value="" style={{ background: C.panel2, color: TEAM_COLOR[''].fg }}>— chưa gán —</option>
          {TEAMS.map((t) => <option key={t} value={t} style={{ background: C.panel2, color: TEAM_COLOR[t].fg }}>{t}</option>)}
        </select>
      )
    } },
    { label: 'NGÁCH', node: (r) => <span style={{ color: C.muted2 }}>{r.ngach || '—'}</span> },
    { label: 'TỒN', node: (r) => <span style={{ color: r.ton === 0 ? C.muted : C.text }}>{Math.round(r.ton).toLocaleString('vi-VN')}</span> },
    { label: 'VỐN / SP', node: (r) => <span style={{ color: C.muted2 }}>{r.vonSp > 0 ? fmtMoney(r.vonSp) : '—'}</span> },
    { label: 'VỐN KẸT', node: (r) => <span style={{ color: r.vonKet >= 50_000_000 ? C.red : r.vonKet >= 20_000_000 ? C.amber : r.vonKet > 0 ? C.gold : C.muted }}>{r.vonKet > 0 ? fmtMoney(r.vonKet) : '—'}</span> },
  ]

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
          {([['kho', '📦 Kho & Nhập hàng'], ['calc', '🧮 Máy tính giá'], ['profit', '🔥 Lãi thật/SP'], ['reward', '🏆 Thưởng & Cấp nhập'], ['gift', '🎁 Ghép Quà']] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)} style={{ background: tab === k ? C.gold : 'transparent', color: tab === k ? '#0a0a0a' : C.muted2, border: `1px solid ${tab === k ? C.gold : C.line}`, borderRadius: 10, padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{lbl}</button>
          ))}
        </div>

        {tab === 'kho' && (<>
        {/* xem theo: Chủ (đủ 5 nhóm) / Nhân viên (gọn, theo team) */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, letterSpacing: 1.5, color: C.muted }}>XEM THEO</span>
          {([['ceo', '👔 Chủ'], ['nv', '🧑‍💼 Nhân viên']] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => setView(k)} style={{ background: view === k ? C.gold : 'transparent', color: view === k ? '#0a0a0a' : C.muted2, border: `1px solid ${view === k ? C.gold : C.line}`, borderRadius: 9, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{lbl}</button>
          ))}
          {view === 'nv' && <span style={{ width: 1, height: 20, background: C.line, margin: '0 2px' }} />}
          {view === 'nv' && (['APEX', 'TITAN', 'SUMMIT'] as const).map((t) => (
            <button key={t} onClick={() => setNvTeam(t)} style={{ background: nvTeam === t ? C.panel2 : 'transparent', color: nvTeam === t ? C.gold : C.muted2, border: `1px solid ${nvTeam === t ? C.gold : C.line}`, borderRadius: 9, padding: '7px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{t}</button>
          ))}
        </div>
        {/* nguồn dữ liệu + cấu hình */}
        <div style={{ ...panelStyle, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, letterSpacing: 1.5, color: C.muted }}>NGUỒN DỮ LIỆU</span>
          <span style={{ flex: 1, minWidth: 160, fontSize: 12, color: status === 'error' ? C.red : boardStale ? C.amber : status === 'live' ? C.green : C.muted }}>
            {status === 'loading' ? '● Đang tải...'
              : status === 'error' ? `● ${errMsg}`
              : boardStale ? `● Số tốt gần nhất (lúc ${lastUpdate}) · lần tải mới bị Google chặn — bấm ⟳ thử lại`
              : status === 'live' ? `● Số thật · cập nhật ${lastUpdate} · tự làm mới mỗi 5'`
              : '● Đang tải...'}
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
            <div style={{ fontSize: 12, color: C.muted, margin: '4px 0 14px' }}>Dán link Google Sheet (đã để công khai) cho từng file. Bấm Lưu là <b>cả công ty</b> dùng chung — đầu tháng dán link tháng mới 1 lần, mọi máy/điện thoại tự nhảy tháng.</div>
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

        {!boardStale && data?.errors && data.errors.length > 0 && (
          <div style={{ ...panelStyle, borderColor: '#3a3414', padding: '10px 16px', fontSize: 12.5, color: C.amber }}>
            ⚠ Một vài nguồn chưa đọc được: {data.errors.join(' · ')}. Thử bấm ⟳ Tải lại vài lần (Google hay chặn lúc cao điểm); nếu vẫn thiếu, kiểm tra link đã công khai chưa ở ⚙ Cấu hình.
          </div>
        )}

        {status === 'loading' && !data && (
          <div style={{ ...panelStyle, textAlign: 'center', color: C.muted, fontSize: 14 }}>● Đang tải dữ liệu kho từ Google Sheet...</div>
        )}

        {/* BẢNG TỒN KHO — tồn + vốn kẹt (LIVE từ file KHO). Thu gọn để không đẩy Điều phối xuống. */}
        {view === 'ceo' && (
          <div style={panelStyle}>
            <button onClick={() => setTonOpen((v) => !v)} style={{ width: '100%', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', textAlign: 'left' }}>
              <span style={eyebrowStyle}>📦 BẢNG TỒN KHO{tonRows.length ? ` · ${tonShown.length}${teamFilter !== 'ALL' ? `/${tonRows.length}` : ''} mã` : ''}</span>
              {tonRows.length > 0 && (
                <span style={{ fontSize: 12.5, color: C.muted2 }}>
                  {teamFilter !== 'ALL' && <b style={{ color: C.gold }}>{teamFilter === 'NONE' ? 'CHƯA GÁN' : teamFilter} · </b>}
                  tồn <b style={{ color: C.text }}>{Math.round(tonTotal.ton).toLocaleString('vi-VN')}</b> · vốn kẹt <b style={{ color: C.gold }}>{fmtMoney(tonTotal.vonKet)}</b>
                </span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 12.5, color: C.gold }}>{tonOpen ? 'Thu gọn ▲' : 'Mở bảng ▼'}</span>
            </button>
            {tonOpen && (!tonRows.length ? (
              <div style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: '10px 0 2px' }}>{status === 'loading' ? '● Đang tải tồn kho...' : 'Chưa có dữ liệu tồn — kiểm tra link File KHO ở ⚙ Cấu hình link.'}</div>
            ) : (<>
              <div style={{ fontSize: 12, color: C.muted, margin: '10px 0 10px' }}>Tồn &amp; giá vốn lấy <b style={{ color: C.muted2 }}>LIVE từ file KHO</b>. Ngách mượn từ file kế hoạch. Team tự suy từ file team, <b style={{ color: C.muted2 }}>sửa tay được</b> (lưu dùng chung cả công ty). Xếp theo <b style={{ color: C.muted2 }}>vốn kẹt giảm dần</b>.</div>

              {/* VỐN KẸT THEO TEAM — hiện luôn, bấm để lọc nhanh */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {tonByTeam.map((t) => {
                  const key = t.team || 'NONE'
                  const on = teamFilter === key
                  const tc = teamColor(t.team)
                  return (
                    <button key={key} onClick={() => setTeamFilter(on ? 'ALL' : key)}
                      style={{ background: on ? tc.bg : C.panel2, border: `1px solid ${on ? tc.fg : C.line}`, borderRadius: 10, padding: '8px 12px', cursor: 'pointer', textAlign: 'left', minWidth: 140, borderLeft: `4px solid ${tc.fg}` }}>
                      <div style={{ fontSize: 10, letterSpacing: 1, color: tc.fg, fontWeight: 700, marginBottom: 3 }}>{t.team || 'CHƯA GÁN'} · {t.count} mã</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{fmtMoney(t.vonKet)}</div>
                    </button>
                  )
                })}
                {teamFilter !== 'ALL' && (
                  <button onClick={() => setTeamFilter('ALL')} style={{ background: 'transparent', border: `1px solid ${C.line}`, color: C.muted2, borderRadius: 10, padding: '8px 12px', fontSize: 12.5, cursor: 'pointer' }}>✕ Bỏ lọc</button>
                )}
              </div>
              {teamFilter !== 'ALL' && <div style={{ fontSize: 11.5, color: C.gold, marginBottom: 8 }}>Đang lọc: <b>{teamFilter === 'NONE' ? 'CHƯA GÁN' : teamFilter}</b> · {tonShown.length} mã — 2 ô tổng bên trên đã tính theo bộ lọc.</div>}

              <RespTable cols={tonCols} data={tonShown} mobile={isMobile} />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>🔴 vốn kẹt ≥50tr · 🟠 ≥20tr — ưu tiên xả/ghép quà mấy mã này để rút tiền về. Mã tồn 0 = đã hết hàng.</div>
            </>))}
          </div>
        )}

        {/* BẢNG ĐIỀU PHỐI NHẬP HÀNG — 1 verdict/mã, gom theo việc (view CHỦ) */}
        {view === 'ceo' && verdicts.length > 0 && (
          <div style={panelStyle}>
            <div style={eyebrowStyle}>🧭 BẢNG ĐIỀU PHỐI NHẬP HÀNG · {verdicts.length} mã · đề xuất — người chốt</div>
            <div style={{ fontSize: 12, color: C.muted, margin: '6px 0 12px' }}>Mỗi mã 1 việc gắt nhất, gộp lãi thật × tồn × trend · điểm đặt lại = bán/ngày × 15 (TQ 8 ngày + đệm 7).</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 9, marginBottom: 8 }}>
              {([
                ['NÊN RÓT VỐN', `${triage.rotVon} mã`, 'winner · nhập', C.green, '#1f3a28'],
                ['CHỜ SỐ THẬT', `${triage.cho} mã`, 'hoàn ƯT — chưa cắt', C.muted2, '#2a3140'],
                ['CẮT THẬT', `${triage.cat} mã`, 'cấu trúc âm', C.red, '#3a1820'],
                ['SỬA / NỢ', `${triage.suano} mã`, 'sửa giá / đặt bù', C.amber, '#3a3414'],
                ['Ế ĐỌNG', fmtMoney(triage.eDong), 'xả lấy vốn', C.muted2, '#1b2233'],
              ] as [string, string, string, string, string][]).map(([lbl, val, sub, col, bd], i) => (
                <div key={i} style={{ background: C.panel2, border: `1px solid ${bd}`, borderRadius: 12, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: col }}>{lbl}</div>
                  <div style={{ fontSize: 21, fontWeight: 600, margin: '1px 0' }}>{val}</div>
                  <div style={{ fontSize: 10.5, color: C.muted }}>{sub}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>Đầu tháng phần lớn nằm ở <b style={{ color: C.muted2 }}>CHỜ SỐ THẬT</b> (hoàn còn lấy T6) — chỉ cắt nhóm <b style={{ color: C.red }}>CẮT THẬT</b> (bỏ hoàn ra vẫn lỗ). Vốn cần nhập ~{fmtMoney(triage.vonNhap)}.</div>

            {reorderList(byGroup.nhap.filter((v) => v.nhapQty > 0))}
            {groupSection('NÊN NHẬP / VÍT — đổ tiền vào đây', C.green, byGroup.nhap.filter((v) => !v.noAction))}
            {groupSection('CẮT THẬT — tắt ads, xả tồn', C.red, byGroup.cat)}
            {groupSection('SỬA / NỢ HÀNG', C.amber, byGroup.suano)}
            {byGroup.cho.length > 0 && (
              <div>
                <button onClick={() => setShowCho((s) => !s)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: `1px dashed ${C.line}`, borderRadius: 10, padding: '9px 12px', cursor: 'pointer', color: C.muted2, marginBottom: showCho ? 9 : 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.muted2 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: C.muted2 }}>CHỜ SỐ THẬT · {byGroup.cho.length} mã</span>
                  <span style={{ fontSize: 11, color: C.muted }}>· đừng cắt vội · hoàn T7 đủ chín ~còn {triage.matLeft} ngày</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: C.gold }}>{showCho ? 'Ẩn ▲' : 'Xem ▼'}</span>
                </button>
                {showCho && byGroup.cho.map(vCard)}
                <div style={{ height: 10 }} />
              </div>
            )}
            {byGroup.nhap.some((v) => v.noAction) && <div style={{ fontSize: 11, color: C.muted }}>+ {byGroup.nhap.filter((v) => v.noAction).length} mã đủ hàng, ổn — không cần làm gì.</div>}
          </div>
        )}

        {/* BẢNG NHÂN VIÊN — gọn, chỉ mã của team, mỗi mã 1 việc */}
        {view === 'nv' && (
          <div style={panelStyle}>
            <div style={eyebrowStyle}>🧑‍💼 VIỆC CỦA TEAM {nvTeam} · mỗi mã 1 việc</div>
            <div style={{ fontSize: 12, color: C.muted, margin: '6px 0 12px' }}>Chỉ hiện mã team {nvTeam} đang chạy. Vít/Nhập = đổ tiền · Theo dõi = chờ số thật, chưa làm gì · Sửa/Nợ · Cắt = tắt ads.</div>
            {teamLoading && !Object.keys(teamSp).length ? (
              <div style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: '8px 0' }}>● Đang nạp danh sách mã của team...</div>
            ) : !(nvByGroup.nhap.length || nvByGroup.cho.length || nvByGroup.suano.length || nvByGroup.cat.length) ? (
              <div style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: '8px 0' }}>Chưa có mã cho team {nvTeam} (file team chưa công khai / chưa có số). Thử team khác hoặc bấm ⟳ Tải lại.</div>
            ) : (<>
              {reorderList(nvByGroup.nhap.filter((v) => v.nhapQty > 0))}
              {groupSectionMini('🟢 NHẬP / VÍT — đẩy mạnh', C.green, nvByGroup.nhap.filter((v) => !v.noAction))}
              {groupSectionMini('👀 THEO DÕI — chờ số thật', C.muted2, nvByGroup.cho)}
              {groupSectionMini('🟠 SỬA / NỢ HÀNG', C.amber, nvByGroup.suano)}
              {groupSectionMini('🔴 CẮT — tắt ads', C.red, nvByGroup.cat)}
              {nvByGroup.nhap.some((v) => v.noAction) && <div style={{ fontSize: 11, color: C.muted }}>+ {nvByGroup.nhap.filter((v) => v.noAction).length} mã đủ hàng, ổn.</div>}
            </>)}
          </div>
        )}

        {/* BOM HÀNG THEO TỈNH (chỉ view Chủ) */}
        {view === 'ceo' && provinces.length > 0 && (
          <div style={panelStyle}>
            <div style={eyebrowStyle}>⚑ BOM HÀNG THEO TỈNH · {provinces.length} tỉnh</div>
            <div style={{ height: 10 }} />
            <RespTable cols={provCols} data={provinces} mobile={isMobile} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>Tỉnh hoàn cao = khách hay bom hàng. 🔴 &gt;45%: nên chặn COD hoặc bắt đặt cọc · 🟠 &gt;35%: bắt cọc/đổi shipper · cắt hoàn từ gốc thay vì đốt thêm ads.</div>
          </div>
        )}

        {view === 'ceo' && status === 'live' && !verdicts.length && !provinces.length && (
          <div style={{ ...panelStyle, textAlign: 'center', color: C.muted, fontSize: 14 }}>Chưa có dữ liệu hiển thị. Kiểm tra link nguồn ở ⚙ Cấu hình.</div>
        )}
        </>)}

        {tab === 'profit' && <ProfitTruth products={products} inv={inv} velocity={velocity} priceVnd={priceVnd} feed={feed} cockpit={cockpit} />}

        {tab === 'reward' && <RewardTab products={products} inv={inv} velocity={velocity} priceVnd={priceVnd} teamSp={teamSp} isCEO={view === 'ceo'} mobile={isMobile} />}

        {tab === 'gift' && <GiftCombo products={products} giftLink={sources.giftplan || ''} />}

        {tab === 'calc' && <PriceCalc products={products} priceVnd={priceVnd} inv={inv} velocity={velocity} saleStats={saleStats} />}
      </div>
    </div>
  )
}
