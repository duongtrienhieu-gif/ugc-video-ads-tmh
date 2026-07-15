// ─────────────────────────────────────────────────────────────────────────
// QUẢN TRỊ TỔNG (chỉ OWNER) — xem TẤT CẢ config chatbot của mọi nhân viên.
// Mode "chạy luôn, duyệt sau": config mới hoạt động ngay; owner TẮT cái nào
// sai/trùng mã → bot bỏ qua (không route, không làm mặc định).
//
// Cần 2 RLS policy trên user_outputs (chạy 1 lần ở Supabase SQL Editor):
//   create policy "owner_select_all_chatbot_configs" on user_outputs
//     for select to authenticated
//     using (kind = 'chat-bot-config' and auth.jwt()->>'email' = 'duongtrienhieu@gmail.com');
//   create policy "owner_update_all_chatbot_configs" on user_outputs
//     for update to authenticated
//     using (kind = 'chat-bot-config' and auth.jwt()->>'email' = 'duongtrienhieu@gmail.com');
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import { Power, RefreshCw } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import type { SalesConfig } from '../types'

interface Row {
  id: string
  user_id: string
  title: string | null
  payload_json: SalesConfig
  updated_at: string
}

export default function AdminPanel() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const load = async () => {
    setLoading(true)
    setErr('')
    const { data, error } = await supabase
      .from('user_outputs')
      .select('id,user_id,title,payload_json,updated_at')
      .eq('kind', 'chat-bot-config')
      .order('updated_at', { ascending: false })
    if (error) setErr(error.message)
    setRows((data as Row[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  const toggle = async (r: Row) => {
    setBusy(r.id)
    setErr('')
    const next = { ...r.payload_json, disabled: !r.payload_json.disabled }
    const { error } = await supabase.from('user_outputs').update({ payload_json: next }).eq('id', r.id)
    if (error) setErr(`Không đổi được trạng thái: ${error.message}`)
    else setRows((s) => s.map((x) => (x.id === r.id ? { ...x, payload_json: next } : x)))
    setBusy(null)
  }

  // Cảnh báo MÃ TRÙNG giữa các config đang bật (2 SP chung mã → bot route loạn).
  const dupCodes = useMemo(() => {
    const seen = new Map<string, number>()
    for (const r of rows) {
      const code = (r.payload_json.routeCode ?? '').trim().toUpperCase()
      if (!code || r.payload_json.disabled) continue
      seen.set(code, (seen.get(code) ?? 0) + 1)
    }
    return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([c]) => c))
  }, [rows])

  return (
    <div className="mx-auto max-w-4xl space-y-3 px-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-900">👑 Tất cả chatbot sản phẩm (mọi nhân viên)</h2>
          <p className="text-[11px] text-gray-400">Config mới CHẠY NGAY — tắt cái nào sai/trùng mã. Bot bỏ qua config đã tắt.</p>
        </div>
        <button
          onClick={() => void load()}
          className="flex items-center gap-1 rounded-lg bg-black/5 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-black/10"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Tải lại
        </button>
      </div>

      {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">{err}</p>}
      {dupCodes.size > 0 && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700">
          ⚠️ MÃ TRÙNG đang bật: {[...dupCodes].join(', ')} — 2 SP chung mã sẽ route loạn. Tắt bớt 1 cái hoặc sửa mã.
        </p>
      )}

      {loading && rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">Đang tải…</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">
          Chưa thấy config nào. (Nếu nhân viên ĐÃ tạo mà không hiện → chưa chạy 2 RLS policy owner — xem comment đầu file AdminPanel.tsx)
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const cfg = r.payload_json
            const code = (cfg.routeCode ?? '').trim().toUpperCase()
            const off = !!cfg.disabled
            return (
              <div key={r.id} className={`flex flex-wrap items-center gap-2 rounded-xl border p-3 ${off ? 'border-black/8 bg-black/[0.03] opacity-60' : 'border-black/8 bg-white'}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-gray-900">{r.title || '(chưa đặt tên)'}</span>
                    {code ? (
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${dupCodes.has(code) ? 'bg-amber-500/15 text-amber-700' : 'bg-emerald-500/10 text-emerald-700'}`}>
                        {code}
                      </span>
                    ) : (
                      <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-500">THIẾU MÃ</span>
                    )}
                    {cfg.team && <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">{cfg.team}</span>}
                    {off && <span className="rounded bg-gray-500/15 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">ĐÃ TẮT</span>}
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-400">
                    {(cfg.pricingTiers ?? []).filter((t) => t.price.trim()).length} mức giá · {cfg.mediaMap?.length ?? 0} media ·
                    sửa {new Date(r.updated_at).toLocaleString('vi-VN')} · chủ …{r.user_id.slice(-6)}
                  </div>
                </div>
                <button
                  onClick={() => void toggle(r)}
                  disabled={busy === r.id}
                  className={`flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    off ? 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20' : 'bg-red-500/10 text-red-600 hover:bg-red-500/20'
                  } ${busy === r.id ? 'opacity-50' : ''}`}
                >
                  <Power className="h-3.5 w-3.5" /> {off ? 'Bật lại' : 'Tắt'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
