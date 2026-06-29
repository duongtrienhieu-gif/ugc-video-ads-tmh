// ── Trợ lý AI — Mức B: nạp DỮ LIỆU THẬT theo mail người đang chat ──
// Resolve mail đăng nhập → người trong bảng Nhân sự (team_members) → mã SP phụ trách →
// số liệu thật. Doanh thu/lãi TÁI DÙNG actuals.ts của War Room (KHỚP Y "Bảng của tôi").
// Kho/tồn: nạp DỮ LIỆU THÔ (tồn/tốc độ bán/đang về/bom tỉnh) + đưa AI đúng ngưỡng sắp-đứt
// (cover < 15 ngày), KHÔNG re-implement công thức số-cần-nhập (trỏ app Kho cho số chính xác).
// Marketer chỉ thấy mã của mình; CEO thấy toàn team. Mail chưa phân → trả ''.
import { supabase } from '../../lib/supabase'
import { memberEmails, type Member } from '../war-room/store'
import { fetchSpStats, readCachedSpStats, aggregate, type SpStat } from '../war-room/actuals'

const vnd = (n: number) => Math.round(n).toLocaleString('vi-VN') + 'đ'
const pct = (n: number) => (n * 100).toFixed(1) + '%'
const line = (label: string, s: SpStat) =>
  `${label}: DT ${vnd(s.dt)} · lãi ${vnd(s.lai)} · %CPQC ${pct(s.cpqc)} · %hoàn ${pct(s.hoan)} · AOV ${vnd(s.aov)} · %chốt ${pct(s.chot)}`
const isCeoRole = (role: string) => /ceo|chủ|chu|boss|admin/i.test(role || '')

// ── Kho/tồn THÔ (không re-implement formula restock) ──
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

export async function loadMyDataBlock(email: string): Promise<string> {
  if (!email || email === 'guest') return ''
  let members: Member[] = []
  try {
    const { data, error } = await supabase.from('team_members').select('*')
    if (error || !data) return ''
    members = data as Member[]
  } catch { return '' }

  const me = members.find((m) => memberEmails(m).includes(email.toLowerCase()))
  if (!me) return ''   // mail chưa được phân vào Nhân sự → không truy cập số liệu
  const ceo = isCeoRole(me.role)

  // Số liệu (cache trước) + kho thô — chạy song song.
  const [statsRes, kho] = await Promise.all([
    (async () => { let r = readCachedSpStats(); if (!r) { try { r = await fetchSpStats() } catch { r = null } } return r })(),
    fetchKhoFacts(),
  ])
  const stats = statsRes?.stats ?? {}
  const hasStats = Object.keys(stats).length > 0

  const out: string[] = []
  out.push('═══ DỮ LIỆU THẬT CỦA NGƯỜI ĐANG CHAT (chỉ dùng khi họ hỏi về số liệu/kho của họ/team) ═══')
  out.push(`Người chat: ${me.name} (${me.role}) — ${email}.`)

  // ── DOANH THU / LÃI ──
  if (!hasStats) {
    out.push('(Số liệu doanh thu đang tải hoặc Google tạm chặn — nếu hỏi mà chưa có, bảo họ mở app Tác Chiến / thử lại, ĐỪNG đoán số.)')
  } else if (ceo) {
    out.push('DOANH THU — bạn là CEO/Chủ xem TOÀN TEAM (VNĐ, tỷ giá 5800):')
    for (const m of members) { if (m.sp_codes?.length) out.push(`- ${line(m.name, aggregate(m.sp_codes, stats))} | mã: ${m.sp_codes.join(', ')}`) }
  } else {
    out.push(`Mã SP bạn phụ trách: ${(me.sp_codes ?? []).join(', ') || '(chưa gán)'}.`)
    if (me.sp_codes?.length) {
      out.push(`- ${line('TỔNG của bạn', aggregate(me.sp_codes, stats))}`)
      out.push('DOANH THU theo từng mã:')
      for (const code of me.sp_codes) { const s = stats[code.trim().toUpperCase()]; if (s) out.push(`- ${line(code, s)}`) }
    }
  }

  // ── KHO / TỒN (cover < 15 ngày = sắp đứt; số nhập chính xác xem app Kho) ──
  if (kho && Object.keys(kho.byCode).length) {
    out.push('KHO/TỒN (còn ~X ngày = tồn / tốc độ bán; <15 ngày = SẮP ĐỨT cần nhập; số cần nhập chính xác xem app Kho & Nhập hàng):')
    if (ceo) {
      const urgent = Object.entries(kho.byCode).filter(([, f]) => f.vel > 0 && f.ton / f.vel < 15).sort((a, b) => a[1].ton / a[1].vel - b[1].ton / b[1].vel)
      if (urgent.length) { out.push('Mã SẮP ĐỨT toàn team:'); for (const [c, f] of urgent.slice(0, 20)) out.push(`- ${khoLine(c, f)}`) }
      else out.push('- Không mã nào sắp đứt (cover ≥ 15 ngày).')
    } else {
      for (const code of me.sp_codes ?? []) { const f = kho.byCode[code.trim().toUpperCase()]; if (f) out.push(`- ${khoLine(code, f)}`) }
    }
    const bom = kho.provinces.filter((p) => p.hoanRate > 0).sort((a, b) => b.hoanRate - a.hoanRate).slice(0, 6)
    if (bom.length) out.push(`BOM TỈNH (hoàn cao → cân nhắc chặn COD/ép cọc): ${bom.map((p) => `${p.ten} ${(p.hoanRate * 100).toFixed(0)}%`).join(' · ')}`)
  }

  if (statsRes?.stale) out.push('(Lưu ý: "số tốt gần nhất" do lần tải mới bị Google tạm chặn — có thể chưa mới nhất.)')
  out.push('QUY TẮC: CHỈ trả lời số nằm trong block này. Marketer KHÔNG suy đoán số của mã/người khác. Hỏi mã/người không có trong block → "mình không thấy dữ liệu đó (có thể không thuộc bạn hoặc chưa tải được), bạn xem app Tác Chiến / Kho nhé". Mọi tiền là VNĐ.')
  return out.join('\n')
}
