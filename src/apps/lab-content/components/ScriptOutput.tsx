import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { ScriptOutput } from '../types'

interface Props {
  output: ScriptOutput
  lang: 'vi' | 'my'
}

export default function ScriptOutputView({ output, lang }: Props) {
  return (
    <div className="space-y-4">
      {output.variations.map((v, idx) => (
        <ScriptCard key={v.id} variation={v} idx={idx + 1} lang={lang} />
      ))}
    </div>
  )
}

function ScriptCard({ variation, idx, lang }: {
  variation: ScriptOutput['variations'][number]
  idx: number
  lang: 'vi' | 'my'
}) {
  const [copied, setCopied] = useState(false)
  const text = lang === 'vi' ? variation.vietnamese : variation.malay
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
    <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
            V{idx}
          </div>
          <span className="text-[11px] font-semibold text-gray-700">{variation.variantLabel}</span>
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
      <pre className="whitespace-pre-wrap break-words rounded-xl bg-blue-50/50 p-3 font-sans text-[13px] leading-relaxed text-gray-800">
        {text}
      </pre>
    </div>
  )
}
