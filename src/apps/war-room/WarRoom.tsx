// ── 🎯 TÁC CHIẾN — giao việc · target ngày/tuần/tháng · việc tự sinh ──────────
// CEO đặt target; nhân viên tự quản việc; hệ thống gợi ý việc từ số thật.
import { useEffect, useMemo, useState } from 'react'
import { useWarStore, memberEmails, type Member } from './store'
import { useAuthStore } from '../../stores/authStore'
import { useAppStore } from '../../stores/appStore'
import { fetchSpStats, fetchMarketerSp, readCachedSpStats, aggregate, type SpStat, type SpProfit } from './actuals'
import TestPipeline from './TestPipeline'
import DailyLog from './DailyLog'

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
// So tiến độ thực với "nhịp đáng lẽ" (đã đi bao nhiêu % tháng) → chậm/vượt
function paceBadge(actDt: number, targetDt: number | undefined, monthProgress: number): { txt: string; tone: string } | null {
  if (targetDt == null || targetDt <= 0) return null
  const delta = actDt / targetDt - monthProgress
  if (delta < -0.03) return { txt: `chậm ${Math.round(-delta * 100)}% so với nhịp`, tone: C.red }
  if (delta > 0.03) return { txt: `vượt ${Math.round(delta * 100)}% nhịp`, tone: C.green }
  return { txt: 'đúng nhịp', tone: C.amber }
}

export default function WarRoom() {
  const { members, targets, tasks, loaded, error, load, addMember, updateMember, deleteMember, setTarget, addTask, updateTask, deleteTask } = useWarStore()
  const userEmail = useAuthStore((s) => s.user?.email ?? '')
  const [tab, setTab] = useState<'me' | 'daily' | 'target' | 'viec' | 'test' | 'nhansu'>('me')
  const [stats, setStats] = useState<Record<string, SpStat>>({})
  const [profit, setProfit] = useState<SpProfit[]>([])
  const [mktSp, setMktSp] = useState<Record<string, string[]>>({})
  const [stale, setStale] = useState(false)

  const reloadStats = () => fetchSpStats().then((r) => { setStats(r.stats); setProfit(r.profit); setStale(r.stale) }).catch(() => {})
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const cached = readCachedSpStats()
    if (cached) { setStats(cached.stats); setProfit(cached.profit); setStale(true) } // F5 → hiện NGAY số đã cache
    void reloadStats() // rồi tải mới ngầm, không chặn màn hình
    void fetchMarketerSp().then(setMktSp).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const myMember = members.find((m) => memberEmails(m).includes(userEmail.trim().toLowerCase()))
  const hasCeo = members.some((m) => m.role === 'ceo')
  const isCEO = myMember?.role === 'ceo' || !hasCeo // bootstrap: chưa có CEO thì ai cũng set được
  const spOwner = useMemo(() => {
    const m: Record<string, Member> = {}
    members.forEach((mem) => (mem.sp_codes ?? []).forEach((c) => { m[c.trim().toUpperCase()] = mem }))
    return m
  }, [members])

  if (!loaded) return <Shell><div style={{ ...panelStyle, textAlign: 'center', color: C.muted }}>● Đang tải Tác Chiến...</div></Shell>
  if (error && !members.length) return <Shell><div style={{ ...panelStyle, color: C.red }}>⚠ {error}. Đã chạy SQL tạo bảng team_members / targets / tasks trong Supabase chưa?</div></Shell>

  // Nhân viên chỉ được "Bảng của tôi" + "Test SP" (tự đề xuất test, CEO theo dõi cùng).
  // Target/Việc/Nhân sự là quản lý xem chéo → CHỈ CEO.
  const ALL_TABS = [['me', '🎯 Bảng của tôi'], ['daily', '📒 Nhật ký'], ['target', '📊 Target'], ['viec', '✅ Việc'], ['test', '🧪 Test SP'], ['nhansu', '👥 Nhân sự']] as const
  const EMP_TABS = new Set(['me', 'daily', 'test'])
  const visibleTabs = isCEO ? ALL_TABS : ALL_TABS.filter(([k]) => EMP_TABS.has(k))
  const effTab = isCEO || EMP_TABS.has(tab) ? tab : 'me' // nhân viên bấm tab cấm → ép về 'me'

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
        {visibleTabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ background: effTab === k ? C.gold : 'transparent', color: effTab === k ? '#0a0a0a' : C.muted2, border: `1px solid ${effTab === k ? C.gold : C.line}`, borderRadius: 10, padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>

      {isCEO && effTab !== 'me' && (
        <div style={{ ...panelStyle, padding: '10px 14px', fontSize: 12.5, color: C.muted2, lineHeight: 1.7 }}>
          <b style={{ color: C.gold }}>Cách dùng — 3 bước:</b> ① <b>👥 Nhân sự</b>: thêm người (email Gmail họ đăng nhập) → bấm <b>🪄 Tự gán mã SP</b> (app tự biết marketer nào ôm mã nào từ data). ② <b>📊 Target</b>: gõ chỉ tiêu tháng cho từng người → cột THỰC TẾ <b>tự lên số</b> + đèn. ③ <b>✅ Việc</b>: app <b>tự gợi ý việc</b> từ số thật (cắt mã lỗ / giảm hoàn / đẩy mã ngon) gán sẵn đúng người → bấm Nhận; hoặc tự giao việc tay.
        </div>
      )}

      {effTab === 'me' && <MyBoard {...{ members, targets, tasks, stats, profit, isCEO, myMember, userEmail, updateTask, reloadStats, stale }} />}
      {effTab === 'daily' && <DailyLog isCEO={isCEO} userEmail={userEmail} profit={profit} />}
      {isCEO && effTab === 'nhansu' && <NhanSu {...{ members, isCEO, mktSp, addMember, updateMember, deleteMember }} />}
      {isCEO && effTab === 'target' && <TargetTab {...{ members, targets, stats, isCEO, setTarget, reloadStats }} />}
      {isCEO && effTab === 'viec' && <ViecTab {...{ members, tasks, profit, spOwner, userEmail, addTask, updateTask, deleteTask }} />}
      {effTab === 'test' && <TestPipeline isCEO={isCEO} userEmail={userEmail} />}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  const [mob, setMob] = useState(false)
  useEffect(() => { const f = () => setMob(window.innerWidth < 700); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  return <div style={{ minHeight: '100%', background: C.bg, color: C.text }}><div style={{ maxWidth: 1180, margin: '0 auto', padding: mob ? '16px 12px 50px' : '24px 24px 60px' }}>{children}</div></div>
}

// ── BẢNG CỦA TÔI — buồng lái cá nhân: con số hôm nay · KPI tháng · việc của tôi ─
// CEO chọn được từng nhân viên để soi dashboard của đứa đó. Tất cả ×5800 (qua aggregate/computeProfit), KHÔNG 6500.
function MyBoard({ members, targets, tasks, stats, profit, isCEO, myMember, userEmail, updateTask, reloadStats, stale }: {
  members: Member[]; targets: { member_id: string; period: string; metric: string; value: number }[]
  tasks: ReturnType<typeof useWarStore.getState>['tasks']; stats: Record<string, SpStat>; profit: SpProfit[]
  isCEO: boolean; myMember: Member | undefined; userEmail: string
  updateTask: (id: string, p: Partial<ReturnType<typeof useWarStore.getState>['tasks'][number]>) => Promise<void>
  reloadStats: () => Promise<void>; stale: boolean
}) {
  const openApp = useAppStore((s) => s.openApp)
  const [viewId, setViewId] = useState('')
  // CEO xem được mọi người; nhân viên khoá vào chính mình
  const fallback = myMember ?? (isCEO ? members.find((m) => m.role === 'marketer') ?? members[0] : undefined)
  const view = (isCEO ? members.find((m) => m.id === viewId) : null) ?? fallback

  if (!view) {
    return (
      <div style={{ ...panelStyle, textAlign: 'center', color: C.muted2, lineHeight: 1.7 }}>
        Email <b style={{ color: C.text }}>{userEmail}</b> chưa được thêm vào đội.<br />
        Báo CEO thêm bạn ở tab <b>👥 Nhân sự</b> (đúng email Gmail bạn đang đăng nhập) để hiện buồng lái.
      </div>
    )
  }

  const act = aggregate(view.sp_codes ?? [], stats)
  const tgt = (k: string) => targets.find((t) => t.member_id === view.id && t.period === 'month' && t.metric === k)?.value
  const tDt = tgt('dt'), tLai = tgt('lai'), tCpqc = tgt('cpqc'), tHoan = tgt('hoan')

  // ── Con số HÔM NAY PHẢI ĐẠT — bẻ target tháng ÷ ngày còn lại ÷ chốt ──
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1) // gồm hôm nay
  const monthProgress = now.getDate() / daysInMonth // đã đi bao nhiêu % tháng
  const tgtOf = (mid: string, k: string) => targets.find((t) => t.member_id === mid && t.period === 'month' && t.metric === k)?.value
  const headPace = paceBadge(act.dt, tDt, monthProgress)
  const remainingDt = tDt != null ? Math.max(0, tDt - act.dt) : null
  const dtPerDay = remainingDt != null ? remainingDt / daysLeft : null
  const cpqcFrac = tCpqc != null ? tCpqc / 100 : act.cpqc // ưu tiên trần CPQC CEO đặt
  const ordersPerDay = dtPerDay != null && act.aov > 0 ? dtPerDay / act.aov : null
  const dataPerDay = ordersPerDay != null && act.chot > 0 ? ordersPerDay / act.chot : null
  const adsPerDay = dtPerDay != null ? dtPerDay * cpqcFrac : null
  const cpaTarget = adsPerDay != null && dataPerDay != null && dataPerDay > 0 ? adsPerDay / dataPerDay : null
  const hitMonth = remainingDt === 0 && tDt != null
  const noData = act.dt === 0 // chưa gán mã / endpoint chưa tải
  const noAov = act.aov === 0 || act.chot === 0 // SALE chưa tải → không bẻ ra đơn/data được

  // ── SP của tôi (đèn) + ⚡ việc hôm nay tự sinh từ số thật của chính mình ──
  const denRank = (d: string) => (d === 'Cắt' ? 0 : d === 'Sửa' ? 1 : d === 'Scale' ? 2 : 3)
  const denColor = (d: string) => (d === 'Cắt' ? C.red : d === 'Sửa' ? C.amber : d === 'Scale' ? C.green : C.muted)
  const myProfit = (view.sp_codes ?? [])
    .map((code) => { const key = code.trim().toUpperCase(); const prof = profit.find((p) => p.name.trim().toUpperCase() === key); const st = stats[key]; return prof && st ? { code: prof.name, prof, st, laiDon: st.aov * prof.laiPct } : null })
    .filter((x): x is { code: string; prof: SpProfit; st: SpStat; laiDon: number } => !!x)
    .sort((a, b) => denRank(a.prof.den) - denRank(b.prof.den) || b.prof.hoanPct - a.prof.hoanPct)
  const A = {
    spy: { app: 'spy-ads', label: '🔍 Mở Spy' }, script: { app: 'script-architect', label: '📝 Viết script' },
    video: { app: 'video-builder', label: '🎥 Làm video' }, ladi: { app: 'super-ladipage', label: '📄 Ladipage' },
    gia: { app: 'inventory-board', label: '🧮 Máy tính giá', tab: 'calc' }, qua: { app: 'inventory-board', label: '🎁 Ghép quà', tab: 'gift' },
  }
  type Sugg = { tone: string; tag: string; title: string; sub: string; apps: { app: string; label: string; tab?: string }[] }
  const suggestions: Sugg[] = []
  for (const { code, prof, laiDon } of myProfit) {
    const h = (prof.hoanPct * 100).toFixed(0)
    if (prof.den === 'Cắt') suggestions.push({ tone: C.red, tag: 'GẤP', title: `Cắt / sửa gấp ${code}`, sub: prof.hoanPct > 0.45 ? `hoàn ${h}% — ghép quà tăng giá trị / ép cọc, ĐỪNG đổ thêm ads` : `lỗ ${fmtMoney(laiDon)}/đơn — sửa giá·combo·ghép quà hoặc cắt`, apps: [A.gia, A.qua] })
    else if (prof.hoanPct > 0.45) suggestions.push({ tone: C.amber, tag: 'HOÀN', title: `Giảm hoàn ${code} ${h}%`, sub: `khách bom nặng — ghép quà·ép cọc để khách giữ đơn`, apps: [A.qua] })
    else if (prof.den === 'Scale') suggestions.push({ tone: C.green, tag: 'SCALE', title: `Đẩy mạnh ${code}`, sub: `lãi tốt, CPQC còn rẻ — tăng ads + ra thêm content`, apps: [A.video, A.spy, A.ladi] })
    else if (prof.den === 'Sửa') suggestions.push({ tone: C.amber, tag: 'SỬA', title: `Ghìm ${code}`, sub: `ads/hoàn hơi cao — ghìm CPQC, soi lại nhắm mục tiêu`, apps: [A.spy] })
  }
  const topSugg = suggestions.slice(0, 6)
  // ⚠ callout khi đang lỗ + 🧭 coaching theo nhịp
  const losing = !noData && act.lai < 0
  let coaching = ''
  if (!noData && tDt != null && !hitMonth && headPace) {
    if (headPace.tone === C.red) coaching = `Đang chậm nhịp — dồn sức kéo ${noAov ? 'thêm data' : `${Math.ceil(dataPerDay as number)} data`}/ngày, ưu tiên đẩy mã 🟢 Scale & cắt mã 🔴 lỗ để khỏi phí ads.`
    else if (headPace.tone === C.green) coaching = `Đang vượt nhịp — giữ phong độ, ghìm %hoàn để không tụt lãi.`
  }

  const myTasks = tasks.filter((t) => t.assignee_id === view.id)
  const todoCount = myTasks.filter((t) => t.status !== 'done').length

  const Big = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) => (
    <div style={{ flex: '1 1 150px', minWidth: 140, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 14px' }}>
      <div style={{ fontSize: 10.5, letterSpacing: 1, color: C.muted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: tone ?? C.gold, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted2, marginTop: 4 }}>{sub}</div>}
    </div>
  )

  const Bar = ({ label, actual, target, lowerBetter, money }: { label: string; actual: number; target: number | undefined; lowerBetter: boolean; money: boolean }) => {
    const has = target != null && !noData && !(label.includes('Hoàn') && act.hoan === 0)
    const ok = has ? (lowerBetter ? actual <= (target as number) : actual >= (target as number)) : null
    const pctRaw = target ? (lowerBetter ? (target as number) / Math.max(actual, 1e-9) : actual / (target as number)) : 0
    const pct = Math.max(0, Math.min(1, pctRaw)) * 100
    const show = (v: number) => (money ? fmtMoney(v) : fmtPct(v))
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
          <span style={{ color: C.muted2 }}>{label}</span>
          <span><b style={{ color: ok == null ? C.muted : ok ? C.green : C.red }}>{noData || (label.includes('Hoàn') && act.hoan === 0) ? '—' : show(actual)}</b><span style={{ color: C.muted }}> / {target != null ? show(target) : '—'}</span></span>
        </div>
        <div style={{ height: 6, background: C.line2, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: ok == null ? C.muted : ok ? C.green : C.red, borderRadius: 4 }} />
        </div>
      </div>
    )
  }

  return (
    <>
      {/* TOÀN ĐỘI — boss thấy mọi nhân viên 1 chỗ, bấm để mở chi tiết */}
      {isCEO && members.length > 0 && (
        <div style={panelStyle}>
          <div style={eyebrowStyle}>👥 TOÀN ĐỘI · {members.length} người — bấm 1 người để mở buồng lái chi tiết bên dưới</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Số tháng tới giờ so với target tháng · nhịp = đã đi {Math.round(monthProgress * 100)}% tháng.</div>
          {members.map((m) => {
            const a = aggregate(m.sp_codes ?? [], stats)
            const td = tgtOf(m.id, 'dt')
            const pb = paceBadge(a.dt, td, monthProgress)
            const sel = m.id === view.id
            return (
              <div key={m.id} onClick={() => setViewId(m.id)} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 8px', borderTop: `1px solid ${C.line2}`, flexWrap: 'wrap', cursor: 'pointer', background: sel ? 'rgba(245,196,81,0.07)' : 'transparent', borderRadius: 8 }}>
                <span style={{ fontWeight: 600, minWidth: 92, color: sel ? C.gold : C.text }}>{sel ? '👁 ' : ''}{m.name}</span>
                <span style={{ fontSize: 11.5, color: C.muted2, minWidth: 56 }}>{roleLabel(m.role)}</span>
                <span style={{ fontSize: 12.5, minWidth: 140 }}>DT <b>{a.dt > 0 ? fmtMoney(a.dt) : '—'}</b>{td ? <span style={{ color: C.muted }}> / {fmtMoney(td)}</span> : ''}</span>
                <span style={{ fontSize: 12, color: C.muted2, minWidth: 86 }}>CPQC {a.dt > 0 ? fmtPct(a.cpqc * 100) : '—'}</span>
                <span style={{ fontSize: 12, color: a.hoan > 0.45 ? C.red : C.muted2, minWidth: 78 }}>Hoàn {a.hoan > 0 ? fmtPct(a.hoan * 100) : '—'}</span>
                {pb ? <span style={{ marginLeft: 'auto', fontSize: 11.5, color: pb.tone, fontWeight: 600 }}>{pb.tone === C.red ? '⚠ ' : pb.tone === C.green ? '✓ ' : '● '}{pb.txt}</span> : <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted }}>chưa đặt target</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Chọn người (CEO) + tiêu đề */}
      <div style={{ ...panelStyle, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            Chào {view.name} 👋
            {headPace && <span style={{ fontSize: 11.5, fontWeight: 600, color: headPace.tone, border: `1px solid ${headPace.tone}`, borderRadius: 20, padding: '2px 10px' }}>{headPace.tone === C.red ? '⚠ ' : headPace.tone === C.green ? '✓ ' : '● '}{headPace.txt}</span>}
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>{roleLabel(view.role)} · còn <b style={{ color: C.amber }}>{daysLeft} ngày</b> trong tháng · phụ trách {(view.sp_codes ?? []).length} mã SP</div>
        </div>
        {isCEO && (
          <select value={view.id} onChange={(e) => setViewId(e.target.value)} title="CEO: chọn nhân viên để soi buồng lái của họ"
            style={{ ...inp, border: `1px solid ${C.gold}`, color: C.gold, fontWeight: 600 }}>
            {members.map((m) => <option key={m.id} value={m.id}>👁 {m.name} · {roleLabel(m.role)}</option>)}
          </select>
        )}
        <button onClick={() => void reloadStats()} title="tải lại số thực tế" style={{ background: 'transparent', color: C.muted2, border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 12px', fontSize: 12.5, cursor: 'pointer' }}>⟳ Tải lại</button>
      </div>
      {stale && <div style={{ marginTop: -6, marginBottom: 14, fontSize: 11.5, color: C.amber }}>● Đang hiện <b>số tốt gần nhất</b> (lần tải này bị Google chặn) — bấm ⟳ Tải lại để lấy số mới.</div>}

      {/* ⚠ CẢNH BÁO LỖ */}
      {losing && (
        <div style={{ ...panelStyle, borderColor: C.red, background: 'rgba(255,77,94,0.06)' }}>
          <div style={{ fontSize: 14, color: C.red, fontWeight: 700 }}>⚠ ĐANG LỖ {fmtMoney(act.lai)} tháng này</div>
          <div style={{ fontSize: 12.5, color: C.muted2, marginTop: 4, lineHeight: 1.6 }}>Việc số 1 hôm nay: <b style={{ color: C.text }}>ghìm CPQC</b> ({fmtPct(act.cpqc * 100)}{tCpqc != null ? ` / trần ${tCpqc}%` : ''}) · <b style={{ color: C.text }}>cắt mã đang lỗ</b> · <b style={{ color: C.text }}>giảm hoàn</b> ({fmtPct(act.hoan * 100)}). <b style={{ color: C.red }}>ĐỪNG</b> đổ thêm ads vào mã đang lỗ.</div>
        </div>
      )}

      {/* CON SỐ HÔM NAY */}
      <div style={{ ...panelStyle, borderColor: '#3a3414' }}>
        <div style={eyebrowStyle}>🔥 HÔM NAY PHẢI ĐẠT — để cán target tháng</div>
        {noData ? (
          <div style={{ fontSize: 13, color: C.amber, padding: '6px 0' }}>{view.name} chưa gán mã SP (hoặc số chưa tải) → CEO bấm 🪄 ở tab Nhân sự, rồi ⟳ Tải lại.</div>
        ) : tDt == null ? (
          <div style={{ fontSize: 13, color: C.muted2, padding: '6px 0' }}>Chưa có target doanh thu tháng. {isCEO ? 'Đặt ở tab 📊 Target.' : 'Báo CEO đặt ở tab Target.'}</div>
        ) : hitMonth ? (
          <div style={{ fontSize: 15, color: C.green, fontWeight: 600, padding: '6px 0' }}>🎉 Đã cán target doanh thu tháng! Giữ nhịp & ghìm hoàn.</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Big label="DOANH THU / NGÀY" value={fmtMoney(dtPerDay as number)} sub={`còn thiếu ${fmtMoney(remainingDt as number)}`} />
              <Big label="ĐƠN CẦN CHỐT / NGÀY" value={noAov ? '—' : String(Math.ceil(ordersPerDay as number))} sub={noAov ? 'cần tải SALE' : `AOV ${fmtMoney(act.aov)}`} tone={C.text} />
              <Big label="DATA CẦN RA / NGÀY" value={noAov ? '—' : String(Math.ceil(dataPerDay as number))} sub={noAov ? 'cần tải SALE' : `chốt ${fmtPct(act.chot * 100)}`} tone={C.text} />
              <Big label="NGÂN SÁCH ADS / NGÀY" value={fmtMoney(adsPerDay as number)} sub={`CPQC ${fmtPct(cpqcFrac * 100)}${tCpqc != null ? ' (trần)' : ''}`} tone={C.text} />
              <Big label="CPA MỤC TIÊU / DATA" value={noAov ? '—' : fmtMoney(cpaTarget as number)} sub="≤ giá này mới có lãi" tone={C.green} />
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.6 }}>
              Công thức: thiếu {fmtMoney(remainingDt as number)} ÷ {daysLeft} ngày = DT/ngày → ÷ AOV = đơn/ngày → ÷ chốt% = data/ngày. CPA mục tiêu = CPQC × AOV × chốt%. Care ads bám đúng <b style={{ color: C.green }}>CPA ≤ {noAov ? '—' : fmtMoney(cpaTarget as number)}</b>.
              {noAov && <span style={{ color: C.amber }}> · Đơn/data đang "—" vì file SALE chưa tải (Google chặn) → bấm ⟳ Tải lại vài lần.</span>}
            </div>
          </>
        )}
      </div>

      {/* 🧭 COACHING theo nhịp */}
      {coaching && <div style={{ ...panelStyle, padding: '10px 14px', fontSize: 12.5, color: headPace?.tone ?? C.muted2, lineHeight: 1.6 }}>🧭 {coaching}</div>}

      {/* 🚦 SP CỦA TÔI — đèn từng mã */}
      {myProfit.length > 0 && (
        <div style={panelStyle}>
          <div style={eyebrowStyle}>🚦 SP CỦA TÔI · {myProfit.length} mã — 🔴 cắt/sửa · 🟠 ghìm · 🟢 đẩy</div>
          {myProfit.map(({ code, prof, laiDon }) => (
            <div key={code} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${C.line2}`, flexWrap: 'wrap' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: denColor(prof.den), flexShrink: 0 }} />
              <span style={{ fontWeight: 600, flex: 1, minWidth: 130 }}>{code}</span>
              <span style={{ fontSize: 11.5, color: denColor(prof.den), border: `1px solid ${denColor(prof.den)}`, borderRadius: 20, padding: '1px 9px', minWidth: 42, textAlign: 'center' }}>{prof.den}</span>
              <span style={{ fontSize: 12, color: C.muted2, minWidth: 110 }}>lãi/đơn <b style={{ color: laiDon < 0 ? C.red : C.green }}>{fmtMoney(laiDon)}</b></span>
              <span style={{ fontSize: 12, color: C.muted2, minWidth: 84 }}>CPQC {fmtPct(prof.adsPct * 100)}</span>
              <span style={{ fontSize: 12, color: prof.hoanPct > 0.45 ? C.red : C.muted2, minWidth: 76 }}>hoàn {fmtPct(prof.hoanPct * 100)}</span>
            </div>
          ))}
        </div>
      )}

      {/* ⚡ VIỆC HÔM NAY tự sinh từ số của chính mình + nút mở công cụ */}
      {topSugg.length > 0 && (
        <div style={{ ...panelStyle, borderColor: '#3a3414' }}>
          <div style={eyebrowStyle}>⚡ VIỆC HÔM NAY — gợi ý từ số của bạn · {topSugg.length}</div>
          {topSugg.map((s, i) => (
            <div key={i} style={{ padding: '10px 0', borderTop: i ? `1px solid ${C.line2}` : 'none' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.tone, flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 180 }}>{s.title}</span>
                <span style={{ fontSize: 10.5, color: s.tone, border: `1px solid ${s.tone}`, borderRadius: 6, padding: '1px 7px' }}>{s.tag}</span>
              </div>
              <div style={{ fontSize: 12, color: C.muted2, margin: '4px 0 7px 15px' }}>{s.sub}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 15 }}>
                {s.apps.map((a) => <button key={a.label} onClick={() => { if (a.tab) { try { localStorage.setItem('inv_board_tab', a.tab) } catch { /* quota */ } } openApp(a.app) }} style={{ background: 'transparent', color: C.muted2, border: `1px solid ${C.line}`, borderRadius: 7, padding: '4px 10px', fontSize: 11.5, cursor: 'pointer' }}>{a.label} ↗</button>)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KPI THÁNG */}
      <div style={panelStyle}>
        <div style={eyebrowStyle}>📊 KPI THÁNG — thực tế / target</div>
        <Bar label="Doanh thu" actual={act.dt} target={tDt} lowerBetter={false} money />
        <Bar label="Lãi thật" actual={act.lai} target={tLai} lowerBetter={false} money />
        <Bar label="% CPQC" actual={act.cpqc * 100} target={tCpqc} lowerBetter money={false} />
        <Bar label="% Hoàn" actual={act.hoan * 100} target={tHoan} lowerBetter money={false} />
      </div>

      {/* VIỆC CỦA TÔI */}
      <div style={panelStyle}>
        <div style={eyebrowStyle}>✅ VIỆC CỦA {view.name.toUpperCase()} · {todoCount} cần làm</div>
        {myTasks.length === 0 && <div style={{ fontSize: 13, color: C.muted, padding: '4px 0' }}>Chưa có việc nào. Vào tab ✅ Việc để nhận gợi ý từ số thật.</div>}
        {myTasks.map((t) => (
          <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 0', borderTop: `1px solid ${C.line2}`, flexWrap: 'wrap' }}>
            <button onClick={() => void updateTask(t.id, { status: STATUS_NEXT[t.status] })} title="đổi trạng thái"
              style={{ background: 'transparent', color: statusColor(t.status), border: `1px solid ${statusColor(t.status)}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>{STATUS_LABEL[t.status]}</button>
            <span style={{ fontSize: 13, flex: 1, minWidth: 180, textDecoration: t.status === 'done' ? 'line-through' : 'none', color: t.status === 'done' ? C.muted : C.text }}>{t.title}</span>
            {t.type && <span style={{ fontSize: 11, color: C.muted2 }}>{TYPE_LABEL[t.type] ?? t.type}</span>}
            {t.due && <span style={{ fontSize: 11, color: C.amber }}>{t.due}</span>}
          </div>
        ))}
      </div>
    </>
  )
}

// ── NHÂN SỰ ──────────────────────────────────────────────────────────────────
// Người → TEAM (data giờ gộp theo 3 team APEX/TITAN/SUMMIT). Nhập tên người (DUY / HÀ + PHY)
// hoặc thẳng tên team đều khớp.
const TEAM_OF: Record<string, string> = {
  DUY: 'APEX', KHÁNH: 'APEX', KHANH: 'APEX',
  TUẤN: 'TITAN', TUAN: 'TITAN', ANH: 'TITAN',
  HÀ: 'SUMMIT', HA: 'SUMMIT', PHY: 'SUMMIT',
}
// khớp tên nhân sự với data team (vd "HÀ + PHY" → team 'SUMMIT'); nhập "SUMMIT" cũng khớp.
function spForMember(name: string, map: Record<string, string[]>): string[] {
  const tokens = name.toUpperCase().split(/[\s+,/]+/).filter(Boolean)
  const want = new Set<string>()
  for (const t of tokens) { want.add(t); if (TEAM_OF[t]) want.add(TEAM_OF[t]) }
  for (const [mk, codes] of Object.entries(map)) if (want.has(mk.toUpperCase())) return codes
  return []
}
// 2 ô mail cho 1 slot (vd HÀ + PHY chung team) — gộp lại bằng phẩy khi lưu
function EmailPair({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
  const split = (v: string) => { const p = (v || '').split(/[,;]/).map((s) => s.trim()); return [p[0] ?? '', p[1] ?? ''] }
  const [a, setA] = useState(split(value)[0]); const [b, setB] = useState(split(value)[1])
  useEffect(() => { const [x, y] = split(value); setA(x); setB(y) }, [value])
  const commit = () => onSave([a, b].map((s) => s.trim().toLowerCase()).filter(Boolean).join(','))
  const box: React.CSSProperties = { ...inp, fontSize: 12, minWidth: 150, flex: 1 }
  return (
    <>
      <input value={a} disabled={disabled} onChange={(e) => setA(e.target.value)} onBlur={commit} placeholder="mail người 1" style={box} />
      <input value={b} disabled={disabled} onChange={(e) => setB(e.target.value)} onBlur={commit} placeholder="mail người 2 (nếu chung team)" style={box} />
    </>
  )
}
function NhanSu({ members, isCEO, mktSp, addMember, updateMember, deleteMember }: {
  members: Member[]; isCEO: boolean; mktSp: Record<string, string[]>
  addMember: (m: Omit<Member, 'id'>) => Promise<void>; updateMember: (id: string, p: Partial<Member>) => Promise<void>; deleteMember: (id: string) => Promise<void>
}) {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [email2, setEmail2] = useState(''); const [role, setRole] = useState('marketer'); const [sp, setSp] = useState('')
  const add = () => {
    const mail = [email, email2].map((s) => s.trim().toLowerCase()).filter(Boolean).join(',')
    if (!name.trim() || !mail) return
    void addMember({ name: name.trim(), email: mail, role, sp_codes: sp.split(',').map((s) => s.trim()).filter(Boolean) })
    setName(''); setEmail(''); setEmail2(''); setSp('')
  }
  const autoAssign = async () => { for (const m of members.filter((x) => x.role === 'marketer')) { const codes = spForMember(m.name, mktSp); if (codes.length) await updateMember(m.id, { sp_codes: codes }) } }
  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={eyebrowStyle}>👥 NHÂN SỰ · {members.length} người</div>
        {isCEO && Object.keys(mktSp).length > 0 && <button onClick={() => void autoAssign()} style={{ background: 'rgba(245,196,81,0.1)', color: C.gold, border: '1px solid #4a4015', borderRadius: 8, padding: '7px 13px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>🪄 Tự gán mã SP từ data</button>}
      </div>
      <div style={{ fontSize: 12, color: C.muted, margin: '4px 0 12px' }}>Mỗi người 1 dòng. <b style={{ color: C.muted2 }}>1 slot chung team 2 người</b> (vd HÀ + PHY) thì điền <b style={{ color: C.muted2 }}>cả 2 ô mail</b> — ai đăng nhập bằng mail nào cũng vào đúng bảng này. Mã SP → bấm 🪄 để app tự điền từ file Ghép quà, hoặc gõ tay.</div>
      {members.map((m) => (
        <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${C.line2}`, flexWrap: 'wrap' }}>
          <input key={m.id} defaultValue={m.name} placeholder="Tên (KHÁNH / HÀ + PHY...)"
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== m.name) void updateMember(m.id, { name: v }) }}
            disabled={!isCEO} style={{ ...inp, fontWeight: 600, minWidth: 90, width: 130, fontSize: 13 }} />
          <span style={{ color: C.gold, border: `1px solid ${C.gold}`, borderRadius: 20, padding: '1px 9px', fontSize: 11 }}>{roleLabel(m.role)}</span>
          <EmailPair value={m.email} disabled={!isCEO} onSave={(v) => void updateMember(m.id, { email: v })} />
          <input defaultValue={(m.sp_codes ?? []).join(', ')} placeholder="mã SP phụ trách (phẩy)" onBlur={(e) => void updateMember(m.id, { sp_codes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            disabled={!isCEO} style={{ ...inp, flex: 1, minWidth: 180, fontSize: 12 }} />
          {isCEO && <button onClick={() => void deleteMember(m.id)} style={{ background: 'transparent', color: C.red, border: `1px solid ${C.line}`, borderRadius: 7, padding: '5px 9px', fontSize: 12, cursor: 'pointer' }}>Xoá</button>}
        </div>
      ))}
      {isCEO && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên (KHÁNH / HÀ + PHY...)" style={{ ...inp, width: 150 }} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mail người 1" style={{ ...inp, width: 175 }} />
          <input value={email2} onChange={(e) => setEmail2(e.target.value)} placeholder="mail người 2 (nếu chung team)" style={{ ...inp, width: 200 }} />
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
// ô nhập có DẤU CHẤM ngăn nghìn (300.000.000) cho dễ đọc; % thì để số trơn
function TargetInput({ value, money, disabled, onSave }: { value: number | undefined; money: boolean; disabled: boolean; onSave: (v: number) => void }) {
  const fmt = (n: number) => (money ? n.toLocaleString('vi-VN') : String(n))
  const [txt, setTxt] = useState(value != null ? fmt(value) : '')
  useEffect(() => { setTxt(value != null ? fmt(value) : '') }, [value, money])
  return (
    <input value={txt} disabled={disabled} placeholder="—" inputMode="numeric"
      onChange={(e) => { const d = e.target.value.replace(/[^\d]/g, ''); setTxt(d === '' ? '' : money ? parseInt(d, 10).toLocaleString('vi-VN') : d) }}
      onBlur={(e) => { const v = parseInt(e.target.value.replace(/[^\d]/g, ''), 10) || 0; if (e.target.value.trim() !== '' && v !== (value ?? -1)) void onSave(v) }}
      style={{ ...inp, width: money ? 150 : 90, textAlign: 'right', color: C.gold }} />
  )
}
function TargetTab({ members, targets, stats, isCEO, setTarget, reloadStats }: {
  members: Member[]; targets: { member_id: string; period: string; metric: string; value: number }[]
  stats: Record<string, SpStat>; isCEO: boolean; setTarget: (m: string, p: string, k: string, v: number) => Promise<void>; reloadStats: () => Promise<void>
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
        <button onClick={() => void reloadStats()} title="tải lại số thực tế (nếu %hoàn đang —)" style={{ marginLeft: 'auto', background: 'transparent', color: C.muted2, border: `1px solid ${C.line}`, borderRadius: 8, padding: '7px 12px', fontSize: 12.5, cursor: 'pointer' }}>⟳ Tải lại số</button>
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
            const missing = act.dt === 0 || (mt.key === 'hoan' && act.hoan === 0) // hoàn=0 = QLHB chưa tải, không phải thật
            const ok = tgt == null || missing ? null : mt.lowerBetter ? actual <= tgt : actual >= tgt
            const show = (v: number) => (mt.money ? fmtMoney(v) : fmtPct(v))
            return (
              <tr key={mt.key} style={{ borderTop: `1px solid ${C.line2}` }}>
                <td style={{ padding: '10px 0', color: C.muted2 }}>{mt.label}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                  <TargetInput value={tgt} money={mt.money} disabled={!isCEO} onSave={(v) => void setTarget(sel.id, period, mt.key, v)} />
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'right', color: missing ? C.muted : C.text }}>{missing ? '—' : show(actual)}</td>
                <td style={{ padding: '10px 0', textAlign: 'center' }}>{ok == null ? <span style={{ color: C.muted }}>—</span> : <span style={{ color: ok ? C.green : C.red }}>{ok ? '✓ đạt' : '✗ trượt'}</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
        Target {isCEO ? '— CEO gõ rồi rời ô là lưu' : '(chỉ CEO sửa)'}. THỰC TẾ = gộp số thật các mã marketer phụ trách (lũy kế tháng) — gán mã ở tab Nhân sự. %CPQC/%hoàn nhập theo số (vd 30 = 30%). Chi tiết ngày/tuần sẽ thêm sau.
        {act.dt === 0 && <span style={{ color: C.amber }}> · {sel.name} chưa gán mã SP → bấm 🪄 ở tab Nhân sự.</span>}
        {act.dt > 0 && act.hoan === 0 && <span style={{ color: C.amber }}> · %Hoàn đang "—" = QLHB chưa tải (Google chặn) → bấm ⟳ Tải lại số vài lần.</span>}
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
