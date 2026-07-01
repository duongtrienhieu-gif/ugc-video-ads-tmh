// ── SỔ GHI WINNER — chống thưởng lặp lại + loại staple cũ ─────────────────────
// Winner = "test win": mã LẦN ĐẦU đạt ngưỡng (≥500 đơn sau hoàn + cấu trúc dương) → thưởng ĐÚNG 1 lần.
// Máy không biết mã mới hay cũ (chỉ có số tháng này) → CEO chốt lúc đó: "Chốt thưởng" hoặc "Bỏ qua SP cũ".
// Ghi vào board_config(id='global', winner_awards jsonb) — cột riêng, best-effort như salaryConfig/boardConfig.
import { supabase } from '../../lib/supabase'

export interface WinnerAward {
  month: string    // 'YYYY-MM' — tháng chốt (hiển thị "đã thưởng T..")
  paid: boolean    // true = đã thưởng 4tr · false = bỏ qua (staple cũ, không thưởng)
  teams: string[]  // team nhận thưởng (snapshot lúc chốt)
}
export type WinnerLedger = Record<string, WinnerAward> // key = tên mã UPPER

const LS_KEY = 'tmh_winner_ledger'
const K = (n: string) => n.trim().toUpperCase()

function sanitize(raw: unknown): WinnerLedger {
  const out: WinnerLedger = {}
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue
      const o = v as Record<string, unknown>
      out[K(k)] = {
        month: typeof o.month === 'string' ? o.month : '',
        paid: o.paid === true,
        teams: Array.isArray(o.teams) ? o.teams.filter((t): t is string => typeof t === 'string') : [],
      }
    }
  }
  return out
}

export async function loadWinnerLedger(): Promise<WinnerLedger> {
  try {
    const { data, error } = await supabase.from('board_config').select('winner_awards').eq('id', 'global').maybeSingle()
    if (!error && data?.winner_awards) {
      const l = sanitize(data.winner_awards)
      try { localStorage.setItem(LS_KEY, JSON.stringify(l)) } catch { /* quota */ }
      return l
    }
  } catch { /* fall through */ }
  try { const s = localStorage.getItem(LS_KEY); if (s) return sanitize(JSON.parse(s)) } catch { /* parse */ }
  return {}
}

async function persist(ledger: WinnerLedger, by?: string): Promise<boolean> {
  try { localStorage.setItem(LS_KEY, JSON.stringify(ledger)) } catch { /* quota */ }
  try {
    const { error } = await supabase.from('board_config').upsert({
      id: 'global', winner_awards: ledger, updated_by: by ?? null, updated_at: new Date().toISOString(),
    })
    return !error
  } catch { return false }
}

// Ghi/đè 1 mã (chốt thưởng hoặc bỏ qua) → trả ledger mới + trạng thái lưu Supabase.
export async function setWinnerAward(ledger: WinnerLedger, ma: string, entry: WinnerAward, by?: string): Promise<{ ledger: WinnerLedger; ok: boolean }> {
  const next = { ...ledger, [K(ma)]: entry }
  return { ledger: next, ok: await persist(next, by) }
}

// Hoàn tác (xoá khỏi sổ → mã quay lại danh sách "winner mới").
export async function removeWinnerAward(ledger: WinnerLedger, ma: string, by?: string): Promise<{ ledger: WinnerLedger; ok: boolean }> {
  const next = { ...ledger }; delete next[K(ma)]
  return { ledger: next, ok: await persist(next, by) }
}
