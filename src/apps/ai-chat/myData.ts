// ── Trợ lý AI — Mức B: nạp DỮ LIỆU THẬT theo mail người đang chat ──
// 2 PHA: (1) lấy NGAY danh tính + mã SP từ Supabase (nhanh) → bot biết "bạn là ai"; (2) đổ
// số doanh thu/lãi (tái dùng actuals.ts War Room) + kho/tồn khi Google tải xong (chậm).
// Doanh thu KHỚP Y "Bảng của tôi". Kho dùng dữ liệu THÔ + ngưỡng cover<15 ngày (không
// re-implement formula restock). Marketer chỉ thấy mã mình; CEO thấy toàn team.
import { supabase } from '../../lib/supabase'
import { memberEmails, type Member } from '../war-room/store'
import { fetchSpStats, readCachedSpStats, aggregate, type SpStat, type SpStatsResult } from '../war-room/actuals'

const vnd = (n: number) => Math.round(n).toLocaleString('vi-VN') + 'đ'
const pct = (n: number) => (n * 100).toFixed(1) + '%'
const line = (label: string, s: SpStat) =>
  `${label}: DT ${vnd(s.dt)} · lãi ${vnd(s.lai)} · %CPQC ${pct(s.cpqc)} · %hoàn ${pct(s.hoan)} · AOV ${vnd(s.aov)} · %chốt ${pct(s.chot)}`
const isCeoRole = (role: string) => /ceo|chủ|chu|boss|admin/i.test(role || '')

interface KhoFacts { byCode: Record<string, { ton: number; vel: number; incoming: number }>; provinces: { ten: string; hoanRate: number }[] }
async function fetchKhoFacts(): Promise<KhoFacts | null> {
  try {
    const [boardR, qlhbR] = await Promise.allSettled([
      fetch('/api/inventory-board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ links: {} }), cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/qlhb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}), cache: 'no-store' }).then((r) => r.json()),
    ])
    const board = (boardR.status === 'fulfilled' ? boardR.value : {}) as { inv?: { ten: string; ton: number }[]; velocity?: Record<string, number>; incoming?: { ma: string; qty: number }[]; provinces?: { ten: string; hoanRate: number }[] }
    const qlhb = (qlhbR.status === 'fulfilled' ? qlhbR.value : {}) as { provinces?: { ten: string; hoanRate: number }[] }
    const velocity = board.velocity ?? {}
    const incByCode: Record<string, number> = {}
    for (const x of board.incoming ?? []) { const k = String(x.ma).trim().toUpperCase(); incByCode[k] = (incByCode[k] ?? 0) + (Number(x.qty) || 0) }
    const byCode: Record<string, { ton: number; vel: number; incoming: number }> = {}
    for (const it of board.inv ?? []) { const k = String(it.ten).trim().toUpperCase(); byCode[k] = { ton: Number(it.ton) || 0, vel: velocity[k] ?? 0, incoming: incByCode[k] ?? 0 } }
    const provinces = (qlhb.provinces ?? board.provinces ?? []).filter((p) => p && p.ten)
    return { byCode, provinces }
  } catch { return null }
}
function khoLine(code: string, f: { ton: number; vel: number; incoming: number }): string {
  const cover = f.vel > 0 ? (f.ton / f.vel).toFixed(0) : '∞'
  const flag = f.vel > 0 && f.ton / f.vel < 15 ? ' ⚠SẮP ĐỨT' : ''
  return `${code}: tồn ${f.ton} · bán ~${f.vel.toFixed(1)}/ngày · còn ~${cover} ngày${f.incoming ? ` · đang về ~${f.incoming}` : ''}${flag}`
}

// Dựng block từ member + (tùy chọn) số liệu/kho. statsRes=null → đang tải.
function buildBlock(me: Member, members: Member[], statsRes: SpStatsResult | null, kho: KhoFacts | null, loading: boolean): string {
  const ceo = isCeoRole(me.role)
  const stats = statsRes?.stats ?? {}
  const hasStats = Object.keys(stats).length > 0
  const out: string[] = []
  out.push('═══ DỮ LIỆU THẬT CỦA NGƯỜI ĐANG CHAT (dùng để trả lời câu hỏi về số liệu/kho của họ/team) ═══')
  out.push(`Người chat: ${me.name} (${me.role})${ceo ? ' — là CEO/Chủ, ĐƯỢC xem toàn team' : ''}.`)
  if (loading && !hasStats) {
    out.push('TRẠNG THÁI: số liệu doanh thu/kho ĐANG TẢI (Google Sheets ~10-40 giây). Nếu người dùng hỏi số ngay bây giờ mà phần dưới chưa có số, hãy trả lời: "Số liệu đang được tải (~10-40 giây), bạn hỏi lại ngay sau nhé" — TUYỆT ĐỐI ĐỪNG nói bạn không có quyền truy cập / không thể xem số liệu.')
  }
  // Danh tính + mã SP (có ngay từ Supabase)
  if (ceo) {
    out.push('Các nhân sự & mã phụ trách:')
    for (const m of members) { if (m.sp_codes?.length) out.push(`- ${m.name} (${m.role}): ${m.sp_codes.join(', ')}`) }
  } else {
    out.push(`Mã SP bạn phụ trách: ${(me.sp_codes ?? []).join(', ') || '(chưa gán)'}.`)
  }
  // Doanh thu (khi có)
  if (hasStats) {
    if (ceo) {
      out.push('DOANH THU TỪNG NGƯỜI (VNĐ, tỷ giá 5800):')
      for (const m of members) { if (m.sp_codes?.length) out.push(`- ${line(m.name, aggregate(m.sp_codes, stats))}`) }
    } else if (me.sp_codes?.length) {
      out.push(`- ${line('TỔNG của bạn', aggregate(me.sp_codes, stats))}`)
      out.push('DOANH THU theo từng mã:')
      for (const code of me.sp_codes) { const s = stats[code.trim().toUpperCase()]; if (s) out.push(`- ${line(code, s)}`) }
    }
  }
  // Kho/tồn (khi có)
  if (kho && Object.keys(kho.byCode).length) {
    out.push('KHO/TỒN (còn ~X ngày = tồn / tốc độ bán; <15 ngày = SẮP ĐỨT; số cần nhập chính xác xem app Kho):')
    if (ceo) {
      const urgent = Object.entries(kho.byCode).filter(([, f]) => f.vel > 0 && f.ton / f.vel < 15).sort((a, b) => a[1].ton / a[1].vel - b[1].ton / b[1].vel)
      if (urgent.length) { out.push('Mã SẮP ĐỨT toàn team:'); for (const [c, f] of urgent.slice(0, 20)) out.push(`- ${khoLine(c, f)}`) }
      else out.push('- Không mã nào sắp đứt (cover ≥ 15 ngày).')
    } else {
      for (const code of me.sp_codes ?? []) { const f = kho.byCode[code.trim().toUpperCase()]; if (f) out.push(`- ${khoLine(code, f)}`) }
    }
    const bom = kho.provinces.filter((p) => p.hoanRate > 0).sort((a, b) => b.hoanRate - a.hoanRate).slice(0, 6)
    if (bom.length) out.push(`BOM TỈNH (hoàn cao): ${bom.map((p) => `${p.ten} ${(p.hoanRate * 100).toFixed(0)}%`).join(' · ')}`)
  }
  if (statsRes?.stale) out.push('(Lưu ý: "số tốt gần nhất" do lần tải mới bị Google tạm chặn.)')
  out.push('QUY TẮC: trả lời số dựa trên block này. Marketer KHÔNG suy đoán số của mã/người khác. Hỏi mã/người KHÔNG có trong block → "mình không thấy dữ liệu đó (có thể không thuộc bạn hoặc chưa tải được), xem app Tác Chiến/Kho nhé". Mọi tiền là VNĐ.')
  return out.join('\n')
}

// onProgress: gọi sớm với block PHA-1 (danh tính, có ngay), rồi return block PHA-2 (đầy đủ số).
export async function loadMyDataBlock(email: string, onProgress?: (block: string) => void): Promise<string> {
  if (!email || email === 'guest') return ''
  let members: Member[] = []
  try {
    const { data, error } = await supabase.from('team_members').select('*')
    if (error || !data) return ''
    members = data as Member[]
  } catch { return '' }
  const me = members.find((m) => memberEmails(m).includes(email.toLowerCase()))
  if (!me) return ''   // mail chưa được phân vào Nhân sự → không truy cập số liệu

  // PHA 1: danh tính + mã (nhanh) — dùng cache nếu có để hiện số liền.
  const cached = readCachedSpStats()
  onProgress?.(buildBlock(me, members, cached, null, !cached))

  // PHA 2: số liệu + kho đầy đủ (Google chậm) — chạy song song.
  const [statsRes, kho] = await Promise.all([
    (async () => { try { return await fetchSpStats() } catch { return cached } })(),
    fetchKhoFacts(),
  ])
  return buildBlock(me, members, statsRes ?? cached, kho, false)
}
