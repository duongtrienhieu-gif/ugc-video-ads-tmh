// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — SemanticSection (P7 dispatcher)
//
// Single dispatcher with switch on mobilePattern. Each pattern renders
// its own structure. Mobile-only single-column.
//
// UGLY-BUT-CORRECT: minimal styling, focus on scroll rhythm + emotional
// flow validation. No animation, no responsive desktop, no polish.
// ─────────────────────────────────────────────────────────────────────

import type { SemanticSectionProps } from '../types'
import { ImageSlot } from './ImageSlot'
import { ProofCallout } from './ProofCallout'
import { spacingToMbClass, breathingToPyClass } from '../translators/spacingTranslator'
import { headlineClasses, paragraphClasses, readableMaxWidth } from '../translators/typographyTranslator'

export function SemanticSection({ section, characterName }: SemanticSectionProps) {
  const { renderContract: rc, visualSemantics: vs } = section
  const mbClass = spacingToMbClass(rc.spacingPreset)
  const pyClass = breathingToPyClass(vs.sectionBreathing)
  const containerMaxWidth = readableMaxWidth()

  // Headline = section title (1st line / title field)
  const headline = section.id  // placeholder — could use section title from somewhere
  // Note: ComposedSection doesn't carry title currently — paragraphs[0] could
  // be used as headline for hero, but renderer keeps text-only for now.

  // ─── PATTERN: impact-anchor (hero-recognition) ─────────────────────
  if (rc.mobilePattern === 'impact-anchor') {
    return (
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
      </section>
    )
  }

  // ─── PATTERN: breathing-narrative (lived-experience) ───────────────
  if (rc.mobilePattern === 'breathing-narrative') {
    return (
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
      </section>
    )
  }

  // ─── PATTERN: frustration-flat-lay (shared-struggle) ───────────────
  if (rc.mobilePattern === 'frustration-flat-lay') {
    return (
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
      </section>
    )
  }

  // ─── PATTERN: reframe-spotlight (reframe-moment) ───────────────────
  // Pure text-only, centered, slow tempo — pause moment
  if (rc.mobilePattern === 'reframe-spotlight') {
    return (
      <section className={`${mbClass} ${containerMaxWidth} px-6 text-center`}>
        <div className={`${pyClass} space-y-6`}>
          {section.paragraphs.map((p, i) => (
            <p key={i} className={paragraphClasses(rc.textChunking, vs.readingTempo)}>
              {p}
            </p>
          ))}
        </div>
      </section>
    )
  }

  // ─── PATTERN: solution-mixed (solution-opening) ────────────────────
  if (rc.mobilePattern === 'solution-mixed') {
    return (
      <section className={`${mbClass} ${containerMaxWidth} px-6`}>
        {/* Mixed flow: image after first half of paragraphs */}
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
      </section>
    )
  }

  // ─── PATTERN: lifestyle-uplift (transformation) ────────────────────
  if (rc.mobilePattern === 'lifestyle-uplift') {
    return (
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
      </section>
    )
  }

  // ─── PATTERN: closing-quiet (close-invitation) ─────────────────────
  // Airy text-only, no image, decompressed
  if (rc.mobilePattern === 'closing-quiet') {
    return (
      <section className={`${mbClass} ${containerMaxWidth} px-6`}>
        <div className={`${pyClass} space-y-8`}>
          {section.paragraphs.map((p, i) => (
            <p key={i} className={paragraphClasses(rc.textChunking, vs.readingTempo)}>
              {p}
            </p>
          ))}
        </div>
        {/* CTA hint footer — gentle invitation only (no button styling, anti-pressure) */}
        {rc.ctaPlacement === 'footer-emphasis' && (
          <div className="mt-8 pt-6 border-t border-stone-200 text-center text-sm text-stone-500 italic">
            — Đến đây tôi xin dừng. Phần tiếp theo là của bạn. —
          </div>
        )}
      </section>
    )
  }

  // ─── Fallback — render headline placeholder ─────────────────────────
  return (
    <section className={`${mbClass} ${containerMaxWidth} px-6`}>
      <h2 className={headlineClasses(rc.typographyDominance)}>{headline}</h2>
      <div className={pyClass}>
        {section.paragraphs.map((p, i) => (
          <p key={i} className={paragraphClasses(rc.textChunking, vs.readingTempo)}>
            {p}
          </p>
        ))}
      </div>
    </section>
  )
}
