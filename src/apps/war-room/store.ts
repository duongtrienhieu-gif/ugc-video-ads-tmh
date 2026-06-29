// ── Store Tác Chiến — Supabase CRUD: nhân sự · target · việc ──────────────────
import { create } from 'zustand'
import { supabase } from '../../lib/supabase'

// email có thể chứa 2 mail (1 slot = 2 người chung team, vd "HÀ + PHY") → ngăn bằng phẩy/;
export interface Member { id: string; email: string; name: string; role: string; sp_codes: string[] }
export function memberEmails(m: { email: string }): string[] {
  return (m.email || '').split(/[,;]/).map((s) => s.trim().toLowerCase()).filter(Boolean)
}
export interface Target { id: string; member_id: string; period: string; metric: string; value: number }
export interface Task {
  id: string; assignee_id: string | null; title: string; detail: string | null
  type: string | null; source: string | null; status: string; due: string | null; created_by: string | null
}
// SP đang test (pipeline tìm winner): idea → content → ads → done(+outcome win/keep/kill)
export interface TestProduct {
  id: string; name: string; niche: string | null; stage: string; outcome: string | null
  owner_id: string | null; spy_link: string | null; note: string | null
  data: number | null; cpa: number | null; chot: number | null; hoan: number | null
  deadline: string | null; budget: number | null; created_by: string | null
}

// Nhật ký ngày: kế hoạch sáng (checklist) + báo cáo tối (số nhập tay) — 1 dòng / người / ngày
export interface PlanItem { id: string; text: string; done: boolean }
export interface DailyLogRow {
  id: string; member_id: string; log_date: string
  plan_items: PlanItem[]; plan_locked_at: string | null
  data_keo: number | null; don_chot: number | null; chi_ads: number | null
  blocker: string | null; reported_at: string | null
}

interface WarState {
  members: Member[]; targets: Target[]; tasks: Task[]; tests: TestProduct[]; dailyLogs: DailyLogRow[]; loaded: boolean; error: string
  load: () => Promise<void>
  addMember: (m: Omit<Member, 'id'>) => Promise<void>
  updateMember: (id: string, patch: Partial<Member>) => Promise<void>
  deleteMember: (id: string) => Promise<void>
  setTarget: (member_id: string, period: string, metric: string, value: number) => Promise<void>
  addTask: (t: Omit<Task, 'id'>) => Promise<void>
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  addTest: (t: Omit<TestProduct, 'id'>) => Promise<void>
  updateTest: (id: string, patch: Partial<TestProduct>) => Promise<void>
  deleteTest: (id: string) => Promise<void>
  saveDailyLog: (member_id: string, log_date: string, patch: Partial<DailyLogRow>) => Promise<void>
}

export const useWarStore = create<WarState>((set) => ({
  members: [], targets: [], tasks: [], tests: [], dailyLogs: [], loaded: false, error: '',

  load: async () => {
    try {
      const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 14); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
      const [m, t, k, p, dl] = await Promise.all([
        supabase.from('team_members').select('*').order('created_at'),
        supabase.from('targets').select('*'),
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        // bảng test_products / daily_logs có thể chưa tạo (chưa chạy SQL) → lỗi không throw,
        // chỉ trả [] để các bảng khác vẫn tải bình thường.
        supabase.from('test_products').select('*').order('created_at', { ascending: false }),
        supabase.from('daily_logs').select('*').gte('log_date', cutoff),
      ])
      if (m.error) throw m.error
      set({ members: (m.data ?? []) as Member[], targets: (t.data ?? []) as Target[], tasks: (k.data ?? []) as Task[], tests: (p.data ?? []) as TestProduct[], dailyLogs: (dl.data ?? []) as DailyLogRow[], loaded: true, error: '' })
    } catch (e) { set({ error: (e as Error).message || 'Lỗi tải dữ liệu', loaded: true }) }
  },

  addMember: async (m) => {
    const { data, error } = await supabase.from('team_members').insert(m).select().single()
    if (error) return set({ error: error.message })
    set((s) => ({ members: [...s.members, data as Member], error: '' }))
  },
  updateMember: async (id, patch) => {
    const { error } = await supabase.from('team_members').update(patch).eq('id', id)
    if (error) return set({ error: error.message })
    set((s) => ({ members: s.members.map((x) => (x.id === id ? { ...x, ...patch } : x)), error: '' }))
  },
  deleteMember: async (id) => {
    const { error } = await supabase.from('team_members').delete().eq('id', id)
    if (error) return set({ error: error.message })
    set((s) => ({ members: s.members.filter((x) => x.id !== id), error: '' }))
  },

  setTarget: async (member_id, period, metric, value) => {
    const { data, error } = await supabase.from('targets').upsert({ member_id, period, metric, value }, { onConflict: 'member_id,period,metric' }).select().single()
    if (error) return set({ error: error.message })
    set((s) => ({ targets: [...s.targets.filter((x) => !(x.member_id === member_id && x.period === period && x.metric === metric)), data as Target], error: '' }))
  },

  addTask: async (t) => {
    const { data, error } = await supabase.from('tasks').insert(t).select().single()
    if (error) return set({ error: error.message })
    set((s) => ({ tasks: [data as Task, ...s.tasks], error: '' }))
  },
  updateTask: async (id, patch) => {
    const { error } = await supabase.from('tasks').update(patch).eq('id', id)
    if (error) return set({ error: error.message })
    set((s) => ({ tasks: s.tasks.map((x) => (x.id === id ? { ...x, ...patch } : x)), error: '' }))
  },
  deleteTask: async (id) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) return set({ error: error.message })
    set((s) => ({ tasks: s.tasks.filter((x) => x.id !== id), error: '' }))
  },

  addTest: async (t) => {
    const { data, error } = await supabase.from('test_products').insert(t).select().single()
    if (error) return set({ error: error.message })
    set((s) => ({ tests: [data as TestProduct, ...s.tests], error: '' }))
  },
  updateTest: async (id, patch) => {
    const { error } = await supabase.from('test_products').update(patch).eq('id', id)
    if (error) return set({ error: error.message })
    set((s) => ({ tests: s.tests.map((x) => (x.id === id ? { ...x, ...patch } : x)), error: '' }))
  },
  deleteTest: async (id) => {
    const { error } = await supabase.from('test_products').delete().eq('id', id)
    if (error) return set({ error: error.message })
    set((s) => ({ tests: s.tests.filter((x) => x.id !== id), error: '' }))
  },

  // upsert nhật ký ngày theo (member_id, log_date) — 1 dòng/người/ngày
  saveDailyLog: async (member_id, log_date, patch) => {
    const { data, error } = await supabase.from('daily_logs').upsert({ member_id, log_date, ...patch }, { onConflict: 'member_id,log_date' }).select().single()
    if (error) return set({ error: error.message })
    set((s) => ({ dailyLogs: [...s.dailyLogs.filter((x) => !(x.member_id === member_id && x.log_date === log_date)), data as DailyLogRow], error: '' }))
  },
}))
