import { useState, useRef } from 'react'
import { X, Upload, Loader2, Mic, AlertTriangle } from 'lucide-react'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useAppStore } from '../../../stores/appStore'
import { cloneVoice } from '../../../utils/elevenlabs'

interface CloneVoiceModalProps {
  open: boolean
  onClose: () => void
  onCloned: (voiceId: string) => void
}

export default function CloneVoiceModal({ open, onClose, onCloned }: CloneVoiceModalProps) {
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState('')
  const [isCloning, setIsCloning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addToast = useAppStore((s) => s.addToast)
  const hasKey = useSettingsStore((s) => s.hasElevenLabsKey())

  if (!open) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('audio/')) {
      addToast('Chỉ chấp nhận file audio (.mp3, .wav, .m4a)', 'error')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      addToast('File quá lớn (tối đa 10 MB)', 'error')
      return
    }
    setFile(f)
  }

  const handleClone = async () => {
    if (!name.trim() || !file) return
    setIsCloning(true)
    try {
      const apiKey = useSettingsStore.getState().getElevenLabsApiKey()
      const voiceId = await cloneVoice({ apiKey, name: name.trim(), file, description: description.trim() || undefined })
      addToast(`Đã clone giọng "${name.trim()}" thành công`)
      onCloned(voiceId)
      setName('')
      setDescription('')
      setFile(null)
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Clone giọng thất bại: ${msg}`, 'error')
    } finally {
      setIsCloning(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-md rounded-xl border border-black/10 bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
              <Mic className="h-4 w-4 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-gray-900">Clone giọng mới</h2>
              <p className="text-[11px] text-gray-400">Upload mẫu giọng để tạo voice clone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isCloning}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* No key warning */}
          {!hasKey && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-[12px] leading-relaxed text-amber-700">
                Chưa có ElevenLabs API key. Vào <strong>Cài đặt</strong> để nhập key trước khi tạo voice clone.
              </p>
            </div>
          )}

          {/* Name */}
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-widest text-gray-500">Tên giọng *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Aisha — UGC Nữ Malaysia"
              maxLength={100}
              disabled={isCloning}
              className="w-full rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-indigo-300 focus:bg-white"
            />
          </label>

          {/* Description */}
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-widest text-gray-500">Mô tả (không bắt buộc)</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Giọng nữ trẻ, accent KL"
              maxLength={200}
              disabled={isCloning}
              className="w-full rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-indigo-300 focus:bg-white"
            />
          </label>

          {/* File upload */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-widest text-gray-500">File mẫu giọng *</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/x-m4a,audio/mp4"
              onChange={handleFileChange}
              disabled={isCloning}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isCloning}
              className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-black/15 bg-black/[0.02] px-4 py-3 text-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50/30"
            >
              {file ? (
                <span className="text-gray-700 truncate max-w-[280px]">📎 {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
              ) : (
                <>
                  <Upload className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-500">Chọn file audio (mp3, wav, m4a)</span>
                </>
              )}
            </button>
            <p className="text-[11px] leading-relaxed text-gray-400">
              Khuyến nghị: 30–60 giây giọng người Malaysia thật, rõ tiếng, không nhạc nền. Tối đa 10 MB.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              disabled={isCloning}
              className="flex-1 rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-black/5"
            >
              Hủy
            </button>
            <button
              onClick={handleClone}
              disabled={isCloning || !name.trim() || !file || !hasKey}
              className="flex flex-[1.5] items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isCloning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang clone giọng...
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  Tạo voice clone
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
