import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { CarouselSlide } from '../types'

interface Props {
  slide: CarouselSlide
  lang: 'vi' | 'my'
}

export default function CarouselSlideCard({ slide, lang }: Props) {
  const [copied, setCopied] = useState(false)
  const caption = lang === 'vi' ? slide.captionVi : slide.captionMy

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(caption)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked */ }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      {/* Slide # header */}
      <div className="flex items-center justify-between border-b border-black/5 bg-gradient-to-r from-fuchsia-50 to-pink-50 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white ring-1 ring-fuchsia-200 text-[11px] font-bold text-fuchsia-700">
            {slide.position}
          </div>
          <span className="text-[11px] font-semibold text-fuchsia-700">Slide {slide.position}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition-colors hover:bg-gray-50"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Caption (the visible text on the slide) */}
      <div className="px-4 pt-3">
        <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-gray-500">📝 Caption hiển thị</p>
        <p className="rounded-xl bg-fuchsia-50 p-3 text-[14px] font-semibold leading-snug text-gray-900">
          {caption}
        </p>
      </div>

      {/* Visual direction */}
      {slide.visualDirectionVi && (
        <div className="px-4 pt-3">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-gray-500">🎬 Visual direction</p>
          <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-2.5 text-[11px] italic leading-relaxed text-gray-700">
            {slide.visualDirectionVi}
          </p>
        </div>
      )}

      {/* Background palette */}
      {slide.backgroundSuggest && (
        <div className="px-4 py-3">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-gray-500">🎨 Background palette</p>
          <p className="rounded-xl bg-gradient-to-r from-amber-50 to-rose-50 p-2 text-[11px] font-semibold text-gray-700">
            🎨 {slide.backgroundSuggest}
          </p>
        </div>
      )}
    </div>
  )
}
