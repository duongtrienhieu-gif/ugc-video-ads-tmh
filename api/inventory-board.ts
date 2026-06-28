// ── Vercel serverless — KHO & ĐỀ XUẤT NHẬP HÀNG (đọc Google Sheet công khai) ──
// Gộp 6 nguồn dữ liệu (giống tab "Hàng hóa & Vận hành" của dashboard bao-cao-cty)
// thành 1 endpoint để app UGC Lab (Vite SPA) khỏi phải fetch Google trực tiếp
// (browser bị CORS + file .xlsx là binary). Mọi sheet ĐÃ để công khai → không cần key.
//
// POST body: { links?: { tong, qlhb, kho, sale, nhaphang, noton } }  (mỗi cái optional)
// Response 200: { ok, products, inv, velocity, incoming, priceVnd, backorder, provinces, errors[] }
//   products[]:  { name, rmRevenue, cpqc, pctCpqc, pctHoan, c2 }       (TỔNG SẢN PHẨM_TH + hoàn Cách A từ QLHB)
//   inv[]:       { ten, ton, ban, giaVonRM, giaVonVnd }                (KHO RP_KHO_SL)
//   velocity:    Record<TÊN_HOA, số đơn/ngày 7 ngày gần nhất>          (SALE Report_Product)
//   incoming[]:  { ma, qty, order, eta }                              (NHẬP HÀNG — đơn CHƯA VỀ)
//   priceVnd:    Record<MÃ, giá thực tế VNĐ/cái>                       (NHẬP HÀNG — đơn ĐÃ VỀ mới nhất)
//   backorder[]: { ma, donNo, spNo, ton, tonDuKien }                  (SALE NỢ ĐƠN — Tồn kho dự kiến)
//   provinces[]: { ten, doanhSoRM, hoanRate }                         (QLHB Tỉ lệ tỉnh)
// Logic parse port nguyên văn từ các route đã verify của bao-cao-cty.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as XLSX from 'xlsx'

export const config = { maxDuration: 60 }

const DEFAULTS = {
  tong: '19KaRjRgg0YhT8RBFfDbI25iF9wp7HKxaFZaqiS6ObfU',
  qlhb: '1pUpdOh1mzJDtbaRRfQ55AciUJibqtRSYp1atRyW6_PM',
  kho: '1Bf5KPkPkM5VXs_W5xzjSpsri0YmdmxqguMbZZxkC9Fs',
  sale: '1vSy4LHxx6WeFysdMJNT0c7473RNmpo8bKuRZvMueqtE',
  nhaphang: '1amJrEI5Z279_4ALWIco3oZETrB4F77cpkD1zSXENrg8',
  noton: '18OdPLkDSLuzKhuO1VheLzkAM0K7xHEoepxhy4JNlYAI',
  giftplan: '1NiCESFek8BYyycTHUMvcMhxpuNDsCI7KplpIxERhOW8',
}
type SrcKey = keyof typeof DEFAULTS

// ── helpers (port từ các route) ──────────────────────────────────────────────
function extractId(s: string) {
  const m = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/)
  return m ? m[1] : s.trim()
}
function num(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v.replace(/[%, ]/g, '')) || 0
  return 0
}
function pct(v: unknown): number {
  const n = num(v)
  return n > 1.5 ? n / 100 : n // 36.87 -> 0.3687 ; 0.3687 giữ nguyên
}
// số kiểu VN (chấm = nghìn, phẩy = thập phân); "(49)" = -49 cho sheet nợ
function viNum(s: unknown, parens = false): number {
  if (typeof s === 'number') return s
  let t = String(s ?? '')
  if (parens) t = t.replace(/[()]/g, (m) => (m === '(' ? '-' : ''))
  t = t.replace(/%/g, '').trim()
  if (!t || t === '-') return 0
  t = t.replace(/\./g, '').replace(/,/g, '.')
  const n = parseFloat(t)
  return isNaN(n) ? 0 : n
}
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cur = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else inQ = false } else cur += ch }
    else if (ch === '"') inQ = true
    else if (ch === ',') { row.push(cur); cur = '' }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
    else if (ch !== '\r') cur += ch
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row) }
  return rows
}
// Excel serial (hệ 1900) → ISO. Tự tính, KHÔNG dùng XLSX.SSF (undefined trong
// runtime serverless ESM). 25569 = số ngày 1899-12-30 → 1970-01-01.
function serialToISO(v: unknown): string {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!n || isNaN(n)) return ''
  const d = new Date(Math.round((n - 25569) * 86400000))
  if (isNaN(d.getTime())) return ''
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}
// fetch có TIMEOUT — 1 request Google treo KHÔNG được giết cả function (→ Vercel
// trả HTML "An error occurred" thay JSON → vỡ board). Quá hạn thì abort → soft error.
async function tfetch(url: string, ms = 25000, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try { return await fetch(url, { cache: 'no-store', signal: ctrl.signal, ...init }) }
  finally { clearTimeout(t) }
}

// ── Cache phía SERVER (Supabase) — số tốt gần nhất dùng chung MỌI máy/nhân viên ──
// Lần load đẹp → ghi vào board_cache(id='main'); lần Google chặn → trả luôn bản đã ghi
// → endpoint LUÔN trả số đủ (sau lần seed đầu), không phụ thuộc Google nhanh hay chậm.
// Dùng anon key sẵn có (Vercel cấp mọi env cho serverless, kể cả tiền tố VITE_).
const SUPA_URL = process.env.VITE_SUPABASE_URL || ''
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY || ''
async function cacheRead(): Promise<Record<string, unknown> | null> {
  if (!SUPA_URL || !SUPA_KEY) return null
  try {
    const r = await tfetch(`${SUPA_URL}/rest/v1/board_cache?id=eq.main&select=payload`, 8000, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } })
    if (!r.ok) return null
    const rows = (await r.json()) as { payload?: Record<string, unknown> }[]
    return rows?.[0]?.payload ?? null
  } catch { return null }
}
async function cacheWrite(payload: Record<string, unknown>): Promise<void> {
  if (!SUPA_URL || !SUPA_KEY) return
  try {
    await tfetch(`${SUPA_URL}/rest/v1/board_cache`, 8000, {
      method: 'POST',
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([{ id: 'main', payload, updated_at: new Date().toISOString() }]),
    })
  } catch { /* cache lỗi không được phá response chính */ }
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
// Chạy các tác vụ với GIỚI HẠN SONG SONG (mặc định 2). Google throttle khi 1 IP bắn
// nhiều /export cùng lúc → 6 file song song = treo → abort. 2-một-đợt thì ổn định.
async function pool<T>(tasks: (() => Promise<T>)[], limit = 2): Promise<PromiseSettledResult<T>[]> {
  const results = new Array(tasks.length) as PromiseSettledResult<T>[]
  let next = 0
  async function worker() {
    while (next < tasks.length) {
      const i = next++
      try { results[i] = { status: 'fulfilled', value: await tasks[i]() } }
      catch (reason) { results[i] = { status: 'rejected', reason } as PromiseRejectedResult }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results
}
async function fetchXlsx(id: string, sheets: string[]): Promise<XLSX.WorkBook> {
  let last: Error | null = null
  for (let i = 0; i < 3; i++) { // 3 lần, giãn cách tăng dần — Google throttle hay trả HTML/timeout
    try {
      const res = await tfetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`, 25000)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return XLSX.read(Buffer.from(await res.arrayBuffer()), { type: 'buffer', sheets })
    } catch (e) { last = e as Error; if (i < 2) await sleep(700 * (i + 1)) }
  }
  throw last ?? new Error('fetchXlsx failed')
}
async function fetchCsv(id: string, sheet: string): Promise<string[][]> {
  let last: Error | null = null
  for (let i = 0; i < 3; i++) {
    try {
      const res = await tfetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`, 25000)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return parseCSV(await res.text())
    } catch (e) { last = e as Error; if (i < 2) await sleep(700 * (i + 1)) }
  }
  throw last ?? new Error('fetchCsv failed')
}

// ── parse từng nguồn ─────────────────────────────────────────────────────────
interface Product { name: string; rmRevenue: number; cpqc: number; pctCpqc: number; pctHoan: number; c2: number; pctChot: number }

// TỔNG "SẢN PHẨM_TH" + override %hoàn (Cách A) từ QLHB "Tỉ lệ sản phẩm"
function parseProducts(tongWb: XLSX.WorkBook, qlhbWb: XLSX.WorkBook | null): Product[] {
  const ws = tongWb.Sheets['SẢN PHẨM_TH']
  if (!ws) throw new Error('Không thấy sheet SẢN PHẨM_TH')
  const cell = (col: string, r: number) => ws[`${col}${r}`]?.v
  const skip = new Set(['', 'TEST', 'Product', 'Tổng tiền'])
  const products: Product[] = []
  let blanks = 0
  for (let r = 5; r <= 200; r++) {
    const name = String(cell('A', r) ?? '').trim()
    if (!name) { if (++blanks > 6) break; continue }
    blanks = 0
    if (skip.has(name)) continue
    const rm = num(cell('C', r))
    if (rm <= 0) continue
    products.push({ name, rmRevenue: rm, cpqc: num(cell('H', r)), pctCpqc: pct(cell('L', r)), pctHoan: pct(cell('O', r)), c2: num(cell('J', r)), pctChot: pct(cell('K', r)) })
  }
  // FIX %Hoàn: SẢN PHẨM_TH bỏ trống nhiều mã → lấy hoàn Cách A từ QLHB.
  if (qlhbWb) {
    const qs = qlhbWb.Sheets['Tỉ lệ sản phẩm']
    if (qs) {
      const qg = (col: string, r: number) => num(qs[`${col}${r}`]?.v)
      const hoanMap: Record<string, number> = {}
      for (let r = 5; r <= 1100; r++) {
        const nm = String(qs[`B${r}`]?.v ?? '').trim()
        if (!nm) continue
        const pend = qg('H', r), ret = qg('J', r), rted = qg('L', r), tong = qg('R', r)
        const resolved = tong - pend
        if (resolved > 0) hoanMap[nm.toUpperCase()] = (ret + rted) / resolved
      }
      for (const p of products) { const h = hoanMap[p.name.toUpperCase()]; if (h != null) p.pctHoan = h }
    }
  }
  products.sort((a, b) => b.rmRevenue - a.rmRevenue)
  return products
}

interface InvItem { ten: string; ton: number; ban: number; giaVonRM: number; giaVonVnd: number }
function parseInventory(wb: XLSX.WorkBook): InvItem[] {
  const ws = wb.Sheets['RP_KHO_SL']
  if (!ws) throw new Error('Không thấy sheet RP_KHO_SL')
  const cell = (col: string, r: number) => ws[`${col}${r}`]?.v
  const items: InvItem[] = []
  let blanks = 0
  for (let r = 5; r <= 1000; r++) {
    const ten = String(cell('E', r) ?? '').trim()
    if (!ten) { if (++blanks > 10) break; continue }
    blanks = 0
    if (ten === '#REF!' || ten === 'Product') continue
    const ton = num(cell('M', r)), ban = num(cell('J', r)), giaVonRM = num(cell('N', r)), giaVonVnd = num(cell('O', r))
    if (ton === 0 && ban === 0 && giaVonRM === 0) continue
    items.push({ ten, ton, ban, giaVonRM, giaVonVnd })
  }
  return items
}

// SALE "Report_Product" → tốc độ bán 7 ngày + tỉ lệ chốt (C2/Data) + upsell (SLSP/C2) theo TỔNG CỘNG
// Cột TỔNG: B=tên(1) · D=Data lead(3) · E=SL SP(4) · F=C2 đơn chốt(5) · G=%C2(6).
function parseVelocity(R: string[][]): { velocity: Record<string, number>; saleStats: Record<string, { chot: number; upsell: number }> } {
  if (R.length < 4) throw new Error('Sheet Report_Product rỗng')
  const hdr = R[0], tot = R[2]
  const dayC2: number[] = []
  hdr.forEach((h, i) => {
    if (/^\d{2}\/\d{2}\/\d{4}/.test(String(h).trim())) { const cc = i + 3; if (viNum(tot[cc]) > 0) dayC2.push(cc) }
  })
  const last7 = dayC2.slice(-7)
  const ndays = last7.length || 1
  const vel: Record<string, number> = {}
  const saleStats: Record<string, { chot: number; upsell: number }> = {}
  for (let r = 3; r < R.length; r++) {
    const name = String(R[r][1] ?? '').trim()
    if (!name || name === 'Product') continue
    const key = name.toUpperCase()
    const sum7 = last7.reduce((s, c) => s + viNum(R[r][c]), 0)
    if (sum7 > 0) vel[key] = sum7 / ndays
    const data = viNum(R[r][3]), slsp = viNum(R[r][4]), c2 = viNum(R[r][5]) // Data · SL SP · C2 (TỔNG)
    if (data > 0 && c2 > 0) saleStats[key] = { chot: c2 / data, upsell: slsp / c2 }
  }
  return { velocity: vel, saleStats }
}

// NHẬP HÀNG "BÁO GIÁ VÀ THANH TOÁN" → đơn ĐANG VỀ + giá thực tế (cột E) đơn ĐÃ VỀ
function parsePurchase(wb: XLSX.WorkBook) {
  const ws = wb.Sheets['BÁO GIÁ VÀ THANH TOÁN']
  if (!ws) throw new Error('Không thấy sheet BÁO GIÁ VÀ THANH TOÁN')
  const cell = (col: string, r: number) => ws[`${col}${r}`]?.v
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:T1')
  const incoming: { ma: string; qty: number; order: string; eta: string }[] = []
  const priceVnd: Record<string, number> = {}
  for (let r = 2; r <= range.e.r + 1; r++) {
    const ma = String(cell('B', r) ?? '').trim().toUpperCase()
    if (!ma || ma === 'MÃ SP') continue
    const status = String(cell('J', r) ?? '').trim().toUpperCase()
    const chuaVe = status.includes('CHƯA') || status.includes('CHUA')
    const giaThucTe = num(cell('E', r))
    if (giaThucTe > 0 && !chuaVe) priceVnd[ma] = giaThucTe // lặp xuống dưới → giữ giá MỚI NHẤT
    const qty = num(cell('F', r))
    if (qty > 0 && chuaVe) incoming.push({ ma, qty, order: serialToISO(cell('H', r)), eta: serialToISO(cell('I', r)) })
  }
  return { incoming, priceVnd }
}

// SALE NỢ ĐƠN "Tồn kho dự kiến" → SP nợ chưa gửi
function parseBackorder(R: string[][]) {
  const items: { ma: string; donNo: number; spNo: number; ton: number; tonDuKien: number }[] = []
  for (const r of R) {
    const name = String(r[1] ?? '').trim()
    if (!name || name === 'warehouse' || /^https?:/.test(name) || name === 'TMH') continue
    const donNo = viNum(r[3], true), spNo = viNum(r[4], true), ton = viNum(r[5], true), tonDuKien = viNum(r[6], true)
    if (spNo === 0 && donNo === 0 && ton === 0) continue
    items.push({ ma: name.toUpperCase(), donNo, spNo, ton, tonDuKien })
  }
  return items
}

// QLHB "Tỉ lệ tỉnh" → bom hàng theo tỉnh
function parseProvinces(wb: XLSX.WorkBook) {
  const ws = wb.Sheets['Tỉ lệ tỉnh']
  if (!ws) throw new Error('Không thấy sheet Tỉ lệ tỉnh')
  const g = (col: string, r: number) => num(ws[`${col}${r}`]?.v)
  const acc: Record<string, { pend: number; ret: number; rted: number; tong: number }> = {}
  for (let r = 5; r <= 1100; r++) {
    const p = String(ws[`B${r}`]?.v ?? '').trim()
    if (!p || p === 'Province') continue
    const o = acc[p] || (acc[p] = { pend: 0, ret: 0, rted: 0, tong: 0 })
    o.pend += g('G', r); o.ret += g('I', r); o.rted += g('K', r); o.tong += g('Q', r)
  }
  return Object.entries(acc)
    .map(([ten, o]) => { const resolved = o.tong - o.pend; return { ten, doanhSoRM: o.tong, hoanRate: resolved > 0 ? (o.ret + o.rted) / resolved : 0 } })
    .filter((p) => p.doanhSoRM > 2000)
    .sort((a, b) => b.hoanRate - a.hoanRate)
}

// QLHB "Tỉ lệ sản phẩm" → tiền theo trạng thái đơn (COD đang kẹt / đã thu)
function parseCashflow(wb: XLSX.WorkBook) {
  const ws = wb.Sheets['Tỉ lệ sản phẩm']
  if (!ws) throw new Error('Không thấy sheet Tỉ lệ sản phẩm')
  const g = (col: string, r: number) => num(ws[`${col}${r}`]?.v)
  let pendingDS = 0, returnDS = 0, returnedDS = 0, deliveryDS = 0, paidDS = 0, blanks = 0
  for (let r = 5; r <= 1100; r++) {
    const name = String(ws[`B${r}`]?.v ?? '').trim()
    if (!name) { if (++blanks > 8) break; continue }
    blanks = 0
    pendingDS += g('H', r); returnDS += g('J', r); returnedDS += g('L', r); deliveryDS += g('N', r); paidDS += g('P', r)
  }
  return { pendingDS, returnDS, returnedDS, deliveryDS, paidDS }
}

// File KẾ HOẠCH QUÀ — sheet "3. THỰC TRẠNG TỒN": SP → vai trò + ngách + tồn + vốn
interface GiftMaster { name: string; vaiTro: string; ngach: string; ton: number; vonSp: number }
function parseGiftMaster(wb: XLSX.WorkBook): GiftMaster[] {
  const ws = wb.Sheets['3. THỰC TRẠNG TỒN']
  if (!ws) throw new Error('Không thấy sheet 3. THỰC TRẠNG TỒN')
  const items: GiftMaster[] = []
  let blanks = 0
  for (let r = 4; r <= 1000; r++) {
    const name = String(ws[`A${r}`]?.v ?? '').trim()
    if (!name) { if (++blanks > 8) break; continue }
    blanks = 0
    if (name.startsWith('SHEET') || name === 'Sản phẩm') continue
    items.push({ name, vaiTro: String(ws[`B${r}`]?.v ?? '').trim(), ngach: String(ws[`C${r}`]?.v ?? '').trim(), ton: num(ws[`D${r}`]?.v), vonSp: num(ws[`E${r}`]?.v) })
  }
  return items
}
// sheet "4. KHO QUÀ & BÁN CHÉO": ngách → SP chính + quà chéo gợi ý + tồn quà + marketer
interface GiftCat { ngach: string; maChinh: string; quaCheo: string; vonQua: number; tonQua: number; marketer: string }
function parseGiftCatalog(wb: XLSX.WorkBook): GiftCat[] {
  const ws = wb.Sheets['4. KHO QUÀ & BÁN CHÉO']
  if (!ws) throw new Error('Không thấy sheet 4. KHO QUÀ & BÁN CHÉO')
  const items: GiftCat[] = []
  for (let r = 5; r <= 1001; r++) {
    const ngach = String(ws[`A${r}`]?.v ?? '').trim()
    const maChinh = String(ws[`B${r}`]?.v ?? '').trim()
    if (!maChinh || !ngach || ngach.includes('🔷') || ngach.startsWith('SHEET') || ngach === 'Ngách') continue
    items.push({ ngach, maChinh, quaCheo: String(ws[`C${r}`]?.v ?? '').trim(), vonQua: num(ws[`E${r}`]?.v), tonQua: num(ws[`F${r}`]?.v), marketer: String(ws[`G${r}`]?.v ?? '').trim() })
  }
  return items
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' })
  const bodyLinks = (req.body && typeof req.body === 'object' ? (req.body as { links?: Record<string, string> }).links : undefined) || {}
  const id = (k: SrcKey) => { const v = bodyLinks[k]; return v ? extractId(v) : DEFAULTS[k] }

  // ── Nhánh NHẸ: chỉ đọc file KẾ HOẠCH QUÀ (cho tab Ghép Quà). TÁCH khỏi load
  // chính 6 file — thêm file thứ 7 vào batch song song làm Google throttle → timeout.
  if (req.body && (req.body as { giftOnly?: boolean }).giftOnly) {
    try {
      const wb = await fetchXlsx(id('giftplan'), ['3. THỰC TRẠNG TỒN', '4. KHO QUÀ & BÁN CHÉO'])
      return res.status(200).json({ ok: true, giftMaster: parseGiftMaster(wb), giftCatalog: parseGiftCatalog(wb) })
    } catch (e) {
      return res.status(200).json({ ok: false, giftMaster: [], giftCatalog: [], error: (e as Error).message })
    }
  }

  const errors: string[] = []
  // Tải GIỚI HẠN 2-một-đợt (không phải 6 cùng lúc) để né Google throttle; mỗi nguồn
  // độc lập, lỗi 1 nguồn không phá cả khối. QLHB (hoàn) + TỔNG đứng đầu để chạy trước.
  const [tongR, qlhbR, khoR, saleR, nhapR, notonR] = await pool([
    () => fetchXlsx(id('tong'), ['SẢN PHẨM_TH']),
    () => fetchXlsx(id('qlhb'), ['Tỉ lệ sản phẩm', 'Tỉ lệ tỉnh']),
    () => fetchXlsx(id('kho'), ['RP_KHO_SL']),
    () => fetchCsv(id('sale'), 'Report_Product'),
    () => fetchXlsx(id('nhaphang'), ['BÁO GIÁ VÀ THANH TOÁN']),
    () => fetchCsv(id('noton'), 'Tồn kho dự kiến'),
  ], 2) as [
    PromiseSettledResult<XLSX.WorkBook>, PromiseSettledResult<XLSX.WorkBook>, PromiseSettledResult<XLSX.WorkBook>,
    PromiseSettledResult<string[][]>, PromiseSettledResult<XLSX.WorkBook>, PromiseSettledResult<string[][]>,
  ]

  const qlhbWb = qlhbR.status === 'fulfilled' ? qlhbR.value : null
  if (qlhbR.status === 'rejected') errors.push('QLHB: ' + (qlhbR.reason?.message || 'lỗi tải'))

  let products: Product[] = []
  try {
    if (tongR.status !== 'fulfilled') throw new Error(tongR.reason?.message || 'lỗi tải file TỔNG')
    products = parseProducts(tongR.value, qlhbWb)
  } catch (e) { errors.push('Sản phẩm: ' + (e as Error).message) }

  let inv: InvItem[] = []
  try {
    if (khoR.status !== 'fulfilled') throw new Error(khoR.reason?.message || 'lỗi tải file KHO')
    inv = parseInventory(khoR.value)
  } catch (e) { errors.push('Tồn kho: ' + (e as Error).message) }

  let velocity: Record<string, number> = {}
  let saleStats: Record<string, { chot: number; upsell: number }> = {}
  try {
    if (saleR.status !== 'fulfilled') throw new Error(saleR.reason?.message || 'lỗi tải file SALE')
    const sv = parseVelocity(saleR.value); velocity = sv.velocity; saleStats = sv.saleStats
  } catch (e) { errors.push('Tốc độ bán: ' + (e as Error).message) }

  let incoming: { ma: string; qty: number; order: string; eta: string }[] = []
  let priceVnd: Record<string, number> = {}
  try {
    if (nhapR.status !== 'fulfilled') throw new Error(nhapR.reason?.message || 'lỗi tải file NHẬP HÀNG')
    const r = parsePurchase(nhapR.value); incoming = r.incoming; priceVnd = r.priceVnd
  } catch (e) { errors.push('Đơn nhập: ' + (e as Error).message) }

  let backorder: { ma: string; donNo: number; spNo: number; ton: number; tonDuKien: number }[] = []
  try {
    if (notonR.status !== 'fulfilled') throw new Error(notonR.reason?.message || 'lỗi tải file SALE nợ đơn')
    backorder = parseBackorder(notonR.value)
  } catch (e) { errors.push('Nợ hàng: ' + (e as Error).message) }

  let provinces: { ten: string; doanhSoRM: number; hoanRate: number }[] = []
  try {
    if (!qlhbWb) throw new Error('lỗi tải file QLHB')
    provinces = parseProvinces(qlhbWb)
  } catch (e) { errors.push('Tỉnh: ' + (e as Error).message) }

  let cashflow: { pendingDS: number; returnDS: number; returnedDS: number; deliveryDS: number; paidDS: number } | null = null
  try {
    if (!qlhbWb) throw new Error('lỗi tải file QLHB')
    cashflow = parseCashflow(qlhbWb)
  } catch (e) { errors.push('Dòng tiền: ' + (e as Error).message) }

  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=120')

  const result = { ok: products.length > 0 || inv.length > 0, products, inv, velocity, saleStats, incoming, priceVnd, backorder, provinces, cashflow, errors }
  const isGood = products.length > 0 && inv.length > 0 && !!cashflow // TỔNG+KHO+QLHB đủ
  if (isGood) {
    await cacheWrite(result as unknown as Record<string, unknown>) // lưu số tốt cho lần sau / máy khác
    return res.status(200).json({ ...result, cached: false })
  }
  // Load này thiếu (Google chặn 1 phần) → trả NGAY số tốt đã cache trên server nếu có
  const cached = await cacheRead()
  if (cached && Array.isArray((cached as { products?: unknown[] }).products) && (cached as { products: unknown[] }).products.length > 0) {
    return res.status(200).json({ ...cached, cached: true, errors }) // giữ errors để client biết lần này có chặn
  }
  return res.status(200).json({ ...result, cached: false })
}
