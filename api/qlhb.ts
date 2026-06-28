// ── Vercel serverless RIÊNG cho QLHB (file nặng) ────────────────────────────
// Tách khỏi /api/inventory-board: QLHB là file to, export trên Vercel mất lâu +
// dễ bị Google nghẽn nếu fetch chung 6 file một lúc. Cho nó 1 function riêng =
// 60s riêng, fetch MỘT MÌNH (giống dashboard bao-cao-cty fetch QLHB lẻ → nhanh).
// Trả: hoanMap (SP→%hoàn Cách A) · provinces (bom tỉnh) · cashflow (tiền COD theo trạng thái).
import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as XLSX from 'xlsx'

export const config = { maxDuration: 60 }

const DEFAULT_QLHB = '1pUpdOh1mzJDtbaRRfQ55AciUJibqtRSYp1atRyW6_PM'
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

// QLHB "Tỉ lệ sản phẩm" → hoàn Cách A theo SP. B=tên H=pending J=return L=returned R=tổng
function buildHoanMap(ws: XLSX.WorkSheet): Record<string, number> {
  const g = (col: string, r: number) => num(ws[`${col}${r}`]?.v)
  const map: Record<string, number> = {}
  for (let r = 5; r <= 1100; r++) {
    const nm = String(ws[`B${r}`]?.v ?? '').trim()
    if (!nm) continue
    const pend = g('H', r), ret = g('J', r), rted = g('L', r), tong = g('R', r)
    const resolved = tong - pend
    if (resolved > 0) map[nm.toUpperCase()] = (ret + rted) / resolved
  }
  return map
}
// QLHB "Tỉ lệ sản phẩm" → tiền theo trạng thái đơn. H=pending J=return L=returned N=delivery P=paid
function parseCashflow(ws: XLSX.WorkSheet) {
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
// QLHB "Tỉ lệ tỉnh" → bom hàng theo tỉnh. B=tỉnh G=pending I=return K=returned Q=tổng
function parseProvinces(ws: XLSX.WorkSheet) {
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
