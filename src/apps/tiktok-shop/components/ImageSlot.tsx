// ImageSlot — single card in the 9-slot grid.
// Phase 1: renders mock overlay text + atmosphere background CSS gradient.
// Phase 2 will replace the placeholder with real canvas-rendered preview.

import { useEffect, useState } from 'react'
import { RefreshCw, Pencil, Download, Loader2, ImageOff } from 'lucide-react'
import { getUrl } from '../../../utils/assetStore'
import { useAppStore } from '../../../stores/appStore'
import type { ListingImage } from '../types'
import {
  ATMOSPHERE_VARIANTS,
  TPCN_PALETTES,
  COMPOSITION_FAMILY_LABELS,
} from '../constants'
import type { PaletteFamily } from '../types'

interface Props {
  image: ListingImage
  paletteFamily: PaletteFamily
}

export default function ImageSlot({ image, paletteFamily }: Props) {
  const addToast = useAppStore((s) => s.addToast)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  // Lazy-load the rendered image URL (Phase 3+ populates imageAssetId).
  useEffect(() => {
    if (!image.imageAssetId) { setImageUrl(null); return }
    let cancelled = false
    getUrl(image.imageAssetId)
      .then((u) => { if (!cancelled) setImageUrl(u) })
      .catch(() => { if (!cancelled) setImageUrl(null) })
    return () => { cancelled = true }
  }, [image.imageAssetId])

  const palette = TPCN_PALETTES[paletteFamily]
  const atmosphere = ATMOSPHERE_VARIANTS[image.config.atmosphere]
  const backgroundStyle = { background: atmosphere.cssGradient(palette) }

  const phaseStubAction = (kind: 'visual' | 'text') => {
    addToast(
      kind === 'visual'
        ? 'Re-roll visual — wire ở Phase 3'
        : 'Re-roll text — wire ở Phase 4',
      'info',
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Slot label header */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">
            {image.slot}
          </span>
          <span className="text-[11px] font-semibold text-gray-700">{image.config.intentLabel}</span>
        </div>
        <span className="text-[9px] font-medium uppercase tracking-wide text-gray-400">
          {atmosphere.label}
        </span>
      </div>

      {/* Image preview area — aspect 1:1 */}
      <div className="relative aspect-square w-full overflow-hidden" style={backgroundStyle}>
        {imageUrl ? (
          <img src={imageUrl} alt={image.config.intentLabel} className="h-full w-full object-cover" />
        ) : image.status === 'generating' ? (
          <div className="flex h-full items-center justify-center text-white/80">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : image.status === 'failed' ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-white/90">
            <ImageOff className="h-5 w-5" />
            <span className="text-[10px]">Lỗi gen</span>
          </div>
        ) : (
          // Phase 1 mock: render overlay text directly on gradient bg.
          // Phase 2 replaces this with proper Konva canvas render.
          <MockOverlayPreview image={image} paletteFamily={paletteFamily} />
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-1 border-t border-gray-100 bg-white px-2 py-1.5">
        <span className="truncate text-[9px] text-gray-400" title={COMPOSITION_FAMILY_LABELS[image.config.composition]}>
          {COMPOSITION_FAMILY_LABELS[image.config.composition]}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconBtn icon={<RefreshCw className="h-3 w-3" />} title="Tạo lại ảnh" onClick={() => phaseStubAction('visual')} />
          <IconBtn icon={<Pencil className="h-3 w-3" />}    title="Sửa text"     onClick={() => phaseStubAction('text')}   />
          <IconBtn icon={<Download className="h-3 w-3" />}  title="Tải xuống"
            onClick={() => addToast('Tải xuống — wire ở Phase 4', 'info')} disabled={!imageUrl} />
        </div>
      </div>
    </div>
  )
}

function IconBtn({ icon, title, onClick, disabled }: {
  icon: React.ReactNode
  title: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
    >
      {icon}
    </button>
  )
}

// ── Mock overlay renderer — Phase 1 ─────────────────────────────────────
// Just enough to visualize the slot's purpose. Real rendering comes in Phase 2
// via Konva canvas with proper typography, logo, badges, trust footer, etc.

function MockOverlayPreview({ image, paletteFamily }: Props) {
  const palette = TPCN_PALETTES[paletteFamily]
  const o = image.overlay
  const isLightBg = image.config.atmosphere === 'soft'
  const textColor = isLightBg ? palette.primary : '#FFFFFF'
  const subtleColor = isLightBg ? '#666' : 'rgba(255,255,255,0.85)'

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center" style={{ color: textColor }}>
      {/* Headline */}
      {o.headline && (
        <div className="text-[11px] font-extrabold leading-tight tracking-tight">
          {o.headline}
        </div>
      )}

      {/* Subheadline */}
      {o.subheadline && (
        <div className="text-[9px] font-medium leading-tight" style={{ color: subtleColor }}>
          {o.subheadline}
        </div>
      )}

      {/* Metric (giant number) */}
      {o.metric && (
        <div className="flex flex-col items-center">
          <div className="text-2xl font-black leading-none tracking-tight">{o.metric.value}</div>
          {o.metric.label && (
            <div className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider" style={{ color: subtleColor }}>
              {o.metric.label}
            </div>
          )}
        </div>
      )}

      {/* Bullets */}
      {o.bullets && o.bullets.length > 0 && (
        <ul className="space-y-0.5 text-[8px] leading-tight">
          {o.bullets.slice(0, 4).map((b, i) => (
            <li key={i}>• {b}</li>
          ))}
        </ul>
      )}

      {/* Testimonial */}
      {o.testimonial && (
        <div className="space-y-1 rounded-lg bg-white/95 p-2 text-gray-800 shadow-sm" style={{ color: '#1f2937' }}>
          {o.testimonial.rating && (
            <div className="text-[10px] text-amber-400">
              {'★'.repeat(o.testimonial.rating)}
            </div>
          )}
          <p className="text-[8px] italic leading-snug">"{o.testimonial.quote}"</p>
          <p className="text-[8px] font-semibold">— {o.testimonial.author}</p>
        </div>
      )}

      {/* Steps */}
      {o.steps && (
        <div className="flex w-full justify-around text-[8px]">
          {o.steps.map((s) => (
            <div key={s.number} className="flex flex-col items-center gap-0.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/90 text-[8px] font-bold" style={{ color: palette.primary }}>
                {s.number}
              </span>
              <span className="px-1 text-center leading-tight">{s.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Comparison */}
      {o.comparison && (
        <table className="w-full text-[7px]">
          <thead>
            <tr style={{ borderBottom: `1px solid ${subtleColor}` }}>
              {o.comparison.headers.map((h, i) => (
                <th key={i} className="px-1 py-0.5 font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {o.comparison.rows.slice(0, 4).map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="px-1 py-0.5">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Price + CTA */}
      {o.price && (
        <div className="space-y-1">
          {o.price.original && (
            <span className="text-[8px] line-through opacity-70">{o.price.original}</span>
          )}
          <div className="text-xl font-black leading-none">{o.price.current}</div>
          {o.price.discount && (
            <span className="rounded-full px-1.5 py-0.5 text-[7px] font-bold" style={{ background: palette.cta, color: '#FFF' }}>
              {o.price.discount}
            </span>
          )}
        </div>
      )}
      {o.cta && (
        <div className="rounded-md px-3 py-1 text-[9px] font-bold" style={{ background: palette.cta, color: '#FFF' }}>
          {o.cta}
        </div>
      )}

      {/* FAQ */}
      {o.faq && (
        <div className="w-full space-y-1 text-left">
          {o.faq.slice(0, 3).map((item, i) => (
            <div key={i} className="text-[7px] leading-tight">
              <p className="font-bold">Q: {item.q}</p>
              <p style={{ color: subtleColor }}>A: {item.a}</p>
            </div>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      {o.disclaimer && (
        <p className="absolute bottom-1 text-[6px] opacity-70">{o.disclaimer}</p>
      )}
    </div>
  )
}
