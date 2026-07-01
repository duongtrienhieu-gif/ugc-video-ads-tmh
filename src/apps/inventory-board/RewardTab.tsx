// ── TAB 🏆 THƯỞNG & CẤP NHẬP ─────────────────────────────────────────────────
// Winner (5tr/team) · Cấp-độ-nhập 0/1/2 · Bounty 8% xả tồn chết (chia MKT+Sale).
// Read-only: chỉ ĐỀ XUẤT theo số thật, người chốt. Logic ở incentives.ts.
import { useEffect, useMemo, useState } from 'react'
import type { Prod, InvItem } from './profitCalc'
import { computeIncentives, BOUNTY_PCT, WINNER_BONUS } from './incentives'
import type { SkuLevel } from './incentives'
import { loadWinnerLedger, setWinnerAward, removeWinnerAward } from './winnerLedger'
import type { WinnerLedger } from './winnerLedger'

const C = {
  panel: '#0c111c', panel2: '#0a0f19', line: '#1b2233', line2: '#161d2c',
  gold: '#f5c451', text: '#eef1f7', muted: '#74809a', muted2: '#aeb8cc',
  red: '#ff4d5e', amber: '#fbbf24', green: '#4ade80', blue: '#7aa9ef',
}
const fmtMoney = (n: number) => Math.round(n).toLocaleString('vi-VN') + 'đ'
const fmtTr = (n: number) => (n / 1_000_000).toFixed(n >= 100_000_000 ? 0 : 1) + 'tr'
const fmtPct = (n: number) => (n * 100).toFixed(1) + '%'
const num = (n: number) => Math.round(n).toLocaleString('vi-VN')

const TIER = {
  2: { lbl: 'Cấp 2 · VÍT MẠNH', c: C.green, bg: 'rgba(74,222,128,0.1)' },
  1: { lbl: 'Cấp 1 · nhập đều', c: C.blue, bg: 'rgba(122,169,239,0.1)' },
  0: { lbl: 'Cấp 0 · test nhỏ', c: C.muted2, bg: 'rgba(174,184,204,0.08)' },
} as const

const panelStyle: React.CSSProperties = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 18px', marginBottom: 14 }
const eyebrow: React.CSSProperties = { fontSize: 13, fontWeight: 700, letterSpacing: 0.3, color: C.gold, marginBottom: 10 }

const K = (n: string) => n.trim().toUpperCase()
const monthKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const monthLabel = (m: string) => (m ? `T${+m.slice(5)}/${m.slice(0, 4)}` : '')

export default function RewardTab({ products, inv, velocity, priceVnd, teamSp, isCEO, mobile }: {
  products: Prod[]; inv: InvItem[]; velocity: Record<string, number>
  priceVnd: Record<string, number>; teamSp: Record<string, string[]>; isCEO: boolean; mobile: boolean
}) {
  const r = useMemo(() => computeIncentives(products, inv, velocity, priceVnd, teamSp), [products, inv, velocity, priceVnd, teamSp])
  const tierCount = (t: 0 | 1 | 2) => r.levels.filter((l) => l.tier === t).length

  // Sổ ghi winner: chia mã đủ điều kiện thành MỚI (chưa ghi) / ĐÃ THƯỞNG / bỏ qua (ẩn).
  const [ledger, setLedger] = useState<WinnerLedger>({})
  const [busy, setBusy] = useState('')
  useEffect(() => { void loadWinnerLedger().then(setLedger) }, [])
  const newWinners = r.winners.filter((w) => !ledger[K(w.name)])
  const awarded = r.winners.filter((w) => ledger[K(w.name)]?.paid === true)
  const skipped = r.winners.filter((w) => ledger[K(w.name)]?.paid === false)
  const isSkipped = (name: string) => ledger[K(name)]?.paid === false

  async function chot(w: SkuLevel, paid: boolean) {
    setBusy(K(w.name))
    const { ledger: next } = await setWinnerAward(ledger, w.name, { month: monthKey(), paid, teams: w.teams })
    setLedger(next); setBusy('')
  }
  async function hoanTac(name: string) {
    setBusy(K(name))
    const { ledger: next } = await removeWinnerAward(ledger, name)
    setLedger(next); setBusy('')
  }

  return (
    <div>
      <div style={panelStyle}>
        <div style={eyebrow}>🏆 THƯỞNG & CẤP NHẬP</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.65 }}>
          Đối chiếu <b style={{ color: C.muted2 }}>kho</b> × <b style={{ color: C.muted2 }}>doanh thu</b> mỗi mã. <b style={{ color: C.green }}>Đang chạy</b> = DT ≥ 10tr (không động). <b style={{ color: C.red }}>Tồn chết</b> = còn tồn nhưng DT &lt; 10tr → treo bounty xả. Cấp nhập theo <b style={{ color: C.muted2 }}>đơn sau hoàn</b> + cấu trúc dương. Đây là <b>đề xuất</b> — người chốt.
        </div>
      </div>

      {/* ── WINNER MỚI (chờ CEO chốt) ── */}
      <div style={panelStyle}>
        <div style={{ ...eyebrow, color: C.green }}>🏆 WINNER MỚI — thưởng {fmtTr(WINNER_BONUS)}/team · chỉ 1 lần khi lần đầu đạt (≥500 đơn sau hoàn + cấu trúc dương)</div>
        {newWinners.length === 0 ? (
          <div style={{ fontSize: 12.5, color: C.muted }}>Không có winner mới chờ chốt.{r.winners.length > newWinners.length ? ' Các mã đạt ngưỡng khác đã xử lý (đã thưởng / bỏ qua) bên dưới.' : ''}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fit,minmax(260px,1fr))', gap: 10 }}>
            {newWinners.map((w) => (
              <div key={w.name} style={{ background: C.panel2, border: '1px solid #2a5a3a', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>🏆 {w.name}</div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: C.muted, marginBottom: 8 }}>
                  <span>đơn sau hoàn <b style={{ color: C.green }}>{num(w.donSauHoan)}</b></span>
                  <span>cấu trúc <b style={{ color: C.green }}>{fmtPct(w.laiStruct)}</b></span>
                  <span>DT <b style={{ color: C.muted2 }}>{fmtMoney(w.doanhThu)}</b></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: isCEO ? 10 : 0 }}>
                  {w.teams.length > 0 ? w.teams.map((t) => (
                    <span key={t} style={{ fontSize: 11, fontWeight: 700, color: C.gold, background: 'rgba(245,196,81,0.12)', padding: '3px 9px', borderRadius: 6 }}>{t} · +{fmtTr(WINNER_BONUS)}</span>
                  )) : <span style={{ fontSize: 11, color: C.amber }}>chưa rõ team (mở view nhân viên để nạp map)</span>}
                </div>
                {isCEO ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button disabled={busy === K(w.name)} onClick={() => void chot(w, true)}
                      style={{ background: C.green, color: '#062012', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: busy === K(w.name) ? 0.6 : 1 }}>✓ Chốt thưởng {fmtTr(WINNER_BONUS)}</button>
                    <button disabled={busy === K(w.name)} onClick={() => void chot(w, false)}
                      style={{ background: 'transparent', color: C.muted2, border: `1px solid ${C.line}`, borderRadius: 8, padding: '7px 12px', fontSize: 12.5, cursor: 'pointer' }}>Bỏ qua — SP cũ</button>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Chỉ CEO chốt thưởng.</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ĐÃ THƯỞNG (lịch sử, không cộng lại) ── */}
      {awarded.length > 0 && (
        <div style={panelStyle}>
          <div style={{ ...eyebrow, color: C.muted2 }}>✓ ĐÃ THƯỞNG — không cộng lại</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {awarded.map((w) => {
              const a = ledger[K(w.name)]
              return (
                <div key={w.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', fontSize: 12.5, padding: '8px 12px', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10 }}>
                  <span><b>🏆 {w.name}</b> <span style={{ color: C.muted }}>· {num(w.donSauHoan)} đơn · {a.teams.join(', ') || 'chưa rõ team'}</span></span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: C.green, fontWeight: 600 }}>đã thưởng {monthLabel(a.month)}</span>
                    {isCEO && <button disabled={busy === K(w.name)} onClick={() => void hoanTac(w.name)} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.line}`, borderRadius: 7, padding: '4px 9px', fontSize: 11, cursor: 'pointer' }}>hoàn tác</button>}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── SP CŨ ĐÃ BỎ QUA (grandfather, có thể hoàn tác) ── */}
      {skipped.length > 0 && isCEO && (
        <div style={panelStyle}>
          <div style={{ ...eyebrow, color: C.muted }}>⏭ SP CŨ — đã bỏ qua (không thưởng)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {skipped.map((w) => (
              <span key={w.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '5px 10px', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8 }}>
                {w.name} <span style={{ color: C.muted }}>· {num(w.donSauHoan)} đơn</span>
                <button disabled={busy === K(w.name)} onClick={() => void hoanTac(w.name)} style={{ background: 'transparent', color: C.blue, border: 'none', padding: 0, fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>hoàn tác</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── CẤP NHẬP ── */}
      <div style={panelStyle}>
        <div style={{ ...eyebrow, color: C.blue }}>📊 CẤP NHẬP — {tierCount(2)} winner · {tierCount(1)} nhập đều · {tierCount(0)} test nhỏ</div>
        {r.levels.length === 0 ? (
          <div style={{ fontSize: 12.5, color: C.muted }}>Chưa có dữ liệu mã.</div>
        ) : mobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {r.levels.map((l) => <LevelCardMobile key={l.name} l={l} showTrophy={l.winner && !isSkipped(l.name)} />)}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: C.muted, fontSize: 10, letterSpacing: 1 }}>
                  <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 400 }}>MÃ</th>
                  <th style={{ textAlign: 'right', fontWeight: 400 }}>ĐƠN SAU HOÀN</th>
                  <th style={{ textAlign: 'right', fontWeight: 400 }}>DOANH THU</th>
                  <th style={{ textAlign: 'right', fontWeight: 400 }}>CẤU TRÚC</th>
                  <th style={{ textAlign: 'center', fontWeight: 400 }}>CẤP NHẬP</th>
                </tr>
              </thead>
              <tbody>
                {r.levels.map((l) => (
                  <tr key={l.name} style={{ borderTop: `1px solid ${C.line2}` }}>
                    <td style={{ padding: '9px 0', fontWeight: 600 }}>{l.winner && !isSkipped(l.name) ? '🏆 ' : ''}{l.name}{!l.running && <span style={{ marginLeft: 6, fontSize: 10.5, color: C.muted }}>(DT thấp)</span>}</td>
                    <td style={{ textAlign: 'right' }}>{num(l.donSauHoan)}</td>
                    <td style={{ textAlign: 'right', color: l.running ? C.text : C.muted }}>{fmtMoney(l.doanhThu)}</td>
                    <td style={{ textAlign: 'right', color: l.laiStruct > 0 ? C.green : C.red }}>{l.giaReal ? fmtPct(l.laiStruct) : '—'}</td>
                    <td style={{ textAlign: 'center' }}><TierPill tier={l.tier} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
          Cấp 0 = &lt;100 đơn hoặc chưa có giá vốn thật → nhập lô nhỏ thăm dò. Cấp 1 = 100–500 đơn + cấu trúc dương → nhập theo nhịp. Cấp 2 = ≥500 đơn + cấu trúc dương → vít mạnh + thưởng winner.
        </div>
      </div>

      {/* ── BOUNTY TỒN CHẾT ── */}
      <div style={{ ...panelStyle, border: `1px solid ${r.dead.length ? '#5a2a30' : C.line}` }}>
        <div style={{ ...eyebrow, color: C.red }}>♻️ BOUNTY XẢ TỒN CHẾT — {BOUNTY_PCT * 100}% vốn xả, chia MKT + Sale</div>
        {r.dead.length === 0 ? (
          <div style={{ fontSize: 12.5, color: C.muted }}>Không có tồn chết (mọi mã còn tồn đều đang chạy ≥10tr). 👍</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
              <Stat l="Vốn kẹt tồn chết" v={fmtMoney(r.totalVonKet)} c={C.red} />
              <Stat l={`Bounty xả hết (${BOUNTY_PCT * 100}%)`} v={fmtMoney(r.totalBounty)} c={C.gold} />
              <Stat l="Số mã tồn chết" v={String(r.dead.length)} c={C.amber} />
            </div>
            {mobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {r.dead.map((d) => (
                  <div key={d.name} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{d.name}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 14px', fontSize: 12.5 }}>
                      <Row l="Tồn" v={num(d.ton)} />
                      <Row l="DT" v={fmtMoney(d.doanhThu)} />
                      <Row l="Vốn kẹt" v={fmtMoney(d.vonKet)} c={C.red} />
                      <Row l="Bounty 8%" v={fmtMoney(d.bounty)} c={C.gold} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: C.muted, fontSize: 10, letterSpacing: 1 }}>
                      <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 400 }}>MÃ</th>
                      <th style={{ textAlign: 'right', fontWeight: 400 }}>TỒN</th>
                      <th style={{ textAlign: 'right', fontWeight: 400 }}>DT THÁNG</th>
                      <th style={{ textAlign: 'right', fontWeight: 400 }}>VỐN KẸT</th>
                      <th style={{ textAlign: 'right', fontWeight: 400 }}>BOUNTY 8%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.dead.map((d) => (
                      <tr key={d.name} style={{ borderTop: `1px solid ${C.line2}` }}>
                        <td style={{ padding: '9px 0', fontWeight: 600 }}>{d.name}</td>
                        <td style={{ textAlign: 'right' }}>{num(d.ton)}</td>
                        <td style={{ textAlign: 'right', color: C.muted }}>{fmtMoney(d.doanhThu)}</td>
                        <td style={{ textAlign: 'right', color: C.red }}>{fmtMoney(d.vonKet)}</td>
                        <td style={{ textAlign: 'right', color: C.gold, fontWeight: 600 }}>{fmtMoney(d.bounty)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
              Amnesty: tồn chết là hàng cũ chưa xử lý — bỏ qua chỉ số xấu, ai (MKT/Sale) xả được thì nhận {BOUNTY_PCT * 100}% vốn thu hồi. Theo dõi xả thực tế theo thời gian sẽ bổ sung sau.
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function TierPill({ tier }: { tier: 0 | 1 | 2 }) {
  const t = TIER[tier]
  return <span style={{ fontSize: 11, fontWeight: 700, color: t.c, background: t.bg, padding: '3px 10px', borderRadius: 7, whiteSpace: 'nowrap' }}>{t.lbl}</span>
}

function LevelCardMobile({ l, showTrophy }: { l: SkuLevel; showTrophy: boolean }) {
  return (
    <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{showTrophy ? '🏆 ' : ''}{l.name}</span>
        <TierPill tier={l.tier} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 14px', fontSize: 12.5 }}>
        <Row l="Đơn sau hoàn" v={num(l.donSauHoan)} />
        <Row l="DT" v={fmtMoney(l.doanhThu)} c={l.running ? C.text : C.muted} />
        <Row l="Cấu trúc" v={l.giaReal ? fmtPct(l.laiStruct) : '—'} c={l.laiStruct > 0 ? C.green : C.red} />
      </div>
    </div>
  )
}

function Stat({ l, v, c }: { l: string; v: string; c: string }) {
  return (
    <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '9px 13px', minWidth: 130 }}>
      <div style={{ fontSize: 10.5, letterSpacing: 0.5, color: C.muted, marginBottom: 4 }}>{l}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: c, whiteSpace: 'nowrap' }}>{v}</div>
    </div>
  )
}
function Row({ l, v, c }: { l: string; v: string; c?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
      <span style={{ color: C.muted }}>{l}</span>
      <span style={{ textAlign: 'right', color: c ?? C.text }}>{v}</span>
    </div>
  )
}
