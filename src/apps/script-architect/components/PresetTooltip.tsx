import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { ScriptPreset } from '../types'

// ── Position calculation ────────────────────────────────────────────────
// We render the tooltip in a portal so it escapes the InputPanel's
// `overflow-y-auto` clip. Position is fixed and computed from the trigger
// element's bounding rect — preference is "right of card", with fall-back
// to "left", then "above". Recomputed on scroll/resize so it tracks.

const TIP_WIDTH = 320
const TIP_MARGIN = 10

type Placement = 'right' | 'left' | 'above'

interface Pos {
  left: number
  top: number
  placement: Placement
  arrowLeft?: number
  arrowTop?: number
}

function computePosition(rect: DOMRect): Pos {
  const vw = window.innerWidth
  const vh = window.innerHeight
  // Approximate height — we don't know exact until the tooltip renders, but
  // 320px is a safe upper bound for our content.
  const approxHeight = 320

  // Try RIGHT
  if (rect.right + TIP_MARGIN + TIP_WIDTH < vw - 8) {
    const desiredTop = rect.top + rect.height / 2 - approxHeight / 2
    const top = Math.max(8, Math.min(vh - approxHeight - 8, desiredTop))
    return {
      left: rect.right + TIP_MARGIN,
      top,
      placement: 'right',
    }
  }
  // Try LEFT
  if (rect.left - TIP_MARGIN - TIP_WIDTH > 8) {
    const desiredTop = rect.top + rect.height / 2 - approxHeight / 2
    const top = Math.max(8, Math.min(vh - approxHeight - 8, desiredTop))
    return {
      left: rect.left - TIP_MARGIN - TIP_WIDTH,
      top,
      placement: 'left',
    }
  }
  // Fallback ABOVE
  const desiredLeft = rect.left + rect.width / 2 - TIP_WIDTH / 2
  const left = Math.max(8, Math.min(vw - TIP_WIDTH - 8, desiredLeft))
  return {
    left,
    top: Math.max(8, rect.top - TIP_MARGIN - approxHeight),
    placement: 'above',
  }
}

interface PresetTooltipProps {
  preset: ScriptPreset
  anchor: HTMLElement
  onDismiss: () => void
  /** Show the close button — used on mobile / tap interaction. Default false. */
  dismissible?: boolean
}

export function PresetTooltip({ preset, anchor, onDismiss, dismissible }: PresetTooltipProps) {
  const [pos, setPos] = useState<Pos>(() => computePosition(anchor.getBoundingClientRect()))
  const [mounted, setMounted] = useState(false)
  const tipRef = useRef<HTMLDivElement | null>(null)

  // Trigger the fade-in transition one frame after mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Recompute position on scroll / resize so the tooltip tracks the card
  useEffect(() => {
    const recompute = () => setPos(computePosition(anchor.getBoundingClientRect()))
    window.addEventListener('scroll', recompute, true)
    window.addEventListener('resize', recompute)
    return () => {
      window.removeEventListener('scroll', recompute, true)
      window.removeEventListener('resize', recompute)
    }
  }, [anchor])

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  const tip = (
    <div
      ref={tipRef}
      role="tooltip"
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        width: TIP_WIDTH,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(4px)',
        transition: 'opacity 140ms ease-out, transform 140ms ease-out',
        zIndex: 200,
        pointerEvents: dismissible ? 'auto' : 'none',
      }}
      className="rounded-xl border border-white/10 bg-gray-900/95 p-3.5 text-white shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-bold leading-tight">
          <span className="mr-1.5">{preset.glyph}</span>
          {preset.label}
        </h4>
        {dismissible && (
          <button
            onClick={onDismiss}
            aria-label="Đóng"
            className="-mr-1 -mt-1 flex h-6 w-6 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <Section label="Cơ chế">
        <p className="leading-relaxed text-gray-100">{preset.detailVi.mechanism}</p>
      </Section>

      <Section label="Mục tiêu">
        <ul className="space-y-0.5 text-gray-100">
          {preset.detailVi.goals.map((g, i) => (
            <li key={i} className="leading-relaxed">• {g}</li>
          ))}
        </ul>
      </Section>

      <Section label="Phù hợp">
        <ul className="space-y-0.5 text-gray-100">
          {preset.detailVi.useCase.map((u, i) => (
            <li key={i} className="leading-relaxed">• {u}</li>
          ))}
        </ul>
      </Section>

      <Section label="Ví dụ" last>
        <p className="italic leading-relaxed text-emerald-200">{preset.detailVi.example}</p>
      </Section>
    </div>
  )

  return createPortal(tip, document.body)
}

function Section({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={last ? 'mt-2.5' : 'mt-2.5'}>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <div className="text-[11px]">{children}</div>
    </div>
  )
}
