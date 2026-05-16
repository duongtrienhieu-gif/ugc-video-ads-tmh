// ── DraftsPanel — "Bản nháp chưa hoàn thành" sidebar drawer ─────────────────
// Phase R7 — Figma/Canva-style ongoing-drafts list. Available any time from
// the sidebar, not just at boot. Shows the same pending sessions the global
// RestoreSessionModal would, but accessible on demand.
//
// UX:
//   - Slide-in drawer from the left (immediately to the right of the sidebar)
//   - Auto-refreshes every 5s while open
//   - Click an entry → navigate to that module
//   - Click trash → discard (with confirmation)
//   - Empty state when nothing in flight
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { X, FolderOpen, Trash2, ArrowRight, Inbox } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import {
  scanForPendingSessions,
  discardSession,
  formatRelativeVi,
} from '../services/sessionPersistence'
import type { SessionMeta } from '../services/sessionPersistence'

interface Props {
  open: boolean
  onClose: () => void
}

const SCAN_INTERVAL_MS = 5000

export default function DraftsPanel({ open, onClose }: Props) {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [confirmDiscardKey, setConfirmDiscardKey] = useState<string | null>(null)
  const openApp = useAppStore((s) => s.openApp)

  // Initial scan + interval refresh while panel is open
  useEffect(() => {
    if (!open) return
    setSessions(scanForPendingSessions())
    const id = setInterval(() => setSessions(scanForPendingSessions()), SCAN_INTERVAL_MS)
    return () => clearInterval(id)
  }, [open])

  // ESC to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleOpen = (s: SessionMeta) => {
    openApp(s.moduleId)
    onClose()
  }

  const handleDiscard = (s: SessionMeta) => {
    discardSession(s.persistKey)
    setSessions((prev) => prev.filter((x) => x.persistKey !== s.persistKey))
    setConfirmDiscardKey(null)
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[150] bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed left-[72px] top-0 z-[151] h-full w-[380px] overflow-hidden bg-white shadow-2xl transition-transform animate-in slide-in-from-left duration-200">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 border-b border-black/8 bg-gradient-to-br from-violet-50 to-pink-50 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm">
              <FolderOpen className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-gray-900">Bản nháp chưa hoàn thành</h2>
              <p className="text-[11px] text-gray-500">{sessions.length} phiên đang dang dở</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {sessions.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-gray-300">
                <Inbox className="h-10 w-10 opacity-50" />
                <p className="text-xs font-medium text-gray-400">Không có bản nháp</p>
                <p className="max-w-xs text-[11px] leading-relaxed text-gray-400">
                  Khi bạn rời module giữa chừng, công việc sẽ tự lưu vào đây — đóng tab, F5, hoặc tắt máy cũng không mất.
                </p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {sessions.map((s) => (
                  <li
                    key={s.persistKey}
                    className="group relative overflow-hidden rounded-xl border border-black/8 bg-white p-3 transition-all hover:border-violet-300 hover:shadow-md"
                  >
                    <button
                      onClick={() => handleOpen(s)}
                      className="flex w-full flex-col items-start gap-1 text-left"
                    >
                      <div className="flex w-full items-center gap-2">
                        <span className="text-[13px] font-bold text-gray-900">{s.moduleNameVi}</span>
                        {s.status === 'in-progress' && (
                          <span className="ml-auto rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700">
                            đang chạy
                          </span>
                        )}
                        {s.status === 'paused' && (
                          <span className="ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                            tạm dừng
                          </span>
                        )}
                      </div>
                      {s.titleVi && (
                        <p className="w-full truncate text-[11px] text-gray-600">{s.titleVi}</p>
                      )}
                      {s.progressVi && (
                        <p className="w-full truncate text-[11px] font-medium text-violet-600">{s.progressVi}</p>
                      )}
                      <p className="text-[10px] text-gray-400">{formatRelativeVi(s.updatedAt)}</p>
                    </button>

                    {/* Hover actions */}
                    <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpen(s) }}
                        title="Mở"
                        className="rounded-md bg-violet-600 p-1.5 text-white shadow-sm hover:bg-violet-700"
                      >
                        <ArrowRight className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDiscardKey(s.persistKey) }}
                        title="Bỏ"
                        className="rounded-md border border-red-200 bg-white p-1.5 text-red-600 shadow-sm hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Inline discard confirmation */}
                    {confirmDiscardKey === s.persistKey && (
                      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px]">
                        <span className="text-red-700">Xoá vĩnh viễn bản nháp này?</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setConfirmDiscardKey(null)}
                            className="rounded border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            Huỷ
                          </button>
                          <button
                            onClick={() => handleDiscard(s)}
                            className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-red-700"
                          >
                            Xoá
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-black/8 bg-gray-50 px-4 py-2">
            <p className="text-center text-[10px] text-gray-400">
              Tự động cập nhật mỗi 5 giây · Nhấn ESC để đóng
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
