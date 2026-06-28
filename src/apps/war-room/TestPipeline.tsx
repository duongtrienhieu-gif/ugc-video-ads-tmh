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

export default function TestPipeline({ isCEO, userEmail }: { isCEO: boolean; userEmail: string }) {
  const { members, tests, addTest, updateTest, deleteTest } = useWarStore()
  const openApp = useAppStore((s) => s.openApp)
  const [mob, setMob] = useState(false)
  const [activeStage, setActiveStage] = useState('idea')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [name, setName] = useState(''); const [niche, setNiche] = useState(''); const [owner, setOwner] = useState(''); const [spy, setSpy] = useState('')
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

  const add = () => {
    if (!name.trim()) return
    const ownerId = isCEO ? (owner || null) : myId // nhân viên TỰ sở hữu SP test, không giao ai khác
    void addTest({ name: name.trim(), niche: niche.trim() || null, stage: 'idea', outcome: null, owner_id: ownerId, spy_link: spy.trim() || null, note: null, data: null, cpa: null, chot: null, hoan: null, created_by: userEmail })
    setName(''); setNiche(''); setSpy('')
  }

  const Card = ({ t }: { t: TestProduct }) => {
    const idx = stageIdx(t.stage)
    const v = t.stage === 'ads' || t.stage === 'done' ? verdict(t) : null
    return (
      <div style={{ background: C.panel2, border: `1px solid ${t.outcome ? OUTCOMES.find((o) => o.key === t.outcome)?.color ?? C.line : C.line}`, borderRadius: 11, padding: '11px 12px', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{t.name}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{t.niche || 'chưa rõ ngách'} · {nameOf(t.owner_id)}</div>
          </div>
          <button onClick={() => void deleteTest(t.id)} title="xoá" style={{ background: 'transparent', color: C.muted, border: 'none', fontSize: 14, cursor: 'pointer' }}>✕</button>
        </div>

        {/* người phụ trách (CEO đổi được; nhân viên khoá vào mình) + link spy */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
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
        Mỗi thẻ là 1 SP đang test, kéo qua 4 bước. Bước <b style={{ color: C.text }}>Test ads</b> nhập data/CPA/chốt/hoàn → app gợi ý nên WIN hay KILL. Nút <b style={{ color: C.text }}>Spy/Kịch bản/Video/Ladipage</b> mở thẳng công cụ làm.
      </div>

      {/* thêm SP + lọc người */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.line2}` }}>
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} placeholder="Tên SP test..." style={{ ...inp, width: 150 }} />
        <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="ngách" style={{ ...inp, width: 110 }} />
        {isCEO && <select value={owner} onChange={(e) => setOwner(e.target.value)} style={{ ...inp, fontSize: 12 }}><option value="">— giao ai —</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>}
        <input value={spy} onChange={(e) => setSpy(e.target.value)} placeholder="link spy (tuỳ chọn)" style={{ ...inp, flex: 1, minWidth: 150 }} />
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
