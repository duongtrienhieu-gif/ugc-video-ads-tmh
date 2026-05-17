import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { LabHook } from '../types'

const ANGLE_COLOR: Record<1 | 2 | 3, { badge: string; text: string }> = {
  1: { badge: 'bg-rose-100',  text: 'text-rose-700' },
  2: { badge: 'bg-blue-100',  text: 'text-blue-700' },
  3: { badge: 'bg-amber-100', text: 'text-amber-700' },
}

interface Props {
  hook: LabHook
  lang: 'vi' | 'my'
  selected: boolean
  onToggleSelect: () => void
}

export default function HookCardLab({ hook, lang, selected, onToggleSelect }: Props) {
  const [copied, setCopied] = useState(false)
  const text = lang === 'vi' ? hook.vietnamese : hook.malay
  const colors = ANGLE_COLOR[hook.angleIndex]

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div
      onClick={onToggleSelect}
      className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-3 transition-all hover:bg-gray-50 ${
        selected ? 'border-violet-400 ring-1 ring-violet-200' : 'border-black/10'
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        onClick={(e) => e.stopPropagation()}
        className="mt-0.5 h-4 w-4 shrink-0 accent-violet-600"
      />

      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-[13px] leading-snug text-gray-800">
          {text}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${colors.badge} ${colors.text}`}>
            Góc {hook.angleIndex}
          </span>
          {hook.psychology.map((p) => (
            <span key={p} className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-medium text-gray-600">
              {p}
            </span>
          ))}
          {hook.nlpTechnique && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-medium text-emerald-700">
              {hook.nlpTechnique}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={handleCopy}
        title="Copy hook"
        className="shrink-0 rounded-lg border border-black/10 bg-white p-1.5 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}
