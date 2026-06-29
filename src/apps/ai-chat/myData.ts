// ── Trợ lý AI — Mức B: nạp DỮ LIỆU THẬT theo mail người đang chat ──
// Resolve mail đăng nhập → người trong bảng Nhân sự (team_members) → mã SP phụ trách →
// số liệu thật (TÁI DÙNG actuals.ts của War Room → KHỚP Y "Bảng của tôi"). Marketer chỉ
// thấy mã của mình; CEO thấy toàn team. Mail chưa phân → trả '' (không có data).
import { supabase } from '../../lib/supabase'
import { memberEmails, type Member } from '../war-room/store'
import { fetchSpStats, readCachedSpStats, aggregate, type SpStat } from '../war-room/actuals'

const vnd = (n: number) => Math.round(n).toLocaleString('vi-VN') + 'đ'
const pct = (n: number) => (n * 100).toFixed(1) + '%'   // hoan/cpqc/chot lưu dạng phân số (0.375 = 37.5%)
const line = (label: string, s: SpStat) =>
  `${label}: DT ${vnd(s.dt)} · lãi ${vnd(s.lai)} · %CPQC ${pct(s.cpqc)} · %hoàn ${pct(s.hoan)} · AOV ${vnd(s.aov)} · %chốt ${pct(s.chot)}`

const isCeoRole = (role: string) => /ceo|chủ|chu|boss|admin/i.test(role || '')

export async function loadMyDataBlock(email: string): Promise<string> {
  if (!email || email === 'guest') return ''
  let members: Member[] = []
  try {
    const { data, error } = await supabase.from('team_members').select('*')
    if (error || !data) return ''
    members = data as Member[]
  } catch { return '' }

  const lower = email.toLowerCase()
  const me = members.find((m) => memberEmails(m).includes(lower))
  if (!me) return ''   // mail chưa được phân vào Nhân sự → không truy cập số liệu

  // Số liệu: ưu tiên cache (tức thì) rồi mới tải mới (Google chậm). Best-effort.
  let res = readCachedSpStats()
  if (!res) { try { res = await fetchSpStats() } catch { res = null } }
  const stats = res?.stats ?? {}
  const hasStats = Object.keys(stats).length > 0
  const ceo = isCeoRole(me.role)

  const out: string[] = []
  out.push('═══ DỮ LIỆU THẬT CỦA NGƯỜI ĐANG CHAT (chỉ dùng khi họ hỏi về số liệu của họ/team) ═══')
  out.push(`Người chat: ${me.name} (${me.role}) — ${email}.`)
  if (!hasStats) {
    out.push('(Số liệu kho đang tải hoặc Google tạm chặn — nếu hỏi về số mà chưa có, bảo họ mở app Tác Chiến / thử lại sau, ĐỪNG đoán số.)')
  } else if (ceo) {
    out.push('Bạn là CEO/Chủ — xem được TOÀN TEAM. Số liệu từng người (kỳ hiện hành, VNĐ, tỷ giá 5800):')
    for (const m of members) {
      if (!m.sp_codes?.length) continue
      out.push(`- ${line(m.name, aggregate(m.sp_codes, stats))} | mã: ${m.sp_codes.join(', ')}`)
    }
  } else {
    out.push(`Mã SP bạn phụ trách: ${(me.sp_codes ?? []).join(', ') || '(chưa gán)'}.`)
    if (me.sp_codes?.length) {
      out.push(`- ${line('TỔNG của bạn', aggregate(me.sp_codes, stats))}`)
      out.push('Theo từng mã:')
      for (const code of me.sp_codes) {
        const s = stats[code.trim().toUpperCase()]
        if (s) out.push(`- ${line(code, s)}`)
      }
    }
  }
  if (res?.stale) out.push('(Lưu ý: đây là "số tốt gần nhất" do lần tải mới bị Google tạm chặn — có thể chưa mới nhất.)')
  out.push('QUY TẮC: CHỈ trả lời số nằm trong block này. Marketer KHÔNG suy đoán số của mã/người khác. Hỏi mã/người không có trong block → nói "mình không thấy dữ liệu đó (có thể không thuộc bạn hoặc chưa tải được), bạn xem app Tác Chiến nhé". Mọi tiền là VNĐ.')
  return out.join('\n')
}
