import { useState, useRef } from 'react'
import { Upload, X, Loader2, Sparkles, Wand2, Save, Check } from 'lucide-react'
import ChipField from './ChipField'
import { generateClone, randomCloneFields, CLONE_FIELD_CHIPS } from '../services/generateClone'
import type { CloneFields } from '../services/generateClone'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useAppStore } from '../../../stores/appStore'
import { useBankStore } from '../../../stores/bankStore'
import { useAssetUrl } from '../../../hooks/useAssetUrl'

const EMPTY: CloneFields = { expression: '', outfit: '', background: '' }

/**
 * "Tạo Avatar Clone" — upload a face, keep it (no drift), restyle only
 * expression / outfit / background via gpt-4o-image i2i. Fully separate from
 * "Tạo Avatar Random" so the two control sets don't conflict.
 */
export default function CloneStudio() {
  const [face, setFace] = useState<{ file: File; preview: string } | null>(null)
  const [fields, setFields] = useState<CloneFields>(EMPTY)
  const [isGenerating, setIsGenerating] = useState(false)
  const [resultRef, setResultRef] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [saved, setSaved] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [status, setStatus] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const elapsedLabel = elapsed >= 60 ? `${Math.floor(elapsed / 60)}m${String(elapsed % 60).padStart(2, '0')}s` : `${elapsed}s`

  const kieApiKey = useSettingsStore((s) => s.kieApiKey)
  const addToast = useAppStore((s) => s.addToast)
  const addModel = useBankStore((s) => s.addModel)
  const resultUrl = useAssetUrl(resultRef ?? undefined)

  const setFaceFile = (f: File) => {
    if (!f.type.startsWith('image/')) { addToast('File phải là ảnh', 'error'); return }
    if (f.size > 10 * 1024 * 1024) { addToast('Ảnh tối đa 10MB', 'error'); return }
    if (face?.preview) URL.revokeObjectURL(face.preview)
    setFace({ file: f, preview: URL.createObjectURL(f) })
  }

  const setField = (k: keyof CloneFields, v: string) => setFields((p) => ({ ...p, [k]: v }))

  const handleGenerate = async () => {
    if (!kieApiKey.trim()) { addToast('Vui lòng nhập kie.ai API key trong Cài đặt', 'error'); return }
    if (!face) { addToast('Hãy tải ảnh khuôn mặt lên trước', 'error'); return }
    setIsGenerating(true)
    setResultRef(null)
    setElapsed(0)
    setStatus('Đang gửi yêu cầu...')
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000)
    try {
      const ref = await generateClone({
        apiKey: kieApiKey,
        faceFile: face.file,
        fields,
        onStatus: (s) => setStatus(
          s === 'processing' ? 'Đang dựng ảnh...'
          : s === 'pending' ? 'Đang chờ hàng đợi...'
          : s === 'completed' ? 'Hoàn tất'
          : 'Đang xử lý...',
        ),
      })
      setResultRef(ref)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === 'INSUFFICIENT_CREDITS') addToast('Không đủ Credit kie.ai', 'error')
      else if (msg.startsWith('TIMEOUT')) addToast('Tạo ảnh quá thời gian (gpt-4o-image bị nghẽn). Thử lại.', 'error')
      else addToast(`Tạo Clone thất bại: ${msg}`, 'error')
    } finally {
      clearInterval(timer)
      setIsGenerating(false)
    }
  }

  const handleSaveToProject = async () => {
    if (!resultRef) return
    try {
      await addModel({
        characterImage: resultRef,
        name: 'Avatar Clone',
        notes: 'Clone giữ mặt — Avatar AI',
        jsonProfile: null,
        source: 'character-studio',
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      addToast('✓ Đã lưu Avatar Clone vào Project')
    } catch (err) {
      addToast(`Lưu thất bại: ${err instanceof Error ? err.message.slice(0, 80) : 'unknown'}`, 'error')
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* ── Controls (left) ── */}
      <div className="flex w-full shrink-0 flex-col overflow-y-auto border-b border-black/8 lg:w-1/2 lg:border-b-0 lg:border-r">
        {/* Face upload */}
        <div className="border-b border-black/8 px-4 py-3">
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-gray-400">
            Ảnh khuôn mặt — sẽ được giữ nguyên (không drift)
          </p>
          {face ? (
            <div className="flex items-center gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-black/10">
                <img src={face.preview} alt="" className="h-full w-full object-cover" />
              </div>
              <span className="flex-1 text-xs text-gray-500">Mặt này được khoá khi tạo — chỉ đổi biểu cảm/trang phục/nền</span>
              <button
                onClick={() => { if (face.preview) URL.revokeObjectURL(face.preview); setFace(null); if (inputRef.current) inputRef.current.value = '' }}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setFaceFile(f) }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              className={`flex w-full items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-left transition-all ${dragOver ? 'border-violet-500/40 bg-violet-500/5' : 'border-black/10 bg-black/[0.02] hover:border-black/15 hover:bg-black/[0.03]'}`}
            >
              <Upload className={`h-4 w-4 shrink-0 transition-colors ${dragOver ? 'text-violet-400' : 'text-gray-400'}`} />
              <span className="text-xs text-gray-400">Thả ảnh khuôn mặt vào đây — JPG, PNG, WebP — tối đa 10MB hoặc nhấn để duyệt</span>
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setFaceFile(f) }}
          />
        </div>

        {/* UGC Creator random */}
        <div className="border-b border-black/8 px-3 py-2">
          <span className="mb-1.5 block text-[9px] font-semibold uppercase tracking-widest text-gray-400">Tự động</span>
          <button
            onClick={() => setFields(randomCloneFields())}
            className="flex items-center gap-1 rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-violet-500/10 hover:text-violet-500"
          >
            <Wand2 className="h-3 w-3" />
            UGC Creator — random 3 trường
          </button>
        </div>

        {/* 3 restyle fields */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-5">
            <ChipField fieldKey="clone_expression" label="Biểu cảm" value={fields.expression} chips={CLONE_FIELD_CHIPS.expression} onChange={(v) => setField('expression', v)} placeholder="Chọn hoặc nhập biểu cảm..." />
            <ChipField fieldKey="clone_outfit" label="Trang phục" value={fields.outfit} chips={CLONE_FIELD_CHIPS.outfit} onChange={(v) => setField('outfit', v)} placeholder="Chọn hoặc nhập trang phục..." />
            <ChipField fieldKey="clone_background" label="Background / Bối cảnh" value={fields.background} chips={CLONE_FIELD_CHIPS.background} onChange={(v) => setField('background', v)} placeholder="Chọn hoặc nhập bối cảnh..." />
          </div>
        </div>
      </div>

      {/* ── Output (right) ── */}
      <div className="flex min-h-[300px] min-w-0 flex-1 flex-col overflow-hidden p-4 lg:min-h-0">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !face || !kieApiKey.trim()}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isGenerating ? (<><Loader2 className="h-4 w-4 animate-spin" /> Đang tạo Clone... {elapsedLabel}</>) : (<><Sparkles className="h-4 w-4" /> Tạo Avatar Clone</>)}
        </button>

        <div className="flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-black/8 bg-black/[0.02]">
          {isGenerating ? (
            <div className="flex flex-col items-center gap-2 px-6 text-center text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-xs">{status || 'Giữ mặt, đổi biểu cảm / trang phục / nền...'}</span>
              <span className="text-[11px] tabular-nums text-gray-400">{elapsedLabel} · gpt-4o-image thường mất 1–4 phút</span>
            </div>
          ) : resultUrl ? (
            <img src={resultUrl} alt="Avatar Clone" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="px-6 text-center text-xs text-gray-400">Tải ảnh mặt + chọn biểu cảm / trang phục / nền → nhấn "Tạo Avatar Clone"</span>
          )}
        </div>

        {resultRef && !isGenerating && (
          <button
            onClick={handleSaveToProject}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${saved ? 'border-green-300 bg-green-50 text-green-600' : 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100'}`}
          >
            {saved ? (<><Check className="h-4 w-4" /> Đã lưu vào Project</>) : (<><Save className="h-4 w-4" /> Lưu vào Project (Avatar AI)</>)}
          </button>
        )}
      </div>
    </div>
  )
}
