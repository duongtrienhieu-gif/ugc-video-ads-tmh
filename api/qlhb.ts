// ── Vercel serverless RIÊNG cho QLHB (file nặng) ────────────────────────────
// Tách khỏi /api/inventory-board: QLHB là file to, export trên Vercel mất lâu +
// dễ bị Google nghẽn nếu fetch chung 6 file một lúc. Cho nó 1 function riêng =
// 60s riêng, fetch MỘT MÌNH (giống dashboard bao-cao-cty fetch QLHB lẻ → nhanh).
// Trả: hoanMap (SP→%hoàn Cách A) · provinces (bom tỉnh) · cashflow (tiền COD theo trạng thái).
import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as XLSX from 'xlsx'

export const config = { maxDuration: 60 }

const DEFAULT_QLHB = '1gci7u1_aTX_xutnSbCf7t-fu-2wowTqBdjHaa4dQTBQ' // QLHB T7/2026 (dự phòng; cột tự dò nên file nào cũng được)
function extractId(s: string) { const m = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/); return m ? m[1] : s.trim() }
function num(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v.replace(/[%, ]/g, '')) || 0
  return 0
}
async function tfetch(url: string, ms: number, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try { return await fetch(url, { cache: 'no-store', signal: ctrl.signal, ...init }) }
  finally { clearTimeout(t) }
}

// ── cache server (board_cache id='qlhb') — QLHB lỡ chậm/lỗi thì trả số tốt gần nhất ──
const SUPA_URL = process.env.VITE_SUPABASE_URL || ''
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY || ''
async function cacheRead(): Promise<Record<string, unknown> | null> {
  if (!SUPA_URL || !SUPA_KEY) return null
  try {
    const r = await tfetch(`${SUPA_URL}/rest/v1/board_cache?id=eq.qlhb&select=payload`, 6000, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } })
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
      body: JSON.stringify([{ id: 'qlhb', payload, updated_at: new Date().toISOString() }]),
    })
  } catch { /* cache lỗi không phá response */ }
}

// ── TỰ DÒ CỘT theo tiêu đề (Pending/Return/Returned/Delivery/Paid/Total) ─────────
// File TMH và NG xếp cột lệch nhau (DS ở H,J,L,R vs G,I,K,Q) + hàng tiêu đề ở vị trí
// khác → KHÔNG hardcode. Cột DS = cột-nhãn-trạng-thái + 1 (cặp [SL SP, DS], DS đứng sau).
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
interface DsCols { pend?: string; ret?: string; rted?: string; deliv?: string; paid?: string; tong?: string; headerRow: number }
function locateCols(ws: XLSX.WorkSheet): DsCols {
  const cellL = (c: string, r: number) => String(ws[`${c}${r}`]?.v ?? '').trim().toLowerCase()
  let headerRow = -1
  for (let hr = 1; hr <= 4; hr++) {
    const labels = LETTERS.map((c) => cellL(c, hr))
    if (labels.some((l) => l.includes('pending')) && labels.some((l) => l.includes('total') || l.includes('tổng'))) { headerRow = hr; break }
  }
  if (headerRow < 0) return { pend: 'H', ret: 'J', rted: 'L', tong: 'R', deliv: 'N', paid: 'P', headerRow: 4 } // fallback kiểu TMH
  const dsAfter = (match: (l: string) => boolean): string | undefined => {
    for (let i = 0; i < LETTERS.length - 1; i++) { if (match(cellL(LETTERS[i], headerRow))) return LETTERS[i + 1] }
    return undefined
  }
  return {
    pend: dsAfter((l) => l === 'pending'),
    ret: dsAfter((l) => l === 'return'),
    rted: dsAfter((l) => l === 'returned'),
    deliv: dsAfter((l) => l === 'delivery'),
    paid: dsAfter((l) => l === 'paid'),
    tong: dsAfter((l) => l === 'total' || l === 'tổng' || l.includes('tổng') || l.includes('total')),
    headerRow,
  }
}
const SKIP_NAME = new Set(['', 'brand', 'product', 'province', 'tổng', 'total', 'sản phẩm', 'tỉnh'])

// QLHB "Tỉ lệ sản phẩm" → hoàn Cách A theo SP. hoàn = (return+returned)/(total−pending) [DS]
function buildHoanMap(ws: XLSX.WorkSheet): Record<string, number> {
  const C = locateCols(ws)
  const g = (col: string | undefined, r: number) => (col ? num(ws[`${col}${r}`]?.v) : 0)
  const map: Record<string, number> = {}
  for (let r = C.headerRow + 1; r <= 1100; r++) {
    const nm = String(ws[`B${r}`]?.v ?? '').trim()
    if (!nm || SKIP_NAME.has(nm.toLowerCase())) continue
    const resolved = g(C.tong, r) - g(C.pend, r)
    if (resolved > 0) map[nm.toUpperCase()] = (g(C.ret, r) + g(C.rted, r)) / resolved
  }
  return map
}
// QLHB "Tỉ lệ sản phẩm" → tiền theo trạng thái đơn (cộng DS toàn bộ SP)
function parseCashflow(ws: XLSX.WorkSheet) {
  const C = locateCols(ws)
  const g = (col: string | undefined, r: number) => (col ? num(ws[`${col}${r}`]?.v) : 0)
  let pendingDS = 0, returnDS = 0, returnedDS = 0, deliveryDS = 0, paidDS = 0, blanks = 0
  for (let r = C.headerRow + 1; r <= 1100; r++) {
    const name = String(ws[`B${r}`]?.v ?? '').trim()
    if (!name) { if (++blanks > 8) break; continue }
    blanks = 0
    if (SKIP_NAME.has(name.toLowerCase())) continue
    pendingDS += g(C.pend, r); returnDS += g(C.ret, r); returnedDS += g(C.rted, r); deliveryDS += g(C.deliv, r); paidDS += g(C.paid, r)
  }
  return { pendingDS, returnDS, returnedDS, deliveryDS, paidDS }
}
// QLHB "Tỉ lệ tỉnh" → bom hàng theo tỉnh (B=tỉnh; DS cột tự dò như trên)
function parseProvinces(ws: XLSX.WorkSheet) {
  const C = locateCols(ws)
  const g = (col: string | undefined, r: number) => (col ? num(ws[`${col}${r}`]?.v) : 0)
  const acc: Record<string, { pend: number; ret: number; rted: number; tong: number }> = {}
  for (let r = C.headerRow + 1; r <= 1100; r++) {
    const p = String(ws[`B${r}`]?.v ?? '').trim()
    if (!p || SKIP_NAME.has(p.toLowerCase())) continue
    const o = acc[p] || (acc[p] = { pend: 0, ret: 0, rted: 0, tong: 0 })
    o.pend += g(C.pend, r); o.ret += g(C.ret, r); o.rted += g(C.rted, r); o.tong += g(C.tong, r)
  }
  return Object.entries(acc)
    .map(([ten, o]) => { const resolved = o.tong - o.pend; return { ten, doanhSoRM: o.tong, hoanRate: resolved > 0 ? (o.ret + o.rted) / resolved : 0 } })
    .filter((p) => p.doanhSoRM > 2000)
    .sort((a, b) => b.hoanRate - a.hoanRate)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const bodyLink = (req.body && typeof req.body === 'object' ? (req.body as { link?: string }).link : undefined) || ''
  const id = bodyLink ? extractId(bodyLink) : DEFAULT_QLHB

  try {
    // fetch MỘT MÌNH, timeout rộng (50s) — function này chỉ làm QLHB nên có cả 60s.
    const r = await tfetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`, 50000)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const wb = XLSX.read(Buffer.from(await r.arrayBuffer()), { type: 'buffer', sheets: ['Tỉ lệ sản phẩm', 'Tỉ lệ tỉnh'] })
    const sp = wb.Sheets['Tỉ lệ sản phẩm']
    const tinh = wb.Sheets['Tỉ lệ tỉnh']
    if (!sp) throw new Error('Không thấy sheet Tỉ lệ sản phẩm')
    const hoanMap = buildHoanMap(sp)
    const cashflow = parseCashflow(sp)
    const provinces = tinh ? parseProvinces(tinh) : []
    const result = { ok: Object.keys(hoanMap).length > 0, hoanMap, cashflow, provinces }
    if (result.ok) await cacheWrite(result as unknown as Record<string, unknown>)
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300')
    return res.status(200).json({ ...result, cached: false })
  } catch (e) {
    // QLHB chậm/lỗi → trả số tốt đã cache server (nếu có) để hoàn không bị trống
    const cached = await cacheRead()
    if (cached && cached.hoanMap && Object.keys(cached.hoanMap as object).length > 0) {
      return res.status(200).json({ ...cached, cached: true, error: (e as Error).message })
    }
    return res.status(200).json({ ok: false, hoanMap: {}, cashflow: null, provinces: [], error: (e as Error).message })
  }
}
