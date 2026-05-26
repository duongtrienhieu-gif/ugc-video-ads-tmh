// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — SemanticSection (P7 dispatcher, P8 debug-aware)
//
// Single dispatcher with switch on mobilePattern. Each pattern renders
// its own structure. Mobile-only single-column.
//
// P8: optional showDebug flag → renders SemanticDebugOverlay above the
// section's visible content (no changes to underlying rendering).
//
// UGLY-BUT-CORRECT: minimal styling, focus on scroll rhythm + emotional
// flow validation. No animation, no responsive desktop, no polish.
// ─────────────────────────────────────────────────────────────────────

import type { ReactNode } from 'react'
import type { SemanticSectionProps } from '../types'
import { ImageSlot } from './ImageSlot'
import { ProofCallout } from './ProofCallout'
import { SemanticDebugOverlay } from './SemanticDebugOverlay'
import { spacingToMbClass, breathingToPyClass } from '../translators/spacingTranslator'
import { headlineClasses, paragraphClasses, readableMaxWidth } from '../translators/typographyTranslator'

export function SemanticSection({ section, characterName, showDebug = false }: SemanticSectionProps) {
  const { renderContract: rc, visualSemantics: vs } = section
  const mbClass = spacingToMbClass(rc.spacingPreset)
  const pyClass = breathingToPyClass(vs.sectionBreathing)
  const containerMaxWidth = readableMaxWidth()

  // Headline placeholder — composed section doesn't carry title currently
  const headline = section.id

  // Wrap helper: prepends debug overlay when enabled.
  const wrap = (content: ReactNode): ReactNode => (
    <>
      {showDebug && <SemanticDebugOverlay section={section} />}
      {content}
    </>
  )

  // ─── PATTERN: impact-anchor (hero-recognition) ─────────────────────
  if (rc.mobilePattern === 'impact-anchor') {
    return wrap(
      <section className={`${mbClass} ${containerMaxWidth} px-6`}>
        <ImageSlot
          imageRole={section.imageRole}
          aspectRatio={rc.imageAspectRatio}
          characterName={characterName}
        />
        <div className={pyClass}>
          {section.paragraphs.map((p, i) => (
            <p key={i} className={paragraphClasses(rc.textChunking, vs.readingTempo)}>
              {p}
            </p>
          ))}
        </div>
      </section>,
    )
  }

  // ─── PATTERN: breathing-narrative (lived-experience) ───────────────
  if (rc.mobilePattern === 'breathing-narrative') {
    return wrap(
      <section className={`${mbClass} ${containerMaxWidth} px-6`}>
        <ImageSlot
          imageRole={section.imageRole}
          aspectRatio={rc.imageAspectRatio}
          characterName={characterName}
        />
        <div className={pyClass}>
          {section.paragraphs.map((p, i) => (
            <p key={i} className={paragraphClasses(rc.textChunking, vs.readingTempo)}>
              {p}
            </p>
          ))}
        </div>
        {section.inlineProof && (
          <ProofCallout piece={section.inlineProof} presentation={rc.proofPresentation} />
        )}
      </section>,
    )
  }

  // ─── PATTERN: frustration-flat-lay (shared-struggle) ───────────────
  if (rc.mobilePattern === 'frustration-flat-lay') {
    return wrap(
      <section className={`${mbClass} ${containerMaxWidth} px-6`}>
        <ImageSlot
          imageRole={section.imageRole}
          aspectRatio={rc.imageAspectRatio}
          characterName={characterName}
        />
        <div className={pyClass}>
          {section.paragraphs.map((p, i) => (
            <p key={i} className={paragraphClasses(rc.textChunking, vs.readingTempo)}>
              {p}
            </p>
          ))}
        </div>
      </section>,
    )
  }

  // ─── PATTERN: reframe-spotlight (reframe-moment) ───────────────────
  if (rc.mobilePattern === 'reframe-spotlight') {
    return wrap(
      <section className={`${mbClass} ${containerMaxWidth} px-6 text-center`}>
        <div className={`${pyClass} space-y-6`}>
          {section.paragraphs.map((p, i) => (
            <p key={i} className={paragraphClasses(rc.textChunking, vs.readingTempo)}>
              {p}
            </p>
          ))}
        </div>
      </section>,
    )
  }

  // ─── PATTERN: solution-mixed (solution-opening) ────────────────────
  if (rc.mobilePattern === 'solution-mixed') {
    return wrap(
      <section className={`${mbClass} ${containerMaxWidth} px-6`}>
        {section.paragraphs.length > 0 && (
          <p className={paragraphClasses(rc.textChunking, vs.readingTempo)}>
            {section.paragraphs[0]}
          </p>
        )}
        <ImageSlot
          imageRole={section.imageRole}
          aspectRatio={rc.imageAspectRatio}
          characterName={characterName}
        />
        <div className={pyClass}>
          {section.paragraphs.slice(1).map((p, i) => (
            <p key={i + 1} className={paragraphClasses(rc.textChunking, vs.readingTempo)}>
              {p}
            </p>
          ))}
        </div>
        {section.inlineProof && (
          <ProofCallout piece={section.inlineProof} presentation={rc.proofPresentation} />
        )}
      </section>,
    )
  }

  // ─── PATTERN: lifestyle-uplift (transformation) ────────────────────
  if (rc.mobilePattern === 'lifestyle-uplift') {
    return wrap(
      <section className={`${mbClass} ${containerMaxWidth} px-6`}>
        <ImageSlot
          imageRole={section.imageRole}
          aspectRatio={rc.imageAspectRatio}
          characterName={characterName}
        />
        <div className={pyClass}>
          {section.paragraphs.map((p, i) => (
            <p key={i} className={paragraphClasses(rc.textChunking, vs.readingTempo)}>
              {p}
            </p>
          ))}
        </div>
        {section.inlineProof && (
          <ProofCallout piece={section.inlineProof} presentation={rc.proofPresentation} />
        )}
      </section>,
    )
  }

  // ─── PATTERN: closing-quiet (close-invitation) ─────────────────────
  if (rc.mobilePattern === 'closing-quiet') {
    return wrap(
      <section className={`${mbClass} ${containerMaxWidth} px-6`}>
        <div className={`${pyClass} space-y-8`}>
          {section.paragraphs.map((p, i) => (
            <p key={i} className={paragraphClasses(rc.textChunking, vs.readingTempo)}>
              {p}
            </p>
          ))}
        </div>
        {rc.ctaPlacement === 'footer-emphasis' && (
          <div className="mt-8 pt-6 border-t border-stone-200 text-center text-sm text-stone-500 italic">
            — Đến đây tôi xin dừng. Phần tiếp theo là của bạn. —
          </div>
        )}
      </section>,
    )
  }

  // ─── Fallback — render headline placeholder ─────────────────────────
  return wrap(
    <section className={`${mbClass} ${containerMaxWidth} px-6`}>
      <h2 className={headlineClasses(rc.typographyDominance)}>{headline}</h2>
      <div className={pyClass}>
        {section.paragraphs.map((p, i) => (
          <p key={i} className={paragraphClasses(rc.textChunking, vs.readingTempo)}>
            {p}
          </p>
        ))}
      </div>
    </section>,
  )
}
