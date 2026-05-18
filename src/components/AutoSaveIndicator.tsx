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

  // Mobile (<768px): icon-only pill — hides "Đã lưu tự động" + "x phút
  // trước" text. Tooltip still shows the timestamp on long-press.
  // Desktop (md+): full original layout unchanged.
  if (!lastSaveOk) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-1.5 py-1 md:px-2.5 text-[11px] font-medium text-red-700"
        title={labelErr}
        aria-label={labelErr}
      >
        <AlertCircle className="h-3 w-3" />
        <span className="hidden md:inline">{labelErr}</span>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/60 px-1.5 py-1 md:px-2.5 text-[11px] font-medium text-emerald-700"
      title={lastSavedAt ? `${labelOk} — Lưu lần cuối: ${formatRelativeVi(lastSavedAt)}` : labelOk}
      aria-label={labelOk}
    >
      <Check className="h-3 w-3" />
      <span className="hidden md:inline">{labelOk}</span>
      {lastSavedAt && (
        <span className="hidden md:inline text-[10px] font-normal text-emerald-500">· {formatRelativeVi(lastSavedAt)}</span>
      )}
    </div>
  )
}
