import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { EngagementPost } from '../types'
import { BAIT_TYPE_OPTIONS } from '../services/generateEngagement'

interface Props {
  post: EngagementPost
  index: number
  lang: 'vi' | 'my'
}

export default function EngagementPostCard({ post, index, lang }: Props) {
  const [copied, setCopied] = useState(false)
  const text = lang === 'vi' ? post.vietnamese : post.malay
  const wordCount = text.split(/\s+/).filter(Boolean).length
  const baitOpt = BAIT_TYPE_OPTIONS.find((b) => b.id === post.baitType)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked */ }
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
            {index}
          </div>
          <span className="text-base leading-none">{baitOpt?.glyph}</span>
          <span className="text-[12px] font-bold text-gray-900">{post.baitLabelVi}</span>
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

      <pre className="mb-2 whitespace-pre-wrap break-words rounded-xl bg-emerald-50/50 p-3 font-sans text-[13px] leading-relaxed text-gray-800">
        {text}
      </pre>

      {post.expectedSignalVi && (
        <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/30 p-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
            📊 Signal kỳ vọng
          </p>
          <p className="text-[11px] italic text-emerald-800">{post.expectedSignalVi}</p>
        </div>
      )}
    </div>
  )
}
