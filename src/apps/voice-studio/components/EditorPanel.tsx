import { FileText, Loader2, Mic, Sparkles, AlertCircle } from 'lucide-react'

interface EditorPanelProps {
  styleInstructions: string
  onStyleChange: (value: string) => void
  scriptText: string
  onScriptChange: (value: string) => void
  onSelectScript: () => void
  onGenerate: () => void
  isGenerating: boolean
  canGenerate: boolean
  highlightField?: string | null
  selectedVoiceName?: string
}

const STYLE_PRESETS = [
  'Nói tự nhiên như chia sẻ với bạn bè. Nhịp độ trò chuyện, hơi hứng khởi.',
  'Giọng UGC bán hàng, sôi nổi, kêu gọi hành động ở cuối.',
  'Giọng kể chuyện trầm ấm, chậm rãi, đầy cảm xúc.',
]

export default function EditorPanel({
  styleInstructions,
  onStyleChange,
  scriptText,
  onScriptChange,
  onSelectScript,
  onGenerate,
  isGenerating,
  canGenerate,
  highlightField,
  selectedVoiceName,
}: EditorPanelProps) {
  const charCount = scriptText.length
  const estCredits = charCount // ElevenLabs: 1 char = 1 credit

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gradient-to-b from-slate-50/30 to-white">
      {/* Top status bar — selected voice */}
      <div className="shrink-0 border-b border-slate-200/70 bg-white/60 px-5 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">
              <Mic className="h-4 w-4 text-indigo-500" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Giọng đang chọn</p>
              <p className="truncate text-sm font-semibold text-slate-800">
                {selectedVoiceName || <span className="text-slate-400 font-normal">Chưa chọn giọng — chọn từ sidebar trái</span>}
              </p>
            </div>
          </div>
          <div className="hidden shrink-0 items-center gap-2 text-[11px] text-slate-400 sm:flex">
            <Sparkles className="h-3 w-3 text-indigo-400" />
            <span>ElevenLabs Multilingual v2</span>
          </div>
        </div>
      </div>

      {/* Style Instructions */}
      <div className="shrink-0 border-b border-slate-200/70 px-5 py-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Phong cách diễn đạt
          </span>
          <span className="text-[10px] text-slate-400">Không bắt buộc</span>
        </div>
        <textarea
          value={styleInstructions}
          onChange={(e) => onStyleChange(e.target.value)}
          rows={2}
          placeholder="VD: Nói tự nhiên như chia sẻ với bạn bè. Hơi hứng khởi khi đề cập lợi ích."
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {STYLE_PRESETS.map((preset, i) => (
            <button
              key={i}
              onClick={() => onStyleChange(preset)}
              className="truncate max-w-[260px] rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-500 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
              title={preset}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Script Text — flex-1 but with reasonable max */}
      <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Kịch bản
            </span>
            <span className={`text-[10px] tabular-nums ${charCount > 5000 ? 'text-amber-500 font-semibold' : 'text-slate-400'}`}>
              {charCount.toLocaleString('vi-VN')} ký tự
              {charCount > 0 && <span className="ml-1 text-slate-300">· ≈ {estCredits.toLocaleString('vi-VN')} credit</span>}
            </span>
          </div>
          <button
            onClick={onSelectScript}
            className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-600 transition-all hover:bg-indigo-100"
          >
            <FileText className="h-3 w-3" />
            Chọn từ Project
          </button>
        </div>
        <textarea
          value={scriptText}
          onChange={(e) => onScriptChange(e.target.value)}
          placeholder="Nhập kịch bản cần đọc... hoặc gửi từ tab Kịch bản bằng nút 'Giọng Đọc'"
          className={`flex-1 min-h-[200px] resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 placeholder-slate-400 shadow-sm outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${highlightField === 'script' ? 'animate-field-flash' : ''}`}
        />
      </div>

      {/* Generate button */}
      <div className="shrink-0 border-t border-slate-200/70 bg-white/80 px-5 py-4 backdrop-blur">
        {!canGenerate && !isGenerating && (
          <div className="mb-2.5 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700 border border-amber-200/50">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>
              {!selectedVoiceName && !scriptText.trim() && 'Chọn giọng đọc và nhập kịch bản để bắt đầu'}
              {!selectedVoiceName && scriptText.trim() && 'Chọn giọng đọc từ sidebar trái'}
              {selectedVoiceName && !scriptText.trim() && 'Nhập hoặc paste kịch bản cần đọc'}
            </span>
          </div>
        )}
        <button
          onClick={onGenerate}
          disabled={!canGenerate || isGenerating}
          className="ui-accent-solid group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl px-6 py-3.5 text-[13px] font-bold tracking-tight shadow-md transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang tạo giọng đọc...</span>
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              <span>Tạo giọng đọc</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
