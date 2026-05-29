// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — typographyTranslator (P7)
//
// TextChunking + TypographyDominance + ReadingTempo → Tailwind class
// combinations. Mobile-only. Ugly-but-correct.
// ─────────────────────────────────────────────────────────────────────

import type { TextChunking, TypographyDominance } from '../../renderContract'
import type { ReadingTempo } from '../../visualSemantics'

/** Headline class set based on dominance. */
export function headlineClasses(dominance: TypographyDominance): string {
  switch (dominance) {
    case 'headline-led':
      return 'font-serif italic text-3xl md:text-4xl text-stone-900 leading-tight mb-6'
    case 'body-led':
      return 'font-serif italic text-2xl text-stone-800 leading-tight mb-4'
    case 'quote-led':
      return 'font-serif italic text-xl text-stone-700 leading-tight mb-3'
    case 'balanced':
      return 'font-serif italic text-2xl text-stone-900 leading-tight mb-5'
  }
}

/** Body paragraph class set based on chunking + tempo. */
export function paragraphClasses(chunking: TextChunking, tempo: ReadingTempo): string {
  // Base: font-serif body
  const base = 'font-serif text-stone-700'

  // Size + leading per chunking
  let sizeLeading: string
  switch (chunking) {
    case 'fragmented-lines':
      sizeLeading = 'text-lg leading-snug'
      break
    case 'small-paragraph':
      sizeLeading = 'text-base leading-relaxed'
      break
    case 'medium-paragraph':
      sizeLeading = 'text-base md:text-[17px] leading-[1.85]'
      break
    case 'long-flowing':
      sizeLeading = 'text-base md:text-[17px] leading-[2.0]'
      break
  }

  // Tempo: slow-reflective + lingering get extra paragraph margin
  let pBottom: string
  switch (tempo) {
    case 'snap':                pBottom = 'mb-3'; break
    case 'steady':              pBottom = 'mb-5'; break
    case 'slow-reflective':     pBottom = 'mb-7'; break
    case 'lingering':           pBottom = 'mb-6'; break
  }

  return `${base} ${sizeLeading} ${pBottom}`
}

/** Container max-width per breathing — mobile single column with comfortable read width. */
export function readableMaxWidth(): string {
  return 'max-w-md mx-auto'  // single-column mobile-first
}
