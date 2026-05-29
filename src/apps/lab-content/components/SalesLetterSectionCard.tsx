import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { SalesLetterSection } from '../types'

interface Props {
  section: SalesLetterSection
  index: number
  lang: 'vi' | 'my'
}

export default function SalesLetterSectionCard({ section, index, lang }: Props) {
  const [copied, setCopied] = useState(false)
  const text = lang === 'vi' ? section.vietnamese : section.malay
  const wordCount = text.split(/\s+/).filter(Boolean).length

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
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">
            {index}
          </div>
          <span className="text-[12px] font-bold text-gray-900">{section.labelVi}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[9px] font-medium text-gray-600">
            {section.sectionType}
          </span>
          <span className="text-[10px] text-gray-400">· {wordCount} từ</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition-colors hover:bg-gray-50"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="whitespace-pre-wrap break-words rounded-xl bg-amber-50/50 p-3 font-sans text-[13px] leading-relaxed text-gray-800">
        {text}
      </pre>
    </div>
  )
}
