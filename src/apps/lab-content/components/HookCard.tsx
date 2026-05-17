import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { HookCandidate } from '../types'

const ANGLE_COLOR: Record<1 | 2 | 3, { border: string; badge: string; text: string }> = {
  1: { border: 'border-rose-200',  badge: 'bg-rose-100',  text: 'text-rose-700' },
  2: { border: 'border-blue-200',  badge: 'bg-blue-100',  text: 'text-blue-700' },
  3: { border: 'border-amber-200', badge: 'bg-amber-100', text: 'text-amber-700' },
}

export default function HookCard({ hook, lang }: { hook: HookCandidate; lang: 'vi' | 'my' }) {
  const [copied, setCopied] = useState(false)
  const colors = ANGLE_COLOR[hook.angleIndex]

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(lang === 'vi' ? hook.textVi : hook.textMy)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className={`flex items-start gap-3 rounded-xl border ${colors.border} bg-white p-3 transition-colors hover:bg-gray-50`}>
      <div className="flex shrink-0 flex-col items-center gap-1">
        <div className={`flex h-6 w-6 items-center justify-center rounded-full ${colors.badge} text-[10px] font-bold ${colors.text}`}>
          G{hook.angleIndex}
        </div>
        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-gray-600">
          {hook.formulaTag}
        </span>
      </div>
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-gray-800">
        {lang === 'vi' ? hook.textVi : hook.textMy}
      </p>
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
