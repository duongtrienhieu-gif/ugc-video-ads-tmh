import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { FunnelPiece } from '../types'

const CTA_LABEL: Record<FunnelPiece['ctaStrength'], { label: string; bg: string; text: string }> = {
  soft:     { label: 'CTA mềm',     bg: 'bg-emerald-100', text: 'text-emerald-700' },
  balanced: { label: 'CTA cân bằng', bg: 'bg-blue-100',    text: 'text-blue-700' },
  hard:     { label: 'CTA mạnh',    bg: 'bg-rose-100',    text: 'text-rose-700' },
}

interface Props {
  piece: FunnelPiece
  index: number
  lang: 'vi' | 'my'
}

export default function FunnelPieceCard({ piece, index, lang }: Props) {
  const [copied, setCopied] = useState(false)
  const text = lang === 'vi' ? piece.vietnamese : piece.malay
  const cta = CTA_LABEL[piece.ctaStrength]
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
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-700">
            {index}
          </div>
          <span className="rounded-full bg-violet-600 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
            {piece.formula}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cta.bg} ${cta.text}`}>
            {cta.label}
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
      <pre className="whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-3 font-sans text-[13px] leading-relaxed text-gray-800">
        {text}
      </pre>
    </div>
  )
}
