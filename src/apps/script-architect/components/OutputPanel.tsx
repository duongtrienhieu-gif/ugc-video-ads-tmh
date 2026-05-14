import { useState } from 'react'
import { Copy, Check, Save, ArrowUpRight, Mic, Film, PenLine } from 'lucide-react'
import { useBankStore } from '../../../stores/bankStore'
import { useAppStore } from '../../../stores/appStore'

interface OutputPanelProps {
  scriptText: string
  linkedProductId: string | null
  isGenerating?: boolean
}

export default function OutputPanel({ scriptText, linkedProductId, isGenerating }: OutputPanelProps) {
  const [copied, setCopied] = useState(false)
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [saveTitle, setSaveTitle] = useState('')
  const [saved, setSaved] = useState(false)

  const addScript = useBankStore((s) => s.addScript)
  const sendToApp = useAppStore((s) => s.sendToApp)

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const addToast = useAppStore((s) => s.addToast)

  const handleSave = () => {
    if (!saveTitle.trim()) return
    addScript({
      title: saveTitle.trim(),
      scriptText,
      linkedProductId: linkedProductId ?? '',
      source: 'script-architect',
    })
    setShowSaveForm(false)
    setSaveTitle('')
    setSaved(true)
    addToast('Đã lưu kịch bản vào PROJECT')
    setTimeout(() => setSaved(false), 3000)
  }

  const handleSendToVoiceStudio = () => {
    sendToApp({
      targetApp: 'voice-studio',
      targetField: 'scriptText',
      data: scriptText,
    })
    addToast('Đã gửi kịch bản tới Giọng Đọc')
  }

  const handleSendToBrollStudio = () => {
    sendToApp({
      targetApp: 'broll-studio',
      targetField: 'scriptText',
      data: scriptText,
    })
    addToast('Đã gửi kịch bản tới B-Roll')
  }

  if (isGenerating) {
    return (
      <div className="flex h-full flex-col gap-4 p-5">
        <div className="skeleton h-5 w-40" />
        <div className="flex flex-1 flex-col gap-3 rounded-xl border border-black/8 bg-black/20 p-5">
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-[90%]" />
          <div className="skeleton h-4 w-[95%]" />
          <div className="skeleton h-4 w-[70%]" />
          <div className="mt-2 skeleton h-4 w-full" />
          <div className="skeleton h-4 w-[85%]" />
          <div className="skeleton h-4 w-[92%]" />
          <div className="skeleton h-4 w-[60%]" />
          <div className="mt-2 skeleton h-4 w-full" />
          <div className="skeleton h-4 w-[88%]" />
          <div className="skeleton h-4 w-[75%]" />
        </div>
      </div>
    )
  }

  if (!scriptText) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center gap-3 p-8">
        <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full border border-black/10 bg-black/[0.04] px-2.5 py-1">
          <span className="text-[9px] font-medium uppercase tracking-widest text-gray-400">Powered by</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-violet-400">Claude</span>
        </div>
        <PenLine className="h-8 w-8 text-gray-200" strokeWidth={1.5} />
        <p className="text-sm text-gray-300">Kịch bản của bạn sẽ xuất hiện ở đây</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-5">
      {/* Header with actions */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-gray-800">Kịch bản đã tạo</h3>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700"
          >
            {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Đã sao chép' : 'Sao chép kịch bản'}
          </button>
        </div>
      </div>

      {/* Script text */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-black/8 bg-black/20 p-5">
        <pre className="whitespace-pre-wrap font-sans font-light tracking-tight text-sm leading-relaxed text-gray-600">{scriptText}</pre>
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex flex-col gap-2">
        {/* Save to Script Bank */}
        {showSaveForm ? (
          <div className="flex gap-2">
            <input
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              placeholder="Tiêu đề kịch bản..."
              autoFocus
              className="flex-1 rounded-full border border-black/10 bg-transparent px-4 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-blue-500/30"
            />
            <button
              onClick={handleSave}
              disabled={!saveTitle.trim()}
              className="rounded-full bg-blue-500/15 px-4 py-2 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/25 disabled:opacity-40"
            >
              Lưu
            </button>
            <button
              onClick={() => { setShowSaveForm(false); setSaveTitle('') }}
              className="rounded-full px-4 py-2 text-xs text-gray-500 transition-colors hover:text-gray-700"
            >
              Hủy
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSaveForm(true)}
            className={`flex items-center justify-center gap-2 rounded-full border px-6 py-3.5 text-[13px] font-medium tracking-tight transition-colors ${saved
              ? 'border-green-500/20 bg-green-500/10 text-green-400'
              : 'border-black/12 text-gray-700 hover:bg-black/[0.05] hover:text-gray-900'
              }`}
          >
            {saved ? (
              <><Check className="h-4 w-4" /> Đã lưu vào PROJECT kịch bản</>
            ) : (
              <><Save className="h-4 w-4" /> Lưu vào PROJECT kịch bản</>
            )}
          </button>
        )}

        {/* Send buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSendToVoiceStudio}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-6 py-3.5 text-[13px] font-medium tracking-tight text-indigo-400 transition-colors hover:bg-indigo-500/20"
          >
            <Mic className="h-4 w-4" />
            Gửi tới Giọng Đọc
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleSendToBrollStudio}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-6 py-3.5 text-[13px] font-medium tracking-tight text-orange-400 transition-colors hover:bg-orange-500/20"
          >
            <Film className="h-4 w-4" />
            Gửi tới B-Roll
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
