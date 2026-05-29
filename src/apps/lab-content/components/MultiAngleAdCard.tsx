import { useState } from 'react'
import { Copy, Check, Brain, Heart, Users, AlertTriangle, Sparkles } from 'lucide-react'
import type { ElementType } from 'react'
import type { AdAngleType, MultiAngleAd } from '../types'

const ANGLE_META: Record<AdAngleType, { icon: ElementType; bg: string; text: string; border: string; ring: string }> = {
  logical:        { icon: Brain,         bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    ring: 'ring-blue-200' },
  emotional:      { icon: Heart,         bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    ring: 'ring-rose-200' },
  'social-proof': { icon: Users,         bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', ring: 'ring-emerald-200' },
  'fear-loss':    { icon: AlertTriangle, bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   ring: 'ring-amber-200' },
  aspirational:   { icon: Sparkles,      bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  ring: 'ring-violet-200' },
}

interface Props {
  ad: MultiAngleAd
  index: number
  lang: 'vi' | 'my'
}

export default function MultiAngleAdCard({ ad, index, lang }: Props) {
  const meta = ANGLE_META[ad.angleType]
  const Icon = meta.icon

  const hookText = lang === 'vi' ? ad.hookVi : ad.hookMy
  const bodyText = lang === 'vi' ? ad.bodyVi : ad.bodyMy
  const ctaText  = lang === 'vi' ? ad.ctaVi  : ad.ctaMy

  const fullAdText = [hookText, '', bodyText, '', ctaText].filter(Boolean).join('\n')

  return (
    <div className={`rounded-2xl border ${meta.border} bg-white p-4 shadow-sm`}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full ${meta.bg} ring-1 ${meta.ring}`}>
            <Icon className={`h-3.5 w-3.5 ${meta.text}`} />
          </div>
          <div>
            <p className={`text-[12px] font-bold ${meta.text}`}>Ad #{index} · {ad.angleLabelVi}</p>
            <p className="text-[9px] font-mono uppercase tracking-wider text-gray-400">{ad.angleType}</p>
          </div>
        </div>
        <CopyButton text={fullAdText} label="Copy ad" />
      </div>

      {/* Hook */}
      <div className="mb-2">
        <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-gray-500">🎣 Hook</p>
        <p className={`rounded-xl ${meta.bg} p-2.5 text-[13px] font-semibold leading-snug text-gray-900`}>
          {hookText}
        </p>
      </div>

      {/* Body */}
      <div className="mb-2">
        <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-gray-500">📝 Body</p>
        <pre className="whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-2.5 font-sans text-[12px] leading-relaxed text-gray-800">
          {bodyText}
        </pre>
      </div>

      {/* CTA */}
      {ctaText && (
        <div className="mb-2">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-gray-500">📣 CTA</p>
          <p className={`rounded-xl ${meta.bg} p-2.5 text-[12px] font-bold ${meta.text}`}>
            👉 {ctaText}
          </p>
        </div>
      )}

      {/* Visual direction */}
      {ad.visualDirectionVi && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-2.5">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-gray-500">🎬 Visual direction</p>
          <p className="text-[11px] italic leading-relaxed text-gray-600">{ad.visualDirectionVi}</p>
        </div>
      )}
    </div>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked */ }
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition-colors hover:bg-gray-50"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  )
}
