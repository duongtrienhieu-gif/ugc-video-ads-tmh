import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { CocMicroContent } from '../types'
import { getCocFormatById } from '../services/presets'

interface Props {
  micro: CocMicroContent
  lang: 'vi' | 'my'
}

export default function CocMicroCard({ micro, lang }: Props) {
  const [copied, setCopied] = useState(false)
  const format = getCocFormatById(micro.format)
  const text = lang === 'vi' ? micro.vietnamese : micro.malay
  const wordCount = text.split(/\s+/).filter(Boolean).length
  const charCount = text.length

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{format?.glyph}</span>
          <span className="text-[12px] font-bold text-gray-900">{format?.label ?? micro.format}</span>
          <span className="text-[10px] text-gray-400">· {wordCount} từ · {charCount} ký tự</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition-colors hover:bg-gray-50"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-3 font-sans text-[13px] leading-relaxed text-gray-800">
        {text}
      </pre>
    </div>
  )
}
