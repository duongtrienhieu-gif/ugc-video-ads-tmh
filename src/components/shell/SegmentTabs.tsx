interface SegmentOption<T extends string> {
  value: T
  label: string
  /** Optional count/badge shown after the label. */
  badge?: number
}

interface SegmentTabsProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/**
 * Mobile-first segmented control — the unified replacement for the old
 * floating FAB toggles. Active segment uses the brand accent. Generic over
 * the value type so apps can use it for [Thiết lập | Kết quả], mode tabs, etc.
 */
export default function SegmentTabs<T extends string>({ options, value, onChange, className = '' }: SegmentTabsProps<T>) {
  return (
    <div className={`flex rounded-xl border border-app-border bg-app-card p-1 ${className}`}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-bold transition-colors ${
              active ? 'ui-accent-solid' : 'text-app-muted hover:text-app-text'
            }`}
          >
            {opt.label}
            {opt.badge !== undefined && opt.badge > 0 && (
              <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-black/15' : 'bg-app-card-elevated'}`}>
                {opt.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
