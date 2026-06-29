// ── 📒 NHẬT KÝ NGÀY — kế hoạch sáng (checklist) + báo cáo tối (số nhập tay) ──────
// Nhân viên: tự điền/tick + khoá kế hoạch sáng + gửi báo cáo tối (thẻ gọn để chụp Zalo).
// CEO: 1 màn gom CẢ ĐỘI theo ngày (ai gửi sáng/tối, % việc, số) + soi từng người.
import { useEffect, useState } from 'react'
import { useWarStore, memberEmails, type Member, type PlanItem } from './store'
import type { SpProfit } from './actuals'

const C = {
  bg: '#070a12', panel: '#0c111c', panel2: '#0a0f19', line: '#1b2233', line2: '#161d2c',
  gold: '#f5c451', text: '#eef1f7', muted: '#74809a', muted2: '#aeb8cc',
  red: '#ff4d5e', amber: '#fbbf24', green: '#4ade80',
}
const inp: React.CSSProperties = { background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 8, padding: '8px 10px', fontSize: 13 }
const panelStyle: React.CSSProperties = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 18px', marginBottom: 14 }
const eyebrow: React.CSSProperties = { fontSize: 13, fontWeight: 700, letterSpacing: 0.3, color: C.gold, marginBottom: 10 }
const fmtInt = (n: number) => Math.round(n).toLocaleString('vi-VN')
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const hhmm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '')
const nowISO = () => new Date().toISOString()
const fmtMoney = (n: number) => Math.round(n).toLocaleString('vi-VN') + 'đ'
const cpaOf = (data: number | null | undefined, ads: number | null | undefined) => (data && ads ? ads / data : null) // CPA = chi ads ÷ data
// ô tiền có dấu chấm (3.333.333) — gõ tới đâu format tới đó, lưu số nguyên khi rời ô
function MoneyField({ value, disabled, onSave, style }: { value: number | null | undefined; disabled?: boolean; onSave: (v: number | null) => void; style: React.CSSProperties }) {
  const [txt, setTxt] = useState(value != null ? value.toLocaleString('vi-VN') : '')
  useEffect(() => { setTxt(value != null ? value.toLocaleString('vi-VN') : '') }, [value])
  return <input disabled={disabled} value={txt} inputMode="numeric" placeholder="—"
    onChange={(e) => { const d = e.target.value.replace(/[^\d]/g, ''); setTxt(d === '' ? '' : parseInt(d, 10).toLocaleString('vi-VN')) }}
    onBlur={() => { const d = txt.replace(/[^\d]/g, ''); onSave(d === '' ? null : parseInt(d, 10)) }} style={style} />
}

// gom việc gợi ý cho 1 người: ⚡ từ số (cắt/đẩy/giảm hoàn) + việc được giao + SP test tới hạn
function buildTodos(view: Member, profit: SpProfit[], tasks: ReturnType<typeof useWarStore.getState>['tasks'], tests: ReturnType<typeof useWarStore.getState>['tests']): PlanItem[] {
  const out: PlanItem[] = []
  const codes = new Set((view.sp_codes ?? []).map((c) => c.trim().toUpperCase()))
  for (const p of profit) {
    if (!codes.has(p.name.trim().toUpperCase())) continue
    const h = (p.hoanPct * 100).toFixed(0)
    if (p.den === 'Cắt') out.push({ id: `p-${p.name}`, text: `🔴 Cắt/sửa gấp ${p.name} (hoàn ${h}%)`, done: false })
    else if (p.hoanPct > 0.45) out.push({ id: `p-${p.name}`, text: `🟠 Giảm hoàn ${p.name} ${h}%`, done: false })
    else if (p.den === 'Scale') out.push({ id: `p-${p.name}`, text: `🟢 Đẩy mạnh ${p.name}`, done: false })
  }
  for (const t of tasks) if (t.assignee_id === view.id && t.status !== 'done') out.push({ id: `t-${t.id}`, text: `📌 ${t.title}`, done: false })
  const today = todayISO()
  for (const ts of tests) if (ts.owner_id === view.id && ts.deadline && ts.deadline <= today && !ts.outcome) out.push({ id: `ts-${ts.id}`, text: `🧪 Test ${ts.name} — tới hạn ${ts.deadline.slice(5)}`, done: false })
  return out
}

export default function DailyLog({ isCEO, userEmail, profit }: { isCEO: boolean; userEmail: string; profit: SpProfit[] }) {
  const { members, dailyLogs, tasks, tests, error, saveDailyLog } = useWarStore()
  const [date, setDate] = useState(todayISO())
  const [viewId, setViewId] = useState('')
  const [manual, setManual] = useState('')

  const myMember = members.find((m) => memberEmails(m).includes(userEmail.trim().toLowerCase()))
  const logOf = (memberId: string | undefined, d: string) => (memberId ? dailyLogs.find((l) => l.member_id === memberId && l.log_date === d) : undefined)

  // CEO: mặc định xem toàn đội; chọn 1 người để soi. Nhân viên: khoá vào chính mình.
  const view = isCEO ? (members.find((m) => m.id === viewId) ?? null) : myMember
  const isToday = date === todayISO()
  const canEdit = !!myMember && view?.id === myMember.id && isToday && !isCEO

  if (!isCEO && !myMember) {
    return <div style={{ ...panelStyle, textAlign: 'center', color: C.muted2 }}>Email <b style={{ color: C.text }}>{userEmail}</b> chưa được thêm vào đội — báo CEO thêm ở tab Nhân sự.</div>
  }

  const log = logOf(view?.id, date)
  const items = log?.plan_items ?? []
  const doneCount = items.filter((i) => i.done).length

  const save = (patch: Parameters<typeof saveDailyLog>[2]) => { if (view) void saveDailyLog(view.id, date, patch) }
  const pullTodos = () => {
    if (!view) return
    const ex = items
    const exIds = new Set(ex.map((i) => i.id))
    const merged = [...ex, ...buildTodos(view, profit, tasks, tests).filter((i) => !exIds.has(i.id))]
    save({ plan_items: merged })
  }
  const toggle = (id: string) => save({ plan_items: items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)) })
  const removeItem = (id: string) => save({ plan_items: items.filter((i) => i.id !== id) })
  const addManual = () => { if (!manual.trim()) return; save({ plan_items: [...items, { id: `m-${Date.now()}`, text: manual.trim(), done: false }] }); setManual('') }

  return (
    <>
      {error && <div style={{ ...panelStyle, borderColor: C.red, background: 'rgba(255,77,94,0.07)', fontSize: 12.5, color: C.red }}>⚠ Lỗi lưu: {error}. {/relation|does not exist|column|constraint/i.test(error) ? 'Bảng daily_logs chưa tạo — CEO chạy SQL (kèm trong chat) rồi tải lại.' : 'Thử lại; nếu vẫn lỗi báo CEO.'}</div>}

      {/* chọn ngày + (CEO) chọn người */}
      <div style={{ ...panelStyle, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>📒 Nhật ký ngày {isToday ? '· HÔM NAY' : ''}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{isCEO ? 'Gom cả đội theo ngày — bấm 1 người để soi chi tiết.' : `${myMember?.name} · đầu ngày chốt kế hoạch, cuối ngày gửi báo cáo.`}</div>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} style={{ ...inp, fontSize: 12 }} />
        {isCEO && (
          <select value={viewId} onChange={(e) => setViewId(e.target.value)} style={{ ...inp, border: `1px solid ${C.gold}`, color: C.gold, fontWeight: 600 }}>
            <option value="">👥 Toàn đội</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
      </div>

      {/* ── CEO + chưa chọn người: BẢNG TOÀN ĐỘI theo ngày ── */}
      {isCEO && !view && (
        <div style={panelStyle}>
          <div style={eyebrow}>👥 TOÀN ĐỘI · {date.slice(5)} — ai đã gửi kế hoạch sáng / báo cáo tối</div>
          {members.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>Chưa có nhân sự.</div>}
          {members.map((m) => {
            const l = logOf(m.id, date)
            const dc = l ? l.plan_items.filter((i) => i.done).length : 0
            const tot = l ? l.plan_items.length : 0
            return (
              <div key={m.id} onClick={() => setViewId(m.id)} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 8px', borderTop: `1px solid ${C.line2}`, flexWrap: 'wrap', cursor: 'pointer', borderRadius: 8 }}>
                <span style={{ fontWeight: 600, minWidth: 92 }}>{m.name}</span>
                <span style={{ fontSize: 12, minWidth: 120, color: l?.plan_locked_at ? C.green : C.muted }}>{l?.plan_locked_at ? `🟢 sáng ${hhmm(l.plan_locked_at)}` : '⚪ chưa gửi sáng'}</span>
                <span style={{ fontSize: 12, minWidth: 120, color: l?.reported_at ? C.green : C.muted }}>{l?.reported_at ? `🟢 tối ${hhmm(l.reported_at)}` : '⚪ chưa báo cáo'}</span>
                <span style={{ fontSize: 12, color: C.muted2, minWidth: 80 }}>việc {tot ? `${dc}/${tot}` : '—'}</span>
                <span style={{ fontSize: 12, color: C.muted2 }}>data {l?.data_keo ?? '—'} · ads {l?.chi_ads != null ? fmtInt(l.chi_ads) + 'đ' : '—'} · CPA {cpaOf(l?.data_keo, l?.chi_ads) != null ? fmtMoney(cpaOf(l?.data_keo, l?.chi_ads) as number) : '—'}</span>
                {l?.blocker ? <span style={{ marginLeft: 'auto', fontSize: 11.5, color: C.amber }}>⚠ {l.blocker.slice(0, 40)}</span> : null}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Chi tiết 1 người (nhân viên = của mình; CEO = người đã chọn) ── */}
      {view && (
        <>
          {/* thẻ tóm tắt để CHỤP */}
          <div style={{ ...panelStyle, borderColor: '#3a3414' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{view.name} · {date.slice(5)}</div>
            <div style={{ fontSize: 12.5, color: C.muted2, marginTop: 4, lineHeight: 1.7 }}>
              {log?.plan_locked_at ? <span style={{ color: C.green }}>🟢 Chốt kế hoạch sáng {hhmm(log.plan_locked_at)}</span> : <span style={{ color: C.muted }}>⚪ Chưa chốt kế hoạch sáng</span>}
              {' · '}
              {log?.reported_at ? <span style={{ color: C.green }}>🟢 Báo cáo tối {hhmm(log.reported_at)}</span> : <span style={{ color: C.muted }}>⚪ Chưa báo cáo tối</span>}
              {items.length > 0 && <> · việc <b style={{ color: C.text }}>{doneCount}/{items.length}</b></>}
            </div>
            {log?.reported_at && (
              <div style={{ fontSize: 12.5, color: C.muted2, marginTop: 4 }}>📊 data <b style={{ color: C.text }}>{log.data_keo ?? '—'}</b> · chi ads <b style={{ color: C.text }}>{log.chi_ads != null ? fmtInt(log.chi_ads) + 'đ' : '—'}</b> · CPA <b style={{ color: C.green }}>{cpaOf(log.data_keo, log.chi_ads) != null ? fmtMoney(cpaOf(log.data_keo, log.chi_ads) as number) : '—'}</b>{log.blocker ? <> · ⚠ {log.blocker}</> : null}</div>
            )}
          </div>

          {/* ① KẾ HOẠCH SÁNG */}
          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={eyebrow}>① KẾ HOẠCH SÁNG · {items.length} việc</div>
              {canEdit && <button onClick={pullTodos} style={{ background: 'rgba(245,196,81,0.1)', color: C.gold, border: '1px solid #4a4015', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>⚡ Lấy việc hôm nay</button>}
            </div>
            {items.length === 0 && <div style={{ fontSize: 12.5, color: C.muted, padding: '4px 0' }}>{canEdit ? 'Bấm ⚡ Lấy việc hôm nay để app gợi ý từ số, hoặc thêm tay bên dưới.' : 'Chưa có kế hoạch.'}</div>}
            {items.map((i) => (
              <div key={i.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderTop: `1px solid ${C.line2}` }}>
                <button disabled={!canEdit} onClick={() => toggle(i.id)} style={{ width: 20, height: 20, borderRadius: 5, border: `1px solid ${i.done ? C.green : C.line}`, background: i.done ? C.green : 'transparent', color: '#0a0a0a', fontSize: 13, cursor: canEdit ? 'pointer' : 'default', flexShrink: 0 }}>{i.done ? '✓' : ''}</button>
                <span style={{ fontSize: 13, flex: 1, textDecoration: i.done ? 'line-through' : 'none', color: i.done ? C.muted : C.text }}>{i.text}</span>
                {canEdit && <button onClick={() => removeItem(i.id)} style={{ background: 'transparent', color: C.muted, border: 'none', fontSize: 13, cursor: 'pointer' }}>✕</button>}
              </div>
            ))}
            {canEdit && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={manual} onChange={(e) => setManual(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addManual() }} placeholder="+ thêm việc tay..." style={{ ...inp, flex: 1, minWidth: 180 }} />
                <button onClick={addManual} style={{ background: 'transparent', color: C.muted2, border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>Thêm</button>
                <button onClick={() => save({ plan_locked_at: nowISO() })} style={{ background: C.gold, color: '#1a1405', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🔒 {log?.plan_locked_at ? 'Cập nhật' : 'Khoá'} kế hoạch sáng</button>
              </div>
            )}
          </div>

          {/* ② BÁO CÁO TỐI */}
          <div style={panelStyle}>
            <div style={eyebrow}>② BÁO CÁO TỐI — số thực tế hôm nay (nhập tay)</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 150px', minWidth: 130 }}>
                <div style={{ fontSize: 10.5, letterSpacing: 1, color: C.muted, marginBottom: 5 }}>DATA ĐÃ KÉO</div>
                <input disabled={!canEdit} defaultValue={log?.data_keo ?? ''} inputMode="numeric" placeholder="—"
                  onBlur={(e) => { const raw = e.target.value.replace(/[^\d]/g, ''); const v = raw === '' ? null : parseInt(raw, 10); if (v !== (log?.data_keo ?? null)) save({ data_keo: v }) }}
                  style={{ ...inp, width: '100%', fontSize: 16, fontWeight: 600 }} />
              </div>
              <div style={{ flex: '1 1 150px', minWidth: 130 }}>
                <div style={{ fontSize: 10.5, letterSpacing: 1, color: C.muted, marginBottom: 5 }}>CHI ADS (đ)</div>
                <MoneyField value={log?.chi_ads} disabled={!canEdit} onSave={(v) => { if (v !== (log?.chi_ads ?? null)) save({ chi_ads: v }) }} style={{ ...inp, width: '100%', fontSize: 16, fontWeight: 600 }} />
              </div>
              <div style={{ flex: '1 1 150px', minWidth: 130 }}>
                <div style={{ fontSize: 10.5, letterSpacing: 1, color: C.muted, marginBottom: 5 }}>CPA / DATA (tự tính)</div>
                <div style={{ ...inp, width: '100%', fontSize: 16, fontWeight: 700, color: C.green }}>{cpaOf(log?.data_keo, log?.chi_ads) != null ? fmtMoney(cpaOf(log?.data_keo, log?.chi_ads) as number) : '—'}</div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10.5, letterSpacing: 1, color: C.muted, marginBottom: 5 }}>VƯỚNG MẮC / CẦN HỖ TRỢ</div>
              <textarea disabled={!canEdit} defaultValue={log?.blocker ?? ''} placeholder="hôm nay vướng gì, cần chủ hỗ trợ gì..." onBlur={(e) => { if (e.target.value.trim() !== (log?.blocker ?? '')) save({ blocker: e.target.value.trim() || null }) }}
                style={{ ...inp, width: '100%', minHeight: 56, resize: 'vertical', fontSize: 13 }} />
            </div>
            {canEdit && (
              <button onClick={() => save({ reported_at: nowISO() })} style={{ marginTop: 12, background: C.green, color: '#08210f', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>📤 {log?.reported_at ? 'Cập nhật báo cáo' : 'Gửi báo cáo cuối ngày'}</button>
            )}
            {!canEdit && !isCEO && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>Chỉ sửa được nhật ký HÔM NAY của bạn.</div>}
          </div>

          {isCEO && <button onClick={() => setViewId('')} style={{ background: 'transparent', color: C.muted2, border: `1px solid ${C.line}`, borderRadius: 8, padding: '7px 14px', fontSize: 12.5, cursor: 'pointer' }}>← Về toàn đội</button>}
        </>
      )}
    </>
  )
}
