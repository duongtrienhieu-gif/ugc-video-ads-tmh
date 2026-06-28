// ── 🎯 TÁC CHIẾN — giao việc · target ngày/tuần/tháng · việc tự sinh ──────────
// CEO đặt target; nhân viên tự quản việc; hệ thống gợi ý việc từ số thật.
import { useEffect, useMemo, useState } from 'react'
import { useWarStore, type Member } from './store'
import { useAuthStore } from '../../stores/authStore'
import { fetchSpStats, aggregate, type SpStat, type SpProfit } from './actuals'

const C = {
  bg: '#070a12', panel: '#0c111c', panel2: '#0a0f19', line: '#1b2233', line2: '#161d2c',
  gold: '#f5c451', text: '#eef1f7', muted: '#74809a', muted2: '#aeb8cc',
  red: '#ff4d5e', amber: '#fbbf24', green: '#4ade80',
}
const fmtMoney = (n: number) => Math.round(n).toLocaleString('vi-VN') + 'đ'
const fmtPct = (n: number) => n.toFixed(1) + '%'
const panelStyle: React.CSSProperties = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 18px', marginBottom: 14 }
const eyebrowStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, letterSpacing: 0.3, color: C.gold, marginBottom: 10 }
const inp: React.CSSProperties = { background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 8, padding: '8px 10px', fontSize: 13 }

const ROLES: [string, string][] = [['marketer', 'Marketer'], ['sale', 'Sale'], ['kho', 'Kho'], ['ops', 'Vận hành'], ['ceo', 'CEO / Chủ']]
const roleLabel = (r: string) => ROLES.find((x) => x[0] === r)?.[1] ?? r
const PERIODS: [string, string][] = [['day', 'Ngày'], ['week', 'Tuần'], ['month', 'Tháng']]
const METRICS: { key: string; label: string; lowerBetter: boolean; money: boolean }[] = [
  { key: 'dt', label: 'Doanh thu', lowerBetter: false, money: true },
  { key: 'cpqc', label: '% CPQC (càng thấp càng tốt)', lowerBetter: true, money: false },
  { key: 'hoan', label: '% Hoàn (càng thấp càng tốt)', lowerBetter: true, money: false },
  { key: 'lai', label: 'Lãi thật', lowerBetter: false, money: true },
]
const TYPE_LABEL: Record<string, string> = { cat: 'Cắt/sửa', hoan: 'Hoàn', nhap: 'Nhập', gift: 'Quà', test: 'Test SP', other: 'Khác' }
const STATUS_NEXT: Record<string, string> = { todo: 'doing', doing: 'done', done: 'todo' }
const STATUS_LABEL: Record<string, string> = { todo: 'Cần làm', doing: 'Đang làm', done: 'Xong' }
const statusColor = (s: string) => (s === 'done' ? C.green : s === 'doing' ? C.amber : C.muted2)

export default function WarRoom() {
  const { members, targets, tasks, loaded, error, load, addMember, updateMember, deleteMember, setTarget, addTask, updateTask, deleteTask } = useWarStore()
  const userEmail = useAuthStore((s) => s.user?.email ?? '')
  const [tab, setTab] = useState<'target' | 'viec' | 'nhansu'>('target')
  const [stats, setStats] = useState<Record<string, SpStat>>({})
  const [profit, setProfit] = useState<SpProfit[]>([])

  useEffect(() => { void load() }, [load])
  useEffect(() => { void fetchSpStats().then((r) => { setStats(r.stats); setProfit(r.profit) }).catch(() => {}) }, [])

  const myMember = members.find((m) => m.email.trim().toLowerCase() === userEmail.trim().toLowerCase())
  const hasCeo = members.some((m) => m.role === 'ceo')
  const isCEO = myMember?.role === 'ceo' || !hasCeo // bootstrap: chưa có CEO thì ai cũng set được
  const spOwner = useMemo(() => {
    const m: Record<string, Member> = {}
    members.forEach((mem) => (mem.sp_codes ?? []).forEach((c) => { m[c.trim().toUpperCase()] = mem }))
    return m
  }, [members])

  if (!loaded) return <Shell><div style={{ ...panelStyle, textAlign: 'center', color: C.muted }}>● Đang tải Tác Chiến...</div></Shell>
  if (error && !members.length) return <Shell><div style={{ ...panelStyle, color: C.red }}>⚠ {error}. Đã chạy SQL tạo bảng team_members / targets / tasks trong Supabase chưa?</div></Shell>

  return (
    <Shell>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gold, fontSize: 18 }}>🎯</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: 1 }}>Tác Chiến — Giao việc & Target</div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: C.muted }}>TMH GROUP · {isCEO ? 'CHẾ ĐỘ CHỦ' : myMember ? roleLabel(myMember.role).toUpperCase() : 'CHƯA GÁN'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {([['target', '📊 Target'], ['viec', '✅ Việc'], ['nhansu', '👥 Nhân sự']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ background: tab === k ? C.gold : 'transparent', color: tab === k ? '#0a0a0a' : C.muted2, border: `1px solid ${tab === k ? C.gold : C.line}`, borderRadius: 10, padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>

      {tab === 'nhansu' && <NhanSu {...{ members, isCEO, addMember, updateMember, deleteMember }} />}
      {tab === 'target' && <TargetTab {...{ members, targets, stats, isCEO, setTarget }} />}
      {tab === 'viec' && <ViecTab {...{ members, tasks, profit, spOwner, userEmail, addTask, updateTask, deleteTask }} />}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  const [mob, setMob] = useState(false)
  useEffect(() => { const f = () => setMob(window.innerWidth < 700); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  return <div style={{ minHeight: '100%', background: C.bg, color: C.text }}><div style={{ maxWidth: 1180, margin: '0 auto', padding: mob ? '16px 12px 50px' : '24px 24px 60px' }}>{children}</div></div>
}

// ── NHÂN SỰ ──────────────────────────────────────────────────────────────────
function NhanSu({ members, isCEO, addMember, updateMember, deleteMember }: {
  members: Member[]; isCEO: boolean
  addMember: (m: Omit<Member, 'id'>) => Promise<void>; updateMember: (id: string, p: Partial<Member>) => Promise<void>; deleteMember: (id: string) => Promise<void>
}) {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [role, setRole] = useState('marketer'); const [sp, setSp] = useState('')
  const add = () => { if (!name.trim() || !email.trim()) return; void addMember({ name: name.trim(), email: email.trim().toLowerCase(), role, sp_codes: sp.split(',').map((s) => s.trim()).filter(Boolean) }); setName(''); setEmail(''); setSp('') }
  return (
    <div style={panelStyle}>
      <div style={eyebrowStyle}>👥 NHÂN SỰ · {members.length} người</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Email = Gmail nhân viên dùng đăng nhập app. MÃ SP (cho marketer) = các mã họ phụ trách, phẩy ngăn cách → để tính số thực tế.</div>
      {members.map((m) => (
        <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${C.line2}`, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, minWidth: 90 }}>{m.name}</span>
          <span style={{ fontSize: 12, color: C.muted2, minWidth: 150 }}>{m.email}</span>
          <span style={{ color: C.gold, border: `1px solid ${C.gold}`, borderRadius: 20, padding: '1px 9px', fontSize: 11 }}>{roleLabel(m.role)}</span>
          <input defaultValue={(m.sp_codes ?? []).join(', ')} placeholder="mã SP phụ trách (phẩy)" onBlur={(e) => void updateMember(m.id, { sp_codes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            disabled={!isCEO} style={{ ...inp, flex: 1, minWidth: 180, fontSize: 12 }} />
          {isCEO && <button onClick={() => void deleteMember(m.id)} style={{ background: 'transparent', color: C.red, border: `1px solid ${C.line}`, borderRadius: 7, padding: '5px 9px', fontSize: 12, cursor: 'pointer' }}>Xoá</button>}
        </div>
      ))}
      {isCEO && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên (KHÁNH...)" style={{ ...inp, width: 130 }} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@gmail.com" style={{ ...inp, width: 190 }} />
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...inp }}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <input value={sp} onChange={(e) => setSp(e.target.value)} placeholder="mã SP (phẩy)" style={{ ...inp, flex: 1, minWidth: 160 }} />
          <button onClick={add} style={{ background: C.gold, color: '#1a1405', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Thêm</button>
        </div>
      )}
      {!isCEO && <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>Chỉ CEO/Chủ thêm-sửa được nhân sự.</div>}
    </div>
  )
}

// ── TARGET ───────────────────────────────────────────────────────────────────
function TargetTab({ members, targets, stats, isCEO, setTarget }: {
  members: Member[]; targets: { member_id: string; period: string; metric: string; value: number }[]
  stats: Record<string, SpStat>; isCEO: boolean; setTarget: (m: string, p: string, k: string, v: number) => Promise<void>
}) {
  const [period, setPeriod] = useState('month')
  const [memberId, setMemberId] = useState('')
  const mkt = members.filter((m) => m.role === 'marketer')
  const sel = members.find((m) => m.id === memberId) || mkt[0] || members[0]
  if (!sel) return <div style={{ ...panelStyle, color: C.muted, textAlign: 'center' }}>Chưa có nhân sự. Thêm ở tab 👥 Nhân sự trước.</div>
  const act = aggregate(sel.sp_codes ?? [], stats)
  const actualOf = (k: string) => (k === 'dt' ? act.dt : k === 'lai' ? act.lai : k === 'cpqc' ? act.cpqc * 100 : act.hoan * 100)
  const targetOf = (k: string) => targets.find((t) => t.member_id === sel.id && t.period === period && t.metric === k)?.value

  return (
    <div style={panelStyle}>
      <div style={eyebrowStyle}>📊 TARGET · {sel.name}</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <select value={sel.id} onChange={(e) => setMemberId(e.target.value)} style={{ ...inp, border: `1px solid ${C.gold}`, color: C.gold, fontWeight: 600 }}>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name} · {roleLabel(m.role)}</option>)}
        </select>
        {PERIODS.map(([v, l]) => <button key={v} onClick={() => setPeriod(v)} style={{ background: period === v ? C.gold : 'transparent', color: period === v ? '#0a0a0a' : C.muted2, border: `1px solid ${period === v ? C.gold : C.line}`, borderRadius: 8, padding: '7px 13px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{l}</button>)}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr style={{ color: C.muted, fontSize: 10, letterSpacing: 1 }}>
          <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 400 }}>CHỈ TIÊU</th>
          <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 400 }}>TARGET ({PERIODS.find((p) => p[0] === period)?.[1]})</th>
          <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 400 }}>THỰC TẾ (tháng tới giờ)</th>
          <th style={{ textAlign: 'center', padding: '6px 0', fontWeight: 400 }}>ĐÈN</th>
        </tr></thead>
        <tbody>
          {METRICS.map((mt) => {
            const tgt = targetOf(mt.key); const actual = actualOf(mt.key)
            const ok = tgt == null ? null : mt.lowerBetter ? actual <= tgt : actual >= tgt
            const show = (v: number) => (mt.money ? fmtMoney(v) : fmtPct(v))
            return (
              <tr key={mt.key} style={{ borderTop: `1px solid ${C.line2}` }}>
                <td style={{ padding: '10px 0', color: C.muted2 }}>{mt.label}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                  <input type="number" defaultValue={tgt ?? ''} disabled={!isCEO} placeholder="—"
                    onBlur={(e) => { const v = +e.target.value; if (e.target.value !== '' && v !== tgt) void setTarget(sel.id, period, mt.key, v) }}
                    style={{ ...inp, width: 120, textAlign: 'right', color: C.gold }} />
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'right', color: act.dt > 0 ? C.text : C.muted }}>{act.dt > 0 ? show(actual) : '—'}</td>
                <td style={{ padding: '10px 0', textAlign: 'center' }}>{ok == null ? <span style={{ color: C.muted }}>—</span> : <span style={{ color: ok ? C.green : C.red }}>{ok ? '✓ đạt' : '✗ trượt'}</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
        Target {isCEO ? '— CEO gõ rồi rời ô là lưu' : '(chỉ CEO sửa)'}. THỰC TẾ = gộp số thật các mã marketer phụ trách (lũy kế tháng) — gán mã ở tab Nhân sự. %CPQC/%hoàn nhập theo số (vd 30 = 30%). Chi tiết ngày/tuần sẽ thêm sau.
        {act.dt === 0 && <span style={{ color: C.amber }}> · {sel.name} chưa gán mã SP nào → chưa có số thực tế.</span>}
      </div>
    </div>
  )
}

// ── VIỆC ─────────────────────────────────────────────────────────────────────
function ViecTab({ members, tasks, profit, spOwner, userEmail, addTask, updateTask, deleteTask }: {
  members: Member[]; tasks: ReturnType<typeof useWarStore.getState>['tasks']; profit: SpProfit[]
  spOwner: Record<string, Member>; userEmail: string
  addTask: (t: Omit<ReturnType<typeof useWarStore.getState>['tasks'][number], 'id'>) => Promise<void>
  updateTask: (id: string, p: Partial<ReturnType<typeof useWarStore.getState>['tasks'][number]>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
}) {
  const [filter, setFilter] = useState('all')
  const [title, setTitle] = useState(''); const [assignee, setAssignee] = useState(''); const [type, setType] = useState('other'); const [due, setDue] = useState('')
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.name ?? '—'

  const suggestions = useMemo(() => {
    const out: { title: string; type: string; assignee_id: string | null; source: string }[] = []
    for (const p of profit) {
      const owner = spOwner[p.name.trim().toUpperCase()]
      const base = { assignee_id: owner?.id ?? null, source: `feed:${p.name}` }
      if (p.den === 'Cắt') out.push({ title: `Cắt / sửa gấp ${p.name}${p.hoanPct > 0.45 ? ` (hoàn ${(p.hoanPct * 100).toFixed(0)}%)` : ' (lỗ)'}`, type: 'cat', ...base })
      else if (p.hoanPct > 0.45) out.push({ title: `Giảm hoàn ${p.name} ${(p.hoanPct * 100).toFixed(0)}% — chặn tỉnh bom / ép cọc`, type: 'hoan', ...base })
      else if (p.den === 'Scale') out.push({ title: `Đẩy mạnh ${p.name} — còn dư địa scale`, type: 'test', ...base })
    }
    const existing = new Set(tasks.map((t) => t.source).filter(Boolean))
    return out.filter((s) => !existing.has(s.source)).slice(0, 12)
  }, [profit, spOwner, tasks])

  const shown = filter === 'all' ? tasks : tasks.filter((t) => t.assignee_id === filter)
  const add = () => { if (!title.trim()) return; void addTask({ title: title.trim(), assignee_id: assignee || null, type, source: null, status: 'todo', due: due || null, detail: null, created_by: userEmail }); setTitle(''); setDue('') }

  return (
    <>
      {suggestions.length > 0 && (
        <div style={{ ...panelStyle, borderColor: '#3a3414' }}>
          <div style={eyebrowStyle}>⚡ GỢI Ý TỪ SỐ THẬT · {suggestions.length}</div>
          {suggestions.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: i ? `1px solid ${C.line2}` : 'none', flexWrap: 'wrap' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.type === 'cat' ? C.red : C.amber, flexShrink: 0 }} />
              <span style={{ fontSize: 13, flex: 1, minWidth: 200 }}>{s.title}</span>
              <span style={{ fontSize: 11, color: C.muted2 }}>→ {nameOf(s.assignee_id)}</span>
              <button onClick={() => void addTask({ title: s.title, assignee_id: s.assignee_id, type: s.type, source: s.source, status: 'todo', due: null, detail: null, created_by: userEmail })}
                style={{ background: C.gold, color: '#1a1405', border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Nhận</button>
            </div>
          ))}
        </div>
      )}

      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <div style={eyebrowStyle}>✅ VIỆC · {shown.length}</div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...inp, fontSize: 12 }}>
            <option value="all">Tất cả người</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        {shown.length === 0 && <div style={{ fontSize: 13, color: C.muted, padding: '6px 0' }}>Chưa có việc. Nhận gợi ý ở trên hoặc thêm bên dưới.</div>}
        {shown.map((t) => (
          <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 0', borderTop: `1px solid ${C.line2}`, flexWrap: 'wrap' }}>
            <button onClick={() => void updateTask(t.id, { status: STATUS_NEXT[t.status] })} title="đổi trạng thái"
              style={{ background: 'transparent', color: statusColor(t.status), border: `1px solid ${statusColor(t.status)}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>{STATUS_LABEL[t.status]}</button>
            <span style={{ fontSize: 13, flex: 1, minWidth: 180, textDecoration: t.status === 'done' ? 'line-through' : 'none', color: t.status === 'done' ? C.muted : C.text }}>{t.title}</span>
            {t.type && <span style={{ fontSize: 11, color: C.muted2 }}>{TYPE_LABEL[t.type] ?? t.type}</span>}
            <span style={{ fontSize: 11, color: C.muted }}>{nameOf(t.assignee_id)}</span>
            {t.due && <span style={{ fontSize: 11, color: C.amber }}>{t.due}</span>}
            <button onClick={() => void deleteTask(t.id)} style={{ background: 'transparent', color: C.muted, border: 'none', fontSize: 14, cursor: 'pointer' }}>✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} placeholder="Việc cần làm..." style={{ ...inp, flex: 1, minWidth: 200 }} />
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} style={{ ...inp, fontSize: 12 }}><option value="">— giao ai —</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...inp, fontSize: 12 }}>{Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} style={{ ...inp, fontSize: 12 }} />
          <button onClick={add} style={{ background: C.gold, color: '#1a1405', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Thêm</button>
        </div>
      </div>
    </>
  )
}
