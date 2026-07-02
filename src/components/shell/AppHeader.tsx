import type { ReactNode } from 'react'

interface AppHeaderProps {
  /** Lucide icon component for the accent chip. */
  icon?: React.ElementType
  /** Mono uppercase eyebrow above the title (optional). */
  eyebrow?: string
  /** Pulsing red REC dot on the eyebrow. */
  rec?: boolean
  title: string
  subtitle?: string
  /** Center slot (e.g. a stepper) — shown inline on lg+ only, so the header
   *  stays a single row on desktop instead of stacking a second band. */
  center?: ReactNode
  /** Right-aligned actions (buttons, indicators, tabs). */
  actions?: ReactNode
}

/**
 * Shared app-level title bar — ONE consistent header for every inner app.
 * Token-driven so it follows light / dark / studio automatically. Replaces
 * the bespoke per-app headers (gradient banners, white bars, none) so the
 * whole product reads as one studio.
 */
export default function AppHeader({ icon: Icon, eyebrow, rec, title, subtitle, center, actions }: AppHeaderProps) {
  // Thanh tiêu đề 1 DÒNG mỏng (~30px) — trước đây là band ~72px xếp 3 dòng
  // eyebrow/title/subtitle chiếm cả dải ngang phía trên đẩy nội dung xuống.
  // Gộp về 1 dòng: icon nhỏ + tên app + mô tả inline (ẩn ở mobile), actions
  // dồn phải + wrap. Trả lại chiều cao cho vùng output ở MỌI app.
  return (
    <header className="shrink-0 border-b border-app-border bg-app-surface px-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          {Icon && (
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: 'var(--color-accent-dim)' }}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} strokeWidth={2} />
            </span>
          )}
          {rec && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full" style={{ backgroundColor: 'var(--color-rec)' }} />}
          <h1 className="truncate text-sm font-bold leading-none text-app-text">{title}</h1>
          {(subtitle || eyebrow) && (
            <span className="hidden truncate text-[11px] leading-none text-app-subtle sm:inline">· {subtitle || eyebrow}</span>
          )}
        </div>
        {center && <div className="hidden min-w-0 flex-1 lg:block">{center}</div>}
        {actions && <div className="ml-auto flex flex-wrap items-center gap-1.5">{actions}</div>}
      </div>
    </header>
  )
}
