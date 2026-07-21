// ── Link nguồn dữ liệu DÙNG CHUNG (Supabase) ─────────────────────────────────
// Chủ dán link Sheet tháng mới 1 lần → mọi nhân viên/điện thoại đọc cùng bộ link.
// Bảng board_config(id='global', links jsonb). Cùng pattern app_shared_config (ai-chat).
// Best-effort: Supabase lỗi/offline → trả null, caller tự fallback localStorage/default.
import { supabase } from '../../lib/supabase'

export async function loadBoardLinks(): Promise<Record<string, string> | null> {
  try {
    const { data, error } = await supabase.from('board_config').select('links').eq('id', 'global').maybeSingle()
    if (error) return null
    const links = (data?.links ?? null) as Record<string, string> | null
    return links && typeof links === 'object' ? links : null
  } catch { return null }
}

export async function saveBoardLinks(links: Record<string, string>, by?: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('board_config').upsert({
      id: 'global', links, updated_by: by ?? null, updated_at: new Date().toISOString(),
    })
    return !error
  } catch { return false }
}

// ── GÁN TEAM PHỤ TRÁCH TỪNG MÃ SP (dùng chung cả công ty) ────────────────────
// Dùng LẠI bảng board_config + cột links jsonb, chỉ khác id='sp_team' → KHÔNG cần
// migration SQL. Map { "MÃ SP (UPPERCASE)": "APEX" | "TITAN" | "SUMMIT" }.
// Đây là bản ĐÈ TAY; mã không có ở đây thì app tự suy team từ file team (marketerSp).
const SP_TEAM_ID = 'sp_team'

export async function loadSpTeam(): Promise<Record<string, string> | null> {
  try {
    const { data, error } = await supabase.from('board_config').select('links').eq('id', SP_TEAM_ID).maybeSingle()
    if (error) return null
    const m = (data?.links ?? null) as Record<string, string> | null
    return m && typeof m === 'object' ? m : null
  } catch { return null }
}

export async function saveSpTeam(map: Record<string, string>, by?: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('board_config').upsert({
      id: SP_TEAM_ID, links: map, updated_by: by ?? null, updated_at: new Date().toISOString(),
    })
    return !error
  } catch { return false }
}
