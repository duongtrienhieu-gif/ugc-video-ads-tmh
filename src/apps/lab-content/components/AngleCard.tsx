import { Flame, Sparkles, Zap, Megaphone, PenLine, CheckCircle2 } from 'lucide-react'
import type { ElementType } from 'react'
import type { ContentAngle, AngleType } from '../types'

const TYPE_META: Record<AngleType, { label: string; icon: ElementType; gradient: string; text: string; border: string }> = {
  pain: {
    label: 'Nỗi đau',
    icon: Flame,
    gradient: 'from-rose-50 to-orange-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
  },
  aspiration: {
    label: 'Khát vọng',
    icon: Sparkles,
    gradient: 'from-blue-50 to-violet-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  'counter-intuitive': {
    label: 'Phản trực giác',
    icon: Zap,
    gradient: 'from-amber-50 to-yellow-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
}

interface Props {
  angle: ContentAngle
  index: number  // 1, 2, 3
  lang: 'vi' | 'my'
  /** Whether a caption has already been generated for this angle. */
  hasCaption?: boolean
  /** Whether a script has already been generated for this angle. */
  hasScript?: boolean
  onWriteCaption: () => void
  onWriteScript: () => void
}

export default function AngleCard({ angle, index, lang, hasCaption, hasScript, onWriteCaption, onWriteScript }: Props) {
  const meta = TYPE_META[angle.type]
  const Icon = meta.icon

  return (
    <div className={`flex flex-col rounded-2xl border ${meta.border} bg-gradient-to-br ${meta.gradient} p-4 shadow-sm`}>
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className={`flex items-center gap-1.5 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold ${meta.text}`}>
          <Icon className="h-3 w-3" />
          GÓC {index} · {meta.label.toUpperCase()}
        </div>
        <div className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-mono font-semibold text-gray-700">
          {angle.recommendedFormula}
        </div>
      </div>

      {/* Title */}
      <h4 className="mb-1.5 text-sm font-bold leading-snug text-gray-900">
        {lang === 'vi' ? angle.titleVi : angle.titleMy}
      </h4>

      {/* Description */}
      <p className="mb-3 text-[12px] leading-relaxed text-gray-700">
        {lang === 'vi' ? angle.descriptionVi : angle.descriptionMy}
      </p>

      {/* Psychology + NLP chips */}
      <div className="mb-3 space-y-1.5">
        {angle.psychology.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Tâm lý</span>
            {angle.psychology.map((p) => (
              <span key={p} className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-gray-700">
                {p}
              </span>
            ))}
          </div>
        )}
        {angle.nlpTechniques.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">NLP</span>
            {angle.nlpTechniques.map((n) => (
              <span key={n} className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-gray-700">
                {n}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Generate buttons (open modal, content stays inside Lab) */}
      <div className="mt-auto flex gap-1.5">
        <button
          onClick={onWriteCaption}
          className="relative flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-pink-300 bg-white px-2 py-1.5 text-[11px] font-semibold text-pink-700 transition-colors hover:bg-pink-50"
          title={hasCaption ? 'Xem caption đã tạo (có thể tạo lại)' : 'Tạo caption cho góc này'}
        >
          <Megaphone className="h-3 w-3" />
          Caption
          {hasCaption && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
        </button>
        <button
          onClick={onWriteScript}
          className="relative flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-blue-300 bg-white px-2 py-1.5 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-50"
          title={hasScript ? 'Xem kịch bản đã tạo (có thể tạo lại)' : 'Tạo kịch bản cho góc này'}
        >
          <PenLine className="h-3 w-3" />
          Kịch bản
          {hasScript && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
        </button>
      </div>
    </div>
  )
}
