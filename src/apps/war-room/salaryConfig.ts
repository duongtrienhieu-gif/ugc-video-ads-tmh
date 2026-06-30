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
