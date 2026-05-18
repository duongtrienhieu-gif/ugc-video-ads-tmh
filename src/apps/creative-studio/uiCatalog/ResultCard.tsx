// ── Typed Result Card (P11) ─────────────────────────────────────────────────
//
// Displays a GeneratedAsset from the registry pipeline with:
//   • Asset type label + engine group badge
//   • Aspect ratio badge
//   • QC status (from asset.metadata.qcSummary, populated by the
//     dispatcher in P7/P9)
//   • Timestamp
//   • Save / Download / Delete actions
//
// Replaces the legacy 4-tile fixed grid with a single typed card per
// generated asset.

import { Download, Save, Check, Trash2, ShieldCheck, ShieldAlert, AlertTriangle, Loader2 } from 'lucide-react'
import type { GeneratedAsset } from '../types/asset'
import { useAssetUrl } from '../../../hooks/useAssetUrl'
import { findCatalogEntry } from './assetCatalog'

export type ResultStatus = 'pending' | 'done' | 'error'

export interface ResultRow {
  /** Stable id for the row (one per generation attempt). */
  rowId: string
  status: ResultStatus
  /** Set when status='done'. */
  asset?: GeneratedAsset
  /** Set when status='error'. */
  errorMessage?: string
  /** Captured at the moment generation was requested. */
  requestedAt: number
  /** AssetTypeId used (so we can show the right label even before
   *  the asset finishes generating). */
  assetTypeId: string
}

interface ResultCardProps {
  row: ResultRow
  saved: boolean
  onSave: () => void
  onDelete: () => void
}

export default function ResultCard({ row, saved, onSave, onDelete }: ResultCardProps) {
  const entry = findCatalogEntry(row.assetTypeId as never)
  const displayUrl = useAssetUrl(row.asset?.outputUrl)

  const handleDownload = () => {
    if (!displayUrl) return
    const a = document.createElement('a')
    a.href = displayUrl
    a.download = `${row.assetTypeId}-${row.rowId}.jpg`
    a.click()
  }

  const aspectClass =
    entry?.aspectRatio === '9:16' ? 'aspect-[9/16]'
      : entry?.aspectRatio === '4:5' ? 'aspect-[4/5]'
      : entry?.aspectRatio === '16:9' ? 'aspect-[16/9]'
      : 'aspect-square'

  const qc = row.asset?.metadata.qcSummary
  const groupBadgeClass =
    row.asset?.metadata.engineGroup === 'photographic'      ? 'bg-rose-100 text-rose-800'
      : row.asset?.metadata.engineGroup === 'ui-native'      ? 'bg-indigo-100 text-indigo-800'
      : row.asset?.metadata.engineGroup === 'designed-graphic' ? 'bg-amber-100 text-amber-800'
      : 'bg-gray-100 text-gray-700'

  return (
    <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
      {/* Card header — type badges */}
      <div className="flex items-center justify-between gap-2 border-b border-black/8 bg-gray-50/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[12px] font-semibold text-gray-800">
            {entry?.title.vi ?? row.assetTypeId}
          </span>
          {row.asset && (
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ${groupBadgeClass}`}>
              {row.asset.metadata.engineGroup}
            </span>
          )}
        </div>
        <span className="shrink-0 rounded bg-black/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-gray-600">
          {entry?.aspectRatio ?? row.asset?.metadata.aspectRatio ?? '1:1'}
        </span>
      </div>

      {/* Image area */}
      <div className={`relative ${aspectClass} bg-gray-100`}>
        {row.status === 'pending' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-violet-50 via-gray-100 to-violet-50">
            <Loader2 className="h-7 w-7 animate-spin text-violet-500" />
            <span className="text-[11px] font-medium text-violet-700">Đang tạo qua engine...</span>
          </div>
        )}

        {row.status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-50/40 p-3 text-center">
            <AlertTriangle className="h-7 w-7 text-red-400" />
            <span className="text-[11px] font-semibold text-red-700">Tạo thất bại</span>
            {row.errorMessage && (
              <span className="line-clamp-3 text-[10px] text-red-500/80">{row.errorMessage.slice(0, 140)}</span>
            )}
          </div>
        )}

        {row.status === 'done' && displayUrl && (
          <img src={displayUrl} alt={row.assetTypeId} className="h-full w-full object-cover" />
        )}

        {/* QC badge bottom-left */}
        {row.status === 'done' && qc && (
          <span
            title={qc.issues?.map((i) => i.message).join(' · ') ?? `Score ${qc.overall}`}
            className={`absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm ${
              qc.passed ? 'bg-emerald-500/90' : 'bg-amber-500/90'
            }`}
          >
            {qc.passed ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
            QC {qc.overall}
          </span>
        )}
      </div>

      {/* Action footer */}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="text-[10px] text-gray-400">
          {row.status === 'done' && row.asset
            ? new Date(row.asset.metadata.generatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
            : ' '}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={row.status !== 'done'}
            onClick={onSave}
            title="Lưu vào Project → Creative Studio"
            className={`flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-semibold transition-colors disabled:opacity-40 ${
              saved
                ? 'bg-emerald-500 text-white'
                : 'border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            {saved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
            {saved ? 'Đã lưu' : 'Lưu'}
          </button>
          <button
            type="button"
            disabled={row.status !== 'done'}
            onClick={handleDownload}
            title="Tải xuống"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-black/10 bg-white text-gray-600 transition-colors hover:bg-black/[0.04] disabled:opacity-40"
          >
            <Download className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Xoá khỏi danh sách"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-black/10 bg-white text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
