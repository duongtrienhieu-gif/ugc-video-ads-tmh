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
    const r = await tfetch(`${SUPA_URL}/rest/v1/board_cache?id=eq.main&select=payload`, 6000, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } })
    if (!r.ok) return null
    const rows = (await r.json()) as { payload?: Record<string, unknown> }[]
    return rows?.[0]?.payload ?? null
  } catch { return null }
}
async function cacheWrite(payload: Record<string, unknown>): Promise<void> {
  if (!SUPA_URL || !SUPA_KEY) return
  try {
    await tfetch(`${SUPA_URL}/rest/v1/board_cache`, 6000, {
      method: 'POST',
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([{ id: 'main', payload, updated_at: new Date().toISOString() }]),
    })
  } catch { /* cache lỗi không được phá response chính */ }
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
// BUDGET THỜI GIAN: function có maxDuration 60s. Mỗi file tối đa 2 lần × 12s + 0.5s
// = ~24.5s. Chạy SONG SONG (Promise.allSettled) → tổng ≈ file chậm nhất ≈ 24.5s < 60s
// → LUÔN kịp trả JSON, KHÔNG bao giờ bị Vercel kill (→ hết lỗi "Unexpected token A").
// Thiếu nguồn nào thì lớp CACHE (server + máy) bù — không cần ép Google cho đủ trong 1 lần.
async function fetchCsv(id: string, sheet: string): Promise<string[][]> {
  let last: Error | null = null
  for (let i = 0; i < 2; i++) {
    try {
      const res = await tfetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`, 12000)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return parseCSV(await res.text())
    } catch (e) { last = e as Error; if (i < 1) await sleep(500) }
  }
  throw last ?? new Error('fetchCsv failed')
}
// gviz JSON 1 SHEET — chỉ kéo ĐÚNG sheet cần (nhẹ), KHÔNG tải cả workbook như export=xlsx.
// headers=0 → mọi dòng nằm trong rows (index khớp dòng sheet); lấy c.v = GIÁ TRỊ GỐC (số là số,
// không dính định dạng VN/US). Dùng cho QLHB (2 sheet) + KHO — mấy file nặng hay timeout.
type RawRow = (string | number | boolean | null)[]
async function fetchGviz(id: string, sheet: string): Promise<RawRow[]> {
  let last: Error | null = null
  for (let i = 0; i < 2; i++) {
    try {
      const res = await tfetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&headers=0&sheet=${encodeURIComponent(sheet)}`, 12000)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      const s = text.indexOf('{'), e = text.lastIndexOf('}')
      if (s < 0 || e < 0) throw new Error('gviz trả không phải JSON')
      const json = JSON.parse(text.slice(s, e + 1)) as { table?: { rows?: { c?: ({ v?: unknown } | null)[] }[] } }
      const rows = json.table?.rows ?? []
      return rows.map((r) => (r.c ?? []).map((c) => (c && c.v != null ? (c.v as string | number | boolean) : null)))
    } catch (e) { last = e as Error; if (i < 1) await sleep(500) }
  }
  throw last ?? new Error('fetchGviz failed')
}
// đọc ô từ RawRow theo CHỈ SỐ CỘT 0-based (A=0,B=1,...). Số trả số; chuỗi → num().
const gNum = (row: RawRow | undefined, idx: number): number => { const v = row?.[idx]; return typeof v === 'number' ? v : num(v) }
const gStr = (row: RawRow | undefined, idx: number): string => String(row?.[idx] ?? '').trim()
// gviz JSON trả ô NGÀY dạng "Date(2024,0,7)" (tháng 0-based) → ISO yyyy-mm-dd; số → serial cũ
const gvizDate = (v: unknown): string => {
  if (typeof v === 'number') return serialToISO(v)
  const m = String(v ?? '').match(/Date\((\d+),(\d+),(\d+)/)
  return m ? `${m[1]}-${String(+m[2] + 1).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}` : ''
}

// ── parse từng nguồn ─────────────────────────────────────────────────────────
interface Product { name: string; rmRevenue: number; cpqc: number; pctCpqc: number; pctHoan: number; c2: number; pctChot: number }

// TỔNG "SẢN PHẨM_TH" (gviz 1 sheet) + override %hoàn (Cách A) từ hoanMap (QLHB qua gviz)
// A=tên(0) C=DT_RM(2) H=cpqc(7) J=c2(9) K=%chốt(10) L=%CPQC(11) O=%hoàn(14)
function parseProducts(rows: RawRow[], hoanMap: Record<string, number> | null): Product[] {
  const skip = new Set(['', 'TEST', 'Product', 'Tổng tiền'])
  const products: Product[] = []
  let blanks = 0
  for (let i = 4; i < rows.length && i < 200; i++) { // sheet dòng 5 → rows[4]
    const row = rows[i]
    const name = gStr(row, 0)
    if (!name) { if (++blanks > 6) break; continue }
    blanks = 0
    if (skip.has(name)) continue
    const rm = gNum(row, 2)
    if (rm <= 0) continue
    products.push({ name, rmRevenue: rm, cpqc: gNum(row, 7), pctCpqc: pct(row[11]), pctHoan: pct(row[14]), c2: gNum(row, 9), pctChot: pct(row[10]) })
  }
  // FIX %Hoàn: SẢN PHẨM_TH bỏ trống nhiều mã → đè bằng hoàn Cách A từ QLHB.
  if (hoanMap) for (const p of products) { const h = hoanMap[p.name.toUpperCase()]; if (h != null) p.pctHoan = h }
  products.sort((a, b) => b.rmRevenue - a.rmRevenue)
  return products
}
// QLHB "Tỉ lệ sản phẩm" (gviz) → %hoàn Cách A theo SP. B=tên(1) H=pend(7) J=ret(9) L=rted(11) R=tổng(17)
function buildHoanMap(rows: RawRow[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (let i = 4; i < rows.length && i < 1100; i++) { // sheet dòng 5 → rows[4]
    const nm = gStr(rows[i], 1)
    if (!nm) continue
    const pend = gNum(rows[i], 7), ret = gNum(rows[i], 9), rted = gNum(rows[i], 11), tong = gNum(rows[i], 17)
    const resolved = tong - pend
    if (resolved > 0) map[nm.toUpperCase()] = (ret + rted) / resolved
  }
  return map
}

interface InvItem { ten: string; ton: number; ban: number; giaVonRM: number; giaVonVnd: number }
// KHO "RP_KHO_SL" (gviz, chỉ sheet này). E=tên(4) M=tồn(12) J=bán(9) N=giáVốnRM(13) O=giáVốnVnd(14)
function parseInventory(rows: RawRow[]): InvItem[] {
  const items: InvItem[] = []
  let blanks = 0
  for (let i = 4; i < rows.length && i < 1000; i++) { // sheet dòng 5 → rows[4]
    const ten = gStr(rows[i], 4)
    if (!ten) { if (++blanks > 10) break; continue }
    blanks = 0
    if (ten === '#REF!' || ten === 'Product') continue
    const ton = gNum(rows[i], 12), ban = gNum(rows[i], 9), giaVonRM = gNum(rows[i], 13), giaVonVnd = gNum(rows[i], 14)
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

// NHẬP HÀNG "BÁO GIÁ VÀ THANH TOÁN" (gviz 1 sheet) → đơn ĐANG VỀ + giá thực tế đơn ĐÃ VỀ
// B=mã(1) E=giá thực tế(4) F=SL(5) H=ngày đặt(7) I=ngày về(8) J=trạng thái(9)
function parsePurchase(rows: RawRow[]) {
  const incoming: { ma: string; qty: number; order: string; eta: string }[] = []
  const priceVnd: Record<string, number> = {}
  for (let i = 1; i < rows.length; i++) { // sheet dòng 2 → rows[1]
    const row = rows[i]
    const ma = gStr(row, 1).toUpperCase()
    if (!ma || ma === 'MÃ SP') continue
    const status = gStr(row, 9).toUpperCase()
    const chuaVe = status.includes('CHƯA') || status.includes('CHUA')
    const giaThucTe = gNum(row, 4)
    if (giaThucTe > 0 && !chuaVe) priceVnd[ma] = giaThucTe // lặp xuống dưới → giữ giá MỚI NHẤT
    const qty = gNum(row, 5)
    if (qty > 0 && chuaVe) incoming.push({ ma, qty, order: gvizDate(row[7]), eta: gvizDate(row[8]) })
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

// QLHB "Tỉ lệ tỉnh" (gviz) → bom hàng theo tỉnh. B=tỉnh(1) G=pend(6) I=ret(8) K=rted(10) Q=tổng(16)
function parseProvinces(rows: RawRow[]) {
  const acc: Record<string, { pend: number; ret: number; rted: number; tong: number }> = {}
  for (let i = 4; i < rows.length && i < 1100; i++) { // sheet dòng 5 → rows[4]
    const p = gStr(rows[i], 1)
    if (!p || p === 'Province') continue
    const o = acc[p] || (acc[p] = { pend: 0, ret: 0, rted: 0, tong: 0 })
    o.pend += gNum(rows[i], 6); o.ret += gNum(rows[i], 8); o.rted += gNum(rows[i], 10); o.tong += gNum(rows[i], 16)
  }
  return Object.entries(acc)
    .map(([ten, o]) => { const resolved = o.tong - o.pend; return { ten, doanhSoRM: o.tong, hoanRate: resolved > 0 ? (o.ret + o.rted) / resolved : 0 } })
    .filter((p) => p.doanhSoRM > 2000)
    .sort((a, b) => b.hoanRate - a.hoanRate)
}

// QLHB "Tỉ lệ sản phẩm" (gviz) → tiền theo trạng thái đơn. B=tên(1) H=pend(7) J=ret(9) L=rted(11) N=delivery(13) P=paid(15)
function parseCashflow(rows: RawRow[]) {
  let pendingDS = 0, returnDS = 0, returnedDS = 0, deliveryDS = 0, paidDS = 0, blanks = 0
  for (let i = 4; i < rows.length && i < 1100; i++) { // sheet dòng 5 → rows[4]
    const name = gStr(rows[i], 1)
    if (!name) { if (++blanks > 8) break; continue }
    blanks = 0
    pendingDS += gNum(rows[i], 7); returnDS += gNum(rows[i], 9); returnedDS += gNum(rows[i], 11); deliveryDS += gNum(rows[i], 13); paidDS += gNum(rows[i], 15)
  }
  return { pendingDS, returnDS, returnedDS, deliveryDS, paidDS }
}

// File KẾ HOẠCH QUÀ — sheet "3. THỰC TRẠNG TỒN" (gviz): A=SP(0) B=vai trò(1) C=ngách(2) D=tồn(3) E=vốn/sp(4)
interface GiftMaster { name: string; vaiTro: string; ngach: string; ton: number; vonSp: number }
function parseGiftMaster(rows: RawRow[]): GiftMaster[] {
  const items: GiftMaster[] = []
  let blanks = 0
  for (let i = 3; i < rows.length && i < 1000; i++) { // sheet dòng 4 → rows[3]
    const row = rows[i]
    const name = gStr(row, 0)
    if (!name) { if (++blanks > 8) break; continue }
    blanks = 0
    if (name.startsWith('SHEET') || name === 'Sản phẩm') continue
    items.push({ name, vaiTro: gStr(row, 1), ngach: gStr(row, 2), ton: gNum(row, 3), vonSp: gNum(row, 4) })
  }
  return items
}
// sheet "4. KHO QUÀ & BÁN CHÉO" (gviz): A=ngách(0) B=mã chính(1) C=quà gợi ý(2) E=vốn quà(4) F=tồn quà(5) G=marketer(6)
interface GiftCat { ngach: string; maChinh: string; quaCheo: string; vonQua: number; tonQua: number; marketer: string }
function parseGiftCatalog(rows: RawRow[]): GiftCat[] {
  const items: GiftCat[] = []
  for (let i = 4; i < rows.length && i < 1001; i++) { // sheet dòng 5 → rows[4]
    const row = rows[i]
    const ngach = gStr(row, 0)
    const maChinh = gStr(row, 1)
    if (!maChinh || !ngach || ngach.includes('🔷') || ngach.startsWith('SHEET') || ngach === 'Ngách') continue
    items.push({ ngach, maChinh, quaCheo: gStr(row, 2), vonQua: gNum(row, 4), tonQua: gNum(row, 5), marketer: gStr(row, 6) })
  }
  return items
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' })
  const bodyLinks = (req.body && typeof req.body === 'object' ? (req.body as { links?: Record<string, string> }).links : undefined) || {}
  const id = (k: SrcKey) => { const v = bodyLinks[k]; return v ? extractId(v) : DEFAULTS[k] }

  // ── Nhánh NHẸ: chỉ đọc file KẾ HOẠCH QUÀ (cho tab Ghép Quà). Kéo ĐÚNG 2 sheet
  // cần qua gviz (không tải cả workbook), độc lập — 1 sheet rớt không kéo sheet kia.
  if (req.body && (req.body as { giftOnly?: boolean }).giftOnly) {
    const [tonR, quaR] = await Promise.allSettled([
      fetchGviz(id('giftplan'), '3. THỰC TRẠNG TỒN'),
      fetchGviz(id('giftplan'), '4. KHO QUÀ & BÁN CHÉO'),
    ])
    const giftMaster = tonR.status === 'fulfilled' ? parseGiftMaster(tonR.value) : []
    const giftCatalog = quaR.status === 'fulfilled' ? parseGiftCatalog(quaR.value) : []
    const err = [tonR, quaR].filter((x) => x.status === 'rejected').map((x) => (x as PromiseRejectedResult).reason?.message).join(' · ')
    return res.status(200).json({ ok: giftMaster.length > 0 || giftCatalog.length > 0, giftMaster, giftCatalog, error: err || undefined })
  }

  const errors: string[] = []
  // Tải SONG SONG, timeout ngắn → tổng ≈ file chậm nhất (~24.5s) < 60s → luôn trả JSON.
  // QLHB + KHO chỉ kéo ĐÚNG SHEET CẦN qua gviz (nhẹ) thay vì export cả workbook (nặng → timeout).
  // QLHB tách 2 sheet riêng → 1 sheet rớt không kéo theo sheet kia. Thiếu thì cache bù.
  const [tongR, qlhbSpR, qlhbTinhR, khoR, saleR, nhapR, notonR] = await Promise.allSettled([
    fetchGviz(id('tong'), 'SẢN PHẨM_TH'),
    fetchGviz(id('qlhb'), 'Tỉ lệ sản phẩm'),
    fetchGviz(id('qlhb'), 'Tỉ lệ tỉnh'),
    fetchGviz(id('kho'), 'RP_KHO_SL'),
    fetchCsv(id('sale'), 'Report_Product'),
    fetchGviz(id('nhaphang'), 'BÁO GIÁ VÀ THANH TOÁN'),
    fetchCsv(id('noton'), 'Tồn kho dự kiến'),
  ])

  const qlhbSpRows = qlhbSpR.status === 'fulfilled' ? qlhbSpR.value : null // sheet Tỉ lệ sản phẩm (hoàn + dòng tiền)
  const hoanMap = qlhbSpRows ? buildHoanMap(qlhbSpRows) : null

  let products: Product[] = []
  try {
    if (tongR.status !== 'fulfilled') throw new Error(tongR.reason?.message || 'lỗi tải file TỔNG')
    products = parseProducts(tongR.value, hoanMap)
  } catch (e) { errors.push('Sản phẩm: ' + (e as Error).message) }

  let inv: InvItem[] = []
  try {
    if (khoR.status !== 'fulfilled') throw new Error(khoR.reason?.message || 'lỗi tải sheet RP_KHO_SL')
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
    if (qlhbTinhR.status !== 'fulfilled') throw new Error(qlhbTinhR.reason?.message || 'lỗi tải sheet Tỉ lệ tỉnh')
    provinces = parseProvinces(qlhbTinhR.value)
  } catch (e) { errors.push('Tỉnh: ' + (e as Error).message) }

  let cashflow: { pendingDS: number; returnDS: number; returnedDS: number; deliveryDS: number; paidDS: number } | null = null
  try {
    if (!qlhbSpRows) throw new Error(qlhbSpR.status === 'rejected' ? (qlhbSpR.reason?.message || 'lỗi tải sheet Tỉ lệ sản phẩm') : 'lỗi tải sheet Tỉ lệ sản phẩm')
    cashflow = parseCashflow(qlhbSpRows)
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
