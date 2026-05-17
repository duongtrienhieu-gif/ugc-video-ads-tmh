import { DollarSign, Clock, HeartPulse, Users, Crown } from 'lucide-react'
import type { ElementType } from 'react'
import type { PainPoint, PainType } from '../types'

const TYPE_META: Record<PainType, { label: string; icon: ElementType; color: string }> = {
  money:        { label: 'Tiền',      icon: DollarSign, color: 'emerald' },
  time:         { label: 'Thời gian', icon: Clock,      color: 'blue' },
  health:       { label: 'Sức khỏe',  icon: HeartPulse, color: 'rose' },
  relationship: { label: 'Mối quan hệ', icon: Users,    color: 'orange' },
  status:       { label: 'Vị thế',    icon: Crown,      color: 'violet' },
}

const COLOR_CLASS: Record<string, { bg: string; text: string; border: string }> = {
  emerald: { bg: 'bg-emerald-50',  text: 'text-emerald-700',  border: 'border-emerald-200' },
  blue:    { bg: 'bg-blue-50',     text: 'text-blue-700',     border: 'border-blue-200' },
  rose:    { bg: 'bg-rose-50',     text: 'text-rose-700',     border: 'border-rose-200' },
  orange:  { bg: 'bg-orange-50',   text: 'text-orange-700',   border: 'border-orange-200' },
  violet:  { bg: 'bg-violet-50',   text: 'text-violet-700',   border: 'border-violet-200' },
}

export default function PainPointCard({ pain, rank, lang }: { pain: PainPoint; rank: number; lang: 'vi' | 'my' }) {
  const meta = TYPE_META[pain.type]
  const Icon = meta.icon
  const colors = COLOR_CLASS[meta.color]

  return (
    <div className={`flex items-start gap-3 rounded-xl border ${colors.border} ${colors.bg} p-3`}>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-gray-700 ring-1 ring-black/5">
        #{rank}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <div className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${colors.text}`}>
            <Icon className="h-3 w-3" />
            {meta.label}
          </div>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${i <= pain.intensity ? colors.text.replace('text-', 'bg-') : 'bg-gray-200'}`}
              />
            ))}
          </div>
        </div>
        <p className="text-[13px] leading-snug text-gray-800">
          {lang === 'vi' ? pain.textVi : pain.textMy}
        </p>
      </div>
    </div>
  )
}
