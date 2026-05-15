import { useRef, useEffect, useState } from 'react'
import { Copy, Check, Save, ArrowUpRight, Mic, Film, PenLine } from 'lucide-react'
import { useBankStore } from '../../../stores/bankStore'
import { useAppStore } from '../../../stores/appStore'
import type { AdaptScriptResult } from '../types'

interface OutputPanelProps {
  result: AdaptScriptResult | null
  linkedProductId: string | null
  isGenerating?: boolean
}

export default function OutputPanel({ result, linkedProductId, isGenerating }: OutputPanelProps) {
  if (isGenerating) {
    return (
      <div className="flex h-full flex-col gap-4 p-5">
        <div className="skeleton h-5 w-48" />
        <div className="flex flex-col gap-3 rounded-xl border border-black/8 bg-black/20 p-5">
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-[90%]" />
          <div className="skeleton h-4 w-[85%]" />
          <div className="skeleton h-4 w-[70%]" />
          <div className="skeleton h-4 w-[95%]" />
          <div className="skeleton h-4 w-[80%]" />
        </div>
        <div className="skeleton h-5 w-36" />
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-[88%]" />
          <div className="skeleton h-4 w-[75%]" />
          <div className="skeleton h-4 w-[92%]" />
          <div className="skeleton h-4 w-[70%]" />
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center gap-3 p-8">
        <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full border border-black/10 bg-black/[0.04] px-2.5 py-1">
          <span className="text-[9px] font-medium uppercase tracking-widest text-gray-400">Powered by</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-violet-400">Gemini</span>
        </div>
        <PenLine className="h-8 w-8 text-gray-200" strokeWidth={1.5} />
        <p className="text-sm text-gray-300">Kịch bản sẽ xuất hiện ở đây</p>
        <p className="text-xs text-gray-200">Chọn kịch bản mẫu + sản phẩm rồi ấn Tạo kịch bản</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-5 gap-5">
      <ScriptCard
        scriptText={result.vietnamese}
        malayScript={result.malay}
        linkedProductId={linkedProductId}
      />
    </div>
  )
}

interface ScriptCardProps {
  scriptText: string
  malayScript: string
  linkedProductId: string | null
}

function ScriptCard({ scriptText, malayScript, linkedProductId }: ScriptCardProps) {
  const [copied, setCopied] = useState(false)
  const [malayCopied, setMalayCopied] = useState(false)
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [saveTitle, setSaveTitle] = useState('')
  const [saved, setSaved] = useState(false)

  const malayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (malayScript) {
      setTimeout(() => malayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
    }
  }, [malayScript])

  const addScript = useBankStore((s) => s.addScript)
  const sendToApp = useAppStore((s) => s.sendToApp)
  const addToast = useAppStore((s) => s.addToast)

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleMalayCopy = () => {
    navigator.clipboard.writeText(malayScript)
    setMalayCopied(true)
    setTimeout(() => setMalayCopied(false), 2000)
  }

  const handleSave = () => {
    if (!saveTitle.trim()) return
    addScript({
      title: saveTitle.trim(),
      scriptText: malayScript,
      linkedProductId: linkedProductId ?? '',
      source: 'script-architect',
    })
    setShowSaveForm(false)
    setSaveTitle('')
    setSaved(true)
    addToast('Đã lưu kịch bản Malay vào PROJECT')
    setTimeout(() => setSaved(false), 3000)
  }

  const handleSendToVoice = () => {
    sendToApp({ targetApp: 'voice-studio', targetField: 'scriptText', data: malayScript })
    addToast('Đã gửi kịch bản Malay tới Giọng Đọc')
  }

  const handleSendToBroll = () => {
    sendToApp({ targetApp: 'broll-studio', targetField: 'scriptText', data: malayScript })
    addToast('Đã gửi kịch bản Malay tới B-Roll')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Vietnamese script card */}
      <div className="flex flex-col rounded-xl border border-black/8 bg-black/[0.01] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/8 px-4 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-blue-400">
            Kịch bản (Tiếng Anh)
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700"
          >
            {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Đã sao chép' : 'Sao chép'}
          </button>
        </div>

        {/* Script text */}
        <div className="px-4 py-3">
          <pre className="whitespace-pre-wrap font-sans text-sm font-light leading-relaxed tracking-tight text-gray-600">{scriptText}</pre>
        </div>

      </div>

      {/* Malay translation card */}
      {malayScript && (
        <div ref={malayRef} className="flex flex-col rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] overflow-hidden">
          <div className="flex items-center justify-between border-b border-emerald-500/15 px-4 py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
              Kịch bản (Tiếng Malay)
            </span>
            <button
              onClick={handleMalayCopy}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-emerald-500 transition-colors hover:bg-emerald-500/10"
            >
              {malayCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {malayCopied ? 'Đã sao chép' : 'Sao chép'}
            </button>
          </div>
          <div className="px-4 py-3">
            <pre className="whitespace-pre-wrap font-sans text-sm font-light leading-relaxed tracking-tight text-emerald-700">{malayScript}</pre>
          </div>

          {/* Actions — dùng bản Malay */}
          <div className="flex flex-col gap-2 border-t border-emerald-500/15 px-4 py-3">
            {showSaveForm ? (
              <div className="flex gap-2">
                <input
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setShowSaveForm(false); setSaveTitle('') } }}
                  placeholder="Tiêu đề kịch bản..."
                  autoFocus
                  className="flex-1 rounded-full border border-emerald-500/20 bg-transparent px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-emerald-500/40"
                />
                <button
                  onClick={handleSave}
                  disabled={!saveTitle.trim()}
                  className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-[11px] font-medium text-emerald-500 transition-colors hover:bg-emerald-500/25 disabled:opacity-40"
                >
                  Lưu
                </button>
                <button
                  onClick={() => { setShowSaveForm(false); setSaveTitle('') }}
                  className="rounded-full px-3 py-1.5 text-[11px] text-gray-500 hover:text-gray-700"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveForm(true)}
                className={`flex items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-[11px] font-medium transition-colors ${saved
                  ? 'border-green-500/20 bg-green-500/10 text-green-400'
                  : 'border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/10'
                }`}
              >
                {saved ? <><Check className="h-3 w-3" />Đã lưu vào PROJECT</> : <><Save className="h-3 w-3" />Lưu vào PROJECT</>}
              </button>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSendToVoice}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-[11px] font-medium text-indigo-400 transition-colors hover:bg-indigo-500/20"
              >
                <Mic className="h-3 w-3" />Giọng Đọc<ArrowUpRight className="h-3 w-3" />
              </button>
              <button
                onClick={handleSendToBroll}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-[11px] font-medium text-orange-400 transition-colors hover:bg-orange-500/20"
              >
                <Film className="h-3 w-3" />B-Roll<ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
