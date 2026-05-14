import { useState } from 'react'
import { Copy, Check, Save, ArrowUpRight, Mic, Film, PenLine, Loader2, Languages } from 'lucide-react'
import { useBankStore } from '../../../stores/bankStore'
import { useAppStore } from '../../../stores/appStore'
import { translateToMalay } from '../services/generateScript'

interface OutputPanelProps {
  variants: string[]
  linkedProductId: string | null
  isGenerating?: boolean
}

export default function OutputPanel({ variants, linkedProductId, isGenerating }: OutputPanelProps) {
  if (isGenerating) {
    return (
      <div className="flex h-full flex-col gap-4 p-5">
        <div className="skeleton h-5 w-40" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-black/8 bg-black/20 p-5">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-[90%]" />
            <div className="skeleton h-4 w-[85%]" />
            <div className="skeleton h-4 w-[70%]" />
            <div className="skeleton h-4 w-[95%]" />
          </div>
        ))}
      </div>
    )
  }

  if (!variants.length) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center gap-3 p-8">
        <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full border border-black/10 bg-black/[0.04] px-2.5 py-1">
          <span className="text-[9px] font-medium uppercase tracking-widest text-gray-400">Powered by</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-violet-400">Gemini</span>
        </div>
        <PenLine className="h-8 w-8 text-gray-200" strokeWidth={1.5} />
        <p className="text-sm text-gray-300">3 kịch bản của bạn sẽ xuất hiện ở đây</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-5 gap-5">
      {variants.map((script, idx) => (
        <VariantCard
          key={idx}
          index={idx}
          scriptText={script}
          linkedProductId={linkedProductId}
        />
      ))}
    </div>
  )
}

interface VariantCardProps {
  index: number
  scriptText: string
  linkedProductId: string | null
}

function VariantCard({ index, scriptText, linkedProductId }: VariantCardProps) {
  const [copied, setCopied] = useState(false)
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [saveTitle, setSaveTitle] = useState('')
  const [saved, setSaved] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [malayScript, setMalayScript] = useState('')
  const [malayCopied, setMalayCopied] = useState(false)

  const addScript = useBankStore((s) => s.addScript)
  const sendToApp = useAppStore((s) => s.sendToApp)
  const addToast = useAppStore((s) => s.addToast)

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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

  const handleSendToVoice = () => {
    sendToApp({ targetApp: 'voice-studio', targetField: 'scriptText', data: scriptText })
    addToast('Đã gửi kịch bản tới Giọng Đọc')
  }

  const handleSendToBroll = () => {
    sendToApp({ targetApp: 'broll-studio', targetField: 'scriptText', data: scriptText })
    addToast('Đã gửi kịch bản tới B-Roll')
  }

  const handleTranslate = async () => {
    if (malayScript) {
      setMalayScript('')
      return
    }
    setTranslating(true)
    try {
      const result = await translateToMalay(scriptText)
      setMalayScript(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Dịch thất bại: ${msg}`, 'error')
    } finally {
      setTranslating(false)
    }
  }

  const handleMalayCopy = () => {
    navigator.clipboard.writeText(malayScript)
    setMalayCopied(true)
    setTimeout(() => setMalayCopied(false), 2000)
  }

  return (
    <div className="flex flex-col rounded-xl border border-black/8 bg-black/[0.01] overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-black/8 px-4 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-blue-400">
          Kịch bản {index + 1}
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

      {/* Malay translation panel */}
      {malayScript && (
        <div className="mx-4 mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">Tiếng Malay</span>
            <button
              onClick={handleMalayCopy}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-emerald-400 transition-colors hover:bg-emerald-500/10"
            >
              {malayCopied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
              {malayCopied ? 'Đã sao chép' : 'Sao chép'}
            </button>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-xs font-light leading-relaxed text-emerald-700">{malayScript}</pre>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 border-t border-black/8 px-4 py-3">
        {/* Translate button */}
        <button
          onClick={handleTranslate}
          disabled={translating}
          className="flex items-center justify-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-4 py-2 text-[11px] font-medium text-emerald-500 transition-colors hover:bg-emerald-500/15 disabled:opacity-50"
        >
          {translating ? (
            <><Loader2 className="h-3 w-3 animate-spin" />Đang dịch...</>
          ) : malayScript ? (
            <><Languages className="h-3 w-3" />Ẩn bản dịch Malay</>
          ) : (
            <><Languages className="h-3 w-3" />Dịch sang tiếng Malay</>
          )}
        </button>

        {/* Save to Project */}
        {showSaveForm ? (
          <div className="flex gap-2">
            <input
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setShowSaveForm(false); setSaveTitle('') } }}
              placeholder="Tiêu đề kịch bản..."
              autoFocus
              className="flex-1 rounded-full border border-black/10 bg-transparent px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-blue-500/30"
            />
            <button
              onClick={handleSave}
              disabled={!saveTitle.trim()}
              className="rounded-full bg-blue-500/15 px-3 py-1.5 text-[11px] font-medium text-blue-400 transition-colors hover:bg-blue-500/25 disabled:opacity-40"
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
              : 'border-black/12 text-gray-700 hover:bg-black/[0.05] hover:text-gray-900'
            }`}
          >
            {saved ? <><Check className="h-3 w-3" />Đã lưu vào PROJECT</> : <><Save className="h-3 w-3" />Lưu vào PROJECT</>}
          </button>
        )}

        {/* Send buttons */}
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
  )
}
