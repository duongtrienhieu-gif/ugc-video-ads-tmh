// ── Job Result Card (P13 — consumes GenerationJob) ─────────────────────────
//
// Displays a single GenerationJob from the workspace store with:
//   • Asset type label + engine group badge + aspect ratio
//   • Status pill (queued / generating / completed / failed)
//   • Image preview when completed (resolved via useAssetUrl from
//     the asset:xxx ref in job.outputs[0].outputUrl)
//   • Per-job actions: Download / Delete (delete cascades to DB)
//   • QC badge when present in completed asset metadata

import { Download, Trash2, ShieldCheck, ShieldAlert, AlertTriangle, Loader2, Clock } from 'lucide-react'
import { useAssetUrl } from '../../../hooks/useAssetUrl'
import { findCatalogEntry } from './assetCatalog'
import type { GenerationJob } from '../stores/generationsStore'

interface ResultCardProps {
  job: GenerationJob
  onDelete: () => void
}

export default function ResultCard({ job, onDelete }: ResultCardProps) {
  const entry = findCatalogEntry(job.creativeType)
  const firstAsset = job.outputs[0]
  const displayUrl = useAssetUrl(firstAsset?.outputUrl)

  const handleDownload = () => {
    if (!displayUrl) return
    const a = document.createElement('a')
    a.href = displayUrl
    a.download = `${job.creativeType}-${job.id.slice(0, 8)}.jpg`
    a.click()
  }

  const aspect = entry?.aspectRatio ?? firstAsset?.metadata.aspectRatio ?? '1:1'
  const aspectClass =
    aspect === '9:16'  ? 'aspect-[9/16]'
      : aspect === '4:5'   ? 'aspect-[4/5]'
      : aspect === '16:9'  ? 'aspect-[16/9]'
      : 'aspect-square'

  const groupBadgeClass =
    firstAsset?.metadata.engineGroup === 'photographic'      ? 'bg-rose-100 text-rose-800'
      : firstAsset?.metadata.engineGroup === 'ui-native'       ? 'bg-indigo-100 text-indigo-800'
      : firstAsset?.metadata.engineGroup === 'designed-graphic' ? 'bg-amber-100 text-amber-800'
      : 'bg-gray-100 text-gray-700'

  const qc = firstAsset?.metadata.qcSummary

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Card header */}
      <div className="flex items-center justify-between gap-2 border-b border-black/8 bg-gray-50/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[12px] font-semibold text-gray-800">
            {entry?.title.vi ?? job.creativeType}
          </span>
          {firstAsset && (
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ${groupBadgeClass}`}>
              {firstAsset.metadata.engineGroup}
            </span>
          )}
        </div>
        <span className="shrink-0 rounded bg-black/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-gray-600">
          {aspect}
        </span>
      </div>

      {/* Image / status area */}
      <div className={`relative ${aspectClass} bg-gray-100`}>
        {job.status === 'queued' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-gray-50 to-gray-100">
            <Clock className="h-7 w-7 text-gray-400" />
            <span className="text-[11px] font-medium text-gray-500">Trong hàng đợi…</span>
          </div>
        )}

        {job.status === 'generating' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden bg-gradient-to-br from-violet-50 via-gray-100 to-violet-50">
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-violet-100/40 via-transparent to-violet-100/40" />
            <Loader2 className="relative h-7 w-7 animate-spin text-violet-500" />
            <span className="relative text-[11px] font-medium text-violet-700">Đang render qua engine…</span>
            {job.progress > 0 && (
              <div className="relative h-1 w-2/3 overflow-hidden rounded-full bg-white/60">
                <div
                  className="h-full bg-violet-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }}
                />
              </div>
            )}
          </div>
        )}

        {job.status === 'failed' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-50/50 p-3 text-center">
            <AlertTriangle className="h-7 w-7 text-red-400" />
            <span className="text-[11px] font-semibold text-red-700">{job.errorMessage ?? 'Tạo thất bại'}</span>
            <span className="text-[9px] text-red-400/80">Bấm 🗑 để xoá hoặc tạo job mới ở panel trái</span>
          </div>
        )}

        {job.status === 'completed' && displayUrl && (
          <img src={displayUrl} alt={job.creativeType} className="h-full w-full object-cover" />
        )}

        {job.status === 'completed' && qc && (
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

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="text-[10px] text-gray-400">
          {new Date(job.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={job.status !== 'completed'}
            onClick={handleDownload}
            title="Tải xuống"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-black/10 bg-white text-gray-600 transition-colors hover:bg-black/[0.04] disabled:opacity-40"
          >
            <Download className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Xoá job (cả ở DB)"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-black/10 bg-white text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
