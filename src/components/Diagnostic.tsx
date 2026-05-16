import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useBankStore } from '../stores/bankStore'
import { X, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react'

interface DiagnosticProps {
  isOpen: boolean
  onClose: () => void
}

interface CountResult {
  table: string
  ownCount: number | null
  orphanCount: number | null
  error: string | null
}

export default function Diagnostic({ isOpen, onClose }: DiagnosticProps) {
  const { user } = useAuthStore()
  const { products, models, scripts, voices, voiceHistory, brolls } = useBankStore()
  const [counts, setCounts] = useState<CountResult[]>([])
  const [loading, setLoading] = useState(false)
  const [rescuing, setRescuing] = useState(false)
  const [rescueResult, setRescueResult] = useState<string | null>(null)

  const runDiagnostic = async () => {
    if (!user) return
    setLoading(true)
    setRescueResult(null)
    const tables = ['products', 'models', 'scripts', 'voices', 'voice_history', 'brolls']
    const results: CountResult[] = []

    for (const table of tables) {
      try {
        const own = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('user_id', user.id)
        const orphan = await supabase.from(table).select('id', { count: 'exact', head: true }).is('user_id', null)
        results.push({
          table,
          ownCount: own.count,
          orphanCount: orphan.count,
          error: own.error?.message || orphan.error?.message || null,
        })
      } catch (e) {
        results.push({ table, ownCount: null, orphanCount: null, error: e instanceof Error ? e.message : String(e) })
      }
    }
    setCounts(results)
    setLoading(false)
  }

  const rescueOrphans = async () => {
    if (!user) return
    setRescuing(true)
    setRescueResult(null)
    const tables = ['products', 'models', 'scripts', 'voices', 'voice_history', 'brolls']
    let totalRescued = 0
    const errors: string[] = []

    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).update({ user_id: user.id }).is('user_id', null).select('id')
        if (error) errors.push(`${table}: ${error.message}`)
        else if (data) totalRescued += data.length
      } catch (e) {
        errors.push(`${table}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    if (errors.length > 0) {
      setRescueResult(`⚠️ Có lỗi: ${errors.join(', ')}. Cứu được ${totalRescued} rows.`)
    } else {
      setRescueResult(`✅ Đã gán ${totalRescued} row cũ cho tài khoản của bạn. Refresh trang để xem!`)
    }
    setRescuing(false)
    await runDiagnostic()
  }

  useEffect(() => {
    if (isOpen) runDiagnostic()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-black/8 px-5 py-3">
          <h2 className="text-base font-semibold text-gray-900">🔍 Chẩn đoán dữ liệu</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-black/5 hover:text-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-5 space-y-4">
          {/* Auth info */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Phiên đăng nhập</h3>
            <div className="rounded-lg bg-black/[0.03] p-3 text-xs">
              {user ? (
                <>
                  <div className="flex items-center gap-2 text-emerald-600 mb-2">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="font-semibold">Đã đăng nhập</span>
                  </div>
                  <div className="space-y-1 text-gray-600">
                    <div><span className="text-gray-400">Email:</span> <code className="text-gray-800">{user.email}</code></div>
                    <div><span className="text-gray-400">User ID:</span> <code className="text-gray-800 text-[10px]">{user.id}</code></div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-red-500">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Chưa đăng nhập</span>
                </div>
              )}
            </div>
          </section>

          {/* In-memory state */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Dữ liệu trên trình duyệt</h3>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <Stat label="Sản phẩm"     value={products.length} />
              <Stat label="Avatar AI"    value={models.length} />
              <Stat label="Kịch bản"     value={scripts.length} />
              <Stat label="Giọng đọc"    value={voices.length} />
              <Stat label="Lịch sử voice" value={voiceHistory.length} />
              <Stat label="B-Roll"       value={brolls.length} />
            </div>
          </section>

          {/* DB state */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Dữ liệu trong Supabase</h3>
              <button
                onClick={runDiagnostic}
                disabled={loading}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-blue-500 hover:bg-blue-500/10 disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                Kiểm tra lại
              </button>
            </div>
            <div className="overflow-hidden rounded-lg border border-black/8">
              <table className="w-full text-xs">
                <thead className="bg-black/[0.03] text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Bảng</th>
                    <th className="px-3 py-2 text-right font-medium">Của bạn</th>
                    <th className="px-3 py-2 text-right font-medium" title="Row chưa có user_id — đây là dữ liệu mồ côi từ trước">Mồ côi (NULL user_id)</th>
                  </tr>
                </thead>
                <tbody>
                  {counts.map((c) => (
                    <tr key={c.table} className="border-t border-black/5">
                      <td className="px-3 py-2 font-medium text-gray-700">{c.table}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {c.error ? <span className="text-red-500">ERROR</span> : (c.ownCount ?? '-')}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {c.error ? <span className="text-red-500" title={c.error}>{c.error.slice(0, 30)}...</span> : (
                          <span className={(c.orphanCount ?? 0) > 0 ? 'text-amber-500 font-semibold' : 'text-gray-400'}>
                            {c.orphanCount ?? '-'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Rescue orphans */}
          {counts.some((c) => (c.orphanCount ?? 0) > 0) && (
            <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <h3 className="mb-2 text-sm font-semibold text-amber-700">⚠️ Phát hiện dữ liệu mồ côi</h3>
              <p className="mb-3 text-xs text-amber-700">
                Có dữ liệu trong DB nhưng KHÔNG có user_id (do bug cũ chưa fix). Nhấn nút bên dưới để gán toàn bộ cho tài khoản của bạn.
              </p>
              <button
                onClick={rescueOrphans}
                disabled={rescuing}
                className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {rescuing ? 'Đang cứu...' : '🔄 Cứu toàn bộ dữ liệu mồ côi về tài khoản này'}
              </button>
              {rescueResult && (
                <div className="mt-3 rounded-lg bg-white p-3 text-xs text-gray-700">{rescueResult}</div>
              )}
            </section>
          )}

          {/* Tips */}
          <section className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-700">
            <p className="font-semibold mb-1">💡 Mẹo:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-600">
              <li>Mở F12 → Console để xem chi tiết log loadAll & insert</li>
              <li>Sau khi cứu dữ liệu mồ côi, refresh (F5) trang web</li>
              <li>"Của bạn" hiển thị 0 nhưng đã tạo nhiều = data chưa lưu được — báo tôi xem log console</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-black/8 bg-white p-2 text-center">
      <div className="text-lg font-semibold tabular-nums text-gray-900">{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  )
}
