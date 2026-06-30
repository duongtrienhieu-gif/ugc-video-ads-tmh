// ── TAB: 🎁 GHÉP QUÀ & COMBO ─────────────────────────────────────────────────
// Tự đề xuất kế hoạch quà chéo + combo theo NHÂN VIÊN (thay sheet 5). Sửa được.
import { useEffect, useMemo, useState } from 'react'
import { computePlan, cloneTiers, type Tier, type GiftMaster, type GiftCat, type Live, type Tone, type Plan } from './giftPlan'

const C = {
  panel: '#0c111c', panel2: '#0a0f19', line: '#1b2233', line2: '#161d2c',
  gold: '#f5c451', text: '#eef1f7', muted: '#74809a', muted2: '#aeb8cc',
  red: '#ff4d5e', amber: '#fbbf24', green: '#4ade80',
}
const tc = (t: Tone) => (t === 'red' ? C.red : t === 'amber' ? C.amber : t === 'green' ? C.green : C.muted2)
const fmtMoney = (n: number) => Math.round(n).toLocaleString('vi-VN') + 'đ'
const fmtSigned = (n: number) => (n >= 0 ? '+' : '') + Math.round(n).toLocaleString('vi-VN') + 'đ'
const fmtPct = (n: number) => (n * 100).toFixed(1) + '%'
const fmtInt = (n: number) => (Number.isFinite(n) ? Math.round(n).toLocaleString('vi-VN') : '∞')
const panelStyle: React.CSSProperties = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '14px 16px', marginBottom: 12 }
const eyebrowStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, letterSpacing: 0.3, color: C.gold }
const MKT_ORDER = ['KHÁNH', 'HÀ', 'ANH', 'DUY', 'TUẤN']
interface Prod { name: string; pctHoan: number; pctCpqc: number; pctChot: number; hoanEstimated?: boolean }

export default function GiftCombo({ products, giftLink }: { products: Prod[]; giftLink: string }) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const f = () => setIsMobile(window.innerWidth < 700)
    f(); window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])

  // Tự tải file KẾ HOẠCH QUÀ riêng (nhẹ, 1 request) — tách khỏi load chính nặng để né timeout.
  const [giftMaster, setGiftMaster] = useState<GiftMaster[]>([])
  const [giftCatalog, setGiftCatalog] = useState<GiftCat[]>([])
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [errMsg, setErrMsg] = useState('')
  useEffect(() => {
    let alive = true
    setStatus('loading')
    fetch('/api/inventory-board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ giftOnly: true, links: { giftplan: giftLink } }), cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (!alive) return; setGiftMaster(j.giftMaster || []); setGiftCatalog(j.giftCatalog || []); if (j.giftCatalog?.length) setStatus('ok'); else { setStatus('error'); setErrMsg(j.error || 'Không có dữ liệu quà') } })
      .catch((e) => { if (alive) { setStatus('error'); setErrMsg(e instanceof Error ? e.message : 'Lỗi tải') } })
    return () => { alive = false }
  }, [giftLink])
  // edit theo SP: đổi quà / sửa Mốc
  const [edits, setEdits] = useState<Record<string, { giftName?: string; tiers?: Tier[] }>>({})
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [mkt, setMkt] = useState<string>('Tất cả')

  const liveMap = useMemo(() => {
    const m: Record<string, Live> = {}
    products.forEach((p) => { m[p.name.trim().toUpperCase()] = { hoanPct: p.pctHoan, adsPct: p.pctCpqc, vonReal: 0, chotPct: p.pctChot } })
    return m
  }, [products])

  // 1 SP / dòng (dedupe theo mã chính, ưu tiên dòng có marketer)
  const cats = useMemo(() => {
    const byMa = new Map<string, GiftCat>()
    for (const c of giftCatalog) {
      if (!c.maChinh) continue
      const k = c.maChinh.trim().toUpperCase()
      const ex = byMa.get(k)
      if (!ex || (!ex.marketer && c.marketer)) byMa.set(k, c)
    }
    return [...byMa.values()]
  }, [giftCatalog])

  const plans = useMemo(() => cats.map((c) => {
    const k = c.maChinh.trim().toUpperCase()
    return computePlan(c, giftMaster, liveMap[k], edits[k]?.tiers ?? cloneTiers(), edits[k]?.giftName)
  }), [cats, giftMaster, liveMap, edits])

  const markets = useMemo(() => {
    const set = new Set(plans.map((p) => p.marketer))
    const ordered = MKT_ORDER.filter((m) => set.has(m))
    const rest = [...set].filter((m) => !MKT_ORDER.includes(m)).sort()
    return [...ordered, ...rest]
  }, [plans])

  const shown = mkt === 'Tất cả' ? plans : plans.filter((p) => p.marketer === mkt)
  const groups = useMemo(() => {
    const g = new Map<string, Plan[]>()
    for (const p of shown) { const a = g.get(p.marketer) || []; a.push(p); g.set(p.marketer, a) }
    return [...g.entries()].sort((a, b) => {
      const ia = MKT_ORDER.indexOf(a[0]), ib = MKT_ORDER.indexOf(b[0])
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
  }, [shown])

  function setGift(k: string, giftName: string) { setEdits((e) => ({ ...e, [k]: { ...e[k], giftName } })) }
  function setTier(k: string, i: number, patch: Partial<Tier>, base: Tier[]) {
    const tiers = (edits[k]?.tiers ?? base).map((t, j) => (j === i ? { ...t, ...patch } : t))
    setEdits((e) => ({ ...e, [k]: { ...e[k], tiers } }))
  }

  if (status === 'loading') {
    return <div style={{ ...panelStyle, textAlign: 'center', color: C.muted, fontSize: 14 }}>● Đang tải kế hoạch quà từ Google Sheet...</div>
  }
  if (!giftCatalog.length) {
    return <div style={{ ...panelStyle, textAlign: 'center', color: status === 'error' ? C.red : C.muted, fontSize: 14 }}>{status === 'error' ? '⚠ ' + errMsg : 'Chưa có dữ liệu quà'}. Kiểm tra link file KẾ HOẠCH QUÀ ở ⚙ Cấu hình link (tab Kho).</div>
  }

  const badge = (txt: string, color: string) => <span style={{ color, border: `1px solid ${color}`, borderRadius: 20, padding: '2px 9px', fontSize: 11, whiteSpace: 'nowrap' }}>{txt}</span>

  return (
    <div>
      <div style={{ ...panelStyle, padding: '12px 16px' }}>
        <div style={eyebrowStyle}>🎁 GHÉP QUÀ & COMBO · tự đề xuất theo nhân viên</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 5 }}>Lấy hàng tồn chết CÙNG NGÁCH làm quà chéo → thoát kho + upsell. Vốn quà theo BẬC giá vốn của quà (0-20k→10k · 21-30k→12k · 31-40k→15k · 41-50k→20k) · tỷ giá 5.800. Đổi quà / sửa Mốc tuỳ ý — số tự tính lại.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {['Tất cả', ...markets].map((m) => (
            <button key={m} onClick={() => setMkt(m)} style={{ background: mkt === m ? C.gold : 'transparent', color: mkt === m ? '#0a0a0a' : C.muted2, border: `1px solid ${mkt === m ? C.gold : C.line}`, borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{m === 'Tất cả' ? m : '👤 ' + m}</button>
          ))}
        </div>
      </div>
      {products.some((p) => p.hoanEstimated) && (
        <div style={{ ...panelStyle, padding: '9px 14px', border: '1px solid #5a4a18', background: 'rgba(245,196,81,0.07)', color: C.amber, fontSize: 12.5 }}>
          ⏳ Đầu tháng: %hoàn một số mã đang dùng <b>ước tính tháng trước</b> (đơn tháng này chưa về đủ) → lãi/đèn quà là tạm tính, tự chuẩn lại khi đơn hoàn về (~7-10 ngày).
        </div>
      )}

      {groups.map(([marketer, list]) => (
        <div key={marketer} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, margin: '4px 2px 10px', letterSpacing: 0.3 }}>👤 {marketer} · {list.length} mã</div>
          {list.map((p) => {
            const k = p.main.trim().toUpperCase()
            const tiers = edits[k]?.tiers ?? p.tiers
            const isOpen = !!open[k]
            const sumP = p.tiers.reduce((s, t) => s + t.pctDon, 0)
            return (
              <div key={k} style={panelStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{p.main}</span>
                  {badge(p.ngach, C.muted2)}
                  {badge(p.den.t, tc(p.den.tone))}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted }}>hoàn {fmtPct(p.hoan)} · ads {fmtPct(p.ads)} · ngưỡng {fmtPct(Math.max(0, p.cpqcTarget))} · tồn chính {fmtInt(p.mainTon)}</span>
                </div>

                {/* quà chéo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '12px 0' }}>
                  <span style={{ fontSize: 12, color: C.gold, whiteSpace: 'nowrap' }}>🎁 Quà chéo</span>
                  <select value={p.gift?.name ?? ''} onChange={(e) => setGift(k, e.target.value)}
                    style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 8, padding: '7px 10px', fontSize: 13, minWidth: 200, flex: isMobile ? '1 1 100%' : undefined }}>
                    {p.options.length === 0 && <option value="">(không có SP cùng ngách còn tồn)</option>}
                    {p.options.map((o) => <option key={o.name} value={o.name}>{o.stuck ? '🔴 ' : ''}{o.name}{o.sameNiche ? '' : ` (${o.ngach})`} — tồn {fmtInt(o.ton)} · kẹt {fmtMoney(o.vonKet)}</option>)}
                  </select>
                  {p.gift && <span style={{ fontSize: 11, color: C.muted2 }}>tồn quà {fmtInt(p.gift.ton)} → thoát {fmtMoney(p.gift.vonKet)} vốn kẹt</span>}
                </div>

                {/* strip kết quả */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 8 }}>
                  {[
                    { l: 'Lãi/đơn TB', v: fmtSigned(p.laiDonW), c: p.laiDonW < 0 ? C.red : C.green },
                    { l: '% Lợi nhuận', v: fmtPct(p.laiPctW), c: p.laiPctW < 0 ? C.red : C.green },
                    { l: 'AOV TB (RM)', v: (p.aovW / 5800).toFixed(1), c: C.gold },
                    { l: 'Quà đủ cho', v: fmtInt(p.soDonMax) + ' đơn', c: p.soDonMax < 300 ? C.amber : C.muted2 },
                  ].map((s) => (
                    <div key={s.l} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 9, padding: '9px 11px', minWidth: 0 }}>
                      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.muted, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.l}</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: s.c, whiteSpace: 'nowrap' }}>{s.v}</div>
                    </div>
                  ))}
                </div>

                {/* 🎯 MỤC TIÊU ADS — quan trọng nhì sau lợi nhuận, cho MKT care ads */}
                <div style={{ marginTop: 10, background: 'rgba(245,196,81,0.10)', border: '1px solid #4a4015', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: C.gold, fontWeight: 700, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>🎯 MỤC TIÊU ADS (đạt lãi 10%)</span>
                  <span style={{ fontSize: 13, color: C.muted2, whiteSpace: 'nowrap' }}>%CPQC ≤ <b style={{ color: p.cpaTarget > 0 ? C.green : C.red, fontSize: 19 }}>{fmtPct(Math.max(0, p.cpqcTarget))}</b></span>
                  <span style={{ fontSize: 13, color: C.muted2, whiteSpace: 'nowrap' }}>CPA ≤ <b style={{ color: p.cpaTarget > 0 ? C.green : C.red, fontSize: 19 }}>{p.cpaTarget > 0 ? fmtMoney(p.cpaTarget) + '/lead' : 'không khả thi'}</b></span>
                  <span style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap', marginLeft: 'auto' }}>CPA = %CPQC × AOV × chốt {fmtPct(p.chot)} · đang chạy CPQC {fmtPct(p.ads)}</span>
                </div>

                <button onClick={() => setOpen((o) => ({ ...o, [k]: !isOpen }))} style={{ marginTop: 10, background: 'transparent', color: C.gold, border: `1px solid ${C.line}`, borderRadius: 8, padding: '6px 12px', fontSize: 12.5, cursor: 'pointer' }}>
                  ⚙ Chi tiết Mốc combo {isOpen ? '▲' : '▼'}
                </button>

                {isOpen && (
                  <div style={{ marginTop: 10, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 540 }}>
                      <thead>
                        <tr style={{ color: C.muted, fontSize: 10, letterSpacing: 0.5 }}>
                          <th style={{ textAlign: 'left', padding: '5px 6px', fontWeight: 400 }}>MỐC</th>
                          <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 400 }}>GIÁ RM</th>
                          <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 400 }}>%ĐƠN</th>
                          <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 400 }}>MUA</th>
                          <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 400 }}>TẶNG CHÍNH</th>
                          <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 400 }}>QUÀ CHÉO</th>
                          <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 400 }}>LÃI/ĐƠN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.tiers.map((t, i) => {
                          const inp: React.CSSProperties = { width: 56, background: C.panel2, border: `1px solid ${C.line}`, color: C.text, borderRadius: 6, padding: '4px 6px', fontSize: 12.5, textAlign: 'right' }
                          return (
                            <tr key={i} style={{ borderTop: `1px solid ${C.line2}` }}>
                              <td style={{ padding: '6px', color: C.muted2 }}>{t.loai}</td>
                              <td style={{ padding: '6px', textAlign: 'right' }}><input type="number" value={tiers[i].giaRM} onChange={(e) => setTier(k, i, { giaRM: +e.target.value }, p.tiers)} style={inp} /></td>
                              <td style={{ padding: '6px', textAlign: 'right' }}><input type="number" value={+(tiers[i].pctDon * 100).toFixed(0)} onChange={(e) => setTier(k, i, { pctDon: +e.target.value / 100 }, p.tiers)} style={inp} /></td>
                              <td style={{ padding: '6px', textAlign: 'right' }}><input type="number" value={tiers[i].mua} onChange={(e) => setTier(k, i, { mua: +e.target.value }, p.tiers)} style={inp} /></td>
                              <td style={{ padding: '6px', textAlign: 'right' }}><input type="number" value={tiers[i].tangChinh} onChange={(e) => setTier(k, i, { tangChinh: +e.target.value }, p.tiers)} style={inp} /></td>
                              <td style={{ padding: '6px', textAlign: 'right' }}><input type="number" value={tiers[i].quaCheo} onChange={(e) => setTier(k, i, { quaCheo: +e.target.value }, p.tiers)} style={inp} /></td>
                              <td style={{ padding: '6px', textAlign: 'right', color: t.laiDon < 0 ? C.red : C.green, fontWeight: 500 }}>{fmtSigned(t.laiDon)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <div style={{ fontSize: 11, color: Math.abs(sumP - 1) < 0.001 ? C.muted : C.red, marginTop: 6 }}>
                      Tổng %đơn = {(sumP * 100).toFixed(0)}%{Math.abs(sumP - 1) >= 0.001 ? ' (nên = 100%)' : ''} · MUA = số SP chính trả tiền · TẶNG CHÍNH = tặng thêm SP chính · QUÀ CHÉO = số quà (vốn theo bậc giá vốn quà). Quà đủ {fmtInt(p.soDonMaxQua)} đơn · hàng chính đủ {fmtInt(p.soDonMaxChinh)} đơn.
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
      {!shown.length && <div style={{ ...panelStyle, textAlign: 'center', color: C.muted, fontSize: 14 }}>Không có SP cho nhân viên này.</div>}
    </div>
  )
}
