import type { ReactNode } from 'react'
import { EyebrowLabel } from '../cinematic'

interface AppHeaderProps {
  /** Lucide icon component for the accent chip. */
  icon?: React.ElementType
  /** Mono uppercase eyebrow above the title (optional). */
  eyebrow?: string
  /** Pulsing red REC dot on the eyebrow. */
  rec?: boolean
  title: string
  subtitle?: string
  /** Right-aligned actions (buttons, indicators, tabs). */
  actions?: ReactNode
}

/**
 * Shared app-level title bar — ONE consistent header for every inner app.
 * Token-driven so it follows light / dark / studio automatically. Replaces
 * the bespoke per-app headers (gradient banners, white bars, none) so the
 * whole product reads as one studio.
 */
export default function AppHeader({ icon: Icon, eyebrow, rec, title, subtitle, actions }: AppHeaderProps) {
  return (
    <header className="shrink-0 border-b border-app-border bg-app-surface px-3 py-1.5 sm:px-5 sm:py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <span
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:flex"
              style={{ backgroundColor: 'var(--color-accent-dim)' }}
            >
              <Icon className="h-4 w-4" style={{ color: 'var(--color-accent)' }} strokeWidth={2} />
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && <EyebrowLabel rec={rec} className="mb-0.5">{eyebrow}</EyebrowLabel>}
            <h1 className="truncate text-[15px] font-bold leading-tight text-app-text sm:text-base">{title}</h1>
            {subtitle && <p className="truncate text-[11px] leading-tight text-app-subtle sm:text-xs">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
    </header>
  )
}
