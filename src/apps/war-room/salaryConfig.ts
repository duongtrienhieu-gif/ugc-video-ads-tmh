// ── Cấu hình CEO (số THẬT ẩn) — lưu Supabase, fallback local/default ──────────
// Chủ chỉnh overhead/buffer/tỷ giá-chi-phí thật 1 lần → mọi máy CEO đọc cùng.
// Lưu ở board_config(id='global', ceo_cfg jsonb) — cột riêng, KHÔNG đụng cột links.
// Best-effort: Supabase lỗi/offline/chưa có cột → trả null, caller fallback localStorage→DEFAULT_CEO.
import { supabase } from '../../lib/supabase'
import { DEFAULT_CEO, type CeoCfg } from './salary'

const LS_KEY = 'tmh_ceo_cfg'

// Merge an toàn: field thiếu/sai kiểu → lấy DEFAULT (chống config cũ thiếu field mới).
export function mergeCeoCfg(raw: unknown): CeoCfg {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const num = (k: keyof CeoCfg) => (typeof o[k] === 'number' && isFinite(o[k] as number) ? (o[k] as number) : DEFAULT_CEO[k])
  return {
    tgVisible: num('tgVisible'), tgReal: num('tgReal'),
    cpvcThoi: num('cpvcThoi'), cpvcThat: num('cpvcThat'),
    cpvhThoi: num('cpvhThoi'), cpvhThat: num('cpvhThat'),
    buffer: num('buffer'), overhead: num('overhead'),
  }
}

export async function loadCeoCfg(): Promise<CeoCfg> {
  // 1) Supabase (nguồn chính, sync đa máy)
  try {
    const { data, error } = await supabase.from('board_config').select('ceo_cfg').eq('id', 'global').maybeSingle()
    if (!error && data?.ceo_cfg && typeof data.ceo_cfg === 'object') {
      const cfg = mergeCeoCfg(data.ceo_cfg)
      try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)) } catch { /* ignore */ }
      return cfg
    }
  } catch { /* fall through */ }
  // 2) localStorage (đã đồng bộ lần trước)
  try {
    const s = localStorage.getItem(LS_KEY)
    if (s) return mergeCeoCfg(JSON.parse(s))
  } catch { /* fall through */ }
  // 3) Default cứng
  return { ...DEFAULT_CEO }
}

export async function saveCeoCfg(cfg: CeoCfg, by?: string): Promise<boolean> {
  const clean = mergeCeoCfg(cfg)
  try { localStorage.setItem(LS_KEY, JSON.stringify(clean)) } catch { /* ignore */ }
  try {
    const { error } = await supabase.from('board_config').upsert({
      id: 'global', ceo_cfg: clean, updated_by: by ?? null, updated_at: new Date().toISOString(),
    })
    return !error
  } catch { return false }
}

// ── Tồn ế / team (giá vốn hàng >45 ngày còn kẹt + lỗ xả) — CEO nhập tay tháng 7 ──
// Lưu board_config(id='global', ton_ele jsonb) — cột riêng, key = token team (APEX/TITAN/SUMMIT), VNĐ.
// Cả CEO lẫn nhân viên đều ĐỌC (để phạt hiện minh bạch); chỉ CEO chỉnh/lưu.
export type TonEleMap = Record<string, { von: number; loXa: number }>
const LS_TON = 'tmh_ton_ele'

export function cleanTonEle(raw: unknown): TonEleMap {
  const out: TonEleMap = {}
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
      const num = (x: unknown) => (typeof x === 'number' && isFinite(x) ? Math.max(0, x) : 0)
      out[k.toUpperCase()] = { von: num(o.von), loXa: num(o.loXa) }
    }
  }
  return out
}

export async function loadTonEle(): Promise<TonEleMap> {
  try {
    const { data, error } = await supabase.from('board_config').select('ton_ele').eq('id', 'global').maybeSingle()
    if (!error && data?.ton_ele && typeof data.ton_ele === 'object') {
      const m = cleanTonEle(data.ton_ele)
      try { localStorage.setItem(LS_TON, JSON.stringify(m)) } catch { /* ignore */ }
      return m
    }
  } catch { /* fall through */ }
  try { const s = localStorage.getItem(LS_TON); if (s) return cleanTonEle(JSON.parse(s)) } catch { /* fall through */ }
  return {}
}

export async function saveTonEle(map: TonEleMap, by?: string): Promise<boolean> {
  const clean = cleanTonEle(map)
  try { localStorage.setItem(LS_TON, JSON.stringify(clean)) } catch { /* ignore */ }
  try {
    const { error } = await supabase.from('board_config').upsert({
      id: 'global', ton_ele: clean, updated_by: by ?? null, updated_at: new Date().toISOString(),
    })
    return !error
  } catch { return false }
}
