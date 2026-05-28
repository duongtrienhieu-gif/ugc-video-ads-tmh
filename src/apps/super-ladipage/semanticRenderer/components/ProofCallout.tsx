// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — ProofCallout (P7)
//
// Renders inline proof piece based on ProofPresentation contract.
// Different visual weight for: subtle-attribution / inline-quote-callout
// / bordered-block. No image — text-only proof rendering.
// ─────────────────────────────────────────────────────────────────────

import type { InlineProofPiece } from '../../composer'
import type { ProofPresentation } from '../../renderContract'

interface ProofCalloutProps {
  piece: InlineProofPiece
  presentation: ProofPresentation
}

export function ProofCallout({ piece, presentation }: ProofCalloutProps) {
  if (presentation === 'none') return null

  switch (presentation) {
    case 'subtle-attribution':
      // Minimal: italic gentle text, no visual border
      return (
        <div className="mt-4 mb-4 text-sm text-stone-500 italic">
          <p>"{piece.quote}"</p>
          {piece.author && (
            <p className="mt-1 text-xs text-stone-400 not-italic">— {piece.author}{piece.meta ? ` · ${piece.meta}` : ''}</p>
          )}
        </div>
      )

    case 'inline-quote-callout':
      // Standard: left-border italic block
      return (
        <aside className="my-6 border-l-2 border-stone-300 pl-5 py-3">
          <blockquote className="font-serif italic text-base md:text-[17px] text-stone-600 leading-[1.85]">
            <span className="text-stone-400 mr-1">"</span>
            {piece.quote}
            <span className="text-stone-400 ml-1">"</span>
          </blockquote>
          {(piece.author || piece.meta) && (
            <figcaption className="mt-2 text-xs text-stone-500 not-italic">
              {piece.author && <span>— {piece.author}</span>}
              {piece.meta && <span className="text-stone-400">{piece.author ? ' · ' : ''}{piece.meta}</span>}
            </figcaption>
          )}
        </aside>
      )

    case 'bordered-block':
      // Spotlight: full bordered card, more scannable
      return (
        <aside className="my-6 border border-stone-300 rounded-sm p-5 bg-stone-50">
          <blockquote className="font-serif italic text-base md:text-[17px] text-stone-700 leading-[1.85]">
            <span className="text-stone-400 mr-1">"</span>
            {piece.quote}
            <span className="text-stone-400 ml-1">"</span>
          </blockquote>
          {(piece.author || piece.meta) && (
            <figcaption className="mt-3 text-xs text-stone-500 not-italic">
              {piece.author && <span>— {piece.author}</span>}
              {piece.meta && <span className="text-stone-400">{piece.author ? ' · ' : ''}{piece.meta}</span>}
            </figcaption>
          )}
        </aside>
      )
  }
}
