// ── 🧪 PIPELINE TEST SP — kanban tìm winner: Ý tưởng → Content → Test ads → Kết luận ─
// Mỗi card = 1 SP đang test. Nút mở thẳng Spy / Kịch bản / Video / Ladipage.
// Dùng chung cả đội (Supabase test_products). Web = 4 cột; mobile = pill + list dọc.
import { useEffect, useMemo, useState } from 'react'
import { useWarStore, memberEmails, type TestProduct } from './store'
import { useAppStore } from '../../stores/appStore'

const C = {
  bg: '#070a12', panel: '#0c111c', panel2: '#0a0f19', line: '#1b2233', line2: '#161d2c',
  gold: '#f5c451', text: '#eef1f7', muted: '#74809a', muted2: '#aeb8cc',
  red: '#ff4d5e', amber: '#fbbf24', green: '#4ade80',
}
const inp: React.CSSProperties = { background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 8, padding: '8px 10px', fontSize: 13 }

const STAGES: { key: string; label: string; hint: string }[] = [
  { key: 'idea', label: '💡 Ý tưởng', hint: 'Spy ra SP · link · ngách' },
  { key: 'content', label: '🎬 Làm content', hint: 'Kịch bản · Video · Ladipage' },
  { key: 'ads', label: '🚀 Test ads', hint: 'Chạy ads · nhập số' },
  { key: 'done', label: '🏁 Kết luận', hint: 'WIN / GIỮ / KILL' },
]
const stageIdx = (s: string) => Math.max(0, STAGES.findIndex((x) => x.key === s))
const OUTCOMES: { key: string; label: string; color: string }[] = [
  { key: 'win', label: '🏆 WIN — scale', color: C.green },
  { key: 'keep', label: '🔁 Giữ — test tiếp', color: C.amber },
  { key: 'kill', label: '✂️ Kill — cắt', color: C.red },
]
const APP_LINKS: { app: string; label: string }[] = [
  { app: 'spy-ads', label: '🔍 Spy' },
  { app: 'script-architect', label: '📝 Kịch bản' },
  { app: 'video-builder', label: '🎥 Video' },
  { app: 'super-ladipage', label: '📄 Ladipage' },
]

// Gợi ý verdict từ số test ads (chỉ là gợi ý — người quyết)
function verdict(t: TestProduct): { txt: string; tone: string } | null {
  if (t.data == null && t.cpa == null && t.chot == null && t.hoan == null) return null
  if (t.hoan != null && t.hoan > 45) return { txt: 'Hoàn cao quá → nghiêng KILL / ép cọc', tone: C.red }
  if (t.data != null && t.data >= 40 && t.chot != null && t.chot < 8) return { txt: 'Nhiều data mà chốt thấp → KILL hoặc sửa offer', tone: C.red }
  if (t.chot != null && t.chot >= 10 && (t.hoan == null || t.hoan < 30) && t.data != null && t.data >= 20) return { txt: 'Số đẹp → nghiêng WIN, scale thử', tone: C.green }
  return { txt: 'Chưa đủ kết luận → gom thêm data', tone: C.amber }
}
// Cảnh báo theo DEADLINE (ngày hoàn thành nhân viên tự đặt) — CEO theo dõi trễ/đúng hạn.
function deadlineStatus(t: TestProduct): { txt: string; tone: string } | null {
  if (!t.deadline || t.outcome) return null // đã kết luận thì khỏi cảnh báo
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((new Date(t.deadline + 'T00:00:00').getTime() - today.getTime()) / 86400000)
  if (diff < 0) return { txt: `⚠ trễ ${-diff} ngày`, tone: C.red }
  if (diff === 0) return { txt: '⏰ hạn HÔM NAY', tone: C.amber }
  if (diff <= 2) return { txt: `⏰ còn ${diff} ngày`, tone: C.amber }
  return { txt: `📅 ${t.deadline.slice(5)}`, tone: C.muted2 }
}
// ô tiền có DẤU CHẤM ngăn nghìn (3.000.000) cho dễ đọc
const fmtThousands = (s: string) => { const d = s.replace(/[^\d]/g, ''); return d === '' ? '' : parseInt(d, 10).toLocaleString('vi-VN') }
const parseThousands = (s: string): number | null => { const d = s.replace(/[^\d]/g, ''); return d === '' ? null : parseInt(d, 10) }
// deadline mặc định = hôm nay + N ngày (ISO yyyy-mm-dd) cho ô thêm SP
const plusDaysISO = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function MoneyInput({ value, onSave, placeholder, style }: { value: number | null; onSave: (v: number | null) => void; placeholder?: string; style: React.CSSProperties }) {
  const [txt, setTxt] = useState(value != null ? value.toLocaleString('vi-VN') : '')
  useEffect(() => { setTxt(value != null ? value.toLocaleString('vi-VN') : '') }, [value])
  return <input value={txt} inputMode="numeric" placeholder={placeholder} onChange={(e) => setTxt(fmtThousands(e.target.value))} onBlur={() => onSave(parseThousands(txt))} style={style} />
}
const fmtMoney = (n: number) => Math.round(n).toLocaleString('vi-VN') + 'đ'
// Tổng kết 1 nhóm SP test: ngân sách dự kiến vs đã chi (data×CPA) + kết quả + ROI.
function summarize(list: TestProduct[]) {
  const planned = list.reduce((s, t) => s + (t.budget ?? 0), 0)
  const spent = list.reduce((s, t) => s + (t.data ?? 0) * (t.cpa ?? 0), 0) // tiền ads đã đốt ≈ data × CPA
  const win = list.filter((t) => t.outcome === 'win').length
  const keep = list.filter((t) => t.outcome === 'keep').length
  const kill = list.filter((t) => t.outcome === 'kill').length
  const running = list.filter((t) => !t.outcome).length
  return { count: list.length, planned, spent, win, keep, kill, running, over: planned > 0 && spent > planned }
}

export default function TestPipeline({ isCEO, userEmail }: { isCEO: boolean; userEmail: string }) {
  const { members, tests, error, addTest, updateTest, deleteTest } = useWarStore()
  const openApp = useAppStore((s) => s.openApp)
  const [mob, setMob] = useState(false)
  const [activeStage, setActiveStage] = useState('idea')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [name, setName] = useState(''); const [niche, setNiche] = useState(''); const [owner, setOwner] = useState(''); const [spy, setSpy] = useState('')
  const [deadline, setDeadline] = useState(plusDaysISO(3)); const [budget, setBudget] = useState('') // deadline mặc định 3 ngày
  useEffect(() => { const f = () => setMob(window.innerWidth < 760); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])

  const myMember = members.find((m) => memberEmails(m).includes(userEmail.trim().toLowerCase()))
  const myId = myMember?.id ?? null
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.name ?? '—'
  // Nhân viên CHỈ thấy SP test của CHÍNH MÌNH; CEO thấy hết (+ lọc theo người).
  const filtered = useMemo(() => {
    if (!isCEO) return tests.filter((t) => t.owner_id === myId)
    return ownerFilter === 'all' ? tests : tests.filter((t) => t.owner_id === ownerFilter)
  }, [tests, ownerFilter, isCEO, myId])
  const byStage = (st: string) => filtered.filter((t) => t.stage === st)
  const overdue = useMemo(() => filtered.filter((t) => { const d = deadlineStatus(t); return !!d && d.tone === C.red }).length, [filtered])

  // ── Tổng kết THÁNG: CEO soi cả đội (chi/ROI), nhân viên thấy của mình ──
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthTests = useMemo(() => tests.filter((t) => (t.created_at ?? '').slice(0, 7) === month), [tests, month])
  const mySum = summarize(isCEO ? monthTests : monthTests.filter((t) => t.owner_id === myId))
  const byMkt = useMemo(() => {
    if (!isCEO) return []
    const map: Record<string, TestProduct[]> = {}
    for (const t of monthTests) { const k = t.owner_id ?? 'none'; (map[k] ??= []).push(t) }
    return Object.entries(map).map(([oid, list]) => ({ oid, name: oid === 'none' ? '— chưa giao —' : nameOf(oid), ...summarize(list) })).sort((a, b) => b.spent - a.spent)
  }, [monthTests, isCEO]) // eslint-disable-line react-hooks/exhaustive-deps

  const add = () => {
    if (!name.trim()) return
    const ownerId = isCEO ? (owner || null) : myId // nhân viên TỰ sở hữu SP test, không giao ai khác
    void addTest({ name: name.trim(), niche: niche.trim() || null, stage: 'idea', outcome: null, owner_id: ownerId, spy_link: spy.trim() || null, note: null, data: null, cpa: null, chot: null, hoan: null, deadline: deadline || null, budget: parseThousands(budget), created_by: userEmail })
    setName(''); setNiche(''); setSpy(''); setDeadline(plusDaysISO(3)); setBudget('')
  }

  const Card = ({ t }: { t: TestProduct }) => {
    const idx = stageIdx(t.stage)
    const v = t.stage === 'ads' || t.stage === 'done' ? verdict(t) : null
    return (
      <div style={{ background: C.panel2, border: `1px solid ${t.outcome ? OUTCOMES.find((o) => o.key === t.outcome)?.color ?? C.line : C.line}`, borderRadius: 11, padding: '11px 12px', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              {t.name}
              {(() => { const ds = deadlineStatus(t); return ds ? <span style={{ fontSize: 10, fontWeight: 600, color: ds.tone, border: `1px solid ${ds.tone}`, borderRadius: 6, padding: '1px 6px' }}>{ds.txt}</span> : null })()}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{t.niche || 'chưa rõ ngách'} · {nameOf(t.owner_id)}{t.budget ? ` · 💰 ${Math.round(t.budget).toLocaleString('vi-VN')}đ` : ''}</div>
          </div>
          <button onClick={() => void deleteTest(t.id)} title="xoá" style={{ background: 'transparent', color: C.muted, border: 'none', fontSize: 14, cursor: 'pointer' }}>✕</button>
        </div>

        {/* deadline (hạn hoàn thành) + ngân sách test — sửa được để CEO theo dõi */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <input type="date" value={t.deadline ?? ''} onChange={(e) => void updateTest(t.id, { deadline: e.target.value || null })} title="hạn hoàn thành" style={{ ...inp, fontSize: 11, padding: '5px 7px' }} />
          <MoneyInput value={t.budget} placeholder="ngân sách đ" onSave={(v) => { if (v !== (t.budget ?? null)) void updateTest(t.id, { budget: v }) }} style={{ ...inp, fontSize: 11, padding: '5px 7px', width: 110 }} />
        </div>

        {/* người phụ trách (CEO đổi được; nhân viên khoá vào mình) + link spy */}
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          {isCEO ? (
            <select value={t.owner_id ?? ''} onChange={(e) => void updateTest(t.id, { owner_id: e.target.value || null })} style={{ ...inp, fontSize: 11, padding: '5px 7px', flex: 1, minWidth: 110 }}>
              <option value="">— giao ai —</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          ) : (
            <span style={{ ...inp, fontSize: 11, padding: '5px 9px', color: C.muted2, flex: 1, minWidth: 110 }}>👤 {nameOf(t.owner_id)}</span>
          )}
          {t.spy_link
            ? <a href={t.spy_link} target="_blank" rel="noreferrer" style={{ ...inp, fontSize: 11, padding: '5px 9px', color: C.gold, textDecoration: 'none' }}>↗ link</a>
            : null}
        </div>

        {/* Test ads: nhập số */}
        {t.stage === 'ads' && (
          <div style={{ marginTop: 9 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([['data', 'Data', ''], ['cpa', 'CPA(đ)', ''], ['chot', 'Chốt%', ''], ['hoan', 'Hoàn%', '']] as const).map(([k, lbl]) => (
                <input key={k} defaultValue={t[k] ?? ''} placeholder={lbl} inputMode="numeric"
                  onBlur={(e) => { const raw = e.target.value.replace(/[^\d.]/g, ''); const val = raw === '' ? null : parseFloat(raw); if (val !== (t[k] ?? null)) void updateTest(t.id, { [k]: val } as Partial<TestProduct>) }}
                  style={{ ...inp, fontSize: 11, padding: '6px 7px', width: 64, textAlign: 'right' }} />
              ))}
            </div>
            {v && <div style={{ fontSize: 11, color: v.tone, marginTop: 6 }}>⮕ {v.txt}</div>}
          </div>
        )}

        {/* Kết luận: chọn outcome */}
        {t.stage === 'done' && (
          <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
            {OUTCOMES.map((o) => (
              <button key={o.key} onClick={() => void updateTest(t.id, { outcome: o.key })}
                style={{ background: t.outcome === o.key ? o.color : 'transparent', color: t.outcome === o.key ? '#0a0a0a' : o.color, border: `1px solid ${o.color}`, borderRadius: 7, padding: '4px 9px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{o.label}</button>
            ))}
          </div>
        )}

        {/* nút mở app theo bước */}
        <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
          {APP_LINKS.map((a) => (
            <button key={a.app} onClick={() => openApp(a.app)} style={{ background: 'transparent', color: C.muted2, border: `1px solid ${C.line}`, borderRadius: 7, padding: '4px 9px', fontSize: 11, cursor: 'pointer' }}>{a.label}</button>
          ))}
        </div>

        {/* chuyển bước */}
        <div style={{ display: 'flex', gap: 6, marginTop: 9, alignItems: 'center' }}>
          <button disabled={idx === 0} onClick={() => void updateTest(t.id, { stage: STAGES[idx - 1].key, outcome: null })}
            style={{ background: 'transparent', color: idx === 0 ? C.line : C.muted2, border: `1px solid ${C.line}`, borderRadius: 7, padding: '5px 10px', fontSize: 12, cursor: idx === 0 ? 'default' : 'pointer' }}>← Lùi</button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: 10.5, color: C.muted }}>{STAGES[idx].label.replace(/^.. /, '')}</span>
          <button disabled={idx === STAGES.length - 1} onClick={() => void updateTest(t.id, { stage: STAGES[idx + 1].key })}
            style={{ background: idx === STAGES.length - 1 ? 'transparent' : 'rgba(245,196,81,0.12)', color: idx === STAGES.length - 1 ? C.line : C.gold, border: `1px solid ${idx === STAGES.length - 1 ? C.line : '#4a4015'}`, borderRadius: 7, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: idx === STAGES.length - 1 ? 'default' : 'pointer' }}>Tiến →</button>
        </div>
      </div>
    )
  }

  const Column = ({ st }: { st: { key: string; label: string; hint: string } }) => {
    const cards = byStage(st.key)
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>{st.label}</span>
          <span style={{ fontSize: 11, color: C.muted }}>· {cards.length}</span>
        </div>
        <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 10 }}>{st.hint}</div>
        {cards.length === 0 && <div style={{ fontSize: 12, color: C.muted, padding: '6px 0', opacity: 0.6 }}>— trống —</div>}
        {cards.map((t) => <Card key={t.id} t={t} />)}
      </div>
    )
  }

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 6 }}>🧪 PIPELINE TEST SP — săn winner</div>
      <div style={{ fontSize: 12, color: C.muted2, marginBottom: 12, lineHeight: 1.6 }}>
        Mỗi thẻ là 1 SP đang test, kéo qua 4 bước. Đặt <b style={{ color: C.text }}>deadline</b> + <b style={{ color: C.text }}>ngân sách</b> để CEO theo dõi đúng hạn. Bước <b style={{ color: C.text }}>Test ads</b> nhập data/CPA/chốt/hoàn → app gợi ý WIN hay KILL.
      </div>

      {error && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.red}`, background: 'rgba(255,77,94,0.07)', fontSize: 12.5, color: C.red }}>⚠ Lỗi lưu: {error}. {/relation|does not exist|column/i.test(error) ? 'Bảng test_products chưa tạo / thiếu cột — CEO chạy SQL (kèm trong chat).' : 'Thử lại; nếu vẫn lỗi báo CEO.'}</div>}
      {overdue > 0 && <div style={{ marginBottom: 12, padding: '9px 12px', borderRadius: 8, border: `1px solid #4a1d22`, background: 'rgba(255,77,94,0.05)', fontSize: 12.5, color: C.red }}>⚠ <b>{overdue}</b> SP test TRỄ deadline — cần xử lý / dời hạn.</div>}

      {/* 📊 TỔNG KẾT THÁNG — chi phí test + ROI (CEO soi cả đội; nhân viên thấy của mình) */}
      <div style={{ marginBottom: 14, padding: '14px 16px', borderRadius: 12, border: `1px solid ${C.line}`, background: C.panel2 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.gold, marginBottom: 10 }}>📊 TỔNG KẾT TEST SP · THÁNG {month.slice(5)}/{month.slice(0, 4)} {isCEO ? '— cả đội' : '— của bạn'}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { l: 'ĐÃ CHI TEST', v: fmtMoney(mySum.spent), tone: C.amber, sub: `dự kiến ${fmtMoney(mySum.planned)}` },
            { l: 'WINNER', v: String(mySum.win), tone: C.green, sub: `${mySum.kill} kill · ${mySum.running} đang` },
            { l: 'ĐỐT / 1 WINNER', v: mySum.win > 0 ? fmtMoney(mySum.spent / mySum.win) : '—', tone: C.text, sub: 'ROI test (càng thấp càng ngon)' },
            { l: 'SP TEST THÁNG', v: String(mySum.count), tone: C.text, sub: `${mySum.win} win · ${mySum.keep} giữ` },
          ].map((s) => (
            <div key={s.l} style={{ flex: '1 1 140px', minWidth: 120, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, letterSpacing: 1, color: C.muted, marginBottom: 5 }}>{s.l}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: s.tone }}>{s.v}</div>
              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>{s.sub}</div>
            </div>
          ))}
        </div>
        {isCEO && byMkt.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginTop: 12 }}>
            <thead><tr style={{ color: C.muted, fontSize: 10, letterSpacing: 1 }}>
              <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 400 }}>MARKETER</th>
              <th style={{ textAlign: 'center', fontWeight: 400 }}>SP</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 400 }}>NS DỰ KIẾN</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 400 }}>ĐÃ CHI</th>
              <th style={{ textAlign: 'center', fontWeight: 400 }}>W / G / K</th>
              <th style={{ textAlign: 'center', fontWeight: 400 }}>ĐANG</th>
            </tr></thead>
            <tbody>
              {byMkt.map((r) => (
                <tr key={r.oid} style={{ borderTop: `1px solid ${C.line2}` }}>
                  <td style={{ padding: '8px 0', fontWeight: 600 }}>{r.name}</td>
                  <td style={{ textAlign: 'center', color: C.muted2 }}>{r.count}</td>
                  <td style={{ textAlign: 'right', padding: '8px', color: C.muted2 }}>{fmtMoney(r.planned)}</td>
                  <td style={{ textAlign: 'right', padding: '8px', color: r.over ? C.red : C.text, fontWeight: 600 }}>{fmtMoney(r.spent)}{r.over ? ' ⚠' : ''}</td>
                  <td style={{ textAlign: 'center', color: C.muted2 }}>{r.win}/{r.keep}/{r.kill}</td>
                  <td style={{ textAlign: 'center', color: C.muted2 }}>{r.running}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {isCEO && byMkt.some((r) => r.over) && <div style={{ fontSize: 11, color: C.red, marginTop: 8 }}>⚠ MKT có dấu ⚠ = đã chi (≈ data×CPA) vượt ngân sách dự kiến → soi lại.</div>}
        {mySum.count === 0 && <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Chưa có SP test tháng này. Thêm bên dưới.</div>}
      </div>

      {/* thêm SP + lọc người */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.line2}` }}>
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} placeholder="Tên SP test..." style={{ ...inp, width: 150 }} />
        <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="ngách" style={{ ...inp, width: 110 }} />
        {isCEO && <select value={owner} onChange={(e) => setOwner(e.target.value)} style={{ ...inp, fontSize: 12 }}><option value="">— giao ai —</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>}
        <input value={spy} onChange={(e) => setSpy(e.target.value)} placeholder="link spy (tuỳ chọn)" style={{ ...inp, flex: 1, minWidth: 130 }} />
        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} title="hạn hoàn thành (deadline)" style={{ ...inp, fontSize: 12, width: 150 }} />
        <input value={budget} onChange={(e) => setBudget(fmtThousands(e.target.value))} inputMode="numeric" placeholder="ngân sách test (đ)" style={{ ...inp, width: 150 }} />
        <button onClick={add} style={{ background: C.gold, color: '#1a1405', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Thêm SP</button>
        {isCEO && (
          <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} style={{ ...inp, fontSize: 12 }}>
            <option value="all">Lọc: tất cả</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
      </div>

      {!isCEO && <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>🔒 Đây là SP test của <b style={{ color: C.muted2 }}>{myMember?.name ?? 'bạn'}</b> — chỉ bạn thấy & quản, CEO theo dõi cùng. Bạn không giao/soi được SP của người khác.</div>}

      {mob ? (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {STAGES.map((s) => (
              <button key={s.key} onClick={() => setActiveStage(s.key)} style={{ background: activeStage === s.key ? C.gold : 'transparent', color: activeStage === s.key ? '#0a0a0a' : C.muted2, border: `1px solid ${activeStage === s.key ? C.gold : C.line}`, borderRadius: 9, padding: '7px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{s.label} · {byStage(s.key).length}</button>
            ))}
          </div>
          <Column st={STAGES.find((s) => s.key === activeStage) ?? STAGES[0]} />
        </>
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {STAGES.map((s) => <Column key={s.key} st={s} />)}
        </div>
      )}
    </div>
  )
}
