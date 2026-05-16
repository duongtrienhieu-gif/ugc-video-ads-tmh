// ── RestoreSessionModal ─────────────────────────────────────────────────────
// Global modal mounted in App.tsx that shows after auth + before any module
// is interacted with. Lists every pending session from session-persistence
// registry and lets the user [Khôi phục] / [Bỏ] each one (or batch).
//
// UX:
//   - Modal blocks the screen with a soft backdrop
//   - Can't be closed via backdrop click — user must choose
//   - ESC = the same as "Bỏ tất cả" (no work lost since data only deletes after explicit confirm)
//   - Per-session [Khôi phục] [Bỏ] buttons + footer [Khôi phục tất cả] [Bỏ tất cả]
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { RotateCcw, Trash2, X, Clock, CheckCircle2 } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import {
  scanForPendingSessions,
  pruneExpiredSnapshots,
  formatRelativeVi,
  restoreCoordinator,
} from '../services/sessionPersistence'
import type { SessionMeta } from '../services/sessionPersistence'

export default function RestoreSessionModal() {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const openApp = useAppStore((s) => s.openApp)
  const addToast = useAppStore((s) => s.addToast)

  // Boot-time scan
  useEffect(() => {
    pruneExpiredSnapshots()
    const found = scanForPendingSessions()
    if (found.length === 0) return
    restoreCoordinator.initFromScan()
    setSessions(found)
    setIsOpen(true)
  }, [])

  // Per-session [Khôi phục] — accept this one, leave others pending
  const handleRestoreOne = (s: SessionMeta) => {
    restoreCoordinator.accept(s.persistKey)
    setSessions((prev) => prev.filter((x) => x.persistKey !== s.persistKey))
    if (!restoreCoordinator.hasAnyPending()) {
      setIsOpen(false)
      addToast(`Đã khôi phục: ${s.moduleNameVi}`, 'success')
    }
    // Auto-navigate to that module
    openApp(s.moduleId)
  }

  // Per-session [Bỏ]
  const handleDiscardOne = (s: SessionMeta) => {
    restoreCoordinator.discard(s.persistKey)
    setSessions((prev) => prev.filter((x) => x.persistKey !== s.persistKey))
    if (!restoreCoordinator.hasAnyPending()) {
      setIsOpen(false)
    }
  }

  const handleRestoreAll = () => {
    const first = sessions[0]
    restoreCoordinator.acceptAll()
    setSessions([])
    setIsOpen(false)
    addToast(`Đã khôi phục ${sessions.length} phiên làm việc`, 'success')
    if (first) openApp(first.moduleId)
  }

  const handleDiscardAll = () => {
    restoreCoordinator.discardAll()
    setSessions([])
    setIsOpen(false)
  }

  // ESC = discard all (safest — user can always re-do their work)
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDiscardAll()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen || sessions.length === 0) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-black/8 bg-gradient-to-br from-violet-50 to-pink-50 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md">
            <RotateCcw className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-gray-900">Khôi phục phiên làm việc trước?</h2>
            <p className="mt-0.5 text-xs text-gray-600">
              Bạn có {sessions.length} {sessions.length === 1 ? 'tính năng' : 'tính năng'} chưa hoàn thành. Khôi phục để tiếp tục, hoặc bỏ để bắt đầu mới.
            </p>
          </div>
        </div>

        {/* Session list */}
        <div className="max-h-[60vh] overflow-y-auto px-5 py-3">
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li
                key={s.persistKey}
                className="flex items-start gap-3 rounded-xl border border-black/8 bg-white px-3 py-2.5 transition-shadow hover:shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">{s.moduleNameVi}</span>
                    {s.status === 'in-progress' && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                        đang tạo dở
                      </span>
                    )}
                    {s.status === 'paused' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        đã dừng
                      </span>
                    )}
                  </div>
                  {s.titleVi && (
                    <p className="mt-0.5 truncate text-xs text-gray-600">{s.titleVi}</p>
                  )}
                  {s.progressVi && (
                    <p className="mt-0.5 text-[11px] font-medium text-gray-500">{s.progressVi}</p>
                  )}
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-gray-400">
                    <Clock className="h-2.5 w-2.5" />
                    Cập nhật {formatRelativeVi(s.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <button
                    onClick={() => handleRestoreOne(s)}
                    title="Khôi phục phiên này"
                    className="flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-violet-700"
                  >
                    <RotateCcw className="h-3 w-3" /> Khôi phục
                  </button>
                  <button
                    onClick={() => handleDiscardOne(s)}
                    title="Bỏ phiên này"
                    className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    <Trash2 className="h-3 w-3" /> Bỏ
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer bulk actions */}
        {sessions.length > 1 && (
          <div className="flex items-center gap-2 border-t border-black/8 bg-gray-50 px-5 py-3">
            <button
              onClick={handleRestoreAll}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Khôi phục tất cả
            </button>
            <button
              onClick={handleDiscardAll}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <X className="h-3.5 w-3.5" /> Bỏ tất cả
            </button>
          </div>
        )}
        {sessions.length === 1 && (
          <div className="border-t border-black/8 bg-gray-50 px-5 py-2">
            <p className="text-center text-[10px] text-gray-400">
              Bỏ sẽ xoá vĩnh viễn dữ liệu của phiên này. Không thể hoàn tác.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
