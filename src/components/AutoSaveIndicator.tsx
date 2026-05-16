// ── AutoSaveIndicator — Canva-style "đã lưu" chip ───────────────────────────
// Subtle non-blocking indicator that the current module is being auto-saved.
// Reads from useSessionPersist's lastSavedAt / lastSaveOk.
// Phase R2 spec.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { Check, AlertCircle } from 'lucide-react'
import { formatRelativeVi } from '../services/sessionPersistence'

interface Props {
  /** ms timestamp of last successful save — null when no save has happened yet. */
  lastSavedAt: number | null
  /** False when the last save attempt failed (storage full, etc.). */
  lastSaveOk: boolean
  /** Override label — defaults to "Đã lưu tự động" / "Lỗi khi lưu". */
  labelOk?: string
  labelErr?: string
  /** Hide entirely until first save completes (default: true). */
  hideUntilFirstSave?: boolean
}

export default function AutoSaveIndicator({
  lastSavedAt,
  lastSaveOk,
  labelOk = 'Đã lưu tự động',
  labelErr = 'Lỗi khi lưu',
  hideUntilFirstSave = true,
}: Props) {
  // Re-render every 15s so the "x phút trước" text stays fresh
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 15000)
    return () => clearInterval(id)
  }, [])

  if (hideUntilFirstSave && lastSavedAt === null) return null

  if (!lastSaveOk) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700">
        <AlertCircle className="h-3 w-3" />
        {labelErr}
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/60 px-2.5 py-1 text-[11px] font-medium text-emerald-700"
      title={lastSavedAt ? `Lưu lần cuối: ${formatRelativeVi(lastSavedAt)}` : ''}
    >
      <Check className="h-3 w-3" />
      <span>{labelOk}</span>
      {lastSavedAt && (
        <span className="text-[10px] font-normal text-emerald-500">· {formatRelativeVi(lastSavedAt)}</span>
      )}
    </div>
  )
}
