// ─────────────────────────────────────────────────────────────────────────
// 📖 SỔ TAY VẬN HÀNH CHATBOT — cầm tay chỉ việc cho nhân viên, từ tạo SP
// tới lúc ĐƠN TỰ CHẢY RA SHEET. Accordion từng bước + checklist tick được
// (lưu localStorage) + BẢNG MÃ định tuyến dùng chung (nhúng sẵn 37 SP,
// owner bấm "＋Thêm mã" → lưu Supabase kind='chat-bot-handbook' → mọi
// nhân viên thấy bản mới nhất).
//
// RLS cần 1 policy để MỌI nhân viên đọc được bảng mã chung (SQL Editor):
//   create policy "all_read_chatbot_handbook" on user_outputs
//     for select to authenticated
//     using (kind = 'chat-bot-handbook');
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { supabase, requireUserId } from '../../../lib/supabase'

const OWNER_EMAILS = ['duongtrienhieu@gmail.com']
const WA_NUMBER = '+60 11-1885 8556'
const WA_LINK = 'wa.me/601118858556'
const CHATWOOT_URL = 'app.chatwoot.com'
const HANDBOOK_KIND = 'chat-bot-handbook'
const CHECK_LS_KEY = 'chatbot-handbook-checks-v1'

// ── Bảng mã GỐC (nhúng sẵn — 3 team, chốt 15/7/2026). Mã mới → owner thêm nút dưới. ──
interface CodeRow { code: string; product: string; team: string }
const SEEDED_CODES: CodeRow[] = [
  // TEAM SUMMIT
  { code: 'APRICOT', product: 'DRIED APRICOTS', team: 'SUMMIT' },
  { code: 'CAMFORD', product: 'CAMFORD CLEANING SPRAY', team: 'SUMMIT' },
  { code: 'JOINTGEL', product: 'JOINT GEL LANZF', team: 'SUMMIT' },
  { code: 'GARLICSALT', product: 'PARSLEY GARLIC SALT', team: 'SUMMIT' },
  { code: 'HAWTHORN', product: 'SNACK HAWTHORNS', team: 'SUMMIT' },
  { code: 'THROAT', product: 'THROAT SPRAY', team: 'SUMMIT' },
  { code: 'LIMFOMA', product: 'KRIM LIMFOMA', team: 'SUMMIT' },
  { code: 'COLLAGEN', product: 'PEPTIDE COLLAGEN CREAM', team: 'SUMMIT' },
  { code: 'AIRPUMP', product: 'CAR AIR PUMP', team: 'SUMMIT' },
  { code: 'USMA', product: 'SERUM USMA', team: 'SUMMIT' },
  { code: 'SP6', product: 'SP6 TOOTHPASTE', team: 'SUMMIT' },
  { code: 'FIGPIE', product: 'FIG WALNUT PIE', team: 'SUMMIT' },
  { code: 'PAINPATCH', product: 'PAIN RELIEF PATCHES', team: 'SUMMIT' },
  { code: 'CONGUN', product: 'CONGUN', team: 'SUMMIT' },
  { code: 'SLEEP', product: 'SLEEPING SPRAY', team: 'SUMMIT' },
  { code: 'COCOSOIL', product: 'COCONUT FIBER SOIL', team: 'SUMMIT' },
  // TEAM APEX
  { code: 'ROLLER', product: 'AGING ROLLER', team: 'APEX' },
  { code: 'HEARING', product: 'EELHOE SUPPORTS HEARING', team: 'APEX' },
  { code: 'KNEEPAD', product: 'KNEE PAD', team: 'APEX' },
  { code: 'TOOTHACHE', product: 'TOOTHACHE RELIEF SPRAY', team: 'APEX' },
  { code: 'GINSENG', product: 'BLACK GINSENG', team: 'APEX' },
  { code: 'BAIYAO', product: 'BAIYAOLANG', team: 'APEX' },
  { code: 'TEETHPWD', product: 'TEETH POWDER', team: 'APEX' },
  { code: 'NASAL', product: 'NASAL SPRAY', team: 'APEX' },
  { code: 'GOLDMASK', product: 'GOLD MASK', team: 'APEX' },
  { code: 'FOOTSOAK', product: 'FOOTSOAK', team: 'APEX' },
  { code: 'STOMACH', product: 'STOMACH GEL', team: 'APEX' },
  { code: 'TINNITUS', product: 'TINNITUS EAR SPRAY', team: 'APEX' },
  { code: 'METEOR', product: 'GELANG BATU METEOR', team: 'APEX' },
  { code: 'OXYELLE', product: 'OXYELLE KRIM PELEGA SAKIT HAID', team: 'APEX' },
  // TEAM TITAN
  { code: '9YOUNG', product: '9YOUNG BASIC', team: 'TITAN' },
  { code: 'COUGH', product: 'COUGH GEL', team: 'TITAN' },
  { code: 'LUNGPATCH', product: 'LUNG PATCH', team: 'TITAN' },
  { code: 'PROSTA', product: 'PROSTA EASE', team: 'TITAN' },
  { code: 'PENTAVITE', product: 'PENTAVITE MEN', team: 'TITAN' },
  { code: 'KIDNEY', product: 'KIDNEY PATCH', team: 'TITAN' },
  { code: 'JEPUN', product: 'JEPUN SOOTHING PAIN GEL', team: 'TITAN' },
]

const TEAM_COLOR: Record<string, string> = {
  SUMMIT: 'bg-sky-500/10 text-sky-700',
  APEX: 'bg-rose-500/10 text-rose-600',
  TITAN: 'bg-emerald-500/10 text-emerald-700',
}

// ── Khối UI nhỏ ──────────────────────────────────────────────────────────
function Section({ n, title, children, defaultOpen }: { n: string; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className="overflow-hidden rounded-xl border border-black/8 bg-white">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-black/[0.02]">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-700">{n}</span>
        <span className="flex-1 text-sm font-bold text-gray-900">{title}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="space-y-3 border-t border-black/5 px-4 py-3 text-[13px] leading-relaxed text-gray-700">{children}</div>}
    </div>
  )
}

/** Ví dụ cụ thể (nền xanh nhạt). */
function Ex({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">💡 {title ?? 'Ví dụ'}</p>
      <div className="space-y-1 text-[12.5px] text-gray-700">{children}</div>
    </div>
  )
}

function Warn({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-[12.5px] font-medium text-amber-800">⚠️ {children}</div>
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-black/[0.06] px-1.5 py-0.5 font-mono text-[12px] text-gray-800">{children}</code>
}

/** Checklist item — tick lưu localStorage (mỗi người tự theo dõi). */
function useChecks(): [Record<string, boolean>, (k: string) => void] {
  const [checks, setChecks] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(CHECK_LS_KEY) ?? '{}') } catch { return {} }
  })
  const toggle = (k: string) =>
    setChecks((s) => {
      const next = { ...s, [k]: !s[k] }
      localStorage.setItem(CHECK_LS_KEY, JSON.stringify(next))
      return next
    })
  return [checks, toggle]
}

// ── Component chính ──────────────────────────────────────────────────────
export default function HandbookPanel() {
  const [checks, toggleCheck] = useChecks()
  const [isOwner, setIsOwner] = useState(false)
  const [extraCodes, setExtraCodes] = useState<CodeRow[]>([])
  const [handbookRowId, setHandbookRowId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<CodeRow>({ code: '', product: '', team: '' })
  const [msg, setMsg] = useState('')

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setIsOwner(OWNER_EMAILS.includes(data.user?.email ?? '')))
    // Bảng mã bổ sung dùng chung (mọi user đọc được nhờ policy all_read_chatbot_handbook)
    void supabase
      .from('user_outputs')
      .select('id,payload_json')
      .eq('kind', HANDBOOK_KIND)
      .limit(1)
      .then(({ data }) => {
        const row = data?.[0] as { id: string; payload_json?: { codes?: CodeRow[] } } | undefined
        if (row) {
          setHandbookRowId(row.id)
          setExtraCodes(row.payload_json?.codes ?? [])
        }
      })
  }, [])

  const allCodes = useMemo(() => {
    const seen = new Set(SEEDED_CODES.map((c) => c.code))
    return [...SEEDED_CODES, ...extraCodes.filter((c) => !seen.has(c.code))]
  }, [extraCodes])

  const Check = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-0.5 hover:bg-black/[0.02]">
      <input type="checkbox" checked={!!checks[id]} onChange={() => toggleCheck(id)} className="mt-0.5 h-4 w-4 accent-emerald-500" />
      <span className={checks[id] ? 'text-gray-400 line-through' : ''}>{children}</span>
    </label>
  )

  const saveCode = async () => {
    const code = draft.code.trim().toUpperCase()
    const product = draft.product.trim().toUpperCase()
    const team = draft.team.trim().toUpperCase()
    if (!code || !product || !team) { setMsg('Điền đủ Mã + Tên SP + Team'); return }
    if (allCodes.some((c) => c.code === code)) { setMsg(`Mã ${code} ĐÃ TỒN TẠI — chọn mã khác`); return }
    const next = [...extraCodes, { code, product, team }]
    try {
      if (handbookRowId) {
        const { error } = await supabase.from('user_outputs').update({ payload_json: { codes: next } }).eq('id', handbookRowId)
        if (error) throw error
      } else {
        const user_id = await requireUserId()
        const id = crypto.randomUUID()
        const { error } = await supabase.from('user_outputs').insert({ id, user_id, kind: HANDBOOK_KIND, title: 'Bảng mã bổ sung', payload_json: { codes: next } })
        if (error) throw error
        setHandbookRowId(id)
      }
      setExtraCodes(next)
      setDraft({ code: '', product: '', team: '' })
      setAdding(false)
      setMsg('')
    } catch (e) {
      setMsg(`Lưu lỗi: ${e instanceof Error ? e.message : e}`)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3 px-4 py-4">
      <div>
        <h2 className="text-base font-bold text-gray-900">📖 Sổ tay vận hành — từ số 0 tới ĐƠN VỀ SHEET</h2>
        <p className="text-[12px] text-gray-400">Làm đúng thứ tự 8 bước. Tick ✓ tới đâu nhớ tới đó. Vướng bước nào → hỏi quản trị.</p>
      </div>

      {/* ── B0: hiểu hệ thống ── */}
      <Section n="0" title="Hiểu hệ thống trong 1 phút" defaultOpen>
        <div className="rounded-lg bg-black/[0.03] px-3 py-2 text-center text-[12.5px] font-medium text-gray-700">
          Ads của bạn → khách bấm nhắn vào <Mono>{WA_NUMBER}</Mono> → 🤖 BOT tự tư vấn + chốt bằng tiếng Malay →
          bạn theo dõi/chen tay trên Chatwoot → đơn chốt TỰ HIỆN trên Google Sheet
        </div>
        <p>Cả team dùng <b>CHUNG 1 số WhatsApp</b>. Bot phân biệt sản phẩm bằng <b>MÃ ĐỊNH TUYẾN</b> trong tin nhắn đầu của khách (đến từ ads của bạn). Vì vậy: <b>đặt đúng MÃ = tiền về đúng người</b>, sai mã = bot tư vấn nhầm SP.</p>
      </Section>

      {/* ── B1 ── */}
      <Section n="1" title="Tạo Sản phẩm trong Ngân hàng SP">
        <Check id="b1-1">Vào <b>Ngân hàng Sản phẩm</b> → Thêm SP: tên, mô tả, <b>lợi ích</b>, <b>pain points</b>, cách dùng.</Check>
        <Check id="b1-2">Upload <b>ảnh sản phẩm</b> (ảnh thật, rõ).</Check>
        <p>Bot lấy chữ ở đây để tư vấn → <b>viết như đang nói với khách</b>, càng cụ thể bot càng thuyết phục.</p>
        <Ex title="Viết lợi ích — SAI vs ĐÚNG">
          <p>❌ <i>"Giảm đau tốt, chất lượng cao"</i> (chung chung, bot nói ra rất nhạt)</p>
          <p>✅ <i>"Xoa 5 phút là ấm nóng vùng khớp gối, đỡ cứng khớp buổi sáng; người già leo cầu thang đỡ đau sau ~1 tuần dùng đều"</i></p>
        </Ex>
      </Section>

      {/* ── B2 ── */}
      <Section n="2" title="Tạo Chatbot cho SP (bước QUAN TRỌNG NHẤT)">
        <Check id="b2-1">Tab <b>⚙ Cấu hình</b> → chọn SP vừa tạo.</Check>
        <Check id="b2-2"><b>Mã định tuyến</b>: tra BẢNG MÃ (cuối sổ tay) — đúng mã SP của mình. SP mới chưa có mã → <b>báo sếp cấp mã</b>, KHÔNG tự bịa.</Check>
        <Check id="b2-3"><b>Team</b>: SUMMIT / APEX / TITAN (team của bạn).</Check>
        <Check id="b2-4"><b>Bảng giá</b>: mỗi dòng 1 gói "mua X tặng Y = giá". Bot CHỈ bán đúng bảng này.</Check>
        <Check id="b2-5"><b>Chính sách COD</b>: phí ship, mấy ngày giao, khu vực, đổi trả. Bot CẤM bịa — thiếu là bot phải gọi người.</Check>
        <Check id="b2-6"><b>Gắn ảnh</b>: bấm ✨ để AI tự gán VAI + viết caption, rồi RÀ LẠI theo format 2 vế: <i>"tả ảnh — GỬI KHI: tình huống"</i>. Caption là thứ quyết định bot rút ảnh đúng lúc.</Check>
        <Check id="b2-7">Điền <b>Xử lý từ chối</b> cho 2-3 câu chê hay gặp nhất.</Check>
        <Ex title="Bảng giá chuẩn (APRICOT)">
          <p>mua <b>1</b> tặng <b>0</b> = <b>RM39</b> (giá lẻ)</p>
          <p>mua <b>1</b> tặng <b>1</b> = <b>RM59</b> — ghi chú: <i>freeship</i></p>
          <p>mua <b>2</b> tặng <b>2</b> = <b>RM99</b> — ghi chú: <i>gói lợi nhất, freeship</i></p>
        </Ex>
        <Ex title="Caption ảnh — SAI vs ĐÚNG (format 2 vế)">
          <p>❌ <i>"ảnh 1", "feedback"</i> → bot không biết lúc nào nên gửi</p>
          <p>✅ <i>"Feedback khách Melaka dùng 2 tuần hết nghẹt mũi ban đêm — GỬI KHI: khách do dự/nghi ngờ/im lặng"</i></p>
          <p>✅ <i>"Sơ đồ cơ chế xịt làm sạch khoang mũi — GỬI KHI: giải thích vì sao hết nghẹt"</i></p>
        </Ex>
        <Warn>Mã định tuyến VIẾT HOA, không dấu, KHÔNG TRÙNG với SP khác. Trùng mã = 2 bot đá nhau, mất đơn cả 2 đứa.</Warn>
      </Section>

      {/* ── B3 ── */}
      <Section n="3" title="Test trong Mô phỏng (bắt buộc trước khi chạy ads)">
        <p>Tab <b>▶ Mô phỏng</b> — đóng vai khách Malay khó tính, thử ĐỦ 5 câu:</p>
        <Check id="b3-1">Hỏi giá: <Mono>berapa harga?</Mono> → bot báo đúng BẢNG GIÁ + gợi ý gói lợi.</Check>
        <Check id="b3-2">Chê đắt: <Mono>mahal la</Mono> → bot đổi gói/nhấn giá trị, KHÔNG tự giảm giá.</Check>
        <Check id="b3-3">Hỏi ship: <Mono>cod berapa hari? area saya boleh?</Mono> → đúng chính sách đã điền.</Check>
        <Check id="b3-4">Xin ảnh: <Mono>ada gambar produk / feedback tak?</Mono> → bot gửi đúng ảnh.</Check>
        <Check id="b3-5">Chốt thử: <Mono>ok nak order 1</Mono> → bot xin tên + SĐT + địa chỉ → xác nhận đơn + tổng tiền ĐÚNG.</Check>
        <p>Bot trả lời sai chỗ nào → quay lại Bước 2 sửa <b>đúng ô đó</b> (sai giá → sửa Bảng giá; bịa ship → điền COD; nhạt → viết lại lợi ích). <b>Đừng</b> nhét ghi chú chồng lên.</p>
      </Section>

      {/* ── B4 ── */}
      <Section n="4" title="Test THẬT trên WhatsApp">
        <Check id="b4-1">Lấy điện thoại nhắn vào <Mono>{WA_NUMBER}</Mono>: <Mono>Hi, nak tanya pasal MÃ-CỦA-BẠN</Mono></Check>
        <Check id="b4-2">Bot trả lời ĐÚNG SP của bạn (không lộn SP đứa khác).</Check>
        <Check id="b4-3">Mở Chatwoot (<Mono>{CHATWOOT_URL}</Mono>) → thấy hội thoại vừa chat hiện lên.</Check>
        <Ex>
          <p>Nhắn: <Mono>Hi, nak tanya pasal APRICOT</Mono> → bot phải chào + nói về <b>mơ sấy</b>, không được nói về gel khớp.</p>
        </Ex>
      </Section>

      {/* ── B5 ── */}
      <Section n="5" title="Lên camp ads (Click-to-WhatsApp)">
        <Check id="b5-1">Mục tiêu camp: <b>Tương tác (Engagement)</b> → vị trí chuyển đổi <b>Ứng dụng nhắn tin → WhatsApp</b> → chọn số <Mono>{WA_NUMBER}</Mono>.</Check>
        <Check id="b5-2"><b>Tên camp/ad đúng luật</b>: <Mono>TEAM-MÃ-creative</Mono></Check>
        <Check id="b5-3"><b>Tin nhắn chào (welcome message)</b> của ad: <Mono>Hi, nak tanya pasal MÃ</Mono> — CHÌA KHOÁ phân luồng, sai chữ này là bot tư vấn lộn SP.</Check>
        <Check id="b5-4">Mỗi ad = 1 SP. KHÔNG gộp 2 SP vào 1 ad.</Check>
        <Ex title="Đặt tên — SAI vs ĐÚNG">
          <p>✅ <Mono>SUMMIT-APRICOT-vid01</Mono> · <Mono>TITAN-COUGH-vid03-tet</Mono></p>
          <p>❌ <i>"test camp 1"</i>, <i>"mơ sấy video mới"</i> (không tra được của ai, SP gì)</p>
        </Ex>
      </Section>

      {/* ── B6 ── */}
      <Section n="6" title="Trực Chatwoot hằng ngày">
        <Check id="b6-1">Login Chatwoot → lọc theo nhãn <b>team/SP của mình</b>.</Check>
        <Check id="b6-2">Bot tự rep là chính — bạn CHỈ nhảy vào khi: thấy ghi chú <b>"⚠️ BOT XIN NGƯỜI HỖ TRỢ"</b>, hoặc khách sộp/khách phức tạp.</Check>
        <Check id="b6-3">Muốn chat tay: gõ thẳng vào ô Trả lời → bot TỰ IM ngay.</Check>
        <Check id="b6-4">Xong việc → tab <b>Lưu ý riêng</b> gõ <Mono>/bot</Mono> → bot cầm lái lại. (Quên thì 6 tiếng bot tự cầm.)</Check>
        <Check id="b6-5">Luật: thấy "BOT XIN NGƯỜI" phải xử trong <b>15 phút</b> (giờ hành chính).</Check>
        <Ex title="Tình huống thật">
          <p>Khách hỏi <i>"ada sijil KKM tak?"</i> → bot không chắc → tự bắn ghi chú ⚠️ → bạn vào trả lời tay (kèm ảnh giấy tờ nếu có) → gõ <Mono>/bot</Mono> trả lái.</p>
        </Ex>
      </Section>

      {/* ── B7 ── */}
      <Section n="7" title="Xem đơn trên Google Sheet">
        <Check id="b7-1">Mở Sheet <b>DON HANG WHATSAPP</b> → tab team mình.</Check>
        <p>Mỗi đơn bot chốt = 1 dòng tự hiện: <i>Thời gian · Sản phẩm · Team · Tên khách · SĐT · Địa chỉ · Món+SL · Tổng · Số WA</i>. Đối chiếu + lên đơn vận chuyển theo quy trình team.</p>
        <Warn>Đơn không thấy trên Sheet nhưng Chatwoot có chốt? → Khả năng khách chưa XÁC NHẬN lần cuối với bot (bot chỉ ghi đơn khi khách gật). Vào hội thoại xem lại, cần thì chốt tay + tự ghi đơn.</Warn>
      </Section>

      {/* ── B8 ── */}
      <Section n="8" title="Lỗi thường gặp (đọc trước khi hỏi sếp 😄)">
        <div className="space-y-2">
          <p><b>Sửa config bao lâu bot cập nhật?</b> ≤ 1 phút. Lưu xong nhắn thử là thấy.</p>
          <p><b>Bot nói sai giá?</b> → Sửa <b>Bảng giá</b> trong config. KHÔNG viết đè vào ghi chú/playbook.</p>
          <p><b>Bot không gửi ảnh?</b> → Ảnh chưa gắn vào config, hoặc caption quá mơ hồ. Về Bước 2.6.</p>
          <p><b>Bot tư vấn lộn SP?</b> → Kiểm tra welcome message của ad có đúng <Mono>pasal MÃ</Mono> chưa + mã trong config đúng chưa.</p>
          <p><b>Muốn thêm SP mới?</b> → Xin sếp cấp MÃ → sếp thêm vào Bảng mã → bạn tạo config với mã đó. Bot tự nhận, không cần chờ ai "deploy".</p>
          <p><b>TUYỆT ĐỐI KHÔNG:</b> sửa config SP của người khác · tự bịa mã · giải quyết (resolve) hội thoại chưa chốt xong.</p>
        </div>
      </Section>

      {/* ── Bảng mã ── */}
      <div className="overflow-hidden rounded-xl border border-black/8 bg-white">
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">🔑 BẢNG MÃ ĐỊNH TUYẾN ({allCodes.length} SP)</h3>
            <p className="text-[11px] text-gray-400">Mỗi SP đúng 1 mã. Dùng trong config + tên camp + welcome message.</p>
          </div>
          {isOwner && (
            <button onClick={() => { setAdding(!adding); setMsg('') }} className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20">
              <Plus className="h-3.5 w-3.5" /> Thêm mã
            </button>
          )}
        </div>
        {adding && (
          <div className="flex flex-wrap items-center gap-2 border-b border-black/5 bg-emerald-500/[0.04] px-4 py-2.5">
            <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder="MÃ (vd GLOW)" className="w-32 rounded-md border border-black/10 px-2 py-1.5 text-xs uppercase outline-none focus:border-emerald-400" />
            <input value={draft.product} onChange={(e) => setDraft({ ...draft, product: e.target.value })} placeholder="Tên sản phẩm" className="min-w-0 flex-1 rounded-md border border-black/10 px-2 py-1.5 text-xs outline-none focus:border-emerald-400" />
            <input value={draft.team} onChange={(e) => setDraft({ ...draft, team: e.target.value.toUpperCase() })} placeholder="TEAM" className="w-24 rounded-md border border-black/10 px-2 py-1.5 text-xs uppercase outline-none focus:border-emerald-400" />
            <button onClick={() => void saveCode()} className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600">Lưu</button>
            {msg && <span className="text-[11px] font-semibold text-red-500">{msg}</span>}
          </div>
        )}
        <div className="grid grid-cols-1 gap-x-4 px-4 py-2 sm:grid-cols-2">
          {(['SUMMIT', 'APEX', 'TITAN'] as const).map((team) => (
            <div key={team} className="py-1.5">
              <p className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${TEAM_COLOR[team]}`}>TEAM {team}</p>
              <div className="space-y-0.5">
                {allCodes.filter((c) => c.team === team).map((c) => (
                  <div key={c.code} className="flex items-baseline gap-2 text-[12px]">
                    <code className="w-24 shrink-0 font-mono font-bold text-gray-800">{c.code}</code>
                    <span className="truncate text-gray-500">{c.product}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {/* Team khác (mã thêm tay không thuộc 3 team gốc) */}
          {allCodes.some((c) => !['SUMMIT', 'APEX', 'TITAN'].includes(c.team)) && (
            <div className="py-1.5">
              <p className="mb-1 inline-block rounded bg-gray-500/10 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">KHÁC</p>
              <div className="space-y-0.5">
                {allCodes.filter((c) => !['SUMMIT', 'APEX', 'TITAN'].includes(c.team)).map((c) => (
                  <div key={c.code} className="flex items-baseline gap-2 text-[12px]">
                    <code className="w-24 shrink-0 font-mono font-bold text-gray-800">{c.code}</code>
                    <span className="truncate text-gray-500">{c.product} <span className="text-gray-400">({c.team})</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="pb-2 text-center text-[11px] text-gray-400">
        Link nhắn thử: <Mono>{WA_LINK}?text=Hi nak tanya pasal MÃ</Mono> · Vướng gì hỏi quản trị (anh Hiếu)
      </p>
    </div>
  )
}
