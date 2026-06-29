// ── Trợ lý AI — đồng bộ Supabase (best-effort) ──
// Mọi hàm bọc try/catch: nếu CHƯA chạy migration (bảng chưa có) hoặc lỗi mạng →
// trả rỗng/false → app tự fallback localStorage, KHÔNG vỡ.
import { supabase } from '../../lib/supabase'
import type { ChatMessage } from './service'

export interface CloudConvo { id: string; title: string; messages: ChatMessage[]; updatedAt: number }

// ── Key GPT dùng chung ──
export async function fetchSharedOpenAiKey(): Promise<string> {
  try {
    const { data, error } = await supabase.from('app_shared_config').select('openai_key').eq('id', 'global').maybeSingle()
    if (error) return ''
    return ((data?.openai_key as string | null) ?? '') || ''
  } catch { return '' }
}
export async function saveSharedOpenAiKey(key: string, by: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('app_shared_config').upsert({ id: 'global', openai_key: key, updated_by: by, updated_at: new Date().toISOString() })
    return !error
  } catch { return false }
}

// ── Lịch sử chat per-user ──
export async function fetchConvos(userId: string): Promise<CloudConvo[]> {
  try {
    const { data, error } = await supabase
      .from('ai_chat_conversations').select('id,title,messages,updated_at')
      .eq('user_id', userId).order('updated_at', { ascending: false })
    if (error || !data) return []
    return data.map((r) => ({
      id: r.id as string,
      title: (r.title as string) || '',
      messages: (r.messages as ChatMessage[]) || [],
      updatedAt: new Date(r.updated_at as string).getTime(),
    }))
  } catch { return [] }
}
export async function upsertConvo(userId: string, c: { id: string; title: string; messages: ChatMessage[] }): Promise<void> {
  try {
    await supabase.from('ai_chat_conversations').upsert({
      id: c.id, user_id: userId, title: c.title, messages: c.messages, updated_at: new Date().toISOString(),
    })
  } catch { /* best-effort */ }
}
export async function deleteConvoCloud(id: string): Promise<void> {
  try { await supabase.from('ai_chat_conversations').delete().eq('id', id) } catch { /* best-effort */ }
}
