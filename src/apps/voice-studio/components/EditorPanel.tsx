import { FileText, Loader2, Mic } from 'lucide-react'

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
}

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
}: EditorPanelProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Style Instructions */}
      <div className="border-b border-black/8 p-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-widest text-gray-400">
            Phong cách diễn đạt
          </span>
          <textarea
            value={styleInstructions}
            onChange={(e) => onStyleChange(e.target.value)}
            rows={3}
            placeholder="ví dụ: Nói tự nhiên như chia sẻ với bạn bè. Nhịp độ trò chuyện, hơi hứng khởi khi đề cập lợi ích."
            className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder-zinc-700 outline-none transition-colors focus:border-indigo-500/30 resize-none"
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            onClick={() => onStyleChange('Nói tự nhiên như chia sẻ với bạn bè. Nhịp độ trò chuyện, hơi hứng khởi khi đề cập lợi ích.')}
            className="rounded-full bg-black/[0.04] px-3 py-1.5 text-[10px] font-medium text-gray-600 transition-colors hover:bg-black/[0.06] hover:text-gray-800 border border-black/8"
          >
            "Nói tự nhiên như chia sẻ với bạn bè. Nhịp độ trò chuyện..."
          </button>
        </div>
      </div>

      {/* Script Text */}
      <div className="flex flex-1 flex-col overflow-hidden p-5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-widest text-gray-400">
            Kịch bản
          </span>
          <button
            onClick={onSelectScript}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-indigo-400 transition-colors hover:bg-indigo-500/10"
          >
            <FileText className="h-3 w-3" />
            Chọn từ Project kịch bản
          </button>
        </div>
        <textarea
          value={scriptText}
          onChange={(e) => onScriptChange(e.target.value)}
          placeholder="Nhập kịch bản cần đọc..."
          className={`flex-1 rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder-zinc-700 outline-none transition-colors focus:border-indigo-500/30 resize-none ${highlightField === 'script' ? 'animate-field-flash' : ''}`}
        />
      </div>

      {/* Generate button */}
      <div className="border-t border-black/8 p-4">
        <button
          onClick={onGenerate}
          disabled={!canGenerate || isGenerating}
          className="flex w-full items-center justify-center gap-2.5 rounded-full border border-black/12 bg-indigo-500 px-6 py-3.5 text-[13px] font-medium tracking-tight text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-all hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang tạo...</span>
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
