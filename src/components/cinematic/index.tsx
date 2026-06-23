// ─────────────────────────────────────────────────────────────────────
// Cinematic primitives — the reusable AUTOVIS/AUREA "studio" look.
// Token-driven (var(--color-accent) etc.) so they adapt to light / dark /
// studio automatically. Used by TopNav + Home now; droppable into any
// inner app later without restyling.
// ─────────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react'

/** Mono uppercase wide-tracking eyebrow, e.g. "● REC · UGC STUDIO · 2026".
 *  `rec` adds the pulsing red recording dot. */
export function EyebrowLabel({
  children,
  rec = false,
  className = '',
}: {
  children: ReactNode
  rec?: boolean
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-[var(--font-mono)] text-[10px] sm:text-[11px] uppercase tracking-[0.28em] text-app-subtle ${className}`}
    >
      {rec && (
        <span
          className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full"
          style={{ backgroundColor: 'var(--color-rec)' }}
          aria-hidden
        />
      )}
      {children}
    </span>
  )
}

/** Wraps content in gold L-shaped corner brackets (the "viewfinder" frame).
 *  Decorative only — children flow normally inside. */
export function CornerFrame({
  children,
  className = '',
  radius = 'rounded-xl',
}: {
  children: ReactNode
  className?: string
  radius?: string
}) {
  const c = 'pointer-events-none absolute h-4 w-4 sm:h-5 sm:w-5'
  const stroke = { borderColor: 'var(--color-accent)' }
  return (
    <div className={`relative ${radius} ${className}`}>
      <span className={`${c} left-1.5 top-1.5 border-l-2 border-t-2`} style={stroke} aria-hidden />
      <span className={`${c} right-1.5 top-1.5 border-r-2 border-t-2`} style={stroke} aria-hidden />
      <span className={`${c} bottom-1.5 left-1.5 border-b-2 border-l-2`} style={stroke} aria-hidden />
      <span className={`${c} bottom-1.5 right-1.5 border-b-2 border-r-2`} style={stroke} aria-hidden />
      {children}
    </div>
  )
}

/** Small red HOT pill (top-right of a card). */
export function HotBadge({ label = 'HOT', className = '' }: { label?: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white ${className}`}
      style={{ backgroundColor: 'var(--color-rec)' }}
    >
      {label}
    </span>
  )
}

/** Brand-accent button. `variant='solid'` = filled gold; `outline` = bordered. */
export function GoldButton({
  children,
  onClick,
  variant = 'solid',
  size = 'md',
  className = '',
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'solid' | 'outline'
  size?: 'sm' | 'md'
  className?: string
  type?: 'button' | 'submit'
}) {
  const pad = size === 'sm' ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2.5 text-xs sm:text-sm'
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg font-bold transition-all active:scale-[0.97]'
  const styles =
    variant === 'solid'
      ? { backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-contrast)' }
      : { borderColor: 'var(--color-border-strong)', color: 'var(--color-text-primary)' }
  return (
    <button
      type={type}
      onClick={onClick}
      style={styles}
      className={`${base} ${pad} ${variant === 'outline' ? 'border bg-transparent hover:bg-app-card-elevated' : 'hover:brightness-105'} ${className}`}
    >
      {children}
    </button>
  )
}
