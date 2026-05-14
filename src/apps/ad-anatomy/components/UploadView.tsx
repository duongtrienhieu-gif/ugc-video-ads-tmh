import { useState, useRef, useCallback } from 'react'
import { Upload, Film, X, Clapperboard, Eye } from 'lucide-react'

const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const MAX_SIZE_MB = 50

interface UploadViewProps {
  onAnalyze: (file: File) => void
}

export default function UploadView({ onAnalyze }: UploadViewProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateAndSet = useCallback((f: File) => {
    setError(null)
    const ok = ACCEPTED_TYPES.includes(f.type) || f.type.startsWith('video/')
    if (!ok) {
      setError('Định dạng không hỗ trợ. Dùng MP4, MOV, hoặc WebM.')
      return
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File quá lớn. Tối đa ${MAX_SIZE_MB}MB.`)
      return
    }
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) validateAndSet(f)
  }, [validateAndSet])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) validateAndSet(f)
  }

  const clearFile = () => {
    setFile(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-6 p-8">
      {/* POWERED BY GEMINI badge */}
      <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full border border-black/10 bg-black/[0.04] px-2.5 py-1">
        <span className="text-[9px] font-medium uppercase tracking-widest text-gray-400">Powered by</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#4285F4]">Gemini</span>
      </div>

      {/* Header */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FB2B37]/10">
          <Eye className="h-7 w-7 text-[#FB2B37]" strokeWidth={1.5} />
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-gray-800">
          Phân tích một quảng cáo
        </h2>
        <p className="max-w-sm text-sm text-gray-500">
          Tải lên video quảng cáo và chúng tôi sẽ phân tích từng khung hình, hook, và chiến thuật thuyết phục.
        </p>
      </div>

      {!file ? (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            className={`flex h-56 w-full max-w-md flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-all duration-200 ${dragOver
              ? 'border-[#FB2B37]/40 bg-[#FB2B37]/5'
              : 'border-black/10 bg-black/[0.02] hover:border-black/15 hover:bg-black/[0.04]'
              }`}
          >
            <Upload className={`h-6 w-6 transition-colors ${dragOver ? 'text-[#FB2B37]' : 'text-gray-400'}`} />
            <span className="text-sm text-gray-600">
              Kéo thả video vào đây hoặc{' '}
              <span className="font-semibold text-gray-800 underline underline-offset-2">duyệt</span>
            </span>
            <span className="text-[11px] text-gray-400">MP4, MOV, WebM — tối đa {MAX_SIZE_MB}MB</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/mov,video/quicktime,video/webm,video/*"
            className="hidden"
            onChange={handleFileInput}
          />
        </>
      ) : (
        <div className="flex w-full max-w-md flex-col gap-4">
          {/* Video preview */}
          <div className="relative overflow-hidden rounded-xl border border-black/10 bg-black">
            <video
              src={preview!}
              className="aspect-video w-full object-contain"
              controls
              muted
            />
            <button
              onClick={clearFile}
              className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-gray-600 backdrop-blur transition-colors hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* File info */}
          <div className="flex items-center justify-between rounded-lg bg-black/[0.03] px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <Film className="h-4 w-4 text-gray-400" />
              <span className="max-w-[200px] truncate text-sm text-gray-700">{file.name}</span>
            </div>
            <span className="shrink-0 text-xs tabular-nums text-gray-400">{formatSize(file.size)}</span>
          </div>

          {/* Analyze button */}
          <button
            onClick={() => onAnalyze(file)}
            className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-full bg-[#FB2B37] px-6 py-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-[#FB2B37]/90"
          >
            <div className="pointer-events-none absolute inset-0 z-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
            <span className="relative z-10 flex items-center gap-2">
              <Clapperboard className="h-4 w-4" />
              Phân tích quảng cáo
            </span>
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-[#FB2B37]">{error}</p>
      )}
    </div>
  )
}
