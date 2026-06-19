// ── Exported-video library modal (P6y) ───────────────────────────────────────
// Lists every FINAL assembled video (not broll/lips clips). Survives "Tạo lại từ đầu"
// because it reads from the standalone exportedVideoLibrary store. Re-download = 0 credit
// (the file is still in Supabase Storage; we just resolve a signed URL).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { X, Download, Trash2, Film } from 'lucide-react'
import { useAssetUrl } from '../../../../hooks/useAssetUrl'
import { getExportedVideos, deleteExportedVideo, type ExportedVideo } from '../services/exportedVideoLibrary'

function pad(n: number): string { return String(n).padStart(2, '0') }
function fmt(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function VideoRow({ v, onDelete }: { v: ExportedVideo; onDelete: () => void }) {
  const url = useAssetUrl(v.assetRef)
  const safeName = v.productName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'video'
  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2">
      <Film className="h-4 w-4 shrink-0 text-violet-500" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-800">{v.productName}</p>
        <p className="text-[11px] text-gray-500">{fmt(v.createdAt)} · {v.resolution} · {v.lang.toUpperCase()}</p>
      </div>
      {url ? (
        <a href={url} download={`ugc-${safeName}.mp4`}
          className="flex shrink-0 items-center gap-1 rounded-md bg-violet-600 px-2 py-1 text-xs font-bold text-white hover:bg-violet-700">
          <Download className="h-3.5 w-3.5" /> Tải
        </a>
      ) : (
        <span className="shrink-0 text-[11px] text-gray-400">đang lấy link…</span>
      )}
      <button onClick={onDelete} title="Xoá khỏi danh sách (KHÔNG xoá file gốc trên cloud)"
        className="shrink-0 rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export default function ExportedVideoLibrary({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<ExportedVideo[]>(() => getExportedVideos())
  const refresh = () => setList(getExportedVideos())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[82vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-gray-50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <h3 className="text-base font-bold text-gray-900">📚 Video đã xuất ({list.length})</h3>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <p className="shrink-0 px-4 pt-2 text-[11px] text-gray-500">
          Chỉ video ĐÃ GHÉP hoàn chỉnh (không lưu clip broll/lips lẻ). Còn đây kể cả sau “Tạo lại từ đầu”. Tải lại 0 credit.
        </p>
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {list.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">Chưa có video nào. Ghép xong 1 video là nó tự lưu vào đây.</p>
          ) : (
            list.map((v) => <VideoRow key={v.id} v={v} onDelete={() => { deleteExportedVideo(v.id); refresh() }} />)
          )}
        </div>
      </div>
    </div>
  )
}
